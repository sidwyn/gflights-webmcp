// content/sites/google-hotels/injector.js — Registers WebMCP tools based on current Google Hotels page

/**
 * Read the current search location from the Google Hotels search form.
 */
function getGoogleHotelsPageContext() {
  const ctx = {};

  const candidates = [
    // 1. Search combobox
    () => {
      const el = document.querySelector('input[placeholder*="Search for places"]');
      return el?.value?.trim() || null;
    },
    // 2. Any combobox input
    () => {
      const el = document.querySelector('input[role="combobox"]');
      return el?.value?.trim() || null;
    },
    // 3. Search input by aria-label
    () => {
      const el = document.querySelector('input[aria-label*="Search"]');
      return el?.value?.trim() || null;
    }
  ];

  for (const fn of candidates) {
    try {
      const val = fn();
      if (val) { ctx.locationText = val; break; }
    } catch {
      // Selector may throw — continue
    }
  }

  return ctx;
}

// Register the page context provider for Google Hotels
window.__webmcpRegistry.pageContextProvider = getGoogleHotelsPageContext;

// Set the site prompt (loaded from prompt.js)
window.__webmcpRegistry.sitePrompt = typeof GOOGLE_HOTELS_PROMPT !== 'undefined' ? GOOGLE_HOTELS_PROMPT : '';

function registerGoogleHotelsTools() {
  const url = window.location.href;
  const registry = window.__webmcpRegistry;

  // Clear all hotel tools before re-registering
  ['search_hotels', 'get_results', 'set_filters', 'sort_results',
   'get_hotel_details', 'get_prices', 'get_reviews', 'set_search_options',
   'save_hotel', 'book_hotel', 'track_hotel'
  ].forEach(name => registry.unregister(name));

  const isSearchPage = url.includes('/travel/search');
  const isHotelsPage = url.includes('/travel/hotels');
  if (!isSearchPage && !isHotelsPage) return;

  // On /travel/search, detect if page is showing hotels (vs flights/other travel)
  if (isSearchPage && !isHotelsPage) {
    const hasHotelContent =
      !!document.querySelector('input[placeholder*="Search for places"]') ||
      !!document.querySelector('button[aria-label*="travelers"]') ||
      /prices starting from/i.test(document.body.textContent) ||
      /hotel/i.test(document.title);

    // If it looks like a flights page, don't register hotel tools
    if (!hasHotelContent && url.includes('/travel/flights')) return;
  }

  // Always available on Google Hotels
  registry.register(SearchHotelsTool);
  registry.register(SetHotelSearchOptionsTool);

  // Available when results are showing
  const hasResults = !!document.querySelector('button[aria-label*="Save"]') ||
                     /prices starting from/i.test(document.body.textContent) ||
                     /out of 5 stars/i.test(document.body.textContent);

  if (hasResults) {
    registry.register(GetHotelResultsTool);
    registry.register(SetHotelFiltersTool);
    registry.register(SortHotelResultsTool);
    registry.register(GetHotelDetailsTool);
    registry.register(GetPricesTool);
    registry.register(SaveHotelTool);
    registry.register(BookHotelTool);
    registry.register(GetReviewsTool);
    registry.register(TrackHotelTool);
  }
}

// Initial registration
registerGoogleHotelsTools();

// Re-register on SPA navigation (Google Hotels uses client-side routing)
let lastHotelHref = window.location.href;
const hotelNavObserver = new MutationObserver(() => {
  if (window.location.href !== lastHotelHref) {
    lastHotelHref = window.location.href;
    registerGoogleHotelsTools();
  }
});
hotelNavObserver.observe(document.body, { childList: true, subtree: true });

window.addEventListener('popstate', () => {
  setTimeout(registerGoogleHotelsTools, 100);
});
