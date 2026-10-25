// Solo ADMIN (el control de rol se aplica al montar el router).
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { z } = require('zod');
const prisma = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middlewares/validate');
const { idParams, texto, alMenosUno, boolQuery } = require('./common');
const { passwordSchema } = require('./auth.routes');

const ROLES = ['ADMIN', 'RECEPCION'];
const SELECT = { id: true, nombre: true, email: true, rol: true, activo: true, creadoEn: true };

const crear = z.object({
  nombre: texto(100),
  email: z.string().trim().toLowerCase().email().max(190),
  password: passwordSchema,
  rol: z.enum(ROLES).default('RECEPCION'),
});
const actualizar = alMenosUno(z.object({
  nombre: texto(100),
  email: z.string().trim().toLowerCase().email().max(190),
  password: passwordSchema,
  rol: z.enum(ROLES),
  activo: z.boolean(),
}).partial());

router.get('/', validate({ query: z.object({ activo: boolQuery.optional() }) }), asyncHandler(async (req, res) => {
  res.json(await prisma.usuario.findMany({ where: { activo: req.query.activo }, select: SELECT, orderBy: { nombre: 'asc' } }));
}));

router.post('/', validate({ body: crear }), asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  res.status(201).json(await prisma.usuario.create({ data: { ...rest, passwordHash }, select: SELECT }));
}));

router.get('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  const u = await prisma.usuario.findUnique({ where: { id: req.params.id }, select: SELECT });
  if (!u) throw new AppError(404, 'Usuario no encontrado', 'NO_ENCONTRADO');
  res.json(u);
}));

router.patch('/:id', validate({ params: idParams, body: actualizar }), asyncHandler(async (req, res) => {
  const { password, ...data } = req.body;
  if (req.params.id === req.user.id && (data.activo === false || (data.rol && data.rol !== 'ADMIN'))) {
    throw new AppError(422, 'No podés desactivarte ni quitarte el rol de administrador', 'AUTO_MODIFICACION');
  }
  if (password) data.passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  res.json(await prisma.usuario.update({ where: { id: req.params.id }, data, select: SELECT }));
}));

router.delete('/:id', validate({ params: idParams }), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new AppError(422, 'No podés eliminar tu propio usuario', 'AUTO_MODIFICACION');
  await prisma.usuario.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

module.exports = router;
