// content/sites/google-hotels/tools/getHotelDetails.js

const GetHotelDetailsTool = {
  name: 'get_hotel_details',
  description: 'Click into a hotel by rank number and read detailed information including amenities, room options, and nearby attractions.',
  inputSchema: {
    type: 'object',
    properties: {
      rank: {
        type: 'integer',
        description: '1-based rank number from get_results'
      }
    },
    required: ['rank']
  },

  execute: async (args) => {
    const { rank } = args;
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
      const hotelCards = WebMCPHelpers.findGoogleHotelCards();

      if (!rank || rank < 1 || rank > hotelCards.length) {
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

    // Find the detail panel — scoped container with tabs + "Open in new tab" link
    let detailPanel = document.body;
    const tablist = document.querySelector('[role="tablist"]');
    if (tablist) {
      let panel = tablist;
      for (let i = 0; i < 10; i++) {
        panel = panel.parentElement;
        if (!panel) break;
        if (panel.querySelector('a[aria-label*="Open"][aria-label*="in a new tab"]') &&
            panel.getBoundingClientRect().height > 400) {
          detailPanel = panel;
          break;
        }
      }
    }

    const panelText = detailPanel.textContent;
    const details = { name: hotelName };

    // Rating — look for "X.X out of 5 stars from N reviews" in aria-labels within the panel
    const ratingEl = detailPanel.querySelector('[aria-label*="out of 5 stars"]');
    if (ratingEl) {
      const ratingAria = ratingEl.getAttribute('aria-label') || '';
      const ratingMatch = ratingAria.match(/([\d.]+)\s*out of 5\s*stars?\s*(?:from\s*([\d,]+)\s*reviews?)?/i);
      if (ratingMatch) {
        details.rating = ratingMatch[1];
        if (ratingMatch[2]) details.reviewCount = ratingMatch[2];
      }
    }

    // Price — from "Visit site for" buttons' nearby price, or price button
    const visitBtn = Array.from(detailPanel.querySelectorAll('button')).find(b =>
      /^visit site for/i.test(b.getAttribute('aria-label') || '')
    );
    if (visitBtn) {
      let container = visitBtn.parentElement;
      for (let j = 0; j < 6 && container && container !== detailPanel; j++) {
        const text = container.textContent.replace(/\s+/g, ' ').trim();
        const priceMatch = text.match(/\$(\d[\d,]*)/);
        if (priceMatch && text.length < 300) {
          details.price = '$' + priceMatch[1];
          break;
        }
        container = container.parentElement;
      }
    }

    // Hotel class
    const classMatch = panelText.match(/(\d)-star\s*hotel/i);
    if (classMatch) details.hotelClass = classMatch[1] + '-star';

    // Amenities — look for amenity-related text within the detail panel only
    const amenityKeywords = ['Wi-Fi', 'Pool', 'Parking', 'Fitness', 'Spa', 'Restaurant',
      'Kitchen', 'Air conditioning', 'Breakfast', 'Pet-friendly', 'Bar', 'Room service',
      'Laundry', 'Business center', 'Concierge'];
    const foundAmenities = amenityKeywords.filter(a =>
      panelText.toLowerCase().includes(a.toLowerCase())
    );
    if (foundAmenities.length > 0) details.amenities = foundAmenities.join(', ');

    // Address — look for the directions link
    const directionsLink = detailPanel.querySelector('a[href*="maps.google.com/maps"]');
    if (directionsLink) {
      const addrMatch = (directionsLink.href || '').match(/daddr=([^&]+)/);
      if (addrMatch) details.address = decodeURIComponent(addrMatch[1]).replace(/\+/g, ' ');
    }

    // Check-in / Check-out times — look for text patterns in the About section
    const checkInMatch = panelText.match(/check.?in(?:\s*time)?[:\s]+(\d{1,2}[:\s]?\d{2}\s*(?:AM|PM)?)/i);
    const checkOutMatch = panelText.match(/check.?out(?:\s*time)?[:\s]+(\d{1,2}[:\s]?\d{2}\s*(?:AM|PM)?)/i);
    if (checkInMatch) details.checkIn = checkInMatch[1].trim();
    if (checkOutMatch) details.checkOut = checkOutMatch[1].trim();

    // Hotel website — "Visit site" link for the hotel itself (not third-party providers)
    const visitSiteLink = detailPanel.querySelector('a[aria-label*="Visit site for ' + hotelName + '"]') ||
                          detailPanel.querySelector('a[aria-label="Visit site for ' + hotelName + '"]');
    if (visitSiteLink) {
      // The href often goes through Google redirect — extract the actual URL from pcurl param
      const href = visitSiteLink.href || '';
      const pcurlMatch = href.match(/pcurl=([^&]+)/);
      if (pcurlMatch) {
        try { details.website = decodeURIComponent(pcurlMatch[1]).split('?')[0]; } catch {}
      }
      if (!details.website) {
        // Try the direct link
        const directLink = detailPanel.querySelector('a[href*="' + hotelName.split(' ')[0].toLowerCase() + '"]');
        if (directLink && !directLink.href.includes('google.com')) details.website = directLink.href;
      }
    }

    // Free cancellation available?
    if (/free cancellation/i.test(panelText)) details.freeCancel = true;

    // Deal badge — use word boundary to avoid matching price+percentage (e.g. "$2924%")
    const dealMatch = panelText.match(/(GREAT DEAL|GOOD DEAL|DEAL\b)/i);
    const pctMatch = panelText.match(/\b(\d{1,2}%\s*less than usual)/i);
    if (dealMatch && pctMatch) {
      details.deal = `${dealMatch[0]} — ${pctMatch[1]}`;
    } else if (dealMatch) {
      details.deal = dealMatch[0];
    } else if (pctMatch) {
      details.deal = pctMatch[1];
    }

    const lines = [`**${details.name}**`];
    if (details.hotelClass) lines.push(`Class: ${details.hotelClass}`);
    if (details.rating) lines.push(`Rating: ${details.rating}/5${details.reviewCount ? ` (${details.reviewCount} reviews)` : ''}`);
    if (details.price) lines.push(`Starting price: ${details.price}`);
    if (details.deal) lines.push(`Deal: ${details.deal}`);
    if (details.address) lines.push(`Address: ${details.address}`);
    if (details.checkIn || details.checkOut) {
      const times = [];
      if (details.checkIn) times.push(`Check-in: ${details.checkIn}`);
      if (details.checkOut) times.push(`Check-out: ${details.checkOut}`);
      lines.push(times.join(' | '));
    }
    if (details.freeCancel) lines.push('Free cancellation available');
    if (details.amenities) lines.push(`Amenities: ${details.amenities}`);
    if (details.website) lines.push(`Website: ${details.website}`);

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
};
