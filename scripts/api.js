/**
 * API pública do Batata Ou Não.
 * @module api
 */

import {
  getCurrentQuality,
  getCurrentSettings,
  applyQuality,
} from "./quality.js";
import { validateQualityLevel } from "./utils.js";
import { PotatoDialog } from "./application.js";
import { runBenchmark, detectGPU, getGLParameters } from "./benchmark.js";
import {
  startMonitor,
  stopMonitor,
  getMonitorState,
  getFpsHistory,
} from "./monitor.js";
import {
  getGranularState,
  setGranularFeature,
  toggleGranularFeature,
  resetGranular,
} from "./granular.js";

export class PotatoOrNotAPI {
  get quality() {
    return getCurrentQuality();
  }

  async setQuality(level) {
    validateQualityLevel(level);
    await applyQuality(level);
  }

  get currentSettings() {
    return getCurrentSettings();
  }

  showDialog() {
    return new PotatoDialog().render(true);
  }

  async benchmark(durationMs = 3000) {
    return runBenchmark(durationMs);
  }

  getGPU() {
    return detectGPU();
  }

  getGLInfo() {
    return getGLParameters();
  }

  startMonitor(options) {
    startMonitor(options);
  }

  stopMonitor() {
    stopMonitor();
  }

  get monitor() {
    return getMonitorState();
  }

  get fpsHistory() {
    return getFpsHistory();
  }

  get granular() {
    return getGranularState();
  }

  setFeature(featureId, value) {
    setGranularFeature(featureId, value);
  }

  toggleFeature(featureId) {
    toggleGranularFeature(featureId);
  }

  resetFeatures(level) {
    resetGranular(level);
  }
}
