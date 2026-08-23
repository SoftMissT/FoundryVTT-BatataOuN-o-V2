/**
 * ApplicationV2 — Diálogo integrado.
 * @module application
 */

import { getCurrentQuality, applyQuality, QUALITY_LABELS } from "./quality.js";
import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { runBenchmark, detectGPU } from "./benchmark.js";
import { getGranularState, toggleGranularFeature, resetGranular } from "./granular.js";
import { startMonitor, stopMonitor, getMonitorState } from "./monitor.js";

export class PotatoDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "batata-ou-nao-dialog",
    width: 680,
    height: "auto",
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
    const granular = this.#buildGranularContext();

    const benchmark = this.#benchmarkResult
      ? {
          ...this.#benchmarkResult,
          recommendedLabel: game.i18n.localize(
            QUALITY_LABELS[this.#benchmarkResult.tier]
          ),
        }
      : null;

    return {
      selectedLevel: this.#selectedLevel,
      gpu: gpu.renderer,
      benchmark,
      benchmarkRunning: this.#benchmarkRunning,
      granular,
      monitorActive: monitor.active,
      monitorCurrentFps: monitor.currentFps,
      monitorAvgFps: monitor.avgFps,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    // Cards de nível
    this.element.querySelectorAll(".batata-card").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        this.element.querySelectorAll(".batata-card").forEach((c) =>
          c.removeAttribute("active")
        );
        el.setAttribute("active", "true");
        this.#selectedLevel = Number(el.dataset.level);
      });
    });

    // Benchmark button
    const benchBtn = this.element.querySelector("#batata-benchmark-btn");
    if (benchBtn) {
      benchBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.#runBenchmark();
      });
    }

    // Granular toggles
    this.element.querySelectorAll("[data-feature]").forEach((el) => {
      el.addEventListener("change", (e) => {
        e.preventDefault();
        const id = el.dataset.feature;
        if (el.type === "checkbox") {
          toggleGranularFeature(id);
        } else {
          toggleGranularFeature(id);
        }
      });
    });

    game.settings.sheet?.close();
  }

  async #runBenchmark() {
    this.#benchmarkRunning = true;
    this.render();

    this.#benchmarkResult = await runBenchmark(3000);
    this.#selectedLevel = this.#benchmarkResult.tier;
    this.#benchmarkRunning = false;
    this.render();
  }

  #buildGranularContext() {
    const state = getGranularState();
    return state.map((f) => ({
      id: f.id,
      name: game.i18n.localize(f.name),
      enabled: f.enabled,
      impact: f.impact,
      impactLabel: game.i18n.localize(`BATATAOU_NAO.Impact.${f.impact}`),
      isSelect: f.type === "select",
      currentValue: f.currentValue,
      options: f.options
        ? f.options.map((o) => ({
            value: o.value,
            label: game.i18n.localize(o.label),
            selected: f.currentValue === o.value,
          }))
        : [],
    }));
  }

  static async #onFormSubmit(event, form, formData) {
    const active = form.querySelector(".batata-card[active]");
    if (!active) return;

    const level = Number(active.dataset.level);
    await applyQuality(level);
    await setSetting(SETTING_KEYS.HAS_BEEN_PROMPTED, true);
  }
}
