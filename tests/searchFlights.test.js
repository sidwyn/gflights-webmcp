import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';
import { loadTool } from './helpers/loadSource.js';

// Mock browser globals
globalThis.window = { location: { href: 'https://www.google.com/travel/flights' } };
globalThis.setTimeout = vi.fn();

const SearchFlightsTool = loadTool(
  join(__dirname, '../content/tools/google-flights/searchFlights.js'),
  'SearchFlightsTool'
);

describe('SearchFlightsTool', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('schema', () => {
    it('has correct name', () => {
      expect(SearchFlightsTool.name).toBe('search_flights');
    });

    it('requires origin and departureDate', () => {
      expect(SearchFlightsTool.inputSchema.required).toEqual(['origin', 'departureDate']);
    });

    it('defines cabinClass enum', () => {
      expect(SearchFlightsTool.inputSchema.properties.cabinClass.enum).toEqual([
        'economy', 'premium', 'business', 'first'
      ]);
    });
  });

  describe('validation', () => {
    it('rejects missing origin', async () => {
      const result = await SearchFlightsTool.execute({ departureDate: '2026-04-15' });
      expect(result.content[0].text).toContain('ERROR');
    });

    it('rejects missing departureDate', async () => {
      const result = await SearchFlightsTool.execute({ origin: 'SFO' });
      expect(result.content[0].text).toContain('ERROR');
    });

    it('rejects invalid IATA origin', async () => {
      const result = await SearchFlightsTool.execute({ origin: 'San Francisco', departureDate: '2026-04-15' });
      expect(result.content[0].text).toContain('ERROR');
      expect(result.content[0].text).toContain('IATA');
    });

    it('rejects invalid IATA destination', async () => {
      const result = await SearchFlightsTool.execute({ origin: 'SFO', destination: 'New York', departureDate: '2026-04-15' });
      expect(result.content[0].text).toContain('ERROR');
    });

    it('accepts "anywhere" as destination', async () => {
      const result = await SearchFlightsTool.execute({ origin: 'SFO', destination: 'anywhere', departureDate: '2026-04-15' });
      expect(result.content[0].text).not.toContain('ERROR');
      expect(result.content[0].text).toContain('anywhere');
    });

    it('rejects invalid date format', async () => {
      const result = await SearchFlightsTool.execute({ origin: 'SFO', destination: 'JFK', departureDate: '04-15-2026' });
      expect(result.content[0].text).toContain('ERROR');
      expect(result.content[0].text).toContain('YYYY-MM-DD');
    });

    it('rejects dates more than 11 months out', async () => {
      const farDate = new Date();
      farDate.setMonth(farDate.getMonth() + 12);
      const dateStr = farDate.toISOString().split('T')[0];
      const result = await SearchFlightsTool.execute({ origin: 'SFO', destination: 'JFK', departureDate: dateStr });
      expect(result.content[0].text).toContain('ERROR');
      expect(result.content[0].text).toContain('11 months');
    });
  });

  describe('successful execution', () => {
    it('returns navigation message for valid round trip', async () => {
      const result = await SearchFlightsTool.execute({
        origin: 'SFO', destination: 'JFK', departureDate: '2026-04-15', returnDate: '2026-04-20'
      });
      const text = result.content[0].text;
      expect(text).toContain('round trip');
      expect(text).toContain('SFO');
      expect(text).toContain('JFK');
    });

    it('returns one-way for no return date', async () => {
      const result = await SearchFlightsTool.execute({
        origin: 'SFO', destination: 'JFK', departureDate: '2026-04-15'
      });
      expect(result.content[0].text).toContain('one way');
    });

    it('includes cabin class when not economy', async () => {
      const result = await SearchFlightsTool.execute({
        origin: 'SFO', destination: 'JFK', departureDate: '2026-04-15', cabinClass: 'business'
      });
      expect(result.content[0].text).toContain('business');
    });

    it('includes adult count when more than 1', async () => {
      const result = await SearchFlightsTool.execute({
        origin: 'SFO', destination: 'JFK', departureDate: '2026-04-15', adults: 3
      });
      expect(result.content[0].text).toContain('3 adults');
    });

    it('uppercases IATA codes', async () => {
      const result = await SearchFlightsTool.execute({
        origin: 'sfo', destination: 'jfk', departureDate: '2026-04-15'
      });
      expect(result.content[0].text).toContain('SFO');
      expect(result.content[0].text).toContain('JFK');
    });

    it('schedules navigation via setTimeout', async () => {
      await SearchFlightsTool.execute({
        origin: 'SFO', destination: 'JFK', departureDate: '2026-04-15'
      });
      expect(globalThis.setTimeout).toHaveBeenCalled();
    });
  });
});
