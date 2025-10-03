import { q, qs, DB, uid, escapeHtml, escapeAttr, calcLevel } from './utils.js';
import { initApp } from './views.js';

// initialize
(function init(){
  const saved = DB.load();
  window._APP_STATE = Object.assign({
    tasks: [], vault: [], points: 0, store: [], inventory: [], triggers: []
  }, saved);
  initApp(window._APP_STATE);
})();