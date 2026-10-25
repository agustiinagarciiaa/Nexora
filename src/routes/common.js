const { z } = require('zod');
const { isValidDateStr } = require('../utils/time');

const id = z.coerce.number().int().positive();
const idParams = z.object({ id });
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato esperado HH:mm');
const fecha = z.string().refine(isValidDateStr, 'Formato esperado YYYY-MM-DD');
const texto = (max) => z.string().trim().min(1).max(max);
const textoOpc = (max) => z.string().trim().max(max).nullish();
const dinero = z.number().min(0).max(99999999.99);
const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');
const paginacion = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
const alMenosUno = (schema) =>
  schema.refine((o) => Object.keys(o).length > 0, 'Enviá al menos un campo para modificar');

module.exports = { id, idParams, hm, fecha, texto, textoOpc, dinero, boolQuery, paginacion, alMenosUno };
