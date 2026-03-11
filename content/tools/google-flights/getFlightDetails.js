const GetFlightDetailsTool = {
  name: 'get_flight_details',
  description:
    'Expand a specific flight result by its rank number (from get_results) and read detailed info: leg-by-leg itinerary with departure/arrival times and airports, layover durations, aircraft type, flight numbers, legroom, and emissions per segment.',
  inputSchema: {
    type: 'object',
    properties: {
      rank: {
        type: 'integer',
        description: '1-based rank of the flight result to expand (from get_results)',
      },
    },
    required: ['rank'],
  },
  execute: async (args) => {
    const { rank } = args;

    // Check if on Google Flights
    if (!window.location.hostname.includes('google.com') || !window.location.pathname.includes('/travel/flights')) {
      return {
        content: [{ type: 'text', text: 'Error: Not on Google Flights. Please navigate to Google Flights first.' }],
      };
    }

    const { findByText, findByAriaLabel, simulateClick, sleep, parseGoogleFlightCard } = WebMCPHelpers;

    // Find flight cards using same logic as getResults
    let cards = Array.from(document.querySelectorAll('div.yR1fYc'));
    if (cards.length === 0) {
      // Structural heuristic fallback
      const allDivs = Array.from(document.querySelectorAll('div[data-ved]'));
      cards = allDivs.filter((div) => {
        const text = div.textContent || '';
        return text.includes('hr') && text.includes('min') && (text.includes('$') || text.includes('USD'));
      });
    }

    if (cards.length === 0) {
      return {
        content: [{ type: 'text', text: 'No flight results found on the page. Run a search first.' }],
      };
    }

    if (rank < 1 || rank > cards.length) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid rank ${rank}. There are ${cards.length} flight results. Use a rank between 1 and ${cards.length}.`,
          },
        ],
      };
    }

    const card = cards[rank - 1];

    // Find the expand/chevron button
    let expandButton = null;

    // Try aria-label containing "details" or "Flight details"
    const buttonsInCard = Array.from(card.querySelectorAll('button'));
    for (const btn of buttonsInCard) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('detail') || label.includes('flight detail')) {
        expandButton = btn;
        break;
      }
    }

    // Fallback: last button in the card (typically the expand chevron)
    if (!expandButton && buttonsInCard.length > 0) {
      expandButton = buttonsInCard[buttonsInCard.length - 1];
    }

    if (!expandButton) {
      return {
        content: [{ type: 'text', text: `Could not find an expand button for flight result #${rank}.` }],
      };
    }

    // Click to expand
    simulateClick(expandButton);
    await sleep(1500);

    // Parse the expanded detail panel
    // The expanded content typically appears as a sibling or nested container after the card
    let detailContainer = null;

    // Look for expanded content near the card
    const nextSibling = card.nextElementSibling;
    if (nextSibling && nextSibling.textContent && nextSibling.textContent.length > card.textContent.length * 0.5) {
      detailContainer = nextSibling;
    }

    // Also check within the card itself (some layouts expand inline)
    if (!detailContainer) {
      detailContainer = card;
    }

    // Broaden search: look for the nearest ancestor that contains the expanded details
    if (detailContainer.textContent && !detailContainer.textContent.match(/layover|legroom|emissions/i)) {
      let parent = card.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        if (parent.textContent.match(/layover|legroom|emissions/i)) {
          detailContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }

    const detailText = detailContainer.textContent || '';

    // Parse segments: airport names with times like "7:40 PM · San Francisco International Airport (SFO)"
    const timeAirportPattern = /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[·\u00b7]\s*([^(]+)\(([A-Z]{3})\)/gi;
    const timeAirportMatches = [];
    let match;
    while ((match = timeAirportPattern.exec(detailText)) !== null) {
      timeAirportMatches.push({
        time: match[1].trim(),
        airportName: match[2].trim(),
        code: match[3].trim(),
      });
    }

    // Parse layovers: "X hr Y min layover" patterns
    const layoverPattern = /(\d+)\s*hr\s*(?:(\d+)\s*min)?\s*layover/gi;
    const layovers = [];
    while ((match = layoverPattern.exec(detailText)) !== null) {
      const hrs = match[1];
      const mins = match[2] || '0';
      layovers.push(`${hrs} hr ${mins} min`);
    }

    // Parse aircraft types
    const aircraftPattern = /(Boeing|Airbus|Embraer|Bombardier|CRJ|ERJ)\s*[\w-]+/gi;
    const aircraftMatches = [];
    while ((match = aircraftPattern.exec(detailText)) !== null) {
      aircraftMatches.push(match[0].trim());
    }

    // Parse flight numbers: "F9 2486", "UA 1234"
    const flightNumberPattern = /\b([A-Z0-9]{2})\s*(\d{1,4})\b/g;
    const flightNumbers = [];
    // Use carrier info lines to extract flight numbers more accurately
    const carrierLinePattern = /[\w\s]+·\s*[\w\s]+·\s*[\w\s\d]+·\s*([A-Z0-9]{2}\s*\d{1,4})/gi;
    while ((match = carrierLinePattern.exec(detailText)) !== null) {
      flightNumbers.push(match[1].trim());
    }
    // Fallback: generic flight number extraction if none found via carrier lines
    if (flightNumbers.length === 0) {
      const genericFnPattern = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s*(\d{1,4})\b/g;
      while ((match = genericFnPattern.exec(detailText)) !== null) {
        const fn = `${match[1]} ${match[2]}`;
        if (!flightNumbers.includes(fn)) {
          flightNumbers.push(fn);
        }
      }
    }

    // Parse legroom
    const legroomPattern = /(?:below average|average|above average)\s*legroom\s*\((\d+)\s*in\)/gi;
    const legroomMatches = [];
    while ((match = legroomPattern.exec(detailText)) !== null) {
      legroomMatches.push(match[0].trim());
    }

    // Parse emissions per segment
    const emissionsPattern = /(\d+)\s*kg\s*CO2/gi;
    const emissionsMatches = [];
    while ((match = emissionsPattern.exec(detailText)) !== null) {
      emissionsMatches.push(`${match[1]} kg CO2`);
    }

    // Parse carrier info lines: "Frontier · Economy · Airbus A321neo · F9 2486"
    const carrierInfoPattern = /([\w\s]+·[\w\s]+·[\w\s\d]+·[\w\s\d]+)/g;
    const carrierInfoMatches = [];
    while ((match = carrierInfoPattern.exec(detailText)) !== null) {
      const line = match[1].trim();
      if (line.includes('·')) {
        carrierInfoMatches.push(line);
      }
    }

    // Build segment summary
    const segments = [];
    // Pair up time/airport entries: each segment has a departure and arrival
    for (let i = 0; i + 1 < timeAirportMatches.length; i++) {
      const dep = timeAirportMatches[i];
      const arr = timeAirportMatches[i + 1];

      // Only pair consecutive entries that form a segment (skip if next is a layover departure)
      const segIndex = segments.length;
      const segment = {
        departure: `${dep.time} - ${dep.airportName}(${dep.code})`,
        arrival: `${arr.time} - ${arr.airportName}(${arr.code})`,
        aircraft: aircraftMatches[segIndex] || 'Unknown',
        flightNumber: flightNumbers[segIndex] || 'Unknown',
        legroom: legroomMatches[segIndex] || 'Not available',
        emissions: emissionsMatches[segIndex] || 'Not available',
        carrierInfo: carrierInfoMatches[segIndex] || '',
      };
      segments.push(segment);

      // Skip the arrival entry so the next iteration starts at the next departure
      i++;
    }

    // Build output text
    let output = `Flight #${rank} - Detailed Itinerary\n`;
    output += '='.repeat(40) + '\n\n';

    if (segments.length === 0) {
      output += 'Could not parse segment details from the expanded card.\n';
      output += `\nRaw detail text (first 500 chars):\n${detailText.substring(0, 500)}\n`;
    } else {
      segments.forEach((seg, idx) => {
        output += `Segment ${idx + 1}:\n`;
        if (seg.carrierInfo) {
          output += `  Carrier: ${seg.carrierInfo}\n`;
        }
        output += `  Departure: ${seg.departure}\n`;
        output += `  Arrival:   ${seg.arrival}\n`;
        output += `  Aircraft:  ${seg.aircraft}\n`;
        output += `  Flight:    ${seg.flightNumber}\n`;
        output += `  Legroom:   ${seg.legroom}\n`;
        output += `  Emissions: ${seg.emissions}\n`;

        // Add layover info if there is one after this segment
        if (idx < layovers.length) {
          output += `\n  Layover: ${layovers[idx]}\n`;
        }
        output += '\n';
      });
    }

    if (layovers.length > 0 && segments.length === 0) {
      output += `\nLayovers: ${layovers.join(', ')}\n`;
    }

    // Collapse the card by clicking the expand button again
    simulateClick(expandButton);
    await sleep(500);

    return {
      content: [{ type: 'text', text: output.trim() }],
    };
  },
};
