// content/tools/google-flights/exploreDestinations.js

const ExploreDestinationsTool = {
  name: 'explore_destinations',
  description: 'Find cheap flight destinations from an origin airport. Navigates to the Google Flights Explore map which shows the cheapest destinations. If already on the Explore page, reads the destination list. Call once to navigate, then call again to read results.',
  inputSchema: {
    type: 'object',
    properties: {
      origin: {
        type: 'string',
        description: 'Departure airport IATA code (e.g., "SFO", "JFK"). If provided, navigates to the Explore page with this origin. Omit to read results from the current Explore page.'
      },
      maxResults: {
        type: 'integer',
        description: 'Maximum number of destinations to return. Defaults to 10.'
      }
    }
  },

  execute: async (args) => {
    const { origin, maxResults = 10 } = args;
    const currentUrl = window.location.href;
    const isOnExplorePage = currentUrl.includes('/travel/explore');

    // If origin is provided OR we're not on the explore page, navigate there
    if (origin || !isOnExplorePage) {
      if (origin) {
        const iataPattern = /^[A-Z]{3}$/i;
        if (!iataPattern.test(origin)) {
          return { content: [{ type: 'text', text: 'ERROR: origin must be a 3-letter IATA airport code (e.g., SFO, JFK, LHR).' }] };
        }
      }

      const originCode = origin ? origin.toUpperCase() : null;
      let url;
      if (originCode) {
        url = `https://www.google.com/travel/explore?tfs=CBwQAxoJEgcIARID${originCode}GgkSBwgBEgN${originCode}iBggBEAEYAg&tfu=GgA`;
      } else {
        url = 'https://www.google.com/travel/explore';
      }

      // Navigate AFTER returning — the page unload destroys the content script context,
      // so we must send the response before location change happens.
      setTimeout(() => { window.location.href = url; }, 50);

      const originMsg = originCode ? `from ${originCode}` : 'from your default location';
      return {
        content: [{
          type: 'text',
          text: `Navigating to Explore destinations ${originMsg}. Wait for the page to load, then call explore_destinations again without origin to read results.`
        }]
      };
    }

    // Already on the explore page — read destination results
    await WebMCPHelpers.sleep(2000);

    // Poll for destination cards to appear (up to 15 seconds)
    const startTime = Date.now();
    let destinations = [];

    while (Date.now() - startTime < 15000) {
      destinations = parseExploreDestinations();
      if (destinations.length > 0) break;
      await WebMCPHelpers.sleep(1000);
    }

    if (destinations.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No destinations found on the Explore page. The page may still be loading, or no destinations are available. Try waiting a moment and calling explore_destinations again without origin.'
        }]
      };
    }

    const limited = destinations.slice(0, maxResults);

    const summary = limited.map((d, i) => {
      let line = `${i + 1}. ${d.name}`;
      if (d.price) line += ` \u2014 ${d.price} round trip`;
      if (d.stops || d.duration) {
        const parts = [d.stops, d.duration].filter(Boolean);
        line += ` (${parts.join(', ')})`;
      }
      if (d.dates) line += ` \u2014 ${d.dates}`;
      return line;
    }).join('\n');

    return {
      content: [{
        type: 'text',
        text: `Found ${limited.length} destination(s):\n\n${summary}`
      }]
    };
  }
};

/**
 * Parse destination cards from the Google Flights Explore page sidebar.
 * The explore page shows a scrollable list of destination cards, each containing
 * a city/region name, price, travel dates, and flight details.
 */
function parseExploreDestinations() {
  const results = [];

  // Strategy 1: Find destination links that point to flight search pages
  // The explore sidebar cards typically link to /travel/flights searches
  const links = Array.from(document.querySelectorAll('a[href*="/travel/flights"]'));

  for (const link of links) {
    const text = link.textContent;
    if (!text || text.length < 5) continue;

    // Must contain a price pattern to be a destination card
    const priceMatch = text.match(/\$[\d,]+/);
    if (!priceMatch) continue;

    const dest = extractDestinationInfo(link, text, priceMatch[0]);
    if (dest && dest.name) {
      results.push(dest);
    }
  }

  // Strategy 2: If no links found, look for container elements with destination info
  if (results.length === 0) {
    const allElements = Array.from(document.querySelectorAll('[data-ved], [jsaction]'));
    const seen = new Set();

    for (const el of allElements) {
      const text = el.textContent;
      if (!text || text.length < 10 || text.length > 500) continue;

      const priceMatch = text.match(/\$[\d,]+/);
      if (!priceMatch) continue;

      // Must look like a destination (city name + price, not a flight time listing)
      if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(text)) continue;

      const dest = extractDestinationInfo(el, text, priceMatch[0]);
      if (dest && dest.name && !seen.has(dest.name)) {
        seen.add(dest.name);
        results.push(dest);
      }
    }
  }

  return results;
}

/**
 * Extract destination information from an element.
 */
function extractDestinationInfo(el, text, price) {
  // Destination name: typically the first meaningful text before price/date info.
  // Look for heading-like elements or the first text node.
  let name = null;

  // Try to find a heading or prominent text element
  const headings = el.querySelectorAll('h2, h3, h4, [role="heading"]');
  if (headings.length > 0) {
    name = headings[0].textContent.trim();
  }

  // Fallback: grab text lines and pick the first one that looks like a city name
  if (!name) {
    const textParts = text.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
    for (const part of textParts) {
      // Skip prices, dates, flight details
      if (/^\$/.test(part)) continue;
      if (/^\d/.test(part) && !/^\d+\s+stop/i.test(part)) continue;
      if (/^(Nonstop|Round trip|One way)/i.test(part)) continue;
      if (part.length < 2 || part.length > 80) continue;
      name = part;
      break;
    }
  }

  if (!name) return null;

  // Stops: "Nonstop", "1 stop", "2 stops"
  const stopsMatch = text.match(/nonstop|\d+\s+stop(?:s)?/i);
  const stops = stopsMatch ? stopsMatch[0] : null;

  // Duration: "1 hr 30 min", "5h 20m", etc.
  const durationMatch = text.match(/\d+\s*h(?:r|our)?\s*\d*\s*m(?:in)?|\d+\s*h(?:r|our)?/i);
  const duration = durationMatch ? durationMatch[0].trim() : null;

  // Dates: Look for date range patterns like "Mar 30 – Apr 7", "Apr 6–14"
  const dateMatch = text.match(
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s*[\u2013\u2014–-]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+)?\d{1,2}/i
  );
  const dates = dateMatch ? dateMatch[0] : null;

  return { name, price, stops, duration, dates };
}
