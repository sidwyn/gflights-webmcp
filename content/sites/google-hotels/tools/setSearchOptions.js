// content/sites/google-hotels/tools/setSearchOptions.js

const SetHotelSearchOptionsTool = {
  name: 'set_search_options',
  description: 'Change check-in/check-out dates and guest count on the current Google Hotels search.',
  inputSchema: {
    type: 'object',
    properties: {
      checkIn: {
        type: 'string',
        description: 'New check-in date in YYYY-MM-DD format'
      },
      checkOut: {
        type: 'string',
        description: 'New check-out date in YYYY-MM-DD format'
      },
      guests: {
        type: 'integer',
        description: 'Number of guests'
      }
    }
  },

  execute: async (args) => {
    const url = window.location.href;
    if (!url.includes('/travel/search') && !url.includes('/travel/hotels')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Hotels.' }] };
    }

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    const setValue = (el, val) => {
      if (nativeSetter?.set) nativeSetter.set.call(el, val);
      else el.value = val;
    };

    const actions = [];

    // ── Check-in date ─────────────────────────────────────────────────────────
    if (args.checkIn) {
      const checkInInput = document.querySelector('input[aria-label*="Check-in"]') ||
                           document.querySelector('input[placeholder*="Check-in"]');
      if (checkInInput) {
        WebMCPHelpers.simulateClick(checkInInput);
        await WebMCPHelpers.sleep(200);

        // Clear and type new date
        setValue(checkInInput, '');
        checkInInput.dispatchEvent(new Event('input', { bubbles: true }));
        await WebMCPHelpers.sleep(100);

        const [y, m, d] = args.checkIn.split('-');
        const dateStr = `${m}/${d}/${y}`;
        for (const char of dateStr) {
          const current = checkInInput.value || '';
          setValue(checkInInput, current + char);
          checkInInput.dispatchEvent(new Event('input', { bubbles: true }));
          await WebMCPHelpers.sleep(30);
        }
        checkInInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await WebMCPHelpers.sleep(200);
        actions.push(`Check-in: ${args.checkIn}`);
      } else {
        actions.push('WARNING: Could not find check-in date input');
      }
    }

    // ── Check-out date ────────────────────────────────────────────────────────
    if (args.checkOut) {
      const checkOutInput = document.querySelector('input[aria-label*="Check-out"]') ||
                            document.querySelector('input[placeholder*="Check-out"]');
      if (checkOutInput) {
        WebMCPHelpers.simulateClick(checkOutInput);
        await WebMCPHelpers.sleep(200);

        setValue(checkOutInput, '');
        checkOutInput.dispatchEvent(new Event('input', { bubbles: true }));
        await WebMCPHelpers.sleep(100);

        const [y, m, d] = args.checkOut.split('-');
        const dateStr = `${m}/${d}/${y}`;
        for (const char of dateStr) {
          const current = checkOutInput.value || '';
          setValue(checkOutInput, current + char);
          checkOutInput.dispatchEvent(new Event('input', { bubbles: true }));
          await WebMCPHelpers.sleep(30);
        }
        checkOutInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await WebMCPHelpers.sleep(200);
        actions.push(`Check-out: ${args.checkOut}`);
      } else {
        actions.push('WARNING: Could not find check-out date input');
      }
    }

    // ── Guests ────────────────────────────────────────────────────────────────
    if (args.guests) {
      const travelersBtn = WebMCPHelpers.findByAriaLabel('Number of travelers') ||
                           WebMCPHelpers.findByAriaLabel('travelers') ||
                           WebMCPHelpers.findByText('travelers', 'button');
      if (travelersBtn) {
        WebMCPHelpers.simulateClick(travelersBtn);
        await WebMCPHelpers.sleep(200);

        // Find the current count and adjust with +/- buttons
        const panel = document.querySelector('[role="dialog"]') ||
                      document.querySelector('[role="menu"]') ||
                      travelersBtn.parentElement;

        if (panel) {
          // Look for + and - buttons
          const btns = Array.from(panel.querySelectorAll('button'));
          const plusBtn = btns.find(b => /increase|add|\+/i.test(b.getAttribute('aria-label') || b.textContent));
          const minusBtn = btns.find(b => /decrease|remove|−|–/i.test(b.getAttribute('aria-label') || b.textContent));

          // Read current count
          const countEl = Array.from(panel.querySelectorAll('*')).find(el =>
            el.children.length === 0 && /^\d+$/.test(el.textContent.trim())
          );
          const current = countEl ? parseInt(countEl.textContent.trim(), 10) : 2;
          const diff = args.guests - current;

          const btn = diff > 0 ? plusBtn : minusBtn;
          if (btn) {
            for (let i = 0; i < Math.abs(diff); i++) {
              WebMCPHelpers.simulateClick(btn);
              await WebMCPHelpers.sleep(50);
            }
          }

          // Close the panel
          const doneBtn = WebMCPHelpers.findByText('Done', 'button') ||
                          WebMCPHelpers.findByText('Apply', 'button');
          if (doneBtn) {
            WebMCPHelpers.simulateClick(doneBtn);
            await WebMCPHelpers.sleep(100);
          } else {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await WebMCPHelpers.sleep(50);
          }
          actions.push(`Guests: ${args.guests}`);
        }
      } else {
        actions.push('WARNING: Could not find travelers button');
      }
    }

    if (actions.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No options specified. Available: checkIn, checkOut, guests.'
        }]
      };
    }

    await WebMCPHelpers.sleep(200);

    return {
      content: [{
        type: 'text',
        text: `Search options updated:\n${actions.join('\n')}\n\nCall get_results to see the updated hotels.`
      }]
    };
  }
};
