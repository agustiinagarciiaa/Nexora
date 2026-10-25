const { parseHM, toHM, dayOfWeek, localToUtc, toLocalParts, computeSlots, isValidDateStr } = require('../src/utils/time');

describe('utils/time', () => {
  test('parseHM / toHM', () => {
    expect(parseHM('09:30')).toBe(570);
    expect(toHM(570)).toBe('09:30');
    expect(() => parseHM('25:00')).toThrow();
  });

  test('isValidDateStr', () => {
    expect(isValidDateStr('2025-02-28')).toBe(true);
    expect(isValidDateStr('2025-02-30')).toBe(false);
    expect(isValidDateStr('10/02/2025')).toBe(false);
  });

  test('dayOfWeek (2025-06-09 es lunes)', () => {
    expect(dayOfWeek('2025-06-09')).toBe(1);
  });

  test('conversión hora local <-> UTC con offset -180', () => {
    const utc = localToUtc('2025-06-09', 10 * 60, -180);
    expect(utc.toISOString()).toBe('2025-06-09T13:00:00.000Z');
    expect(toLocalParts(utc, -180)).toEqual({ dateStr: '2025-06-09', minutes: 600, dow: 1 });
  });

  test('toLocalParts cruza de día correctamente', () => {
    const p = toLocalParts(new Date('2025-06-10T01:30:00Z'), -180); // 22:30 del día anterior
    expect(p).toEqual({ dateStr: '2025-06-09', minutes: 22 * 60 + 30, dow: 1 });
  });

  test('computeSlots respeta franjas, duración y ocupados', () => {
    const slots = computeSlots({
      blocks: [{ ini: 540, fin: 660 }], // 09:00-11:00
      busy: [{ ini: 570, fin: 630 }],   // 09:30-10:30 ocupado
      duration: 30, step: 30,
    });
    expect(slots.map(toHM)).toEqual(['09:00', '10:30']);
  });

  test('computeSlots no ofrece horarios que no entran en la franja', () => {
    const slots = computeSlots({ blocks: [{ ini: 540, fin: 600 }], busy: [], duration: 45, step: 15 });
    expect(slots.map(toHM)).toEqual(['09:00', '09:15']);
  });
});
