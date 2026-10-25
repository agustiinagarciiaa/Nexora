// Deja la base de pruebas con el esquema actual (la crea si no existe). Borra todos sus datos.
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: '.env.test' });
const { execSync } = require('child_process');

const url = process.env.DATABASE_URL || '';
if (!/test/i.test(url)) {
  console.error('DATABASE_URL de .env.test debe apuntar a una base cuyo nombre contenga "test".');
  process.exit(1);
}
execSync('npx prisma db push --force-reset --skip-generate', { stdio: 'inherit', env: process.env });
