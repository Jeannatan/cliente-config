'use strict';

/* ============================================================
   CONSTANTS & STATE
============================================================ */
const MAX_PORTAS   = 16;
const MAX_EMENDAS  = 2;
const STORAGE_KEY  = 'clientes_config_v2';

let clientes       = [];   // { id, contrato, rota, porta, endereco, emendas[], postes[] }
let editingId      = null;
let dadosPendentes = null;
let searchQuery    = '';

/* ============================================================
   DOM REFS
============================================================ */
const form          = document.getElementById('form-cliente');
const inContrato    = document.getElementById('contrato');
const inRota        = document.getElementById('rota');
const inPorta       = document.getElementById('porta');
const inEndereco    = document.getElementById('endereco');
const emendasList   = document.getElementById('emendas-list');
const postesList    = document.getElementById('postes-list');
const emendaCountLbl = document.getElementById('emenda-count-label');

const btnSubmit     = document.getElementById('btn-submit');
const btnSubmitLbl  = document.getElementById('btn-submit-label');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const btnLimpar     = document.getElementById('btn-limpar-tudo');
const btnAddEmenda  = document.getElementById('btn-add-emenda');
const btnAddPoste   = document.getElementById('btn-add-poste');

const formTitle       = document.getElementById('form-title');
const formError       = document.getElementById('form-error');
const formErrorMsg    = document.getElementById('form-error-msg');
const portaAlert      = document.getElementById('porta-alert');
const portaAlertTitle = document.getElementById('porta-alert-title');
const portaAlertDetail = document.getElementById('porta-alert-detail');
const btnCancelPorta  = document.getElementById('btn-cancel-porta');
const btnConfirmPorta = document.getElementById('btn-confirm-porta');

const totalEl      = document.getElementById('total-clientes');
const tableCountEl = document.getElementById('table-count');
const tbody        = document.getElementById('tbody-clientes');
const tableWrapper = document.getElementById('table-wrapper');
const emptyState   = document.getElementById('empty-state');
const searchInput  = document.getElementById('search-input');
const btnClearSrch = document.getElementById('btn-clear-search');
const searchEmpty  = document.getElementById('search-empty');
const searchQDisp  = document.getElementById('search-query-display');

// Dashboard KPI + sidebar refs
const portGrid       = document.getElementById('port-grid');
const kpiTotal       = document.getElementById('kpi-total');
const kpiPortsUsed   = document.getElementById('kpi-ports-used');
const kpiPortsFree   = document.getElementById('kpi-ports-free');
const kpiTopPort     = document.getElementById('kpi-top-port');
const kpiTopPortSub  = document.getElementById('kpi-top-port-sub');
const sidebarTotal   = document.getElementById('sidebar-total');
const sidebarPorts   = document.getElementById('sidebar-ports-used');

/* ============================================================
   STORAGE
============================================================ */
function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    clientes = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(clientes)) clientes = [];
    clientes = clientes.map(c => ({
      ...c,
      emendas: Array.isArray(c.emendas)
        ? c.emendas.map(e => typeof e === 'string' ? { codigo: e, foto: null } : e)
        : [],
      postes:  Array.isArray(c.postes) ? c.postes : [],
    }));
  } catch { clientes = []; }
}

function saveStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));
}

/* ============================================================
   HELPERS
============================================================ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clientesNaPorta(porta, excludeId = null) {
  return clientes.filter(c => c.porta === porta && c.id !== excludeId);
}

const REMOVE_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
</svg>`;

const CAMERA_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
  <circle cx="12" cy="13" r="4"/>
</svg>`;

function resizeImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 700;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   DYNAMIC FORM LISTS — Emendas
============================================================ */
function getEmendaCount() {
  return emendasList.querySelectorAll('.emenda-row').length;
}

function updateEmendaBtn() {
  const count = getEmendaCount();
  btnAddEmenda.classList.toggle('hidden', count >= MAX_EMENDAS);
  emendaCountLbl.textContent = `${count} / ${MAX_EMENDAS}`;
}

function addEmendaRow(value = '', foto = null) {
  if (getEmendaCount() >= MAX_EMENDAS) return;

  const num = getEmendaCount() + 1;
  const row = document.createElement('div');
  row.className = 'emenda-row flex items-center gap-2';

  const input = document.createElement('input');
  input.type        = 'text';
  input.value       = value;
  input.placeholder = `Ex: EM-${new Date().getFullYear()}-00${num}`;
  input.className   = 'form-input flex-1';

  const label = document.createElement('span');
  label.className   = 'emenda-label text-xs text-slate-500 font-medium w-16 shrink-0';
  label.textContent = `Emenda ${num}`;

  // ── Photo widget ──
  const fileInput    = document.createElement('input');
  fileInput.type     = 'file';
  fileInput.accept   = 'image/*';
  fileInput.className = 'hidden';

  const photoBtn = document.createElement('button');
  photoBtn.type      = 'button';
  photoBtn.title     = 'Adicionar foto';
  photoBtn.setAttribute('aria-label', 'Adicionar foto à emenda');
  photoBtn.className = 'shrink-0 w-7 h-7 flex items-center justify-center rounded-md '
                     + 'text-slate-500 hover:text-indigo-300 border border-slate-700 '
                     + 'hover:border-indigo-600 bg-slate-900/60 transition-colors';
  photoBtn.innerHTML = CAMERA_SVG;
  photoBtn.addEventListener('click', () => fileInput.click());

  const thumb = document.createElement('img');
  thumb.className    = 'shrink-0 w-7 h-7 rounded-md object-cover border border-indigo-700/60 cursor-pointer';
  thumb.alt          = 'Foto da emenda — clique para ampliar';
  thumb.title        = 'Ampliar foto';
  thumb.style.display = 'none';

  const removePhotoBtn = document.createElement('button');
  removePhotoBtn.type      = 'button';
  removePhotoBtn.title     = 'Remover foto';
  removePhotoBtn.setAttribute('aria-label', 'Remover foto da emenda');
  removePhotoBtn.className = 'shrink-0 w-5 h-5 flex items-center justify-center rounded-full '
                           + 'text-red-400 bg-red-950/60 border border-red-800/60 '
                           + 'hover:bg-red-900/80 transition-colors text-[11px] font-bold leading-none';
  removePhotoBtn.textContent = '×';
  removePhotoBtn.style.display = 'none';

  function attachPhoto(src) {
    row.dataset.foto             = src;
    thumb.src                    = src;
    thumb.style.display          = '';
    removePhotoBtn.style.display = '';
    photoBtn.style.display       = 'none';
  }
  function detachPhoto() {
    delete row.dataset.foto;
    thumb.src                    = '';
    thumb.style.display          = 'none';
    removePhotoBtn.style.display = 'none';
    photoBtn.style.display       = '';
  }

  if (foto) attachPhoto(foto);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    attachPhoto(await resizeImage(file));
    fileInput.value = '';
  });

  thumb.addEventListener('click', () => {
    const w = window.open('', '_blank');
    if (w) w.document.write(
      `<body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh">` +
      `<img src="${row.dataset.foto}" style="max-width:100%;max-height:100vh;object-fit:contain"></body>`
    );
  });

  removePhotoBtn.addEventListener('click', detachPhoto);

  // ── Remove row button ──
  const removeRowBtn = document.createElement('button');
  removeRowBtn.type      = 'button';
  removeRowBtn.title     = 'Remover emenda';
  removeRowBtn.setAttribute('aria-label', 'Remover esta emenda');
  removeRowBtn.className = 'shrink-0 w-7 h-7 flex items-center justify-center rounded-md '
                         + 'text-red-400 hover:bg-red-950/60 hover:text-red-300 border border-red-800/60 transition-colors';
  removeRowBtn.innerHTML = REMOVE_SVG;
  removeRowBtn.addEventListener('click', () => {
    row.remove();
    updateEmendaBtn();
    renumberEmendas();
  });

  row.append(label, input, fileInput, photoBtn, thumb, removePhotoBtn, removeRowBtn);
  emendasList.appendChild(row);
  updateEmendaBtn();
  input.focus();
}

function renumberEmendas() {
  emendasList.querySelectorAll('.emenda-row').forEach((row, i) => {
    const lbl = row.querySelector('.emenda-label');
    if (lbl) lbl.textContent = `Emenda ${i + 1}`;
    const inp = row.querySelector('input[type="text"]');
    if (inp) inp.placeholder = `Ex: EM-${new Date().getFullYear()}-00${i + 1}`;
  });
}

function getEmendasFromDOM() {
  return Array.from(emendasList.querySelectorAll('.emenda-row'))
    .map(row => ({
      codigo: (row.querySelector('input[type="text"]')?.value || '').trim(),
      foto:   row.dataset.foto || null,
    }))
    .filter(e => e.codigo !== '' || e.foto);
}

/* ============================================================
   DYNAMIC FORM LISTS — Postes
============================================================ */
function addPosteRow(value = '') {
  const row = document.createElement('div');
  row.className = 'poste-row flex items-center gap-2';

  const input = document.createElement('input');
  input.type        = 'text';
  input.value       = value;
  input.placeholder = 'Ex: PST-2024-001';
  input.className   = 'form-input flex-1';

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.title     = 'Remover poste';
  btn.className = 'shrink-0 w-7 h-7 flex items-center justify-center rounded-md '
                + 'text-red-400 hover:bg-red-950/60 hover:text-red-300 border border-red-800/60 transition-colors';
  btn.innerHTML = REMOVE_SVG;
  btn.addEventListener('click', () => row.remove());

  row.append(input, btn);
  postesList.appendChild(row);
  input.focus();
}

function getPostesFromDOM() {
  return Array.from(postesList.querySelectorAll('.poste-row input'))
    .map(el => el.value.trim()).filter(v => v !== '');
}

/* ============================================================
   CLEAR / SET FORM LISTS
============================================================ */
function clearFormLists() {
  emendasList.innerHTML = '';
  postesList.innerHTML  = '';
  updateEmendaBtn();
}

function setFormLists(emendas = [], postes = []) {
  clearFormLists();
  emendas.forEach(e => {
    if (typeof e === 'string') addEmendaRow(e, null);
    else addEmendaRow(e.codigo ?? '', e.foto ?? null);
  });
  postes.forEach(v => addPosteRow(v));
}

/* ============================================================
   FORM MODE
============================================================ */
function setEditMode(cliente) {
  editingId = cliente.id;

  inContrato.value = cliente.contrato;
  inRota.value     = cliente.rota;
  inPorta.value    = cliente.porta;
  inEndereco.value = cliente.endereco;
  setFormLists(cliente.emendas, cliente.postes);

  formTitle.textContent    = `Editando: ${cliente.contrato}`;
  btnSubmitLbl.textContent = 'Atualizar';
  btnCancelEdit.classList.remove('hidden');
  btnCancelEdit.style.display = 'flex';

  hideError();
  hidePortaAlert();
  renderTable();

  document.getElementById('form-section')
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  form.reset();
  editingId      = null;
  dadosPendentes = null;

  clearFormLists();

  formTitle.textContent    = 'Novo Cliente';
  btnSubmitLbl.textContent = 'Salvar';
  btnCancelEdit.classList.add('hidden');
  btnCancelEdit.style.display = '';

  hideError();
  hidePortaAlert();
  renderTable();
}

/* ============================================================
   VALIDATION & ALERTS
============================================================ */
function getFormData() {
  return {
    contrato: inContrato.value.trim(),
    rota:     inRota.value.trim(),
    porta:    parseInt(inPorta.value, 10),
    endereco: inEndereco.value.trim(),
    emendas:  getEmendasFromDOM(),
    postes:   getPostesFromDOM(),
  };
}

function validate({ contrato, rota, porta, endereco }) {
  if (!contrato) return 'O campo Contrato é obrigatório.';
  if (!rota)     return 'O campo Rota é obrigatório.';
  if (!endereco) return 'O campo Endereço é obrigatório.';
  if (isNaN(porta) || porta < 1 || porta > MAX_PORTAS)
    return `Porta deve ser um inteiro entre 1 e ${MAX_PORTAS}.`;
  return null;
}

function showError(msg) {
  formErrorMsg.textContent = msg;
  formError.classList.remove('hidden');
  formError.style.display = 'flex';
}
function hideError() {
  formError.classList.add('hidden');
  formError.style.display = '';
}

function showPortaAlert(porta, count) {
  portaAlertTitle.textContent  = `Porta ${porta} já em uso`;
  portaAlertDetail.textContent = `Já possui ${count} cliente(s) nesta porta. Deseja adicionar mais um?`;
  portaAlert.classList.remove('hidden');
  portaAlert.style.display = 'flex';
}
function hidePortaAlert() {
  portaAlert.classList.add('hidden');
  portaAlert.style.display = '';
}

/* ============================================================
   CRUD
============================================================ */
function salvar(dados) {
  if (editingId) {
    const idx = clientes.findIndex(c => c.id === editingId);
    if (idx !== -1) clientes[idx] = { id: editingId, ...dados };
  } else {
    clientes.push({ id: uid(), ...dados });
  }
  saveStorage();
  resetForm();
}

function editar(id) {
  const c = clientes.find(c => c.id === id);
  if (c) setEditMode(c);
}

function excluir(id) {
  const c = clientes.find(c => c.id === id);
  if (!c) return;
  if (!confirm(`Excluir o contrato "${c.contrato}" (Porta ${c.porta})?\nEsta ação não pode ser desfeita.`)) return;
  clientes = clientes.filter(c => c.id !== id);
  saveStorage();
  if (editingId === id) resetForm();
  else renderTable();
}

function limparTudo() {
  if (clientes.length === 0) return;
  if (!confirm(`Remover todos os ${clientes.length} cliente(s)?\nEsta ação não pode ser desfeita.`)) return;
  clientes = [];
  saveStorage();
  resetForm();
}

/* ============================================================
   EVENTS
============================================================ */
form.addEventListener('submit', e => {
  e.preventDefault();
  hideError();
  hidePortaAlert();
  dadosPendentes = null;

  const dados = getFormData();
  const erro  = validate(dados);
  if (erro) { showError(erro); return; }

  const ocupantes = clientesNaPorta(dados.porta, editingId);
  if (ocupantes.length > 0) {
    dadosPendentes = dados;
    showPortaAlert(dados.porta, ocupantes.length);
    return;
  }

  salvar(dados);
});

btnConfirmPorta.addEventListener('click', () => { if (dadosPendentes) salvar(dadosPendentes); });
btnCancelPorta.addEventListener('click',  () => { dadosPendentes = null; hidePortaAlert(); });
btnCancelEdit.addEventListener('click',   resetForm);
btnLimpar.addEventListener('click',       limparTudo);
btnAddEmenda.addEventListener('click',    () => addEmendaRow());
btnAddPoste.addEventListener('click',     () => addPosteRow());

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  btnClearSrch.classList.toggle('hidden',  searchQuery === '');
  btnClearSrch.style.display = searchQuery !== '' ? 'flex' : '';
  renderTable();
});

btnClearSrch.addEventListener('click', clearSearch);

function clearSearch() {
  searchQuery = '';
  searchInput.value = '';
  btnClearSrch.classList.add('hidden');
  btnClearSrch.style.display = '';
  searchInput.focus();
  renderTable();
}

/* ============================================================
   RENDER
============================================================ */
function portaBadge(porta) {
  return `<span class="port-badge port-badge-${porta}">
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
    Porta ${porta}
  </span>`;
}

function emendasCell(emendas) {
  if (!emendas || emendas.length === 0)
    return `<span class="text-slate-600 text-xs select-none">—</span>`;
  return emendas.map(e => {
    const codigo = typeof e === 'string' ? e : (e.codigo || '');
    const foto   = typeof e === 'string' ? null : (e.foto || null);
    const pill   = `<span class="inline-flex text-xs bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 rounded-md px-2 py-0.5 font-semibold whitespace-nowrap">${esc(codigo)}</span>`;
    if (!foto) return pill;
    return `<span class="inline-flex items-center gap-1.5">
      ${pill}
      <a href="${foto}" target="_blank" rel="noopener" title="Ver foto da emenda"
        class="shrink-0 w-6 h-6 rounded-md overflow-hidden border border-indigo-700/60 inline-flex hover:border-indigo-400 transition-colors">
        <img src="${foto}" class="w-full h-full object-cover" alt="Foto">
      </a>
    </span>`;
  }).join(' ');
}

function postesCell(postes) {
  if (!postes || postes.length === 0)
    return `<span class="text-slate-600 text-xs select-none">—</span>`;

  const shown = postes.slice(0, 2);
  const rest  = postes.length - 2;
  const allTitle = esc(postes.join(', '));

  let html = shown.map(p =>
    `<span class="inline-flex text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded-md px-2 py-0.5 font-semibold whitespace-nowrap">${esc(p)}</span>`
  ).join(' ');

  if (rest > 0) {
    html += ` <span class="inline-flex text-xs bg-slate-800 text-slate-400 border border-slate-700 rounded-md px-2 py-0.5 font-semibold cursor-default"
      title="${allTitle}">+${rest} mais</span>`;
  }
  return html;
}

const EDIT_BTN = `<button onclick="editar('{ID}')" title="Editar" aria-label="Editar cliente"
  class="w-8 h-8 flex items-center justify-center rounded-md bg-indigo-900/60 text-indigo-400
         border border-indigo-700/60 hover:bg-indigo-800/80 active:scale-95 transition-all">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
</button>`;

const DEL_BTN = `<button onclick="excluir('{ID}')" title="Excluir" aria-label="Excluir cliente"
  class="w-8 h-8 flex items-center justify-center rounded-md bg-red-950/60 text-red-400
         border border-red-800/60 hover:bg-red-900/80 active:scale-95 transition-all">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
  </svg>
</button>`;

/* ============================================================
   DASHBOARD — KPI cards + port heatmap
============================================================ */
function updateDashboard() {
  const portCounts = {};
  clientes.forEach(c => {
    portCounts[c.porta] = (portCounts[c.porta] || 0) + 1;
  });

  const portsUsed = Object.keys(portCounts).length;
  const portsFree = MAX_PORTAS - portsUsed;

  let topPort = null, topCount = 0;
  Object.entries(portCounts).forEach(([p, n]) => {
    if (n > topCount) { topCount = n; topPort = Number(p); }
  });

  if (kpiTotal)     kpiTotal.textContent    = clientes.length;
  if (kpiPortsUsed) kpiPortsUsed.textContent = portsUsed;
  if (kpiPortsFree) kpiPortsFree.textContent = portsFree;
  if (kpiTopPort)   kpiTopPort.textContent   = topPort ? String(topPort) : '—';
  if (kpiTopPortSub) kpiTopPortSub.textContent = topPort ? `${topCount} cliente(s)` : '—';
  if (sidebarTotal) sidebarTotal.textContent = clientes.length;
  if (sidebarPorts) sidebarPorts.textContent = `${portsUsed} / ${MAX_PORTAS}`;

  if (!portGrid) return;
  portGrid.innerHTML = '';
  const editingPorta = editingId ? clientes.find(c => c.id === editingId)?.porta : null;
  for (let i = 1; i <= MAX_PORTAS; i++) {
    const count = portCounts[i] || 0;
    const cls   = count === 0 ? 'port-cell-free'
                : count === 1 ? 'port-cell-used'
                : 'port-cell-heavy';
    const title = count === 0 ? `Porta ${i} — Livre`
                : `Porta ${i} — ${count} cliente(s)`;
    const div = document.createElement('div');
    div.className = `port-cell ${cls}${editingPorta === i ? ' port-cell-editing' : ''}`;
    div.setAttribute('role', 'listitem');
    div.title     = title;
    div.textContent = i;
    portGrid.appendChild(div);
  }
}

function renderTable() {
  totalEl.textContent = clientes.length;
  updateDashboard();

  const q = searchQuery.toLowerCase();
  const filtered = q
    ? clientes.filter(c =>
        [c.contrato, c.endereco, c.rota, String(c.porta)]
          .some(v => v.toLowerCase().includes(q))
      )
    : clientes;

  tableCountEl.textContent = q
    ? `${filtered.length} / ${clientes.length}`
    : clientes.length;

  const showEmpty       = clientes.length === 0;
  const showSearchEmpty = !showEmpty && filtered.length === 0;
  const showTable       = !showEmpty && filtered.length > 0;

  emptyState.classList.toggle('hidden', !showEmpty);

  searchEmpty.classList.toggle('hidden', !showSearchEmpty);
  searchEmpty.style.display = showSearchEmpty ? 'flex' : '';
  if (showSearchEmpty) searchQDisp.textContent = searchQuery;

  tableWrapper.classList.toggle('hidden', !showTable);

  if (!showTable) return;

  tbody.innerHTML = filtered.map(c => {
    const isEditing = c.id === editingId;
    const editBtn = EDIT_BTN.replace(/\{ID\}/g, c.id);
    const delBtn  = DEL_BTN.replace(/\{ID\}/g, c.id);

    return `<tr class="${isEditing ? 'bg-indigo-950/30 border-l-2 border-l-indigo-500' : 'hover:bg-slate-800/60'} border-b border-slate-700/50 last:border-0 transition-colors">
      <td class="px-4 py-3 font-semibold text-slate-100 whitespace-nowrap">${esc(c.contrato)}</td>
      <td class="px-4 py-3 whitespace-nowrap">
        <code class="text-xs bg-slate-900 border border-slate-700 text-sky-300 px-2 py-0.5 rounded-md font-mono">${esc(c.rota)}</code>
      </td>
      <td class="px-4 py-3 whitespace-nowrap">${portaBadge(c.porta)}</td>
      <td class="px-4 py-3 text-slate-400 text-xs max-w-[160px]">
        <span class="block truncate" title="${esc(c.endereco)}">${esc(c.endereco)}</span>
      </td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-1">${emendasCell(c.emendas)}</div>
      </td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-1">${postesCell(c.postes)}</div>
      </td>
      <td class="px-4 py-3 text-right">
        <div class="inline-flex items-center gap-1.5">${editBtn}${delBtn}</div>
      </td>
    </tr>`;
  }).join('');
}

/* ============================================================
   INIT
============================================================ */
loadStorage();
renderTable();
updateEmendaBtn();
