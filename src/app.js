const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const openapi = require('./docs/openapi');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error');

const app = express();
app.disable('x-powered-by');

// Swagger UI usa scripts inline: se monta antes de helmet para no heredar su CSP estricta.
app.get('/api/docs.json', (req, res) => res.json(openapi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'API Nexora' }));

app.use(helmet());
app.use(cors({ origin: env.corsOrigins }));
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

