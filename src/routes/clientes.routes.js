const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middlewares/validate');
const { paginar, respuestaPaginada } = require('../utils/pagination');
const { idParams, fecha, texto, textoOpc, alMenosUno, boolQuery, paginacion } = require('./common');
const { formatTurno, INCLUDE } = require('../services/turnos.service');

const base = z.object({
  nombre: texto(100),
  apellido: texto(100),
  telefono: texto(30),
  email: z.string().trim().email().max(190).nullish(),
  documento: textoOpc(20),
  fechaNacimiento: fecha.nullish().transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : v)),
  notas: textoOpc(500),
  activo: z.boolean().default(true),
});
const actualizar = alMenosUno(base.partial());

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  activo: boolQuery.optional(),
  ...paginacion,
});

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { q, activo, page, limit } = req.query;
  const where = {
    activo,
    ...(q ? { OR: [
      { nombre: { contains: q } }, { apellido: { contains: q } },
      { telefono: { contains: q } }, { documento: { contains: q } }, { email: { contains: q } },
    ] } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.cliente.findMany({ where, ...paginar(page, limit), orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }] }),
    prisma.cliente.count({ where }),
  ]);
  res.json(respuestaPaginada(data, total, page, limit));
}));

router.post('/', validate({ body: base }), asyncHandler(async (req, res) => {
  res.status(201).json(await prisma.cliente.create({ data: req.body }));
}));

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const c = await prisma.cliente.findUnique({ where: { id: req.params.id } });
  if (!c) throw new AppError(404, 'Cliente no encontrado', 'NO_ENCONTRADO');
  res.json(c);
}));

router.get('/:id/turnos', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const turnos = await prisma.turno.findMany({
    where: { clienteId: req.params.id }, orderBy: { inicio: 'desc' }, include: INCLUDE,
  });
  res.json(turnos.map(formatTurno));
}));

router.patch('/:id', validate({ params: idParams, body: actualizar }), asyncHandler(async (req, res) => {
  res.json(await prisma.cliente.update({ where: { id: req.params.id }, data: req.body }));
}));

router.delete('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const turnos = await prisma.turno.count({ where: { clienteId: req.params.id } });
  if (turnos > 0) {
    throw new AppError(409, 'El cliente tiene turnos registrados. Desactivalo (PATCH activo=false) para conservar el historial.', 'CLIENTE_CON_TURNOS');
  }
  await prisma.cliente.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

module.exports = router;
