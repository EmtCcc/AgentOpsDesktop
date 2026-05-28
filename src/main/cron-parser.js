'use strict';

/**
 * Lightweight 5-field cron expression parser (zero dependencies).
 *
 * Fields: minute(0-59) hour(0-23) day-of-month(1-31) month(1-12) day-of-week(0-6)
 *
 * Supports: *  star/n  a-b  a-b/c  a,b,c
 * Aliases:  @yearly @monthly @weekly @daily @hourly
 */

const ALIASES = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

const FIELD_RANGES = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day-of-month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'day-of-week', min: 0, max: 6 },
];

/**
 * Parse a single cron field (e.g. "* /5", "1,3,5", "10-20/2") into a Set of allowed values.
 */
function parseField(field, min, max) {
  const values = new Set();

  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    let range = stepMatch ? stepMatch[1] : part;
    const step = stepMatch ? parseInt(stepMatch[2], 10) : null;

    let start, end;
    if (range === '*') {
      start = min;
      end = max;
    } else if (range.includes('-')) {
      const [a, b] = range.split('-').map(Number);
      if (a < min || b > max || a > b) {
        throw new Error(`Invalid range ${range} (expected ${min}-${max})`);
      }
      start = a;
      end = b;
    } else {
      const n = Number(range);
      if (!Number.isInteger(n) || n < min || n > max) {
        throw new Error(`Invalid value ${range} (expected ${min}-${max})`);
      }
      if (step) {
        start = n;
        end = max;
      } else {
        values.add(n);
        continue;
      }
    }

    if (step) {
      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else {
      for (let i = start; i <= end; i++) {
        values.add(i);
      }
    }
  }

  return values;
}

/**
 * Parse a 5-field cron expression.
 *
 * @param {string} expr — cron expression (or alias like "@daily")
 * @returns {{ fields: string[], minute: Set<number>, hour: Set<number>, dayOfMonth: Set<number>, month: Set<number>, dayOfWeek: Set<number> }}
 */
function parseCron(expr) {
  if (typeof expr !== 'string') throw new Error('Cron expression must be a string');

  const normalized = expr.trim().toLowerCase();
  const resolved = ALIASES[normalized] || normalized;
  const fields = resolved.split(/\s+/);

  if (fields.length !== 5) {
    throw new Error(`Cron expression must have 5 fields, got ${fields.length}: "${expr}"`);
  }

  const parsed = { fields };
  for (let i = 0; i < 5; i++) {
    const { name, min, max } = FIELD_RANGES[i];
    try {
      parsed[name] = parseField(fields[i], min, max);
    } catch (err) {
      throw new Error(`Invalid ${name} field "${fields[i]}": ${err.message}`);
    }
  }

  return parsed;
}

/**
 * Check if a Date matches a cron expression.
 *
 * @param {string} expr — cron expression
 * @param {Date} date — time to check
 * @returns {boolean}
 */
function matchesCron(expr, date) {
  const p = parseCron(expr);
  return (
    p.minute.has(date.getMinutes()) &&
    p.hour.has(date.getHours()) &&
    p['day-of-month'].has(date.getDate()) &&
    p.month.has(date.getMonth() + 1) &&
    p['day-of-week'].has(date.getDay())
  );
}

/**
 * Find the next time a cron expression will match, starting from `from`.
 *
 * @param {string} expr — cron expression
 * @param {Date} [from] — start searching from this time (default: now)
 * @returns {Date}
 */
function nextCronTime(expr, from = new Date()) {
  const p = parseCron(expr);

  // Start from the next whole minute
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Brute-force search, max 2 years of minutes (~1M iterations worst case for rare schedules)
  const maxIterations = 366 * 24 * 60;

  for (let i = 0; i < maxIterations; i++) {
    if (
      p.minute.has(candidate.getMinutes()) &&
      p.hour.has(candidate.getHours()) &&
      p['day-of-month'].has(candidate.getDate()) &&
      p.month.has(candidate.getMonth() + 1) &&
      p['day-of-week'].has(candidate.getDay())
    ) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error(`Could not find next match for "${expr}" within 2 years`);
}

module.exports = { parseCron, matchesCron, nextCronTime };
