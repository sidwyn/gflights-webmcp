// content/sites/google-hotels/tools/sortResults.js

const SortHotelResultsTool = {
  name: 'sort_results',
  description: 'Sort hotel results by relevance, lowest price, highest rating, or most reviewed. Only works on a Google Hotels results page.',
  inputSchema: {
    type: 'object',
    properties: {
      sortBy: {
        type: 'string',
        enum: ['relevance', 'price_low', 'rating', 'most_reviewed'],
        description: 'Sort order for hotel results'
      }
    },
    required: ['sortBy']
  },

  execute: async (args) => {
    const { sortBy } = args;
    const url = window.location.href;
    if (!url.includes('/travel/search') && !url.includes('/travel/hotels')) {
      return { content: [{ type: 'text', text: 'ERROR: Not on Google Hotels.' }] };
    }

    // Click the "Sort by" button to open the dropdown
    const sortBtn = WebMCPHelpers.findByAriaLabel('Sort by') ||
                    WebMCPHelpers.findByText('Sort by', 'button');
    if (!sortBtn) {
      return { content: [{ type: 'text', text: 'Could not find the Sort by button. Make sure hotel results are loaded.' }] };
    }

    WebMCPHelpers.simulateClick(sortBtn);
    await WebMCPHelpers.sleep(300);

    // Sort options are radio buttons with text labels
    const labelMap = {
      relevance: 'Relevance',
      price_low: 'Lowest price',
      rating: 'Highest rating',
      most_reviewed: 'Most reviewed'
    };

    const targetLabel = labelMap[sortBy];
    if (!targetLabel) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return { content: [{ type: 'text', text: `Unknown sort option: ${sortBy}. Available: relevance, price_low, rating, most_reviewed.` }] };
    }

    // Find the radio input by its associated label text and use native .click()
    // simulateClick (synthetic mouse events) doesn't trigger Google's custom radio buttons
    let clicked = false;

    // Strategy 1: Find radio inputs inside the dialog/dropdown and match by label
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    for (const radio of radios) {
      // Check label[for=id], sibling label, or parent text
      const radioLabel = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
      const siblingLabel = radio.nextElementSibling?.tagName === 'LABEL' ? radio.nextElementSibling : null;
      const parent = radio.parentElement;
      const text = (radioLabel?.textContent || siblingLabel?.textContent || parent?.textContent || '').trim();
      if (text === targetLabel) {
        radio.click();  // Native click — triggers Google's event handlers
        await WebMCPHelpers.sleep(500);
        clicked = true;
        break;
      }
    }

    // Strategy 2: Find label element by text and click it natively
    if (!clicked) {
      const label = WebMCPHelpers.findByText(targetLabel);
      if (label) {
        label.click();
        await WebMCPHelpers.sleep(500);
        clicked = true;
      }
    }

    if (!clicked) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return { content: [{ type: 'text', text: `Could not find the "${targetLabel}" sort option.` }] };
    }

    return {
      content: [{
        type: 'text',
        text: `Sorted by: ${targetLabel}. Call get_results to see the updated hotel list.`
      }]
    };
  }
};
