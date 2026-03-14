// sidepanel/settings.js — API key management and settings UI

const Settings = (() => {
  const STORAGE_KEYS = {
    anthropicKey: 'webmcp_anthropic_key',
    openaiKey: 'webmcp_openai_key',
    selectedModel: 'webmcp_selected_model',
    disabledTools: 'webmcp_disabled_tools',
    preferences: 'webmcp_preferences',
    onboardingDone: 'webmcp_onboarding_done'
  };

  async function load() {
    return new Promise(resolve => {
      chrome.storage.local.get(Object.values(STORAGE_KEYS), items => {
        resolve({
          anthropicKey: items[STORAGE_KEYS.anthropicKey] || '',
          openaiKey: items[STORAGE_KEYS.openaiKey] || '',
          selectedModel: items[STORAGE_KEYS.selectedModel] || 'claude-sonnet-4-6',
          disabledTools: items[STORAGE_KEYS.disabledTools] || [],
          preferences: items[STORAGE_KEYS.preferences] || {},
          onboardingDone: items[STORAGE_KEYS.onboardingDone] || false
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
    if ('preferences' in updates) mapped[STORAGE_KEYS.preferences] = updates.preferences;
    if ('onboardingDone' in updates) mapped[STORAGE_KEYS.onboardingDone] = updates.onboardingDone;
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

  // ── Preference Chips (shared logic for onboarding + settings) ─────────
  function initPrefChips(container, savedPrefs, applyDefaults = false) {
    container.querySelectorAll('[data-pref]').forEach(group => {
      const key = group.dataset.pref;
      const isMulti = group.classList.contains('multi-select');
      const savedValue = savedPrefs[key];

      group.querySelectorAll('.pref-chip').forEach(chip => {
        // Restore saved state
        if (isMulti) {
          const savedArr = Array.isArray(savedValue) ? savedValue : [];
          if (savedArr.includes(chip.dataset.value)) {
            chip.classList.add('selected');
          } else if (applyDefaults && !savedValue && chip.classList.contains('default')) {
            chip.classList.add('selected');
          }
        } else {
          if (chip.dataset.value === savedValue) {
            chip.classList.add('selected');
          } else if (applyDefaults && !savedValue && chip.classList.contains('default')) {
            chip.classList.add('selected');
          }
        }

        chip.addEventListener('click', () => {
          if (isMulti) {
            // Multi-select: toggle individual chip
            chip.classList.toggle('selected');
          } else {
            // Single-select: deselect others
            group.querySelectorAll('.pref-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
          }
        });
      });
    });
  }

  function readPrefChips(container) {
    const prefs = {};
    container.querySelectorAll('[data-pref]').forEach(group => {
      const key = group.dataset.pref;
      const isMulti = group.classList.contains('multi-select');
      if (isMulti) {
        const selected = Array.from(group.querySelectorAll('.pref-chip.selected'));
        prefs[key] = selected.map(c => c.dataset.value);
      } else {
        const selected = group.querySelector('.pref-chip.selected');
        if (selected) prefs[key] = selected.dataset.value;
      }
    });
    return prefs;
  }

  // ── Settings preference chips ─────────────────────────────────────────
  const settingsContent = document.querySelector('.settings-content');
  initPrefChips(settingsContent, saved.preferences);

  // Save prefs when clicking chips in settings
  settingsContent.querySelectorAll('.pref-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      // Small delay so selected class is applied first
      await new Promise(r => setTimeout(r, 10));
      const prefs = readPrefChips(settingsContent);
      await Settings.save({ preferences: prefs });
    });
  });

  // ── Onboarding ────────────────────────────────────────────────────────
  const onboarding = document.getElementById('onboarding-overlay');
  if (onboarding && !saved.onboardingDone) {
    onboarding.style.display = '';
    initPrefChips(onboarding, {}, true); // applyDefaults = true for onboarding

    document.getElementById('onboarding-save-btn').addEventListener('click', async () => {
      const prefs = readPrefChips(onboarding);
      await Settings.save({ preferences: prefs, onboardingDone: true });
      onboarding.style.display = 'none';
      // Sync settings chips with onboarding selections
      initPrefChips(settingsContent, prefs);
      document.getElementById('message-input')?.focus();
    });

    document.getElementById('onboarding-skip-btn').addEventListener('click', async () => {
      await Settings.save({ onboardingDone: true });
      onboarding.style.display = 'none';
      document.getElementById('message-input')?.focus();
    });
  }
});
