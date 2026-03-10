// content/injector.js — Registers WebMCP tools based on current Google Flights page

function registerGoogleFlightsTools() {
  const url = window.location.href;
  const registry = window.__webmcpRegistry;

  // Clear all tools before re-registering
  ['search_flights', 'get_results', 'set_filters', 'set_search_options',
   'sort_results', 'get_price_insights', 'get_flight_details', 'track_price',
   'explore_destinations', 'search_multi_city', 'set_connecting_airports'
  ].forEach(name => registry.unregister(name));

  const isFlightsPage = url.includes('google.com/travel/flights');
  const isExplorePage = url.includes('google.com/travel/explore');

  if (!isFlightsPage && !isExplorePage) return;

  const hasSearchParams = window.location.search.includes('q=') ||
                          window.location.search.includes('tfs=') ||
                          window.location.hash.includes('tfs=');

  // Always available on any Google Flights / Explore page
  registry.register(SearchFlightsTool);
  registry.register(SetSearchOptionsTool);
  registry.register(SearchMultiCityTool);
  registry.register(ExploreDestinationsTool);

  if (isFlightsPage && hasSearchParams) {
    // Results page: full toolset
    registry.register(GetResultsTool);
    registry.register(SetFiltersTool);
    registry.register(SortResultsTool);
    registry.register(GetPriceInsightsTool);
    registry.register(GetFlightDetailsTool);
    registry.register(TrackPriceTool);
    registry.register(SetConnectingAirportsTool);
  }
}

// Initial registration
registerGoogleFlightsTools();

// Re-register on SPA navigation (Google Flights uses client-side routing)
let lastHref = window.location.href;
const navObserver = new MutationObserver(() => {
  if (window.location.href !== lastHref) {
    lastHref = window.location.href;
    registerGoogleFlightsTools();
  }
});
navObserver.observe(document.body, { childList: true, subtree: true });

window.addEventListener('popstate', () => {
  setTimeout(registerGoogleFlightsTools, 100);
});
