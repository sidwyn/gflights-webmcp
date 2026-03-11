import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const manifest = JSON.parse(readFileSync(join(__dirname, '../manifest.json'), 'utf-8'));

describe('manifest.json', () => {
  it('uses manifest v3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('has required permissions', () => {
    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('tabs');
  });

  it('has correct host permissions', () => {
    expect(manifest.host_permissions).toContain('https://www.google.com/travel/flights*');
    expect(manifest.host_permissions).toContain('https://www.google.com/travel/explore*');
  });

  it('content scripts only match Google Flights/Explore', () => {
    const matches = manifest.content_scripts[0].matches;
    for (const pattern of matches) {
      expect(pattern).toMatch(/google\.com\/travel\/(flights|explore)/);
    }
  });

  it('all content script files exist', () => {
    for (const file of manifest.content_scripts[0].js) {
      const fullPath = join(__dirname, '..', file);
      expect(existsSync(fullPath), `Missing: ${file}`).toBe(true);
    }
  });

  it('side panel path exists', () => {
    const panelPath = join(__dirname, '..', manifest.side_panel.default_path);
    expect(existsSync(panelPath)).toBe(true);
  });

  it('background service worker exists', () => {
    const bgPath = join(__dirname, '..', manifest.background.service_worker);
    expect(existsSync(bgPath)).toBe(true);
  });

  it('icon files exist', () => {
    for (const [size, path] of Object.entries(manifest.icons)) {
      const fullPath = join(__dirname, '..', path);
      expect(existsSync(fullPath), `Missing icon: ${path}`).toBe(true);
    }
  });

  it('has bridge.js before injector.js in content scripts', () => {
    const scripts = manifest.content_scripts[0].js;
    const bridgeIdx = scripts.indexOf('content/bridge.js');
    const injectorIdx = scripts.indexOf('content/injector.js');
    expect(bridgeIdx).toBeGreaterThanOrEqual(0);
    expect(injectorIdx).toBeGreaterThanOrEqual(0);
    expect(bridgeIdx).toBeLessThan(injectorIdx);
  });

  it('has helpers.js before tool files', () => {
    const scripts = manifest.content_scripts[0].js;
    const helpersIdx = scripts.indexOf('content/tools/helpers.js');
    const toolFiles = scripts.filter(s => s.includes('google-flights/'));
    for (const tool of toolFiles) {
      expect(helpersIdx, `helpers.js should come before ${tool}`).toBeLessThan(scripts.indexOf(tool));
    }
  });
});
