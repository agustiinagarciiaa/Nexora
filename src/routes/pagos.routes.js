const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middlewares/validate');
const { requireRole } = require('../middlewares/auth');
const { paginar, respuestaPaginada } = require('../utils/pagination');
const { localToUtc } = require('../utils/time');
const { id, idParams, fecha, textoOpc, paginacion } = require('./common');
const pagos = require('../services/pagos.service');

const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'MERCADOPAGO', 'OTRO'];

const crear = z.object({
  turnoId: id,
  monto: z.number().positive().max(99999999.99),
  metodo: z.enum(METODOS),
  referencia: textoOpc(100),
});

const rango = { desde: fecha.optional(), hasta: fecha.optional() };
const whereFecha = ({ desde, hasta }) => {
  if (!desde && !hasta) return undefined;
  const f = {};
  if (desde) f.gte = localToUtc(desde, 0, env.TZ_OFFSET_MINUTES);
  if (hasta) f.lt = localToUtc(hasta, 24 * 60, env.TZ_OFFSET_MINUTES);
  return f;
};

router.get('/', validate({ query: z.object({
  turnoId: id.optional(), metodo: z.enum(METODOS).optional(), estado: z.enum(['REGISTRADO', 'ANULADO']).optional(),
  ...rango, ...paginacion,
}) }), asyncHandler(async (req, res) => {
  const { turnoId, metodo, estado, page, limit } = req.query;
  const where = { turnoId, metodo, estado, fecha: whereFecha(req.query) };
  const [data, total] = await Promise.all([
    prisma.pago.findMany({ where, ...paginar(page, limit), orderBy: { fecha: 'desc' } }),
    prisma.pago.count({ where }),
  ]);
  res.json(respuestaPaginada(data, total, page, limit));
}));

// Ingresos (solo pagos vigentes) agrupados por método.
router.get('/resumen', requireRole('ADMIN'), validate({ query: z.object(rango) }), asyncHandler(async (req, res) => {
  const grupos = await prisma.pago.groupBy({
    by: ['metodo'],
    where: { estado: 'REGISTRADO', fecha: whereFecha(req.query) },
    _sum: { monto: true },
    _count: { _all: true },
  });
  const porMetodo = grupos.map((g) => ({ metodo: g.metodo, cantidad: g._count._all, total: g._sum.monto.toFixed(2) }));
  const total = grupos.reduce((acc, g) => acc + Number(g._sum.monto), 0);
  res.json({ desde: req.query.desde ?? null, hasta: req.query.hasta ?? null, total: total.toFixed(2), porMetodo });
}));

router.post('/', validate({ body: crear }), asyncHandler(async (req, res) => {
  res.status(201).json(await pagos.registrar(req.body));
}));

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const p = await prisma.pago.findUnique({ where: { id: req.params.id } });
  if (!p) throw new AppError(404, 'Pago no encontrado', 'NO_ENCONTRADO');
  res.json(p);
}));

router.patch('/:id/anular', requireRole('ADMIN'),
  validate({ params: idParams, body: z.object({ motivo: textoOpc(300) }) }),
  asyncHandler(async (req, res) => res.json(await pagos.anular(req.params.id, req.body.motivo))));

module.exports = router;
