// Especificación OpenAPI 3.0 servida en /api/docs (UI) y /api/docs.json.
const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const obj = (properties, required = []) => ({ type: 'object', properties, required });
const arr = (items) => ({ type: 'array', items });
const S = { type: 'string' };
const I = { type: 'integer' };
const N = { type: 'number' };
const B = { type: 'boolean' };
const idParam = { name: 'id', in: 'path', required: true, schema: I };
const q = (name, schema = S) => ({ name, in: 'query', schema });
const paged = (name) => obj({ data: arr(ref(name)), meta: ref('Paginacion') });

const ERR = {
  400: { description: 'Datos inválidos', ...json(ref('Error')) },
  401: { description: 'No autenticado', ...json(ref('Error')) },
  403: { description: 'Sin permisos', ...json(ref('Error')) },
  404: { description: 'No encontrado', ...json(ref('Error')) },
  409: { description: 'Conflicto', ...json(ref('Error')) },
  422: { description: 'Regla de negocio incumplida', ...json(ref('Error')) },
};

const op = (tag, summary, o = {}) => ({
  tags: [tag],
  summary,
  security: o.public ? [] : [{ bearerAuth: [] }],
  parameters: [...(o.id ? [idParam] : []), ...(o.query || [])],
  ...(o.body ? { requestBody: { required: true, ...json(o.body) } } : {}),
  responses: {
    [o.status || 200]: { description: 'OK', ...(o.res ? json(o.res) : {}) },
    ...(o.errors || [400, 401, 403, 404, 409, 422]).reduce((a, c) => ({ ...a, [c]: ERR[c] }), {}),
  },
});

const crud = (tag, path, name, inputName, extraQuery = [], paginated = false, admin = false) => {
  const w = admin ? ' (ADMIN)' : '';
  return {
    [path]: {
      get: op(tag, `Listar ${tag.toLowerCase()}`, { query: extraQuery, res: paginated ? paged(name) : arr(ref(name)), errors: [400, 401] }),
      post: op(tag, `Crear${w}`, { body: ref(inputName), status: 201, res: ref(name) }),
    },
    [`${path}/{id}`]: {
      get: op(tag, 'Obtener por id', { id: true, res: ref(name) }),
      patch: op(tag, `Modificar parcialmente${w}`, { id: true, body: ref(inputName), res: ref(name) }),
      delete: op(tag, `Eliminar${w}`, { id: true, status: 204 }),
    },
  };
};

const pag = [q('page', I), q('limit', I)];

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'API Nexora',
    version: '1.0.0',
    description:
      'Backend de gestión: clientes, profesionales, servicios, horarios, turnos y pagos.\n\n' +
      '**Autenticación:** `POST /auth/login` y luego botón *Authorize* con el token (Bearer).\n\n' +
      '**Fechas:** las fechas/horas enviadas como instante deben incluir zona (`2025-06-10T15:00:00-03:00`). ' +
      'Los parámetros `fecha`, `desde`, `hasta` son fechas locales `YYYY-MM-DD`. **Dinero:** se devuelve como string decimal (ej. `"12000.00"`).\n\n' +
      '**Errores:** `{ "error": { "code", "message", "details?" } }`.',
  },
  servers: [{ url: '/api' }],
  tags: ['Auth', 'Usuarios', 'Categorias', 'Servicios', 'Profesionales', 'Clientes', 'Disponibilidad', 'Turnos', 'Pagos', 'Sistema']
    .map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: obj({ error: obj({ code: S, message: S, details: arr(obj({ campo: S, mensaje: S })) }) }),
      Paginacion: obj({ page: I, limit: I, total: I, totalPages: I }),
      Login: obj({ email: S, password: S }, ['email', 'password']),
      Usuario: obj({ id: I, nombre: S, email: S, rol: { type: 'string', enum: ['ADMIN', 'RECEPCION'] }, activo: B }),
      UsuarioInput: obj({ nombre: S, email: S, password: S, rol: { type: 'string', enum: ['ADMIN', 'RECEPCION'] }, activo: B }, ['nombre', 'email', 'password']),
      Categoria: obj({ id: I, nombre: S, descripcion: S, orden: I, activa: B }),
      CategoriaInput: obj({ nombre: S, descripcion: S, orden: I, activa: B }, ['nombre']),
      Servicio: obj({ id: I, categoriaId: I, nombre: S, descripcion: S, duracionMin: I, precio: S, activo: B }),
      ServicioInput: obj({ categoriaId: I, nombre: S, descripcion: S, duracionMin: I, precio: N, activo: B }, ['categoriaId', 'nombre', 'duracionMin', 'precio']),
      Profesional: obj({ id: I, nombre: S, apellido: S, email: S, telefono: S, notas: S, activo: B }),
      ProfesionalInput: obj({ nombre: S, apellido: S, email: S, telefono: S, notas: S, activo: B }, ['nombre', 'apellido']),
      ServiciosProfesional: obj({
        servicios: arr(obj({ servicioId: I, precioEspecial: N, duracionEspecialMin: I }, ['servicioId'])),
      }, ['servicios']),
      HorariosProfesional: obj({
        horarios: arr(obj({ diaSemana: { type: 'integer', minimum: 0, maximum: 6, description: '0=domingo ... 6=sábado' }, horaInicio: { type: 'string', example: '09:00' }, horaFin: { type: 'string', example: '13:00' } }, ['diaSemana', 'horaInicio', 'horaFin'])),
      }, ['horarios']),
      Cliente: obj({ id: I, nombre: S, apellido: S, telefono: S, email: S, documento: S, fechaNacimiento: S, notas: S, activo: B }),
      ClienteInput: obj({ nombre: S, apellido: S, telefono: S, email: S, documento: S, fechaNacimiento: { type: 'string', example: '1990-05-21' }, notas: S, activo: B }, ['nombre', 'apellido', 'telefono']),
      Turno: obj({
        id: I, clienteId: I, profesionalId: I, servicioId: I, inicio: S, fin: S, duracionMin: I, precio: S,
        estado: { type: 'string', enum: ['PENDIENTE', 'CONFIRMADO', 'COMPLETADO', 'CANCELADO', 'AUSENTE'] },
        notas: S, totalPagado: S, saldo: S, pagos: arr(ref('Pago')),
      }),
      TurnoInput: obj({ clienteId: I, profesionalId: I, servicioId: I, inicio: { type: 'string', example: '2025-06-10T15:00:00-03:00' }, notas: S }, ['clienteId', 'profesionalId', 'servicioId', 'inicio']),
      TurnoUpdate: obj({ profesionalId: I, servicioId: I, inicio: S, notas: S }),
      TurnoEstado: obj({ estado: { type: 'string', enum: ['PENDIENTE', 'CONFIRMADO', 'COMPLETADO', 'CANCELADO', 'AUSENTE'] } }, ['estado']),
      Disponibilidad: obj({ fecha: S, duracionMin: I, precio: S, horarios: arr(obj({ hora: S, inicio: S })) }),
      Pago: obj({ id: I, turnoId: I, monto: S, metodo: S, estado: { type: 'string', enum: ['REGISTRADO', 'ANULADO'] }, referencia: S, fecha: S }),
      PagoInput: obj({ turnoId: I, monto: N, metodo: { type: 'string', enum: ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'MERCADOPAGO', 'OTRO'] }, referencia: S }, ['turnoId', 'monto', 'metodo']),
    },
  },
  paths: {
    '/health': { get: op('Sistema', 'Estado del servicio y de la base de datos', { public: true, errors: [] }) },
    '/auth/login': { post: op('Auth', 'Iniciar sesión', { public: true, body: ref('Login'), res: obj({ token: S, usuario: ref('Usuario') }), errors: [400, 401] }) },
    '/auth/me': { get: op('Auth', 'Usuario autenticado', { res: ref('Usuario'), errors: [401] }) },
    '/auth/cambiar-password': { post: op('Auth', 'Cambiar mi contraseña', { body: obj({ passwordActual: S, passwordNueva: S }, ['passwordActual', 'passwordNueva']), status: 204, errors: [400, 401] }) },

    ...crud('Usuarios', '/usuarios', 'Usuario', 'UsuarioInput', [], false, true),
    ...crud('Categorias', '/categorias', 'Categoria', 'CategoriaInput', [q('activa', B)], false, true),
    ...crud('Servicios', '/servicios', 'Servicio', 'ServicioInput', [q('categoriaId', I), q('activo', B), q('q'), ...pag], true, true),
    '/servicios/{id}/profesionales': { get: op('Servicios', 'Profesionales que realizan el servicio', { id: true, res: arr(ref('Profesional')) }) },
    ...crud('Profesionales', '/profesionales', 'Profesional', 'ProfesionalInput', [q('activo', B), q('servicioId', I), q('q'), ...pag], true, true),
    '/profesionales/{id}/servicios': {
      get: op('Profesionales', 'Servicios que realiza el profesional', { id: true }),
      put: op('Profesionales', 'Reemplazar los servicios del profesional (ADMIN)', { id: true, body: ref('ServiciosProfesional') }),
    },
    '/profesionales/{id}/horarios': {
      get: op('Profesionales', 'Horarios semanales del profesional', { id: true }),
      put: op('Profesionales', 'Reemplazar la grilla semanal de horarios (ADMIN)', { id: true, body: ref('HorariosProfesional') }),
    },
    ...crud('Clientes', '/clientes', 'Cliente', 'ClienteInput', [q('q'), q('activo', B), ...pag], true),
    '/clientes/{id}/turnos': { get: op('Clientes', 'Historial de turnos del cliente', { id: true, res: arr(ref('Turno')) }) },

    '/disponibilidad': {
      get: op('Disponibilidad', 'Horarios libres de un profesional para un servicio en una fecha', {
        query: [{ ...q('profesionalId', I), required: true }, { ...q('servicioId', I), required: true }, { ...q('fecha'), required: true, description: 'YYYY-MM-DD (hora local)' }],
        res: ref('Disponibilidad'), errors: [400, 401, 422],
      }),
    },
    '/turnos': {
      get: op('Turnos', 'Listar turnos', { query: [q('desde'), q('hasta'), q('profesionalId', I), q('clienteId', I), q('servicioId', I), q('estado'), ...pag], res: paged('Turno'), errors: [400, 401] }),
      post: op('Turnos', 'Reservar un turno (valida servicio del profesional, horario y superposición)', { body: ref('TurnoInput'), status: 201, res: ref('Turno') }),
    },
    '/turnos/{id}': {
      get: op('Turnos', 'Obtener turno', { id: true, res: ref('Turno') }),
      patch: op('Turnos', 'Reprogramar o modificar notas', { id: true, body: ref('TurnoUpdate'), res: ref('Turno') }),
    },
    '/turnos/{id}/estado': { patch: op('Turnos', 'Cambiar estado', { id: true, body: ref('TurnoEstado'), res: ref('Turno') }) },

    '/pagos': {
      get: op('Pagos', 'Listar pagos', { query: [q('turnoId', I), q('metodo'), q('estado'), q('desde'), q('hasta'), ...pag], res: paged('Pago'), errors: [400, 401] }),
      post: op('Pagos', 'Registrar un pago (total o seña)', { body: ref('PagoInput'), status: 201, res: ref('Pago') }),
    },
    '/pagos/resumen': { get: op('Pagos', 'Ingresos por método de pago (ADMIN)', { query: [q('desde'), q('hasta')], errors: [400, 401, 403] }) },
    '/pagos/{id}': { get: op('Pagos', 'Obtener pago', { id: true, res: ref('Pago') }) },
    '/pagos/{id}/anular': { patch: op('Pagos', 'Anular un pago (ADMIN)', { id: true, body: obj({ motivo: S }), res: ref('Pago') }) },
  },
};

