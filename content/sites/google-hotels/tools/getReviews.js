// content/sites/google-hotels/tools/getReviews.js

const GetReviewsTool = {
  name: 'get_reviews',
  description: 'Read reviews for a hotel from the Google Hotels detail page. Returns overall rating, category ratings (Rooms, Service, Location, etc.), and recent review snippets.',
  inputSchema: {
    type: 'object',
    properties: {
      rank: {
        type: 'integer',
        description: '1-based rank from get_results. Omit if already on a hotel detail page.'
      },
      maxReviews: {
        type: 'integer',
        description: 'Maximum number of review snippets to return. Defaults to 5.'
      }
    }
  },

  execute: async (args) => {
    const { rank, maxReviews = 5 } = args;
    const url = window.location.href;
    if (!url.includes('/travel/search') && !url.includes('/travel/hotels')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Hotels.' }] };
    }

    // Check if we're already on a hotel detail page (has Overview/Prices/Reviews tabs)
    const isDetailPage = !!document.querySelector('[role="tab"]') &&
      Array.from(document.querySelectorAll('[role="tab"]')).some(t => /overview|prices|reviews/i.test(t.textContent));

    let hotelName = 'Unknown Hotel';

    if (!isDetailPage) {
      // Need to click into a hotel from the results list
      if (!rank) {
        return { content: [{ type: 'text', text: 'ERROR: Not on a hotel detail page and no rank provided. Provide a rank to click into a hotel, or navigate to a hotel detail page first.' }] };
      }

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
    } else {
      // Already on detail page — extract name from "Open X in a new tab" link or page title
      const openLink = document.querySelector('a[aria-label*="Open"][aria-label*="in a new tab"]');
      if (openLink) {
        hotelName = (openLink.getAttribute('aria-label') || '')
          .replace(/^Open\s+/i, '').replace(/\s+in a new tab\.?$/i, '').trim();
      } else {
        hotelName = document.title.replace(/\s*-\s*Google hotels?$/i, '').trim();
      }
    }

    // Click the "Reviews" tab
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const reviewsTab = tabs.find(t => /reviews/i.test(t.textContent));

    if (!reviewsTab) {
      return { content: [{ type: 'text', text: `ERROR: Could not find a "Reviews" tab on the detail page for ${hotelName}. The hotel may not have reviews.` }] };
    }

    WebMCPHelpers.simulateClick(reviewsTab);
    await WebMCPHelpers.sleep(1000);

    // Wait for review content to load
    let reviewLoadAttempts = 0;
    while (reviewLoadAttempts < 15) {
      const hasReviewContent =
        !!document.querySelector('[aria-label*="out of 5 stars"]') ||
        /review/i.test(document.body.textContent);
      if (hasReviewContent) break;
      await WebMCPHelpers.sleep(200);
      reviewLoadAttempts++;
    }

    // Locate the review section via text content
    const bodyText = document.body.textContent;
    const summaryIdx = bodyText.indexOf('Google review summary');
    const thirdPartyIdx = bodyText.indexOf('Reviews on other travel sites');
    const photosIdx = bodyText.indexOf('PhotosExterior');

    const lines = [`**Reviews for ${hotelName}**`];

    // Overall rating — extract from the review summary section
    if (summaryIdx !== -1) {
      const reviewSection = bodyText.substring(
        summaryIdx,
        thirdPartyIdx !== -1 ? thirdPartyIdx : (photosIdx !== -1 ? photosIdx : summaryIdx + 1500)
      );

      // Overall rating: "3.4 93 reviews" pattern after star distribution
      const overallMatch = reviewSection.match(/(\d\.\d)\s*(\d[\d,]*)\s*reviews?/i);
      if (overallMatch) {
        lines.push(`Overall rating: ${overallMatch[1]}/5 (${overallMatch[2]} reviews)`);
      }

      // Review topics/categories: "Sleep (8)", "Location (11)", etc.
      const categoryPattern = /(Sleep|Bathroom|Location|Kitchen|Transit|Cleanliness|Service|Property|Rooms|Amenities|Food|Value|Comfort)\s*\((\d+)\)/gi;
      const categories = [];
      const seenCats = new Set();
      let m;
      while ((m = categoryPattern.exec(reviewSection)) !== null) {
        const cat = m[1];
        if (!seenCats.has(cat.toLowerCase())) {
          seenCats.add(cat.toLowerCase());
          categories.push(`${cat} (${m[2]} mentions)`);
        }
      }
      if (categories.length > 0) {
        lines.push('');
        lines.push('Review topics:');
        categories.forEach(c => lines.push(`  ${c}`));
      }

      // Quoted reviews: Author"review text" pattern
      const quoteRegex = /[""\u201C]([^""\u201C\u201D]{20,300})[""\u201D]/g;
      const quotes = [];
      while ((m = quoteRegex.exec(reviewSection)) !== null && quotes.length < maxReviews) {
        quotes.push(m[1]);
      }

      // Try to extract author names (appear right before the quotes)
      // Pattern: "AuthorName" followed by quote
      const authorQuoteRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)?)[""\u201C]([^""\u201C\u201D]{20,300})[""\u201D]/g;
      const authoredQuotes = [];
      while ((m = authorQuoteRegex.exec(reviewSection)) !== null && authoredQuotes.length < maxReviews) {
        // Filter out non-name matches
        const name = m[1].trim();
        if (!/^(Search|Write|Learn|View|Star)/i.test(name)) {
          authoredQuotes.push({ author: name, text: m[2] });
        }
      }

      if (authoredQuotes.length > 0) {
        lines.push('');
        lines.push(`Google reviews (${authoredQuotes.length}):`);
        authoredQuotes.forEach((q, i) => {
          lines.push(`  ${i + 1}. ${q.author}: "${q.text}"`);
        });
      } else if (quotes.length > 0) {
        lines.push('');
        lines.push(`Google reviews (${quotes.length}):`);
        quotes.forEach((q, i) => {
          lines.push(`  ${i + 1}. "${q}"`);
        });
      }
    }

    // Third-party reviews
    if (thirdPartyIdx !== -1) {
      const endIdx = photosIdx !== -1 ? photosIdx : thirdPartyIdx + 500;
      const thirdPartySection = bodyText.substring(thirdPartyIdx, endIdx);

      // Extract site name, rating, count: "Trip.com4.3/5 · 116 reviews"
      // Use a non-greedy approach — match known site domains or capitalized words before the rating
      const tpRegex = /([A-Z][\w]*(?:\.com|\.org|\.net|\.co\.[\w]+))\s*(\d\.\d)\/5\s*·?\s*(\d[\d,]*)\s*reviews?/gi;
      const tpReviews = [];
      let tpm;
      while ((tpm = tpRegex.exec(thirdPartySection)) !== null) {
        tpReviews.push(`${tpm[1]}: ${tpm[2]}/5 (${tpm[3]} reviews)`);
      }

      if (tpReviews.length > 0) {
        lines.push('');
        lines.push('Third-party reviews:');
        tpReviews.forEach(r => lines.push(`  ${r}`));
      }
    }

    if (lines.length === 1) {
      lines.push('No reviews found. The hotel may not have reviews, or the review section may not have loaded.');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
