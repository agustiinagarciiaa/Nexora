const env = require('./config/env');
const prisma = require('./config/prisma');
const app = require('./app');

const server = app.listen(env.PORT, () => {
  console.log(`API escuchando en http://localhost:${env.PORT}  |  Docs: http://localhost:${env.PORT}/api/docs`);
});

const shutdown = async (signal) => {
  console.log(`${signal} recibido, cerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
