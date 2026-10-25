const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

exports.authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Token requerido', 'NO_AUTENTICADO');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new AppError(401, 'Token inválido o vencido', 'TOKEN_INVALIDO');
  }

  // Se consulta el usuario en cada request: así desactivar a alguien corta su acceso de inmediato.
  const user = await prisma.usuario.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });
  if (!user || !user.activo) throw new AppError(401, 'Usuario inexistente o desactivado', 'TOKEN_INVALIDO');

  req.user = user;
  next();
});

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.rol)
    ? next()
    : next(new AppError(403, 'No tenés permisos para realizar esta acción', 'PROHIBIDO'));
