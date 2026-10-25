// Utilidades de fecha/hora sin dependencias externas.
// En la base todo se guarda en UTC. Los horarios de atención ("HH:mm") están en hora local del
// negocio, que se define con TZ_OFFSET_MINUTES (Argentina = -180, sin horario de verano).

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseHM = (s) => {
  const m = HM.exec(s);
  if (!m) throw new Error(`Hora inválida: ${s}`);
  return Number(m[1]) * 60 + Number(m[2]);
};

const toHM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const isValidDateStr = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

// 0 = domingo ... 6 = sábado
const dayOfWeek = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

// Fecha local "YYYY-MM-DD" + minutos desde medianoche local -> instante UTC
const localToUtc = (dateStr, minutes, offsetMin) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + (minutes - offsetMin) * 60000);
};

// Instante UTC -> componentes en hora local
const toLocalParts = (date, offsetMin) => {
  const l = new Date(date.getTime() + offsetMin * 60000);
  return {
    dateStr: l.toISOString().slice(0, 10),
    minutes: l.getUTCHours() * 60 + l.getUTCMinutes(),
    dow: l.getUTCDay(),
  };
};

const floorToMinute = (date) => new Date(Math.floor(date.getTime() / 60000) * 60000);

/**
 * Calcula inicios posibles dentro de franjas de atención.
 * blocks: [{ini, fin}] minutos locales | busy: [{ini, fin}] ocupados | duration y step en minutos.
 */
const computeSlots = ({ blocks, busy, duration, step }) => {
  const out = new Set();
  for (const b of blocks) {
    for (let s = b.ini; s + duration <= b.fin; s += step) {
      const e = s + duration;
      if (!busy.some((x) => s < x.fin && e > x.ini)) out.add(s);
    }
  }
  return [...out].sort((a, b) => a - b);
};

module.exports = {
  parseHM, toHM, isValidDateStr, dayOfWeek, localToUtc, toLocalParts, floorToMinute, computeSlots,
};
