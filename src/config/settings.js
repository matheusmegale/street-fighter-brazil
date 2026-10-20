const KEY = 'brasil-fighters:settings';

const DEFAULTS = { difficulty: 'normal', musicVolume: 0.5, sfxVolume: 0.8 };

function storage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function load() {
  try {
    const saved = JSON.parse(storage()?.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Player preferences, persisted when storage is available. */
export const settings = load();

export function saveSettings() {
  try {
    storage()?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: settings last for this session only.
  }
}

export function getStorage() {
  return storage();
}
