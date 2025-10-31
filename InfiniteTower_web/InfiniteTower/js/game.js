import {
  clamp,
  toInt,
  toFloat,
  safeGetItem,
  safeSetItem,
  readStorage,
  readJSON,
  writeJSON
} from './utils/storage.js';

import {
  initPixelModule,
  loadRenderMode,
  loadPixelArt,
  renderColorPicker,
  loadColor,
  resetPixelArtCache,
  PIXEL_GRID
} from './pixel/editor.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let overlay = document.getElementById('overlay');

const GRAVITY = 0.7;
const JUMP = -13.4;
const PLAYER_SPEED = 3.2;
const PLATFORM_HEIGHT = 14;
const SPIN_SPEED = 0.12;

const MUSIC_VOLUME_KEY = 'towerJumperMusicVolume';
const MUSIC_MUTED_KEY = 'towerJumperMusicMuted';
const SFX_VOLUME_KEY = 'towerJumperSfxVolume';
const SFX_MUTED_KEY = 'towerJumperSfxMuted';
const CLICK_VOLUME = 1.0;
const LAND_VOLUME = 1.0;

const HS_KEY = 'towerJumperHighScores';
const NAME_KEY = 'towerJumperPlayerName';

const SCROLL_RAMP_START = 10;
const SCROLL_BASE_SPEED = 0.7;
const SCROLL_LOG_ACCEL = 0.2;
const SCROLL_MAX_SPEED = 2.1;
const SCROLL_SMOOTHING = 0.12;

const PLATFORM_RAMP_START = 100;
const PLATFORM_DIFFICULTY_INTERVAL = 10;
const PLATFORM_BASE_SPEED = 0.8;
const PLATFORM_MAX_SPEED = 2.0;
const PLATFORM_LOG_ACCEL = 0.45;
const PLATFORM_SPEED_SMOOTHING = 0.1;

const PLATFORM_BASE_WIDTH = 110;
const PLATFORM_MIN_WIDTH = 62;
const PLATFORM_WIDTH_LOG_FACTOR = 8;
const PLATFORM_WIDTH_SMOOTHING = 0.08;

const PLATFORM_COLORS = [
  '#32CD32',
  '#4FC3F7',
  '#FFB74D',
  '#BA68C8',
  '#E57373',
  '#81C784',
  '#FFD54F'
];

let player;
let platforms = [];
let keys = {};
let score = 0;
let gameLoop;
let paused = true;
let scrollY = 0;
let scrollSpeed = SCROLL_BASE_SPEED;
let platformSpeed = 0;
let basePlatformWidth = PLATFORM_BASE_WIDTH;
let clickJump = false;
let nextPlatformIndex = 0;
let currentSfxVolume = 1.0;
let sfxMuted = false;

const bgmEl = document.getElementById('bgmAudio');
const volEl = document.getElementById('musicVolume');
const muteBtn = document.getElementById('muteBtn');
const audioMsg = document.getElementById('audioMsg');
const clickEl = document.getElementById('clickAudio');
const landEl = document.getElementById('landAudio');
const sfxEl = document.getElementById('sfxVolume');
const sfxMuteBtn = document.getElementById('sfxMuteBtn');

let platformShadowColor = 'rgba(0, 0, 0, 0.24)';
let scoreTextColor = '#f5f8ff';

function refreshThemeVisuals() {
  if (typeof document === 'undefined' || !document.body) return;
  const computed = getComputedStyle(document.body);
  const platformValue = computed.getPropertyValue('--platform-shadow-color').trim();
  const scoreValue = computed.getPropertyValue('--score-color').trim();
  if (platformValue) platformShadowColor = platformValue;
  if (scoreValue) scoreTextColor = scoreValue;
}

if (typeof document !== 'undefined') {
  document.addEventListener('towerThemeChange', refreshThemeVisuals);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => refreshThemeVisuals(), { once: true });
  } else {
    refreshThemeVisuals();
  }
}

const easeTowards = (current, target, smoothing) => current + (target - current) * smoothing;

function computeTargetScrollSpeed(currentScore) {
  if (currentScore < SCROLL_RAMP_START) return SCROLL_BASE_SPEED;
  const ramp = currentScore - SCROLL_RAMP_START + 1;
  const target = SCROLL_BASE_SPEED + SCROLL_LOG_ACCEL * Math.log1p(ramp);
  return Math.min(target, SCROLL_MAX_SPEED);
}

function computeTargetPlatformSpeed(currentScore) {
  if (currentScore < PLATFORM_RAMP_START) return 0;
  const normalized = (currentScore - PLATFORM_RAMP_START) / PLATFORM_DIFFICULTY_INTERVAL;
  const target = PLATFORM_BASE_SPEED + PLATFORM_LOG_ACCEL * Math.log1p(Math.max(0, normalized));
  return Math.min(target, PLATFORM_MAX_SPEED);
}

function computeTargetPlatformWidth(currentScore) {
  if (currentScore <= 0) return PLATFORM_BASE_WIDTH;
  const ramp = Math.max(0, currentScore - SCROLL_RAMP_START);
  const reduction = PLATFORM_WIDTH_LOG_FACTOR * Math.log1p(ramp / PLATFORM_DIFFICULTY_INTERVAL);
  return Math.max(PLATFORM_MIN_WIDTH, PLATFORM_BASE_WIDTH - reduction);
}

function setupTouchControls() {
  const controls = document.getElementById('touchControls');
  if (!controls) return;

  const applyDirection = (dir, active) => {
    const codes = dir === 'left' ? ['ArrowLeft', 'KeyA'] : ['ArrowRight', 'KeyD'];
    codes.forEach(code => {
      keys[code] = active;
    });
  };

  const attachButton = button => {
    const dir = button.dataset.dir;
    if (!dir) return;

    const release = event => {
      event.preventDefault();
      if (event.pointerId != null && button.hasPointerCapture?.(event.pointerId)) {
        try {
          button.releasePointerCapture(event.pointerId);
        } catch {}
      }
      applyDirection(dir, false);
      button.classList.remove('active');
    };

    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (event.pointerId != null && button.setPointerCapture) {
        try {
          button.setPointerCapture(event.pointerId);
        } catch {}
      }
      applyDirection(dir, true);
      button.classList.add('active');
    });

    ['pointerup', 'pointercancel', 'pointerleave', 'pointerout', 'lostpointercapture'].forEach(type => {
      button.addEventListener(type, release);
    });

    button.addEventListener('contextmenu', event => event.preventDefault());
  };

  controls.querySelectorAll('button[data-dir]').forEach(attachButton);
}

function loadHighScores() {
  return readJSON(HS_KEY, []);
}

function saveHighScores(list) {
  writeJSON(HS_KEY, list);
}

function loadPlayerName() {
  return readStorage(NAME_KEY, '');
}

function savePlayerName(name) {
  safeSetItem(NAME_KEY, name || '');
}

function updateHighScoreUI(list = loadHighScores()) {
  const tbody = document.querySelector('#highScoresTable tbody');
  if (tbody) {
    tbody.innerHTML = '';
    list.forEach(entry => {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      const tdScore = document.createElement('td');
      tdName.textContent = entry.name || 'Anon';
      tdScore.textContent = String(entry.score);
      tr.appendChild(tdName);
      tr.appendChild(tdScore);
      tbody.appendChild(tr);
    });
  }
}

function recordHighScore(value) {
  const list = loadHighScores();
  const name = loadPlayerName() || 'Anon';
  list.push({ name, score: value, t: Date.now() });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 10);
  saveHighScores(trimmed);
  updateHighScoreUI(trimmed);
}

function resetGame() {
  const mode = loadRenderMode();
  player = {
    x: canvas.width / 2 - 15,
    y: canvas.height - 40,
    w: 30,
    h: 30,
    vx: 0,
    vy: 0,
    onGround: false,
    onPlatform: null,
    color: loadColor(),
    angle: 0,
    spinDir: 1,
    mode,
    pixel: loadPixelArt()
  };

  platforms = [];
  score = 0;
  scrollY = 0;
  scrollSpeed = SCROLL_BASE_SPEED;
  platformSpeed = 0;
  basePlatformWidth = PLATFORM_BASE_WIDTH;
  nextPlatformIndex = 0;
  resetPixelArtCache();

  platforms.push({
    x: 0,
    y: canvas.height - 10,
    w: canvas.width,
    h: 10,
    moving: false,
    dir: 1,
    base: true,
    scored: true,
    index: 0
  });

  for (let i = 1; i < 8; i++) {
    const index = ++nextPlatformIndex;
    platforms.push({
      x: Math.random() * (canvas.width - basePlatformWidth),
      y: canvas.height - i * 80,
      w: basePlatformWidth,
      h: PLATFORM_HEIGHT,
      moving: false,
      dir: 1,
      scored: false,
      index
    });
  }
}

function startGame() {
  playClick();
  overlay.style.display = 'none';
  resetGame();
  paused = false;
  playBgmIfAllowed();
  if (typeof gameLoop === 'number') {
    cancelAnimationFrame(gameLoop);
    gameLoop = undefined;
  }
  gameLoop = requestAnimationFrame(update);
}

function togglePause() {
  if (typeof gameLoop !== 'number') return;
  paused = !paused;
  if (paused) {
    playClick();
    overlay.innerHTML = `<h1>Paused</h1><p>Score: ${score}</p><button onclick="resumeGame()">Resume</button>`;
    overlay.style.display = 'flex';
  } else {
    playClick();
    overlay.style.display = 'none';
    playBgmIfAllowed();
    gameLoop = requestAnimationFrame(update);
  }
}

function resumeGame() {
  playClick();
  overlay.style.display = 'none';
  paused = false;
  playBgmIfAllowed();
  gameLoop = requestAnimationFrame(update);
}

function gameOver() {
  recordHighScore(score);
  overlay.innerHTML = `<h1>Game Over</h1><p>Final Score: ${score}</p><button onclick="startGame()">Restart</button>`;
  overlay.style.display = 'flex';
  if (typeof gameLoop === 'number') {
    cancelAnimationFrame(gameLoop);
    gameLoop = undefined;
  }
}

const handleKeyDown = event => {
  const isSpace = event.code === 'Space' || event.key === ' ';
  if (isSpace) {
    const el = document.activeElement;
    const isTyping = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    if (!isTyping) {
      event.preventDefault();
      if (overlay && overlay.style.display !== 'none') {
        const btn = overlay.querySelector('button');
        if (btn) {
          btn.click();
          return;
        }
      }
    }
  }
  keys[event.code] = true;
  if (event.code === 'Escape') togglePause();
};

const handleKeyUp = event => {
  const isSpace = event.code === 'Space' || event.key === ' ';
  if (isSpace) {
    const el = document.activeElement;
    const isTyping = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    if (!isTyping) event.preventDefault();
  }
  keys[event.code] = false;
};

const handlePointerDown = event => {
  event.preventDefault();
  if (!paused) clickJump = true;
};

function update() {
  if (paused) return;

  if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -PLAYER_SPEED;
  else if (keys['ArrowRight'] || keys['KeyD']) player.vx = PLAYER_SPEED;
  else player.vx = 0;

  if ((keys['Space'] || clickJump) && player.onGround) {
    player.vy = JUMP;
    player.onGround = false;
    player.onPlatform = null;
  }
  clickJump = false;

  const wasOnGround = !!player.onGround;
  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;

  if (player.x < -player.w) player.x = canvas.width;
  if (player.x > canvas.width) player.x = -player.w;

  player.onGround = false;
  player.onPlatform = null;
  for (const platform of platforms) {
    if (
      player.vy >= 0 &&
      player.x + player.w > platform.x &&
      player.x < platform.x + platform.w &&
      player.y + player.h >= platform.y &&
      player.y + player.h <= platform.y + platform.h + player.vy
    ) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.onPlatform = platform;
      if (!platform.scored && !platform.base) {
        score += 1;
        platform.scored = true;
      }
    }
  }

  if (!wasOnGround && player.onGround) {
    playLand();
  }

  if (player.onPlatform && player.onPlatform.moving) {
    player.x += player.onPlatform.dir * platformSpeed;
  }

  if (score > 3) {
    scrollY += scrollSpeed;
    for (const platform of platforms) platform.y += scrollSpeed;
    player.y += scrollSpeed;
  }

  const targetScrollSpeed = computeTargetScrollSpeed(score);
  scrollSpeed = easeTowards(scrollSpeed, targetScrollSpeed, SCROLL_SMOOTHING);

  const targetPlatformSpeed = computeTargetPlatformSpeed(score);
  platformSpeed = easeTowards(platformSpeed, targetPlatformSpeed, PLATFORM_SPEED_SMOOTHING);

  const targetBaseWidth = computeTargetPlatformWidth(score);
  basePlatformWidth = easeTowards(basePlatformWidth, targetBaseWidth, PLATFORM_WIDTH_SMOOTHING);

  const highestY = Math.min(...platforms.map(p => p.y));
  if (highestY > 50) {
    const moving = score >= PLATFORM_RAMP_START && Math.random() < 0.3;
    const index = ++nextPlatformIndex;
    const width = Math.max(PLATFORM_MIN_WIDTH, basePlatformWidth);
    platforms.push({
      x: Math.random() * Math.max(10, canvas.width - width),
      y: highestY - 80,
      w: width,
      h: PLATFORM_HEIGHT,
      moving,
      scored: false,
      index,
      dir: Math.random() < 0.5 ? -1 : 1
    });
  }

  for (const platform of platforms) {
    if (platform.moving) {
      platform.x += platform.dir * platformSpeed;
      if (platform.x < 0 || platform.x + platform.w > canvas.width) platform.dir *= -1;
    }
  }

  platforms = platforms.filter(p => p.y < canvas.height + 50);

  if (player.y > canvas.height) {
    gameOver();
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.shadowColor = platformShadowColor;
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;
  for (const platform of platforms) {
    const group = Math.floor((platform.index || 0) / 100);
    const col = PLATFORM_COLORS[group % PLATFORM_COLORS.length];
    ctx.fillStyle = col;
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  }
  ctx.restore();

  if (!player.onGround) {
    if (player.vx > 0) player.spinDir = 1;
    else if (player.vx < 0) player.spinDir = -1;
    if (Math.abs(player.vx) > 0) {
      player.angle = (player.angle || 0) + SPIN_SPEED * (player.spinDir || 1);
    }
  } else {
    player.angle = 0;
  }

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.rotate(player.angle || 0);
  const activeMode = player.mode || loadRenderMode();
  if (activeMode === 'pixel') {
    ctx.imageSmoothingEnabled = false;
    const cell = player.w / PIXEL_GRID;
    const art = player.pixel || loadPixelArt();
    for (let y = 0; y < PIXEL_GRID; y++) {
      for (let x = 0; x < PIXEL_GRID; x++) {
        const i = y * PIXEL_GRID + x;
        const value = art[i];
        if (value) {
          ctx.fillStyle = value;
          ctx.fillRect(-player.w / 2 + x * cell, -player.h / 2 + y * cell, Math.ceil(cell), Math.ceil(cell));
        }
      }
    }
  } else {
    ctx.fillStyle = player.color || '#1E90FF';
    ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
  }
  ctx.restore();

  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  for (const platform of platforms) {
    if (!platform.base && platform.index && platform.index % 10 === 0) {
      ctx.fillText(String(platform.index), platform.x + platform.w - 4, platform.y + platform.h / 2);
    }
  }
  ctx.restore();

  ctx.fillStyle = scoreTextColor;
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`Score: ${score}`, canvas.width / 2, 10);

  gameLoop = requestAnimationFrame(update);
}

function syncMuteButton() {
  if (!muteBtn || !bgmEl) return;
  muteBtn.textContent = bgmEl.muted ? 'Unmute' : 'Mute';
}

function applyVolumeFromUI() {
  if (!bgmEl || !volEl) return;
  const vol = clamp(toInt(volEl.value, 0), 0, 100) / 100;
  bgmEl.volume = vol;
  saveMusicVolume(vol);
}

function pauseBgm() {
  if (bgmEl && !bgmEl.paused) {
    try {
      bgmEl.pause();
    } catch {}
  }
}

function playBgmIfAllowed() {
  if (!bgmEl) return;
  if (bgmEl.muted || bgmEl.volume <= 0) return;
  const playback = bgmEl.play();
  if (playback && typeof playback.catch === 'function') playback.catch(() => {});
}

function syncSfxMuteButton() {
  if (!sfxMuteBtn) return;
  sfxMuteBtn.textContent = sfxMuted ? 'Unmute' : 'Mute';
}

function playClick() {
  if (!clickEl || sfxMuted) return;
  try {
    clickEl.volume = CLICK_VOLUME * currentSfxVolume;
    clickEl.currentTime = 0;
    const playback = clickEl.play();
    if (playback && typeof playback.catch === 'function') playback.catch(() => {});
  } catch {}
}

function playLand() {
  if (!landEl || sfxMuted) return;
  try {
    landEl.volume = LAND_VOLUME * currentSfxVolume;
    landEl.currentTime = 0;
    const playback = landEl.play();
    if (playback && typeof playback.catch === 'function') playback.catch(() => {});
  } catch {}
}

function loadMusicVolume() {
  return clamp(toFloat(safeGetItem(MUSIC_VOLUME_KEY), 0.5), 0, 1);
}

function saveMusicVolume(value) {
  safeSetItem(MUSIC_VOLUME_KEY, clamp(value, 0, 1));
}

function loadMusicMuted() {
  return readStorage(MUSIC_MUTED_KEY, '0') === '1';
}

function saveMusicMuted(value) {
  safeSetItem(MUSIC_MUTED_KEY, value ? '1' : '0');
}

function loadSfxVolume() {
  return clamp(toFloat(safeGetItem(SFX_VOLUME_KEY), 1.0), 0, 1);
}

function saveSfxVolume(value) {
  safeSetItem(SFX_VOLUME_KEY, clamp(value, 0, 1));
}

function loadSfxMuted() {
  return readStorage(SFX_MUTED_KEY, '0') === '1';
}

function saveSfxMuted(value) {
  safeSetItem(SFX_MUTED_KEY, value ? '1' : '0');
}

function initAudio() {
  if (!bgmEl || !volEl || !muteBtn) return;
  const storedVol = loadMusicVolume();
  const storedMuted = loadMusicMuted();
  bgmEl.volume = storedVol;
  bgmEl.muted = storedMuted;
  volEl.value = String(Math.round(storedVol * 100));

  currentSfxVolume = loadSfxVolume();
  sfxMuted = loadSfxMuted();
  if (sfxEl) {
    sfxEl.value = String(Math.round(currentSfxVolume * 100));
    sfxEl.addEventListener('input', () => {
      const value = clamp(toInt(sfxEl.value, 0), 0, 100) / 100;
      currentSfxVolume = value;
      saveSfxVolume(value);
      if (!sfxMuted) playClick();
    });
  }

  syncMuteButton();
  syncSfxMuteButton();

  muteBtn.addEventListener('click', () => {
    playClick();
    bgmEl.muted = !bgmEl.muted;
    saveMusicMuted(bgmEl.muted);
    syncMuteButton();
    if (!bgmEl.muted && !paused) playBgmIfAllowed();
  });

  if (sfxMuteBtn) {
    sfxMuteBtn.addEventListener('click', () => {
      sfxMuted = !sfxMuted;
      saveSfxMuted(sfxMuted);
      syncSfxMuteButton();
      if (!sfxMuted) playClick();
    });
  }

  volEl.addEventListener('input', () => {
    applyVolumeFromUI();
    if (!paused && !bgmEl.muted) playBgmIfAllowed();
  });

  const setAudioMsg = msg => {
    if (audioMsg) audioMsg.textContent = msg || '';
  };

  bgmEl.addEventListener('error', () => {
    if (bgmEl.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      setAudioMsg('Music file not found. Confirm ../assets/TowerTheme.wav exists.');
    }
  });

  bgmEl.addEventListener('canplay', () => setAudioMsg(''));

  const tryAutoPlayNow = () => {
    if (!bgmEl || bgmEl.muted || bgmEl.volume <= 0) return Promise.resolve();
    const playback = bgmEl.play();
    return playback && typeof playback.catch === 'function' ? playback : Promise.resolve();
  };

  tryAutoPlayNow().catch(() => {
    setAudioMsg('Autoplay blocked. Click or press any key to enable audio.');
    const onceEnable = () => {
      setAudioMsg('');
      tryAutoPlayNow().finally(() => {
        window.removeEventListener('pointerdown', onceEnable);
        window.removeEventListener('keydown', onceEnable);
      });
    };
    window.addEventListener('pointerdown', onceEnable, { once: true });
    window.addEventListener('keydown', onceEnable, { once: true });
  });
}

function initUi() {
  updateHighScoreUI();

  const nameInput = document.getElementById('playerName');
  if (nameInput) {
    nameInput.value = loadPlayerName();
    nameInput.addEventListener('input', () => savePlayerName(nameInput.value.trim()));
  }

  renderColorPicker();
}

export function initializeGame() {
  initPixelModule({ getPlayerRef: () => player });
  initUi();
  initAudio();
  refreshThemeVisuals();
  setupTouchControls();

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  canvas.addEventListener('pointerdown', handlePointerDown);

  return {
    startGame,
    resumeGame,
    togglePause,
    pauseBgm,
    isPaused: () => paused
  };
}
