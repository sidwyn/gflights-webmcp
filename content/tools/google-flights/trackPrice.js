// content/tools/google-flights/trackPrice.js

const TrackPriceTool = {
  name: 'track_price',
  description: 'Toggle price tracking on or off for the current flight search. Google Flights will send email notifications when prices change. Can track specific dates or any dates.',
  inputSchema: {
    type: 'object',
    properties: {
      enable: {
        type: 'boolean',
        description: 'true to enable price tracking, false to disable it',
        default: true
      },
      anyDates: {
        type: 'boolean',
        description: 'If true, track "Any dates" instead of specific dates',
        default: false
      }
    }
  },

  execute: async ({ enable = true, anyDates = false } = {}) => {
    if (!window.location.href.includes('google.com/travel/flights') ||
        (!window.location.search.includes('q=') && !window.location.search.includes('tfs='))) {
      return { content: [{ type: 'text', text: 'ERROR: Not on a Google Flights results page. Search for flights first.' }] };
    }

    await WebMCPHelpers.sleep(500);

    // Find the "Track prices" section on the page
    const trackPricesHeading = WebMCPHelpers.findByText('Track prices');
    if (!trackPricesHeading) {
      return { content: [{ type: 'text', text: 'ERROR: Could not find the "Track prices" section. Scroll down on the results page or ensure flight results are loaded.' }] };
    }

    // Scroll the track prices section into view
    trackPricesHeading.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await WebMCPHelpers.sleep(500);

    // Find all toggle switches in the track prices area
    const trackPricesSection = trackPricesHeading.closest('div')?.parentElement?.parentElement || document.body;
    const allToggles = Array.from(trackPricesSection.querySelectorAll('[role="switch"]'));

    if (allToggles.length === 0) {
      return { content: [{ type: 'text', text: 'ERROR: Could not find any price tracking toggles on the page.' }] };
    }

    // Select the right toggle based on anyDates parameter
    let targetToggle = null;

    if (anyDates) {
      // Look for the toggle near "Any dates" text
      const anyDatesEl = WebMCPHelpers.findByText('Any dates');
      if (anyDatesEl) {
        // Find the closest toggle to the "Any dates" text
        const container = anyDatesEl.closest('div')?.parentElement;
        if (container) {
          targetToggle = container.querySelector('[role="switch"]');
        }
      }
      // Fallback: look for a toggle with aria-label mentioning "any dates"
      if (!targetToggle) {
        targetToggle = allToggles.find(t =>
          (t.getAttribute('aria-label') || '').toLowerCase().includes('any dates')
        );
      }
      // Last fallback: use the second toggle if available (typically "Any dates")
      if (!targetToggle && allToggles.length > 1) {
        targetToggle = allToggles[1];
      }
    } else {
      // Look for the specific dates toggle: aria-label containing "Track prices from"
      targetToggle = allToggles.find(t =>
        (t.getAttribute('aria-label') || '').toLowerCase().includes('track prices from')
      );
      // Fallback: use the first toggle (typically specific dates)
      if (!targetToggle) {
        targetToggle = allToggles[0];
      }
    }

    if (!targetToggle) {
      return { content: [{ type: 'text', text: 'ERROR: Could not find the appropriate price tracking toggle.' }] };
    }

    // Check current state
    const currentState = targetToggle.getAttribute('aria-checked') === 'true';
    const desiredState = enable;
    const toggleLabel = targetToggle.getAttribute('aria-label') || 'price tracking';

    if (currentState === desiredState) {
      const stateText = currentState ? 'enabled' : 'disabled';
      return { content: [{ type: 'text', text: `Price tracking is already ${stateText} for: ${toggleLabel}` }] };
    }

    // Click the toggle to change state
    WebMCPHelpers.simulateClick(targetToggle);
    await WebMCPHelpers.sleep(500);

    // Verify the state changed
    const newState = targetToggle.getAttribute('aria-checked') === 'true';
    if (newState !== desiredState) {
      return { content: [{ type: 'text', text: 'ERROR: Failed to toggle price tracking. The state did not change after clicking.' }] };
    }

    const action = desiredState ? 'Enabled' : 'Disabled';
    const trackingType = anyDates ? 'any dates' : 'specific dates';

    return {
      content: [{
        type: 'text',
        text: `${action} price tracking (${trackingType}): ${toggleLabel}. ${desiredState ? 'You will receive email notifications when prices change.' : 'Email notifications have been turned off.'}`
      }]
    };
  }
};
