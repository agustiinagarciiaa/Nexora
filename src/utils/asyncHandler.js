// Express 4 no captura promesas rechazadas: este wrapper las envía al middleware de errores.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
