// content/sites/google-hotels/tools/saveHotel.js

const SaveHotelTool = {
  name: 'save_hotel',
  description: 'Save or unsave a hotel to your collection by rank number.',
  inputSchema: {
    type: 'object',
    properties: {
      rank: {
        type: 'integer',
        description: '1-based rank number from get_results'
      },
      action: {
        type: 'string',
        enum: ['save', 'unsave'],
        description: 'Whether to save or unsave the hotel. Defaults to "save".'
      }
    },
    required: ['rank']
  },

  execute: async (args) => {
    const { rank, action = 'save' } = args;
    const url = window.location.href;
    if (!url.includes('/travel/search') && !url.includes('/travel/hotels')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Hotels.' }] };
    }

    const hotelCards = WebMCPHelpers.findGoogleHotelCards();

    if (rank < 1 || rank > hotelCards.length) {
      return { content: [{ type: 'text', text: `ERROR: Invalid rank ${rank}. Found ${hotelCards.length} hotel(s).` }] };
    }

    const card = hotelCards[rank - 1];
    WebMCPHelpers.simulateClick(card.saveBtn);
    await WebMCPHelpers.sleep(200);

    return {
      content: [{
        type: 'text',
        text: `${action === 'save' ? 'Saved' : 'Unsaved'} hotel: ${card.name || `#${rank}`}.`
      }]
    };
  }
};
