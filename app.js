import { q, qs, DB, uid, escapeHtml, escapeAttr, calcLevel, createAutoSaveState } from './utils.js';
import { initApp } from './views.js';

// initialize
(function init(){
  const saved = DB.load();
  window._APP_STATE = createAutoSaveState(Object.assign({
    tasks: [], vault: [], points: 0, store: [], inventory: [], triggers: [], events: []
  }, saved), DB.save);
  initApp(window._APP_STATE);
})();