// content/sites/google-hotels/tools/trackHotel.js

const TrackHotelTool = {
  name: 'track_hotel',
  description: 'Toggle price tracking for a hotel on Google Hotels. When enabled, Google will send email alerts when the price changes.',
  inputSchema: {
    type: 'object',
    properties: {
      rank: {
        type: 'integer',
        description: '1-based rank number from get_results. Omit if already on a hotel detail page.'
      },
      action: {
        type: 'string',
        enum: ['track', 'untrack'],
        description: 'Whether to enable or disable price tracking. Defaults to "track".'
      }
    }
  },

  execute: async (args) => {
    const { rank, action = 'track' } = args;
    const url = window.location.href;
    if (!url.includes('/travel/search') && !url.includes('/travel/hotels')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Hotels.' }] };
    }

    let hotelName = 'Unknown Hotel';

    // Check if we're already on a hotel detail page
    const isDetailPage = !!document.querySelector('[role="tab"]') &&
      Array.from(document.querySelectorAll('[role="tab"]')).some(t => /overview|prices|reviews/i.test(t.textContent));

    if (rank && !isDetailPage) {
      // Click into the hotel from the results list
      const hotelCards = WebMCPHelpers.findGoogleHotelCards();

      if (rank < 1 || rank > hotelCards.length) {
        return { content: [{ type: 'text', text: `ERROR: Invalid rank ${rank}. Found ${hotelCards.length} hotel(s). Use a rank between 1 and ${hotelCards.length}.` }] };
      }

      const card = hotelCards[rank - 1];
      hotelName = card.name || 'Unknown Hotel';

      // Find the hotel name link (not "Prices starting from" or "View prices" or "Photos")
      const nameLink = Array.from(card.container.querySelectorAll('a[href*="/travel/search"]')).find(link => {
        const text = link.textContent.trim();
        return text === hotelName || (
          !/prices starting from/i.test(text) &&
          !/view prices/i.test(text) &&
          !/photos for/i.test(text) &&
          !/out of 5 stars/i.test(text) &&
          text.length > 3
        );
      });

      if (nameLink) {
        WebMCPHelpers.simulateClick(nameLink);
      } else {
        const firstLink = card.container.querySelector('a[href*="/travel/search"]');
        if (firstLink) WebMCPHelpers.simulateClick(firstLink);
      }

      await WebMCPHelpers.sleep(1500);

      // Wait for detail page to load
      let attempts = 0;
      while (attempts < 20) {
        const pageText = document.body.textContent;
        if (/amenities|about this|check availability|overview|reviews/i.test(pageText)) break;
        await WebMCPHelpers.sleep(200);
        attempts++;
      }
    } else if (isDetailPage) {
      // Already on detail page — extract hotel name
      const openLink = document.querySelector('a[aria-label*="Open"][aria-label*="in a new tab"]');
      if (openLink) {
        hotelName = (openLink.getAttribute('aria-label') || '')
          .replace(/^Open\s+/i, '').replace(/\s+in a new tab\.?$/i, '').trim();
      } else {
        hotelName = document.title.replace(/\s*-\s*Google hotels?$/i, '').trim();
      }
    }

    // Find the tracking toggle switch
    let toggle = WebMCPHelpers.findByAriaLabel('Toggle tracking');

    // Fallback: look for any switch with aria-label containing "tracking"
    if (!toggle) {
      const allSwitches = Array.from(document.querySelectorAll('[role="switch"]'));
      toggle = allSwitches.find(el =>
        (el.getAttribute('aria-label') || '').toLowerCase().includes('tracking')
      );
    }

    // Fallback: look for any role="switch" on the detail page
    if (!toggle) {
      toggle = document.querySelector('[role="switch"]');
    }

    if (!toggle) {
      return { content: [{ type: 'text', text: 'ERROR: Could not find the price tracking toggle. Make sure you are on a hotel detail page.' }] };
    }

    // Scroll the toggle into view
    toggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await WebMCPHelpers.sleep(200);

    // Check current tracking state
    const isCurrentlyTracking = toggle.getAttribute('aria-checked') === 'true';
    const wantTracking = action === 'track';

    if (isCurrentlyTracking === wantTracking) {
      const stateText = isCurrentlyTracking ? 'already being tracked' : 'not currently tracked';
      return { content: [{ type: 'text', text: `${hotelName} is ${stateText}. No change needed.` }] };
    }

    // Click the toggle to change state
    WebMCPHelpers.simulateClick(toggle);
    await WebMCPHelpers.sleep(500);

    // Verify the state changed
    const newState = toggle.getAttribute('aria-checked') === 'true';
    if (newState !== wantTracking) {
      return { content: [{ type: 'text', text: `ERROR: Failed to toggle tracking for ${hotelName}. The state did not change after clicking.` }] };
    }

    const actionText = wantTracking ? 'Enabled' : 'Disabled';
    const notifText = wantTracking
      ? 'You will receive email notifications when the price changes.'
      : 'Email notifications have been turned off.';

    return {
      content: [{
        type: 'text',
        text: `${actionText} price tracking for ${hotelName}. ${notifText}`
      }]
    };
  }
};
