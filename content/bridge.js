// content/bridge.js — Content script messaging bridge
// Initializes the tool registry and handles messages from the side panel.

window.__webmcpRegistry = window.__webmcpRegistry || {
  tools: {},
  pageContextProvider: null,
  sitePrompt: '',

  register(toolDef) {
    this.tools[toolDef.name] = toolDef;
    this._notifySidePanel();
  },

  unregister(name) {
    delete this.tools[name];
    this._notifySidePanel();
  },

  getAll() {
    return Object.values(this.tools).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }));
  },

  _notifySidePanel() {
    chrome.runtime.sendMessage({
      type: 'TOOLS_UPDATED',
      tools: this.getAll(),
      sitePrompt: this.sitePrompt
    }).catch(() => {}); // Side panel may not be open
    this._updateDebugElement();
  },

  _updateDebugElement() {
    let el = document.getElementById('__webmcp-debug');
    if (!el) {
      el = document.createElement('div');
      el.id = '__webmcp-debug';
      el.style.display = 'none';
      document.documentElement.appendChild(el);
    }
    el.dataset.tools = JSON.stringify(this.getAll());
    el.dataset.toolCount = Object.keys(this.tools).length;
    el.dataset.sitePrompt = this.sitePrompt ? 'set' : 'none';
  }
};

/**
 * Build page context by merging base URL with site-specific context.
 */
function getPageContext() {
  const ctx = { url: window.location.href };
  const provider = window.__webmcpRegistry.pageContextProvider;
  if (typeof provider === 'function') {
    try {
      Object.assign(ctx, provider());
    } catch {
      // Site provider may throw — return base context
    }
  }
  return ctx;
}

// Debug bridge: reload extension from main world
document.addEventListener('__webmcp_reload', () => {
  chrome.runtime.sendMessage({ type: 'RELOAD_EXTENSION' }).catch(() => {});
});

// Debug bridge: allow main world to execute tools via DOM events
document.addEventListener('__webmcp_exec', (e) => {
  try {
    const { toolName, args, requestId } = JSON.parse(e.detail);
    const tool = window.__webmcpRegistry.tools[toolName];
    if (!tool) {
      document.dispatchEvent(new CustomEvent('__webmcp_result', {
        detail: JSON.stringify({ requestId, error: `Tool "${toolName}" not found` })
      }));
      return;
    }
    tool.execute(args || {}).then(result => {
      document.dispatchEvent(new CustomEvent('__webmcp_result', {
        detail: JSON.stringify({ requestId, result })
      }));
    }).catch(err => {
      document.dispatchEvent(new CustomEvent('__webmcp_result', {
        detail: JSON.stringify({ requestId, error: err.message })
      }));
    });
  } catch (err) {
    // Malformed event — ignore
  }
});

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TOOLS') {
    sendResponse({
      tools: window.__webmcpRegistry.getAll(),
      pageContext: getPageContext(),
      sitePrompt: window.__webmcpRegistry.sitePrompt
    });
    return false;
  }

  if (message.type === 'GET_PAGE_CONTEXT') {
    sendResponse({ pageContext: getPageContext() });
    return false;
  }

  if (message.type === 'EXECUTE_TOOL') {
    const tool = window.__webmcpRegistry.tools[message.toolName];
    if (!tool) {
      sendResponse({ error: `Tool "${message.toolName}" not registered` });
      return false;
    }

    // Execute async — must return true to keep channel open
    tool.execute(message.args)
      .then(result => sendResponse({ result }))
      .catch(err => sendResponse({ error: err.message || String(err) }));
    return true; // Keep message channel open for async response
  }
});
