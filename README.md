# GFlights WebMCP

A Chrome extension that brings an AI-powered flight assistant into Google Flights. Search, filter, sort, and get booking advice — all in plain English from a side panel.

Built on the [WebMCP](https://github.com/anthropics/webmcp) standard: tools are registered as `window.__webmcpRegistry` entries in the page context and called by the AI as needed.

---

## Demo

<!-- VIDEO PLACEHOLDER -->
> 📹 Demo video coming soon

---

## Features

- **Natural language search** — "Cheapest nonstop from SFO to NYC in April"
- **Smart origin detection** — automatically reads your departure airport from the Google Flights page
- **Full filter control** — stops, price cap, airlines, departure/arrival times, duration, bags
- **Trip options** — round trip / one-way, cabin class, passenger counts
- **Sort results** — Best or Cheapest
- **Price insights & date grid** — reads the price history, scans the date grid across multiple pages, and finds the cheapest dates in a month
- **Anywhere search** — "Find me the cheapest flight from SFO next month"
- **Quick reply suggestions** — clickable buttons for common follow-up actions (e.g. "Filter nonstop", "Sort by cheapest")
- **Markdown tables** — flight results render as clean, formatted tables
- **Dark mode** — adapts to your system theme with a clean dark palette
- **Multi-model** — works with Claude (Anthropic) or GPT-4o (OpenAI)
- **Flight details** — "Tell me more about flight #3" — see leg-by-leg itinerary, aircraft, legroom, emissions
- **Price tracking** — Get email alerts when prices change for your search
- **Tracked flights dashboard** — "Show my tracked flights" — view all your saved price alerts and price history
- **Booking links** — "How do I book flight #2?" — get direct booking URLs from airlines and OTAs
- **Return flight selection** — After picking a departing flight, browse and select return options
- **Explore destinations** — "Where can I fly for cheap?" — browse the cheapest destinations on a map
- **Flexible explore dates** — Filter explore by month or trip length (weekend, 1 week, 2 weeks)
- **Multi-city search** — Complex itineraries like SFO→Tokyo→Bangkok→SFO
- **Connecting airport filter** — Exclude specific layover airports
- **Conversation persistence** — Chat history is preserved when you navigate or close the panel
- **New chat** — Start a fresh conversation with one click

---

## Installation

1. Clone this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the repo folder
5. Open Google Flights — the GFlights panel appears in the side panel

---

## Setup

Add your API key in the extension's Settings panel:

- **Anthropic** — get a key at [console.anthropic.com](https://console.anthropic.com)
- **OpenAI** — get a key at [platform.openai.com](https://platform.openai.com)

Keys are stored locally in `chrome.storage.local` and never leave your browser except to call the respective API.

---

## Tools (WebMCP)

All tools are registered via `window.__webmcpRegistry` and available to the AI on Google Flights:

| Tool | Available on | Description |
|------|-------------|-------------|
| `search_flights` | All pages | Navigate to Google Flights with origin, destination, dates, and cabin class |
| `set_search_options` | All pages | Change trip type (round trip / one-way), cabin class, or passenger counts |
| `get_results` | Results page | Read the current flight listings from the results page |
| `set_filters` | Results page | Apply filters: stops, max price, airlines, times, duration, bags |
| `sort_results` | Results page | Sort results by Best or Cheapest |
| `get_price_insights` | Results page | Read price level, typical range, scan date grid for cheapest dates, and recommend whether to book now |
| `get_flight_details` | Results page | Expand a flight to see detailed segment info: layovers, aircraft, flight numbers, legroom, emissions |
| `track_price` | Results page | Toggle email price tracking for specific dates or any dates |
| `get_tracked_flights` | All pages | View all saved price alerts and tracked flights with price history |
| `get_booking_link` | Results page | Get booking links and prices from airlines/OTAs for a flight |
| `select_return_flight` | Results page | List or select return flight options after choosing departing |
| `explore_destinations` | All pages | Navigate to Explore map and read cheapest destinations (supports month/trip length) |
| `search_multi_city` | All pages | Search multi-city itineraries with 2-5 legs |
| `set_connecting_airports` | Results page | Exclude specific connecting/layover airports from results |

---

## Project Structure

```
gflights-webmcp/
├── manifest.json
├── background.js
├── content/
│   ├── bridge.js          # Registry + message bridge
│   ├── injector.js        # Registers tools per page type
│   └── tools/
│       ├── helpers.js     # Shared DOM utilities
│       └── google-flights/
│           ├── searchFlights.js
│           ├── getResults.js
│           ├── setFilters.js
│           ├── setSearchOptions.js
│           ├── sortResults.js
│           ├── getPriceInsights.js
│           ├── getFlightDetails.js
│           ├── trackPrice.js
│           ├── getTrackedFlights.js
│           ├── getBookingLink.js
│           ├── selectReturnFlight.js
│           ├── exploreDestinations.js
│           ├── searchMultiCity.js
│           └── setConnectingAirports.js
├── sidepanel/
│   ├── index.html
│   ├── app.js             # Chat UI + agent loop
│   ├── settings.js
│   ├── styles.css
│   └── providers/
│       ├── base.js
│       ├── anthropic.js
│       └── openai.js
└── icons/
```

---

## Development

No build step required. Edit files, reload the extension in `chrome://extensions`, refresh Google Flights.

Git hooks are stored in `.githooks/`. After cloning, activate them with:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

The pre-commit hook updates the "Last updated" date in this README automatically on every commit.

---

## License

MIT — see [LICENSE](LICENSE)

---

<!-- LAST_UPDATED -->
_Last updated: 2026-03-10_
<!-- /LAST_UPDATED -->
