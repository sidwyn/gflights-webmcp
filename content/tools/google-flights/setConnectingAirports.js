// content/tools/google-flights/setConnectingAirports.js

const SetConnectingAirportsTool = {
  name: 'set_connecting_airports',
  description: 'Exclude specific connecting/layover airports from flight results. Opens the Connecting airports filter and deselects the specified airports. Only available when results include connecting flights.',
  inputSchema: {
    type: 'object',
    properties: {
      exclude: {
        type: 'string',
        description: 'Comma-separated airport codes or city names to exclude (e.g. "DFW, ORD, ATL")'
      }
    },
    required: ['exclude']
  },

  execute: async (args) => {
    if (!window.location.href.includes('google.com/travel/flights')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Flights.' }] };
    }

    if (!args.exclude || !args.exclude.trim()) {
      return { content: [{ type: 'text', text: 'ERROR: No airports specified. Provide a comma-separated list of airport codes or city names to exclude (e.g. "DFW, ORD, ATL").' }] };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Close open panel with Escape
    async function closePanel() {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await WebMCPHelpers.sleep(300);
    }

    // ── Open Connecting airports filter ─────────────────────────────────────

    const btn = WebMCPHelpers.findByText('Connecting airports', 'button') ||
                WebMCPHelpers.findByAriaLabel('Connecting airports');

    if (!btn) {
      return {
        content: [{
          type: 'text',
          text: 'ERROR: "Connecting airports" filter not found. This filter only appears when search results include connecting flights. Make sure you are on a results page with non-direct flights.'
        }]
      };
    }

    WebMCPHelpers.simulateClick(btn);
    await WebMCPHelpers.sleep(500);

    // ── Parse exclude list ──────────────────────────────────────────────────

    const excludeList = args.exclude.split(',').map(a => a.trim().toUpperCase()).filter(Boolean);

    // ── Find airport option elements ────────────────────────────────────────

    const items = Array.from(document.querySelectorAll(
      '[role="listitem"], [role="option"], [role="checkbox"], label'
    )).filter(el => {
      const t = el.textContent.trim();
      return t.length > 2 && t.length < 80;
    });

    const excluded = [];
    const notFound = [];

    for (const airport of excludeList) {
      let matched = false;

      for (const item of items) {
        const text = item.textContent.trim().toUpperCase();

        // Match on airport code (3 letters) or city name within element text
        if (text.includes(airport)) {
          // Check if currently checked/included
          const checkbox = item.querySelector('input[type="checkbox"]') ||
                           (item.getAttribute('role') === 'checkbox' ? item : null);

          const isChecked = checkbox
            ? (checkbox.checked || checkbox.getAttribute('aria-checked') === 'true')
            : (item.getAttribute('aria-selected') === 'true' || item.getAttribute('aria-checked') === 'true');

          // If currently included (checked), click to exclude
          if (isChecked) {
            WebMCPHelpers.simulateClick(checkbox || item);
            await WebMCPHelpers.sleep(200);
          }

          excluded.push(airport);
          matched = true;
          break;
        }
      }

      if (!matched) {
        notFound.push(airport);
      }
    }

    // ── Close panel ─────────────────────────────────────────────────────────

    await closePanel();
    await WebMCPHelpers.sleep(800);

    // ── Build response ──────────────────────────────────────────────────────

    const lines = [];

    if (excluded.length > 0) {
      lines.push(`Excluded connecting airports: ${excluded.join(', ')}`);
    }

    if (notFound.length > 0) {
      lines.push(`WARNING: Could not find these airports in the filter: ${notFound.join(', ')}`);
    }

    if (excluded.length === 0 && notFound.length > 0) {
      lines.push('No airports were excluded. Check that the airport codes or city names match what Google Flights displays.');
    }

    lines.push('\nCall get_results to see the updated flights.');

    return {
      content: [{
        type: 'text',
        text: lines.join('\n')
      }]
    };
  }
};
