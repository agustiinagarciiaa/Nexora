const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middlewares/validate');
const { paginar, respuestaPaginada } = require('../utils/pagination');
const { localToUtc } = require('../utils/time');
const { id, idParams, fecha, textoOpc, alMenosUno, paginacion } = require('./common');
const turnos = require('../services/turnos.service');

const ESTADOS = ['PENDIENTE', 'CONFIRMADO', 'COMPLETADO', 'CANCELADO', 'AUSENTE'];
// El instante debe incluir zona horaria (ej. 2025-06-10T15:00:00-03:00 o ...Z).
const instante = z.string().datetime({ offset: true }).transform((s) => new Date(s));

const crear = z.object({
  clienteId: id, profesionalId: id, servicioId: id, inicio: instante, notas: textoOpc(500),
});
const actualizar = alMenosUno(z.object({
  profesionalId: id, servicioId: id, inicio: instante, notas: textoOpc(500),
}).partial());

const listQuery = z.object({
  desde: fecha.optional(), // fecha local inclusive
  hasta: fecha.optional(), // fecha local inclusive
  profesionalId: id.optional(),
  clienteId: id.optional(),
  servicioId: id.optional(),
  estado: z.enum(ESTADOS).optional(),
  ...paginacion,
});

router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const { desde, hasta, profesionalId, clienteId, servicioId, estado, page, limit } = req.query;
  const off = env.TZ_OFFSET_MINUTES;
  const where = { profesionalId, clienteId, servicioId, estado };
  if (desde || hasta) {
    where.inicio = {};
    if (desde) where.inicio.gte = localToUtc(desde, 0, off);
    if (hasta) where.inicio.lt = localToUtc(hasta, 24 * 60, off);
  }
  const [data, total] = await Promise.all([
    prisma.turno.findMany({ where, ...paginar(page, limit), orderBy: { inicio: 'asc' }, include: turnos.INCLUDE }),
    prisma.turno.count({ where }),
  ]);
  res.json(respuestaPaginada(data.map(turnos.formatTurno), total, page, limit));
}));

router.post('/', validate({ body: crear }), asyncHandler(async (req, res) => {
  res.status(201).json(await turnos.crear(req.body));
}));

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const t = await prisma.turno.findUnique({ where: { id: req.params.id }, include: turnos.INCLUDE });
  if (!t) throw new AppError(404, 'Turno no encontrado', 'NO_ENCONTRADO');
  res.json(turnos.formatTurno(t));
}));

router.patch('/:id', validate({ params: idParams, body: actualizar }), asyncHandler(async (req, res) => {
  res.json(await turnos.actualizar(req.params.id, req.body));
}));

router.patch('/:id/estado', validate({ params: idParams, body: z.object({ estado: z.enum(ESTADOS) }) }), asyncHandler(async (req, res) => {
  res.json(await turnos.cambiarEstado(req.params.id, req.body.estado));
}));

module.exports = router;
