// content/sites/google-hotels/tools/searchHotels.js

const SearchHotelsTool = {
  name: 'search_hotels',
  description: 'Search for hotels on Google Hotels. Navigates directly via URL. After calling this tool, call get_results to read the hotel listings.',
  inputSchema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'Location to search (e.g., "Times Square New York", "Shibuya Tokyo", "Paris France")'
      },
      checkIn: {
        type: 'string',
        description: 'Check-in date in YYYY-MM-DD format'
      },
      checkOut: {
        type: 'string',
        description: 'Check-out date in YYYY-MM-DD format'
      },
      guests: {
        type: 'integer',
        description: 'Number of guests. Defaults to 2.'
      }
    },
    required: ['location']
  },

  execute: async (args) => {
    const { location, checkIn, checkOut, guests } = args;

    // Build URL — Google Hotels uses /travel/search?q=hotels+in+[location]
    const query = `hotels in ${location}`;
    const url = `https://www.google.com/travel/search?q=${encodeURIComponent(query)}`;

    // Navigate after returning (page unload kills content script context)
    setTimeout(() => { window.location.href = url; }, 50);

    const parts = [`Searching for hotels in ${location}`];
    if (checkIn) parts.push(`Check-in: ${checkIn}`);
    if (checkOut) parts.push(`Check-out: ${checkOut}`);
    if (guests) parts.push(`Guests: ${guests}`);
    parts.push('Wait for results to load, then call set_search_options to set dates if needed, then call get_results.');

    return { content: [{ type: 'text', text: parts.join('. ') + '.' }] };
  }
};
