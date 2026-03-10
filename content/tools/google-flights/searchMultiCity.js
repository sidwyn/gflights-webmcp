// content/tools/google-flights/searchMultiCity.js

const SearchMultiCityTool = {
  name: 'search_multi_city',
  description: 'Search for multi-city flights with 2-5 separate legs. Each leg has its own origin, destination, and date. Useful for complex itineraries like A→B then B→C then C→A.',
  inputSchema: {
    type: 'object',
    properties: {
      legs: {
        type: 'array',
        description: 'Array of 2-5 flight legs. Each leg has an origin, destination, and date.',
        items: {
          type: 'object',
          properties: {
            origin: {
              type: 'string',
              description: 'Departure airport IATA code (e.g., "SFO", "JFK", "LHR")'
            },
            destination: {
              type: 'string',
              description: 'Arrival airport IATA code (e.g., "LHR", "NRT", "CDG")'
            },
            date: {
              type: 'string',
              description: 'Flight date in YYYY-MM-DD format'
            }
          },
          required: ['origin', 'destination', 'date']
        },
        minItems: 2,
        maxItems: 5
      },
      cabinClass: {
        type: 'string',
        enum: ['economy', 'premium_economy', 'business', 'first'],
        description: 'Cabin class. Defaults to economy.'
      },
      adults: {
        type: 'integer',
        description: 'Number of adult passengers. Defaults to 1.'
      }
    },
    required: ['legs']
  },

  execute: async (args) => {
    const { legs, cabinClass = 'economy', adults = 1 } = args;

    if (!legs || !Array.isArray(legs) || legs.length < 2 || legs.length > 5) {
      return { content: [{ type: 'text', text: 'ERROR: legs must be an array of 2-5 flight legs.' }] };
    }

    const iataPattern = /^[A-Z]{3}$/i;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      if (!leg.origin || !leg.destination || !leg.date) {
        return { content: [{ type: 'text', text: `ERROR: Leg ${i + 1} must have origin, destination, and date.` }] };
      }
      if (!iataPattern.test(leg.origin)) {
        return { content: [{ type: 'text', text: `ERROR: Leg ${i + 1} origin must be a 3-letter IATA airport code (e.g., SFO, JFK, LHR).` }] };
      }
      if (!iataPattern.test(leg.destination)) {
        return { content: [{ type: 'text', text: `ERROR: Leg ${i + 1} destination must be a 3-letter IATA airport code (e.g., SFO, JFK, LHR).` }] };
      }
      if (!datePattern.test(leg.date)) {
        return { content: [{ type: 'text', text: `ERROR: Leg ${i + 1} date must be in YYYY-MM-DD format.` }] };
      }
    }

    // Build a natural language query — Google Flights handles multi-city via "then" syntax
    const legParts = legs.map(leg =>
      `${leg.origin.toUpperCase()} to ${leg.destination.toUpperCase()} on ${leg.date}`
    );
    const cabinStr = cabinClass !== 'economy' ? ` ${cabinClass.replace('_', ' ')} class` : '';
    const adultsStr = adults > 1 ? ` for ${adults} adults` : '';

    const query = `flights from ${legParts.join(' then ')}${cabinStr}${adultsStr}`;
    const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;

    // Navigate AFTER returning — the page unload destroys the content script context,
    // so we must send the response before location change happens.
    setTimeout(() => { window.location.href = url; }, 50);

    const legsSummary = legs.map((leg, i) =>
      `Leg ${i + 1}: ${leg.origin.toUpperCase()} → ${leg.destination.toUpperCase()} on ${leg.date}`
    ).join(', ');

    return {
      content: [{
        type: 'text',
        text: `Navigating to Google Flights: multi-city${cabinStr} search${adultsStr}. ${legsSummary}. Wait for the page to load, then call get_results.`
      }]
    };
  }
};
