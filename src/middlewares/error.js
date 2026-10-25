const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');
const env = require('../config/env');

const send = (res, status, code, message, details) =>
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });

exports.notFound = (req, res) =>
  send(res, 404, 'RUTA_NO_ENCONTRADA', `No existe ${req.method} ${req.originalUrl}`);

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) return send(res, err.status, err.code, err.message, err.details);

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    return send(res, 400, 'VALIDACION', 'Los datos enviados no son válidos', details);
  }

  if (err.type === 'entity.parse.failed') return send(res, 400, 'JSON_INVALIDO', 'El cuerpo no es un JSON válido');
  if (err.type === 'entity.too.large') return send(res, 413, 'PAYLOAD_GRANDE', 'El cuerpo es demasiado grande');

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': return send(res, 409, 'DUPLICADO', 'Ya existe un registro con esos datos');
      case 'P2025': return send(res, 404, 'NO_ENCONTRADO', 'El registro no existe');
      case 'P2003': return send(res, 409, 'RELACION_INVALIDA', 'El registro está relacionado con otros datos o referencia algo inexistente');
      case 'P2034': return send(res, 409, 'CONFLICTO_CONCURRENCIA', 'Otra operación se superpuso con esta. Reintentá.');
      default: break;
    }
  }

  if (!env.isTest) console.error(err);
  return send(res, 500, 'ERROR_INTERNO', env.isProd ? 'Error interno del servidor' : err.message);
};
