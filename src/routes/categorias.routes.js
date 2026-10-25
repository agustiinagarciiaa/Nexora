const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middlewares/validate');
const { requireRole } = require('../middlewares/auth');
const { idParams, texto, textoOpc, alMenosUno, boolQuery } = require('./common');

const base = z.object({
  nombre: texto(100),
  descripcion: textoOpc(500),
  orden: z.number().int().min(0).default(0),
  activa: z.boolean().default(true),
});
const actualizar = alMenosUno(base.partial());

router.get('/', validate({ query: z.object({ activa: boolQuery.optional() }) }), asyncHandler(async (req, res) => {
  res.json(await prisma.categoria.findMany({
    where: { activa: req.query.activa },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: { _count: { select: { servicios: true } } },
  }));
}));

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const c = await prisma.categoria.findUnique({
    where: { id: req.params.id },
    include: { servicios: { orderBy: { nombre: 'asc' } } },
  });
  if (!c) throw new AppError(404, 'Categoría no encontrada', 'NO_ENCONTRADO');
  res.json(c);
}));

router.post('/', requireRole('ADMIN'), validate({ body: base }), asyncHandler(async (req, res) => {
  res.status(201).json(await prisma.categoria.create({ data: req.body }));
}));

router.patch('/:id', requireRole('ADMIN'), validate({ params: idParams, body: actualizar }), asyncHandler(async (req, res) => {
  res.json(await prisma.categoria.update({ where: { id: req.params.id }, data: req.body }));
}));

router.delete('/:id', requireRole('ADMIN'), validate({ params: idParams }), asyncHandler(async (req, res) => {
  const servicios = await prisma.servicio.count({ where: { categoriaId: req.params.id } });
  if (servicios > 0) {
    throw new AppError(409,
      `La categoría tiene ${servicios} servicio(s). Eliminá o reasigná los servicios, o desactivá la categoría (PATCH activa=false).`,
      'CATEGORIA_CON_SERVICIOS');
  }
  await prisma.categoria.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

module.exports = router;
