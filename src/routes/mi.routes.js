// Autoservicio: el CLIENTE ve/reserva/cancela SUS turnos y el PROFESIONAL gestiona SU agenda.
// El id del cliente/profesional sale SIEMPRE del token (req.user), nunca del cuerpo ni de la URL:
// nadie puede ver ni tocar turnos ajenos.
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
const turnos = require('../services/turnos.service');

const MAX_TURNOS_ACTIVOS = 5; // evita acaparar la agenda desde una cuenta
const instante = z.string().datetime({ offset: true }).transform((s) => new Date(s));

router.use(requireRole('CLIENTE', 'PROFESIONAL'));

// Filtro de propiedad según el rol. Si la cuenta no está vinculada a su ficha, no se puede operar.
const propio = (u) => {
  const clave = u.rol === 'CLIENTE' ? 'clienteId' : 'profesionalId';
  if (!u[clave]) throw new AppError(403, 'Tu cuenta no está vinculada a una ficha. Contactá al administrador.', 'CUENTA_SIN_VINCULO');
  return { [clave]: u[clave] };
};

router.get('/turnos', validate({ query: z.object({ desde: fecha.optional(), hasta: fecha.optional(), ...paginacion }) }),
  asyncHandler(async (req, res) => {
    const { desde, hasta, page, limit } = req.query;
    const where = propio(req.user);
    if (desde || hasta) {
      where.inicio = {};
      if (desde) where.inicio.gte = localToUtc(desde, 0, env.TZ_OFFSET_MINUTES);
      if (hasta) where.inicio.lt = localToUtc(hasta, 24 * 60, env.TZ_OFFSET_MINUTES);
    }
    const [data, total] = await Promise.all([
      prisma.turno.findMany({
        where, ...paginar(page, limit), include: turnos.INCLUDE,
        orderBy: { inicio: req.user.rol === 'CLIENTE' ? 'desc' : 'asc' },
      }),
      prisma.turno.count({ where }),
    ]);
    res.json(respuestaPaginada(data.map(turnos.formatTurno), total, page, limit));
  }));

// Reserva del cliente: pasa por las mismas reglas de negocio que la reserva del personal.
router.post('/turnos', requireRole('CLIENTE'),
  validate({ body: z.object({ profesionalId: id, servicioId: id, inicio: instante, notas: textoOpc(500) }) }),
  asyncHandler(async (req, res) => {
    const { clienteId } = propio(req.user);
    const activos = await prisma.turno.count({
      where: { clienteId, estado: { in: ['PENDIENTE', 'CONFIRMADO'] }, inicio: { gte: new Date() } },
    });
    if (activos >= MAX_TURNOS_ACTIVOS) {
      throw new AppError(422, `Ya tenés ${MAX_TURNOS_ACTIVOS} turnos activos. Cancelá alguno o esperá a que se realice.`, 'LIMITE_TURNOS');
    }
    res.status(201).json(await turnos.crear({ clienteId, ...req.body }));
  }));

// Se responde 404 (no 403) si el turno es de otra persona, para no revelar que existe.
const turnoPropio = async (req) => {
  const t = await prisma.turno.findFirst({ where: { id: req.params.id, ...propio(req.user) } });
  if (!t) throw new AppError(404, 'Turno no encontrado', 'NO_ENCONTRADO');
  return t;
};

router.patch('/turnos/:id/cancelar', requireRole('CLIENTE'), validate({ params: idParams }), asyncHandler(async (req, res) => {
  await turnoPropio(req);
  res.json(await turnos.cambiarEstado(req.params.id, 'CANCELADO'));
}));

// El profesional confirma, completa, marca ausencia o cancela sus turnos.
router.patch('/turnos/:id/estado', requireRole('PROFESIONAL'),
  validate({ params: idParams, body: z.object({ estado: z.enum(['CONFIRMADO', 'COMPLETADO', 'CANCELADO', 'AUSENTE']) }) }),
  asyncHandler(async (req, res) => {
    await turnoPropio(req);
    res.json(await turnos.cambiarEstado(req.params.id, req.body.estado));
  }));

module.exports = router;
