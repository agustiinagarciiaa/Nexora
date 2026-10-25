const paginar = (page, limit) => ({ skip: (page - 1) * limit, take: limit });

const respuestaPaginada = (data, total, page, limit) => ({
  data,
  meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
});

module.exports = { paginar, respuestaPaginada };
