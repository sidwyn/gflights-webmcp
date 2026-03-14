// content/sites/google-hotels/helpers.js — Google Hotels-specific DOM utilities
// Extends WebMCPHelpers (loaded from content/helpers.js)

/**
 * Wait for Google Hotels results to appear on the page.
 */
WebMCPHelpers.waitForGoogleHotelsResults = async function(timeout = 15000) {
  const start = Date.now();

  function hasResults() {
    return document.querySelectorAll('button[aria-label*="Save"][aria-label*="to collection"]').length > 0;
  }

  if (hasResults()) return true;

  await WebMCPHelpers.sleep(500);
  if (hasResults()) return true;

  try {
    await WebMCPHelpers.waitForElementToDisappear('[role="progressbar"]', Math.min(5000, timeout));
  } catch { /* may not be present */ }

  return new Promise(resolve => {
    const check = () => {
      if (hasResults()) { resolve(true); return; }
      if (Date.now() - start > timeout) { resolve(false); return; }
      setTimeout(check, 200);
    };
    check();
  });
};

/**
 * Find all hotel cards on the page.
 * Each hotel is identified by its "Save X to collection" button.
 * Returns an array of { name, saveBtn, container } objects.
 */
WebMCPHelpers.findGoogleHotelCards = function() {
  const saveButtons = Array.from(
    document.querySelectorAll('button[aria-label*="Save"][aria-label*="to collection"]')
  ).filter(btn => btn.offsetHeight > 0 && btn.offsetWidth > 0);

  return saveButtons.map(btn => {
    const label = btn.getAttribute('aria-label') || '';
    const name = label.replace(/^Save\s+/i, '').replace(/\s+to collection$/i, '').trim();

    // Walk up to find the hotel card container
    let container = btn.parentElement;
    for (let i = 0; i < 10 && container && container !== document.body; i++) {
      const links = container.querySelectorAll('a[href*="/travel/search"]');
      if (links.length >= 3) break;
      container = container.parentElement;
    }

    return { name, saveBtn: btn, container: container || btn.parentElement };
  });
};

/**
 * Parse a Google Hotels card container into structured data.
 * Uses aria-labels on links which have clean, structured text.
 */
WebMCPHelpers.parseGoogleHotelCard = function(hotelCard, rank) {
  const { name, container } = hotelCard;
  const result = { rank, name };

  const links = Array.from(container.querySelectorAll('a[href*="/travel/search"]'));

  for (const link of links) {
    const aria = link.getAttribute('aria-label') || '';

    // Price link: "Prices starting from $XX, Hotel Name [DEAL text]"
    if (/prices starting from/i.test(aria)) {
      const priceMatch = aria.match(/\$([\d,]+)/);
      if (priceMatch) result.price = '$' + priceMatch[1].replace(/,$/, '');

      const dealMatch = aria.match(/(DEAL\s+\d+%\s*less than usual|\d+%\s*less than usual|GREAT DEAL|GOOD DEAL)/i);
      if (dealMatch) result.deal = dealMatch[0];
    }

    // Rating link: "X out of 5 stars from N reviews, Hotel Name"
    if (/out of 5 stars/i.test(aria)) {
      const ratingMatch = aria.match(/([\d.]+)\s*out of 5\s*stars?\s*(?:from\s*([\d,]+)\s*reviews?)?/i);
      if (ratingMatch) {
        result.rating = ratingMatch[1];
        if (ratingMatch[2]) result.reviewCount = ratingMatch[2].replace(/,/g, '');
      }
    }
  }

  return result;
};
