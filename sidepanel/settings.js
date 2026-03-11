// sidepanel/settings.js — API key management and settings UI

const Settings = (() => {
  const STORAGE_KEYS = {
    anthropicKey: 'webmcp_anthropic_key',
    openaiKey: 'webmcp_openai_key',
    selectedModel: 'webmcp_selected_model',
    disabledTools: 'webmcp_disabled_tools'
  };

  async function load() {
    return new Promise(resolve => {
      chrome.storage.local.get(Object.values(STORAGE_KEYS), items => {
        resolve({
          anthropicKey: items[STORAGE_KEYS.anthropicKey] || '',
          openaiKey: items[STORAGE_KEYS.openaiKey] || '',
          selectedModel: items[STORAGE_KEYS.selectedModel] || 'claude-sonnet-4-6',
          disabledTools: items[STORAGE_KEYS.disabledTools] || []
        });
      });
    });
  }

  async function save(updates) {
    const mapped = {};
    if ('anthropicKey' in updates) mapped[STORAGE_KEYS.anthropicKey] = updates.anthropicKey;
    if ('openaiKey' in updates) mapped[STORAGE_KEYS.openaiKey] = updates.openaiKey;
    if ('selectedModel' in updates) mapped[STORAGE_KEYS.selectedModel] = updates.selectedModel;
    if ('disabledTools' in updates) mapped[STORAGE_KEYS.disabledTools] = updates.disabledTools;
    return new Promise(resolve => chrome.storage.local.set(mapped, resolve));
  }

  async function testAnthropicKey(apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return true;
  }

  async function testOpenAIKey(apiKey) {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return true;
  }

  return { load, save, testAnthropicKey, testOpenAIKey, STORAGE_KEYS };
})();

// Settings UI initialization — runs after DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  if (!chrome?.storage) return; // Not in extension context
  const settingsBtn = document.getElementById('settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const chatView = document.getElementById('chat-view');
  const settingsView = document.getElementById('settings-view');
  const anthropicKeyInput = document.getElementById('anthropic-key');
  const openaiKeyInput = document.getElementById('openai-key');
  const modelSelector = document.getElementById('model-selector');

  // Load saved settings
  const saved = await Settings.load();
  if (saved.anthropicKey) anthropicKeyInput.value = saved.anthropicKey;
  if (saved.openaiKey) openaiKeyInput.value = saved.openaiKey;
  modelSelector.value = saved.selectedModel;

  // Update model selector disabled states
  updateModelOptions(saved.anthropicKey, saved.openaiKey);

  // Toggle settings view
  function openSettings() {
    chatView.classList.remove('active');
    settingsView.classList.add('active');
    // Focus the close button so keyboard users have a starting point
    setTimeout(() => closeSettingsBtn.focus(), 50);
  }

  function closeSettings() {
    settingsView.classList.remove('active');
    chatView.classList.add('active');
    // Return focus to settings button
    setTimeout(() => settingsBtn.focus(), 50);
  }

  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);

  // Close settings on Escape key
  settingsView.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSettings();
    }
  });

  // Trap focus within settings panel
  settingsView.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = settingsView.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Save keys on change (debounced)
  let saveTimer;
  function onKeyChange() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await Settings.save({
        anthropicKey: anthropicKeyInput.value.trim(),
        openaiKey: openaiKeyInput.value.trim()
      });
      updateModelOptions(anthropicKeyInput.value.trim(), openaiKeyInput.value.trim());
    }, 500);
  }

  anthropicKeyInput.addEventListener('input', onKeyChange);
  openaiKeyInput.addEventListener('input', onKeyChange);

  // Model selector change
  modelSelector.addEventListener('change', async () => {
    await Settings.save({ selectedModel: modelSelector.value });
  });

  // Toggle visibility buttons
  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Test connection buttons
  document.getElementById('test-anthropic-btn').addEventListener('click', async () => {
    const btn = document.getElementById('test-anthropic-btn');
    const status = document.getElementById('anthropic-key-status');
    const key = anthropicKeyInput.value.trim();
    if (!key) { setStatus(status, 'error', 'Enter an API key first'); return; }
    btn.disabled = true;
    setStatus(status, 'loading', 'Testing...');
    try {
      await Settings.testAnthropicKey(key);
      setStatus(status, 'success', 'Connected');
    } catch (e) {
      setStatus(status, 'error', e.message);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('test-openai-btn').addEventListener('click', async () => {
    const btn = document.getElementById('test-openai-btn');
    const status = document.getElementById('openai-key-status');
    const key = openaiKeyInput.value.trim();
    if (!key) { setStatus(status, 'error', 'Enter an API key first'); return; }
    btn.disabled = true;
    setStatus(status, 'loading', 'Testing...');
    try {
      await Settings.testOpenAIKey(key);
      setStatus(status, 'success', 'Connected');
    } catch (e) {
      setStatus(status, 'error', e.message);
    } finally {
      btn.disabled = false;
    }
  });

  function updateModelOptions(anthropicKey, openaiKey) {
    const selector = document.getElementById('model-selector');
    for (const option of selector.options) {
      const provider = option.dataset.provider;
      if (provider === 'anthropic') option.disabled = !anthropicKey;
      if (provider === 'openai') option.disabled = !openaiKey;
    }
  }

  function setStatus(el, type, text) {
    el.className = `key-status ${type}`;
    el.textContent = text;
  }
});
