// content/sites/google-hotels/tools/getResults.js

const GetHotelResultsTool = {
  name: 'get_results',
  description: 'Read the current hotel search results from the Google Hotels page and return them as structured data. Must be on a Google Hotels results page.',
  inputSchema: {
    type: 'object',
    properties: {
      maxResults: {
        type: 'integer',
        description: 'Maximum number of results to return. Defaults to 8.'
      }
    }
  },

  execute: async (args) => {
    const { maxResults = 8 } = args;

    const url = window.location.href;
    if (!url.includes('/travel/search') && !url.includes('/travel/hotels')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Hotels. Navigate to google.com/travel/search first.' }] };
    }

    await WebMCPHelpers.waitForGoogleHotelsResults(15000);

    const hotelCards = WebMCPHelpers.findGoogleHotelCards();

    if (hotelCards.length === 0) {
      return { content: [{ type: 'text', text: 'No hotel results found. The page may still be loading, or no hotels match your search. Try waiting a moment and calling get_results again.' }] };
    }

    const results = hotelCards
      .slice(0, maxResults)
      .map((card, i) => WebMCPHelpers.parseGoogleHotelCard(card, i + 1));

    const summary = results.map(r => {
      const parts = [`${r.rank}. ${r.name || 'Unknown Hotel'}`];
      if (r.rating) parts.push(`${r.rating}/5${r.reviewCount ? ` (${r.reviewCount} reviews)` : ''}`);
      if (r.price) parts.push(r.price + '/night');
      if (r.deal) parts.push(`[${r.deal}]`);
      return parts.join(' — ');
    }).join('\n');

    return {
      content: [{
        type: 'text',
        text: `Found ${results.length} hotel(s):\n\n${summary}`
      }]
    };
  }
};
