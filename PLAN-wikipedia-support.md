# Plan: Add Wikipedia as a Supported Site

## Overview

Add Wikipedia (`en.wikipedia.org`) as a new supported site in the WebMCP tool library. This will give the AI agent the ability to search Wikipedia, read article content, navigate between articles, extract structured data (infoboxes, sections), and interact with Wikipedia's UI — all through DOM-based tools injected as content scripts.

---

## Architecture Summary

The existing pattern (demonstrated by `google-flights`) requires:

1. **`background.js`** — Add a new entry to `SITE_MODULES[]` with URL match patterns and JS file list
2. **`manifest.json`** — Add Wikipedia `host_permissions`
3. **`content/sites/wikipedia/`** — New folder with site-specific files:
   - `prompt.js` — System prompt describing Wikipedia tools and workflows
   - `helpers.js` — Wikipedia-specific DOM utilities extending `WebMCPHelpers`
   - `injector.js` — Tool registration logic based on current page type
   - `tools/*.js` — Individual tool files (one per tool)
4. **Tests** — Update `tests/manifest.test.js` for new host permissions

---

## Step 1: Update `manifest.json`

Add Wikipedia host permissions:

```json
"host_permissions": [
  "https://www.google.com/travel/flights*",
  "https://www.google.com/travel/explore*",
  "https://en.wikipedia.org/*"
]
```

**File:** `manifest.json`

---

## Step 2: Register the site module in `background.js`

Add a new entry to `SITE_MODULES`:

```js
{
  id: 'wikipedia',
  defaultUrl: 'https://en.wikipedia.org/',
  matches: ['https://en.wikipedia.org/*'],
  js: [
    'content/bridge.js',
    'content/helpers.js',
    'content/sites/wikipedia/helpers.js',
    'content/sites/wikipedia/tools/searchWikipedia.js',
    'content/sites/wikipedia/tools/getArticleContent.js',
    'content/sites/wikipedia/tools/getArticleSummary.js',
    'content/sites/wikipedia/tools/getTableOfContents.js',
    'content/sites/wikipedia/tools/getInfobox.js',
    'content/sites/wikipedia/tools/navigateToArticle.js',
    'content/sites/wikipedia/prompt.js',
    'content/sites/wikipedia/injector.js'
  ]
}
```

**File:** `background.js`

---

## Step 3: Create `content/sites/wikipedia/helpers.js`

Wikipedia-specific DOM utilities extending `WebMCPHelpers`. Key helpers:

- **`WebMCPHelpers.waitForWikipediaContent(timeout)`** — Wait for `#mw-content-text` to be populated (handles slow loads / SPA-style nav if using the Vector 2022 skin)
- **`WebMCPHelpers.getArticleTitle()`** — Extract the current article title from `#firstHeading` or `<h1>`
- **`WebMCPHelpers.parseInfobox()`** — Parse the infobox (`.infobox`) into key-value pairs
- **`WebMCPHelpers.parseSections()`** — Walk `#mw-content-text` headings (`h2`, `h3`) and return a structured section tree
- **`WebMCPHelpers.cleanWikiText(element)`** — Strip citations (`[1]`, `[2]`), edit links, and hidden elements from a DOM subtree, returning clean text
- **`WebMCPHelpers.getPageType()`** — Detect whether the current page is an article, search results, disambiguation, category, or special page

**File:** `content/sites/wikipedia/helpers.js`

---

## Step 4: Create tool files under `content/sites/wikipedia/tools/`

### 4a. `searchWikipedia.js` — `search_wikipedia`

Search Wikipedia for articles matching a query.

- **Input:** `{ query: string, maxResults?: integer }`
- **Behavior:** Types the query into Wikipedia's search box (`#searchInput` or `input[name="search"]`), submits, waits for results, and scrapes the search results page. Returns article titles, snippets, and URLs.
- **Fallback:** If already on a search results page, just reads the current results.

### 4b. `getArticleContent.js` — `get_article_content`

Read the full text content of the current Wikipedia article.

- **Input:** `{ section?: string, maxLength?: integer }`
- **Behavior:** Extracts text from `#mw-content-text`. If `section` is specified, only returns that section's content. Strips citations, edit links, and other noise using `cleanWikiText`. Truncates to `maxLength` (default ~4000 chars) to stay within reasonable token limits.
- **Returns:** Article title, content text, and list of sections available.

### 4c. `getArticleSummary.js` — `get_article_summary`

Get a concise summary (lead section) of the current article.

- **Input:** `{}`  (no required args)
- **Behavior:** Extracts paragraphs before the first `h2` in `#mw-content-text`. Returns the first 2-3 paragraphs as the summary.
- **Returns:** Article title and summary text.

### 4d. `getTableOfContents.js` — `get_table_of_contents`

List all sections/subsections in the current article.

- **Input:** `{}`
- **Behavior:** Reads the TOC element (`#toc` or `.toc`) or walks headings to build a numbered section list with hierarchy.
- **Returns:** Structured list of sections with heading level and anchor IDs.

### 4e. `getInfobox.js` — `get_infobox`

Extract structured data from a Wikipedia infobox.

- **Input:** `{}`
- **Behavior:** Finds `.infobox` table, parses `<tr>` rows into key-value pairs (label from `<th>`, value from `<td>`). Also extracts the infobox image URL if present.
- **Returns:** Infobox data as key-value pairs, or a message if no infobox exists.

### 4f. `navigateToArticle.js` — `navigate_to_article`

Navigate directly to a Wikipedia article by title.

- **Input:** `{ title: string }`
- **Behavior:** Constructs `https://en.wikipedia.org/wiki/{title}` (with proper URL encoding) and navigates. Uses `setTimeout` before navigation (same pattern as Google Flights `searchFlights.js`) to ensure the response is sent first.
- **Returns:** Confirmation message. Caller should follow up with `get_article_summary` or `get_article_content`.

**Files:** `content/sites/wikipedia/tools/*.js` (6 files)

---

## Step 5: Create `content/sites/wikipedia/prompt.js`

System prompt fragment (`WIKIPEDIA_PROMPT`) that describes:

- **Scope:** The AI helps users research topics on Wikipedia — searching, reading articles, extracting structured data, and navigating between related articles.
- **Available tools:** List all 6 tools with short descriptions.
- **Page awareness:** If already on an article page, don't ask "what do you want to search?" — read the current article instead.
- **Workflow guidance:**
  1. User asks about a topic → `search_wikipedia` or `navigate_to_article`
  2. Read overview → `get_article_summary`
  3. Deep dive → `get_table_of_contents` then `get_article_content` with specific section
  4. Structured data → `get_infobox`
  5. Follow links → `navigate_to_article` to related articles
- **Constraints:** Wikipedia is read-only; tools cannot edit articles. The AI should cite section headings when referencing specific content.

**File:** `content/sites/wikipedia/prompt.js`

---

## Step 6: Create `content/sites/wikipedia/injector.js`

Handles:

- Setting `window.__webmcpRegistry.pageContextProvider` to return `{ articleTitle, pageType }` (article, search, disambiguation, etc.)
- Setting `window.__webmcpRegistry.sitePrompt` from `WIKIPEDIA_PROMPT`
- Registering tools based on page type:
  - **Always available:** `search_wikipedia`, `navigate_to_article`
  - **On article pages:** `get_article_content`, `get_article_summary`, `get_table_of_contents`, `get_infobox`
  - **On search results pages:** `search_wikipedia` (to read current results)
- SPA navigation observer (Wikipedia's Vector 2022 skin can do partial page loads via `mw.loader`)

**File:** `content/sites/wikipedia/injector.js`

---

## Step 7: Update tests

Update `tests/manifest.test.js`:

- Add `'https://en.wikipedia.org/*'` to the expected `host_permissions` assertion.

**File:** `tests/manifest.test.js`

---

## File Summary

| Action | File |
|--------|------|
| Edit | `manifest.json` |
| Edit | `background.js` |
| Create | `content/sites/wikipedia/helpers.js` |
| Create | `content/sites/wikipedia/tools/searchWikipedia.js` |
| Create | `content/sites/wikipedia/tools/getArticleContent.js` |
| Create | `content/sites/wikipedia/tools/getArticleSummary.js` |
| Create | `content/sites/wikipedia/tools/getTableOfContents.js` |
| Create | `content/sites/wikipedia/tools/getInfobox.js` |
| Create | `content/sites/wikipedia/tools/navigateToArticle.js` |
| Create | `content/sites/wikipedia/prompt.js` |
| Create | `content/sites/wikipedia/injector.js` |
| Edit | `tests/manifest.test.js` |

**Total: 3 edits + 9 new files**

---

## Implementation Order

1. `manifest.json` + `background.js` (config/registration)
2. `content/sites/wikipedia/helpers.js` (shared utilities needed by tools)
3. All 6 tool files (can be done in parallel — they're independent)
4. `content/sites/wikipedia/prompt.js` (references tool names)
5. `content/sites/wikipedia/injector.js` (references prompt + all tools)
6. `tests/manifest.test.js` (verify)
7. Run `npx vitest` to confirm tests pass
