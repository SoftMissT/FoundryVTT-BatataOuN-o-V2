/**
 * Quality presets — inteligentes, baseados no benchmark.
 * @module quality
 */

import { deepClone, batchSetSettings, validateQualityLevel } from "./utils.js";
import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { GRANULAR_FEATURES, applyGranular } from "./granular.js";

/** Labels legíveis dos níveis. */
export const QUALITY_LABELS = {
  0: "BATATAOU_NAO.Quality.Low",
  1: "BATATAOU_NAO.Quality.Medium",
  2: "BATATAOU_NAO.Quality.High",
};

/** Presets padrão para cada nível. */
const DEFAULT_PRESETS = [
  {
    // Nível 0 — Batata: máximo desempenho
    core: {
      performanceMode: 0,
      lightSoftEdges: false,
      mipmap: "OFF",
      msaa: false,
      smaa: false,
      maxFPS: 10,
      lightAnimation: false,
      visionAnimation: false,
      weatherEffects: false,
      photosensitiveMode: true,
      pixelRatioResolutionScaling: false,
    },
  },
  {
    // Nível 1 — Batata Boa: equilibrado
    core: {
      performanceMode: 1,
      lightSoftEdges: true,
      mipmap: "ON",
      msaa: false,
      smaa: false,
      maxFPS: 30,
      lightAnimation: true,
      visionAnimation: true,
      weatherEffects: true,
      photosensitiveMode: false,
      pixelRatioResolutionScaling: true,
    },
  },
  {
    // Nível 2 — Premium: tudo no máximo
    core: {
      performanceMode: 3,
      lightSoftEdges: true,
      mipmap: "ON",
      msaa: true,
      smaa: true,
      maxFPS: 60,
      lightAnimation: true,
      visionAnimation: true,
      weatherEffects: true,
      photosensitiveMode: false,
      pixelRatioResolutionScaling: true,
    },
  },
];

/**
 * Obtém presets mesclados (defaults + custom do usuário).
 * @returns {Array<Object>}
 */
function getMergedPresets() {
  const custom = getSetting(SETTING_KEYS.SETTINGS_MAP) ?? {};
  return DEFAULT_PRESETS.map((defaults, idx) => {
    const overrides = custom[idx] ?? {};
    return deepMerge(defaults, overrides);
  });
}

function deepMerge(target, source) {
  const result = deepClone(target);
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object"
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = deepClone(value);
    }
  }
  return result;
}

/**
 * Retorna o nível atual.
 * @returns {number}
 */
export function getCurrentQuality() {
  return getSetting(SETTING_KEYS.POTATO_LEVEL);
}

/**
 * Retorna os settings ativos para o nível atual.
 * @returns {Object}
 */
export function getCurrentSettings() {
  const level = getCurrentQuality();
  const presets = getMergedPresets();
  return presets[level] ?? presets[1];
}

/**
 * Retorna total de settings por nível.
 * @returns {number[]}
 */
export function getSettingsCountPerLevel() {
  const presets = getMergedPresets();
  return presets.map((preset) => {
    let count = 0;
    for (const group of Object.values(preset)) {
      count += Object.keys(group).length;
    }
    return count;
  });
}

/**
 * Aplica os settings de um nível — batch update.
 * @param {number} level
 * @returns {Promise<PromiseSettledResult<any>[]>}
 */
export async function applyQuality(level) {
  validateQualityLevel(level);

  const presets = getMergedPresets();
  const preset = presets[level];

  const updates = [];
  for (const [module, settings] of Object.entries(preset)) {
    for (const [setting, value] of Object.entries(settings)) {
      updates.push({ module, setting, value });
    }
  }

  // Adicionar updates das features granulares
  const granularUpdates = applyGranular(level);
  for (const u of granularUpdates) {
    // Só adicionar se não já está nos presets base
    const exists = updates.some(
      (x) => x.module === u.module && x.setting === u.setting
    );
    if (!exists) updates.push(u);
  }

  const results = await batchSetSettings(updates);
  await setSetting(SETTING_KEYS.POTATO_LEVEL, level);

  const applied = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(
    `BatataOuNao | Qualidade ${level} aplicada: ${applied} ok, ${failed} falhas`
  );

  return results;
}
