import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';
import { loadTool } from './helpers/loadSource.js';

globalThis.window = { location: { href: 'https://www.google.com/travel/flights' } };
globalThis.setTimeout = vi.fn();

const SearchMultiCityTool = loadTool(
  join(__dirname, '../content/tools/google-flights/searchMultiCity.js'),
  'SearchMultiCityTool'
);

describe('SearchMultiCityTool', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('schema', () => {
    it('has correct name', () => {
      expect(SearchMultiCityTool.name).toBe('search_multi_city');
    });

    it('requires legs', () => {
      expect(SearchMultiCityTool.inputSchema.required).toEqual(['legs']);
    });
  });

  describe('validation', () => {
    it('rejects missing legs', async () => {
      const result = await SearchMultiCityTool.execute({});
      expect(result.content[0].text).toContain('ERROR');
    });

    it('rejects less than 2 legs', async () => {
      const result = await SearchMultiCityTool.execute({
        legs: [{ origin: 'SFO', destination: 'JFK', date: '2026-04-15' }]
      });
      expect(result.content[0].text).toContain('ERROR');
    });

    it('rejects more than 5 legs', async () => {
      const legs = Array(6).fill({ origin: 'SFO', destination: 'JFK', date: '2026-04-15' });
      const result = await SearchMultiCityTool.execute({ legs });
      expect(result.content[0].text).toContain('ERROR');
    });

    it('rejects leg with missing origin', async () => {
      const result = await SearchMultiCityTool.execute({
        legs: [
          { origin: 'SFO', destination: 'JFK', date: '2026-04-15' },
          { destination: 'LHR', date: '2026-04-20' }
        ]
      });
      expect(result.content[0].text).toContain('ERROR');
      expect(result.content[0].text).toContain('Leg 2');
    });

    it('rejects invalid IATA code', async () => {
      const result = await SearchMultiCityTool.execute({
        legs: [
          { origin: 'SFO', destination: 'JFK', date: '2026-04-15' },
          { origin: 'New York', destination: 'LHR', date: '2026-04-20' }
        ]
      });
      expect(result.content[0].text).toContain('ERROR');
      expect(result.content[0].text).toContain('IATA');
    });

    it('rejects invalid date format', async () => {
      const result = await SearchMultiCityTool.execute({
        legs: [
          { origin: 'SFO', destination: 'JFK', date: '2026-04-15' },
          { origin: 'JFK', destination: 'LHR', date: 'April 20' }
        ]
      });
      expect(result.content[0].text).toContain('ERROR');
      expect(result.content[0].text).toContain('YYYY-MM-DD');
    });
  });

  describe('successful execution', () => {
    it('returns multi-city navigation message', async () => {
      const result = await SearchMultiCityTool.execute({
        legs: [
          { origin: 'SFO', destination: 'JFK', date: '2026-04-15' },
          { origin: 'JFK', destination: 'LHR', date: '2026-04-20' },
          { origin: 'LHR', destination: 'SFO', date: '2026-04-25' }
        ]
      });
      const text = result.content[0].text;
      expect(text).toContain('multi-city');
      expect(text).toContain('SFO');
      expect(text).toContain('JFK');
      expect(text).toContain('LHR');
    });

    it('includes cabin class when specified', async () => {
      const result = await SearchMultiCityTool.execute({
        legs: [
          { origin: 'SFO', destination: 'JFK', date: '2026-04-15' },
          { origin: 'JFK', destination: 'SFO', date: '2026-04-20' }
        ],
        cabinClass: 'business'
      });
      expect(result.content[0].text).toContain('business');
    });
  });
});
