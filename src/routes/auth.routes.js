const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const prisma = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { texto } = require('./common');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos. Probá de nuevo en unos minutos.' } },
});

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { code: 'DEMASIADOS_REGISTROS', message: 'Demasiados registros desde este dispositivo. Probá más tarde.' } },
});

// Hash falso para que el tiempo de respuesta sea parecido exista o no el usuario.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', env.BCRYPT_ROUNDS);

const password = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Debe contener al menos una letra')
  .regex(/\d/, 'Debe contener al menos un número');

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

const emitirSesion = (user) => ({
  token: jwt.sign({ rol: user.rol }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  }),
  usuario: {
    id: user.id, nombre: user.nombre, email: user.email, rol: user.rol,
    clienteId: user.clienteId, profesionalId: user.profesionalId,
  },
});

router.post('/login', loginLimiter, validate({ body: loginSchema }), asyncHandler(async (req, res) => {
  const { email, password: pass } = req.body;
  const user = await prisma.usuario.findUnique({ where: { email } });
  const ok = await bcrypt.compare(pass, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !user.activo || !ok) throw new AppError(401, 'Credenciales inválidas', 'CREDENCIALES_INVALIDAS');

  res.json(emitirSesion(user));
}));

// Registro público de CLIENTES: crea la ficha de cliente y su usuario (rol CLIENTE) en una sola transacción.
// Los roles ADMIN, RECEPCION y PROFESIONAL nunca se asignan desde acá: los crea un administrador.
const registroSchema = z.object({
  nombre: texto(100),
  apellido: texto(100),
  telefono: texto(30),
  email: z.string().trim().toLowerCase().email().max(190),
  password,
});

router.post('/registro', registroLimiter, validate({ body: registroSchema }), asyncHandler(async (req, res) => {
  const { nombre, apellido, telefono, email, password: pass } = req.body;
  const passwordHash = await bcrypt.hash(pass, env.BCRYPT_ROUNDS);
  const user = await prisma.$transaction(async (tx) => {
    if (await tx.usuario.findUnique({ where: { email } })) {
      throw new AppError(409, 'Ya existe una cuenta con ese email', 'EMAIL_EN_USO');
    }
    const cliente = await tx.cliente.create({ data: { nombre, apellido, telefono, email } });
    return tx.usuario.create({
      data: { nombre: `${nombre} ${apellido}`.slice(0, 100), email, passwordHash, rol: 'CLIENTE', clienteId: cliente.id },
    });
  });
  res.status(201).json(emitirSesion(user));
}));

router.get('/me', authenticate, (req, res) => res.json(req.user));

router.post('/cambiar-password', authenticate,
  validate({ body: z.object({ passwordActual: z.string().min(1), passwordNueva: password }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(req.body.passwordActual, user.passwordHash))) {
      throw new AppError(400, 'La contraseña actual es incorrecta', 'PASSWORD_ACTUAL_INCORRECTA');
    }
    const passwordHash = await bcrypt.hash(req.body.passwordNueva, env.BCRYPT_ROUNDS);
    await prisma.usuario.update({ where: { id: user.id }, data: { passwordHash } });
    res.status(204).end();
  }));

module.exports = router;
module.exports.passwordSchema = password;
