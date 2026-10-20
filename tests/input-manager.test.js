import { describe, it, expect } from 'vitest';
import { InputManager } from '../src/input/InputManager.js';

function key(target, type, code, extra = {}) {
  const e = new Event(type);
  Object.assign(e, { code, repeat: false, ...extra });
  target.dispatchEvent(e);
}

const tap = (target, code) => {
  key(target, 'keydown', code);
  key(target, 'keyup', code);
};

function setup() {
  const im = new InputManager();
  const win = new EventTarget();
  im.attach(win);
  return { im, win };
}

describe('InputManager', () => {
  it('a tap shorter than a frame still reaches the game exactly once', () => {
    const { im, win } = setup();
    tap(win, 'KeyF');
    expect(im.player(0).lp).toBe(true);
    expect(im.player(0).lp).toBe(false);
  });

  it('keys used in a menu do not leak into gameplay once the menu is flushed', () => {
    const { im, win } = setup();
    tap(win, 'KeyW');
    tap(win, 'KeyF');
    expect(im.pollMenu()[0].confirm).toBe(true);
    im.resetMenu();
    const p1 = im.player(0);
    expect(p1.up).toBe(false);
    expect(p1.lp).toBe(false);
  });

  it('a held key keeps reading as held across frames', () => {
    const { im, win } = setup();
    key(win, 'keydown', 'KeyD');
    expect(im.player(0).right).toBe(true);
    expect(im.player(0).right).toBe(true);
    key(win, 'keyup', 'KeyD');
    expect(im.player(0).right).toBe(false);
  });

  it('auto-repeat keydowns are not taken as a new binding while capturing', () => {
    const { im, win } = setup();
    const captured = [];
    key(win, 'keydown', 'Enter');
    im.captureNextKey((code) => captured.push(code));
    key(win, 'keydown', 'Enter', { repeat: true });
    key(win, 'keydown', 'KeyQ');
    expect(captured).toEqual(['KeyQ']);
  });
});
