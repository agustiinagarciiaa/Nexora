const router = require('express').Router();
const prisma = require('../config/prisma');
const { authenticate, requireRole } = require('../middlewares/auth');

router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    res.json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

router.use('/auth', require('./auth.routes'));

// Todo lo que sigue exige un token válido.
router.use(authenticate);
router.use('/usuarios', requireRole('ADMIN'), require('./usuarios.routes'));
router.use('/categorias', require('./categorias.routes'));
router.use('/servicios', require('./servicios.routes'));
router.use('/profesionales', require('./profesionales.routes'));
router.use('/clientes', require('./clientes.routes'));
router.use('/disponibilidad', require('./disponibilidad.routes'));
router.use('/turnos', require('./turnos.routes'));
router.use('/pagos', require('./pagos.routes'));

module.exports = router;
