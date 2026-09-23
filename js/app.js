/* =========================================================
   app.js — every page imports this first:

     import { ready } from "./js/app.js";
     await ready;   // data seeded, SW registered, sync running

   ========================================================= */

import { ensureSeeded } from "./store.js";
import { registerServiceWorker } from "./pwa.js";
import { startSync } from "./sync.js";
import { toast } from "./ui.js";

export const ready = (async () => {
  registerServiceWorker();
  try {
    await ensureSeeded();
  } catch (err) {
    console.error(err);
    toast(`Local data could not load: ${err.message}`, "danger", 8000);
    throw err;
  }
  startSync();
})();
