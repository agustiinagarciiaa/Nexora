// Carga categorías/servicios iniciales (idempotente) y el usuario administrador.
// Los servicios y precios son EJEMPLOS: se editan desde la API. Lo ya existente no se pisa.
const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const prisma = require('../src/config/prisma');

const CATALOGO = [
  ['Peluquería y tratamientos capilares', [['Corte de cabello', 45, 12000], ['Coloración', 120, 35000], ['Brushing', 45, 9000], ['Tratamiento capilar', 90, 30000]]],
  ['Barbería', [['Corte masculino', 30, 9000], ['Perfilado de barba', 20, 6000], ['Corte y barba', 50, 14000]]],
  ['Manicura', [['Manicura tradicional', 45, 8000], ['Manicura spa', 60, 11000]]],
  ['Uñas esculpidas, soft gel, kapping y esmaltado semipermanente', [['Esmaltado semipermanente', 60, 12000], ['Kapping gel', 90, 18000], ['Soft gel', 120, 25000], ['Uñas esculpidas', 150, 30000]]],
  ['Maquillaje social, profesional y artístico', [['Maquillaje social', 60, 20000], ['Maquillaje profesional', 75, 25000], ['Maquillaje artístico', 90, 30000]]],
  ['Peinados para eventos', [['Peinado recogido', 75, 22000], ['Peinado suelto u ondas', 60, 18000]]],
  ['Pestañas', [['Lifting de pestañas', 60, 18000], ['Extensiones de pestañas', 120, 28000]]],
  ['Cejas', [['Diseño y perfilado de cejas', 30, 8000], ['Laminado de cejas', 45, 14000]]],
  ['Limpieza facial y cuidado de la piel', [['Limpieza facial profunda', 75, 20000], ['Tratamiento facial hidratante', 60, 18000]]],
  ['Spa y bienestar', [['Ritual spa relajante', 90, 35000], ['Envoltura corporal', 60, 25000]]],
  ['Masajes', [['Masaje descontracturante', 60, 20000], ['Masaje relajante', 60, 18000], ['Drenaje linfático', 60, 22000]]],
];

async function main() {
  for (const [i, [nombre, servicios]] of CATALOGO.entries()) {
    const categoria = await prisma.categoria.upsert({
      where: { nombre }, update: {}, create: { nombre, orden: i + 1 },
    });
    for (const [sNombre, duracionMin, precio] of servicios) {
      await prisma.servicio.upsert({
        where: { categoriaId_nombre: { categoriaId: categoria.id, nombre: sNombre } },
        update: {},
        create: { categoriaId: categoria.id, nombre: sNombre, duracionMin, precio },
      });
    }
  }
  console.log(`Catálogo listo: ${CATALOGO.length} categorías.`);

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const email = env.ADMIN_EMAIL.toLowerCase();
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (!existente) {
      await prisma.usuario.create({
        data: {
          nombre: env.ADMIN_NOMBRE, email, rol: 'ADMIN',
          passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_ROUNDS),
        },
      });
      console.log(`Administrador creado: ${email}  (cambiá la contraseña después de ingresar)`);
    } else {
      console.log(`El administrador ${email} ya existe, no se modificó.`);
    }
  } else {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no se creó administrador.');
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
