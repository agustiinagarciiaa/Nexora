const { app, request, prisma, resetDb, auth, proximaFecha, isoLocal } = require('./helpers');

beforeAll(() => resetDb());
afterAll(() => prisma.$disconnect());

const registrar = (extra = {}) => request(app).post('/api/auth/registro').send({
  nombre: 'Lola', apellido: 'Mora', telefono: '3815550001', email: 'lola@test.local', password: 'Segura1234', ...extra,
});

describe('Registro de clientes y autoservicio', () => {
  let lola; let ana; let turnoAna; let serv; let prof; let dia;

  test('registro crea cliente + usuario CLIENTE y devuelve sesión; no permite elegir rol', async () => {
    const r = await registrar({ rol: 'ADMIN' });
    expect(r.status).toBe(201);
    expect(r.body.usuario.rol).toBe('CLIENTE');
    expect(r.body.usuario.clienteId).toBeGreaterThan(0);
    lola = r.body;
    const db = await prisma.usuario.findUnique({ where: { email: 'lola@test.local' } });
    expect(db.passwordHash.startsWith('$2')).toBe(true);
  });

  test('email repetido -> 409 y contraseña débil -> 400', async () => {
    expect((await registrar()).status).toBe(409);
    expect((await registrar({ email: 'otra@test.local', password: 'corta' })).status).toBe(400);
  });

  test('un CLIENTE no accede a la gestión interna', async () => {
    for (const url of ['/api/clientes', '/api/turnos', '/api/pagos', '/api/profesionales', '/api/usuarios', '/api/servicios']) {
      expect((await request(app).get(url).set(auth(lola.token))).status).toBe(403);
    }
  });

  test('cada cliente ve solo sus turnos y no puede cancelar los ajenos', async () => {
    ana = (await registrar({ nombre: 'Ana', email: 'ana@test.local' })).body;
    const cat = await prisma.categoria.create({ data: { nombre: 'Cejas' } });
    serv = await prisma.servicio.create({ data: { categoriaId: cat.id, nombre: 'Perfilado', duracionMin: 30, precio: 8000 } });
    prof = await prisma.profesional.create({ data: { nombre: 'Vale', apellido: 'Diaz' } });
    await prisma.profesionalServicio.create({ data: { profesionalId: prof.id, servicioId: serv.id } });
    dia = 3;
    await prisma.horario.create({ data: { profesionalId: prof.id, diaSemana: dia, horaInicio: '09:00', horaFin: '18:00' } });

    const fecha = proximaFecha(dia);
    const reservaAna = await request(app).post('/api/mi/turnos').set(auth(ana.token))
      .send({ profesionalId: prof.id, servicioId: serv.id, inicio: isoLocal(fecha, '10:00') });
    expect(reservaAna.status).toBe(201);
    turnoAna = reservaAna.body;
    expect(turnoAna.clienteId).toBe(ana.usuario.clienteId); // sale del token, no del cuerpo

    expect((await request(app).get('/api/mi/turnos').set(auth(lola.token))).body.data).toHaveLength(0);
    expect((await request(app).get('/api/mi/turnos').set(auth(ana.token))).body.data).toHaveLength(1);
    expect((await request(app).patch(`/api/mi/turnos/${turnoAna.id}/cancelar`).set(auth(lola.token))).status).toBe(404);
    expect((await request(app).patch(`/api/mi/turnos/${turnoAna.id}/cancelar`).set(auth(ana.token))).body.estado).toBe('CANCELADO');
  });

  test('un PROFESIONAL gestiona solo su agenda', async () => {
    const bcrypt = require('bcrypt');
    await prisma.usuario.create({ data: { nombre: 'Vale', email: 'vale@test.local', rol: 'PROFESIONAL', profesionalId: prof.id, passwordHash: await bcrypt.hash('Segura1234', 4) } });
    const login = await request(app).post('/api/auth/login').send({ email: 'vale@test.local', password: 'Segura1234' });
    const t = login.body.token;
    const fecha = proximaFecha(dia);
    const nuevo = await request(app).post('/api/mi/turnos').set(auth(lola.token))
      .send({ profesionalId: prof.id, servicioId: serv.id, inicio: isoLocal(fecha, '11:00') });
    expect(nuevo.status).toBe(201);
    expect((await request(app).get('/api/mi/turnos').set(auth(t))).body.data.length).toBeGreaterThanOrEqual(2);
    const ok = await request(app).patch(`/api/mi/turnos/${nuevo.body.id}/estado`).set(auth(t)).send({ estado: 'CONFIRMADO' });
    expect(ok.body.estado).toBe('CONFIRMADO');
    expect((await request(app).post('/api/mi/turnos').set(auth(t)).send({})).status).toBe(403); // el profesional no reserva como cliente
  });
});
