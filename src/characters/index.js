import bolsonaro from './bolsonaro.js';
import lula from './lula.js';

/** Registry of selectable fighters. Adding a fighter = a config file + its assets. */
export const CHARACTERS = { bolsonaro, lula };
export const CHARACTER_LIST = Object.values(CHARACTERS);
