// New: utility functions & storage (moved from app.js)
export const q = sel => document.querySelector(sel);
export const qs = sel => Array.from(document.querySelectorAll(sel));

export const DB = {
  load(){ return JSON.parse(localStorage.getItem('gtd_v1')||'{}'); },
  save(data){ localStorage.setItem('gtd_v1', JSON.stringify(data)); }
};

export const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

export function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
export function escapeAttr(s){ return String(s||'').replace(/"/g,'&quot;'); }

export function calcLevel(state){
  return Math.floor((state.points||0)/10000);
}

/* New: create a shallow Proxy that auto-saves on any property set/delete */
export function createAutoSaveState(obj, saveFn){
  return new Proxy(obj, {
    set(target, prop, value){
      const res = Reflect.set(target, prop, value);
      try{ saveFn(target); }catch(e){}
      return res;
    },
    deleteProperty(target, prop){
      const res = Reflect.deleteProperty(target, prop);
      try{ saveFn(target); }catch(e){}
      return res;
    }
  });
}