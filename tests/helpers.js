process.env.NODE_ENV = 'test';
const request = require('supertest');
const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const prisma = require('../src/config/prisma');
const app = require('../src/app');

if (!/test/i.test(env.DATABASE_URL)) {
  throw new Error('Los tests borran datos: DATABASE_URL debe apuntar a una base cuyo nombre contenga "test".');
}

async function resetDb() {
  await prisma.pago.deleteMany();
  await prisma.turno.deleteMany();
  await prisma.horario.deleteMany();
  await prisma.profesionalServicio.deleteMany();
  await prisma.profesional.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.usuario.deleteMany();
}

async function crearUsuario(rol, email) {
  const password = 'Clave12345';
  await prisma.usuario.create({
    data: { nombre: `Test ${rol}`, email, rol, passwordHash: await bcrypt.hash(password, 4) },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const pad = (n) => String(n).padStart(2, '0');

// Próxima fecha local (YYYY-MM-DD) con el día de semana pedido, al menos 2 días en el futuro.
function proximaFecha(dow) {
  const d = new Date(Date.now() + env.TZ_OFFSET_MINUTES * 60000 + 2 * 86400000);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// "2025-06-10" + "10:00" -> "2025-06-10T10:00:00-03:00"
function isoLocal(fecha, hhmm) {
  const off = env.TZ_OFFSET_MINUTES;
  const abs = Math.abs(off);
  return `${fecha}T${hhmm}:00${off < 0 ? '-' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

module.exports = { app, request, prisma, resetDb, crearUsuario, auth, proximaFecha, isoLocal };
