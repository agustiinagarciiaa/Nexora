const router = require('express').Router();
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middlewares/validate');
const { id, fecha } = require('./common');
const turnos = require('../services/turnos.service');

router.get('/',
  validate({ query: z.object({ profesionalId: id, servicioId: id, fecha }) }),
  asyncHandler(async (req, res) => res.json(await turnos.disponibilidad(req.query))));

module.exports = router;
