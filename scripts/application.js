/**
 * ApplicationV2 — Diálogo integrado com benchmark, qualidade e controles granulares.
 * @module application
 */

import {
  getCurrentQuality,
  applyQuality,
  QUALITY_LABELS,
} from "./quality.js";
import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { runBenchmark, detectGPU } from "./benchmark.js";
import {
  getGranularState,
  toggleGranularFeature,
  resetGranular,
} from "./granular.js";
import { startMonitor, stopMonitor, getMonitorState } from "./monitor.js";

/**
 * Diálogo de configuração de performance.
 * ApplicationV2 + HandlebarsApplicationMixin.
 */
export class PotatoDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "batata-ou-nao-dialog",
    window: {
      contentClasses: ["standard-form"],
      icon: "fas fa-microchip",
      title: "BATATAOU_NAO.Dialog.Title",
    },
    tag: "form",
    form: {
      handler: PotatoDialog.#onFormSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "modules/batata-ou-nao/templates/dialog.hbs",
    },
  };

  #selectedLevel = getCurrentQuality();
  #benchmarkResult = null;
  #benchmarkRunning = false;

  async _prepareContext() {
    const gpu = detectGPU();
    const monitor = getMonitorState();
    const granular = getGranularState();

    return {
      potatoQuality: getCurrentQuality(),
      selectedLevel: this.#selectedLevel,
      qualityLabels: QUALITY_LABELS,
      benchmark: this.#benchmarkResult,
      benchmarkRunning: this.#benchmarkRunning,
      gpu,
      monitor,
      granular,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    // Bind clicks nos cards
    const containers = this.element.querySelectorAll(".potato-card");
    for (const el of containers) {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        containers.forEach((c) => c.removeAttribute("active"));
        el.setAttribute("active", "true");
        this.#selectedLevel = Number(el.dataset.level);
      });
    }

    // Bind benchmark button
    const benchBtn = this.element.querySelector("#batata-benchmark-btn");
    if (benchBtn) {
      benchBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.#runBenchmark();
      });
    }

    // Bind granular toggles
    const toggles = this.element.querySelectorAll("[data-granular-toggle]");
    for (const toggle of toggles) {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        toggleGranularFeature(toggle.dataset.granularToggle);
        this.render();
      });
    }

    // Bind reset button
    const resetBtn = this.element.querySelector("#batata-reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        resetGranular(this.#selectedLevel);
        this.render();
      });
    }

    // Fechar settings sheet se aberto
    game.settings.sheet?.close();
  }

  async #runBenchmark() {
    this.#benchmarkRunning = true;
    this.render();

    this.#benchmarkResult = await runBenchmark(3000);

    // Auto-selecionar nível baseado no benchmark
    this.#selectedLevel = this.#benchmarkResult.tier;

    this.#benchmarkRunning = false;
    this.render();

    Hooks.call("BatataOuNaoBenchmarkComplete", this.#benchmarkResult);
  }

  static async #onFormSubmit(event, form, formData) {
    const active = form.querySelector(".potato-card[active]");
    if (!active) return;

    const level = Number(active.dataset.level);
    await applyQuality(level);
    await setSetting(SETTING_KEYS.HAS_BEEN_PROMPTED, true);

    Hooks.call("BatataOuNaoQualityApplied", level);
  }
}
