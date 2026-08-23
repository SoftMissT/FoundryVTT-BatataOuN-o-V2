/**
 * Quality presets — aplicação defensiva contra Foundry v14.
 * Keys com candidatos: aplica a primeira registrada; pula inexistentes.
 * @module quality
 */

import { deepClone, batchSetSettings, validateQualityLevel, debugLog } from "./utils.js";
import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { applyGranular } from "./granular.js";

/** Labels legíveis dos níveis. */
export const QUALITY_LABELS = {
  0: "BATATAOU_NAO.Quality.Low",
  1: "BATATAOU_NAO.Quality.Medium",
  2: "BATATAOU_NAO.Quality.High",
};

/**
 * Candidatos de keys por conceito — Foundry mudou nomes entre versões.
 * O primeiro registrado é usado; nenhum → pulado com log de debug.
 */
const KEY_CANDIDATES = {
  maxFPS: ["maxFPS", "fps"],
  performanceMode: ["performanceMode", "mode"],
};

/**
 * Presets padrão por nível.
 * `setting` é o conceito; a resolução real usa KEY_CANDIDATES.
 */
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
      photosensitiveMode: false,
      pixelRatioResolutionScaling: true,
    },
  },
];

/**
 * Presets mesclados com overrides custom do usuário.
 * @returns {Array<Object>}
 */
function getMergedPresets() {
  const custom = getSetting(SETTING_KEYS.SETTINGS_MAP) ?? {};
  return DEFAULT_PRESETS.map((defaults, idx) =>
    deepMerge(defaults, custom[idx] ?? {})
  );
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
 * Nível atual.
 * @returns {number}
 */
export function getCurrentQuality() {
  return getSetting(SETTING_KEYS.POTATO_LEVEL);
}

/**
 * Settings ativos do nível atual.
 * @returns {Object}
 */
export function getCurrentSettings() {
  const level = getCurrentQuality();
  const presets = getMergedPresets();
  return presets[level] ?? presets[1];
}

/**
 * Aplica um nível de qualidade — defensivo, batch, com candidatos de key.
 * @param {number} level
 * @returns {Promise<{applied: number, skipped: number, failed: number}>}
 */
export async function applyQuality(level) {
  validateQualityLevel(level);

  const presets = getMergedPresets();
  const preset = presets[level];

  const updates = [];
  for (const [moduleName, settings] of Object.entries(preset)) {
    for (const [concept, value] of Object.entries(settings)) {
      updates.push({
        module: moduleName,
        setting: concept,
        value,
        candidates: KEY_CANDIDATES[concept] ?? [concept],
      });
    }
  }

  // Features granulares que não colidem com o preset base
  for (const u of applyGranular(level)) {
    const exists = updates.some(
      (x) => x.module === u.module && x.setting === u.setting
    );
    if (!exists) updates.push(u);
  }

  const summary = await batchSetSettings(updates);
  await setSetting(SETTING_KEYS.POTATO_LEVEL, level);

  debugLog(
    `Qualidade ${level} aplicada: ${summary.applied} ok, ${summary.skipped} pulados, ${summary.failed} falhas`
  );
  console.log(
    `BatataOuNao | Qualidade ${level}: ${summary.applied} aplicados, ${summary.skipped} indisponíveis`
  );

  return summary;
}
