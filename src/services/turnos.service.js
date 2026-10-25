const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const {
  parseHM, toHM, dayOfWeek, localToUtc, toLocalParts, floorToMinute, computeSlots,
} = require('../utils/time');

// Un turno cancelado libera el horario; cualquier otro estado lo ocupa.
const ESTADO_LIBRE = 'CANCELADO';

const TRANSICIONES = {
  PENDIENTE: ['CONFIRMADO', 'COMPLETADO', 'CANCELADO', 'AUSENTE'],
  CONFIRMADO: ['COMPLETADO', 'CANCELADO', 'AUSENTE'],
  COMPLETADO: [],
  CANCELADO: [],
  AUSENTE: [],
};

const INCLUDE = {
  cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
  profesional: { select: { id: true, nombre: true, apellido: true } },
  servicio: { select: { id: true, nombre: true } },
  pagos: { orderBy: { fecha: 'asc' } },
};

// Serializable evita que dos reservas simultáneas ocupen el mismo horario.
const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

const formatTurno = (t) => {
  const pagado = (t.pagos || [])
    .filter((p) => p.estado === 'REGISTRADO')
    .reduce((acc, p) => acc.plus(p.monto), new Prisma.Decimal(0));
  return {
    ...t,
    totalPagado: pagado.toFixed(2),
    saldo: new Prisma.Decimal(t.precio).minus(pagado).toFixed(2),
  };
};

/**
 * Valida todas las reglas de negocio de un turno y calcula fin, duración y precio.
 * Se ejecuta dentro de una transacción.
 */
async function validarTurno(tx, { clienteId, profesionalId, servicioId, inicio, excludeId }) {
  const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) throw new AppError(422, 'El cliente no existe', 'CLIENTE_INEXISTENTE');
  if (!cliente.activo) throw new AppError(422, 'El cliente está inactivo', 'CLIENTE_INACTIVO');

  const profesional = await tx.profesional.findUnique({ where: { id: profesionalId } });
  if (!profesional) throw new AppError(422, 'El profesional no existe', 'PROFESIONAL_INEXISTENTE');
  if (!profesional.activo) throw new AppError(422, 'El profesional está inactivo', 'PROFESIONAL_INACTIVO');

  const servicio = await tx.servicio.findUnique({ where: { id: servicioId } });
  if (!servicio) throw new AppError(422, 'El servicio no existe', 'SERVICIO_INEXISTENTE');
  if (!servicio.activo) throw new AppError(422, 'El servicio está inactivo', 'SERVICIO_INACTIVO');

  const ps = await tx.profesionalServicio.findUnique({
    where: { profesionalId_servicioId: { profesionalId, servicioId } },
  });
  if (!ps) throw new AppError(422, 'El profesional no realiza este servicio', 'PROFESIONAL_SIN_SERVICIO');

  const duracionMin = ps.duracionEspecialMin ?? servicio.duracionMin;
  const precio = ps.precioEspecial ?? servicio.precio;
  const inicioD = floorToMinute(inicio);
  const finD = new Date(inicioD.getTime() + duracionMin * 60000);

  if (inicioD <= new Date()) throw new AppError(422, 'El turno debe ser en el futuro', 'TURNO_EN_EL_PASADO');

  const li = toLocalParts(inicioD, env.TZ_OFFSET_MINUTES);
  const lf = toLocalParts(finD, env.TZ_OFFSET_MINUTES);
  const horarios = await tx.horario.findMany({ where: { profesionalId, diaSemana: li.dow } });
  const dentro = li.dateStr === lf.dateStr && horarios.some(
    (h) => li.minutes >= parseHM(h.horaInicio) && lf.minutes <= parseHM(h.horaFin),
  );
  if (!dentro) {
    throw new AppError(422, 'El turno queda fuera del horario de atención del profesional', 'FUERA_DE_HORARIO');
  }

  const choque = await tx.turno.findFirst({
    where: {
      profesionalId,
      estado: { not: ESTADO_LIBRE },
      id: excludeId ? { not: excludeId } : undefined,
      inicio: { lt: finD },
      fin: { gt: inicioD },
    },
    select: { id: true },
  });
  if (choque) throw new AppError(409, 'El profesional ya tiene un turno en ese horario', 'TURNO_SUPERPUESTO');

  return { inicio: inicioD, fin: finD, duracionMin, precio };
}

exports.crear = ({ clienteId, profesionalId, servicioId, inicio, notas }) =>
  prisma.$transaction(async (tx) => {
    const calc = await validarTurno(tx, { clienteId, profesionalId, servicioId, inicio });
    const t = await tx.turno.create({
      data: { clienteId, profesionalId, servicioId, notas: notas ?? null, ...calc },
      include: INCLUDE,
    });
    return formatTurno(t);
  }, SERIALIZABLE);

exports.actualizar = (id, data) =>
  prisma.$transaction(async (tx) => {
    const actual = await tx.turno.findUnique({ where: { id } });
    if (!actual) throw new AppError(404, 'Turno no encontrado', 'NO_ENCONTRADO');

    const reprograma = data.inicio || data.profesionalId || data.servicioId;
    const patch = {};
    if (data.notas !== undefined) patch.notas = data.notas;

    if (reprograma) {
      if (!['PENDIENTE', 'CONFIRMADO'].includes(actual.estado)) {
        throw new AppError(422, `No se puede reprogramar un turno ${actual.estado}`, 'ESTADO_NO_MODIFICABLE');
      }
      const next = {
        clienteId: actual.clienteId,
        profesionalId: data.profesionalId ?? actual.profesionalId,
        servicioId: data.servicioId ?? actual.servicioId,
        inicio: data.inicio ?? actual.inicio,
        excludeId: id,
      };
      const calc = await validarTurno(tx, next);
      const mismoPrecio = next.profesionalId === actual.profesionalId && next.servicioId === actual.servicioId;
      Object.assign(patch, {
        profesionalId: next.profesionalId,
        servicioId: next.servicioId,
        inicio: calc.inicio,
        fin: calc.fin,
        duracionMin: calc.duracionMin,
        precio: mismoPrecio ? actual.precio : calc.precio, // se respeta el precio pactado si no cambia nada comercial
      });
    }
    const t = await tx.turno.update({ where: { id }, data: patch, include: INCLUDE });
    return formatTurno(t);
  }, SERIALIZABLE);

exports.cambiarEstado = async (id, estado) => {
  const actual = await prisma.turno.findUnique({ where: { id } });
  if (!actual) throw new AppError(404, 'Turno no encontrado', 'NO_ENCONTRADO');
  if (!TRANSICIONES[actual.estado].includes(estado)) {
    throw new AppError(422, `No se puede pasar de ${actual.estado} a ${estado}`, 'TRANSICION_INVALIDA');
  }
  const t = await prisma.turno.update({ where: { id }, data: { estado }, include: INCLUDE });
  return formatTurno(t);
};

exports.disponibilidad = async ({ profesionalId, servicioId, fecha }) => {
  const ps = await prisma.profesionalServicio.findUnique({
    where: { profesionalId_servicioId: { profesionalId, servicioId } },
    include: { servicio: true, profesional: true },
  });
  if (!ps) throw new AppError(422, 'El profesional no realiza este servicio', 'PROFESIONAL_SIN_SERVICIO');
  if (!ps.profesional.activo || !ps.servicio.activo) {
    throw new AppError(422, 'El profesional o el servicio están inactivos', 'INACTIVO');
  }

  const off = env.TZ_OFFSET_MINUTES;
  const duracionMin = ps.duracionEspecialMin ?? ps.servicio.duracionMin;
  const precio = ps.precioEspecial ?? ps.servicio.precio;

  const horarios = await prisma.horario.findMany({ where: { profesionalId, diaSemana: dayOfWeek(fecha) } });
  const dayStart = localToUtc(fecha, 0, off);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);
  const turnos = await prisma.turno.findMany({
    where: { profesionalId, estado: { not: ESTADO_LIBRE }, inicio: { lt: dayEnd }, fin: { gt: dayStart } },
    select: { inicio: true, fin: true },
  });

  const slots = computeSlots({
    blocks: horarios.map((h) => ({ ini: parseHM(h.horaInicio), fin: parseHM(h.horaFin) })),
    busy: turnos.map((t) => ({ ini: (t.inicio - dayStart) / 60000, fin: (t.fin - dayStart) / 60000 })),
    duration: duracionMin,
    step: env.SLOT_MINUTES,
  });

  const ahora = new Date();
  return {
    fecha, profesionalId, servicioId, duracionMin, precio,
    horarios: slots
      .map((s) => ({ hora: toHM(s), inicio: localToUtc(fecha, s, off) }))
      .filter((s) => s.inicio > ahora)
      .map((s) => ({ hora: s.hora, inicio: s.inicio.toISOString() })),
  };
};

exports.INCLUDE = INCLUDE;
exports.formatTurno = formatTurno;
exports.SERIALIZABLE = SERIALIZABLE;
