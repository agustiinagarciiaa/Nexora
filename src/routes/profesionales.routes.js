const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middlewares/validate');
const { requireRole } = require('../middlewares/auth');
const { paginar, respuestaPaginada } = require('../utils/pagination');
const { parseHM } = require('../utils/time');
const { id, idParams, hm, texto, textoOpc, dinero, alMenosUno, boolQuery, paginacion } = require('./common');

const base = z.object({
  nombre: texto(100),
  apellido: texto(100),
  email: z.string().trim().email().max(190).nullish(),
  telefono: textoOpc(30),
  notas: textoOpc(500),
  activo: z.boolean().default(true),
});
const actualizar = alMenosUno(base.partial());

const listQuery = z.object({
  activo: boolQuery.optional(),
  servicioId: id.optional(),
  q: z.string().trim().max(100).optional(),
  ...paginacion,
});

const serviciosBody = z.object({
  servicios: z.array(z.object({
    servicioId: id,
    precioEspecial: dinero.nullish(),
    duracionEspecialMin: z.number().int().min(5).max(720).nullish(),
  })).max(200),
}).refine((b) => new Set(b.servicios.map((s) => s.servicioId)).size === b.servicios.length,
  'Hay servicios repetidos');

const horariosBody = z.object({
  horarios: z.array(z.object({
    diaSemana: z.number().int().min(0).max(6),
    horaInicio: hm,
    horaFin: hm,
  }).refine((h) => parseHM(h.horaInicio) < parseHM(h.horaFin), 'horaInicio debe ser anterior a horaFin')).max(50),
}).superRefine((b, ctx) => {
  // No se permiten franjas que se pisen dentro del mismo día.
  for (let dia = 0; dia <= 6; dia += 1) {
    const f = b.horarios.filter((h) => h.diaSemana === dia)
      .map((h) => ({ ini: parseHM(h.horaInicio), fin: parseHM(h.horaFin) }))
      .sort((a, c) => a.ini - c.ini);
    for (let i = 1; i < f.length; i += 1) {
      if (f[i].ini < f[i - 1].fin) {
        ctx.addIssue({ code: 'custom', message: `Hay franjas superpuestas el día ${dia}`, path: ['horarios'] });
        break;
      }
    }
  }
});

const existe = async (profId) => {
  const p = await prisma.profesional.findUnique({ where: { id: profId }, select: { id: true } });
  if (!p) throw new AppError(404, 'Profesional no encontrado', 'NO_ENCONTRADO');
};

const SERVICIOS_INCLUDE = {
  servicios: { select: { servicioId: true, precioEspecial: true, duracionEspecialMin: true, servicio: { select: { nombre: true } } } },
};

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { activo, servicioId, q, page, limit } = req.query;
  const where = {
    activo,
    ...(servicioId ? { servicios: { some: { servicioId } } } : {}),
    ...(q ? { OR: [{ nombre: { contains: q } }, { apellido: { contains: q } }] } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.profesional.findMany({ where, ...paginar(page, limit), orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }], include: SERVICIOS_INCLUDE }),
    prisma.profesional.count({ where }),
  ]);
  res.json(respuestaPaginada(data, total, page, limit));
}));

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const p = await prisma.profesional.findUnique({
    where: { id: req.params.id },
    include: { ...SERVICIOS_INCLUDE, horarios: { orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }] } },
  });
  if (!p) throw new AppError(404, 'Profesional no encontrado', 'NO_ENCONTRADO');
  res.json(p);
}));

router.post('/', requireRole('ADMIN'), validate({ body: base }), asyncHandler(async (req, res) => {
  res.status(201).json(await prisma.profesional.create({ data: req.body }));
}));

router.patch('/:id', requireRole('ADMIN'), validate({ params: idParams, body: actualizar }), asyncHandler(async (req, res) => {
  res.json(await prisma.profesional.update({ where: { id: req.params.id }, data: req.body }));
}));

router.delete('/:id', requireRole('ADMIN'), validate({ params: idParams }), asyncHandler(async (req, res) => {
  const turnos = await prisma.turno.count({ where: { profesionalId: req.params.id } });
  if (turnos > 0) {
    throw new AppError(409, 'El profesional tiene turnos registrados. Desactivalo (PATCH activo=false) para conservar el historial.', 'PROFESIONAL_CON_TURNOS');
  }
  await prisma.profesional.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// ---- Servicios que realiza cada profesional (reemplaza el conjunto completo) ----
router.get('/:id/servicios', validate({ params: idParams }), asyncHandler(async (req, res) => {
  await existe(req.params.id);
  res.json(await prisma.profesionalServicio.findMany({
    where: { profesionalId: req.params.id },
    include: { servicio: { select: { id: true, nombre: true, duracionMin: true, precio: true, categoriaId: true } } },
  }));
}));

router.put('/:id/servicios', requireRole('ADMIN'), validate({ params: idParams, body: serviciosBody }), asyncHandler(async (req, res) => {
  await existe(req.params.id);
  const ids = req.body.servicios.map((s) => s.servicioId);
  const encontrados = await prisma.servicio.count({ where: { id: { in: ids } } });
  if (encontrados !== ids.length) throw new AppError(422, 'Alguno de los servicios indicados no existe', 'SERVICIO_INEXISTENTE');

  await prisma.$transaction([
    prisma.profesionalServicio.deleteMany({ where: { profesionalId: req.params.id } }),
    prisma.profesionalServicio.createMany({
      data: req.body.servicios.map((s) => ({
        profesionalId: req.params.id,
        servicioId: s.servicioId,
        precioEspecial: s.precioEspecial ?? null,
        duracionEspecialMin: s.duracionEspecialMin ?? null,
      })),
    }),
  ]);
  res.json(await prisma.profesionalServicio.findMany({ where: { profesionalId: req.params.id } }));
}));

// ---- Horarios semanales (reemplaza la grilla completa) ----
router.get('/:id/horarios', validate({ params: idParams }), asyncHandler(async (req, res) => {
  await existe(req.params.id);
  res.json(await prisma.horario.findMany({ where: { profesionalId: req.params.id }, orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }] }));
}));

router.put('/:id/horarios', requireRole('ADMIN'), validate({ params: idParams, body: horariosBody }), asyncHandler(async (req, res) => {
  await existe(req.params.id);
  await prisma.$transaction([
    prisma.horario.deleteMany({ where: { profesionalId: req.params.id } }),
    prisma.horario.createMany({ data: req.body.horarios.map((h) => ({ ...h, profesionalId: req.params.id })) }),
  ]);
  res.json(await prisma.horario.findMany({ where: { profesionalId: req.params.id }, orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }] }));
}));

module.exports = router;
