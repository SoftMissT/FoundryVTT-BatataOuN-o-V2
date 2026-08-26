/**
 * Definições e registro de settings do Batata Ou Não.
 * @module settings
 */

import { MODULE_ID } from "./main.js";

/** Chaves de settings internas. */
export const SETTING_KEYS = {
  PROMPT_USERS: "promptUsers",
  HAS_BEEN_PROMPTED: "hasBeenPrompted",
  POTATO_LEVEL: "potatoLevel",
  SETTINGS_MAP: "settingsMap",
  DEBUG_LOGS: "debugLogs",
  BENCHMARK_RESULT: "benchmarkResult",
};

/** Definições dos settings para game.settings.register. */
const DEFINITIONS = {
  [SETTING_KEYS.PROMPT_USERS]: {
    name: "BATATAOU_NAO.Settings.PromptUsers.Name",
    hint: "BATATAOU_NAO.Settings.PromptUsers.Hint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  },
  [SETTING_KEYS.HAS_BEEN_PROMPTED]: {
    scope: "client",
    config: false,
    default: false,
    type: Boolean,
  },
  [SETTING_KEYS.POTATO_LEVEL]: {
    name: "BATATAOU_NAO.Settings.PotatoLevel.Name",
    hint: "BATATAOU_NAO.Settings.PotatoLevel.Hint",
    scope: "client",
    config: true,
    default: 1,
    type: Number,
    range: { min: 0, max: 2, step: 1 },
  },
  [SETTING_KEYS.SETTINGS_MAP]: {
    scope: "client",
    config: false,
    default: {},
    type: Object,
  },
  [SETTING_KEYS.BENCHMARK_RESULT]: {
    scope: "client",
    config: false,
    default: null,
    type: Object,
  },
  [SETTING_KEYS.DEBUG_LOGS]: {
    name: "BATATAOU_NAO.Settings.DebugLogs.Name",
    hint: "BATATAOU_NAO.Settings.DebugLogs.Hint",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  },
};

/**
 * Registra todos os settings do módulo.
 * Deve ser chamado no hook init.
 */
export function registerSettings() {
  for (const [key, definition] of Object.entries(DEFINITIONS)) {
    game.settings.register(MODULE_ID, key, definition);
  }
}

/**
 * Lê um setting do módulo.
 * @param {string} key
 * @returns {any}
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * Define um setting do módulo.
 * @param {string} key
 * @param {any} value
 * @returns {Promise<any>}
 */
export function setSetting(key, value) {
  if (value === undefined) {
    throw new Error(`BatataOuNao | setSetting: value não pode ser undefined`);
  }
  return game.settings.set(MODULE_ID, key, value);
}
