/**
 * Controles granulares — switches individuais por feature pesada.
 * Estado reflete o valor REAL aplicado no cliente, não defaults internos.
 * @module granular
 */

import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { validateQualityLevel, debugLog, isSettingRegistered } from "./utils.js";

/**
 * Definição de uma feature granular.
 * @typedef {Object} GranularFeature
 * @property {string} id
 * @property {string} name — chave de localização
 * @property {string} category
 * @property {string} module — namespace do setting (geralmente "core")
 * @property {string} setting — key do setting no Foundry
 * @property {string[]} [keyCandidates] — keys alternativas se a principal não existir
 * @property {any} defaultValueOn
 * @property {any} defaultValueOff
 * @property {string} impact
 * @property {string} [type] — "select" para opções múltiplas
 * @property {Array<{value: any, label: string}>} [options]
 */

/** Registry de features granulares. */
export const GRANULAR_FEATURES = [
  {
    id: "softShadows",
    name: "BATATAOU_NAO.Feature.SoftShadows.Name",
    category: "rendering",
    module: "core",
    setting: "lightSoftEdges",
    keyCandidates: ["lightSoftEdges"],
    defaultValueOn: true,
    defaultValueOff: false,
    impact: "high",
  },
  {
    id: "mipmap",
    name: "BATATAOU_NAO.Feature.Mipmap.Name",
    category: "rendering",
    module: "core",
    setting: "mipmap",
    keyCandidates: ["mipmap"],
    defaultValueOn: "ON",
    defaultValueOff: "OFF",
    impact: "medium",
  },
  {
    id: "msaa",
    name: "BATATAOU_NAO.Feature.MSAA.Name",
    category: "rendering",
    module: "core",
    setting: "msaa",
    keyCandidates: ["msaa"],
    defaultValueOn: true,
    defaultValueOff: false,
    impact: "high",
  },
  {
    id: "smaa",
    name: "BATATAOU_NAO.Feature.SMAA.Name",
    category: "rendering",
    module: "core",
    setting: "smaa",
    keyCandidates: ["smaa"],
    defaultValueOn: true,
    defaultValueOff: false,
    impact: "medium",
  },
  {
    id: "lightAnimations",
    name: "BATATAOU_NAO.Feature.LightAnimations.Name",
    category: "animation",
    module: "core",
    setting: "lightAnimation",
    keyCandidates: ["lightAnimation"],
    defaultValueOn: true,
    defaultValueOff: false,
    impact: "high",
  },
  {
    id: "visionAnimations",
    name: "BATATAOU_NAO.Feature.VisionAnimations.Name",
    category: "animation",
    module: "core",
    setting: "visionAnimation",
    keyCandidates: ["visionAnimation"],
    defaultValueOn: true,
    defaultValueOff: false,
    impact: "high",
  },
  {
    id: "photosensitiveMode",
    name: "BATATAOU_NAO.Feature.PhotosensitiveMode.Name",
    category: "effects",
    module: "core",
    setting: "photosensitiveMode",
    keyCandidates: ["photosensitiveMode"],
    defaultValueOn: false,
    defaultValueOff: true,
    impact: "low",
  },
  {
    id: "maxFPS",
    name: "BATATAOU_NAO.Feature.MaxFPS.Name",
    category: "rendering",
    module: "core",
    setting: "maxFPS",
    keyCandidates: ["maxFPS", "fps"],
    defaultValueOn: 60,
    defaultValueOff: 15,
    impact: "high",
    type: "select",
    options: [
      { value: 10, label: "10 FPS" },
      { value: 15, label: "15 FPS" },
      { value: 24, label: "24 FPS" },
      { value: 30, label: "30 FPS" },
      { value: 45, label: "45 FPS" },
      { value: 60, label: "60 FPS" },
    ],
  },
];

/**
 * Lê o valor REAL de um setting no Foundry.
 * Tenta a key principal e os candidatos.
 * @param {GranularFeature} feature
 * @returns {{ value: any, available: boolean }}
 */
function _readRealValue(feature) {
  const keys = [feature.setting, ...(feature.keyCandidates ?? [])];
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (isSettingRegistered(feature.module, key)) {
      try {
        return { value: game.settings.get(feature.module, key), available: true };
      } catch {
        /* tenta próxima */
      }
    }
  }
  return { value: undefined, available: false };
}

/**
 * Estado atual das features — reflete o valor real do cliente.
 * Override custom do usuário > valor real do Foundry > default.
 * @returns {Array<GranularFeature & { currentValue: any, enabled: boolean, available: boolean }>}
 */
export function getGranularState() {
  const customMap = getSetting(SETTING_KEYS.SETTINGS_MAP) ?? {};
  const currentLevel = getSetting(SETTING_KEYS.POTATO_LEVEL);

  return GRANULAR_FEATURES.map((feature) => {
    const real = _readRealValue(feature);
    const customValue =
      customMap[currentLevel]?.[feature.module]?.[feature.setting];

    // Prioridade: override custom > valor real aplicado > default
    const currentValue =
      customValue !== undefined ? customValue : real.value !== undefined ? real.value : feature.defaultValueOn;

    return {
      ...feature,
      currentValue,
      available: real.available,
      enabled: feature.type === "select"
        ? true
        : currentValue !== feature.defaultValueOff,
    };
  });
}

/**
 * Define o valor de uma feature: persiste override e aplica no cliente.
 * @param {string} featureId
 * @param {any} value
 */
export function setGranularFeature(featureId, value) {
  const feature = GRANULAR_FEATURES.find((f) => f.id === featureId);
  if (!feature) {
    throw new Error(`BatataOuNao | Feature '${featureId}' não encontrada`);
  }

  const currentLevel = getSetting(SETTING_KEYS.POTATO_LEVEL);
  const customMap = getSetting(SETTING_KEYS.SETTINGS_MAP) ?? {};

  if (!customMap[currentLevel]) customMap[currentLevel] = {};
  if (!customMap[currentLevel][feature.module])
    customMap[currentLevel][feature.module] = {};

  customMap[currentLevel][feature.module][feature.setting] = value;
  setSetting(SETTING_KEYS.SETTINGS_MAP, customMap);

  _applySingleFeature(feature, value);
}

/**
 * Toggle rápido de uma feature.
 * @param {string} featureId
 */
export function toggleGranularFeature(featureId) {
  const state = getGranularState();
  const feature = state.find((f) => f.id === featureId);
  if (!feature) return;

  const newValue = feature.enabled
    ? feature.defaultValueOff
    : feature.defaultValueOn;
  setGranularFeature(featureId, newValue);
}

/**
 * Gera updates granulares para um nível (usado por applyQuality).
 * @param {number} level
 * @returns {Array<{module: string, setting: string, value: any, candidates?: string[]}>}
 */
export function applyGranular(level) {
  validateQualityLevel(level);

  const customMap = getSetting(SETTING_KEYS.SETTINGS_MAP) ?? {};
  const levelOverrides = customMap[level] ?? {};

  return GRANULAR_FEATURES.filter((f) => f.type !== "select" || f.id === "maxFPS").map(
    (feature) => {
      const value =
        levelOverrides[feature.module]?.[feature.setting] ??
        feature.defaultValueOn;
      return {
        module: feature.module,
        setting: feature.setting,
        value,
        candidates: feature.keyCandidates,
      };
    }
  );
}

/**
 * Reseta overrides granulares de um nível.
 * @param {number} level
 */
export function resetGranular(level) {
  validateQualityLevel(level);

  const customMap = getSetting(SETTING_KEYS.SETTINGS_MAP) ?? {};
  delete customMap[level];
  setSetting(SETTING_KEYS.SETTINGS_MAP, customMap);
}

// ─── Internos ───────────────────────────────────────────────────

function _applySingleFeature(feature, value) {
  const keys = [feature.setting, ...(feature.keyCandidates ?? [])];
  for (const key of keys) {
    if (isSettingRegistered(feature.module, key)) {
      game.settings
        .set(feature.module, key, value)
        .catch((err) =>
          console.error(`BatataOuNao | Falha em ${feature.module}.${key}:`, err)
        );
      return;
    }
  }
  debugLog(`Feature ${feature.id}: nenhum setting registrado — pulado`);
}
