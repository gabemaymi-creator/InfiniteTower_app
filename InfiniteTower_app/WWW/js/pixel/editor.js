import {
  clamp,
  toInt,
  safeGetItem,
  safeSetItem,
  readStorage,
  readJSON,
  writeJSON,
  readClampedInt,
  writeClampedInt
} from '../utils/storage.js';

const COLOR_KEY = 'towerJumperColor';
const BRUSH_COLOR_KEY = 'towerJumperBrushColor';
const BRUSH_SIZE_KEY = 'towerJumperBrushSize'; // integer brush size (1..5)
const BRUSH_SHAPE_KEY = 'towerJumperBrushShape'; // 'square' | 'circle'
const RENDER_MODE_KEY = 'towerJumperRenderMode'; // 'color' | 'pixel'
const PIXEL_ART_KEY = 'towerJumperPixelArt'; // legacy key
const PIXEL_SLOT_KEY = 'towerJumperPixelSlot';
export const PIXEL_SLOTS = 5;
export const PIXEL_GRID = 20; // 20x20 pixel art

const COLOR_CHOICES = ['#1E90FF', '#FF4136', '#2ECC40', '#FFDC00', '#B10DC9', '#FF851B'];

// Dedicated palette for the pixel editor (clean 6×4 grid).
const EDITOR_PALETTE_COLORS = [
  '#000000', '#FFFFFF', '#444444', '#BDBDBD', '#9B1B30', '#8B4513',
  '#E53935', '#FFB3BA', '#FF9800', '#D7A97B', '#F4C430', '#FFEB3B',
  '#FFF59D', '#B2FF59', '#C8E6C9', '#43A047', '#00BCD4', '#B3E5FC',
  '#448AFF', '#7986CB', '#283593', '#546E7A', '#7E57C2', '#B39DDB'
];

let getPlayer = () => null;
let pixelEditorSetup = false;
let pixelArt = null;

export function initPixelModule({ getPlayerRef }) {
  getPlayer = typeof getPlayerRef === 'function' ? getPlayerRef : () => null;
  pixelArt = loadPixelArt();
}

export function loadColor() {
  return readStorage(COLOR_KEY, '#1E90FF');
}

export function saveColor(color) {
  safeSetItem(COLOR_KEY, color);
}

export function loadRenderMode() {
  const stored = readStorage(RENDER_MODE_KEY, 'color');
  return stored === 'pixel' ? 'pixel' : 'color';
}

export function saveRenderMode(mode) {
  safeSetItem(RENDER_MODE_KEY, mode === 'pixel' ? 'pixel' : 'color');
}

function loadBrushColor() {
  return readStorage(BRUSH_COLOR_KEY, loadColor());
}

function saveBrushColor(color) {
  safeSetItem(BRUSH_COLOR_KEY, color);
}

function loadBrushSize() {
  return readClampedInt(BRUSH_SIZE_KEY, 1, 1, 5);
}

function saveBrushSize(size) {
  writeClampedInt(BRUSH_SIZE_KEY, toInt(size, 1), 1, 5);
}

function loadBrushShape() {
  const value = readStorage(BRUSH_SHAPE_KEY, 'square');
  return value === 'circle' ? 'circle' : 'square';
}

function saveBrushShape(shape) {
  safeSetItem(BRUSH_SHAPE_KEY, shape === 'circle' ? 'circle' : 'square');
}

function createPixelGrid(fillValue = 0) {
  return new Array(PIXEL_GRID * PIXEL_GRID).fill(fillValue);
}

function defaultPixelArt() {
  const color = loadBrushColor() || loadColor() || '#1E90FF';
  return createPixelGrid(color);
}

function migrateToCurrent(arr) {
  const srcN = Math.round(Math.sqrt(arr.length));
  if (!Number.isInteger(srcN) || srcN <= 0) return defaultPixelArt();
  const out = createPixelGrid();
  for (let y = 0; y < PIXEL_GRID; y++) {
    for (let x = 0; x < PIXEL_GRID; x++) {
      const sx = Math.floor((x * srcN) / PIXEL_GRID);
      const sy = Math.floor((y * srcN) / PIXEL_GRID);
      const value = arr[sy * srcN + sx];
      out[y * PIXEL_GRID + x] =
        value === 0 || value === false || value == null
          ? 0
          : typeof value === 'string'
            ? value
            : (loadBrushColor() || '#1E90FF');
    }
  }
  return out;
}

function loadPixelSlot() {
  return readClampedInt(PIXEL_SLOT_KEY, 0, 0, PIXEL_SLOTS - 1);
}

function savePixelSlot(idx) {
  return writeClampedInt(PIXEL_SLOT_KEY, toInt(idx, 0), 0, PIXEL_SLOTS - 1);
}

function loadPixelArtFromSlot(idx) {
  const data = readJSON(`${PIXEL_ART_KEY}_${idx}`, null);
  if (Array.isArray(data)) {
    if (data.length === PIXEL_GRID * PIXEL_GRID) return data.map(v => v || 0);
    return migrateToCurrent(data);
  }
  if (idx === 0) {
    const legacy = readJSON(PIXEL_ART_KEY, null);
    if (Array.isArray(legacy)) return migrateToCurrent(legacy);
  }
  return defaultPixelArt();
}

function savePixelArtToSlot(idx, arr) {
  writeJSON(`${PIXEL_ART_KEY}_${idx}`, arr);
}

export function loadPixelArt() {
  return loadPixelArtFromSlot(loadPixelSlot());
}

export function savePixelArt(arr) {
  savePixelArtToSlot(loadPixelSlot(), arr);
}

function setPlayerPixel(art) {
  const player = getPlayer();
  if (player) {
    player.mode = 'pixel';
    player.pixel = art.slice();
  }
}

function setPlayerColor(color) {
  const player = getPlayer();
  if (player) {
    player.mode = 'color';
    player.color = color;
  }
}

function renderDesignPicker() {
  const holder = document.getElementById('designPicker');
  if (!holder) return;
  holder.innerHTML = '';
  for (let idx = 0; idx < PIXEL_SLOTS; idx++) {
    const arr = loadPixelArtFromSlot(idx);
    const btn = document.createElement('button');
    btn.className = 'design';
    btn.dataset.index = String(idx);
    btn.title = `Design ${idx + 1}`;
    const mini = document.createElement('canvas');
    mini.width = mini.height = 48;
    const mctx = mini.getContext('2d');
    mctx.setTransform(mini.width / PIXEL_GRID, 0, 0, mini.height / PIXEL_GRID, 0, 0);
    mctx.clearRect(0, 0, PIXEL_GRID, PIXEL_GRID);
    for (let y = 0; y < PIXEL_GRID; y++) {
      for (let x = 0; x < PIXEL_GRID; x++) {
        const value = arr[y * PIXEL_GRID + x];
        if (value) {
          mctx.fillStyle = value;
          mctx.fillRect(x, y, 1, 1);
        }
      }
    }
    btn.appendChild(mini);
    btn.addEventListener('click', () => {
      saveRenderMode('pixel');
      savePixelSlot(idx);
      const art = loadPixelArtFromSlot(idx);
      setPlayerPixel(art);
      renderColorPicker();
    });
    holder.appendChild(btn);
  }
}

function openPixelModal() {
  const modal = document.getElementById('pixelModal');
  if (!modal) return;
  if (!pixelEditorSetup) setupPixelArtEditor();
  drawPixelArtEditor();
  modal.style.display = 'flex';
}

function closePixelModal() {
  const modal = document.getElementById('pixelModal');
  if (modal) modal.style.display = 'none';
}

function drawPixelArtEditor() {
  const cvs = document.getElementById('pixelEditor');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const w = cvs.width;
  const h = cvs.height;
  const cellW = Math.floor(w / PIXEL_GRID);
  const cellH = Math.floor(h / PIXEL_GRID);
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < PIXEL_GRID; y++) {
    for (let x = 0; x < PIXEL_GRID; x++) {
      const idx = y * PIXEL_GRID + x;
      const value = pixelArt[idx];
      if (value) {
        ctx.fillStyle = value;
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= PIXEL_GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellW, 0);
    ctx.lineTo(i * cellW, PIXEL_GRID * cellH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cellH);
    ctx.lineTo(PIXEL_GRID * cellW, i * cellH);
    ctx.stroke();
  }
  const preview = document.getElementById('pixelPreview');
  if (preview) {
    const pctx = preview.getContext('2d');
    pctx.setTransform(preview.width / PIXEL_GRID, 0, 0, preview.height / PIXEL_GRID, 0, 0);
    pctx.clearRect(0, 0, PIXEL_GRID, PIXEL_GRID);
    for (let y = 0; y < PIXEL_GRID; y++) {
      for (let x = 0; x < PIXEL_GRID; x++) {
        const value = pixelArt[y * PIXEL_GRID + x];
        if (value) {
          pctx.fillStyle = value;
          pctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
}

function setupPixelArtEditor() {
  if (pixelEditorSetup) return true;
  const modal = document.getElementById('pixelModal');
  const dialog = modal ? modal.querySelector('.dialog') : null;
  const cvs = document.getElementById('pixelEditor');
  const paletteHolder = document.getElementById('editorPalette');
  const coordEl = document.getElementById('coord');
  const slotSel = document.getElementById('pixelArtSlot');
  const brushEl = document.getElementById('brushSize');
  const brushValEl = document.getElementById('brushSizeVal');
  const brushShapeEl = document.getElementById('brushShape');
  const saveBtn = document.getElementById('pixelSave');
  const clearBtn = document.getElementById('pixelClear');
  const resetBtn = document.getElementById('pixelReset');
  const closeBtn = document.getElementById('pixelClose');
  const exportBtn = document.getElementById('pixelExport');
  const importBtn = document.getElementById('pixelImport');
  const fileInput = document.getElementById('pixelFile');
  if (!cvs || !paletteHolder || !modal || !dialog) return false;
  pixelEditorSetup = true;

  paletteHolder.innerHTML = '';
  const renderSelection = () => {
    [...paletteHolder.children].forEach(child => child.classList.remove('selected'));
    const paletteColors = EDITOR_PALETTE_COLORS.slice();
    const currentBrush = loadBrushColor();
    const idx = paletteColors.findIndex(hex => (hex || '').toLowerCase() === (currentBrush || '').toLowerCase());
    if (idx >= 0 && paletteHolder.children[idx]) paletteHolder.children[idx].classList.add('selected');
  };

  EDITOR_PALETTE_COLORS.forEach(color => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch' + ((color.toLowerCase() === (loadBrushColor() || '').toLowerCase()) ? ' selected' : '');
    swatch.style.background = color;
    swatch.title = color;
    swatch.addEventListener('click', () => {
      saveBrushColor(color);
      renderSelection();
    });
    paletteHolder.appendChild(swatch);
  });

  const size = PIXEL_GRID;
  let isDrawing = false;
  let paintValue = loadBrushColor() || 0;

  if (brushEl) {
    brushEl.value = String(loadBrushSize());
    if (brushValEl) brushValEl.textContent = brushEl.value;
    brushEl.addEventListener('input', () => {
      const n = Math.max(1, Math.min(5, toInt(brushEl.value, 1)));
      saveBrushSize(n);
      if (brushValEl) brushValEl.textContent = String(n);
    });
  }

  if (brushShapeEl) {
    brushShapeEl.value = loadBrushShape();
    brushShapeEl.addEventListener('change', () => {
      saveBrushShape(brushShapeEl.value);
    });
  }

  const coordsToCell = (clientX, clientY) => {
    const rect = cvs.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * size);
    const y = Math.floor(((clientY - rect.top) / rect.height) * size);
    return { x, y };
  };

  const applyAt = (x, y) => {
    const brushSize = brushEl ? toInt(brushEl.value, loadBrushSize()) : loadBrushSize();
    const halfLow = Math.floor((brushSize - 1) / 2);
    const halfHigh = Math.ceil((brushSize - 1) / 2);
    let changed = false;
    const shape = brushShapeEl ? brushShapeEl.value : loadBrushShape();
    const radius = brushSize / 2;
    for (let yy = y - halfLow; yy <= y + halfHigh; yy++) {
      if (yy < 0 || yy >= size) continue;
      for (let xx = x - halfLow; xx <= x + halfHigh; xx++) {
        if (xx < 0 || xx >= size) continue;
        if (shape === 'circle') {
          const dx = xx - x;
          const dy = yy - y;
          if (dx * dx + dy * dy > radius * radius) continue;
        }
        const idx = yy * size + xx;
        if (pixelArt[idx] !== paintValue) {
          pixelArt[idx] = paintValue || 0;
          changed = true;
        }
      }
    }
    if (changed) {
      savePixelArt(pixelArt);
      drawPixelArtEditor();
      setPlayerPixel(pixelArt);
    }
  };

  cvs.addEventListener('pointerdown', event => {
    event.preventDefault();
    const { x, y } = coordsToCell(event.clientX, event.clientY);
    const idx = y * size + x;
    paintValue = pixelArt[idx] ? 0 : (loadBrushColor() || '#1E90FF');
    isDrawing = true;
    applyAt(x, y);
    if (coordEl && x >= 0 && y >= 0 && x < size && y < size) {
      coordEl.textContent = `${String(x).padStart(3, '0')},${String(y).padStart(3, '0')}`;
    }
  });

  window.addEventListener('pointermove', event => {
    const { x, y } = coordsToCell(event.clientX, event.clientY);
    if (coordEl && x >= 0 && y >= 0 && x < size && y < size) {
      coordEl.textContent = `${String(x).padStart(3, '0')},${String(y).padStart(3, '0')}`;
    }
    if (!isDrawing) return;
    applyAt(x, y);
  });

  window.addEventListener('pointerup', () => {
    isDrawing = false;
  });

  window.addEventListener('pointercancel', () => {
    isDrawing = false;
  });

  if (slotSel) {
    slotSel.value = String(loadPixelSlot());
    slotSel.addEventListener('change', () => {
      const idx = toInt(slotSel.value, 0);
      savePixelSlot(idx);
      pixelArt = loadPixelArtFromSlot(idx);
      drawPixelArtEditor();
      setPlayerPixel(pixelArt);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      savePixelArt(pixelArt);
      renderDesignPicker();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      pixelArt = createPixelGrid();
      savePixelArt(pixelArt);
      drawPixelArtEditor();
      setPlayerPixel(pixelArt);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      pixelArt = defaultPixelArt();
      savePixelArt(pixelArt);
      drawPixelArtEditor();
      setPlayerPixel(pixelArt);
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', () => closePixelModal());

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      try {
        const slot = loadPixelSlot();
        const payload = {
          app: 'tower-jumper',
          kind: 'pixel-art',
          version: 1,
          grid: PIXEL_GRID,
          slot,
          pixels: pixelArt,
        };
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `towerjumper_pixel_slot-${slot}_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (error) {
        console.error('Export failed', error);
      }
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {}
        let arr = null;
        if (Array.isArray(data)) {
          arr = data;
        } else if (data && Array.isArray(data.pixels)) {
          arr = data.pixels;
        }
        if (!arr) throw new Error('Invalid file format');
        const migrated = migrateToCurrent(arr).map(value => value || 0);
        pixelArt = migrated;
        savePixelArt(pixelArt);
        drawPixelArtEditor();
        renderDesignPicker();
        setPlayerPixel(pixelArt);
      } catch (error) {
        console.error('Import failed', error);
        alert('Import failed. Please choose a valid Infinite Tower pixel-art JSON file.');
      } finally {
        fileInput.value = '';
      }
    });
  }

  modal.addEventListener('click', event => {
    if (event.target === modal) closePixelModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.style.display === 'flex') closePixelModal();
  });

  drawPixelArtEditor();
  return true;
}

export function renderColorPicker() {
  const picker = document.getElementById('colorPicker');
  if (!picker) return;
  picker.innerHTML = '';
  const mode = loadRenderMode();
  const current = loadColor();
  COLOR_CHOICES.forEach((color, index) => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'swatch color-cell' + ((mode === 'color' && color === current) ? ' selected' : '');
    sw.style.background = color;
    sw.dataset.index = String(index);
    sw.setAttribute('role', 'option');
    sw.setAttribute('aria-label', `Color ${color}`);
    sw.addEventListener('click', () => {
      saveRenderMode('color');
      saveColor(color);
      setPlayerColor(color);
      [...picker.querySelectorAll('.swatch')].forEach(el => el.classList.remove('selected'));
      sw.classList.add('selected');
      drawPixelArtEditor();
    });
    picker.appendChild(sw);
  });

  const pixelButton = document.createElement('button');
  pixelButton.type = 'button';
  pixelButton.className = 'swatch pixel color-cell' + (mode === 'pixel' ? ' selected' : '');
  pixelButton.textContent = 'PX';
  pixelButton.setAttribute('role', 'option');
  pixelButton.setAttribute('aria-label', 'Pixel Art Mode');
  pixelButton.addEventListener('click', () => {
    saveRenderMode('pixel');
    const player = getPlayer();
    if (player) player.mode = 'pixel';
    [...picker.querySelectorAll('.swatch')].forEach(el => el.classList.remove('selected'));
    pixelButton.classList.add('selected');
    openPixelModal();
  });
  picker.appendChild(pixelButton);

  renderDesignPicker();
}

export function resetPixelArtCache() {
  pixelArt = loadPixelArt();
}
