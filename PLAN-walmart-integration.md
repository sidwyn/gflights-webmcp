# Plan: Add Walmart as a Supported Site

## Overview

Add a `walmart` site module to webmcp-tool-library, following the same architecture as the existing `google-flights` module. This enables AI agents to help users search products, read details, compare prices, manage their cart, and find deals on walmart.com.

---

## Scope

**Target URL patterns:**
- `https://www.walmart.com/*`

**Key Walmart pages and their capabilities:**
| Page | URL Pattern | Tools Available |
|------|-------------|-----------------|
| Homepage | `/` | search_products |
| Search results | `/search?q=...` | search_products, get_results, set_filters, sort_results |
| Product detail | `/ip/...` | search_products, get_product_details, add_to_cart |
| Category browse | `/browse/...` or `/cp/...` | search_products, get_results, set_filters, sort_results |
| Cart | `/cart` | search_products, get_cart |

---

## Files to Create

### 1. `content/sites/walmart/helpers.js` — Walmart-specific DOM utilities

Extend `WebMCPHelpers` with Walmart-specific functions:

- **`WebMCPHelpers.waitForWalmartResults(timeout)`** — Poll for search result cards to appear. Walmart uses `[data-testid="list-view"]` containers or product grid items. Wait for loading spinners (`[data-testid="loading-indicator"]`, `[aria-label*="Loading"]`) to disappear, then confirm product cards are present.

- **`WebMCPHelpers.parseWalmartProductCard(card, rank)`** — Parse a search result card into structured data: `{ rank, title, price, originalPrice, rating, reviewCount, seller, fulfillment, outOfStock }`. Walmart's DOM uses data-testid attributes extensively (e.g., `[data-testid="list-view"]`), making selectors more stable than Google Flights' obfuscated classes. Include fallback heuristic parsing (price via `$` pattern, rating via star elements) in case testid attributes change.

- **`WebMCPHelpers.parseWalmartProductDetail()`** — Parse the current product detail page: title, price, rating, review count, availability, seller, fulfillment options (shipping/pickup/delivery), product highlights, and specifications.

- **`WebMCPHelpers.simulateWalmartSearch(query)`** — Type into Walmart's search bar (`#headerSearchInput` or `input[aria-label="Search"]`), submit the form, and wait for results to load.

### 2. `content/sites/walmart/tools/` — Tool files (one per file)

#### a. `searchProducts.js` — `SearchProductsTool`
- **name:** `search_products`
- **description:** Search for products on Walmart by keyword. Navigates to search results page.
- **params:** `query` (string, required), `sort` (string, optional — "best_match", "price_low", "price_high", "best_seller", "rating_high", "new")
- **execute:** Build URL `https://www.walmart.com/search?q={query}&sort={sort}`, navigate via `setTimeout(() => window.location.href = url, 50)`. Return confirmation text telling the AI to call `get_results` next.

#### b. `getResults.js` — `GetResultsTool`
- **name:** `get_results`
- **description:** Read the current product listings from a Walmart search results or category page.
- **params:** `maxResults` (integer, optional, default 5)
- **execute:** Wait for results with `WebMCPHelpers.waitForWalmartResults()`. Find product cards via `[data-testid="list-view"]` items or grid items. Parse each with `WebMCPHelpers.parseWalmartProductCard()`. Return formatted text with rank, title, price, rating, seller, fulfillment info.

#### c. `setFilters.js` — `SetFiltersTool`
- **name:** `set_filters`
- **description:** Apply filters to Walmart search results (price range, brand, availability, fulfillment, customer rating, special offers).
- **params:** `priceMin` (number), `priceMax` (number), `brand` (string), `fulfillment` (enum: "shipping", "pickup", "delivery"), `rating` (integer, 1-5 minimum stars), `specialOffers` (enum: "rollback", "clearance", "reduced_price")
- **execute:** Interact with Walmart's filter sidebar. Find filter sections by heading text (e.g., "Price", "Brand"), click checkboxes/buttons, or set price range inputs. Walmart filters update results via SPA navigation, so wait for results to reload after applying.

#### d. `sortResults.js` — `SortResultsTool`
- **name:** `sort_results`
- **description:** Sort Walmart search results by a given criterion.
- **params:** `sortBy` (string, required, enum: "best_match", "price_low", "price_high", "best_seller", "rating_high", "new")
- **execute:** Click the sort dropdown (`[data-testid="sort-dropdown"]` or button with "Sort by" text), then select the matching option. Wait for results to refresh.

#### e. `getProductDetails.js` — `GetProductDetailsTool`
- **name:** `get_product_details`
- **description:** Get detailed information about a product. Can be called on a product detail page, or with a rank number from search results to navigate to that product.
- **params:** `rank` (integer, optional — the result rank to click into)
- **execute:** If `rank` is given, click the nth product card to navigate. On the detail page, use `WebMCPHelpers.parseWalmartProductDetail()` to extract: title, price, original price (if on sale), rating, review count, availability, seller (Walmart vs third-party), fulfillment options, product highlights, key specifications.

#### f. `addToCart.js` — `AddToCartTool`
- **name:** `add_to_cart`
- **description:** Add the current product to the Walmart cart. Must be on a product detail page.
- **params:** `quantity` (integer, optional, default 1)
- **execute:** Verify on a product page (`/ip/` URL). If quantity > 1, update the quantity selector first. Click the "Add to cart" button (`[data-testid="add-to-cart-btn"]` or button containing "Add to cart" text). Wait for cart confirmation flyout/modal. Return success message with product name and price.

#### g. `getCart.js` — `GetCartTool`
- **name:** `get_cart`
- **description:** View the current Walmart cart contents with items, quantities, and total.
- **params:** none
- **execute:** Navigate to `/cart` if not already there. Parse cart items: name, price, quantity, seller. Parse cart summary: subtotal, estimated tax, estimated total. Return formatted summary.

### 3. `content/sites/walmart/prompt.js` — AI system prompt

Define `WALMART_PROMPT` constant with:

```
SCOPE: You ONLY support product search and shopping on Walmart.com. If the user asks
about services not available on Walmart (e.g., flight booking, hotel reservations),
respond: "I only support shopping on Walmart — I can't help with [topic]."

AVAILABLE TOOLS:
- search_products: Search for products by keyword
- get_results: Read current product listings from search results
- set_filters: Filter by price, brand, fulfillment, rating, special offers
- sort_results: Sort results (best match, price, best seller, rating, newest)
- get_product_details: View detailed product info (on detail page or by rank from results)
- add_to_cart: Add a product to cart (must be on product detail page)
- get_cart: View current cart contents and total

PAGE AWARENESS:
- If on a search results page (/search?q=...), call get_results immediately
- If on a product page (/ip/...), call get_product_details immediately
- If on the cart page (/cart), call get_cart immediately
- Do NOT re-search if already on results for the same query

WORKFLOW:
1. User asks to find a product → call search_products
2. Call get_results to show listings
3. If user wants filters → set_filters; for sorting → sort_results
4. If user wants details on a product → get_product_details with rank
5. If user wants to buy → add_to_cart
6. To review cart → get_cart

PRICE DISPLAY:
- Always show prices clearly with $ symbol
- If an item is on sale, show both original and sale price
- Note seller (Walmart vs third-party) when relevant
- Mention fulfillment options (shipping, pickup, delivery) when available

IMPORTANT:
- Never fabricate product information — only report what tools return
- One search at a time
- Present results as a clean markdown table
- Do NOT show raw JSON or tool names in responses
```

### 4. `content/sites/walmart/injector.js` — Tool registration

- **`getWalmartPageContext()`**: Detect current page type and return context:
  - Extract current search query from URL params or search input
  - Detect if user is logged in (account menu state)
  - Detect store location if shown (for pickup availability)

- **`registerWalmartTools()`**: Conditionally register tools based on URL:
  - **Always:** `SearchProductsTool`, `GetCartTool`
  - **Search results / Category pages** (`/search`, `/browse`, `/cp`): + `GetResultsTool`, `SetFiltersTool`, `SortResultsTool`, `GetProductDetailsTool`
  - **Product detail** (`/ip/`): + `GetProductDetailsTool`, `AddToCartTool`
  - **Cart** (`/cart`): + `GetCartTool`

- **SPA navigation observer**: `MutationObserver` + `popstate` listener to re-register tools on client-side navigation.

---

## Files to Modify

### 5. `background.js` — Add Walmart to SITE_MODULES

Add a new entry to the `SITE_MODULES` array:

```js
{
  id: 'walmart',
  defaultUrl: 'https://www.walmart.com',
  matches: ['https://www.walmart.com/*'],
  js: [
    'content/bridge.js',
    'content/helpers.js',
    'content/sites/walmart/helpers.js',
    'content/sites/walmart/tools/searchProducts.js',
    'content/sites/walmart/tools/getResults.js',
    'content/sites/walmart/tools/setFilters.js',
    'content/sites/walmart/tools/sortResults.js',
    'content/sites/walmart/tools/getProductDetails.js',
    'content/sites/walmart/tools/addToCart.js',
    'content/sites/walmart/tools/getCart.js',
    'content/sites/walmart/prompt.js',
    'content/sites/walmart/injector.js'
  ]
}
```

### 6. `manifest.json` — Add host permissions

Add to `host_permissions`:
```json
"https://www.walmart.com/*"
```

---

## Tests

### 7. Existing tests that will auto-cover Walmart

The test suite is designed to auto-discover site modules:

- **`tests/siteModules.test.js`** — Automatically discovers all folders under `content/sites/` (excluding `_template`) and validates:
  - Has `injector.js`, `helpers.js`, `prompt.js`
  - Has `tools/` directory with at least one tool
  - `SITE_MODULES` entry has `id`, `matches`, `js` array
  - JS array starts with `bridge.js` + `helpers.js`, ends with `injector.js`
  - All referenced JS files exist on disk

- **`tests/toolSchemas.test.js`** — Currently hardcoded to `google-flights/tools`. Needs updating (see below).

### 8. New/modified test files

- **Update `tests/toolSchemas.test.js`** — Generalize to scan all site modules' tool directories (not just `google-flights`). This ensures every Walmart tool is validated for: snake_case name, description > 10 chars, inputSchema with type "object", execute function, descriptions on all properties, required fields exist in properties.

- **Create `tests/walmart/searchProducts.test.js`** — Unit tests for `SearchProductsTool`:
  - Validates query is required
  - Validates sort enum values
  - Returns correct navigation URL

- **Create `tests/walmart/helpers.test.js`** — Unit tests for Walmart-specific helpers:
  - `parseWalmartProductCard` extracts fields correctly from mock DOM
  - `parseWalmartProductDetail` handles missing elements gracefully

---

## Implementation Order

| Step | Files | Description |
|------|-------|-------------|
| 1 | `content/sites/walmart/helpers.js` | Walmart DOM utilities — foundation for all tools |
| 2 | `content/sites/walmart/tools/searchProducts.js` | Search tool — entry point for most workflows |
| 3 | `content/sites/walmart/tools/getResults.js` | Results parser — core value of the module |
| 4 | `content/sites/walmart/tools/getProductDetails.js` | Product detail parser |
| 5 | `content/sites/walmart/tools/setFilters.js` | Filter interaction |
| 6 | `content/sites/walmart/tools/sortResults.js` | Sort interaction |
| 7 | `content/sites/walmart/tools/addToCart.js` | Cart add action |
| 8 | `content/sites/walmart/tools/getCart.js` | Cart reader |
| 9 | `content/sites/walmart/prompt.js` | AI instructions |
| 10 | `content/sites/walmart/injector.js` | Registration + SPA navigation |
| 11 | `background.js` | Add SITE_MODULES entry |
| 12 | `manifest.json` | Add host_permissions |
| 13 | `tests/toolSchemas.test.js` | Generalize for multi-site |
| 14 | `tests/walmart/*.test.js` | Walmart-specific tests |
| 15 | Run `npm test` | Verify all tests pass |

---

## DOM Strategy Notes

Walmart's DOM is more stable than Google Flights due to use of `data-testid` attributes. Key selectors to investigate during implementation:

- **Search input:** `#headerSearchInput`, `input[aria-label="Search"]`
- **Product cards:** `[data-testid="list-view"]`, `[data-item-id]`
- **Price:** `[data-automation-id="product-price"]`, `[itemprop="price"]`
- **Rating:** `[data-testid="product-ratings"]`, stars SVG pattern
- **Add to cart:** `[data-testid="add-to-cart-btn"]`, button text "Add to cart"
- **Filters:** Sidebar with faceted navigation, checkboxes for brand/fulfillment
- **Sort:** Dropdown labeled "Sort by"

**Fallback strategy:** Like Google Flights, include heuristic fallbacks that use text patterns (`$XX.XX` for price, star patterns for rating) in case `data-testid` attributes change across Walmart deployments.

---

## Risks & Considerations

1. **Walmart's anti-bot measures**: Walmart may detect automated DOM interactions. Tools should use realistic timing delays (similar to Google Flights' approach with `sleep()` between actions).

2. **Dynamic pricing / location-based content**: Product availability and prices vary by store/zip code. The `pageContextProvider` should detect and report the current store context so the AI doesn't make incorrect claims.

3. **Login-gated features**: Adding to cart may require login. Tools should detect the login prompt and return a clear message asking the user to log in rather than failing silently.

4. **Walmart+ pricing**: Some items show Walmart+ member pricing. The parser should distinguish between regular and member prices.

5. **Third-party sellers**: Walmart Marketplace items have different seller info. Product detail parsing should capture seller name and distinguish Walmart-fulfilled vs seller-fulfilled items.
