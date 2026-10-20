import { describe, it, expect } from 'vitest';
import { DEFAULT_BINDINGS, actionsFromCodes, rebind, loadBindings, saveBindings } from '../src/input/bindings.js';

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    keys: () => data.keys(),
  };
};

describe('keyboard bindings', () => {
  it('maps physical keys to player 1 actions', () => {
    const actions = actionsFromCodes(DEFAULT_BINDINGS, 0, new Set(['KeyA', 'KeyF']));
    expect(actions.left).toBe(true);
    expect(actions.lp).toBe(true);
    expect(actions.right).toBe(false);
    expect(actions.super).toBe(false);
  });

  it("player 2 kicks use the keys right of L (; and ' on US, Ç and ~ on ABNT2)", () => {
    const actions = actionsFromCodes(DEFAULT_BINDINGS, 1, new Set(['Semicolon', 'Quote']));
    expect(actions.lk).toBe(true);
    expect(actions.hk).toBe(true);
    expect(actionsFromCodes(DEFAULT_BINDINGS, 0, new Set(['Semicolon', 'Quote'])).lk).toBe(false);
  });

  it('rebinding to a key that is already in use swaps the two actions', () => {
    const before = JSON.stringify(DEFAULT_BINDINGS);
    expect(actionsFromCodes(DEFAULT_BINDINGS, 0, new Set(['KeyH'])).lk).toBe(true);
    const b = rebind(DEFAULT_BINDINGS, 0, 'lp', 'KeyH');
    expect(JSON.stringify(DEFAULT_BINDINGS)).toBe(before);
    expect(actionsFromCodes(b, 0, new Set(['KeyH'])).lp).toBe(true);
    expect(actionsFromCodes(b, 0, new Set(['KeyH'])).lk).toBe(false);
    expect(actionsFromCodes(b, 0, new Set(['KeyF'])).lk).toBe(true);
  });

  it("rebinding to the other player's key swaps it across players", () => {
    expect(actionsFromCodes(DEFAULT_BINDINGS, 1, new Set(['KeyK'])).lp).toBe(true);
    const b = rebind(DEFAULT_BINDINGS, 0, 'lp', 'KeyK');
    expect(actionsFromCodes(b, 0, new Set(['KeyK'])).lp).toBe(true);
    expect(actionsFromCodes(b, 1, new Set(['KeyK'])).lp).toBe(false);
    expect(actionsFromCodes(b, 1, new Set(['KeyF'])).lp).toBe(true);
  });

  it('saved bindings are restored', () => {
    const storage = memoryStorage();
    saveBindings(storage, rebind(DEFAULT_BINDINGS, 1, 'super', 'Enter'));
    const restored = loadBindings(storage);
    expect(actionsFromCodes(restored, 1, new Set(['Enter'])).super).toBe(true);
  });

  it('keeps defaults for actions missing from older saved data', () => {
    const storage = memoryStorage();
    saveBindings(storage, rebind(DEFAULT_BINDINGS, 0, 'lp', 'KeyZ'));
    const saved = JSON.parse(storage.getItem([...storage.keys()][0]));
    delete saved[0].super;
    storage.setItem([...storage.keys()][0], JSON.stringify(saved));
    const restored = loadBindings(storage);
    expect(actionsFromCodes(restored, 0, new Set(['KeyZ'])).lp).toBe(true);
    expect(actionsFromCodes(restored, 0, new Set(['KeyT'])).super).toBe(true);
  });

  it('saving never throws when storage is unavailable', () => {
    expect(() => saveBindings({ setItem: () => { throw new Error('quota'); } }, DEFAULT_BINDINGS)).not.toThrow();
    expect(() => saveBindings(undefined, DEFAULT_BINDINGS)).not.toThrow();
  });

  it('falls back to the defaults when storage is empty, corrupt or unavailable', () => {
    const check = (b) => expect(actionsFromCodes(b, 0, new Set(['KeyA'])).left).toBe(true);
    check(loadBindings(memoryStorage()));
    check(loadBindings({ getItem: () => '{not json', setItem: () => {} }));
    check(loadBindings({ getItem: () => { throw new Error('blocked'); } }));
    check(loadBindings(undefined));
  });
});
