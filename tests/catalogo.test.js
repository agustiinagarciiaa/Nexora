const { app, request, prisma, resetDb, crearUsuario, auth } = require('./helpers');

let admin;
beforeAll(async () => { await resetDb(); admin = await crearUsuario('ADMIN', 'admin@test.local'); });
afterAll(() => prisma.$disconnect());

const post = (url, body) => request(app).post(url).set(auth(admin)).send(body);

describe('Categorías, servicios y profesionales', () => {
  let categoria; let servicio; let servicio2; let prof;

  test('crear, listar y modificar categoría', async () => {
    const c = await post('/api/categorias', { nombre: 'Masajes', orden: 11 });
    expect(c.status).toBe(201);
    categoria = c.body;
    expect((await post('/api/categorias', { nombre: 'Masajes' })).status).toBe(409);

    const lista = await request(app).get('/api/categorias').set(auth(admin));
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0]._count.servicios).toBe(0);

    const up = await request(app).patch(`/api/categorias/${categoria.id}`).set(auth(admin)).send({ descripcion: 'Relajación' });
    expect(up.body.descripcion).toBe('Relajación');
    expect((await request(app).patch(`/api/categorias/${categoria.id}`).set(auth(admin)).send({})).status).toBe(400);
  });

  test('crear servicios y validar datos', async () => {
    const s = await post('/api/servicios', { categoriaId: categoria.id, nombre: 'Masaje relajante', duracionMin: 60, precio: 18000 });
    expect(s.status).toBe(201);
    expect(s.body.precio).toBe('18000');
    servicio = s.body;
    servicio2 = (await post('/api/servicios', { categoriaId: categoria.id, nombre: 'Drenaje linfático', duracionMin: 60, precio: 22000.5 })).body;

    expect((await post('/api/servicios', { categoriaId: categoria.id, nombre: 'Malo', duracionMin: 2, precio: -1 })).status).toBe(400);
    expect((await post('/api/servicios', { categoriaId: 99999, nombre: 'Huérfano', duracionMin: 30, precio: 1 })).status).toBe(422);

    const lista = await request(app).get(`/api/servicios?categoriaId=${categoria.id}&q=masaje`).set(auth(admin));
    expect(lista.body.meta.total).toBe(1);
  });

  test('no se elimina una categoría con servicios', async () => {
    const res = await request(app).delete(`/api/categorias/${categoria.id}`).set(auth(admin));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORIA_CON_SERVICIOS');
  });

  test('cada profesional trabaja solo con los servicios asignados', async () => {
    prof = (await post('/api/profesionales', { nombre: 'Lucía', apellido: 'Gómez' })).body;
    const put = await request(app).put(`/api/profesionales/${prof.id}/servicios`).set(auth(admin))
      .send({ servicios: [{ servicioId: servicio.id, precioEspecial: 20000 }] });
    expect(put.status).toBe(200);
    expect(put.body).toHaveLength(1);

    const quienes = await request(app).get(`/api/servicios/${servicio.id}/profesionales`).set(auth(admin));
    expect(quienes.body.map((p) => p.id)).toContain(prof.id);
    const otros = await request(app).get(`/api/servicios/${servicio2.id}/profesionales`).set(auth(admin));
    expect(otros.body).toHaveLength(0);

    const filtro = await request(app).get(`/api/profesionales?servicioId=${servicio2.id}`).set(auth(admin));
    expect(filtro.body.meta.total).toBe(0);

    const inex = await request(app).put(`/api/profesionales/${prof.id}/servicios`).set(auth(admin))
      .send({ servicios: [{ servicioId: 99999 }] });
    expect(inex.status).toBe(422);
  });

  test('horarios: se reemplazan y se rechazan franjas superpuestas', async () => {
    const ok = await request(app).put(`/api/profesionales/${prof.id}/horarios`).set(auth(admin)).send({
      horarios: [
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '16:00', horaFin: '20:00' },
      ],
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveLength(2);

    const pisa = await request(app).put(`/api/profesionales/${prof.id}/horarios`).set(auth(admin)).send({
      horarios: [
        { diaSemana: 2, horaInicio: '09:00', horaFin: '12:00' },
        { diaSemana: 2, horaInicio: '11:00', horaFin: '14:00' },
      ],
    });
    expect(pisa.status).toBe(400);

    const invertido = await request(app).put(`/api/profesionales/${prof.id}/horarios`).set(auth(admin)).send({
      horarios: [{ diaSemana: 3, horaInicio: '15:00', horaFin: '10:00' }],
    });
    expect(invertido.status).toBe(400);
    // la grilla anterior quedó intacta
    const actual = await request(app).get(`/api/profesionales/${prof.id}/horarios`).set(auth(admin));
    expect(actual.body).toHaveLength(2);
  });

  test('eliminar servicio sin turnos y luego la categoría vacía', async () => {
    expect((await request(app).delete(`/api/servicios/${servicio.id}`).set(auth(admin))).status).toBe(204);
    expect((await request(app).delete(`/api/servicios/${servicio2.id}`).set(auth(admin))).status).toBe(204);
    expect((await request(app).delete(`/api/categorias/${categoria.id}`).set(auth(admin))).status).toBe(204);
  });

  test('documentación OpenAPI disponible', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(20);
  });
});
