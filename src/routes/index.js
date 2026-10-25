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
// Catálogo público de solo lectura (portada). Va ANTES de authenticate; el resto sigue protegido.
router.use('/publico', require('./publico.routes'));

// Todo lo que sigue exige un token válido.
router.use(authenticate);

// Gestión interna: solo personal (ADMIN y RECEPCION). Clientes y profesionales usan /mi y /publico.
const personal = requireRole('ADMIN', 'RECEPCION');
router.use('/usuarios', requireRole('ADMIN'), require('./usuarios.routes'));
router.use('/categorias', personal, require('./categorias.routes'));
router.use('/servicios', personal, require('./servicios.routes'));
router.use('/profesionales', personal, require('./profesionales.routes'));
router.use('/clientes', personal, require('./clientes.routes'));
router.use('/turnos', personal, require('./turnos.routes'));
router.use('/pagos', personal, require('./pagos.routes'));
// Horarios libres: no contiene datos personales, lo usan también clientes y profesionales.
router.use('/disponibilidad', require('./disponibilidad.routes'));
// Autoservicio de CLIENTE (sus turnos) y PROFESIONAL (su agenda).
router.use('/mi', require('./mi.routes'));

module.exports = router;
