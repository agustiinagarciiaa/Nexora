const { app, request, prisma, resetDb, crearUsuario, auth } = require('./helpers');

beforeAll(resetDb);
afterAll(() => prisma.$disconnect());

describe('Autenticación y permisos', () => {
  let admin; let recep;
  beforeAll(async () => {
    admin = await crearUsuario('ADMIN', 'admin@test.local');
    recep = await crearUsuario('RECEPCION', 'recep@test.local');
  });

  test('login correcto devuelve token y usuario sin hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ADMIN@test.local', password: 'Clave12345' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario.passwordHash).toBeUndefined();
  });

  test('login con contraseña incorrecta -> 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'incorrecta1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('CREDENCIALES_INVALIDAS');
  });

  test('login con datos inválidos -> 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'no-es-mail' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });

  test('endpoints protegidos sin token -> 401', async () => {
    expect((await request(app).get('/api/clientes')).status).toBe(401);
    expect((await request(app).get('/api/clientes').set({ Authorization: 'Bearer basura' })).status).toBe(401);
  });

  test('/auth/me devuelve el usuario del token', async () => {
    const res = await request(app).get('/api/auth/me').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.local');
  });

  test('RECEPCION no puede gestionar usuarios ni crear categorías', async () => {
    expect((await request(app).get('/api/usuarios').set(auth(recep))).status).toBe(403);
    expect((await request(app).post('/api/categorias').set(auth(recep)).send({ nombre: 'X' })).status).toBe(403);
  });

  test('ADMIN crea usuario y la contraseña queda cifrada', async () => {
    const res = await request(app).post('/api/usuarios').set(auth(admin))
      .send({ nombre: 'Nueva', email: 'nueva@test.local', password: 'Segura1234', rol: 'RECEPCION' });
    expect(res.status).toBe(201);
    expect(res.body.passwordHash).toBeUndefined();
    const db = await prisma.usuario.findUnique({ where: { email: 'nueva@test.local' } });
    expect(db.passwordHash).not.toContain('Segura1234');
    expect(db.passwordHash.startsWith('$2')).toBe(true);
  });

  test('contraseña débil -> 400 y email duplicado -> 409', async () => {
    const debil = await request(app).post('/api/usuarios').set(auth(admin))
      .send({ nombre: 'X', email: 'x@test.local', password: 'corta' });
    expect(debil.status).toBe(400);
    const dup = await request(app).post('/api/usuarios').set(auth(admin))
      .send({ nombre: 'Dup', email: 'nueva@test.local', password: 'Segura1234' });
    expect(dup.status).toBe(409);
  });

  test('usuario desactivado pierde acceso aunque tenga token', async () => {
    const id = (await prisma.usuario.findUnique({ where: { email: 'recep@test.local' } })).id;
    await request(app).patch(`/api/usuarios/${id}`).set(auth(admin)).send({ activo: false });
    expect((await request(app).get('/api/auth/me').set(auth(recep))).status).toBe(401);
  });

  test('un admin no puede desactivarse a sí mismo', async () => {
    const id = (await prisma.usuario.findUnique({ where: { email: 'admin@test.local' } })).id;
    const res = await request(app).patch(`/api/usuarios/${id}`).set(auth(admin)).send({ activo: false });
    expect(res.status).toBe(422);
  });
});
