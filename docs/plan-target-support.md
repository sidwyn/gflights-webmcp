# Plan: Add Target.com as a Supported Site

## Overview

Add Target (target.com) as a new site module in the webmcp-tool-library Chrome extension. This module will enable AI agents to help users search for products, read product details, manage their cart, and apply deals on Target.com.

Target.com is a React-based SPA with client-side routing, similar in complexity to the existing Google Flights module. The site uses `data-test` attributes extensively on key elements, making DOM selection more reliable than class-name-based approaches.

---

## File Structure

```
content/sites/target/
├── helpers.js            # Target-specific DOM utilities
├── prompt.js             # AI system prompt for Target
├── injector.js           # Tool registration + page context + SPA nav observer
└── tools/
    ├── searchProducts.js     # Search for products by keyword
    ├── getSearchResults.js   # Read current search/category listing
    ├── setFilters.js         # Apply filters (price, brand, rating, etc.)
    ├── sortResults.js        # Sort by price, rating, relevance, etc.
    ├── getProductDetails.js  # Read full product info (price, desc, reviews, availability)
    ├── addToCart.js           # Add current product to cart
    ├── getCartSummary.js     # Read cart contents and totals
    ├── getDeals.js           # Read current deals/promotions on the page
    └── checkStoreAvailability.js  # Check in-store pickup availability
```

---

## Step-by-Step Implementation

### Step 1: Create the site directory

```bash
mkdir -p content/sites/target/tools
```

### Step 2: Implement `helpers.js` — Target-specific DOM utilities

Extend `WebMCPHelpers` with Target-specific functions:

- **`WebMCPHelpers.waitForTargetResults(timeout)`** — Poll for product grid to finish loading. Target shows a spinner/skeleton UI while fetching. Wait for `[data-test="product-grid"]` or product cards to appear and loading indicators to clear.

- **`WebMCPHelpers.parseTargetProductCard(card, rank)`** — Parse a product card element into structured data: `{ rank, name, price, rating, reviewCount, brand, imageUrl, productUrl }`. Target product cards contain structured elements with `data-test` attributes for title, price, ratings, etc.

- **`WebMCPHelpers.simulateTargetSearch(query)`** — Type into Target's search bar and submit. Target uses a combobox-style search with autocomplete suggestions. This helper handles focusing the input, clearing existing text, typing the query, and submitting via Enter key (or clicking the search button).

### Step 3: Implement tools (one file per tool)

Each tool follows the standard pattern: `{ name, description, inputSchema, execute }`.

#### `searchProducts.js`
- **Name:** `search_products`
- **Purpose:** Navigate to Target search results for a given query
- **Input:** `{ query: string }`
- **Behavior:** Uses `WebMCPHelpers.simulateTargetSearch()` to type into the search bar and submit. Waits for results to load via `waitForTargetResults()`. Returns confirmation with result count.

#### `getSearchResults.js`
- **Name:** `get_search_results`
- **Purpose:** Read current product listings from the search/category page
- **Input:** `{ maxResults?: integer }` (default 10)
- **Behavior:** Finds product cards on the page, parses each with `parseTargetProductCard()`, returns formatted list with rank, name, price, rating, brand.

#### `setFilters.js`
- **Name:** `set_filters`
- **Purpose:** Apply sidebar filters (price range, brand, category, rating, deals, shipping/pickup)
- **Input:** `{ priceMin?: number, priceMax?: number, brand?: string, rating?: integer, freeShipping?: boolean, storePickup?: boolean, onSale?: boolean }`
- **Behavior:** Opens the relevant filter sections in Target's sidebar, selects/deselects checkboxes or sets range inputs. Target's filter UI uses expandable accordions — the tool needs to click the section header to expand it first, then interact with the filter controls. Waits for results to refresh after each filter change.

#### `sortResults.js`
- **Name:** `sort_results`
- **Purpose:** Change sort order of results
- **Input:** `{ sortBy: string }` — one of `"relevance"`, `"price_low"`, `"price_high"`, `"rating"`, `"bestselling"`, `"newest"`
- **Behavior:** Clicks the sort dropdown, selects the matching option. Waits for results to refresh.

#### `getProductDetails.js`
- **Name:** `get_product_details`
- **Purpose:** Read full details from a product detail page (PDP), or click into a product from search results first
- **Input:** `{ rank?: integer }` — if provided, clicks the nth product from search results first
- **Behavior:** If `rank` is provided, clicks that product card and waits for PDP to load. Reads: product name, price (regular + sale), description, specifications, rating, review count, availability (shipping/pickup), size/color options. Returns structured text.

#### `addToCart.js`
- **Name:** `add_to_cart`
- **Purpose:** Add the current product to cart
- **Input:** `{ quantity?: integer, size?: string, color?: string }`
- **Behavior:** On a PDP, selects size/color if specified (clicks the option buttons), sets quantity, clicks "Add to cart" button. Waits for the cart confirmation modal. Returns confirmation with item name and price.

#### `getCartSummary.js`
- **Name:** `get_cart_summary`
- **Purpose:** Read the current cart contents and totals
- **Input:** `{}` (no required params)
- **Behavior:** Navigates to cart page (`/cart`) or reads the cart flyout. Parses each item (name, price, quantity) and the order summary (subtotal, estimated tax, total). Returns formatted cart contents.

#### `getDeals.js`
- **Name:** `get_deals`
- **Purpose:** Read current deals, promotions, or Circle offers visible on the page
- **Input:** `{ category?: string }`
- **Behavior:** Reads promotional banners, deal badges on products, and Target Circle offers. If on a PDP, reads any applicable promotions. Returns list of current deals/offers.

#### `checkStoreAvailability.js`
- **Name:** `check_store_availability`
- **Purpose:** Check if a product is available for in-store pickup or same-day delivery
- **Input:** `{ zipCode?: string }`
- **Behavior:** On a PDP, reads the fulfillment/availability section. If `zipCode` is provided, updates the store location. Returns availability info for shipping, store pickup, same-day delivery (Drive Up).

### Step 4: Implement `prompt.js`

Define `TARGET_PROMPT` with:

- **SCOPE:** Limit to Target.com shopping assistance. Reject unrelated requests.
- **AVAILABLE TOOLS:** List all 9 tools with one-line descriptions.
- **PAGE AWARENESS:** Detect whether user is on search results, a PDP, cart, or homepage. Don't re-search if already on results. On a PDP, read product details instead of asking.
- **WORKFLOW:**
  1. User asks to find a product → `search_products`
  2. Apply filters if requested → `set_filters`, `sort_results`
  3. Show results → `get_search_results`
  4. User picks a product → `get_product_details` with rank
  5. User wants to buy → select size/color if needed → `add_to_cart`
  6. Review cart → `get_cart_summary`
- **DEALS WORKFLOW:** When user asks about deals → `get_deals`, optionally filter by category.
- **AVAILABILITY RULES:** Always check `check_store_availability` before telling the user something is in stock. Don't assume availability.
- **PRICE COMPARISON:** When comparing products, call `get_product_details` on each before summarizing.

### Step 5: Implement `injector.js`

- **Page context provider:** Returns `{ currentPage, searchQuery, productName }` by inspecting the URL and DOM:
  - `/s?searchTerm=...` → search results page, extract search term
  - `/p/...` → product detail page, extract product name
  - `/cart` → cart page
  - Otherwise → homepage/browse
- **Tool registration logic:**
  - Always register: `search_products`, `get_cart_summary`
  - On search/category pages: also register `get_search_results`, `set_filters`, `sort_results`, `get_product_details`, `get_deals`
  - On PDP: also register `get_product_details`, `add_to_cart`, `check_store_availability`, `get_deals`
  - On cart page: also register `get_cart_summary`
- **SPA navigation observer:** MutationObserver + popstate listener (same pattern as Google Flights) to re-register tools when Target's SPA routing changes the URL.

### Step 6: Register in `background.js`

Add to `SITE_MODULES`:

```js
{
  id: 'target',
  defaultUrl: 'https://www.target.com',
  matches: ['https://www.target.com/*'],
  js: [
    'content/bridge.js',
    'content/helpers.js',
    'content/sites/target/helpers.js',
    'content/sites/target/tools/searchProducts.js',
    'content/sites/target/tools/getSearchResults.js',
    'content/sites/target/tools/setFilters.js',
    'content/sites/target/tools/sortResults.js',
    'content/sites/target/tools/getProductDetails.js',
    'content/sites/target/tools/addToCart.js',
    'content/sites/target/tools/getCartSummary.js',
    'content/sites/target/tools/getDeals.js',
    'content/sites/target/tools/checkStoreAvailability.js',
    'content/sites/target/prompt.js',
    'content/sites/target/injector.js'
  ]
}
```

### Step 7: Add host permissions to `manifest.json`

Add `"https://www.target.com/*"` to `host_permissions`.

### Step 8: Verify tests pass

Run `npm test`. The existing generic test suites (`siteModules.test.js`, `toolSchemas.test.js`) will automatically validate:
- Site directory structure (helpers.js, injector.js, prompt.js, tools/)
- SITE_MODULES registration (id, matches, js array order)
- All referenced JS files exist
- All tools have valid schemas (snake_case name, description, inputSchema with property descriptions, execute function)

No new test files are strictly required — the generic suites provide full structural coverage. However, a site-specific test file `tests/targetPrompt.test.js` should be added to validate that the prompt mentions all registered tools and contains required sections (similar to `tests/prompt.test.js` for Google Flights).

---

## Key Design Decisions

1. **9 tools** — enough to cover the core Target shopping experience without overloading. Additional tools (wishlists, registry, order tracking) can be added later.

2. **`data-test` selectors preferred** — Target uses `data-test` attributes on key UI elements, which are more stable than class names. Fall back to aria-labels and text matching where `data-test` isn't available.

3. **SPA-aware** — Target is a React SPA. The injector uses MutationObserver + popstate to re-register tools on navigation, identical to the Google Flights pattern.

4. **Cart operations are read-only by default** — `add_to_cart` is the only write operation. `get_cart_summary` is read-only. No "remove from cart" or "checkout" tool to avoid unintended purchases.

5. **Store availability is a separate tool** — keeping it distinct from `get_product_details` avoids coupling location-dependent data with static product info.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Target's DOM structure changes frequently | Use `data-test` attributes as primary selectors; fall back to aria-labels and text patterns. Keep selectors in helpers.js for easy updates. |
| Anti-bot measures block automated interaction | Use realistic simulated events (mousedown → mouseup → click sequence from `WebMCPHelpers.simulateClick`). Add appropriate delays between actions. |
| Product card structure varies (marketplace vs. Target-owned) | `parseTargetProductCard` should handle missing fields gracefully, returning `null` for fields not found rather than crashing. |
| Cart/checkout flows involve sensitive actions | Intentionally exclude checkout/payment tools. `add_to_cart` is the furthest the agent goes. |

---

## Implementation Order

For incremental development and testing:

1. **helpers.js + searchProducts.js + getSearchResults.js + injector.js (minimal) + prompt.js (minimal)** — get basic search working end-to-end
2. **setFilters.js + sortResults.js** — add filtering/sorting
3. **getProductDetails.js + checkStoreAvailability.js** — product detail page support
4. **addToCart.js + getCartSummary.js** — cart operations
5. **getDeals.js** — deals/promotions
6. **Polish prompt.js** with full workflows, edge cases, and page awareness rules
7. **Run tests, manual QA, iterate on selectors**
