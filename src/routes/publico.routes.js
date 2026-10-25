// Catálogo PÚBLICO de solo lectura para la portada (sin token).
// Expone únicamente categorías/servicios/profesionales ACTIVOS y campos no sensibles:
// nunca email, teléfono ni notas internas. No hay escrituras en este router.
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { code: 'DEMASIADAS_SOLICITUDES', message: 'Demasiadas solicitudes, probá en un minuto' } },
}));

router.get('/categorias', asyncHandler(async (req, res) => {
  const categorias = await prisma.categoria.findMany({
    where: { activa: true },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      servicios: {
        where: { activo: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, descripcion: true, duracionMin: true, precio: true },
      },
    },
  });
  // Una categoría sin servicios activos no tiene nada para reservar: no se publica.
  res.json(categorias.filter((c) => c.servicios.length > 0));
}));

router.get('/profesionales', asyncHandler(async (req, res) => {
  const profesionales = await prisma.profesional.findMany({
    where: { activo: true },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      apellido: true,
      servicios: {
        where: { servicio: { activo: true, categoria: { activa: true } } },
        select: {
          precioEspecial: true,
          duracionEspecialMin: true,
          servicio: { select: { id: true, nombre: true, categoriaId: true, duracionMin: true, precio: true } },
        },
      },
    },
  });
  res.json(profesionales
    .filter((p) => p.servicios.length > 0)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      apellido: p.apellido,
      // Solo lo que realmente realiza cada profesional, con su precio/duración propios si los tiene.
      servicios: p.servicios.map((ps) => ({
        id: ps.servicio.id,
        nombre: ps.servicio.nombre,
        categoriaId: ps.servicio.categoriaId,
        duracionMin: ps.duracionEspecialMin ?? ps.servicio.duracionMin,
        precio: ps.precioEspecial ?? ps.servicio.precio,
      })),
    })));
}));

module.exports = router;
