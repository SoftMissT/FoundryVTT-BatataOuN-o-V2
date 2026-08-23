/**
 * Batata Ou Nao — Entry Point
 * Modulo Foundry VTT v14+ para otimizacao real de performance.
 *
 * @module main
 */

import { registerSettings, getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { applyQuality, getCurrentQuality } from "./quality.js";
import { PotatoDialog } from "./application.js";
import { PotatoOrNotAPI } from "./api.js";
import { startMonitor } from "./monitor.js";

export const MODULE_ID = "batata-ou-nao";

// ─── Init ───────────────────────────────────────────────────────

Hooks.on("init", () => {
  registerSettings();
  console.log("BatataOuNao | Settings registrados");
});

// ─── Ready ──────────────────────────────────────────────────────

Hooks.on("ready", () => {
  const t0 = performance.now();

  // API publica
  window.PotatoOrNot = new PotatoOrNotAPI();

  // Menu de settings
  game.settings.registerMenu(MODULE_ID, "openDialog", {
    name: "BATATAOU_NAO.Settings.OpenDialog.Name",
    label: "BATATAOU_NAO.Settings.OpenDialog.Label",
    icon: "fas fa-microchip",
    type: PotatoDialog,
    restricted: false,
  });

  // Aplicar settings e iniciar monitor
  _postSetup();

  const ms = (performance.now() - t0).toFixed(2);
  console.log(`BatataOuNao | Pronto em ${ms}ms`);
  Hooks.call("BatataOuNaoReady");
});

// ─── Logica interna ─────────────────────────────────────────────

function _postSetup() {
  const hasBeenPrompted = getSetting(SETTING_KEYS.HAS_BEEN_PROMPTED);
  const promptUsers = getSetting(SETTING_KEYS.PROMPT_USERS);

  if (!hasBeenPrompted && promptUsers) {
    new PotatoDialog().render(true);
  } else if (hasBeenPrompted) {
    applyQuality(getCurrentQuality());
  }

  // Iniciar monitor de performance
  startMonitor({ autoAdjust: promptUsers });
}
