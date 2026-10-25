const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({
  path: path.resolve(process.cwd(), process.env.NODE_ENV === 'test' ? '.env.test' : '.env'),
});

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  CORS_ORIGIN: z.string().default('*'),
  TZ_OFFSET_MINUTES: z.coerce.number().int().min(-720).max(840).default(-180),
  SLOT_MINUTES: z.coerce.number().int().min(5).max(120).default(15),
  ADMIN_NOMBRE: z.string().default('Administrador'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const detalle = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Configuración de entorno inválida:\n${detalle}`);
}

const env = parsed.data;
env.isProd = env.NODE_ENV === 'production';
env.isTest = env.NODE_ENV === 'test';
env.corsOrigins = env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim());

module.exports = env;
