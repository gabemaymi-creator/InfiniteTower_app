export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const toInt = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const toFloat = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : String(value));
  } catch {}
}

export function readStorage(key, fallback) {
  const value = safeGetItem(key);
  return value == null ? fallback : value;
}

export function readJSON(key, fallback) {
  const raw = safeGetItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  safeSetItem(key, JSON.stringify(value));
}

export function readClampedInt(key, fallback, min, max) {
  return clamp(toInt(safeGetItem(key), fallback), min, max);
}

export function writeClampedInt(key, value, min, max) {
  const clamped = clamp(value, min, max);
  safeSetItem(key, clamped);
  return clamped;
}
