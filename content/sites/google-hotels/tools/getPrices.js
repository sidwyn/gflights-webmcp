// content/sites/google-hotels/tools/getPrices.js

const GetPricesTool = {
  name: 'get_prices',
  description: 'Get booking prices from multiple providers for a hotel. Click "View prices" on a hotel card or read prices from the detail page.',
  inputSchema: {
    type: 'object',
    properties: {
      rank: {
        type: 'integer',
        description: '1-based rank from get_results. Omit if already on a hotel detail page.'
      }
    }
  },

  execute: async (args) => {
    const { rank } = args;
    const url = window.location.href;
    if (!url.includes('/travel/search') && !url.includes('/travel/hotels')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Hotels.' }] };
    }

    // If rank is specified, click "View prices" on that hotel card
    if (rank) {
      const hotelCards = WebMCPHelpers.findGoogleHotelCards();

      if (rank < 1 || rank > hotelCards.length) {
        return { content: [{ type: 'text', text: `ERROR: Invalid rank ${rank}. Found ${hotelCards.length} hotel(s).` }] };
      }

      const card = hotelCards[rank - 1];

      // Find "View prices" link in the card container
      const viewPricesLink = Array.from(card.container.querySelectorAll('a')).find(link =>
        /view prices/i.test(link.textContent)
      );

      if (viewPricesLink) {
        WebMCPHelpers.simulateClick(viewPricesLink);
      } else {
        // Click the hotel name link as fallback
        const nameLink = card.container.querySelector('a[href*="/travel/search"]');
        if (nameLink) WebMCPHelpers.simulateClick(nameLink);
      }

      await WebMCPHelpers.sleep(1500);
    }

    await WebMCPHelpers.sleep(500);

    // Strategy 1: Find "Visit site for [Provider]" buttons — provider name is in aria-label
    const visitSiteBtns = Array.from(document.querySelectorAll('button, a')).filter(el => {
      const aria = el.getAttribute('aria-label') || '';
      return /^visit site for /i.test(aria);
    });

    if (visitSiteBtns.length > 0) {
      // Extract provider + price, deduplicate by provider name
      const seen = new Set();
      const providers = [];

      // Get hotel name to filter out non-provider entries (e.g. "Visit site for [Hotel Name]")
      const openLink = document.querySelector('a[aria-label*="Open"][aria-label*="in a new tab"]');
      const hotelName = openLink
        ? (openLink.getAttribute('aria-label') || '').replace(/^Open\s+/i, '').replace(/\s+in a new tab\.?$/i, '').trim()
        : document.title.replace(/\s*-\s*Google hotels?$/i, '').trim();

      for (const btn of visitSiteBtns) {
        const aria = btn.getAttribute('aria-label') || '';
        const providerName = aria.replace(/^Visit site for\s*/i, '').trim();
        if (seen.has(providerName)) continue;
        seen.add(providerName);

        // Skip if provider name matches the hotel name (it's the hotel's own entry without a proper provider)
        if (providerName === hotelName) continue;

        // Walk up DOM to find price in a nearby container
        let price = '';
        let container = btn.parentElement;
        for (let j = 0; j < 6 && container; j++) {
          const text = container.textContent.replace(/\s+/g, ' ').trim();
          const priceMatch = text.match(/\$(\d[\d,]*)/);
          if (priceMatch && text.length < 300) {
            price = '$' + priceMatch[1];
            break;
          }
          container = container.parentElement;
        }
        providers.push(`${providers.length + 1}. ${providerName}${price ? ' — ' + price : ''}`);
        if (providers.length >= 10) break;
      }

      return {
        content: [{
          type: 'text',
          text: `Booking options (top ${providers.length}):\n\n${providers.join('\n')}`
        }]
      };
    }

    // Strategy 2: Find provider links via /travel/clk? redirect URLs (Google's booking redirects)
    const clkLinks = Array.from(document.querySelectorAll('a[href*="/travel/clk"]'));
    if (clkLinks.length > 0) {
      const providers = clkLinks.slice(0, 10).map((link, i) => {
        const text = link.textContent.trim().replace(/\s+/g, ' ');
        return `${i + 1}. ${text}`;
      });

      return {
        content: [{
          type: 'text',
          text: `Booking options:\n\n${providers.join('\n')}`
        }]
      };
    }

    // Fallback: look for price-like text blocks
    const pageText = document.body.textContent;
    const priceMatches = pageText.match(/\$[\d,]+\s*(?:per night|\/night|total)?/gi);
    if (priceMatches && priceMatches.length > 0) {
      const uniquePrices = [...new Set(priceMatches)];
      return {
        content: [{
          type: 'text',
          text: `Found prices on page: ${uniquePrices.slice(0, 5).join(', ')}\n\nFor detailed provider comparison, click into the hotel first using get_hotel_details.`
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: 'Could not find detailed pricing information. Try clicking into the hotel first with get_hotel_details, then call get_prices again.'
      }]
    };
  }
};
