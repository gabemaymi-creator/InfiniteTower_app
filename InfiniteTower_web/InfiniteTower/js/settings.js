import { readStorage, safeSetItem } from './utils/storage.js';

const SETTINGS_OPEN_CLASS = 'settings-open';
const THEME_KEY = 'towerJumperTheme';
const DEFAULT_THEME = 'dark';
const THEMES = {
  dark: 'theme-dark',
  light: 'theme-light',
  neon: 'theme-neon'
};

let currentTheme = DEFAULT_THEME;

function applyTheme(theme, persist = false, buttons = []) {
  const body = document.body;
  const targetTheme = THEMES[theme] ? theme : DEFAULT_THEME;
  Object.values(THEMES).forEach(cls => body.classList.remove(cls));
  body.classList.add(THEMES[targetTheme]);
  const themeChanged = currentTheme !== targetTheme;
  currentTheme = targetTheme;
  if (persist) safeSetItem(THEME_KEY, targetTheme);
  buttons.forEach(btn => {
    const isActive = btn.dataset.theme === targetTheme;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
  if (themeChanged) {
    document.dispatchEvent(new CustomEvent('towerThemeChange', { detail: { theme: targetTheme } }));
  }
}

const storedTheme = readStorage(THEME_KEY, DEFAULT_THEME);
applyTheme(storedTheme);

export function setupSettingsControls(gameApi) {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const themeButtons = settingsPanel ? Array.from(settingsPanel.querySelectorAll('[data-theme]')) : [];
  let pausedByPanel = false;

  if (!settingsBtn || !settingsPanel) return;

  applyTheme(currentTheme, false, themeButtons);

  const isPanelOpen = () => document.body.classList.contains(SETTINGS_OPEN_CLASS);

  const openPanel = () => {
    if (isPanelOpen()) return;
    document.body.classList.add(SETTINGS_OPEN_CLASS);
    settingsPanel.hidden = false;
    settingsPanel.setAttribute('aria-hidden', 'false');
    settingsBtn.classList.add('active');
    settingsBtn.setAttribute('aria-expanded', 'true');
    if (gameApi && typeof gameApi.isPaused === 'function' && typeof gameApi.togglePause === 'function') {
      if (!gameApi.isPaused()) {
        gameApi.togglePause();
        pausedByPanel = true;
      } else {
        pausedByPanel = false;
      }
    }
  };

  const closePanel = (returnFocus = false) => {
    if (!isPanelOpen()) return;
    document.body.classList.remove(SETTINGS_OPEN_CLASS);
    settingsPanel.hidden = true;
    settingsPanel.setAttribute('aria-hidden', 'true');
    settingsBtn.classList.remove('active');
    settingsBtn.setAttribute('aria-expanded', 'false');
    if (
      pausedByPanel &&
      gameApi &&
      typeof gameApi.togglePause === 'function' &&
      (typeof gameApi.isPaused !== 'function' || gameApi.isPaused())
    ) {
      gameApi.togglePause();
    }
    pausedByPanel = false;
    if (returnFocus) settingsBtn.focus();
  };

  settingsBtn.addEventListener('click', () => {
    if (isPanelOpen()) closePanel();
    else openPanel();
  });

  document.addEventListener('click', event => {
    if (!isPanelOpen()) return;
    if (settingsPanel.contains(event.target) || event.target === settingsBtn) return;
    closePanel();
  });

  settingsPanel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closePanel(true);
    }
  });

  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme, true, themeButtons);
    });
  });

  return {
    closePanel
  };
}
