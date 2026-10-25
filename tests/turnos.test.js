const { app, request, prisma, resetDb, crearUsuario, auth, proximaFecha, isoLocal } = require('./helpers');

let admin; let cat; let serv; let servOtro; let prof; let cliente; let fecha;

beforeAll(async () => {
  await resetDb();
  admin = await crearUsuario('ADMIN', 'admin@test.local');
  const p = (url, body) => request(app).post(url).set(auth(admin)).send(body);

  cat = (await p('/api/categorias', { nombre: 'Manicura' })).body;
  serv = (await p('/api/servicios', { categoriaId: cat.id, nombre: 'Manicura spa', duracionMin: 60, precio: 10000 })).body;
  servOtro = (await p('/api/servicios', { categoriaId: cat.id, nombre: 'Soft gel', duracionMin: 90, precio: 25000 })).body;
  prof = (await p('/api/profesionales', { nombre: 'Ana', apellido: 'Pérez' })).body;
  cliente = (await p('/api/clientes', { nombre: 'María', apellido: 'López', telefono: '3811234567' })).body;

  await request(app).put(`/api/profesionales/${prof.id}/servicios`).set(auth(admin)).send({ servicios: [{ servicioId: serv.id }] });
  await request(app).put(`/api/profesionales/${prof.id}/horarios`).set(auth(admin))
    .send({ horarios: [{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }] });
  fecha = proximaFecha(1); // un lunes futuro
});
afterAll(() => prisma.$disconnect());

const reservar = (extra = {}) => request(app).post('/api/turnos').set(auth(admin))
  .send({ clienteId: cliente.id, profesionalId: prof.id, servicioId: serv.id, inicio: isoLocal(fecha, '10:00'), ...extra });

describe('Disponibilidad y turnos', () => {
  let turno;

  test('disponibilidad: ofrece horarios dentro del turno de trabajo', async () => {
    const res = await request(app).get(`/api/disponibilidad?profesionalId=${prof.id}&servicioId=${serv.id}&fecha=${fecha}`).set(auth(admin));
    expect(res.status).toBe(200);
    const horas = res.body.horarios.map((h) => h.hora);
    expect(horas[0]).toBe('09:00');
    expect(horas).toContain('10:00');
    expect(horas).toContain('12:00');   // 12:00-13:00 entra justo
    expect(horas).not.toContain('12:15'); // se pasaría del cierre
  });

  test('disponibilidad: profesional que no hace el servicio -> 422', async () => {
    const res = await request(app).get(`/api/disponibilidad?profesionalId=${prof.id}&servicioId=${servOtro.id}&fecha=${fecha}`).set(auth(admin));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PROFESIONAL_SIN_SERVICIO');
  });

  test('reservar turno correctamente calcula fin, precio y saldo', async () => {
    const res = await reservar();
    expect(res.status).toBe(201);
    turno = res.body;
    expect(turno.estado).toBe('PENDIENTE');
    expect(new Date(turno.fin) - new Date(turno.inicio)).toBe(60 * 60000);
    expect(turno.precio).toBe('10000');
    expect(turno.saldo).toBe('10000.00');
  });

  test('no permite superponer turnos del mismo profesional', async () => {
    const res = await reservar({ inicio: isoLocal(fecha, '10:30') });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TURNO_SUPERPUESTO');
    const justo = await reservar({ inicio: isoLocal(fecha, '11:00') }); // pegado al anterior: permitido
    expect(justo.status).toBe(201);
  });

  test('el horario ocupado desaparece de la disponibilidad', async () => {
    const res = await request(app).get(`/api/disponibilidad?profesionalId=${prof.id}&servicioId=${serv.id}&fecha=${fecha}`).set(auth(admin));
    const horas = res.body.horarios.map((h) => h.hora);
    expect(horas).not.toContain('10:00');
    expect(horas).not.toContain('10:45');
    expect(horas).toContain('09:00');
  });

  test('rechaza servicio que el profesional no realiza', async () => {
    const res = await reservar({ servicioId: servOtro.id, inicio: isoLocal(fecha, '09:00') });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PROFESIONAL_SIN_SERVICIO');
  });

  test('rechaza turnos fuera del horario de atención y en el pasado', async () => {
    const tarde = await reservar({ inicio: isoLocal(fecha, '12:30') }); // terminaría 13:30
    expect(tarde.status).toBe(422);
    expect(tarde.body.error.code).toBe('FUERA_DE_HORARIO');
    const martes = await reservar({ inicio: isoLocal(proximaFecha(2), '10:00') });
    expect(martes.body.error.code).toBe('FUERA_DE_HORARIO');
    const pasado = await reservar({ inicio: '2020-01-06T10:00:00-03:00' });
    expect(pasado.body.error.code).toBe('TURNO_EN_EL_PASADO');
  });

  test('inicio sin zona horaria -> 400', async () => {
    expect((await reservar({ inicio: '2030-01-07T10:00:00' })).status).toBe(400);
  });

  test('dos reservas simultáneas del mismo horario: solo una prospera', async () => {
    // usamos el lunes siguiente para no chocar con los turnos anteriores
    const otroLunes = new Date(Date.parse(`${fecha}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
    const rs = await Promise.all([
      reservar({ inicio: isoLocal(otroLunes, '09:00') }),
      reservar({ inicio: isoLocal(otroLunes, '09:00') }),
    ]);
    const codigos = rs.map((r) => r.status).sort();
    expect(codigos.filter((c) => c === 201)).toHaveLength(1);
    expect(codigos.filter((c) => c === 409)).toHaveLength(1);
  });

  test('pagos: parcial, exceso, anulación y saldo', async () => {
    const p1 = await request(app).post('/api/pagos').set(auth(admin)).send({ turnoId: turno.id, monto: 4000, metodo: 'EFECTIVO' });
    expect(p1.status).toBe(201);

    const exceso = await request(app).post('/api/pagos').set(auth(admin)).send({ turnoId: turno.id, monto: 7000, metodo: 'TRANSFERENCIA' });
    expect(exceso.status).toBe(422);
    expect(exceso.body.error.code).toBe('PAGO_EXCEDE_SALDO');

    const resto = await request(app).post('/api/pagos').set(auth(admin)).send({ turnoId: turno.id, monto: 6000, metodo: 'TRANSFERENCIA', referencia: 'OP-123' });
    expect(resto.status).toBe(201);

    let t = await request(app).get(`/api/turnos/${turno.id}`).set(auth(admin));
    expect(t.body.totalPagado).toBe('10000.00');
    expect(t.body.saldo).toBe('0.00');

    const resumen = await request(app).get('/api/pagos/resumen').set(auth(admin));
    expect(resumen.body.total).toBe('10000.00');

    const anul = await request(app).patch(`/api/pagos/${resto.body.id}/anular`).set(auth(admin)).send({ motivo: 'Error de carga' });
    expect(anul.body.estado).toBe('ANULADO');
    t = await request(app).get(`/api/turnos/${turno.id}`).set(auth(admin));
    expect(t.body.saldo).toBe('6000.00');
    expect((await request(app).patch(`/api/pagos/${resto.body.id}/anular`).set(auth(admin)).send({})).status).toBe(422);
  });

  test('estados: transiciones válidas e inválidas; cancelar libera el horario', async () => {
    const ok = await request(app).patch(`/api/turnos/${turno.id}/estado`).set(auth(admin)).send({ estado: 'CONFIRMADO' });
    expect(ok.body.estado).toBe('CONFIRMADO');

    const cancel = await request(app).patch(`/api/turnos/${turno.id}/estado`).set(auth(admin)).send({ estado: 'CANCELADO' });
    expect(cancel.body.estado).toBe('CANCELADO');

    const invalida = await request(app).patch(`/api/turnos/${turno.id}/estado`).set(auth(admin)).send({ estado: 'CONFIRMADO' });
    expect(invalida.status).toBe(422);
    expect(invalida.body.error.code).toBe('TRANSICION_INVALIDA');

    const pagoCancelado = await request(app).post('/api/pagos').set(auth(admin)).send({ turnoId: turno.id, monto: 100, metodo: 'EFECTIVO' });
    expect(pagoCancelado.status).toBe(422);

    expect((await reservar({ inicio: isoLocal(fecha, '10:00') })).status).toBe(201); // el horario quedó libre
  });

  test('reprogramar un turno vigente', async () => {
    const nuevo = (await reservar({ inicio: isoLocal(fecha, '09:00') })).body;
    const res = await request(app).patch(`/api/turnos/${nuevo.id}`).set(auth(admin)).send({ inicio: isoLocal(fecha, '12:00') });
    expect(res.status).toBe(200);
    expect(res.body.inicio).toBe(new Date(isoLocal(fecha, '12:00')).toISOString());
    const choque = await request(app).patch(`/api/turnos/${nuevo.id}`).set(auth(admin)).send({ inicio: isoLocal(fecha, '10:00') });
    expect(choque.status).toBe(409);
  });

  test('no se elimina un cliente con turnos; se puede desactivar', async () => {
    const del = await request(app).delete(`/api/clientes/${cliente.id}`).set(auth(admin));
    expect(del.status).toBe(409);
    const off = await request(app).patch(`/api/clientes/${cliente.id}`).set(auth(admin)).send({ activo: false });
    expect(off.body.activo).toBe(false);
    expect((await reservar({ inicio: isoLocal(fecha, '09:00') })).body.error.code).toBe('CLIENTE_INACTIVO');
  });
});
