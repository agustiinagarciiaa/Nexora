const { app, request, prisma, resetDb, crearUsuario, auth } = require('./helpers');

let admin;
beforeAll(async () => { await resetDb(); admin = await crearUsuario('ADMIN', 'admin@test.local'); });
afterAll(() => prisma.$disconnect());

describe('Catálogo público (sin token, solo lectura)', () => {
  test('publica solo lo activo y no expone datos de contacto', async () => {
    const cat = await prisma.categoria.create({ data: { nombre: 'Cejas', orden: 1 } });
    const vacia = await prisma.categoria.create({ data: { nombre: 'Sin servicios', orden: 2 } });
    const oculta = await prisma.categoria.create({ data: { nombre: 'Oculta', orden: 3, activa: false } });
    const serv = await prisma.servicio.create({ data: { categoriaId: cat.id, nombre: 'Perfilado', duracionMin: 30, precio: 8000 } });
    await prisma.servicio.create({ data: { categoriaId: cat.id, nombre: 'Inactivo', duracionMin: 30, precio: 1, activo: false } });
    await prisma.servicio.create({ data: { categoriaId: oculta.id, nombre: 'No visible', duracionMin: 30, precio: 1 } });
    const activa = await prisma.profesional.create({ data: { nombre: 'Ana', apellido: 'Paz', email: 'ana@x.com', telefono: '3810000', notas: 'interno' } });
    await prisma.profesional.create({ data: { nombre: 'Baja', apellido: 'Inactiva', activo: false } });
    await prisma.profesional.create({ data: { nombre: 'Sin', apellido: 'Servicios' } });
    await prisma.profesionalServicio.create({ data: { profesionalId: activa.id, servicioId: serv.id, precioEspecial: 9500, duracionEspecialMin: 40 } });

    const cats = await request(app).get('/api/publico/categorias');
    expect(cats.status).toBe(200);
    expect(cats.body.map((c) => c.nombre)).toEqual(['Cejas']);
    expect(cats.body[0].servicios.map((s) => s.nombre)).toEqual(['Perfilado']);
    expect(vacia.id).toBeDefined();

    const profs = await request(app).get('/api/publico/profesionales');
    expect(profs.status).toBe(200);
    expect(profs.body).toHaveLength(1);
    const p = profs.body[0];
    expect(p).not.toHaveProperty('email');
    expect(p).not.toHaveProperty('telefono');
    expect(p).not.toHaveProperty('notas');
    expect(p.servicios[0]).toMatchObject({ nombre: 'Perfilado', duracionMin: 40, categoriaId: cat.id });
    expect(Number(p.servicios[0].precio)).toBe(9500);
  });

  test('es solo lectura y el resto del API sigue protegido', async () => {
    // Escribir en /publico no está habilitado: cae en la zona protegida y exige token.
    expect((await request(app).post('/api/publico/categorias').send({ nombre: 'X' })).status).toBe(401);
    expect((await request(app).get('/api/categorias')).status).toBe(401);
    expect((await request(app).get('/api/profesionales')).status).toBe(401);
    expect((await request(app).get('/api/profesionales').set(auth(admin))).status).toBe(200);
  });
});
