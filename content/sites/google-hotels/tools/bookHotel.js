// content/sites/google-hotels/tools/bookHotel.js

const BookHotelTool = {
  name: 'book_hotel',
  description: 'Open a booking provider\'s website for a hotel. Must be on a hotel detail page (call get_hotel_details first). Optionally specify a provider rank from get_prices.',
  inputSchema: {
    type: 'object',
    properties: {
      providerRank: {
        type: 'integer',
        description: '1-based rank of provider from get_prices. Defaults to 1 (cheapest/first listed).'
      }
    }
  },

  execute: async (args) => {
    const { providerRank = 1 } = args;
    const url = window.location.href;
    if (!url.includes('/travel/search') && !url.includes('/travel/hotels')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Hotels.' }] };
    }

    // Find "Visit site for [Provider]" buttons on the detail page
    const visitBtns = Array.from(document.querySelectorAll('button, a')).filter(el => {
      const aria = el.getAttribute('aria-label') || '';
      return /^visit site for /i.test(aria);
    });

    // Deduplicate by provider name
    const seen = new Set();
    const providers = [];
    for (const btn of visitBtns) {
      const aria = btn.getAttribute('aria-label') || '';
      const name = aria.replace(/^Visit site for\s*/i, '').trim();
      if (seen.has(name)) continue;
      seen.add(name);
      providers.push({ name, btn });
    }

    if (providers.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No booking providers found. Navigate to a hotel detail page first using get_hotel_details, then try again.'
        }]
      };
    }

    if (providerRank < 1 || providerRank > providers.length) {
      return {
        content: [{
          type: 'text',
          text: `Invalid providerRank ${providerRank}. Found ${providers.length} provider(s). Use a rank between 1 and ${providers.length}.`
        }]
      };
    }

    const chosen = providers[providerRank - 1];

    // Click the button — this opens the provider's booking page in a new tab
    chosen.btn.click();
    await WebMCPHelpers.sleep(500);

    // Get hotel name for context
    const openLink = document.querySelector('a[aria-label*="Open"][aria-label*="in a new tab"]');
    let hotelName = 'this hotel';
    if (openLink) {
      hotelName = (openLink.getAttribute('aria-label') || '')
        .replace(/^Open\s+/i, '').replace(/\s+in a new tab\.?$/i, '').trim();
    }

    return {
      content: [{
        type: 'text',
        text: `Opening booking page via ${chosen.name} for ${hotelName}. The provider's website should open in a new tab.`
      }]
    };
  }
};
