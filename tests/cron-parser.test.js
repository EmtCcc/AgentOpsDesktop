'use strict';

import { describe, it, expect } from 'vitest';
import { parseCron, matchesCron, nextCronTime } from '../src/main/cron-parser.js';

describe('cron-parser', () => {
  describe('parseCron', () => {
    it('parses wildcard expression', () => {
      const p = parseCron('* * * * *');
      expect(p.minute.size).toBe(60);
      expect(p.hour.size).toBe(24);
      expect(p['day-of-month'].size).toBe(31);
      expect(p.month.size).toBe(12);
      expect(p['day-of-week'].size).toBe(7);
    });

    it('parses step expression */5', () => {
      const p = parseCron('*/5 * * * *');
      expect([...p.minute]).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    });

    it('parses range expression 1-5', () => {
      const p = parseCron('* 9-17 * * *');
      expect([...p.hour]).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    });

    it('parses range with step 10-30/10', () => {
      const p = parseCron('10-30/10 * * * *');
      expect([...p.minute]).toEqual([10, 20, 30]);
    });

    it('parses comma-separated values', () => {
      const p = parseCron('0 0 * * 1,3,5');
      expect([...p['day-of-week']]).toEqual([1, 3, 5]);
    });

    it('parses specific values', () => {
      const p = parseCron('30 9 1 6 *');
      expect(p.minute.has(30)).toBe(true);
      expect(p.hour.has(9)).toBe(true);
      expect(p['day-of-month'].has(1)).toBe(true);
      expect(p.month.has(6)).toBe(true);
    });

    it('parses @daily alias', () => {
      const p = parseCron('@daily');
      expect(p.minute.has(0)).toBe(true);
      expect(p.hour.has(0)).toBe(true);
      expect(p.minute.size).toBe(1);
      expect(p.hour.size).toBe(1);
    });

    it('parses @hourly alias', () => {
      const p = parseCron('@hourly');
      expect(p.minute.has(0)).toBe(true);
      expect(p.minute.size).toBe(1);
      expect(p.hour.size).toBe(24);
    });

    it('parses @weekly alias', () => {
      const p = parseCron('@weekly');
      expect(p.minute.has(0)).toBe(true);
      expect(p.hour.has(0)).toBe(true);
      expect(p['day-of-week'].has(0)).toBe(true);
    });

    it('parses @monthly alias', () => {
      const p = parseCron('@monthly');
      expect(p.minute.has(0)).toBe(true);
      expect(p.hour.has(0)).toBe(true);
      expect(p['day-of-month'].has(1)).toBe(true);
    });

    it('parses @yearly alias', () => {
      const p = parseCron('@yearly');
      expect(p.minute.has(0)).toBe(true);
      expect(p.hour.has(0)).toBe(true);
      expect(p['day-of-month'].has(1)).toBe(true);
      expect(p.month.has(1)).toBe(true);
    });

    it('throws on invalid expression (too few fields)', () => {
      expect(() => parseCron('* * *')).toThrow('5 fields');
    });

    it('throws on invalid expression (too many fields)', () => {
      expect(() => parseCron('* * * * * *')).toThrow('5 fields');
    });

    it('throws on invalid range', () => {
      expect(() => parseCron('60 * * * *')).toThrow();
    });

    it('throws on non-string input', () => {
      expect(() => parseCron(123)).toThrow('string');
    });

    it('parses mixed comma and range', () => {
      const p = parseCron('0,15,30,45 * * * *');
      expect([...p.minute]).toEqual([0, 15, 30, 45]);
    });
  });

  describe('matchesCron', () => {
    it('matches * * * * * for any time', () => {
      expect(matchesCron('* * * * *', new Date('2026-01-15T10:30:00'))).toBe(true);
    });

    it('matches specific minute', () => {
      expect(matchesCron('30 * * * *', new Date('2026-01-15T10:30:00'))).toBe(true);
      expect(matchesCron('30 * * * *', new Date('2026-01-15T10:31:00'))).toBe(false);
    });

    it('matches @daily at midnight', () => {
      expect(matchesCron('@daily', new Date('2026-01-15T00:00:00'))).toBe(true);
      expect(matchesCron('@daily', new Date('2026-01-15T00:01:00'))).toBe(false);
    });

    it('matches weekday filter', () => {
      // 2026-01-15 is a Thursday (4)
      expect(matchesCron('* * * * 4', new Date('2026-01-15T10:30:00'))).toBe(true);
      expect(matchesCron('* * * * 0', new Date('2026-01-15T10:30:00'))).toBe(false);
    });
  });

  describe('nextCronTime', () => {
    it('finds next minute for every-minute cron', () => {
      const from = new Date('2026-01-15T10:30:00');
      const next = nextCronTime('* * * * *', from);
      expect(next.getMinutes()).toBe(31);
      expect(next.getHours()).toBe(10);
    });

    it('finds next hour boundary for hourly cron', () => {
      const from = new Date('2026-01-15T10:30:00');
      const next = nextCronTime('0 * * * *', from);
      expect(next.getMinutes()).toBe(0);
      expect(next.getHours()).toBe(11);
    });

    it('finds next midnight for @daily', () => {
      const from = new Date('2026-01-15T10:30:00');
      const next = nextCronTime('@daily', from);
      expect(next.getHours()).toBe(0);
      expect(next.getMinutes()).toBe(0);
      expect(next.getDate()).toBe(16);
    });

    it('finds next specific time', () => {
      const from = new Date('2026-01-15T09:00:00');
      const next = nextCronTime('30 14 * * *', from);
      expect(next.getHours()).toBe(14);
      expect(next.getMinutes()).toBe(30);
    });

    it('wraps to next day when time has passed', () => {
      const from = new Date('2026-01-15T15:00:00');
      const next = nextCronTime('30 14 * * *', from);
      expect(next.getDate()).toBe(16);
      expect(next.getHours()).toBe(14);
      expect(next.getMinutes()).toBe(30);
    });
  });
});
