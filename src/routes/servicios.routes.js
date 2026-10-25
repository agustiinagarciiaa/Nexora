const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middlewares/validate');
const { requireRole } = require('../middlewares/auth');
const { paginar, respuestaPaginada } = require('../utils/pagination');
const { id, idParams, texto, textoOpc, dinero, alMenosUno, boolQuery, paginacion } = require('./common');

const base = z.object({
  categoriaId: id,
  nombre: texto(150),
  descripcion: textoOpc(500),
  duracionMin: z.number().int().min(5).max(720),
  precio: dinero,
  activo: z.boolean().default(true),
});
const actualizar = alMenosUno(base.partial());

const listQuery = z.object({
  categoriaId: id.optional(),
  activo: boolQuery.optional(),
  q: z.string().trim().max(100).optional(),
  ...paginacion,
});

const asegurarCategoria = async (categoriaId) => {
  const c = await prisma.categoria.findUnique({ where: { id: categoriaId }, select: { id: true } });
  if (!c) throw new AppError(422, 'La categoría indicada no existe', 'CATEGORIA_INEXISTENTE');
};

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { categoriaId, activo, q, page, limit } = req.query;
  const where = { categoriaId, activo, ...(q ? { nombre: { contains: q } } : {}) };
  const [data, total] = await Promise.all([
    prisma.servicio.findMany({
      where, ...paginar(page, limit),
      orderBy: [{ categoriaId: 'asc' }, { nombre: 'asc' }],
      include: { categoria: { select: { id: true, nombre: true } } },
    }),
    prisma.servicio.count({ where }),
  ]);
  res.json(respuestaPaginada(data, total, page, limit));
}));

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const s = await prisma.servicio.findUnique({
    where: { id: req.params.id },
    include: { categoria: { select: { id: true, nombre: true } } },
  });
  if (!s) throw new AppError(404, 'Servicio no encontrado', 'NO_ENCONTRADO');
  res.json(s);
}));

router.get('/:id/profesionales', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const rows = await prisma.profesionalServicio.findMany({
    where: { servicioId: req.params.id, profesional: { activo: true } },
    include: { profesional: { select: { id: true, nombre: true, apellido: true } } },
  });
  res.json(rows.map((r) => ({ ...r.profesional, precioEspecial: r.precioEspecial, duracionEspecialMin: r.duracionEspecialMin })));
}));

router.post('/', requireRole('ADMIN'), validate({ body: base }), asyncHandler(async (req, res) => {
  await asegurarCategoria(req.body.categoriaId);
  res.status(201).json(await prisma.servicio.create({ data: req.body }));
}));

router.patch('/:id', requireRole('ADMIN'), validate({ params: idParams, body: actualizar }), asyncHandler(async (req, res) => {
  if (req.body.categoriaId) await asegurarCategoria(req.body.categoriaId);
  res.json(await prisma.servicio.update({ where: { id: req.params.id }, data: req.body }));
}));

router.delete('/:id', requireRole('ADMIN'), validate({ params: idParams }), asyncHandler(async (req, res) => {
  const turnos = await prisma.turno.count({ where: { servicioId: req.params.id } });
  if (turnos > 0) {
    throw new AppError(409, 'El servicio tiene turnos registrados. Desactivalo (PATCH activo=false) para conservar el historial.', 'SERVICIO_CON_TURNOS');
  }
  await prisma.servicio.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

module.exports = router;
