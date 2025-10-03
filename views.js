// New: rendering, modal and UI wiring (extracted and simplified)
import Sortable from "sortablejs";
import { q, qs, DB, uid, escapeHtml, escapeAttr, calcLevel } from './utils.js';

let state;
let currentView = 'tasks';

export function initApp(initialState){
  state = initialState;
  state.questions = state.questions || [];
  state.rules = state.rules || [];
  // seed samples if empty for UX
  if(!state.tasks.length && !state.store.length && state.points===0){
    state.tasks.push({id:uid(),title:'Leer 30 min',emoji:'📚',desc:'Lectura de desarrollo personal',due:null,points:500,archived:false,completed:false,everCompleted:false});
    state.tasks.push({id:uid(),title:'Limpiar cocina',emoji:'🧹',desc:'15 minutos',due:null,points:1000,archived:false,completed:false,everCompleted:false});
    state.store.push({id:uid(),name:'Ver una película',desc:'Noche de película',cost:1500,img:null});
    state.wishes = state.wishes || [];
    DB.save(state);
  }

  renderAll();
  setupUI();
  startAutoArchiveChecker();
}

/* Rendering */
function renderAll(){
  renderPoints();
  renderLists();
  renderTriggers();
  renderWishes();
  renderQuestions();
  renderRules();
  updateInventoryButtonCount();
  DB.save(state);
}

function renderPoints(){ q('#points').textContent = state.points; }

/* helper: formato legible para fechas YYYY-MM-DD -> DD/MM/YYYY */
function formatDate(d){
  if(!d) return '';
  try{
    const parts = d.split('-');
    if(parts.length===3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  }catch(e){ return d; }
}

function renderLists(){
  const active = q('#active-list'); const archived = q('#archived-list');
  if(!active || !archived) return;
  active.innerHTML=''; archived.innerHTML='';
  state.tasks.forEach(t=>{
    const el = taskElement(t);
    if(t.archived) archived.appendChild(el);
    else if(t.completed) return;
    else active.appendChild(el);
  });
}

function taskElement(t){
  const li = document.createElement('li');
  li.className = 'task-item';
  li.dataset.id = t.id;
  li.innerHTML = `
    <div class="task-meta">
      <div class="emoji">${t.emoji||'🎯'}</div>
      <div>
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="small">${t.desc?escapeHtml(t.desc):''}${t.due? ' • vence ' + escapeHtml(formatDate(t.due)) : ''}</div>
      </div>
    </div>
    <div class="controls">
      <span class="small">${t.points} pts</span>
      <button class="complete">✓</button>
      <button class="edit">✎</button>
      <button class="archive">${t.archived? 'Activar':'Archivar'}</button>
      <button class="delete">🗑️</button>
    </div>
  `;
  li.querySelector('.complete').addEventListener('click',()=>completeTask(t.id));
  li.querySelector('.edit').addEventListener('click',()=>openTaskModal(t));
  li.querySelector('.archive').addEventListener('click',()=>toggleArchive(t.id));
  li.querySelector('.delete').addEventListener('click',()=>deleteTask(t.id));
  return li;
}

/* Triggers */
function renderTriggers(){
  const ul = q('#triggers-list');
  if(!ul) return;
  ul.innerHTML = '';
  state.triggers.forEach(tr=>{
    const li = document.createElement('li');
    li.className = 'trigger-item';
    li.dataset.id = tr.id;
    li.innerHTML = `<div class="trigger-phrase"><span class="part when">${escapeHtml(tr.when)}</span><span class="connector"> entonces </span><span class="part then">${escapeHtml(tr.then)}</span></div>
      <div class="controls"><button class="edit-trigger">✎</button><button class="delete-trigger">🗑️</button></div>`;
    li.querySelector('.edit-trigger').addEventListener('click',()=>openTriggerModal(tr));
    li.querySelector('.delete-trigger').addEventListener('click',()=>{ if(confirm('Eliminar gatillo?')) { state.triggers = state.triggers.filter(t=>t.id!==tr.id); renderAll(); }});
    ul.appendChild(li);
  });
}

/* Wishes (single-field CRUD) */
function renderWishes(){
  const ul = q('#wishes-list');
  if(!ul) return;
  ul.innerHTML = '';
  (state.wishes||[]).forEach(w=>{
    const li = document.createElement('li');
    li.className = 'trigger-item';
    li.dataset.id = w.id;
    li.innerHTML = `<div class="trigger-phrase"><span class="part then">${escapeHtml(w.text)}</span></div>
      <div class="controls"><button class="edit-wish">✎</button><button class="delete-wish">🗑️</button></div>`;
    li.querySelector('.edit-wish').addEventListener('click',()=>openWishModal(w));
    li.querySelector('.delete-wish').addEventListener('click',()=>{ if(confirm('Eliminar deseo?')) { state.wishes = state.wishes.filter(x=>x.id!==w.id); renderAll(); }});
    ul.appendChild(li);
  });
}

/* Questions (question + optional answer CRUD) */
function renderQuestions(){
  const ul = q('#questions-list'); if(!ul) return;
  ul.innerHTML = '';
  (state.questions||[]).forEach(item=>{
    const li = document.createElement('li');
    li.className = 'trigger-item';
    li.dataset.id = item.id;
    li.innerHTML = `
      <div class="question-top">${escapeHtml(item.qtext)}</div>
      <div class="question-mid">${item.answer ? escapeHtml(item.answer) : ''}</div>
      <div class="question-bot"><div class="controls" style="margin:0"><button class="edit-q">✎</button><button class="delete-q">🗑️</button></div></div>
    `;
    li.querySelector('.edit-q').addEventListener('click',()=>openQuestionModal(item));
    li.querySelector('.delete-q').addEventListener('click',()=>{ if(confirm('Eliminar pregunta?')) { state.questions = state.questions.filter(q=>q.id!==item.id); renderAll(); }});
    ul.appendChild(li);
  });
}

/* Rules (single-field CRUD) */
function renderRules(){
  const ul = q('#rules-list'); if(!ul) return;
  ul.innerHTML = '';
  (state.rules||[]).forEach(r=>{
    const li = document.createElement('li');
    li.className = 'trigger-item';
    li.dataset.id = r.id;
    li.innerHTML = `<div class="trigger-phrase"><span class="part then">${escapeHtml(r.text)}</span></div>
      <div class="controls"><button class="edit-rule">✎</button><button class="delete-rule">🗑️</button></div>`;
    li.querySelector('.edit-rule').addEventListener('click',()=>openRuleModal(r));
    li.querySelector('.delete-rule').addEventListener('click',()=>{ if(confirm('Eliminar regla?')) { state.rules = state.rules.filter(x=>x.id!==r.id); renderAll(); }});
    ul.appendChild(li);
  });
}

/* Store & Inventory */
function renderStore(){
  const ul = q('#store-list'); if(!ul) return;
  ul.innerHTML='';
  const existingSortable = ul.__sortable;
  if (existingSortable && typeof existingSortable.destroy === 'function') existingSortable.destroy();

  state.store.forEach(i=>{
    const li = document.createElement('li');
    li.className='store-item';
    li.innerHTML = `<div style="display:flex;align-items:center">
      ${i.img?`<img src="${escapeAttr(i.img)}" class="thumb" alt="">`:''}
      <div><div class="task-title">${escapeHtml(i.name)}</div><div class="small">${escapeHtml(i.desc)}</div></div>
    </div>
    <div class="controls"><div class="small">${i.cost} pts</div>
      <button class="buy">Comprar</button>
      <button class="edit-item">✎</button>
    </div>`;
    li.querySelector('.buy').addEventListener('click',()=>buyItem(i.id));
    li.querySelector('.edit-item').addEventListener('click',()=>openItemModal(i));
    ul.appendChild(li);
  });

  Sortable.create(ul, {animation:150, onEnd:e=>{
    const ids = Array.from(ul.children).map(ch=> {
      const name = ch.querySelector('.task-title').textContent;
      return state.store.find(s=>s.name===name).id;
    });
    state.store = ids.map(id=>state.store.find(s=>s.id===id));
    DB.save(state);
  }});
}

function updateInventoryButtonCount(){
  const count = state.inventory.length;
  const invBtnEl = q('#inv-count-button');
  if(invBtnEl) invBtnEl.textContent = count;
}
function renderInventoryCount(){
  const count = state.inventory.length;
  const invModalEl = q('#inv-count-modal'); if(invModalEl) invModalEl.textContent = count;
  const inventoryList = q('#inventory-list'); if(!inventoryList) return;
  inventoryList.innerHTML = '';
  state.inventory.forEach(it=>{
    const li = document.createElement('li');
    li.className='store-item';
    li.innerHTML = `<div style="display:flex;align-items:center">
      ${it.img?`<img src="${escapeAttr(it.img)}" class="thumb" alt="">`:''}
      <div><div class="task-title">${escapeHtml(it.name)}</div><div class="small">${escapeHtml(it.desc)}</div></div>
    </div>
    <div class="controls"><button class="use">Usado</button></div>`;
    li.querySelector('.use').addEventListener('click',()=>useInventory(it.invId));
    inventoryList.appendChild(li);
  });
}

/* Actions (kept concise) */
function completeTask(id){
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.completed = true; t.completedAt = new Date().toLocaleString();
  state.vault.unshift({ id: t.id, title: t.title, emoji: t.emoji, desc: t.desc, points: t.points, completedAt: t.completedAt, recycled:false });
  if(!t.everCompleted){ state.points += t.points; t.everCompleted = true; }
  renderAll();
}
function toggleArchive(id){ const t = state.tasks.find(x=>x.id===id); if(!t) return; t.archived = !t.archived; renderAll(); }
function deleteTask(id){ if(!confirm('Eliminar tarea permanentemente?')) return; state.tasks = state.tasks.filter(t=>t.id!==id); state.vault = state.vault.filter(v=>v.id!==id); renderAll(); }

function startAutoArchiveChecker(){
  setInterval(()=>{
    const today = new Date().toISOString().slice(0,10);
    let changed=false;
    state.tasks.forEach(t=>{
      if(t.due && !t.archived && !t.completed && t.due < today){ t.archived = true; changed=true; }
    });
    if(changed) renderAll();
  },1000*60);
}

/* Modals & forms (triggers, tasks, items, vault, inventory) */
function openTaskModal(task=null){
  q('#modal-backdrop').classList.remove('hidden');
  const m = q('#task-modal'); m.classList.remove('hidden');
  q('#task-modal-title').textContent = task? 'Editar Tarea':'Nueva Tarea';
  const form = q('#task-form');
  form.elements.title.value = task?task.title:'';
  form.elements.emoji.value = task?task.emoji:'🎯';
  form.elements.desc.value = task?task.desc:'';
  form.elements.due.value = task?task.due || '' : '';
  if(task){ form.elements.pointsMode.value = 'manual'; form.elements.manualPoints.value = task.points; form.elements.effort.value = '500'; q('#manual-option').classList.remove('hidden'); q('#effort-options').classList.add('hidden'); }
  else { form.elements.pointsMode.value='effort'; q('#manual-option').classList.add('hidden'); q('#effort-options').classList.remove('hidden'); }

  form.onsubmit = (e)=>{
    e.preventDefault();
    const mode = form.elements.pointsMode.value;
    let pts = mode==='effort'? Number(form.elements.effort.value) : Number(form.elements.manualPoints.value||0);
    const emojiVal = (form.elements.emoji.value || '').trim() || '🎯';
    if(task){
      task.title = form.elements.title.value; task.emoji = emojiVal; task.desc = form.elements.desc.value; task.due = form.elements.due.value || null; task.points = pts;
    } else {
      state.tasks.unshift({ id:uid(), title:form.elements.title.value, emoji:emojiVal, desc:form.elements.desc.value, due: form.elements.due.value||null, points:pts, archived:false, completed:false, everCompleted:false, repetitive:false });
    }
    closeTaskModal(); renderAll();
  };
  q('#cancel-task').onclick = closeTaskModal;
}
function closeTaskModal(){ q('#modal-backdrop').classList.add('hidden'); q('#task-modal').classList.add('hidden'); }

function openTriggerModal(trigger=null){
  q('#modal-backdrop').classList.remove('hidden'); q('#trigger-modal').classList.remove('hidden');
  q('#trigger-modal-title').textContent = trigger? 'Editar Gatillo':'Crear Gatillo';
  const form = q('#trigger-form');
  form.elements.when.value = trigger? trigger.when : '';
  form.elements.then.value = trigger? trigger.then : '';
  form.onsubmit = (e)=>{ e.preventDefault(); const when = form.elements.when.value.trim(); const then = form.elements.then.value.trim(); if(!when||!then) return alert('Rellena ambos campos'); if(trigger){ trigger.when = when; trigger.then = then; } else { state.triggers.unshift({ id: uid(), when, then }); } closeTriggerModal(); renderAll(); };
  q('#cancel-trigger').onclick = closeTriggerModal;
}
function closeTriggerModal(){ q('#modal-backdrop').classList.add('hidden'); q('#trigger-modal').classList.add('hidden'); }

function openItemModal(item=null){
  q('#modal-backdrop').classList.remove('hidden'); q('#item-modal').classList.remove('hidden');
  q('#item-modal-title').textContent = item? 'Editar Objeto':'Crear Objeto';
  const form = q('#item-form');
  form.elements.name.value = item?item.name:''; form.elements.desc.value = item?item.desc:''; form.elements.cost.value = item?item.cost:0; form.elements.img.value = item?item.img||'':'';
  const deleteBtn = q('#delete-item');
  if(item){
    deleteBtn.classList.remove('hidden');
    deleteBtn.onclick = ()=>{
      if(!confirm('Eliminar objeto de la tienda?')) return;
      state.store = state.store.filter(s=>s.id!==item.id);
      closeItemModal();
      renderAll();
      if(currentView === 'store') renderStore();
    };
  } else {
    deleteBtn.classList.add('hidden');
    deleteBtn.onclick = null;
  }
  form.onsubmit = (e)=>{ e.preventDefault(); const obj = { id: item?item.id:uid(), name:form.elements.name.value, desc:form.elements.desc.value, cost: Number(form.elements.cost.value), img: form.elements.img.value||null}; if(item){ const idx = state.store.findIndex(s=>s.id===item.id); if(idx!==-1) state.store[idx]=obj; } else state.store.unshift(obj); closeItemModal(); renderAll(); if(currentView === 'store') renderStore(); };
  q('#cancel-item').onclick = closeItemModal;
}
function closeItemModal(){ q('#modal-backdrop').classList.add('hidden'); q('#item-modal').classList.add('hidden'); }

function openVaultModal(){ renderVault(); q('#modal-backdrop').classList.remove('hidden'); q('#vault-modal').classList.remove('hidden'); }
function closeVaultModal(){ q('#modal-backdrop').classList.add('hidden'); q('#vault-modal').classList.add('hidden'); }
function openInventoryModal(){ renderInventoryCount(); q('#modal-backdrop').classList.remove('hidden'); q('#inventory-modal').classList.remove('hidden'); }
function closeInventoryModal(){ q('#modal-backdrop').classList.add('hidden'); q('#inventory-modal').classList.add('hidden'); }

function renderVault(){
  const vaultList = q('#vault-list'); if (!vaultList) return;
  vaultList.innerHTML = '';
  state.vault.forEach(t=>{
    const li = document.createElement('li');
    li.className='task-item';
    li.innerHTML = `<div class="task-meta"><div class="emoji">${t.emoji}</div><div><div class="task-title">${escapeHtml(t.title)}</div><div class="small">${t.points} pts • ${t.completedAt||''}</div></div></div>
    <div class="controls">
      <button class="unmark">Desmarcar</button>
      <button class="recycle">Reciclar</button>
    </div>`;
    li.querySelector('.unmark').addEventListener('click',()=>unmarkFromVault(t.id,false));
    li.querySelector('.recycle').addEventListener('click',()=>unmarkFromVault(t.id,true));
    vaultList.appendChild(li);
  });
  q('#vault-count').textContent = state.vault.length;
  q('#vault-level').textContent = calcLevel(state);
}

function unmarkFromVault(id, recycle){
  const idx = state.vault.findIndex(v=>v.id===id); if(idx===-1) return;
  const v = state.vault.splice(idx,1)[0];
  const t = state.tasks.find(tt=>tt.id===id);
  if(t){ t.completed = false; t.archived = false; if(recycle){ t.everCompleted = false; } } else { state.tasks.unshift({ id:v.id,title:v.title,emoji:v.emoji,desc:v.desc,due:null,points:v.points,archived:false,completed:false,everCompleted: recycle?false:true }); }
  renderAll();
}

/* Store actions */
function buyItem(id){ const it = state.store.find(s=>s.id===id); if(!it) return; if(state.points < it.cost){ alert('No tienes suficientes puntos'); return;} state.points -= it.cost; state.inventory.push(Object.assign({},it,{invId:uid()})); renderAll(); if(currentView === 'store') renderStore(); }
function useInventory(invId){ const idx = state.inventory.findIndex(i=>i.invId===invId); if(idx===-1) return; alert('¡Felicidades! Has usado tu recompensa.'); state.inventory.splice(idx,1); renderAll(); }

/* Wish modal handlers */
function openWishModal(wish=null){
  q('#modal-backdrop').classList.remove('hidden'); q('#wish-modal').classList.remove('hidden');
  q('#wish-modal-title').textContent = wish? 'Editar Deseo':'Crear Deseo';
  const form = q('#wish-form');
  form.elements.wish.value = wish? wish.text : '';
  form.onsubmit = (e)=>{ e.preventDefault(); const text = form.elements.wish.value.trim(); if(!text) return alert('Escribe algo para el deseo'); if(wish){ wish.text = text; } else { state.wishes = state.wishes || []; state.wishes.unshift({ id: uid(), text }); } closeWishModal(); renderAll(); };
  q('#cancel-wish').onclick = closeWishModal;
}
function closeWishModal(){ q('#modal-backdrop').classList.add('hidden'); q('#wish-modal').classList.add('hidden'); }

/* Question modal handlers */
function openQuestionModal(qobj=null){
  q('#modal-backdrop').classList.remove('hidden'); q('#question-modal').classList.remove('hidden');
  q('#question-modal-title').textContent = qobj? 'Editar Pregunta':'Crear Pregunta';
  const form = q('#question-form');
  form.elements.qtext.value = qobj? qobj.qtext : '';
  form.elements.answer.value = qobj? qobj.answer || '' : '';
  form.onsubmit = (e)=>{ e.preventDefault();
    const qtext = form.elements.qtext.value.trim();
    const answer = form.elements.answer.value.trim();
    if(!qtext) return alert('Escribe la pregunta');
    if(qobj){ qobj.qtext = qtext; qobj.answer = answer; } else { state.questions.unshift({ id: uid(), qtext, answer }); }
    closeQuestionModal(); renderAll();
  };
  q('#cancel-question').onclick = closeQuestionModal;
}
function closeQuestionModal(){ q('#modal-backdrop').classList.add('hidden'); q('#question-modal').classList.add('hidden'); }

/* Rule modal handlers */
function openRuleModal(rule=null){
  q('#modal-backdrop').classList.remove('hidden'); q('#rule-modal').classList.remove('hidden');
  q('#rule-modal-title').textContent = rule? 'Editar Regla':'Crear Regla';
  const form = q('#rule-form');
  form.elements.ruleText.value = rule? rule.text : '';
  form.onsubmit = (e)=>{ e.preventDefault(); const text = form.elements.ruleText.value.trim(); if(!text) return alert('Escribe la regla'); if(rule){ rule.text = text; } else { state.rules = state.rules || []; state.rules.unshift({ id: uid(), text }); } closeRuleModal(); renderAll(); };
  q('#cancel-rule').onclick = closeRuleModal;
}
function closeRuleModal(){ q('#modal-backdrop').classList.add('hidden'); q('#rule-modal').classList.add('hidden'); }

/* UI wiring */
function setupUI(){
  q('#new-task-btn').addEventListener('click', ()=>openTaskModal());
  q('#open-vault-modal-btn').addEventListener('click', openVaultModal);
  q('#close-vault').addEventListener('click', closeVaultModal);
  q('#open-inventory-modal-btn').addEventListener('click', openInventoryModal);
  q('#close-inventory').addEventListener('click', closeInventoryModal);
  // Partida: export/import game state
  q('#save-game-btn')?.addEventListener('click', exportState);
  q('#load-game-btn')?.addEventListener('click', ()=> q('#game-file-input').click());
  q('#reset-game-btn')?.addEventListener('click', resetGame);
  q('#full-reset-btn')?.addEventListener('click', fullReset);
  q('#game-file-input')?.addEventListener('change', importStateFromFile);
  qs('input[name="pointsMode"]').forEach(r=> r.addEventListener('change', e=>{ if(e.target.value==='effort'){ q('#effort-options').classList.remove('hidden'); q('#manual-option').classList.add('hidden'); } else { q('#effort-options').classList.add('hidden'); q('#manual-option').classList.remove('hidden'); } }));
  Sortable.create(q('#active-list'), {animation:150, onEnd:saveTaskOrder});
  Sortable.create(q('#archived-list'), {animation:150, onEnd:saveTaskOrder});
  qs('#sidebar .nav-button').forEach(btn => btn.addEventListener('click', (e) => { const viewId = e.currentTarget.dataset.view; switchView(viewId); }));
  const createTriggerBtn = q('#create-trigger-btn'); if(createTriggerBtn) createTriggerBtn.addEventListener('click', ()=> openTriggerModal());
  q('#create-item-btn')?.addEventListener('click',()=>openItemModal());
  q('#create-wish-btn')?.addEventListener('click', ()=> openWishModal());
  q('#create-question-btn')?.addEventListener('click', ()=> openQuestionModal());
  const createRuleBtn = q('#create-rule-btn'); if(createRuleBtn) createRuleBtn.addEventListener('click', ()=> openRuleModal());
  switchView('tasks');
}

function saveTaskOrder(){
  const activeIds = Array.from(q('#active-list').children).map(li=>li.dataset.id);
  const archivedIds = Array.from(q('#archived-list').children).map(li=>li.dataset.id);
  const ordered = [];
  activeIds.forEach(id=>{ const t = state.tasks.find(x=>x.id===id); if(t) ordered.push(t); });
  archivedIds.forEach(id=>{ const t = state.tasks.find(x=>x.id===id); if(t) ordered.push(t); });
  state.tasks.filter(t=>ordered.indexOf(t)===-1).forEach(t=>ordered.push(t));
  state.tasks = ordered; DB.save(state);
}

function switchView(viewId) {
  if (currentView === viewId) { if (viewId === 'store') renderStore(); return; }
  qs('.view').forEach(v => v.classList.add('hidden-view'));
  q(`#view-${viewId}`).classList.remove('hidden-view');
  qs('#sidebar .nav-button').forEach(btn => btn.classList.remove('active'));
  q(`#sidebar button[data-view="${viewId}"]`).classList.add('active');
  currentView = viewId;
  if (viewId === 'store') renderStore();
}

/* Expose minimal for console debugging */
window._app = { state, renderAll };

// Export current state as downloadable JSON
function exportState(){
  try{
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cazatareas_partida_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }catch(err){ alert('Error al exportar partida: '+err.message); }
}

// Import state from selected file input
function importStateFromFile(e){
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(){ try{
      const parsed = JSON.parse(reader.result);
      if(!confirm('Cargar esta partida reemplazará los datos actuales. ¿Continuar?')) return;
      // Basic validation: expect object
      if(typeof parsed !== 'object' || parsed === null) throw new Error('Archivo inválido');
      state = Object.assign({}, parsed);
      // ensure minimal keys
      state.tasks = state.tasks || [];
      state.triggers = state.triggers || [];
      state.wishes = state.wishes || [];
      state.questions = state.questions || [];
      state.rules = state.rules || [];
      state.store = state.store || [];
      state.inventory = state.inventory || [];
      state.vault = state.vault || [];
      state.points = Number(state.points||0);
      DB.save(state);
      // rebind global and re-render
      window._APP_STATE = state;
      renderAll();
      alert('Partida cargada correctamente.');
    }catch(err){ alert('Error al cargar archivo: '+err.message); }
    finally { e.target.value = ''; };
  };
  reader.readAsText(file);
}

/* Partial reset: preserve user-created items but clear progress (points, vault, inventory, completed flags) */
function resetGame(){
  if(!confirm('Reiniciar juego: esto quitará puntos, marcas de completado, almacén e inventario, pero mantendrá tus tareas, tienda y demás. ¿Continuar?')) return;
  state.points = 0;
  state.vault = [];
  state.inventory = [];
  // reset tasks progress but keep tasks themselves
  state.tasks = (state.tasks || []).map(t => Object.assign({}, t, { completed:false, everCompleted:false, completedAt: null, archived: false }));
  // keep store, triggers, wishes, questions, rules as-is
  DB.save(state);
  renderAll();
  alert('Juego reiniciado (progreso borrado).');
}

/* Full reset: clear everything from localStorage and reload a fresh state */
function fullReset(){
  if(!confirm('Reiniciar todo: esto borrará TODOS los datos guardados y recargará la aplicación. ¿Continuar?')) return;
  localStorage.removeItem('gtd_v1');
  location.reload();
}