// content/sites/google-hotels/tools/setFilters.js

const SetHotelFiltersTool = {
  name: 'set_filters',
  description: 'Apply filters to Google Hotels results. Supports: max price, guest rating, hotel class, amenities, free cancellation, eco-certified, brands, and property type.',
  inputSchema: {
    type: 'object',
    properties: {
      maxPrice: {
        type: 'integer',
        description: 'Maximum price per night in USD'
      },
      minRating: {
        type: 'number',
        description: 'Minimum guest rating (e.g., 3.5, 4.0, 4.5)'
      },
      hotelClass: {
        type: 'string',
        enum: ['2_star', '3_star', '4_star', '5_star'],
        description: 'Minimum hotel star class'
      },
      amenities: {
        type: 'string',
        description: 'Comma-separated amenities to filter by (e.g., "pool, fitness, spa, parking, wifi, restaurant, kitchen, breakfast, pet friendly, bar, room service, laundry, air conditioning")'
      },
      freeCancel: {
        type: 'boolean',
        description: 'Only show hotels with free cancellation'
      },
      ecoCertified: {
        type: 'boolean',
        description: 'Only show eco-certified hotels'
      },
      brands: {
        type: 'string',
        description: 'Comma-separated brand names (e.g., "Hilton, Marriott, Hyatt, IHG")'
      },
      propertyType: {
        type: 'string',
        description: 'Property type filter (e.g., "hotel", "vacation rental", "hostel", "motel", "resort")'
      }
    }
  },

  execute: async (args) => {
    const url = window.location.href;
    if (!url.includes('/travel/search') && !url.includes('/travel/hotels')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Hotels.' }] };
    }

    const actions = [];

    // Helper: open a filter panel by clicking its button
    async function openFilter(labels) {
      for (const label of labels) {
        const btn = WebMCPHelpers.findByText(label, 'button') ||
                    WebMCPHelpers.findByAriaLabel(label);
        if (btn) {
          WebMCPHelpers.simulateClick(btn);
          await WebMCPHelpers.sleep(200);
          return true;
        }
      }
      return false;
    }

    // Helper: close open panel
    async function closePanel() {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await WebMCPHelpers.sleep(50);
    }

    // ── Max price ─────────────────────────────────────────────────────────────
    if (args.maxPrice) {
      // Look for price filter — button text includes "Price" or "Under $XX"
      const opened = await openFilter(['Price', 'Under $', 'Price filter']);
      if (opened) {
        await WebMCPHelpers.sleep(150);
        const sliders = document.querySelectorAll('input[type="range"]');
        const slider = sliders[sliders.length - 1];
        if (slider) {
          WebMCPHelpers.setSliderValue(slider, args.maxPrice);
          await WebMCPHelpers.sleep(100);
          actions.push(`Set max price: $${args.maxPrice}/night`);
        } else {
          actions.push('WARNING: Could not find price slider');
        }
        await closePanel();
      } else {
        actions.push('WARNING: Could not open Price filter');
      }
    }

    // ── Guest rating ──────────────────────────────────────────────────────────
    if (args.minRating) {
      const ratingStr = args.minRating >= 4.5 ? '4.5' : args.minRating >= 4 ? '4' : args.minRating >= 3.5 ? '3.5' : '3';
      // Try the dropdown "Guest rating" first, then quick-filter chips
      const opened = await openFilter(['Guest rating', 'Rating']);
      if (opened) {
        await WebMCPHelpers.sleep(300);
        // Inside the dropdown, look for rating options
        const ratingBtn = WebMCPHelpers.findByText(`${ratingStr}+`, 'button') ||
                          WebMCPHelpers.findByText(`${ratingStr}.0+`, 'button') ||
                          WebMCPHelpers.findByAriaLabel(`${ratingStr}+`);
        if (ratingBtn) {
          WebMCPHelpers.simulateClick(ratingBtn);
          await WebMCPHelpers.sleep(100);
        }
        actions.push(`Set minimum rating: ${ratingStr}+`);
        await closePanel();
      } else {
        // Fallback: click the quick-filter chip like "4+ rating"
        const chipBtn = Array.from(document.querySelectorAll('button')).find(b => {
          const aria = b.getAttribute('aria-label') || '';
          return aria.toLowerCase().includes('guest rating') && b.textContent.includes(`${ratingStr}+`);
        });
        if (chipBtn) {
          WebMCPHelpers.simulateClick(chipBtn);
          await WebMCPHelpers.sleep(100);
          actions.push(`Set minimum rating: ${ratingStr}+ (via chip)`);
        } else {
          actions.push('WARNING: Could not find rating filter');
        }
      }
    }

    // ── Hotel class ───────────────────────────────────────────────────────────
    if (args.hotelClass) {
      const stars = args.hotelClass.replace('_star', '');
      // Try the dropdown "Hotel class" button first, then the quick-filter chips
      const opened = await openFilter(['Hotel class', 'Star rating']);
      if (opened) {
        await WebMCPHelpers.sleep(300);
        // Inside the dropdown, look for checkboxes or labels matching star count
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"], [role="menuitemcheckbox"]'));
        let clicked = false;
        for (const cb of checkboxes) {
          const label = cb.closest('label') || cb.parentElement;
          const text = (label?.textContent || '').trim();
          if (text.includes(`${stars}-star`) || text.includes(`${stars} star`)) {
            cb.click();
            await WebMCPHelpers.sleep(100);
            clicked = true;
            break;
          }
        }
        if (!clicked) {
          // Fallback: find any element with matching star text inside the panel
          const starBtn = WebMCPHelpers.findByText(`${stars}-star`) ||
                          WebMCPHelpers.findByText(`${stars} star`);
          if (starBtn) {
            WebMCPHelpers.simulateClick(starBtn);
            await WebMCPHelpers.sleep(100);
          }
        }
        actions.push(`Set hotel class: ${stars}-star+`);
        await closePanel();
      } else {
        // Fallback: try clicking the quick-filter chip directly (e.g. "4- or 5-star")
        const chipBtn = Array.from(document.querySelectorAll('button')).find(b =>
          (b.getAttribute('aria-label') || '').toLowerCase().includes('hotel class')
        );
        if (chipBtn) {
          WebMCPHelpers.simulateClick(chipBtn);
          await WebMCPHelpers.sleep(100);
          actions.push(`Set hotel class: ${stars}-star+ (via chip)`);
        } else {
          actions.push('WARNING: Could not open Hotel class filter');
        }
      }
    }

    // ── Amenities ─────────────────────────────────────────────────────────────
    if (args.amenities) {
      const wanted = args.amenities.split(',').map(a => a.trim().toLowerCase());
      const amenityMap = {
        pool: ['Pool', 'Swimming pool'],
        fitness: ['Fitness center', 'Fitness', 'Gym'],
        spa: ['Spa'],
        parking: ['Parking', 'Free parking'],
        wifi: ['Wi-Fi', 'WiFi', 'Free Wi-Fi'],
        restaurant: ['Restaurant'],
        kitchen: ['Kitchen', 'Kitchenette'],
        'air conditioning': ['Air conditioning', 'AC'],
        'pet friendly': ['Pet-friendly', 'Pets allowed'],
        breakfast: ['Breakfast'],
        bar: ['Bar'],
        'room service': ['Room service'],
        laundry: ['Laundry'],
        'business center': ['Business center'],
        'beach access': ['Beach access'],
        'airport shuttle': ['Airport shuttle'],
        'ev charger': ['EV charger'],
        'all-inclusive': ['All-inclusive'],
        'kid-friendly': ['Kid-friendly', 'Family friendly']
      };

      // Try clicking the Amenities filter button first
      const opened = await openFilter(['Amenities', 'Pool', 'Fitness']);
      if (opened) {
        await WebMCPHelpers.sleep(150);
        for (const amenity of wanted) {
          const labels = amenityMap[amenity] || [amenity.charAt(0).toUpperCase() + amenity.slice(1)];
          for (const label of labels) {
            const btn = WebMCPHelpers.findByText(label, 'button') ||
                        WebMCPHelpers.findByText(label, 'label') ||
                        WebMCPHelpers.findByAriaLabel(label);
            if (btn) {
              WebMCPHelpers.simulateClick(btn);
              await WebMCPHelpers.sleep(80);
              actions.push(`Selected amenity: ${label}`);
              break;
            }
          }
        }
        await closePanel();
      } else {
        // Try clicking amenity chip buttons directly
        for (const amenity of wanted) {
          const labels = amenityMap[amenity] || [amenity.charAt(0).toUpperCase() + amenity.slice(1)];
          for (const label of labels) {
            const btn = WebMCPHelpers.findByText(label, 'button') ||
                        WebMCPHelpers.findByAriaLabel(label);
            if (btn) {
              WebMCPHelpers.simulateClick(btn);
              await WebMCPHelpers.sleep(80);
              actions.push(`Selected amenity: ${label}`);
              break;
            }
          }
        }
      }
    }

    // ── Free cancellation ─────────────────────────────────────────────────────
    if (args.freeCancel) {
      const opened = await openFilter(['Offers', 'Free cancellation', 'Deals']);
      if (opened) {
        await WebMCPHelpers.sleep(150);
        const cancelBtn = WebMCPHelpers.findByText('Free cancellation', 'button') ||
                          WebMCPHelpers.findByText('Free cancellation', 'label') ||
                          WebMCPHelpers.findByAriaLabel('Free cancellation');
        if (cancelBtn) {
          WebMCPHelpers.simulateClick(cancelBtn);
          await WebMCPHelpers.sleep(80);
          actions.push('Enabled free cancellation filter');
        } else {
          actions.push('WARNING: Could not find free cancellation option');
        }
        await closePanel();
      } else {
        actions.push('WARNING: Could not open Offers filter');
      }
    }

    // ── Eco-certified ─────────────────────────────────────────────────────────
    if (args.ecoCertified) {
      const ecoBtn = Array.from(document.querySelectorAll('button')).find(b =>
        (b.getAttribute('aria-label') || '').toLowerCase().includes('eco-certified')
      );
      if (ecoBtn) {
        WebMCPHelpers.simulateClick(ecoBtn);
        await WebMCPHelpers.sleep(100);
        actions.push('Enabled eco-certified filter');
      } else {
        actions.push('WARNING: Could not find Eco-certified filter');
      }
    }

    // ── Brands ──────────────────────────────────────────────────────────────────
    if (args.brands) {
      const wantedBrands = args.brands.split(',').map(b => b.trim());
      const opened = await openFilter(['Brands']);
      if (opened) {
        await WebMCPHelpers.sleep(300);
        for (const brand of wantedBrands) {
          // Look for checkboxes or clickable items matching the brand name
          const brandBtn = WebMCPHelpers.findByText(brand, 'button') ||
                           WebMCPHelpers.findByText(brand, 'label') ||
                           WebMCPHelpers.findByText(brand);
          if (brandBtn) {
            WebMCPHelpers.simulateClick(brandBtn);
            await WebMCPHelpers.sleep(80);
            actions.push(`Selected brand: ${brand}`);
          }
        }
        await closePanel();
      } else {
        actions.push('WARNING: Could not open Brands filter');
      }
    }

    // ── Property type ───────────────────────────────────────────────────────────
    if (args.propertyType) {
      const opened = await openFilter(['Property type']);
      if (opened) {
        await WebMCPHelpers.sleep(300);
        const typeBtn = WebMCPHelpers.findByText(args.propertyType, 'button') ||
                        WebMCPHelpers.findByText(args.propertyType, 'label') ||
                        WebMCPHelpers.findByText(args.propertyType);
        if (typeBtn) {
          WebMCPHelpers.simulateClick(typeBtn);
          await WebMCPHelpers.sleep(100);
          actions.push(`Set property type: ${args.propertyType}`);
        } else {
          actions.push(`WARNING: Could not find property type "${args.propertyType}"`);
        }
        await closePanel();
      } else {
        actions.push('WARNING: Could not open Property type filter');
      }
    }

    if (actions.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No filters specified. Available: maxPrice, minRating, hotelClass, amenities, freeCancel, ecoCertified, brands, propertyType.'
        }]
      };
    }

    await WebMCPHelpers.sleep(200);

    return {
      content: [{
        type: 'text',
        text: `Filters applied:\n${actions.join('\n')}\n\nCall get_results to see the updated hotels.`
      }]
    };
  }
};
