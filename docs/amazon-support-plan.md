# Plan: Adding Amazon as a Supported Site

## Overview

Add Amazon.com product search and shopping support to the webmcp-tool-library, following the same architecture as the existing Google Flights module. This will create a new site module at `content/sites/amazon/` with tools for searching products, reading results, filtering, viewing product details, managing the cart, and comparing items.

---

## Amazon Pages & URL Patterns

| Page | URL Pattern | Description |
|------|-------------|-------------|
| Homepage | `https://www.amazon.com/` | Search bar, deals |
| Search Results | `https://www.amazon.com/s?k=*` | Product listings with filters |
| Product Detail | `https://www.amazon.com/dp/*`, `https://www.amazon.com/*/dp/*` | Single product page |
| Cart | `https://www.amazon.com/gp/cart/*` | Shopping cart |
| Best Sellers | `https://www.amazon.com/bestsellers/*` | Category best sellers |
| Deals | `https://www.amazon.com/deals*` | Today's deals |

**Match patterns for `background.js`:**
```
https://www.amazon.com/*
```

---

## Proposed Tools (10 tools)

### 1. `search_products`
**Purpose:** Navigate to Amazon search results for a query.
**Parameters:**
- `query` (string, required) — Search terms
- `category` (string, optional) — Department filter (e.g., "Electronics", "Books", "Clothing")
- `sortBy` (string, optional) — "price_low_to_high", "price_high_to_low", "avg_customer_review", "newest_arrivals", "best_sellers" (default)

**Implementation:** Construct the Amazon search URL with query parameters and navigate using `NAVIGATE_TAB`. Handle category mapping to Amazon's `i=` parameter (e.g., `i=electronics`, `i=stripbooks`).

### 2. `get_results`
**Purpose:** Read the current product listings from the search results page.
**Parameters:**
- `maxResults` (number, optional, default 10) — Maximum products to return

**Returns:** Array of products with: rank, title, price (current + original if on sale), rating (stars), reviewCount, isPrime, seller, thumbnailAlt, ASIN.

**Implementation:** Parse `.s-result-item[data-asin]` cards. Extract price from `.a-price .a-offscreen`, rating from `i.a-icon-star-small`, review count, Prime badge, etc.

### 3. `set_filters`
**Purpose:** Apply sidebar filters on the search results page.
**Parameters:**
- `minPrice` (number, optional) — Minimum price
- `maxPrice` (number, optional) — Maximum price
- `primeOnly` (boolean, optional) — Filter to Prime-eligible items
- `minRating` (number, optional) — Minimum star rating (1-4, maps to "X Stars & Up")
- `department` (string, optional) — Department/category name
- `brand` (string[], optional) — Brand names to filter by
- `condition` (string, optional) — "new", "used", "renewed"

**Implementation:** Interact with Amazon's left sidebar filters. Use `WebMCPHelpers.findByText()` and `simulateClick()` to click filter links. For price range, fill the min/max inputs and click "Go".

### 4. `get_product_details`
**Purpose:** Read detailed information about a product on its detail page, or navigate to a product from search results by rank.
**Parameters:**
- `rank` (number, optional) — Product rank from search results to navigate to
- (If no rank: reads the current product detail page)

**Returns:** Title, price, rating, reviewCount, availability, seller, description, bulletPoints[], specifications (key-value), variants (size/color options), images (alt text), ASIN.

**Implementation:** On product page, parse `#productTitle`, `#priceblock_ourprice` / `.a-price`, `#feature-bullets`, `#productDescription`, `#detailBullets_feature_div` or product info table. If `rank` is given, click the nth result card from search results to navigate.

### 5. `get_reviews`
**Purpose:** Read customer reviews for the current product.
**Parameters:**
- `sortBy` (string, optional) — "top_reviews" (default) or "most_recent"
- `filterByStars` (string, optional) — "5", "4", "3", "2", "1", "positive", "critical"
- `maxReviews` (number, optional, default 5)

**Returns:** Array of reviews with: rating, title, author, date, verifiedPurchase (bool), body, helpfulVotes.

**Implementation:** Parse `#cm_cr-review_list .review` elements. Extract star rating from the icon class, review body from `.review-text-content`, etc.

### 6. `add_to_cart`
**Purpose:** Add the currently viewed product to the cart.
**Parameters:**
- `quantity` (number, optional, default 1) — Quantity to add
- `variant` (object, optional) — Selected variant options (e.g., `{ "Size": "Large", "Color": "Blue" }`)

**Implementation:** If variant options are specified, select them from dropdowns first (`#variation_size_name select`, etc.). Set quantity dropdown. Click "Add to Cart" button (`#add-to-cart-button`). Wait for confirmation. Return success/failure with cart count.

### 7. `get_cart`
**Purpose:** View the current shopping cart contents and totals.
**Parameters:** None.

**Returns:** Array of cart items with: title, price, quantity, seller, subtotal. Plus cart summary: itemCount, subtotal.

**Implementation:** Navigate to `/gp/cart/view.html` if not already there. Parse `div[data-asin]` items within the active cart. Extract prices, quantities, and the subtotal from `#sc-subtotal-amount-activecart`.

### 8. `compare_products`
**Purpose:** Compare key attributes of products currently visible on the results page.
**Parameters:**
- `ranks` (number[], required) — Array of product ranks to compare (2-4 products)

**Returns:** Side-by-side comparison table with: title, price, rating, reviewCount, isPrime for each product.

**Implementation:** Call the internal result-parsing logic for each specified rank and format as a comparison. This is a "virtual" tool that reuses the parsing from `get_results` without navigating away.

### 9. `check_price_history`
**Purpose:** Read the current pricing information and any available deals/coupons for a product.
**Parameters:** None (operates on current product page).

**Returns:** currentPrice, listPrice, savings (amount + percentage), coupon (if clippable), dealType ("Lightning Deal", "Deal of the Day", etc.), primePrice (if different).

**Implementation:** Parse pricing section: `.a-price`, `.savingsPercentage`, `#couponBadgeRegularVpc`, deal badge elements. No external services needed — only reads what Amazon shows.

### 10. `sort_results`
**Purpose:** Change the sort order of search results.
**Parameters:**
- `sortBy` (string, required) — "featured", "price_low_to_high", "price_high_to_low", "avg_customer_review", "newest_arrivals"

**Implementation:** Click the sort dropdown (`#s-result-sort-select` or the sort button), then select the appropriate option. Wait for results to reload.

---

## File Structure

```
content/sites/amazon/
├── helpers.js              # Amazon-specific DOM helpers
├── prompt.js               # AI system prompt for Amazon shopping
├── injector.js             # Tool registration based on page state
└── tools/
    ├── searchProducts.js
    ├── getResults.js
    ├── setFilters.js
    ├── getProductDetails.js
    ├── getReviews.js
    ├── addToCart.js
    ├── getCart.js
    ├── compareProducts.js
    ├── checkPriceHistory.js
    └── sortResults.js
```

---

## Implementation Steps

### Step 1: Scaffold the site module
- Copy `content/sites/_template` to `content/sites/amazon/`
- Create the `tools/` subdirectory
- Update `manifest.json` to add `"https://www.amazon.com/*"` to `host_permissions`
- Add the Amazon entry to `SITE_MODULES` in `background.js`

### Step 2: Implement `helpers.js`
Amazon-specific DOM helper functions:
- `waitForAmazonResults(timeout)` — Wait for search results to load (poll for `.s-result-item[data-asin]`)
- `waitForProductPage(timeout)` — Wait for product detail page to load (`#productTitle` present)
- `parseAmazonProductCard(card, rank)` — Extract product data from a search result card
- `parseAmazonPrice(priceElement)` — Parse price from Amazon's split-span format (`.a-price-whole` + `.a-price-fraction`)
- `parseStarRating(element)` — Extract numeric rating from star icon class name
- `getASIN()` — Extract ASIN from current URL or page data attributes
- `selectVariant(optionName, optionValue)` — Select a product variant (size, color, etc.)

### Step 3: Implement tools (in order of dependency)

**Phase A — Core search & browse:**
1. `searchProducts.js` — Navigate to search results
2. `getResults.js` — Parse result cards (depends on helpers)
3. `sortResults.js` — Change sort order
4. `setFilters.js` — Apply sidebar filters

**Phase B — Product detail:**
5. `getProductDetails.js` — Read product detail page
6. `getReviews.js` — Read customer reviews
7. `checkPriceHistory.js` — Read pricing/deals info

**Phase C — Actions & utilities:**
8. `addToCart.js` — Add product to cart
9. `getCart.js` — View cart contents
10. `compareProducts.js` — Compare products side-by-side

### Step 4: Implement `prompt.js`
Write the `AMAZON_PROMPT` constant covering:
- **Scope:** Product search and shopping on Amazon.com only
- **Available tools:** List all 10 tools with one-line descriptions
- **Page awareness:** Detect if user is on search results, product page, or cart, and act accordingly
- **Workflow:** Typical user flows (search → filter → details → add to cart)
- **Important rules:**
  - Never auto-purchase; stop at "Add to Cart"
  - Always show prices and ratings when presenting products
  - Warn about third-party sellers vs. "Ships from Amazon"
  - Use `get_product_details` before recommending a product
  - Call `get_reviews` when user asks about quality/reliability

### Step 5: Implement `injector.js`
- Define `getAmazonPageContext()` — Return current search query, department, ASIN (if on product page)
- Set `pageContextProvider` and `sitePrompt`
- Implement `registerAmazonTools()` with page-aware logic:
  - **Search results page** (`/s?`): register search, getResults, setFilters, sortResults, compareProducts
  - **Product detail page** (`/dp/`): register getProductDetails, getReviews, addToCart, checkPriceHistory
  - **Cart page** (`/gp/cart/`): register getCart
  - **All pages**: register searchProducts (always allow new searches)
- Set up MutationObserver + popstate listener for SPA navigation detection

### Step 6: Write tests
Following the existing test patterns:
- `tests/amazon/toolSchemas.test.js` — Validate all 10 tool schemas (name format, description, inputSchema structure)
- `tests/amazon/searchProducts.test.js` — Test URL construction, category mapping
- `tests/amazon/getResults.test.js` — Test product card parsing with mock DOM
- `tests/amazon/setFilters.test.js` — Test filter interactions
- Add Amazon tools to any global tool schema validation tests

### Step 7: Manual testing & iteration
- Load extension in Chrome with Amazon permissions
- Test each tool on live Amazon pages
- Handle edge cases: out-of-stock items, sponsored results, different product layouts (books vs electronics vs clothing), international pricing
- Verify SPA navigation detection works (Amazon uses some client-side routing)

---

## Key Implementation Considerations

### DOM Stability
Amazon's DOM is complex and changes frequently. Mitigations:
- Prefer `data-asin` attribute selectors (stable product identifiers)
- Use `aria-label` and semantic selectors where possible
- Fall back to text-based matching (`WebMCPHelpers.findByText()`) for buttons/links
- Use multiple candidate strategies (like Google Flights' origin detection) for critical selectors
- Avoid class-name selectors that look obfuscated (e.g., `a-section a-spacing-none`)

### Amazon's Anti-Bot Protections
- All interactions happen in the user's real browser session with their cookies — this is NOT scraping
- Use `WebMCPHelpers.simulateClick()` for realistic mouse events
- Add reasonable delays between interactions (but not excessive — this is a real user's session)
- If CAPTCHA appears, surface it to the user as an error message

### Product Variants
Many Amazon products have variants (size, color, style). The `add_to_cart` and `get_product_details` tools must handle:
- Dropdown-based variants (`<select>` elements)
- Button/swatch-based variants (color swatches, size buttons)
- Variant price differences

### Sponsored / Ad Results
Search results include sponsored products. The parser should:
- Detect and flag sponsored results (`span.puis-label-popover-default` or "Sponsored" text)
- Include them in results but mark them as `isSponsored: true`

### Cart Interaction Safety
- The `add_to_cart` tool adds items but NEVER proceeds to checkout
- The prompt must explicitly instruct the AI to never attempt to place an order
- No tool should interact with the checkout flow

---

## Registration Changes Summary

### `manifest.json` — Add host permission:
```json
"host_permissions": [
  "https://www.google.com/travel/flights*",
  "https://www.google.com/travel/explore*",
  "https://www.amazon.com/*"
]
```

### `background.js` — Add to SITE_MODULES:
```js
{
  id: 'amazon',
  defaultUrl: 'https://www.amazon.com/',
  matches: ['https://www.amazon.com/*'],
  js: [
    'content/bridge.js',
    'content/helpers.js',
    'content/sites/amazon/helpers.js',
    'content/sites/amazon/tools/searchProducts.js',
    'content/sites/amazon/tools/getResults.js',
    'content/sites/amazon/tools/setFilters.js',
    'content/sites/amazon/tools/sortResults.js',
    'content/sites/amazon/tools/getProductDetails.js',
    'content/sites/amazon/tools/getReviews.js',
    'content/sites/amazon/tools/addToCart.js',
    'content/sites/amazon/tools/getCart.js',
    'content/sites/amazon/tools/compareProducts.js',
    'content/sites/amazon/tools/checkPriceHistory.js',
    'content/sites/amazon/prompt.js',
    'content/sites/amazon/injector.js'
  ]
}
```
