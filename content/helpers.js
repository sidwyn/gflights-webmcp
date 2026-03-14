// content/helpers.js — Generic DOM utilities for WebMCP tool implementations

const WebMCPHelpers = (() => {

  /**
   * Wait for an element matching selector to appear in DOM.
   */
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) { resolve(existing); return; }

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }, timeout);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  /**
   * Wait for an element to disappear.
   */
  function waitForElementToDisappear(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!document.querySelector(selector)) { resolve(); return; }

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element to disappear: ${selector}`));
      }, timeout);

      const observer = new MutationObserver(() => {
        if (!document.querySelector(selector)) {
          clearTimeout(timer);
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
  }

  /**
   * Find element by text content (case-insensitive, partial match on leaf nodes).
   */
  function findByText(text, tag = '*') {
    const elements = document.querySelectorAll(tag);
    const lower = text.toLowerCase();
    // Prefer visible exact matches first, then invisible, then partial
    let invisibleMatch = null;
    for (const el of elements) {
      if (el.textContent.trim().toLowerCase() === lower) {
        if (el.offsetHeight > 0 || el.offsetWidth > 0) return el;
        if (!invisibleMatch) invisibleMatch = el;
      }
    }
    // Fallback: partial match on leaf nodes (prefer visible)
    for (const el of elements) {
      if (el.textContent.toLowerCase().includes(lower) && el.children.length === 0) {
        if (el.offsetHeight > 0 || el.offsetWidth > 0) return el;
        if (!invisibleMatch) invisibleMatch = el;
      }
    }
    return invisibleMatch;
  }

  /**
   * Find element by aria-label (case-insensitive, partial match).
   */
  function findByAriaLabel(text) {
    const lower = text.toLowerCase();
    const elements = document.querySelectorAll('[aria-label]');
    for (const el of elements) {
      if (el.getAttribute('aria-label').toLowerCase().includes(lower)) return el;
    }
    return null;
  }

  /**
   * Simulate a realistic mouse click on an element.
   */
  function simulateClick(element) {
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function setSliderValue(slider, value) {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 1440;
    const clamped = Math.min(Math.max(value, min), max);
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(slider, clamped);
    } else {
      slider.value = clamped;
    }
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return {
    waitForElement,
    waitForElementToDisappear,
    findByText,
    findByAriaLabel,
    simulateClick,
    sleep,
    setSliderValue
  };
})();
