/**
 * Batata Ou Nao — Entry Point
 * Modulo Foundry VTT v14+ para diagnostico e ajuste real de performance.
 *
 * @module main
 */

import { registerSettings, getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { applyQuality, getCurrentQuality } from "./quality.js";
import { PotatoDialog } from "./application.js";
import { PotatoOrNotAPI } from "./api.js";
import { startMonitor } from "./monitor.js";
import { debugEnabled, debugLog } from "./utils.js";

export const MODULE_ID = "batata-ou-nao";

// ─── Init ───────────────────────────────────────────────────────

Hooks.on("init", () => {
  registerSettings();
  debugLog("Settings registrados");
});

// ─── Ready ──────────────────────────────────────────────────────

Hooks.on("ready", () => {
  const t0 = performance.now();

  window.PotatoOrNot = new PotatoOrNotAPI();

  game.settings.registerMenu(MODULE_ID, "openDialog", {
    name: "BATATAOU_NAO.Settings.OpenDialog.Name",
    label: "BATATAOU_NAO.Settings.OpenDialog.Label",
    icon: "fas fa-microchip",
    type: PotatoDialog,
    restricted: false,
  });

  _postSetup();

  debugLog(`Pronto em ${(performance.now() - t0).toFixed(2)}ms`);
  Hooks.call("BatataOuNaoReady");
});

// ─── Logica interna ─────────────────────────────────────────────

function _postSetup() {
  const hasBeenPrompted = getSetting(SETTING_KEYS.HAS_BEEN_PROMPTED);
  const promptUsers = getSetting(SETTING_KEYS.PROMPT_USERS);

  if (!hasBeenPrompted && promptUsers) {
    new PotatoDialog().render(true);
  } else {
    applyQuality(getCurrentQuality());
  }

  startMonitor({ autoAdjust: promptUsers });
}
