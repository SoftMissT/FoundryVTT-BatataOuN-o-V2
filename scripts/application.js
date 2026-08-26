/**
 * ApplicationV2 — Diálogo integrado.
 * Monitor atualiza o DOM via BatataOuNaoMonitorTick (1x/s), sem rerender.
 * @module application
 */

import { getCurrentQuality, applyQuality, QUALITY_LABELS } from "./quality.js";
import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { runBenchmark, detectGPU } from "./benchmark.js";
import { getGranularState, toggleGranularFeature, setGranularFeature, resetGranular } from "./granular.js";
import { getMonitorState } from "./monitor.js";

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
  #benchmarkResult = getSetting(SETTING_KEYS.BENCHMARK_RESULT) || null;
  #benchmarkRunning = false;
  #benchmarkDone = Boolean(getSetting(SETTING_KEYS.BENCHMARK_RESULT));
  #overrideConfirmed = false;
  #tickHandler = null;

  async _prepareContext() {
    const gpu = detectGPU();
    const monitor = getMonitorState();
    const granular = this.#buildGranularContext();

    if (!this.#benchmarkResult) {
      this.#benchmarkResult = getSetting(SETTING_KEYS.BENCHMARK_RESULT) || null;
      this.#benchmarkDone = Boolean(this.#benchmarkResult);
    }

    const benchmark = this.#benchmarkResult
      ? {
          ...this.#benchmarkResult,
          recommendedLabel:
            this.#benchmarkResult.tier !== null
              ? game.i18n.localize(QUALITY_LABELS[this.#benchmarkResult.tier])
              : null,
        }
      : null;

    return {
      selectedLevel: this.#selectedLevel,
      gpu: gpu.renderer,
      benchmark,
      benchmarkRunning: this.#benchmarkRunning,
      benchmarkDone: this.#benchmarkDone,
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
        this.element
          .querySelectorAll(".batata-card")
          .forEach((c) => {
            c.removeAttribute("active");
            c.classList.remove("active");
          });
        el.setAttribute("active", "true");
        el.classList.add("active");
        this.#selectedLevel = Number(el.dataset.level);
        this.#overrideConfirmed = false;
      });
    });

    // Benchmark
    const benchBtn = this.element.querySelector("#batata-benchmark-btn");
    if (benchBtn) {
      benchBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.#runBenchmark();
      });
    }

    // Granular
    this.element.querySelectorAll("[data-feature]").forEach((el) => {
      el.addEventListener("change", (e) => {
        e.preventDefault();
        const id = el.dataset.feature;
        if (el.type === "checkbox") {
          toggleGranularFeature(id);
        } else if (el.tagName === "SELECT") {
          setGranularFeature(id, Number(el.value));
        }
      });
    });

    // Monitor: atualiza DOM direto via hook (1x/s), sem rerender
    this.#tickHandler = (monitorState) => this.#updateMonitorDom(monitorState);
    Hooks.on("BatataOuNaoMonitorTick", this.#tickHandler);

    // Gate: benchmark obrigatório antes de aplicar + confirmação de override
    const submitBtn = this.element.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = !this.#benchmarkDone;
      submitBtn.addEventListener("click", async (e) => {
        if (this.#overrideConfirmed || !this.#needsOverrideConfirm()) return;
        e.preventDefault();
        e.stopPropagation();
        const ok = await this.#confirmOverride();
        if (!ok) return;
        this.#overrideConfirmed = true;
        submitBtn.click();
      });
    }

    game.settings.sheet?.close();
  }

  async _onClose(options) {
    if (this.#tickHandler) {
      Hooks.off("BatataOuNaoMonitorTick", this.#tickHandler);
      this.#tickHandler = null;
    }
    if (!getSetting(SETTING_KEYS.HAS_BEEN_PROMPTED)) {
      await setSetting(SETTING_KEYS.HAS_BEEN_PROMPTED, true);
    }
    await super._onClose(options);
  }

  /**
   * Atualiza os números do monitor direto no DOM — barato, sem rerender.
   * @param {{ currentFps: number, avgFps: number }} monitorState
   */
  #updateMonitorDom(monitorState) {
    if (!this.element) return;
    const currentEl = this.element.querySelector("[data-monitor-current]");
    const avgEl = this.element.querySelector("[data-monitor-avg]");
    if (currentEl) currentEl.textContent = String(monitorState.currentFps);
    if (avgEl) avgEl.textContent = String(monitorState.avgFps);
  }

  async #runBenchmark() {
    this.#benchmarkRunning = true;
    this.render();

    this.#benchmarkResult = await runBenchmark(3000);
    this.#benchmarkDone = true;

    try {
      await setSetting(SETTING_KEYS.BENCHMARK_RESULT, this.#benchmarkResult);
    } catch (err) {
      console.warn("BatataOuNao | Erro ao salvar benchmarkResult:", err);
    }

    // Só auto-seleciona se o FPS foi confiável
    if (this.#benchmarkResult.tier !== null) {
      this.#selectedLevel = this.#benchmarkResult.tier;
    }

    this.#benchmarkRunning = false;
    this.render();

    Hooks.call("BatataOuNaoBenchmarkComplete", this.#benchmarkResult);
  }

  /**
   * Verifica se a escolha atual exige confirmação de override.
   * Exige quando não há benchmark, quando o FPS não pôde ser medido
   * ou quando o nível escolhido difere do tier recomendado.
   * @returns {boolean}
   */
  #needsOverrideConfirm() {
    if (!this.#benchmarkDone || !this.#benchmarkResult) return false;
    if (this.#benchmarkResult.tier === null) return true;
    return this.#selectedLevel !== this.#benchmarkResult.tier;
  }

  /**
   * Diálogo de confirmação para override do tier recomendado,
   * avisando os problemas possíveis de cada direção.
   * @returns {Promise<boolean>}
   */
  async #confirmOverride() {
    const result = this.#benchmarkResult;
    let warnKey = "BATATAOU_NAO.Dialog.OverrideNoFps";
    if (result?.tier !== null && result) {
      warnKey =
        this.#selectedLevel > result.tier
          ? "BATATAOU_NAO.Dialog.OverrideAbove"
          : "BATATAOU_NAO.Dialog.OverrideBelow";
    }
    const recommended = result?.tier !== null && result
      ? game.i18n.localize(QUALITY_LABELS[result.tier])
      : null;

    const content = `<p>${game.i18n.localize(warnKey)}</p>${
      recommended ? `<p><strong>${game.i18n.localize("BATATAOU_NAO.Dialog.Recommended")}: ${recommended}</strong></p>` : ""
    }`;

    return foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("BATATAOU_NAO.Dialog.OverrideTitle") },
      content,
      yes: {
        label: game.i18n.localize("BATATAOU_NAO.Dialog.OverrideConfirm"),
        icon: "fas fa-check",
      },
      no: {
        label: game.i18n.localize("BATATAOU_NAO.Dialog.OverrideCancel"),
        icon: "fas fa-xmark",
      },
    });
  }

  #buildGranularContext() {
    const state = getGranularState();
    return state.map((f) => ({
      id: f.id,
      name: game.i18n.localize(f.name),
      enabled: f.enabled,
      available: f.available,
      impact: f.impact,
      impactLabel: game.i18n.localize(`BATATAOU_NAO.Impact.${f.impact}`),
      isSelect: f.type === "select",
      currentValue: f.currentValue,
      options: f.options
        ? f.options.map((o) => ({
            value: o.value,
            label: o.label,
            selected: f.currentValue === o.value,
          }))
        : [],
    }));
  }

  static async #onFormSubmit(event, form, formData) {
    const active = form.querySelector(".batata-card[active], .batata-card.active");
    if (!active) return;

    const level = Number(active.dataset.level);
    await applyQuality(level);
    await setSetting(SETTING_KEYS.HAS_BEEN_PROMPTED, true);

    Hooks.call("BatataOuNaoQualityApplied", level);
  }
}
