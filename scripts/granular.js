/**
 * Controles granulares — switches individuais por feature pesada.
 * @module granular
 */

import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { validateQualityLevel, deepClone } from "./utils.js";

/**
 * Definição de uma feature granular.
 * @typedef {Object} GranularFeature
 * @property {string} id — ID único
 * @property {string} name — Chave de localização
 * @property {string} description — Chave de localização
 * @property {string} category — Categoria (rendering, animation, lighting, vision, effects)
 * @property {any} defaultValueOff — Valor quando desligado
 * @property {any} defaultValueOn — Valor quando ligado
 * @property {string} module — Módulo alvo (geralmente "core")
 * @property {string} setting — Setting key do Foundry
 */

/** Registry de features granulares pesadas do Foundry. */
export const GRANULAR_FEATURES = [
  {
    id: "softShadows",
    name: "BATATAOU_NAO.Feature.SoftShadows.Name",
    description: "BATATAOU_NAO.Feature.SoftShadows.Description",
    category: "rendering",
    defaultValueOff: false,
    defaultValueOn: true,
    module: "core",
    setting: "lightSoftEdges",
    impact: "high",
  },
  {
    id: "mipmap",
    name: "BATATAOU_NAO.Feature.Mipmap.Name",
    description: "BATATAOU_NAO.Feature.Mipmap.Description",
    category: "rendering",
    defaultValueOff: "OFF",
    defaultValueOn: "ON",
    module: "core",
    setting: "mipmap",
    impact: "medium",
  },
  {
    id: "msaa",
    name: "BATATAOU_NAO.Feature.MSAA.Name",
    description: "BATATAOU_NAO.Feature.MSAA.Description",
    category: "rendering",
    defaultValueOff: false,
    defaultValueOn: true,
    module: "core",
    setting: "msaa",
    impact: "high",
  },
  {
    id: "smaa",
    name: "BATATAOU_NAO.Feature.SMAA.Name",
    description: "BATATAOU_NAO.Feature.SMAA.Description",
    category: "rendering",
    defaultValueOff: false,
    defaultValueOn: true,
    module: "core",
    setting: "smaa",
    impact: "medium",
  },
  {
    id: "lightAnimations",
    name: "BATATAOU_NAO.Feature.LightAnimations.Name",
    description: "BATATAOU_NAO.Feature.LightAnimations.Description",
    category: "animation",
    defaultValueOff: false,
    defaultValueOn: true,
    module: "core",
    setting: "lightAnimation",
    impact: "high",
  },
  {
    id: "visionAnimations",
    name: "BATATAOU_NAO.Feature.VisionAnimations.Name",
    description: "BATATAOU_NAO.Feature.VisionAnimations.Description",
    category: "animation",
    defaultValueOff: false,
    defaultValueOn: true,
    module: "core",
    setting: "visionAnimation",
    impact: "high",
  },
  {
    id: "weatherEffects",
    name: "BATATAOU_NAO.Feature.WeatherEffects.Name",
    description: "BATATAOU_NAO.Feature.WeatherEffects.Description",
    category: "effects",
    defaultValueOff: false,
    defaultValueOn: true,
    module: "core",
    setting: "weatherEffects",
    impact: "medium",
  },
  {
    id: "photosensitiveMode",
    name: "BATATAOU_NAO.Feature.PhotosensitiveMode.Name",
    description: "BATATAOU_NAO.Feature.PhotosensitiveMode.Description",
    category: "effects",
    defaultValueOff: false,
    defaultValueOn: true,
    module: "core",
    setting: "photosensitiveMode",
    impact: "low",
  },
  {
    id: "maxFPS",
    name: "BATATAOU_NAO.Feature.MaxFPS.Name",
    description: "BATATAOU_NAO.Feature.MaxFPS.Description",
    category: "rendering",
    defaultValueOff: 15,
    defaultValueOn: 60,
    module: "core",
    setting: "maxFPS",
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
 * Obtém o estado atual de todas as features granulares.
 * @returns {Array<GranularFeature & { currentValue: any, enabled: boolean }>}
 */
export function getGranularState() {
  const customMap = getSetting(SETTING_KEYS.SETTINGS_MAP) ?? {};
  const currentLevel = getSetting(SETTING_KEYS.POTATO_LEVEL);

  return GRANULAR_FEATURES.map((feature) => {
    // Checar se há override custom para o nível atual
    const customValue = customMap[currentLevel]?.[feature.module]?.[feature.setting];
    const currentValue =
      customValue !== undefined ? customValue : feature.defaultValueOn;

    return {
      ...feature,
      currentValue,
      enabled: currentValue !== feature.defaultValueOff,
    };
  });
}

/**
 * Define o valor de uma feature granular.
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

  // Aplicar imediatamente
  _applySingleFeature(feature, value);
}

/**
 * Toggle rápido de uma feature granular.
 * @param {string} featureId
 */
export function toggleGranularFeature(featureId) {
  const state = getGranularState();
  const feature = state.find((f) => f.id === featureId);
  if (!feature) return;

  const newValue = feature.enabled ? feature.defaultValueOff : feature.defaultValueOn;
  setGranularFeature(featureId, newValue);
}

/**
 * Aplica todas as features granulares de um nível.
 * @param {number} level
 */
export function applyGranular(level) {
  validateQualityLevel(level);

  const customMap = getSetting(SETTING_KEYS.SETTINGS_MAP) ?? {};
  const levelOverrides = customMap[level] ?? {};

  const updates = [];
  for (const feature of GRANULAR_FEATURES) {
    const value =
      levelOverrides[feature.module]?.[feature.setting] ??
      feature.defaultValueOn;

    updates.push({
      module: feature.module,
      setting: feature.setting,
      value,
    });
  }

  return updates;
}

/**
 * Reseta todas as features granulares de um nível para os defaults.
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
  if (!canvas?.ready && feature.module === "core") return;

  try {
    game.settings.set(feature.module, feature.setting, value);
  } catch (err) {
    console.error(
      `BatataOuNao | Falha ao aplicar ${feature.module}.${feature.setting}:`,
      err
    );
  }
}
