/**
 * Quality presets aplicação defensiva contra Foundry v14+.
 *
 * Responsabilidades:
 * - Definir presets Batata / Batata Boa / Premium.
 * - Mesclar overrides granulares do usuário.
 * - Resolver keys candidatas entre versões do Foundry.
 * - Aplicar settings em batch seguro.
 * - Retornar resumo aplicado/pulado/falhou para UI e QA.
 *
 * Não faz console.log permanente.
 *
 * @module quality
 */

import {
  deepClone,
  batchSetSettings,
  validateQualityLevel,
  debugLog,
} from "./utils.js";
import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { applyGranular } from "./granular.js";

/** Labels legíveis dos níveis. */
export const QUALITY_LABELS = {
  0: "BATATAOU_NAO.Quality.Low",
  1: "BATATAOU_NAO.Quality.Medium",
  2: "BATATAOU_NAO.Quality.High",
};

/**
 * Candidatos de keys por conceito.
 *
 * Foundry pode mudar nomes entre versões; o primeiro setting registrado é usado.
 * Nenhum registrado → skipped no batch.
 */
const KEY_CANDIDATES = {
  maxFPS: ["maxFPS", "fps"],
  performanceMode: ["performanceMode", "mode"],
};

/**
 * Presets padrão por nível.
 *
 * `setting` é o conceito; a resolução real usa KEY_CANDIDATES quando existir.
 */
const DEFAULT_PRESETS = [
  {
    // Nível 0 Batata: máximo desempenho, mínimo custo visual.
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
    // Nível 1 Batata Boa: equilíbrio para a maioria dos usuários.
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
    // Nível 2 Premium: qualidade alta, maior custo.
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
 * Retorna os presets padrão.
 * Clone defensivo para impedir mutação externa.
 *
 * @returns {Array<Object>}
 */
export function getDefaultPresets() {
  return deepClone(DEFAULT_PRESETS);
}

/**
 * Presets mesclados com overrides custom do usuário.
 *
 * @returns {Array<Object>}
 */
function getMergedPresets() {
  const custom = getSetting(SETTING_KEYS.SETTINGS_MAP) ?? {};

  return DEFAULT_PRESETS.map((defaults, idx) =>
    deepMerge(defaults, custom[idx] ?? {}),
  );
}

/**
 * Deep merge simples para objetos de preset.
 *
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
function deepMerge(target, source) {
  const result = deepClone(target);

  for (const [key, value] of Object.entries(source ?? {})) {
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
 *
 * @returns {number}
 */
export function getCurrentQuality() {
  const level = getSetting(SETTING_KEYS.POTATO_LEVEL);

  if (typeof level !== "number" || level < 0 || level > 2) {
    return 1;
  }

  return level;
}

/**
 * Settings ativos do nível atual.
 *
 * @returns {Object}
 */
export function getCurrentSettings() {
  const level = getCurrentQuality();
  const presets = getMergedPresets();

  return presets[level] ?? presets[1];
}

/**
 * Retorna o preset mesclado de um nível específico.
 *
 * @param {number} level
 * @returns {Object}
 */
export function getPresetForLevel(level) {
  validateQualityLevel(level);

  const presets = getMergedPresets();
  return presets[level] ?? presets[1];
}

/**
 * Converte um preset em uma lista de updates para batchSetSettings().
 *
 * @param {Object} preset
 * @returns {Array<{module: string, setting: string, value: any, candidates?: string[]}>}
 */
function presetToUpdates(preset) {
  const updates = [];

  for (const [moduleName, settings] of Object.entries(preset ?? {})) {
    for (const [concept, value] of Object.entries(settings ?? {})) {
      updates.push({
        module: moduleName,
        setting: concept,
        value,
        candidates: KEY_CANDIDATES[concept] ?? [concept],
      });
    }
  }

  return updates;
}

/**
 * Adiciona updates granulares sem duplicar setting já presente no preset base.
 *
 * Regra:
 * - preset base tem prioridade;
 * - granular só entra quando não colide com um setting já planejado;
 * - candidatos são considerados para preservar compatibilidade entre versões.
 *
 * @param {Array<{module: string, setting: string, value: any, candidates?: string[]}>} updates
 * @param {number} level
 * @returns {Array<{module: string, setting: string, value: any, candidates?: string[]}>}
 */
function mergeGranularUpdates(updates, level) {
  const merged = [...updates];

  for (const granularUpdate of applyGranular(level)) {
    const exists = merged.some(
      (update) =>
        update.module === granularUpdate.module &&
        update.setting === granularUpdate.setting,
    );

    if (!exists) merged.push(granularUpdate);
  }

  return merged;
}

/**
 * Aplica um nível de qualidade.
 *
 * Retorno:
 * - applied: settings aplicados
 * - skipped: settings inexistentes/incompatíveis na versão atual
 * - failed: settings que deveriam aplicar, mas falharam
 * - details: relatório granular para UI/debug
 *
 * @param {number} level
 * @returns {Promise<{
 *   level: number,
 *   applied: number,
 *   skipped: number,
 *   failed: number,
 *   details: Array<Object>
 * }>}
 */
export async function applyQuality(level) {
  validateQualityLevel(level);

  const preset = getPresetForLevel(level);
  const baseUpdates = presetToUpdates(preset);
  const updates = mergeGranularUpdates(baseUpdates, level);

  debugLog(`Aplicando qualidade ${level}`, updates);

  const summary = await batchSetSettings(updates);

  await setSetting(SETTING_KEYS.POTATO_LEVEL, level);

  const result = {
    level,
    applied: summary.applied,
    skipped: summary.skipped,
    failed: summary.failed,
    details: summary.details,
  };

  debugLog(
    `Qualidade ${level} aplicada: ${result.applied} ok, ${result.skipped} pulados, ${result.failed} falhas`,
    result.details,
  );

  return result;
}
