(() => {
  const $app = document.getElementById('app');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoy = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD en hora local
  const S = {
    token: sessionStorage.getItem('token'),
    user: JSON.parse(sessionStorage.getItem('user') || 'null'),
    fecha: hoy(),
    cat: null,      // categoría elegida en la portada
    pub: null,      // catálogo público { cats, profs }
    pre: null,      // preselección al pasar de la portada a "Nuevo turno"
    next: null,     // ruta pendiente tras iniciar sesión
    scroll: null,   // sección a la que desplazarse al volver a la portada
  };
  const money = (n) => Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
  const peso = (n) => Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const hora = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const slug = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ESTADO = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', COMPLETADO: 'Completado', CANCELADO: 'Cancelado', AUSENTE: 'Ausente' };
  const ACCIONES = {
    PENDIENTE: [['CONFIRMADO', 'Confirmar'], ['CANCELADO', 'Cancelar']],
    CONFIRMADO: [['COMPLETADO', 'Completar'], ['AUSENTE', 'Ausente'], ['CANCELADO', 'Cancelar']],
  };

  // Fotografías opcionales (ver public/img/README.md). Si el archivo no existe se ve la composición abstracta.
  // Ajustá el texto alternativo para que describa la foto real que subas.
  const FOTOS = {
    hero: { src: '/img/hero.png', alt: 'Imagen editorial de NEXORA' },
    espacio: { src: '/img/espacio.jpg', alt: 'Imagen de bienestar y cuidado personal' },
    bienestar: { src: '/img/bienestar.jpg', alt: 'Imagen de autocuidado y descanso' },
  };

  // ---------- Constructores ----------
  // Crea elementos sin innerHTML: el texto siempre se inserta como texto (sin riesgo de XSS).
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  // SOLO para las ilustraciones estáticas de abajo (nunca con datos del servidor).
  function svg(str) {
    const t = document.createElement('template');
    t.innerHTML = str.trim();
    return t.content.firstElementChild;
  }

  const ISO = '<svg class="iso" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="22" fill="none" stroke="#C8B1F5" stroke-width="1.2"/><path d="M15 35V15C15 25 33 25 33 35V15" fill="none" stroke="#7951BD" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="33" cy="9.5" r="2.3" fill="#9570DB"/></svg>';
  const IC_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  const IC_CERRAR = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const IC_BAJAR = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
  const IC_HOJA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c3-4 6-7 10-9"/></svg>';
  const IC_RELOJ = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  const IC_FLOR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20v-7M12 13c-3 0-5-2-5-5 3 0 5 2 5 5zM12 13c3 0 5-2 5-5-3 0-5 2-5 5zM12 10c-2-1-2-4 0-6 2 2 2 5 0 6z"/></svg>';

  // Composiciones abstractas (formas orgánicas en lilas) que se ven mientras no haya fotografías.
  const ARTE = {
    1: '<svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><path d="M10 520V210C10 100 90 20 200 20s190 80 190 190v310z" fill="#E5D6FF"/><circle cx="200" cy="205" r="88" fill="#F3ECFF"/><g transform="translate(200 410)"><ellipse cx="0" cy="-72" rx="30" ry="82" fill="#C8B1F5" opacity=".6" transform="rotate(-62)"/><ellipse cx="0" cy="-72" rx="30" ry="82" fill="#C8B1F5" opacity=".6" transform="rotate(62)"/><ellipse cx="0" cy="-72" rx="30" ry="82" fill="#9570DB" opacity=".55" transform="rotate(-31)"/><ellipse cx="0" cy="-72" rx="30" ry="82" fill="#9570DB" opacity=".55" transform="rotate(31)"/><ellipse cx="0" cy="-72" rx="30" ry="82" fill="#7951BD" opacity=".75"/></g><path d="M200 410v110" stroke="#7951BD" stroke-width="2.5" fill="none"/></svg>',
    2: '<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="400" height="400" fill="#F3ECFF"/><circle cx="200" cy="210" r="170" fill="#E5D6FF"/><circle cx="200" cy="210" r="112" fill="#C8B1F5" opacity=".75"/><circle cx="200" cy="210" r="56" fill="#9570DB" opacity=".6"/><path d="M40 340C130 270 270 270 360 340" stroke="#7951BD" stroke-width="2" fill="none"/></svg>',
    3: '<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="400" height="400" fill="#F3ECFF"/><circle cx="290" cy="110" r="52" fill="#FCFAFF"/><path d="M0 400V220C80 170 160 270 240 220s120-30 160 0v180z" fill="#E5D6FF"/><path d="M0 400V280C90 240 170 330 260 285s100-25 140-5v120z" fill="#C8B1F5" opacity=".75"/><path d="M0 400V340C100 310 200 380 300 345s70-15 100-5v60z" fill="#9570DB" opacity=".6"/></svg>',
  };

  // Foto opcional encima de una composición abstracta. Si la imagen no existe, queda la composición.
  function visual(foto, variante, carga) {
    const fig = h('span', { class: 'visual' }, svg(ARTE[variante]));
    if (foto) {
      const img = h('img', { src: foto.src, alt: foto.alt || '', loading: carga || 'lazy', decoding: 'async' });
      img.addEventListener('load', () => fig.classList.add('con-foto'));
      img.addEventListener('error', () => img.remove());
      fig.append(img);
    }
    return fig;
  }

  let tt;
  function toast(msg, error) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.setAttribute('role', error ? 'alert' : 'status');
    t.className = 'show' + (error ? ' err' : '');
    clearTimeout(tt);
    tt = setTimeout(() => { t.className = ''; }, 4000);
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && S.token) { logout(); }
      const e = data.error || {};
      const det = e.details && e.details[0] ? ` (${e.details[0].campo}: ${e.details[0].mensaje})` : '';
      throw new Error((e.message || 'Error inesperado') + det);
    }
    return data;
  }

  function logout() {
    sessionStorage.clear();
    S.token = null; S.user = null;
    if (location.hash.startsWith('#/panel') || location.hash.startsWith('#/cuenta')) go('#/'); else render();
  }

  // ---------- Rutas (#/ portada · #/ingresar · #/panel/<vista>) ----------
  const ruta = () => (location.hash.startsWith('#/') ? location.hash.slice(2) : '');
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  window.addEventListener('hashchange', () => { if (location.hash === '' || location.hash.startsWith('#/')) render(); });

  function irA(id) {
    if (ruta() !== '') { S.scroll = id; go('#/'); return; }
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  const rol = () => (S.user ? S.user.rol : null);
  const inicioRol = () => (rol() === 'CLIENTE' ? '#/cuenta/turnos' : '#/panel/agenda');
  function guardarSesion(r) {
    S.token = r.token; S.user = r.usuario;
    sessionStorage.setItem('token', r.token);
    sessionStorage.setItem('user', JSON.stringify(r.usuario));
  }
  // "Reservar" desde la portada: sin sesión lleva a crear cuenta; con sesión, al flujo que corresponde al rol.
  function reservar(pre) {
    if (rol() === 'PROFESIONAL') { toast('Las reservas las realizan las clientas o el personal.'); return; }
    S.pre = pre;
    if (!S.token) { S.next = '#/cuenta/reservar'; go('#/registro'); return; }
    go(rol() === 'CLIENTE' ? '#/cuenta/reservar' : '#/panel/nuevo');
  }
  // Catálogo público (se carga una sola vez).
  async function catalogo() {
    if (!S.pub) {
      const [cats, profs] = await Promise.all([api('/publico/categorias'), api('/publico/profesionales')]);
      S.pub = { cats, profs };
    }
    return S.pub;
  }

  // ---------- Encabezado ----------
  function logo() {
    return h('a', { class: 'logo', href: '#/', 'aria-label': 'NEXORA, ir al inicio' }, svg(ISO), h('span', { class: 'marca' }, 'NEXORA'));
  }
  function cabecera(modo) {
    let nav = null; let acciones;
    if (modo === 'publico') {
      nav = h('nav', { class: 'nav', 'aria-label': 'Principal' },
        [['categorias', 'Servicios'], ['profesionales', 'Profesionales'], ['bienestar', 'Bienestar']].map(([id, l]) =>
          h('button', { type: 'button', class: 'navlink', onclick: () => irA(id) }, l)));
      acciones = S.token
        ? [
          h('a', { class: 'btn', href: inicioRol() }, rol() === 'CLIENTE' ? 'Mis turnos' : 'Mi panel'),
          rol() === 'PROFESIONAL' ? null : h('a', { class: 'btn primary', href: rol() === 'CLIENTE' ? '#/cuenta/reservar' : '#/panel/nuevo' }, 'Reservar turno'),
        ]
        : [h('a', { class: 'btn', href: '#/ingresar' }, 'Iniciar sesión'), h('a', { class: 'btn primary', href: '#/registro' }, 'Crear cuenta')];
    } else if (modo === 'panel' || modo === 'cuenta') {
      const base = modo === 'cuenta' ? 'cuenta' : 'panel';
      const tabs = modo === 'cuenta' ? [['turnos', 'Mis turnos'], ['reservar', 'Reservar']]
        : rol() === 'PROFESIONAL' ? [['agenda', 'Mi agenda']] : [['agenda', 'Agenda'], ['nuevo', 'Nuevo turno'], ['clientes', 'Clientes']];
      nav = h('nav', { class: 'tabs', 'aria-label': 'Cuenta' },
        tabs.map(([k, l]) => h('a', { class: 'tab', href: `#/${base}/${k}`, 'aria-current': ruta() === `${base}/${k}` ? 'page' : null }, l)));
      acciones = [
        h('span', { class: 'who' }, S.user ? S.user.nombre : ''),
        h('a', { class: 'btn sm', href: '#/' }, 'Ver sitio'),
        h('button', { class: 'sm', type: 'button', onclick: logout }, 'Salir'),
      ];
    } else {
      acciones = [h('a', { class: 'btn', href: '#/' }, 'Volver al inicio')];
    }
    const menu = h('div', { class: 'menu', id: 'menu-principal' }, nav, h('div', { class: 'acciones' }, acciones));
    const btn = h('button', { class: 'menu-btn', id: 'menu-btn', type: 'button', 'aria-label': 'Abrir menú', 'aria-expanded': 'false', 'aria-controls': 'menu-principal' }, svg(IC_MENU));
    const cerrar = () => {
      menu.classList.remove('abierto');
      btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Abrir menú');
      btn.replaceChildren(svg(IC_MENU));
    };
    btn.addEventListener('click', () => {
      const abierto = menu.classList.toggle('abierto');
      btn.setAttribute('aria-expanded', String(abierto));
      btn.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
      btn.replaceChildren(svg(abierto ? IC_CERRAR : IC_MENU));
    });
    menu.addEventListener('click', (e) => { if (e.target.closest('a,button')) cerrar(); });
    return h('header', { class: 'cabecera' }, h('div', { class: 'cabecera-in' }, logo(), menu, btn));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = document.getElementById('menu-principal');
    const b = document.getElementById('menu-btn');
    if (m && b && m.classList.contains('abierto')) { m.classList.remove('abierto'); b.setAttribute('aria-expanded', 'false'); b.focus(); }
  });

  function pie() {
    return h('footer', { class: 'pie-sitio' }, h('div', { class: 'pie-in' },
      logo(), h('p', {}, 'Belleza y bienestar, en un solo lugar.'), h('p', {}, '© NEXORA')));
  }

  // ---------- Portada ----------
  function hero() {
    return h('section', { class: 'hero', 'aria-labelledby': 'hero-t' },
      h('div', { class: 'hero-card' },
        h('h1', { id: 'hero-t', class: 'sr-only' }, 'NEXORA. Tu belleza, tu momento, tu esencia.'),
        h('div', { class: 'hero-word', 'aria-hidden': 'true' }, 'NEXORA'),
        h('div', { class: 'hero-art' }, visual(FOTOS.hero, 1, 'eager')),
        h('p', { class: 'hero-aux' }, 'Belleza y bienestar, en un solo lugar'),
        h('button', { class: 'hero-flecha', type: 'button', 'aria-label': 'Ir a los servicios', onclick: () => irA('categorias') }, svg(IC_BAJAR)),
        h('p', { class: 'hero-frase' }, 'Tu belleza,', h('br'), 'tu momento,', h('br'), h('em', {}, 'tu esencia.')),
        h('div', { class: 'hero-cta' },
          h('p', {}, 'Descubrí servicios de belleza, cuidado y bienestar, y encontrá a las profesionales que los realizan.'),
          h('div', { class: 'botones' },
            h('button', { class: 'btn primary lg', type: 'button', onclick: () => irA('categorias') }, 'Descubrir servicios'),
            h('button', { class: 'btn lg', type: 'button', onclick: () => irA('profesionales') }, 'Encontrar profesionales')))));
  }

  function bienvenida() {
    return h('section', { class: 'seccion espacio', 'aria-labelledby': 'esp-t' },
      h('div', { class: 'espacio-arte' },
        visual(FOTOS.espacio, 3),
        h('div', { class: 'sello' }, visual(null, 2))),
      h('div', { class: 'texto' },
        h('p', { class: 'etiqueta' }, 'Bienvenida'),
        h('h2', { class: 'titulo', id: 'esp-t' }, 'Un espacio ', h('em', {}, 'para vos.')),
        h('p', { class: 'lead' }, 'Descubrí nuevas formas de cuidarte, encontrá profesionales de confianza y disfrutá de una experiencia de belleza pensada para vos.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => irA('categorias') }, 'Ver servicios')));
  }

  function bienestar() {
    const gesto = (ic, t, d) => h('li', {}, h('span', { class: 'ic' }, svg(ic)), h('div', {}, h('b', {}, t), h('span', {}, d)));
    return h('section', { id: 'bienestar', class: 'bienestar', 'aria-labelledby': 'bien-t' },
      h('div', { class: 'seccion bienestar-in' },
        visual(FOTOS.bienestar, 2),
        h('div', {},
          h('p', { class: 'etiqueta' }, 'Bienestar'),
          h('h2', { class: 'titulo', id: 'bien-t' }, 'Cuidarte también es parte de ', h('em', {}, 'tu esencia.')),
          h('ul', { class: 'gestos' },
            gesto(IC_RELOJ, 'Tomate tu tiempo', 'Un momento sin apuro, solo para vos.'),
            gesto(IC_HOJA, 'Rutinas a tu medida', 'Elegí lo que te hace bien y cuidalo a tu ritmo.'),
            gesto(IC_FLOR, 'Belleza que se siente', 'Cuidado personal que empieza por estar a gusto con una misma.')),
          h('p', { class: 'aviso' }, 'Los servicios de estética no reemplazan la consulta ni el tratamiento de profesionales de la salud, y los resultados pueden variar en cada persona.'))));
  }

  function vistaInicio() {
    const gridCats = h('div', { class: 'cat-grid' }, h('p', { class: 'vacio' }, 'Cargando servicios…'));
    const detalle = h('div', { class: 'detalle', hidden: true, 'aria-live': 'polite' });
    const filtro = h('div', { class: 'filtro', hidden: true });
    const gridProfs = h('div', { class: 'prof-grid' }, h('p', { class: 'vacio' }, 'Cargando profesionales…'));

    const secCats = h('section', { id: 'categorias', class: 'seccion', 'aria-labelledby': 'cat-t' },
      h('div', { class: 'cab-seccion' },
        h('div', {}, h('p', { class: 'etiqueta' }, 'Servicios'), h('h2', { class: 'titulo', id: 'cat-t' }, 'Elegí cómo ', h('em', {}, 'cuidarte.'))),
        h('p', { class: 'lead' }, 'Tocá una categoría para ver sus servicios, duración y precios.')),
      gridCats, detalle);
    const secProfs = h('section', { id: 'profesionales', class: 'seccion', 'aria-labelledby': 'prof-t' },
      h('div', { class: 'cab-seccion' },
        h('div', {}, h('p', { class: 'etiqueta' }, 'Profesionales'), h('h2', { class: 'titulo', id: 'prof-t' }, 'Encontrá tu ', h('em', {}, 'próximo favorito.')))),
      filtro, gridProfs);

    const marcar = () => gridCats.querySelectorAll('.cat').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.id) === S.cat)));

    function pintarDetalle() {
      const c = S.cat && S.pub.cats.find((x) => x.id === S.cat);
      detalle.hidden = !c;
      if (!c) { detalle.replaceChildren(); return; }
      detalle.replaceChildren(
        h('h3', {}, c.nombre),
        c.descripcion ? h('p', { class: 'lead' }, c.descripcion) : null,
        h('ul', { class: 'servicios' }, c.servicios.map((s) => h('li', { class: 'servicio' },
          h('span', { class: 'n' }, s.nombre),
          h('span', { class: 't' }, `${s.duracionMin} min`),
          h('span', { class: 'p' }, peso(s.precio)),
          h('button', { class: 'btn primary sm', type: 'button', 'aria-label': `Reservar ${s.nombre}`, onclick: () => reservar({ servicioId: s.id }) }, 'Reservar'),
          s.descripcion ? h('span', { class: 'd' }, s.descripcion) : null))));
    }

    function pintarProfs() {
      const { cats, profs } = S.pub;
      const nombres = new Map(cats.map((c) => [c.id, c.nombre]));
      const lista = S.cat ? profs.filter((p) => p.servicios.some((s) => s.categoriaId === S.cat)) : profs;
      filtro.hidden = !S.cat;
      filtro.replaceChildren(...(S.cat ? [
        h('span', {}, `Profesionales de ${nombres.get(S.cat)}`),
        h('button', { class: 'sm', type: 'button', onclick: () => elegir(S.cat) }, 'Ver todas')] : []));
      if (!lista.length) {
        gridProfs.replaceChildren(h('p', { class: 'vacio' }, profs.length ? 'Por ahora ninguna profesional realiza esta categoría.' : 'Todavía no hay profesionales publicadas. Volvé pronto.'));
        return;
      }
      gridProfs.replaceChildren(...lista.map((p, i) => {
        const rel = S.cat ? p.servicios.filter((s) => s.categoriaId === S.cat) : p.servicios;
        const desde = Math.min(...rel.map((s) => Number(s.precio)));
        const espec = [...new Set(p.servicios.map((s) => nombres.get(s.categoriaId)).filter(Boolean))];
        const nom = `${p.nombre} ${p.apellido}`;
        return h('article', { class: 'prof' },
          h('div', { class: 'retrato' }, visual(null, (i % 3) + 1), h('span', { class: 'ini', 'aria-hidden': 'true' }, (p.nombre[0] + p.apellido[0]).toUpperCase())),
          h('div', { class: 'cuerpo' },
            h('h3', {}, nom),
            h('ul', { class: 'pills', 'aria-label': 'Especialidades' },
              espec.slice(0, 3).map((e) => h('li', {}, e)),
              espec.length > 3 ? h('li', {}, `+${espec.length - 3}`) : null),
            h('div', { class: 'pie' },
              h('span', { class: 'desde' }, 'Desde', h('b', {}, peso(desde))),
              h('button', { class: 'btn primary sm', type: 'button', 'aria-label': `Reservar con ${nom}`, onclick: () => reservar({ profesionalId: p.id, servicioId: rel[0].id }) }, 'Reservar'))));
      }));
    }

    function elegir(id) {
      S.cat = S.cat === id ? null : id;
      marcar(); pintarDetalle(); pintarProfs();
      if (S.cat) detalle.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    }

    function pintar() {
      const { cats } = S.pub;
      if (S.cat && !cats.some((c) => c.id === S.cat)) S.cat = null;
      gridCats.replaceChildren(...(cats.length ? cats.map((c, i) => h('button', {
        type: 'button', class: 'cat', 'data-id': c.id, 'aria-pressed': 'false', onclick: () => elegir(c.id),
      }, visual({ src: `/img/categorias/${slug(c.nombre)}.jpg`, alt: '' }, (i % 3) + 1),
      h('span', { class: 'nom' }, c.nombre),
      h('span', { class: 'cant' }, `${c.servicios.length} ${c.servicios.length === 1 ? 'servicio' : 'servicios'}`)))
        : [h('p', { class: 'vacio' }, 'Todavía no hay servicios publicados. Volvé pronto.')]));
      marcar(); pintarDetalle(); pintarProfs();
    }

    async function cargar() {
      try {
        await catalogo();
        pintar();
      } catch (e) {
        const reintentar = h('button', { class: 'sm', type: 'button', onclick: () => { S.pub = null; cargar(); } }, 'Reintentar');
        gridCats.replaceChildren(h('div', { class: 'vacio' }, h('p', {}, 'No pudimos cargar los servicios. ' + e.message), reintentar));
        gridProfs.replaceChildren();
      }
    }

    $app.replaceChildren(cabecera('publico'),
      h('main', { id: 'contenido' }, hero(), bienvenida(), secCats, secProfs, bienestar()), pie());
    cargar();
    if (S.scroll) { const id = S.scroll; S.scroll = null; setTimeout(() => irA(id), 0); } else window.scrollTo(0, 0);
  }

  // ---------- Ingreso del equipo ----------
  function vistaLogin() {
    const email = h('input', { type: 'email', required: true, autocomplete: 'username', id: 'l-email' });
    const pass = h('input', { type: 'password', required: true, autocomplete: 'current-password', id: 'l-pass' });
    const err = h('p', { class: 'error', role: 'alert', hidden: true });
    const form = h('form', { class: 'card stack' },
      h('h1', {}, 'Iniciar sesión'),
      h('p', { class: 'muted' }, 'Ingresá a tu cuenta de NEXORA.'),
      h('label', { for: 'l-email' }, 'Email', email),
      h('label', { for: 'l-pass' }, 'Contraseña', pass),
      err,
      h('button', { class: 'btn primary lg', type: 'submit' }, 'Ingresar'),
      h('p', { class: 'muted' }, '¿No tenés cuenta? ', h('a', { href: '#/registro' }, 'Crear cuenta')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      try {
        const r = await api('/auth/login', { method: 'POST', body: { email: email.value, password: pass.value } });
        guardarSesion(r);
        const d = S.next || inicioRol(); S.next = null;
        go(d);
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
    $app.replaceChildren(cabecera('simple'), h('main', { id: 'contenido', class: 'ingreso' }, form));
    email.focus();
  }

  // ---------- Registro de clientes ----------
  function vistaRegistro() {
    const f = {
      nombre: h('input', { id: 'r-nombre', required: true, autocomplete: 'given-name', maxlength: 100 }),
      apellido: h('input', { id: 'r-apellido', required: true, autocomplete: 'family-name', maxlength: 100 }),
      telefono: h('input', { id: 'r-tel', type: 'tel', required: true, autocomplete: 'tel', maxlength: 30 }),
      email: h('input', { id: 'r-email', type: 'email', required: true, autocomplete: 'email', maxlength: 190 }),
      pass: h('input', { id: 'r-pass', type: 'password', required: true, autocomplete: 'new-password', minlength: 8, maxlength: 72, 'aria-describedby': 'r-ayuda' }),
    };
    const err = h('p', { class: 'error', role: 'alert', hidden: true });
    const form = h('form', { class: 'card stack' },
      h('h1', {}, 'Crear cuenta'),
      h('p', { class: 'muted' }, 'Registrate para reservar y seguir tus turnos en NEXORA.'),
      h('div', { class: 'row2' },
        h('label', { for: 'r-nombre' }, 'Nombre', f.nombre), h('label', { for: 'r-apellido' }, 'Apellido', f.apellido)),
      h('label', { for: 'r-tel' }, 'Teléfono', f.telefono),
      h('label', { for: 'r-email' }, 'Email', f.email),
      h('label', { for: 'r-pass' }, 'Contraseña', f.pass, h('small', { id: 'r-ayuda', class: 'muted' }, 'Mínimo 8 caracteres, con al menos una letra y un número.')),
      err,
      h('button', { class: 'btn primary lg', type: 'submit' }, 'Crear cuenta'),
      h('p', { class: 'muted peque' }, 'Usamos tus datos solo para gestionar tus turnos.'),
      h('p', { class: 'muted' }, '¿Ya tenés cuenta? ', h('a', { href: '#/ingresar' }, 'Iniciar sesión')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      try {
        const r = await api('/auth/registro', { method: 'POST', body: {
          nombre: f.nombre.value.trim(), apellido: f.apellido.value.trim(), telefono: f.telefono.value.trim(),
          email: f.email.value.trim(), password: f.pass.value,
        } });
        guardarSesion(r);
        toast('¡Cuenta creada! Ya podés reservar.');
        const d = S.next || '#/cuenta/turnos'; S.next = null;
        go(d);
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
    $app.replaceChildren(cabecera('simple'), h('main', { id: 'contenido', class: 'ingreso' }, form));
    f.nombre.focus();
  }

  // ---------- Cuenta del cliente ----------
  const fechaLarga = (iso) => new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

  async function vistaMisTurnos(main) {
    const lista = h('div', { class: 'stack' });
    const cancelar = (t) => modal('Cancelar turno', [h('p', {}, `¿Querés cancelar ${t.servicio.nombre} del ${fechaLarga(t.inicio)} a las ${hora(t.inicio)}?`)], 'Sí, cancelar', async () => {
      await api(`/mi/turnos/${t.id}/cancelar`, { method: 'PATCH' });
      toast('Turno cancelado');
      cargar();
    });
    const tarjeta = (t, activo) => h('article', { class: 'card turno ' + t.estado.toLowerCase() },
      h('div', { class: 'hora' }, hora(t.inicio), h('small', {}, fechaLarga(t.inicio))),
      h('div', { class: 'info' },
        h('strong', {}, t.servicio.nombre),
        h('span', { class: 'muted' }, `con ${t.profesional.nombre} ${t.profesional.apellido}`),
        h('span', { class: 'muted' }, `${money(t.precio)} · ${t.duracionMin} min`)),
      h('div', { class: 'side' }, h('span', { class: 'badge ' + t.estado.toLowerCase() }, ESTADO[t.estado]),
        activo ? h('button', { class: 'ghost sm', type: 'button', onclick: () => cancelar(t) }, 'Cancelar') : null));
    const cargar = async () => {
      try {
        const { data } = await api('/mi/turnos?limit=100');
        const ahora = Date.now();
        const proximos = data.filter((t) => ['PENDIENTE', 'CONFIRMADO'].includes(t.estado) && new Date(t.inicio) > ahora).reverse();
        const previos = data.filter((t) => !proximos.includes(t));
        lista.replaceChildren(
          ...(data.length ? [] : [h('div', { class: 'vacio' }, h('p', {}, 'Todavía no tenés turnos.'), h('button', { class: 'btn primary', type: 'button', onclick: () => go('#/cuenta/reservar') }, 'Reservar mi primer turno'))]),
          proximos.length ? h('h2', { class: 'sub' }, 'Próximos') : null, ...proximos.map((t) => tarjeta(t, true)),
          previos.length ? h('h2', { class: 'sub' }, 'Historial') : null, ...previos.map((t) => tarjeta(t, false)));
      } catch (e) { toast(e.message, true); }
    };
    main.append(lista);
    cargar();
  }

  async function vistaReservar(main) {
    const pre = S.pre; S.pre = null;
    const servicio = h('select', { required: true }, h('option', { value: '' }, 'Elegí un servicio'));
    const prof = h('select', { required: true, disabled: true }, h('option', { value: '' }, 'Elegí primero el servicio'));
    const fecha = h('input', { type: 'date', value: hoy(), min: hoy(), required: true });
    const notas = h('input', { placeholder: 'Notas (opcional)', maxlength: 500 });
    const slots = h('div', { class: 'slots', role: 'group', 'aria-labelledby': 'lbl-hor' }, h('span', { class: 'muted' }, 'Elegí servicio, profesional y fecha.'));
    const resumen = h('p', { class: 'resumen', 'aria-live': 'polite' });
    const ok = h('button', { class: 'btn primary lg', disabled: true }, 'Confirmar reserva');
    let inicio = ''; let pub;

    const profActual = () => pub.profs.find((p) => p.id === Number(prof.value));
    const servActual = () => { const p = profActual(); return p && p.servicios.find((s) => s.id === Number(servicio.value)); };
    const pintarResumen = () => {
      const s = servActual();
      resumen.textContent = s ? `${peso(s.precio)} · ${s.duracionMin} min. Podés cancelar el turno desde "Mis turnos".` : '';
    };
    const cargarSlots = async () => {
      inicio = ''; ok.disabled = true; pintarResumen();
      if (!prof.value || !servicio.value || !fecha.value) return;
      try {
        const d = await api(`/disponibilidad?profesionalId=${prof.value}&servicioId=${servicio.value}&fecha=${fecha.value}`);
        slots.replaceChildren(...(d.horarios.length ? d.horarios.map((x) => h('button', {
          type: 'button', 'aria-pressed': 'false',
          onclick: (ev) => {
            slots.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
            ev.currentTarget.setAttribute('aria-pressed', 'true'); inicio = x.inicio; ok.disabled = false;
          },
        }, x.hora)) : [h('span', { class: 'muted' }, 'No hay horarios libres ese día.')]));
      } catch (e) { slots.replaceChildren(h('span', { class: 'muted' }, e.message)); }
    };
    const cargarProfs = (preProf) => {
      const ps = pub.profs.filter((p) => p.servicios.some((s) => s.id === Number(servicio.value)));
      prof.replaceChildren(h('option', { value: '' }, ps.length ? 'Elegí una profesional' : 'Ninguna profesional realiza este servicio'),
        ...ps.map((p) => h('option', { value: p.id }, `${p.nombre} ${p.apellido}`)));
      prof.disabled = !ps.length;
      if (preProf && ps.some((p) => p.id === preProf)) prof.value = String(preProf);
      cargarSlots();
    };
    fecha.addEventListener('change', cargarSlots);
    prof.addEventListener('change', cargarSlots);
    servicio.addEventListener('change', () => cargarProfs());

    const form = h('form', { class: 'card stack' },
      h('label', {}, 'Servicio', servicio), h('label', {}, 'Profesional', prof), h('label', {}, 'Fecha', fecha),
      h('div', { class: 'stack' }, h('span', { class: 'lbl', id: 'lbl-hor' }, 'Horario'), slots),
      h('label', {}, 'Notas', notas), resumen, ok);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/mi/turnos', { method: 'POST', body: { profesionalId: Number(prof.value), servicioId: Number(servicio.value), inicio, ...(notas.value.trim() ? { notas: notas.value.trim() } : {}) } });
        toast('¡Turno reservado!');
        go('#/cuenta/turnos');
      } catch (err) { toast(err.message, true); cargarSlots(); }
    });
    main.append(form);
    try {
      pub = await catalogo();
      pub.cats.forEach((c) => servicio.append(h('optgroup', { label: c.nombre }, c.servicios.map((s) => h('option', { value: s.id }, s.nombre)))));
      if (pre && pre.servicioId) { servicio.value = String(pre.servicioId); cargarProfs(pre.profesionalId); }
    } catch (e) { toast(e.message, true); }
  }

  function vistaCuenta(vista) {
    const vistas = { turnos: ['Mis turnos', vistaMisTurnos], reservar: ['Reservar turno', vistaReservar] };
    const [titulo, fn] = vistas[vista] || vistas.turnos;
    const main = h('main', { id: 'contenido', class: 'panel' }, h('h1', {}, titulo));
    $app.replaceChildren(cabecera('cuenta'), main);
    window.scrollTo(0, 0);
    fn(main);
  }

  // ---------- Panel: modal y campos ----------
  function modal(titulo, campos, okText, onOk) {
    const dlg = h('dialog', { 'aria-label': titulo });
    const form = h('form', { method: 'dialog', class: 'stack' },
      h('h3', {}, titulo), campos,
      h('div', { class: 'row end' },
        h('button', { type: 'button', class: 'ghost', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { class: 'primary', type: 'submit' }, okText)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await onOk(); dlg.close(); } catch (err) { toast(err.message, true); }
    });
    dlg.append(form);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  }
  const campo = (label, input) => h('label', {}, label, input);

  // ---------- Agenda ----------
  function cobrar(t, hecho) {
    const monto = h('input', { type: 'number', step: '0.01', min: '0.01', max: t.saldo, value: t.saldo, required: true });
    const metodo = h('select', {}, ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'MERCADOPAGO', 'OTRO'].map((m) => h('option', { value: m }, m)));
    modal(`Cobrar · saldo ${money(t.saldo)}`, [campo('Monto', monto), campo('Medio de pago', metodo)], 'Registrar pago', async () => {
      await api('/pagos', { method: 'POST', body: { turnoId: t.id, monto: Number(monto.value), metodo: metodo.value } });
      toast('Pago registrado');
      hecho();
    });
  }

  async function vistaAgenda(main, propia) {
    // propia = true: agenda del PROFESIONAL logueado (/mi/turnos); false: agenda general del personal.
    const fecha = h('input', { type: 'date', value: S.fecha, 'aria-label': 'Fecha' });
    const prof = h('select', { 'aria-label': 'Profesional' }, h('option', { value: '' }, 'Todas las profesionales'));
    const lista = h('div', { class: 'stack' });

    const tarjeta = (t) => {
      const acc = (ACCIONES[t.estado] || []).map(([e, l]) => h('button', {
        class: 'ghost sm',
        onclick: async () => {
          try { await api(`${propia ? '/mi' : ''}/turnos/${t.id}/estado`, { method: 'PATCH', body: { estado: e } }); toast('Turno ' + ESTADO[e].toLowerCase()); cargar(); }
          catch (err) { toast(err.message, true); }
        },
      }, l));
      if (!propia && t.estado !== 'CANCELADO' && Number(t.saldo) > 0) acc.push(h('button', { class: 'primary sm', onclick: () => cobrar(t, cargar) }, 'Cobrar'));
      return h('article', { class: 'card turno ' + t.estado.toLowerCase() },
        h('div', { class: 'hora' }, hora(t.inicio), h('small', {}, 'hasta ' + hora(t.fin))),
        h('div', { class: 'info' },
          h('strong', {}, `${t.cliente.nombre} ${t.cliente.apellido}`),
          h('span', {}, t.servicio.nombre),
          h('span', { class: 'muted' }, propia ? `Tel. ${t.cliente.telefono}` : `con ${t.profesional.nombre} ${t.profesional.apellido}`),
          propia ? null : h('span', { class: 'muted' }, `${money(t.precio)} · pagado ${money(t.totalPagado)} · saldo ${money(t.saldo)}`)),
        h('div', { class: 'side' }, h('span', { class: 'badge ' + t.estado.toLowerCase() }, ESTADO[t.estado]), h('div', { class: 'acts' }, acc)));
    };

    const cargar = async () => {
      S.fecha = fecha.value;
      try {
        const { data } = await api(`${propia ? '/mi' : ''}/turnos?desde=${S.fecha}&hasta=${S.fecha}&limit=100` + (!propia && prof.value ? `&profesionalId=${prof.value}` : ''));
        lista.replaceChildren(...(data.length ? data.map(tarjeta) : [h('p', { class: 'empty' }, 'No hay turnos para este día.')]));
      } catch (e) { toast(e.message, true); }
    };
    const mover = (d) => {
      const x = new Date(fecha.value + 'T12:00:00');
      x.setDate(x.getDate() + d);
      fecha.value = x.toLocaleDateString('sv-SE');
      cargar();
    };
    fecha.addEventListener('change', cargar);
    prof.addEventListener('change', cargar);
    main.append(
      h('div', { class: 'bar' },
        h('button', { 'aria-label': 'Día anterior', onclick: () => mover(-1) }, '‹'), fecha, h('button', { 'aria-label': 'Día siguiente', onclick: () => mover(1) }, '›'),
        h('button', { onclick: () => { fecha.value = hoy(); cargar(); } }, 'Hoy'), propia ? null : prof),
      lista);
    if (!propia) try {
      const { data } = await api('/profesionales?activo=true&limit=100');
      data.forEach((p) => prof.append(h('option', { value: p.id }, `${p.nombre} ${p.apellido}`)));
    } catch (e) { toast(e.message, true); }
    cargar();
  }

  // ---------- Nuevo turno ----------
  async function vistaNuevo(main) {
    const pre = S.pre; S.pre = null;
    const buscar = h('input', { type: 'search', placeholder: 'Buscar cliente por nombre o teléfono…', 'aria-label': 'Buscar cliente' });
    const cliente = h('select', { required: true, 'aria-label': 'Cliente' });
    const servicio = h('select', { required: true }, h('option', { value: '' }, 'Elegí un servicio'));
    const prof = h('select', { required: true, disabled: true }, h('option', { value: '' }, 'Elegí primero el servicio'));
    const fecha = h('input', { type: 'date', value: hoy(), min: hoy(), required: true });
    const notas = h('input', { placeholder: 'Notas (opcional)' });
    const slots = h('div', { class: 'slots', role: 'group', 'aria-labelledby': 'lbl-hor' }, h('span', { class: 'muted' }, 'Elegí servicio, profesional y fecha.'));
    const ok = h('button', { class: 'primary', disabled: true }, 'Reservar turno');
    let inicio = '';

    const cargarClientes = async () => {
      try {
        const { data } = await api('/clientes?activo=true&limit=100&q=' + encodeURIComponent(buscar.value));
        cliente.replaceChildren(h('option', { value: '' }, data.length ? 'Elegí un cliente' : 'Sin resultados'),
          ...data.map((c) => h('option', { value: c.id }, `${c.apellido}, ${c.nombre} · ${c.telefono}`)));
      } catch (e) { toast(e.message, true); }
    };
    const cargarSlots = async () => {
      inicio = ''; ok.disabled = true;
      if (!prof.value || !servicio.value || !fecha.value) return;
      try {
        const d = await api(`/disponibilidad?profesionalId=${prof.value}&servicioId=${servicio.value}&fecha=${fecha.value}`);
        slots.replaceChildren(...(d.horarios.length ? d.horarios.map((s) => h('button', {
          type: 'button', 'aria-pressed': 'false',
          onclick: (ev) => {
            slots.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
            ev.currentTarget.setAttribute('aria-pressed', 'true'); inicio = s.inicio; ok.disabled = false;
          },
        }, s.hora)) : [h('span', { class: 'muted' }, 'No hay horarios libres ese día.')]));
      } catch (e) { slots.replaceChildren(h('span', { class: 'muted' }, e.message)); }
    };
    const cargarProfs = async (preProf) => {
      prof.replaceChildren(h('option', { value: '' }, 'Elegí una profesional'));
      prof.disabled = true; cargarSlots();
      if (!servicio.value) return;
      try {
        const ps = await api(`/servicios/${servicio.value}/profesionales`);
        ps.forEach((p) => prof.append(h('option', { value: p.id }, `${p.nombre} ${p.apellido}`)));
        prof.disabled = false;
        if (!ps.length) prof.firstChild.textContent = 'Ninguna profesional realiza este servicio';
        if (preProf && ps.some((p) => p.id === preProf)) { prof.value = String(preProf); cargarSlots(); }
      } catch (e) { toast(e.message, true); }
    };

    let deb;
    buscar.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(cargarClientes, 300); });
    fecha.addEventListener('change', cargarSlots);
    prof.addEventListener('change', cargarSlots);
    servicio.addEventListener('change', () => cargarProfs());

    const form = h('form', { class: 'card stack' },
      campo('Cliente', [buscar, cliente]), campo('Servicio', servicio), campo('Profesional', prof),
      campo('Fecha', fecha), h('div', { class: 'stack' }, h('span', { class: 'lbl', id: 'lbl-hor' }, 'Horario'), slots), campo('Notas', notas), ok);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/turnos', { method: 'POST', body: { clienteId: Number(cliente.value), profesionalId: Number(prof.value), servicioId: Number(servicio.value), inicio, ...(notas.value.trim() ? { notas: notas.value.trim() } : {}) } });
        toast('Turno reservado');
        S.fecha = fecha.value; go('#/panel/agenda');
      } catch (err) { toast(err.message, true); cargarSlots(); }
    });
    main.append(form);
    cargarClientes();
    try {
      const { data } = await api('/servicios?activo=true&limit=100');
      const grupos = {};
      data.forEach((s) => { (grupos[s.categoria.nombre] ||= []).push(s); });
      Object.entries(grupos).forEach(([cat, ss]) => servicio.append(h('optgroup', { label: cat },
        ss.map((s) => h('option', { value: s.id }, `${s.nombre} · ${s.duracionMin} min · ${money(s.precio)}`)))));
      if (pre && pre.servicioId) { servicio.value = String(pre.servicioId); await cargarProfs(pre.profesionalId); }
    } catch (e) { toast(e.message, true); }
  }

  // ---------- Clientes ----------
  async function vistaClientes(main) {
    const buscar = h('input', { type: 'search', placeholder: 'Buscar por nombre, teléfono o documento…', 'aria-label': 'Buscar clientes' });
    const lista = h('div', { class: 'stack' });
    const cargar = async () => {
      try {
        const { data } = await api('/clientes?limit=100&q=' + encodeURIComponent(buscar.value));
        lista.replaceChildren(...(data.length ? data.map((c) => h('article', { class: 'card info' },
          h('strong', {}, `${c.apellido}, ${c.nombre}`),
          h('span', { class: 'muted' }, [c.telefono, c.email].filter(Boolean).join(' · ')))) : [h('p', { class: 'empty' }, 'Sin resultados.')]));
      } catch (e) { toast(e.message, true); }
    };
    const nuevo = () => {
      const f = { nombre: h('input', { required: true }), apellido: h('input', { required: true }), telefono: h('input', { required: true }), email: h('input', { type: 'email' }) };
      modal('Nuevo cliente', [campo('Nombre', f.nombre), campo('Apellido', f.apellido), campo('Teléfono', f.telefono), campo('Email (opcional)', f.email)], 'Guardar', async () => {
        await api('/clientes', { method: 'POST', body: { nombre: f.nombre.value.trim(), apellido: f.apellido.value.trim(), telefono: f.telefono.value.trim(), ...(f.email.value.trim() ? { email: f.email.value.trim() } : {}) } });
        toast('Cliente creado');
        cargar();
      });
    };
    let deb;
    buscar.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(cargar, 300); });
    main.append(h('div', { class: 'bar' }, buscar, h('button', { class: 'primary', onclick: nuevo }, 'Nuevo cliente')), lista);
    cargar();
  }

  function vistaPanel(vista) {
    const vistas = rol() === 'PROFESIONAL'
      ? { agenda: ['Mi agenda', (m) => vistaAgenda(m, true)] }
      : { agenda: ['Agenda', vistaAgenda], nuevo: ['Nuevo turno', vistaNuevo], clientes: ['Clientes', vistaClientes] };
    const [titulo, fn] = vistas[vista] || vistas.agenda;
    const main = h('main', { id: 'contenido', class: 'panel' }, h('h1', {}, titulo));
    $app.replaceChildren(cabecera('panel'), main);
    window.scrollTo(0, 0);
    fn(main);
  }

  // ---------- Estructura general ----------
  function render() {
    const r = ruta();
    if (r.startsWith('panel')) {
      if (!S.token) { S.next = '#/' + r; go('#/ingresar'); return; }
      if (rol() === 'CLIENTE') { go('#/cuenta/turnos'); return; }
      vistaPanel(r.split('/')[1] || 'agenda');
    } else if (r.startsWith('cuenta')) {
      if (!S.token) { S.next = '#/' + r; go('#/ingresar'); return; }
      if (rol() !== 'CLIENTE') { go('#/panel/agenda'); return; }
      vistaCuenta(r.split('/')[1] || 'turnos');
    } else if (r === 'ingresar' || r === 'registro') {
      if (S.token) { go(inicioRol()); return; }
      if (r === 'registro') vistaRegistro(); else vistaLogin();
    } else {
      vistaInicio();
    }
  }

  render();
})();
