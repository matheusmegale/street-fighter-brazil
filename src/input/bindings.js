/**
 * Keyboard bindings use KeyboardEvent.code (physical key position), so the default
 * P2 kicks sit right of L on any layout: ";" / "'" on US keyboards, "Ç" / "~" on ABNT2.
 */
export const ACTIONS = ['left', 'right', 'up', 'down', 'lp', 'hp', 'lk', 'hk', 'special', 'super'];

export const DEFAULT_BINDINGS = Object.freeze([
  Object.freeze({
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    lp: 'KeyF', hp: 'KeyG', lk: 'KeyH', hk: 'KeyJ', special: 'KeyR', super: 'KeyT',
  }),
  Object.freeze({
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    lp: 'KeyK', hp: 'KeyL', lk: 'Semicolon', hk: 'Quote', special: 'KeyO', super: 'KeyP',
  }),
]);

const STORAGE_KEY = 'brasil-fighters:bindings';

export function actionsFromCodes(bindings, player, codes) {
  const map = bindings[player];
  const out = {};
  for (const action of ACTIONS) out[action] = codes.has(map[action]);
  return out;
}

/** Returns new bindings with `code` on player/action; whoever had `code` gets the old key. */
export function rebind(bindings, player, action, code) {
  const next = bindings.map((m) => ({ ...m }));
  const previous = next[player][action];
  for (let p = 0; p < next.length; p++) {
    for (const a of ACTIONS) {
      if (next[p][a] === code && !(p === player && a === action)) next[p][a] = previous;
    }
  }
  next[player][action] = code;
  return next;
}

export function loadBindings(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BINDINGS;
    const saved = JSON.parse(raw);
    return DEFAULT_BINDINGS.map((defaults, p) => {
      const merged = { ...defaults };
      for (const a of ACTIONS) {
        if (typeof saved?.[p]?.[a] === 'string') merged[a] = saved[p][a];
      }
      return merged;
    });
  } catch {
    return DEFAULT_BINDINGS;
  }
}

export function saveBindings(storage, bindings) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Private mode or blocked storage: bindings simply won't persist.
  }
}

const LABELS = {
  Semicolon: 'Ç/;', Quote: "~/'", ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Space: 'ESPAÇO', Enter: 'ENTER', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT D', ControlLeft: 'CTRL',
  ControlRight: 'CTRL D', Comma: ',', Period: '.', Slash: '/', BracketLeft: '´/[', BracketRight: '[/]',
  Backslash: ']/\\', Minus: '-', Equal: '=', IntlBackslash: '\\', IntlRo: '/',
};

/** Short label for a KeyboardEvent.code, shown in menus. */
export function keyLabel(code) {
  if (LABELS[code]) return LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.toUpperCase();
}
