// validate({ params, query, body }) -> reemplaza req.* por los datos ya validados y tipados.
exports.validate = (schemas) => (req, res, next) => {
  try {
    for (const key of ['params', 'query', 'body']) {
      if (schemas[key]) req[key] = schemas[key].parse(req[key]);
    }
    next();
  } catch (err) {
    next(err);
  }
};
