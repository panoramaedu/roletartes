/* ============ DETECÇÃO DE MODO OFFLINE ============ */
const IS_OFFLINE = window.IS_OFFLINE_VERSION === true;

/* ============ ESTADO GLOBAL ============ */
const state = {
  items: [],
  colors: [],
  spinning: false,
  currentAngle: 0,
  history: [],
  muted: false,
  theme: 'light',
  title: 'Minha Roleta',
  presentationMode: false,
  currentDrawn: null,
  currentDrawnIndex: null,
  activeWheelId: null,
  wheelsIndex: []
};

/* ============ PALETA EDUCACIONAL ============ */
const PALETTE = [
  '#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#3b82f6',
  '#ef4444', '#84cc16', '#f97316', '#8b5cf6', '#14b8a6', '#eab308'
];

/* ============ ELEMENTOS ============ */
const $ = id => document.getElementById(id);
const linksInput = $('linksInput');
const counterHint = $('counterHint');
const wheelEmpty = $('wheelEmpty');
const wheelWrapper = $('wheelWrapper');
const wheelCanvas = $('wheelCanvas');
const wheelStatus = $('wheelStatus');
const historyList = $('historyList');
const historyCount = $('historyCount');
const modalOverlay = $('modalOverlay');
const modalImageWrap = $('modalImageWrap');
const modalTitle = $('modalTitle');
const presentationOverlay = $('presentationOverlay');
const presentationImg = $('presentationImg');
const presentationText = $('presentationText');
const toast = $('toast');
const ctx = wheelCanvas.getContext('2d');
const uploadArea = $('uploadArea');
const imageUpload = $('imageUpload');
const storageWarning = $('storageWarning');
const offlineSection = $('offlineSection');
const offlineHint = $('offlineHint');
const btnOffline = $('btnOffline');
const confettiLayer = $('confettiLayer');
const wheelsModalOverlay = $('wheelsModalOverlay');
const wheelsList = $('wheelsList');
const dialogModalOverlay = $('dialogModalOverlay');
const dialogModalTitle = $('dialogModalTitle');
const dialogModalMessage = $('dialogModalMessage');
const dialogModalInput = $('dialogModalInput');
const dialogModalConfirm = $('dialogModalConfirm');
const dialogModalCancel = $('dialogModalCancel');

/* ============ ACESSIBILIDADE / PERFORMANCE ============ */
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastFocusedBeforeOverlay = null;

/* Tamanho lógico (CSS px) do canvas — separado da resolução real do buffer,
   que é escalada pelo devicePixelRatio para ficar nítida em telas retina. */
let wheelLogicalSize = 600;

function setupWheelCanvasDPR() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssSize = wheelCanvas.clientWidth || wheelCanvas.parentElement.clientWidth || 600;
  wheelLogicalSize = cssSize;
  const targetW = Math.round(cssSize * dpr);
  const targetH = Math.round(cssSize * dpr);
  if (wheelCanvas.width !== targetW || wheelCanvas.height !== targetH) {
    wheelCanvas.width = targetW;
    wheelCanvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ============ UTILITÁRIOS ============ */
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2500);
}

function getItemType(item) {
  if (!item) return 'text';
  if (item.startsWith('http://') || item.startsWith('https://') || item.startsWith('data:image/')) {
    return 'image';
  }
  return 'text';
}

function checkStorageQuota() {
  if (IS_OFFLINE) return true;
  try {
    const used = JSON.stringify(state.items).length + JSON.stringify(state.history).length;
    const limit = 5 * 1024 * 1024;
    if (used > limit * 0.8) {
      storageWarning.classList.add('show');
      return false;
    } else {
      storageWarning.classList.remove('show');
      return true;
    }
  } catch(e) {
    return true;
  }
}

/* ============ MÚLTIPLAS ROLETAS (armazenamento) ============
   Cada roleta vive em sua própria chave 'roletartes_wheel_<id>', com um
   índice leve em 'roletartes_wheels_index' pra listar sem carregar tudo.
   Tema e som mudo continuam globais (não fazem sentido por roleta). */
const WHEELS_INDEX_KEY = 'roletartes_wheels_index';
const ACTIVE_WHEEL_KEY = 'roletartes_active_wheel_id';
function wheelStorageKey(id) { return 'roletartes_wheel_' + id; }

function generateWheelId() {
  return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function loadWheelsIndex() {
  try {
    const raw = localStorage.getItem(WHEELS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveWheelsIndex() {
  try { localStorage.setItem(WHEELS_INDEX_KEY, JSON.stringify(state.wheelsIndex)); } catch(e) {}
}

function loadWheelData(id) {
  try {
    const raw = localStorage.getItem(wheelStorageKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function saveWheelData(wheel) {
  try {
    localStorage.setItem(wheelStorageKey(wheel.id), JSON.stringify(wheel));
  } catch(e) {
    if (e.name === 'QuotaExceededError') {
      showToast('⚠️ localStorage cheio! Remova alguns itens ou roletas.');
      storageWarning.classList.add('show');
    }
  }
}

function saveState() {
  if (IS_OFFLINE) return; // Não salvar no modo offline
  try {
    localStorage.setItem('roletartes_theme', state.theme);
    localStorage.setItem('roletartes_muted', state.muted);
    persistActiveWheel();
    checkStorageQuota();
  } catch(e) {
    if (e.name === 'QuotaExceededError') {
      showToast('⚠️ localStorage cheio! Remova alguns itens.');
      storageWarning.classList.add('show');
    }
  }
}

/* Migra o formato antigo (roleta única) para o novo formato de múltiplas
   roletas. Roda uma única vez, na primeira carga após a atualização. */
function migrateLegacyDataIfNeeded() {
  if (localStorage.getItem(WHEELS_INDEX_KEY)) return; // já migrado

  const legacyLinks = localStorage.getItem('roletartes_links');
  const legacyTitle = localStorage.getItem('roletartes_title');
  const legacyHistory = localStorage.getItem('roletartes_history');

  const id = generateWheelId();
  let items = [], history = [];
  try { if (legacyLinks) items = JSON.parse(legacyLinks) || []; } catch(e) {}
  try { if (legacyHistory) history = JSON.parse(legacyHistory) || []; } catch(e) {}

  const wheel = {
    id,
    name: legacyTitle || 'Minha Roleta',
    items, history,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  saveWheelData(wheel);
  state.wheelsIndex = [{ id, name: wheel.name, updatedAt: wheel.updatedAt }];
  saveWheelsIndex();
  localStorage.setItem(ACTIVE_WHEEL_KEY, id);

  localStorage.removeItem('roletartes_links');
  localStorage.removeItem('roletartes_title');
  localStorage.removeItem('roletartes_history');
}

function persistActiveWheel() {
  if (IS_OFFLINE || !state.activeWheelId) return;
  const previous = loadWheelData(state.activeWheelId);
  const wheel = {
    id: state.activeWheelId,
    name: state.title || 'Minha Roleta',
    items: state.items,
    history: state.history,
    createdAt: (previous && previous.createdAt) || Date.now(),
    updatedAt: Date.now()
  };
  saveWheelData(wheel);

  const entry = state.wheelsIndex.find(w => w.id === wheel.id);
  if (entry) {
    entry.name = wheel.name;
    entry.updatedAt = wheel.updatedAt;
  } else {
    state.wheelsIndex.push({ id: wheel.id, name: wheel.name, updatedAt: wheel.updatedAt });
  }
  saveWheelsIndex();
}

function applyWheelDataToState(wheel) {
  state.items = Array.isArray(wheel.items) ? wheel.items : [];
  state.history = Array.isArray(wheel.history) ? wheel.history : [];
  state.title = wheel.name || 'Minha Roleta';
  state.activeWheelId = wheel.id;
  state.currentAngle = 0;
  state.currentDrawn = null;
  state.currentDrawnIndex = null;

  $('titleEdit').value = state.title;
  document.title = state.title + ' — RoletArtes';
  linksInput.value = state.items.join('\n');

  if (state.items.length) {
    assignColors();
  } else {
    state.colors = [];
    state.sliceLabels = null;
  }
  renderWheel();
  renderHistory();
  updateCounter();
  checkStorageQuota();
}

function switchActiveWheel(id) {
  if (id === state.activeWheelId) { closeWheelsModal(); return; }
  const wheel = loadWheelData(id);
  if (!wheel) { showToast('⚠️ Não foi possível abrir essa roleta'); return; }
  persistActiveWheel(); // salva a roleta que está saindo antes de trocar
  applyWheelDataToState(wheel);
  localStorage.setItem(ACTIVE_WHEEL_KEY, id);
  closeWheelsModal();
  showToast(`🗂️ "${state.title}" aberta`);
}

function createNewWheel(name) {
  const id = generateWheelId();
  const wheel = {
    id,
    name: name || 'Nova roleta',
    items: [],
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  persistActiveWheel();
  saveWheelData(wheel);
  state.wheelsIndex.push({ id, name: wheel.name, updatedAt: wheel.updatedAt });
  saveWheelsIndex();
  applyWheelDataToState(wheel);
  localStorage.setItem(ACTIVE_WHEEL_KEY, id);
  renderWheelsList();
  showToast(`✅ Roleta "${wheel.name}" criada`);
}

function duplicateWheel(id) {
  if (id === state.activeWheelId) persistActiveWheel();
  const source = loadWheelData(id);
  if (!source) return;
  const newId = generateWheelId();
  const wheel = {
    id: newId,
    name: (source.name || 'Roleta') + ' (cópia)',
    items: [...(source.items || [])],
    history: [...(source.history || [])],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  saveWheelData(wheel);
  state.wheelsIndex.push({ id: newId, name: wheel.name, updatedAt: wheel.updatedAt });
  saveWheelsIndex();
  renderWheelsList();
  showToast(`📄 Roleta duplicada como "${wheel.name}"`);
}

function renameWheel(id) {
  const currentName = id === state.activeWheelId ? state.title : ((loadWheelData(id) || {}).name);

  openDialog({
    title: '✏️ Renomear roleta',
    message: 'Novo nome para essa roleta:',
    inputValue: currentName || 'Minha Roleta',
    confirmLabel: 'Salvar',
    onConfirm: (value) => {
      const trimmed = (value || '').trim().slice(0, 80) || 'Minha Roleta';

      if (id === state.activeWheelId) {
        state.title = trimmed;
        $('titleEdit').value = trimmed;
        document.title = trimmed + ' — RoletArtes';
        persistActiveWheel();
      } else {
        const wheel = loadWheelData(id);
        if (!wheel) return;
        wheel.name = trimmed;
        wheel.updatedAt = Date.now();
        saveWheelData(wheel);
        const entry = state.wheelsIndex.find(w => w.id === id);
        if (entry) { entry.name = trimmed; entry.updatedAt = wheel.updatedAt; }
        saveWheelsIndex();
      }
      renderWheelsList();
    }
  });
}

function deleteWheel(id) {
  if (state.wheelsIndex.length <= 1) {
    showToast('⚠️ Você precisa manter ao menos uma roleta');
    return;
  }
  const entry = state.wheelsIndex.find(w => w.id === id);
  const name = entry ? entry.name : 'esta roleta';

  openDialog({
    title: '🗑️ Excluir roleta',
    message: `Excluir "${name}"? Isso apaga os itens e o histórico dela permanentemente. Essa ação não pode ser desfeita.`,
    confirmLabel: 'Excluir',
    danger: true,
    onConfirm: () => {
      localStorage.removeItem(wheelStorageKey(id));
      state.wheelsIndex = state.wheelsIndex.filter(w => w.id !== id);
      saveWheelsIndex();

      if (id === state.activeWheelId) {
        const next = state.wheelsIndex[0];
        const nextWheel = loadWheelData(next.id) || { id: next.id, name: next.name, items: [], history: [] };
        applyWheelDataToState(nextWheel);
        localStorage.setItem(ACTIVE_WHEEL_KEY, next.id);
      }
      renderWheelsList();
      showToast('🗑️ Roleta excluída');
    }
  });
}

function renderWheelsList() {
  if (!wheelsList) return;
  if (state.wheelsIndex.length === 0) {
    wheelsList.innerHTML = '<p class="history-empty">Nenhuma roleta salva.</p>';
    return;
  }
  const sorted = [...state.wheelsIndex].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  wheelsList.innerHTML = '';
  sorted.forEach(w => {
    const isActive = w.id === state.activeWheelId;
    const itemCount = isActive ? state.items.length : ((loadWheelData(w.id) || {}).items || []).length;
    const div = document.createElement('div');
    div.className = 'wheel-card' + (isActive ? ' active' : '');
    div.innerHTML = `
      <div class="wheel-card-info">
        <div class="wheel-card-name">${escapeHtml(w.name)} ${isActive ? '<span class="wheel-active-badge">Ativa</span>' : ''}</div>
        <div class="wheel-card-meta">${itemCount} item${itemCount !== 1 ? 'ns' : ''}</div>
      </div>
      <div class="wheel-card-actions">
        ${!isActive ? `<button type="button" class="icon-btn" data-action="open" title="Abrir esta roleta" aria-label="Abrir ${escapeHtml(w.name)}">📂</button>` : ''}
        <button type="button" class="icon-btn" data-action="rename" title="Renomear" aria-label="Renomear ${escapeHtml(w.name)}">✏️</button>
        <button type="button" class="icon-btn" data-action="duplicate" title="Duplicar" aria-label="Duplicar ${escapeHtml(w.name)}">📄</button>
        <button type="button" class="icon-btn" data-action="delete" title="Excluir" aria-label="Excluir ${escapeHtml(w.name)}">🗑️</button>
      </div>
    `;
    div.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action === 'open') switchActiveWheel(w.id);
        else if (action === 'rename') renameWheel(w.id);
        else if (action === 'duplicate') duplicateWheel(w.id);
        else if (action === 'delete') deleteWheel(w.id);
      });
    });
    wheelsList.appendChild(div);
  });
}

function openWheelsModal() {
  if (IS_OFFLINE) { showToast('⚠️ Indisponível no modo offline'); return; }
  lastFocusedBeforeOverlay = document.activeElement;
  renderWheelsList();
  wheelsModalOverlay.classList.add('active');
  requestAnimationFrame(() => $('btnNewWheel').focus());
}

function closeWheelsModal() {
  wheelsModalOverlay.classList.remove('active');
  if (lastFocusedBeforeOverlay && document.body.contains(lastFocusedBeforeOverlay)) {
    lastFocusedBeforeOverlay.focus();
  }
  lastFocusedBeforeOverlay = null;
}

/* ============ DIÁLOGO GENÉRICO ============
   Substitui window.prompt()/window.confirm() por um modal do próprio site,
   consistente visualmente e acessível (foco preso, Esc fecha, etc).
   Uso:
     openDialog({ title, message, confirmLabel, danger, onConfirm })                    // tipo "confirm"
     openDialog({ title, message, inputValue, confirmLabel, onConfirm(value) })          // tipo "prompt"
   onConfirm só é chamado se a pessoa confirmar; cancelar/fechar não faz nada
   (igual ao comportamento de prompt() retornando null / confirm() retornando false). */
let lastFocusedBeforeDialog = null;
let dialogOnConfirm = null;

function openDialog({ title, message, inputValue, confirmLabel = 'Confirmar', danger = false, onConfirm }) {
  dialogModalTitle.textContent = title;
  dialogModalMessage.textContent = message || '';
  dialogModalConfirm.textContent = confirmLabel;
  dialogModalConfirm.classList.toggle('btn-danger-confirm', !!danger);

  const hasInput = inputValue !== undefined && inputValue !== null;
  dialogModalInput.style.display = hasInput ? 'block' : 'none';
  dialogModalInput.value = hasInput ? inputValue : '';

  dialogOnConfirm = () => {
    if (onConfirm) onConfirm(hasInput ? dialogModalInput.value : undefined);
  };

  lastFocusedBeforeDialog = document.activeElement;
  dialogModalOverlay.classList.add('active');
  requestAnimationFrame(() => {
    if (hasInput) {
      dialogModalInput.focus();
      dialogModalInput.select();
    } else {
      dialogModalConfirm.focus();
    }
  });
}

function closeDialog(confirmed) {
  dialogModalOverlay.classList.remove('active');
  if (confirmed && dialogOnConfirm) dialogOnConfirm();
  dialogOnConfirm = null;
  if (lastFocusedBeforeDialog && document.body.contains(lastFocusedBeforeDialog)) {
    lastFocusedBeforeDialog.focus();
  } else if (wheelsModalOverlay.classList.contains('active')) {
    // O elemento original (ex.: botão de uma roleta na lista) pode ter sido
    // recriado ao re-renderizar a lista — cai para um alvo estável no modal.
    ($('btnNewWheel') || wheelsModalOverlay).focus();
  }
  lastFocusedBeforeDialog = null;
}

function loadState() {
  // MODO OFFLINE: usar dados embutidos
  if (IS_OFFLINE && window.OFFLINE_DATA) {
    state.items = window.OFFLINE_DATA.items || [];
    state.title = window.OFFLINE_DATA.title || 'RoletArtes Offline';
    state.theme = window.OFFLINE_DATA.theme || 'light';
    state.muted = window.OFFLINE_DATA.muted || false;
    
    $('titleEdit').value = state.title;
    document.title = state.title + ' — RoletArtes Offline';
    applyTheme();
    
    if (state.muted) {
      $('btnMute').textContent = '🔇';
      $('btnMute').setAttribute('aria-pressed', 'true');
    }
    
    if (state.items.length) {
      linksInput.value = state.items.join('\n');
      assignColors();
      renderWheel();
    }
    
    // Ajustar UI para modo offline
    if (offlineSection) offlineSection.style.display = 'none';
    if (offlineHint) offlineHint.style.display = 'block';
    if ($('btnWheels')) $('btnWheels').style.display = 'none';
    
    updateCounter();
    return;
  }
  
  // MODO ONLINE: múltiplas roletas
  try {
    migrateLegacyDataIfNeeded();
    state.wheelsIndex = loadWheelsIndex();
    
    const theme = localStorage.getItem('roletartes_theme');
    const muted = localStorage.getItem('roletartes_muted');
    if (theme) { state.theme = theme; applyTheme(); }
    if (muted === 'true') { state.muted = true; $('btnMute').textContent = '🔇'; $('btnMute').setAttribute('aria-pressed', 'true'); }
    
    let activeId = localStorage.getItem(ACTIVE_WHEEL_KEY);
    let wheel = activeId ? loadWheelData(activeId) : null;
    
    // Sem roleta ativa válida (primeiro acesso, dados corrompidos, etc.): usa a
    // primeira do índice, ou cria uma nova roleta vazia se não existir nenhuma.
    if (!wheel) {
      if (state.wheelsIndex.length) {
        wheel = loadWheelData(state.wheelsIndex[0].id);
        activeId = state.wheelsIndex[0].id;
      }
      if (!wheel) {
        activeId = generateWheelId();
        wheel = { id: activeId, name: 'Minha Roleta', items: [], history: [], createdAt: Date.now(), updatedAt: Date.now() };
        saveWheelData(wheel);
        state.wheelsIndex = [{ id: activeId, name: wheel.name, updatedAt: wheel.updatedAt }];
        saveWheelsIndex();
      }
      localStorage.setItem(ACTIVE_WHEEL_KEY, activeId);
    }
    
    applyWheelDataToState(wheel);
  } catch(e) {}
}

/* ============ UPLOAD DE IMAGENS ============ */
function handleImageUpload(files) {
  if (IS_OFFLINE) {
    showToast('⚠️ Modo offline: não é possível adicionar novas imagens');
    return;
  }
  
  const fileArray = Array.from(files);
  if (fileArray.length === 0) return;
  
  const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB por imagem
  let processed = 0;
  let added = 0;
  let skippedType = 0;
  let skippedSize = 0;
  const total = fileArray.length;
  
  function finalize() {
    if (processed !== total) return;
    if (added > 0) {
      linksInput.value = state.items.join('\n');
      assignColors();
      renderWheel();
      saveState();
      updateCounter();
    }
    if (added > 0 && skippedType === 0 && skippedSize === 0) {
      showToast(`✅ ${added} imagem${added > 1 ? 'ns' : ''} adicionada${added > 1 ? 's' : ''}`);
    } else if (added > 0) {
      showToast(`✅ ${added} adicionada${added > 1 ? 's' : ''}, ${skippedType + skippedSize} ignorada${(skippedType + skippedSize) > 1 ? 's' : ''}`);
    } else if (skippedSize > 0) {
      showToast('⚠️ Imagem(ns) muito grande(s) para adicionar (máx. 8MB cada)');
    } else {
      showToast('⚠️ Nenhum arquivo de imagem válido selecionado');
    }
  }
  
  fileArray.forEach(file => {
    if (!file.type.startsWith('image/')) {
      skippedType++;
      processed++;
      finalize();
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      skippedSize++;
      processed++;
      finalize();
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      state.items.push(dataUrl);
      added++;
      processed++;
      finalize();
    };
    reader.onerror = () => {
      skippedType++;
      processed++;
      finalize();
    };
    reader.readAsDataURL(file);
  });
}

function updateCounter() {
  const total = state.items.length;
  const imageCount = state.items.filter(item => getItemType(item) === 'image').length;
  const textCount = total - imageCount;
  counterHint.textContent = `${total} ite${total !== 1 ? 'ns' : 'm'} (${imageCount} image${imageCount !== 1 ? 'ns' : 'm'}, ${textCount} texto${textCount !== 1 ? 's' : ''})`;
}

/* ============ CORES SEM REPETIÇÃO ADJACENTE ============ */
function assignColors() {
  const n = state.items.length;
  state.colors = [];
  state.sliceLabels = null;
  if (n === 0) return;
  const P = PALETTE.length;
  let step = 1;
  for (let s = 3; s < P; s++) {
    if (gcd(s, P) === 1) { step = s; break; }
  }
  let idx = 0;
  for (let i = 0; i < n; i++) {
    let color = PALETTE[idx % P];
    if (i > 0 && color === state.colors[i-1]) {
      color = PALETTE[(idx + 1) % P];
      idx++;
    }
    if (i === n - 1 && n > 1 && color === state.colors[0]) {
      color = PALETTE[(idx + 1) % P];
    }
    state.colors.push(color);
    idx = (idx + step) % P;
  }
}

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

/* ============ RÓTULOS DAS FATIAS (cache) ============
   Calculado uma vez por carregamento de itens, não a cada frame da animação. */
function computeSliceLabels() {
  const n = state.items.length;
  state.sliceLabels = [];
  if (n === 0) return;
  const size = wheelLogicalSize;
  const r = size / 2 - 4;
  const sliceAngle = (Math.PI * 2) / n;
  const sliceDeg = (sliceAngle * 180) / Math.PI;

  for (let i = 0; i < n; i++) {
    const item = state.items[i];
    const type = getItemType(item);

    if (type === 'text' && sliceDeg >= 12 && n <= 40) {
      const fontSize = Math.max(10, Math.min(18, (sliceAngle * r * 0.4)));
      ctx.font = `bold ${fontSize}px Fredoka, sans-serif`;
      const maxArcLen = sliceAngle * r * 0.85;
      let displayText = item;
      while (ctx.measureText(displayText).width > maxArcLen && displayText.length > 1) {
        displayText = displayText.slice(0, -1);
      }
      if (displayText !== item) displayText += '…';
      state.sliceLabels.push({ text: displayText, fontSize });
    } else {
      const fontSize = Math.max(12, Math.min(22, 400 / n));
      state.sliceLabels.push({ text: String(i + 1), fontSize });
    }
  }
}

/* ============ RENDERIZAÇÃO DA ROLETA ============ */
function renderWheel() {
  const n = state.items.length;
  if (n === 0) {
    wheelEmpty.style.display = 'block';
    wheelWrapper.style.display = 'none';
    return;
  }
  wheelEmpty.style.display = 'none';
  wheelWrapper.style.display = 'block';
  
  setupWheelCanvasDPR();
  const size = wheelLogicalSize;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 4;
  const sliceAngle = (Math.PI * 2) / n;
  
  ctx.clearRect(0, 0, size, size);
  
  if (!state.sliceLabels || state.sliceLabels.length !== n) computeSliceLabels();
  
  for (let i = 0; i < n; i++) {
    const start = state.currentAngle + i * sliceAngle;
    const end = start + sliceAngle;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = state.colors[i];
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const mid = start + sliceAngle / 2;
    const tr = r * 0.72;
    const tx = cx + Math.cos(mid) * tr;
    const ty = cy + Math.sin(mid) * tr;
    
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    
    const label = state.sliceLabels[i];
    ctx.font = `bold ${label.fontSize}px Fredoka, sans-serif`;
    ctx.fillText(label.text, 0, 0);
    
    ctx.restore();
  }
  
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/* ============ ANIMAÇÃO DE GIRO ============ */
function spinWheel() {
  if (state.spinning || state.items.length === 0) return;
  if (state.items.length === 1) {
    drawItem(0);
    return;
  }
  
  state.spinning = true;
  wheelCanvas.classList.add('spinning');
  wheelWrapper.classList.add('spinning');
  wheelStatus.textContent = 'Girando...';
  
  const extraTurns = prefersReducedMotion ? 1.2 : (5 + Math.random() * 3);
  const randomFinal = Math.random() * Math.PI * 2;
  const totalRotation = extraTurns * Math.PI * 2 + randomFinal;
  const startAngle = state.currentAngle;
  const duration = prefersReducedMotion ? 900 : (4500 + Math.random() * 1500);
  const startTime = performance.now();
  
  let lastTickSlice = -1;
  
  function animate(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    state.currentAngle = startAngle + totalRotation * eased;
    renderWheel();
    
    const n = state.items.length;
    const sliceAngle = (Math.PI * 2) / n;
    const pointerAngle = -Math.PI / 2;
    const normalizedAngle = ((pointerAngle - state.currentAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const currentSlice = Math.floor(normalizedAngle / sliceAngle);
    if (currentSlice !== lastTickSlice) {
      lastTickSlice = currentSlice;
      playTick();
    }
    
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      state.spinning = false;
      wheelCanvas.classList.remove('spinning');
      wheelWrapper.classList.remove('spinning');
      const finalNormalized = ((pointerAngle - state.currentAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const winningIndex = Math.floor(finalNormalized / sliceAngle) % n;
      playWin();
      drawItem(winningIndex);
    }
  }
  
  requestAnimationFrame(animate);
}

/* ============ SORTEIO E MODAL ============ */
function drawItem(index) {
  const item = state.items[index];
  const color = state.colors[index] || null;
  state.currentDrawn = item;
  state.currentDrawnIndex = index;
  wheelStatus.textContent = 'Sorteado!';
  showModal(item);
  addToHistory(item, color);
  burstConfetti();
}

function showModal(item) {
  lastFocusedBeforeOverlay = document.activeElement;
  modalOverlay.classList.add('active');
  modalImageWrap.innerHTML = '';
  modalImageWrap.classList.remove('text-mode');
  
  const type = getItemType(item);
  
  if (type === 'image') {
    modalTitle.textContent = '🎉 Imagem sorteada!';
    const loader = document.createElement('div');
    loader.className = 'loader';
    modalImageWrap.appendChild(loader);
    
    const img = new Image();
    img.onload = () => {
      modalImageWrap.innerHTML = '';
      modalImageWrap.appendChild(img);
    };
    img.onerror = () => {
      modalImageWrap.innerHTML = '<div class="error-msg">⚠️ Não foi possível carregar a imagem.</div>';
    };
    img.src = item;
    img.alt = 'Imagem sorteada';
  } else {
    modalTitle.textContent = '🎉 Sorteado!';
    modalImageWrap.classList.add('text-mode');
    const textDiv = document.createElement('div');
    textDiv.className = 'text-display';
    textDiv.textContent = item;
    modalImageWrap.appendChild(textDiv);
  }
  
  requestAnimationFrame(() => $('btnRemove').focus());
}

function closeModal() {
  modalOverlay.classList.remove('active');
  state.currentDrawn = null;
  state.currentDrawnIndex = null;
  wheelStatus.textContent = 'Clique na roleta para girar';
  if (lastFocusedBeforeOverlay && document.body.contains(lastFocusedBeforeOverlay)) {
    lastFocusedBeforeOverlay.focus();
  }
  lastFocusedBeforeOverlay = null;
}

function trapFocus(container, e) {
  const focusables = container.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

$('modalOverlay').addEventListener('keydown', e => {
  if (e.key === 'Tab') trapFocus($('modalOverlay').querySelector('.modal'), e);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============ HISTÓRICO ============ */
function addToHistory(item, color) {
  state.history.unshift({ url: item, time: Date.now(), color: color || 'var(--primary)' });
  if (state.history.length > 50) state.history.pop();
  renderHistory();
  saveState();
}

function renderHistory() {
  historyCount.textContent = state.history.length;
  if (state.history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">Nenhum sorteio ainda.</div>';
    return;
  }
  historyList.innerHTML = '';
  state.history.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.style.setProperty('--item-accent', item.color || 'var(--primary)');
    
    const type = getItemType(item.url);
    let mediaHtml;
    
    if (type === 'image') {
      mediaHtml = `<img src="${escapeHtml(item.url)}" alt="" loading="lazy" onerror="this.style.opacity=0.3"/>`;
    } else {
      mediaHtml = `<div class="history-text-icon" style="background:color-mix(in srgb, ${item.color || 'var(--primary)'} 18%, transparent); color:${item.color || 'var(--primary)'};">📝</div>`;
    }
    
    let displayUrl;
    if (type === 'text') {
      displayUrl = escapeHtml(item.url);
    } else if (item.url.startsWith('data:')) {
      displayUrl = '📷 Imagem local';
    } else {
      displayUrl = escapeHtml(item.url);
    }
    
    div.innerHTML = `
      ${mediaHtml}
      <div class="history-item-info">
        <div class="history-item-num">#${state.history.length - i}</div>
        <div class="history-item-url ${type === 'text' ? 'text-item' : ''}" title="${escapeHtml(item.url)}">${displayUrl}</div>
      </div>
    `;
    historyList.appendChild(div);
  });
}

/* ============ CONFETE ============ */
const CONFETTI_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'];
function burstConfetti() {
  if (prefersReducedMotion || !confettiLayer) return;
  const count = 46;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDuration = (2 + Math.random() * 1.4) + 's';
    piece.style.animationDelay = (Math.random() * 0.3) + 's';
    confettiLayer.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }
}

/* ============ ÁUDIO ============ */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { return null; }
  }
  return audioCtx;
}

function playTick() {
  if (state.muted) return;
  const ac = getAudioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = 800 + Math.random() * 200;
  gain.gain.setValueAtTime(0.05, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
  osc.connect(gain); gain.connect(ac.destination);
  osc.start(); osc.stop(ac.currentTime + 0.05);
}

function playWin() {
  if (state.muted) return;
  const ac = getAudioCtx();
  if (!ac) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = ac.currentTime + i * 0.1;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(t); osc.stop(t + 0.3);
  });
}

/* ============ TEMA ============ */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $('btnTheme').textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

/* ============ GERAR VERSÃO OFFLINE ============ */
async function generateOfflineHTML() {
  if (state.items.length === 0) {
    showToast('⚠️ Adicione itens à roleta primeiro');
    return;
  }
  
  btnOffline.disabled = true;
  btnOffline.textContent = '⏳ Gerando...';
  
  try {
    // Buscar CSS e JS atuais
    const [cssText, jsText] = await Promise.all([
      fetch('style.css').then(r => r.text()),
      fetch('script.js').then(r => r.text())
    ]);
    
    // Dados a embutir
    const offlineData = {
      items: state.items,
      title: state.title,
      theme: state.theme,
      muted: state.muted,
      generatedAt: new Date().toISOString()
    };
    
    // Montar HTML completo
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#7c3aed" />
  <title>${escapeHtml(state.title)} — RoletArtes Offline</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎨</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
${cssText}
  </style>
</head>
<body>

<header>
  <div class="logo"><span class="logo-icon" aria-hidden="true">🎨</span> RoletArtes</div>
  <label for="titleEdit" class="sr-only">Título da roleta</label>
  <input type="text" class="title-edit" id="titleEdit" placeholder="Digite o título da roleta..." value="${escapeHtml(state.title)}" />
  <div class="header-actions">
    <button type="button" class="icon-btn" id="btnWheels" title="Minhas roletas" aria-label="Abrir gerenciador de roletas salvas" style="display:none;">🗂️</button>
    <button type="button" class="icon-btn" id="btnMute" title="Ativar/desativar som" aria-label="Ativar ou desativar som" aria-pressed="${state.muted}">${state.muted ? '🔇' : '🔊'}</button>
    <button type="button" class="icon-btn" id="btnTheme" title="Alternar tema" aria-label="Alternar entre tema claro e escuro">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
    <button type="button" class="icon-btn" id="btnPresent" title="Modo apresentação" aria-label="Abrir modo apresentação">⛶</button>
  </div>
</header>

<main>
  <section class="panel">
    <h2>📥 Itens da roleta</h2>
    <label for="linksInput" class="sr-only">Itens da roleta</label>
    <textarea id="linksInput" placeholder="Itens carregados...">${escapeHtml(state.items.join('\\n'))}</textarea>
    <p class="hint" id="counterHint" aria-live="polite">0 itens carregados</p>
    
    <div class="upload-area" id="uploadArea" style="display:none;">
      <div class="upload-area-icon" aria-hidden="true">📤</div>
      <div class="upload-area-text">Clique ou arraste imagens aqui</div>
    </div>
    <input type="file" id="imageUpload" class="file-input" accept="image/*" multiple aria-hidden="true" tabindex="-1" />
    
    <div class="storage-warning" id="storageWarning" role="alert">
      ⚠️ Atenção: localStorage tem limite de ~5MB.
    </div>
    
    <div class="btn-row">
      <button type="button" class="btn btn-primary" id="btnLoad">🎯 Carregar</button>
      <button type="button" class="btn btn-secondary" id="btnExport">💾 Exportar JSON</button>
      <button type="button" class="btn btn-secondary" id="btnImport">📂 Importar</button>
      <input type="file" id="fileInput" class="file-input" accept=".json" aria-hidden="true" tabindex="-1" />
    </div>
    
    <p class="offline-hint" id="offlineHint" style="display:block;">
      💡 Esta é uma versão offline. Os dados já estão embutidos neste arquivo.
    </p>
  </section>

  <section class="panel wheel-container">
    <div id="wheelArea">
      <div class="wheel-empty" id="wheelEmpty" style="display:none;">
        <div class="wheel-empty-icon" aria-hidden="true">🎡</div>
        <p>Nenhum item carregado.</p>
      </div>
      <div class="wheel-wrapper" id="wheelWrapper" style="display:block;">
        <div class="wheel-pointer" aria-hidden="true"></div>
        <canvas class="wheel" id="wheelCanvas" width="600" height="600" role="button" tabindex="0" aria-label="Roleta. Pressione Enter ou Espaço para girar."></canvas>
        <div class="wheel-center" aria-hidden="true">🎨</div>
      </div>
    </div>
    <div class="wheel-status" id="wheelStatus" aria-live="polite">Clique na roleta para girar</div>
  </section>

  <aside class="panel">
    <h2>📜 Histórico <span class="badge" id="historyCount" aria-live="polite">0</span></h2>
    <div class="history-list" id="historyList" aria-live="polite">
      <div class="history-empty">Nenhum sorteio ainda.</div>
    </div>
    <div class="btn-row" style="margin-top: 12px;">
      <button type="button" class="btn btn-ghost" id="btnClearHistory" style="flex:1;">🗑️ Limpar histórico</button>
    </div>
  </aside>
</main>

<div class="modal-overlay" id="modalOverlay">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <div class="modal-header">
      <h3 id="modalTitle">🎉 Sorteado!</h3>
      <button type="button" class="modal-close" id="modalClose" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body">
      <div class="modal-image-wrap" id="modalImageWrap">
        <div class="loader" id="modalLoader" role="status" aria-label="Carregando"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-highlight" id="btnRemove">⭐ Remover</button>
        <button type="button" class="btn btn-secondary" id="btnContinue">▶ Continuar</button>
        <button type="button" class="btn btn-secondary" id="btnRespin">🔄 Sortear de novo</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="dialogModalOverlay">
  <div class="modal dialog-modal" role="dialog" aria-modal="true" aria-labelledby="dialogModalTitle">
    <div class="modal-header">
      <h3 id="dialogModalTitle">Título</h3>
      <button type="button" class="modal-close" id="dialogModalClose" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body dialog-modal-body">
      <p id="dialogModalMessage"></p>
      <label for="dialogModalInput" class="sr-only">Valor</label>
      <input type="text" id="dialogModalInput" class="dialog-input" style="display:none;" />
      <div class="modal-actions dialog-modal-actions">
        <button type="button" class="btn btn-secondary" id="dialogModalCancel">Cancelar</button>
        <button type="button" class="btn btn-primary" id="dialogModalConfirm">Confirmar</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="wheelsModalOverlay">
  <div class="modal wheels-modal" role="dialog" aria-modal="true" aria-labelledby="wheelsModalTitle">
    <div class="modal-header">
      <h3 id="wheelsModalTitle">🗂️ Minhas roletas</h3>
      <button type="button" class="modal-close" id="wheelsModalClose" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body wheels-modal-body">
      <button type="button" class="btn btn-primary" id="btnNewWheel" style="width:100%; justify-content:center;">➕ Nova roleta</button>
      <div class="wheels-list" id="wheelsList" aria-live="polite"></div>
    </div>
  </div>
</div>

<div class="presentation-overlay" id="presentationOverlay" role="dialog" aria-modal="true" aria-label="Modo apresentação">
  <button type="button" class="presentation-close" id="presentationClose" aria-label="Fechar modo apresentação">×</button>
  <img id="presentationImg" src="" alt="" />
  <div class="presentation-text" id="presentationText"></div>
</div>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<div class="confetti-layer" id="confettiLayer" aria-hidden="true"></div>

<footer class="app-footer">
  <p>Plataforma desenvolvida por Gabriel Alves | <a href="https://panoramaedu.onrender.com/" target="_blank" rel="noopener noreferrer">Panorama Educação</a></p>
  <p class="donation-text">Ajude a manter essa ferramenta! <a href="https://exemplo.com/doacao" target="_blank" rel="noopener noreferrer" class="donation-link">Faça uma doação! ❤️</a></p>
</footer>

<script>
window.IS_OFFLINE_VERSION = true;
window.OFFLINE_DATA = ${JSON.stringify(offlineData)};
<\/script>

<script>
${jsText}
<\/script>
</body>
</html>`;
    
    // Criar Blob e disparar download
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = state.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'roletartes';
    a.href = url;
    a.download = `${safeTitle}_offline.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('✅ Versão offline gerada com sucesso!');
  } catch(err) {
    console.error(err);
    showToast('⚠️ Erro ao gerar versão offline. Tente hospedar o site primeiro.');
  } finally {
    btnOffline.disabled = false;
    btnOffline.textContent = '📦 Baixar versão offline';
  }
}

/* ============ EVENTOS ============ */
$('btnLoad').addEventListener('click', () => {
  const raw = linksInput.value;
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const unique = [...new Set(lines)];
  
  state.items = unique;
  assignColors();
  state.currentAngle = 0;
  renderWheel();
  updateCounter();
  saveState();
  if (state.items.length > 0) showToast('✅ Roleta carregada!');
  else showToast('⚠️ Nenhum item válido encontrado');
});

linksInput.addEventListener('input', () => {
  const lines = linksInput.value.split('\n').filter(l => l.trim().length > 0);
  counterHint.textContent = `${lines.length} linha${lines.length !== 1 ? 's' : ''} detectada${lines.length !== 1 ? 's' : ''}`;
});

uploadArea.addEventListener('click', () => imageUpload.click());
imageUpload.addEventListener('change', (e) => {
  handleImageUpload(e.target.files);
  e.target.value = '';
});

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = 'var(--primary)';
  uploadArea.style.background = 'var(--primary-soft)';
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.style.borderColor = '';
  uploadArea.style.background = '';
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = '';
  uploadArea.style.background = '';
  handleImageUpload(e.dataTransfer.files);
});

$('btnExport').addEventListener('click', () => {
  if (state.items.length === 0) { showToast('⚠️ Nada para exportar'); return; }
  const data = {
    title: state.title,
    items: state.items,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `roletartes-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 JSON exportado!');
});

$('btnImport').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const MAX_IMPORT_SIZE = 25 * 1024 * 1024; // 25MB
  if (file.size > MAX_IMPORT_SIZE) {
    showToast('⚠️ Arquivo muito grande para importar');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data.items)) {
        const cleaned = [...new Set(
          data.items
            .filter(v => typeof v === 'string')
            .map(v => v.trim())
            .filter(v => v.length > 0)
        )];
        if (cleaned.length === 0) {
          showToast('⚠️ O arquivo não contém itens válidos');
          return;
        }
        state.items = cleaned;
        linksInput.value = cleaned.join('\n');
        if (typeof data.title === 'string' && data.title.trim()) {
          state.title = data.title.trim().slice(0, 120);
          $('titleEdit').value = state.title;
          document.title = state.title + ' — RoletArtes';
        }
        assignColors();
        state.currentAngle = 0;
        renderWheel();
        saveState();
        updateCounter();
        showToast(`📂 ${cleaned.length} item${cleaned.length !== 1 ? 'ns' : ''} importado${cleaned.length !== 1 ? 's' : ''}!`);
      } else {
        showToast('⚠️ JSON inválido: esperado um campo "items" com uma lista');
      }
    } catch(err) {
      showToast('⚠️ Erro ao ler arquivo');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

$('titleEdit').addEventListener('input', e => {
  state.title = e.target.value || 'Minha Roleta';
  document.title = state.title + ' — RoletArtes';
  saveState();
});

$('btnTheme').addEventListener('click', () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  saveState();
});

$('btnMute').addEventListener('click', () => {
  state.muted = !state.muted;
  $('btnMute').textContent = state.muted ? '🔇' : '🔊';
  $('btnMute').classList.toggle('active', state.muted);
  $('btnMute').setAttribute('aria-pressed', String(state.muted));
  saveState();
});

$('btnPresent').addEventListener('click', () => {
  if (!state.currentDrawn) {
    showToast('⚠️ Sorteie um item primeiro');
    return;
  }
  
  const type = getItemType(state.currentDrawn);
  presentationOverlay.classList.remove('text-mode');
  
  if (type === 'image') {
    presentationImg.onerror = () => {
      presentationText.textContent = '⚠️ Não foi possível carregar esta imagem.';
      presentationOverlay.classList.add('text-mode');
    };
    presentationImg.onload = () => {
      presentationOverlay.classList.remove('text-mode');
    };
    presentationImg.src = state.currentDrawn;
  } else {
    presentationText.textContent = state.currentDrawn;
    presentationOverlay.classList.add('text-mode');
  }
  
  lastFocusedBeforeOverlay = document.activeElement;
  presentationOverlay.classList.add('active');
  state.presentationMode = true;
  requestAnimationFrame(() => $('presentationClose').focus());
});

$('presentationClose').addEventListener('click', () => {
  presentationOverlay.classList.remove('active');
  presentationOverlay.classList.remove('text-mode');
  state.presentationMode = false;
  if (lastFocusedBeforeOverlay && document.body.contains(lastFocusedBeforeOverlay)) {
    lastFocusedBeforeOverlay.focus();
  }
  lastFocusedBeforeOverlay = null;
});

wheelCanvas.addEventListener('click', spinWheel);

$('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

$('btnWheels').addEventListener('click', openWheelsModal);
$('wheelsModalClose').addEventListener('click', closeWheelsModal);
wheelsModalOverlay.addEventListener('click', e => { if (e.target === wheelsModalOverlay) closeWheelsModal(); });
wheelsModalOverlay.addEventListener('keydown', e => {
  if (e.key === 'Tab') trapFocus(wheelsModalOverlay.querySelector('.modal'), e);
});
$('btnNewWheel').addEventListener('click', () => {
  openDialog({
    title: '➕ Nova roleta',
    message: 'Como você quer chamar essa roleta?',
    inputValue: 'Nova roleta',
    confirmLabel: 'Criar',
    onConfirm: (value) => {
      createNewWheel((value || '').trim().slice(0, 80) || 'Nova roleta');
    }
  });
});

dialogModalConfirm.addEventListener('click', () => closeDialog(true));
dialogModalCancel.addEventListener('click', () => closeDialog(false));
$('dialogModalClose').addEventListener('click', () => closeDialog(false));
dialogModalOverlay.addEventListener('click', e => { if (e.target === dialogModalOverlay) closeDialog(false); });
dialogModalOverlay.addEventListener('keydown', e => {
  if (e.key === 'Tab') trapFocus(dialogModalOverlay.querySelector('.modal'), e);
  if (e.key === 'Escape') { e.stopPropagation(); closeDialog(false); }
});
dialogModalInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); closeDialog(true); }
});

$('btnRemove').addEventListener('click', () => {
  if (!state.currentDrawn) return;
  let idx = state.currentDrawnIndex;
  // Segurança: se por algum motivo o índice não corresponder mais ao item sorteado,
  // cai para remover pela primeira ocorrência do valor (comportamento antigo).
  if (idx == null || state.items[idx] !== state.currentDrawn) {
    idx = state.items.indexOf(state.currentDrawn);
  }
  if (idx === -1 || idx == null) { closeModal(); return; }
  state.items.splice(idx, 1);
  linksInput.value = state.items.join('\n');
  assignColors();
  renderWheel();
  updateCounter();
  saveState();
  closeModal();
  showToast('⭐ Item removido da roleta');
});

$('btnContinue').addEventListener('click', closeModal);

$('btnRespin').addEventListener('click', () => {
  closeModal();
  setTimeout(spinWheel, 300);
});

$('btnClearHistory').addEventListener('click', () => {
  if (state.history.length === 0) return;
  openDialog({
    title: '🗑️ Limpar histórico',
    message: 'Tem certeza que deseja limpar todo o histórico de sorteios desta roleta?',
    confirmLabel: 'Limpar',
    danger: true,
    onConfirm: () => {
      state.history = [];
      renderHistory();
      saveState();
      showToast('🗑️ Histórico limpo');
    }
  });
});

// Handler do botão offline
if (btnOffline) {
  btnOffline.addEventListener('click', generateOfflineHTML);
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.items.length && !state.spinning) {
      state.sliceLabels = null;
      renderWheel();
    }
  }, 150);
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') {
    if (state.presentationMode) {
      presentationOverlay.classList.remove('active');
      presentationOverlay.classList.remove('text-mode');
      state.presentationMode = false;
      if (lastFocusedBeforeOverlay && document.body.contains(lastFocusedBeforeOverlay)) {
        lastFocusedBeforeOverlay.focus();
      }
      lastFocusedBeforeOverlay = null;
    } else if (modalOverlay.classList.contains('active')) {
      closeModal();
    } else if (wheelsModalOverlay.classList.contains('active')) {
      closeWheelsModal();
    }
  }
  const isSpinTrigger = e.key === ' ' || (e.key === 'Enter' && e.target === wheelCanvas);
  if (isSpinTrigger && !state.spinning && !modalOverlay.classList.contains('active') && !wheelsModalOverlay.classList.contains('active')) {
    e.preventDefault();
    spinWheel();
  }
});

uploadArea.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    imageUpload.click();
  }
});

/* ============ INICIALIZAÇÃO ============ */
applyTheme();
document.title = state.title + ' — RoletArtes';
loadState();
updateCounter();