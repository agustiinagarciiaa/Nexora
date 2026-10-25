const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { SERIALIZABLE } = require('./turnos.service');

exports.registrar = ({ turnoId, monto, metodo, referencia }) =>
  prisma.$transaction(async (tx) => {
    const turno = await tx.turno.findUnique({
      where: { id: turnoId },
      include: { pagos: { where: { estado: 'REGISTRADO' } } },
    });
    if (!turno) throw new AppError(422, 'El turno no existe', 'TURNO_INEXISTENTE');
    if (turno.estado === 'CANCELADO') throw new AppError(422, 'No se pueden registrar pagos de un turno cancelado', 'TURNO_CANCELADO');

    const pagado = turno.pagos.reduce((a, p) => a.plus(p.monto), new Prisma.Decimal(0));
    const saldo = new Prisma.Decimal(turno.precio).minus(pagado);
    if (new Prisma.Decimal(monto).gt(saldo)) {
      throw new AppError(422, `El pago excede el saldo pendiente (${saldo.toFixed(2)})`, 'PAGO_EXCEDE_SALDO');
    }
    return tx.pago.create({ data: { turnoId, monto, metodo, referencia: referencia ?? null } });
  }, SERIALIZABLE);

exports.anular = async (id, motivo) => {
  const pago = await prisma.pago.findUnique({ where: { id } });
  if (!pago) throw new AppError(404, 'Pago no encontrado', 'NO_ENCONTRADO');
  if (pago.estado === 'ANULADO') throw new AppError(422, 'El pago ya está anulado', 'PAGO_YA_ANULADO');
  return prisma.pago.update({ where: { id }, data: { estado: 'ANULADO', motivoAnulacion: motivo ?? null } });
};
