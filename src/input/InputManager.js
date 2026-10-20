import { ACTIONS, actionsFromCodes, loadBindings, saveBindings } from './bindings.js';
import { getStorage } from '../config/settings.js';

const NAV_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Escape', 'Backspace', 'F1']);

// Standard Gamepad API layout.
const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, start: 9, up: 12, down: 13, left: 14, right: 15 };
const AXIS_DEADZONE = 0.5;

const blank = () => Object.fromEntries(ACTIONS.map((a) => [a, false]));
const blankMenu = () => ({ up: false, down: false, left: false, right: false, confirm: false, back: false });

/**
 * Tracks physical keys (KeyboardEvent.code) and gamepads, producing one reusable input
 * object per player for the simulation, plus edge-triggered menu navigation.
 */
export class InputManager {
  constructor() {
    this.keys = new Set();
    // Press counters let each reader see taps shorter than one frame.
    this.pressCounts = new Map();
    this.readers = { player0: new Map(), player1: new Map(), menu0: new Map(), menu1: new Map(), menu: new Map() };
    this.views = {};
    for (const [name, reader] of Object.entries(this.readers)) {
      this.views[name] = { has: (code) => this.isDown(code, reader) };
    }
    this.startHeld = false;
    this.bindings = loadBindings(getStorage());
    this.players = [blank(), blank()];
    this.menuHeld = [blankMenu(), blankMenu(), blankMenu()];
    this.menuEdges = [blankMenu(), blankMenu(), blankMenu()];
    this.capture = null;
    this.onFirstInput = null;
    this.attached = false;
  }

  attach(win = window) {
    if (this.attached) return;
    this.attached = true;
    win.addEventListener('keydown', (e) => {
      this.notifyFirstInput();
      if (this.capture && !e.repeat) {
        e.preventDefault();
        const done = this.capture;
        this.capture = null;
        done(e.code);
        return;
      }
      if (this.isGameKey(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) this.pressCounts.set(e.code, (this.pressCounts.get(e.code) || 0) + 1);
    });
    win.addEventListener('keyup', (e) => this.keys.delete(e.code));
    win.addEventListener('blur', () => this.keys.clear());
    win.addEventListener('pointerdown', () => this.notifyFirstInput());
  }

  notifyFirstInput() {
    if (this.onFirstInput) {
      const cb = this.onFirstInput;
      this.onFirstInput = null;
      cb();
    }
  }

  isGameKey(code) {
    if (NAV_CODES.has(code)) return true;
    return this.bindings.some((map) => ACTIONS.some((a) => map[a] === code));
  }

  /** Next key press is handed to `callback` instead of the game (used for rebinding). */
  captureNextKey(callback) {
    this.capture = callback;
  }

  setBindings(bindings) {
    this.bindings = bindings;
    saveBindings(getStorage(), bindings);
  }

  pad(index) {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let n = 0;
    for (const p of pads) {
      if (p && p.connected) {
        if (n === index) return p;
        n++;
      }
    }
    return null;
  }

  /** Held now, or tapped since this reader last looked. */
  isDown(code, reader) {
    const count = this.pressCounts.get(code) || 0;
    const seen = reader.get(code) || 0;
    if (count !== seen) reader.set(code, count);
    return this.keys.has(code) || count !== seen;
  }

  /** Current held state for player 0 or 1 (same object every call). */
  player(index, view = this.views[`player${index}`]) {
    const out = actionsFromCodes(this.bindings, index, view, this.players[index]);
    const pad = this.pad(index);
    if (pad) {
      const btn = (i) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      out.left ||= btn(PAD.left) || ax < -AXIS_DEADZONE;
      out.right ||= btn(PAD.right) || ax > AXIS_DEADZONE;
      out.up ||= btn(PAD.up) || ay < -AXIS_DEADZONE;
      out.down ||= btn(PAD.down) || ay > AXIS_DEADZONE;
      out.lp ||= btn(PAD.x);
      out.hp ||= btn(PAD.y);
      out.lk ||= btn(PAD.a);
      out.hk ||= btn(PAD.b);
      out.special ||= btn(PAD.rb) || btn(PAD.lb);
      out.super ||= btn(PAD.rt) || btn(PAD.lt);
    }
    return out;
  }

  /**
   * Call once per frame in menus. Index 0/1 = each player's own controls,
   * index 2 = anyone (including Enter / Escape).
   */
  pollMenu() {
    for (let p = 0; p < 2; p++) {
      const s = { ...this.player(p, this.views[`menu${p}`]) };
      const pad = this.pad(p);
      const padBtn = (i) => !!pad?.buttons[i]?.pressed;
      this.updateMenu(p, {
        up: s.up, down: s.down, left: s.left, right: s.right,
        confirm: s.lp || padBtn(PAD.a) || padBtn(PAD.start),
        back: s.hp || padBtn(PAD.b),
      });
    }
    const [a, b] = this.menuHeld;
    this.updateMenu(2, {
      up: a.up || b.up, down: a.down || b.down, left: a.left || b.left, right: a.right || b.right,
      confirm: a.confirm || b.confirm || this.isDown('Enter', this.readers.menu) || this.isDown('Space', this.readers.menu),
      back: a.back || b.back || this.isDown('Escape', this.readers.menu) || this.isDown('Backspace', this.readers.menu),
    });
    return this.menuEdges;
  }

  updateMenu(slot, state) {
    const held = this.menuHeld[slot];
    const edges = this.menuEdges[slot];
    for (const k in state) {
      edges[k] = state[k] && !held[k];
      held[k] = state[k];
    }
  }

  /**
   * Discards pending taps for every reader (menus and players) and swallows held menu
   * buttons, so a scene change or closing a menu doesn't replay them.
   */
  resetMenu() {
    for (const reader of Object.values(this.readers)) {
      for (const [code, count] of this.pressCounts) reader.set(code, count);
    }
    this.pollMenu();
    for (const e of this.menuEdges) for (const k in e) e[k] = false;
  }

  /** True once when any gamepad's Start button goes down. */
  pausePressed() {
    const held = [0, 1].some((i) => !!this.pad(i)?.buttons[PAD.start]?.pressed);
    const edge = held && !this.startHeld;
    this.startHeld = held;
    return edge;
  }
}

export const input = new InputManager();
