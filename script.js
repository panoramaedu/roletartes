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
  colorTheme: 'violet',
  title: 'Minha Roleta',
  presentationMode: false,
  currentDrawn: null,
  currentDrawnIndex: null,
  activeWheelId: null,
  wheelsIndex: [],
  weights: [],
  settings: {
    autoRemove: false,
    multiWinners: false,
    winnersCount: 2,
    weighted: false,
    groupMode: false,
    groupsCount: 2,
    countdown: false
  }
};

function defaultSettings() {
  return { autoRemove: false, multiWinners: false, winnersCount: 2, weighted: false, groupMode: false, groupsCount: 2, countdown: false };
}

/* ============ PALETA EDUCACIONAL ============ */
const PALETTE = [
  '#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#3b82f6',
  '#ef4444', '#84cc16', '#f97316', '#8b5cf6', '#14b8a6', '#eab308'
];

/* ============ MODELOS PRONTOS ============ */
const TEMPLATES = [
  {
    id: 'numbers_1_30',
    icon: '🔢',
    name: 'Números 1 a 30',
    desc: 'Sequência numérica pronta para sorteios simples',
    build: () => Array.from({ length: 30 }, (_, i) => String(i + 1))
  },
  {
    id: 'yes_no',
    icon: '🤔',
    name: 'Sim ou Não',
    desc: 'Roleta de decisão rápida com duas opções',
    build: () => ['Sim', 'Não']
  },
  {
    id: 'attendance',
    icon: '🧑\u200d🎓',
    name: 'Lista de presença em branco',
    desc: '15 vagas prontas — é só substituir pelos nomes da turma',
    build: () => Array.from({ length: 15 }, (_, i) => `Aluno ${i + 1}`)
  },
  {
    id: 'prizes',
    icon: '🎁',
    name: 'Sorteio de prêmios',
    desc: 'Modelo de roleta de premiação para dinâmicas e eventos',
    build: () => ['🥇 1º lugar', '🥈 2º lugar', '🥉 3º lugar', '🎁 Prêmio surpresa', '🎟️ Vale-desconto', '😢 Tente novamente']
  }
];

/* ============ ELEMENTOS ============ */
/* ============ TEMAS DE COR ============ */
const COLOR_THEMES = [
  { id: 'violet', name: 'Violeta (padrão)', swatches: ['#7c3aed', '#06b6d4', '#f59e0b'] },
  { id: 'halloween', name: 'Halloween', swatches: ['#ea580c', '#7c3aed', '#a3e635'] },
  { id: 'natal', name: 'Natal', swatches: ['#dc2626', '#16a34a', '#fbbf24'] },
  { id: 'praia', name: 'Praia', swatches: ['#0ea5e9', '#06b6d4', '#fbbf24'] },
  { id: 'candy', name: 'Candy', swatches: ['#ec4899', '#a78bfa', '#34d399'] },
  { id: 'floresta', name: 'Floresta', swatches: ['#15803d', '#0891b2', '#b45309'] }
];

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
const templatesModalOverlay = $('templatesModalOverlay');
const templatesList = $('templatesList');
const settingsModalOverlay = $('settingsModalOverlay');
const groupsModalOverlay = $('groupsModalOverlay');
const groupsResult = $('groupsResult');
const colorThemeModalOverlay = $('colorThemeModalOverlay');
const colorThemeGrid = $('colorThemeGrid');

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
    localStorage.setItem('roletartes_color_theme', state.colorTheme);
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
    weights: [],
    settings: defaultSettings(),
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
    weights: state.weights,
    settings: state.settings,
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
  state.weights = Array.isArray(wheel.weights) ? wheel.weights : [];
  state.settings = Object.assign(defaultSettings(), wheel.settings || {});
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
  syncSettingsUI();
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
    weights: [],
    settings: defaultSettings(),
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
    weights: [...(source.weights || [])],
    settings: Object.assign(defaultSettings(), source.settings || {}),
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
        const nextWheel = loadWheelData(next.id) || { id: next.id, name: next.name, items: [], history: [], weights: [], settings: defaultSettings() };
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

/* ============ MODELOS PRONTOS (UI) ============ */
let lastFocusedBeforeTemplates = null;

function renderTemplatesList() {
  templatesList.innerHTML = '';
  TEMPLATES.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'template-card';
    btn.innerHTML = `
      <span class="template-card-icon" aria-hidden="true">${t.icon}</span>
      <span class="template-card-info">
        <span class="template-card-name">${escapeHtml(t.name)}</span>
        <span class="template-card-desc">${escapeHtml(t.desc)}</span>
      </span>
    `;
    btn.addEventListener('click', () => applyTemplate(t));
    templatesList.appendChild(btn);
  });
}

function applyTemplate(template) {
  const items = template.build();
  const doApply = () => {
    linksInput.value = items.join('\n');
    linksInput.dispatchEvent(new Event('input'));
    closeTemplatesModal();
    showToast(`📋 Modelo "${template.name}" preenchido — revise e clique em Carregar`);
    requestAnimationFrame(() => linksInput.focus());
  };

  if (linksInput.value.trim().length > 0) {
    openDialog({
      title: '📋 Substituir itens atuais?',
      message: `Isso vai apagar o que está escrito no campo de itens e colocar o modelo "${template.name}" no lugar. O que já foi carregado na roleta não é afetado até você clicar em Carregar novamente.`,
      confirmLabel: 'Substituir',
      danger: true,
      onConfirm: doApply
    });
  } else {
    doApply();
  }
}

function openTemplatesModal() {
  lastFocusedBeforeTemplates = document.activeElement;
  renderTemplatesList();
  templatesModalOverlay.classList.add('active');
  requestAnimationFrame(() => {
    const first = templatesList.querySelector('.template-card');
    if (first) first.focus();
  });
}

function closeTemplatesModal() {
  templatesModalOverlay.classList.remove('active');
  if (lastFocusedBeforeTemplates && document.body.contains(lastFocusedBeforeTemplates)) {
    lastFocusedBeforeTemplates.focus();
  }
  lastFocusedBeforeTemplates = null;
}

/* ============ MECÂNICAS DE SORTEIO (UI) ============ */
let lastFocusedBeforeSettings = null;

function openSettingsModal() {
  lastFocusedBeforeSettings = document.activeElement;
  syncSettingsUI();
  settingsModalOverlay.classList.add('active');
  requestAnimationFrame(() => $('settingAutoRemove').focus());
}

function closeSettingsModal() {
  settingsModalOverlay.classList.remove('active');
  if (lastFocusedBeforeSettings && document.body.contains(lastFocusedBeforeSettings)) {
    lastFocusedBeforeSettings.focus();
  }
  lastFocusedBeforeSettings = null;
}

/* Reflete state.settings nos controles do modal — chamado ao abrir o modal
   e sempre que a roleta ativa muda, pra nunca mostrar configurações de
   uma roleta diferente. */
function syncSettingsUI() {
  const s = state.settings || defaultSettings();
  if (!$('settingAutoRemove')) return; // modal ausente (ex.: ainda não montado)

  $('settingAutoRemove').checked = !!s.autoRemove;
  $('settingCountdown').checked = !!s.countdown;
  $('settingMultiWinners').checked = !!s.multiWinners;
  $('settingWinnersCount').value = s.winnersCount || 2;
  $('multiWinnersSub').style.display = s.multiWinners ? 'flex' : 'none';
  $('settingWeighted').checked = !!s.weighted;
  $('weightsSub').style.display = s.weighted ? 'flex' : 'none';
  $('settingGroupMode').checked = !!s.groupMode;
  $('settingGroupsCount').value = s.groupsCount || 2;
  $('groupModeSub').style.display = s.groupMode ? 'flex' : 'none';
  if (s.weighted) renderWeightsList();
}

function renderWeightsList() {
  const listEl = $('weightsList');
  const emptyHint = $('weightsEmptyHint');
  if (!listEl) return;
  if (state.items.length === 0) {
    listEl.innerHTML = '';
    emptyHint.style.display = 'block';
    return;
  }
  emptyHint.style.display = 'none';
  // Garante que os pesos existem e têm o mesmo tamanho da lista de itens.
  if (state.weights.length !== state.items.length) {
    state.weights = state.items.map((_, i) => state.weights[i] !== undefined ? state.weights[i] : 1);
  }
  listEl.innerHTML = '';
  state.items.forEach((item, i) => {
    const type = getItemType(item);
    const label = type === 'image' ? `Imagem #${i + 1}` : item;
    const row = document.createElement('div');
    row.className = 'weight-row';
    row.innerHTML = `
      <span class="weight-row-name" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <span class="weight-stepper">
        <button type="button" data-dir="-1" aria-label="Diminuir peso de ${escapeHtml(label)}">−</button>
        <span class="weight-value">${state.weights[i]}</span>
        <button type="button" data-dir="1" aria-label="Aumentar peso de ${escapeHtml(label)}">+</button>
      </span>
    `;
    row.querySelectorAll('button[data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.getAttribute('data-dir'), 10);
        state.weights[i] = Math.max(1, Math.min(10, (state.weights[i] || 1) + dir));
        row.querySelector('.weight-value').textContent = state.weights[i];
        state.sliceLabels = null;
        renderWheel();
        saveState();
      });
    });
    listEl.appendChild(row);
  });
}

/* ============ MODO GRUPOS ============ */
let lastFocusedBeforeGroups = null;
let lastGroupsText = '';

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawGroups() {
  if (state.items.length === 0) {
    showToast('⚠️ Carregue itens na roleta primeiro');
    return;
  }
  const groupsCount = Math.max(2, Math.min(20, parseInt($('settingGroupsCount').value, 10) || 2));
  if (groupsCount > state.items.length) {
    showToast('⚠️ Mais grupos do que itens — reduza a quantidade de grupos');
    return;
  }
  state.settings.groupsCount = groupsCount;
  saveState();

  const shuffled = shuffleArray(state.items);
  const groups = Array.from({ length: groupsCount }, () => []);
  shuffled.forEach((item, i) => groups[i % groupsCount].push(item));

  renderGroupsResult(groups);
  closeSettingsModal();
  openGroupsModal();
}

function renderGroupsResult(groups) {
  groupsResult.innerHTML = '';
  const lines = [];
  groups.forEach((group, i) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    const title = `Grupo ${i + 1}`;
    const itemsText = group.map(item => getItemType(item) === 'image' ? '🖼️ Imagem' : item).join(', ');
    card.innerHTML = `<div class="group-card-title">${title} (${group.length})</div><div class="group-card-items">${escapeHtml(itemsText)}</div>`;
    groupsResult.appendChild(card);
    lines.push(`${title}: ${itemsText}`);
  });
  lastGroupsText = lines.join('\n');
}

function openGroupsModal() {
  lastFocusedBeforeGroups = document.activeElement;
  groupsModalOverlay.classList.add('active');
  requestAnimationFrame(() => $('btnCloseGroups').focus());
}

function closeGroupsModal() {
  groupsModalOverlay.classList.remove('active');
  if (lastFocusedBeforeGroups && document.body.contains(lastFocusedBeforeGroups)) {
    lastFocusedBeforeGroups.focus();
  }
  lastFocusedBeforeGroups = null;
}

function loadState() {
  // MODO OFFLINE: usar dados embutidos
  if (IS_OFFLINE && window.OFFLINE_DATA) {
    state.items = window.OFFLINE_DATA.items || [];
    state.title = window.OFFLINE_DATA.title || 'RoletArtes Offline';
    state.theme = window.OFFLINE_DATA.theme || 'light';
    state.colorTheme = window.OFFLINE_DATA.colorTheme || 'violet';
    state.muted = window.OFFLINE_DATA.muted || false;
    state.weights = window.OFFLINE_DATA.weights || [];
    state.settings = Object.assign(defaultSettings(), window.OFFLINE_DATA.settings || {});
    
    $('titleEdit').value = state.title;
    document.title = state.title + ' — RoletArtes Offline';
    applyTheme();
    applyColorTheme();
    
    if (state.muted) {
      $('btnMute').textContent = '🔇';
      $('btnMute').setAttribute('aria-pressed', 'true');
    }
    
    if (state.items.length) {
      linksInput.value = state.items.join('\n');
      assignColors();
      renderWheel();
    }
    syncSettingsUI();
    
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
    const colorTheme = localStorage.getItem('roletartes_color_theme');
    const muted = localStorage.getItem('roletartes_muted');
    if (theme) { state.theme = theme; applyTheme(); }
    if (colorTheme) state.colorTheme = colorTheme;
    applyColorTheme();
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
        wheel = { id: activeId, name: 'Minha Roleta', items: [], history: [], weights: [], settings: defaultSettings(), createdAt: Date.now(), updatedAt: Date.now() };
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
/* ============ PESOS E FATIAS PROPORCIONAIS ============
   Quando "Pesos por item" está desligado, todo item tem peso 1 (fatias iguais,
   comportamento clássico). Ligado, os pesos guardados definem o tamanho de
   cada fatia — e, como o giro é físico (ângulo real de parada), isso já
   controla a probabilidade real de cada item sair, não só a aparência. */
function getEffectiveWeights() {
  if (!state.settings.weighted || state.weights.length !== state.items.length) {
    return state.items.map(() => 1);
  }
  return state.weights.map(w => (Number.isFinite(w) && w > 0) ? w : 1);
}

function getSliceAngles() {
  const weights = getEffectiveWeights();
  const total = weights.reduce((a, b) => a + b, 0) || weights.length || 1;
  let acc = 0;
  return weights.map(w => {
    const angle = (w / total) * Math.PI * 2;
    const start = acc;
    acc += angle;
    return { start, angle, mid: start + angle / 2 };
  });
}

function angleToIndex(slices, normalizedAngle) {
  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    if (normalizedAngle >= s.start && normalizedAngle < s.start + s.angle) return i;
  }
  return slices.length - 1; // fallback para erro de ponto flutuante bem no limite de 2π
}

function assignColors() {
  const n = state.items.length;
  state.colors = [];
  state.sliceLabels = null;
  // Redimensiona os pesos junto com os itens, preservando os já definidos
  // e completando os novos com peso padrão 1.
  const prevWeights = state.weights;
  state.weights = Array.from({ length: n }, (_, i) => (prevWeights[i] !== undefined ? prevWeights[i] : 1));
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
  const slices = getSliceAngles();

  for (let i = 0; i < n; i++) {
    const item = state.items[i];
    const type = getItemType(item);
    const sliceAngle = slices[i].angle;
    const sliceDeg = (sliceAngle * 180) / Math.PI;

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
  const slices = getSliceAngles();
  
  ctx.clearRect(0, 0, size, size);
  
  if (!state.sliceLabels || state.sliceLabels.length !== n) computeSliceLabels();
  
  for (let i = 0; i < n; i++) {
    const start = state.currentAngle + slices[i].start;
    const end = start + slices[i].angle;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = state.colors[i];
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const mid = start + slices[i].angle / 2;
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

/* ============ ANIMAÇÃO DE GIRO ============
   animateSpinOnce() faz o giro físico de verdade (ângulo real de parada) e
   resolve com o índice vencedor — sem decidir o resultado antes, só observa
   onde parou. Isso é o que torna o peso por item honesto: fatia maior =
   mais ângulo do círculo = mais chance real de o ponteiro parar nela. */
function animateSpinOnce() {
  return new Promise(resolve => {
    state.spinning = true;
    wheelCanvas.classList.add('spinning');
    wheelWrapper.classList.add('spinning');
    wheelStatus.textContent = 'Girando...';

    const slices = getSliceAngles();
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

      const pointerAngle = -Math.PI / 2;
      const normalizedAngle = ((pointerAngle - state.currentAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const currentSlice = angleToIndex(slices, normalizedAngle);
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
        const winningIndex = angleToIndex(slices, finalNormalized);
        resolve(winningIndex);
      }
    }

    requestAnimationFrame(animate);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* Contagem regressiva visual (3, 2, 1) antes do giro — puramente estética,
   não interfere no sorteio em si. Sob "reduzir movimento", o CSS global já
   deixa a animação quase instantânea, então aqui só encurtamos a pausa
   entre os números pra não parecer travado. */
function runCountdown() {
  const overlay = $('countdownOverlay');
  if (!overlay) return Promise.resolve();
  return new Promise(resolve => {
    wheelStatus.textContent = 'Preparando...';
    wheelCanvas.classList.add('spinning');
    wheelWrapper.classList.add('spinning');
    overlay.classList.add('active');
    const steps = ['3', '2', '1', 'Vai!'];
    const stepDuration = prefersReducedMotion ? 280 : 700;
    let i = 0;
    function showNext() {
      if (i >= steps.length) {
        overlay.classList.remove('active');
        overlay.innerHTML = '';
        wheelCanvas.classList.remove('spinning');
        wheelWrapper.classList.remove('spinning');
        resolve();
        return;
      }
      overlay.innerHTML = `<span class="countdown-number">${steps[i]}</span>`;
      playCountdownBeep(i === steps.length - 1);
      i++;
      setTimeout(showNext, stepDuration);
    }
    showNext();
  });
}

// Trava a reentrada durante todo o fluxo de giro (incluindo a contagem
// regressiva e as pausas entre giros de um sorteio de vários vencedores),
// independente do estado.spinning, que só cobre a animação física em si.
let spinLocked = false;

async function spinWheel() {
  if (spinLocked || state.spinning || state.items.length === 0) return;
  spinLocked = true;
  try {
    if (state.settings.countdown) {
      await runCountdown();
    }
    if (state.settings.multiWinners && state.settings.winnersCount > 1 && state.items.length > 1) {
      await runMultiSpin(Math.min(state.settings.winnersCount, state.items.length));
    } else {
      await runSingleSpin();
    }
  } finally {
    spinLocked = false;
  }
}

async function runSingleSpin() {
  let winningIndex;
  if (state.items.length === 1) {
    winningIndex = 0;
  } else {
    winningIndex = await animateSpinOnce();
    playWin();
  }
  finishSingleSpin(winningIndex);
}

/* Sorteio de vários vencedores em sequência: gira sobre uma cópia do grupo,
   que vai encolhendo a cada acerto (visualmente também), sem tocar na
   roleta "de verdade" até o fim — assim dá pra restaurá-la caso a
   eliminação automática esteja desligada. */
async function runMultiSpin(count) {
  const savedItems = state.items, savedColors = state.colors, savedWeights = state.weights;
  const workingItems = [...state.items];
  const workingColors = [...state.colors];
  const workingWeights = [...getEffectiveWeights()];
  const workingIndices = state.items.map((_, i) => i);

  state.items = workingItems;
  state.colors = workingColors;
  state.weights = workingWeights;
  state.sliceLabels = null;

  const winners = [];
  for (let i = 0; i < count && state.items.length > 0; i++) {
    let idx;
    if (state.items.length === 1) {
      idx = 0;
      state.sliceLabels = null;
      renderWheel();
      await sleep(prefersReducedMotion ? 150 : 500);
    } else {
      idx = await animateSpinOnce();
    }
    winners.push({ item: state.items[idx], color: state.colors[idx], originalIndex: workingIndices[idx] });
    state.items.splice(idx, 1);
    state.colors.splice(idx, 1);
    state.weights.splice(idx, 1);
    workingIndices.splice(idx, 1);
    state.sliceLabels = null;
    if (i < count - 1 && state.items.length > 0) await sleep(500);
  }

  state.items = savedItems;
  state.colors = savedColors;
  state.weights = savedWeights;
  state.sliceLabels = null;

  winners.forEach(w => addToHistory(w.item, w.color));

  if (state.settings.autoRemove) {
    winners.map(w => w.originalIndex).sort((a, b) => b - a).forEach(idx => {
      state.items.splice(idx, 1);
      state.colors.splice(idx, 1);
      if (state.weights.length > idx) state.weights.splice(idx, 1);
    });
    state.sliceLabels = null;
  }

  renderWheel();
  updateCounter();
  saveState();
  playWin();
  finishMultiSpin(winners);
}

/* ============ SORTEIO E MODAL ============ */
function finishSingleSpin(index) {
  const item = state.items[index];
  const color = state.colors[index] || null;
  state.currentDrawn = item;
  state.currentDrawnIndex = index;
  wheelStatus.textContent = 'Sorteado!';
  addToHistory(item, color);

  if (state.settings.autoRemove) {
    state.items.splice(index, 1);
    state.colors.splice(index, 1);
    if (state.weights.length > index) state.weights.splice(index, 1);
    state.sliceLabels = null;
    linksInput.value = state.items.join('\n');
    renderWheel();
    updateCounter();
    saveState();
    // O item já saiu da roleta — não faz sentido oferecer "Remover" de novo.
    state.currentDrawnIndex = null;
  }

  showModal(item);
  burstConfetti();
}

function resetModalUI() {
  modalImageWrap.classList.remove('winners-mode');
  $('btnRemove').style.display = '';
  $('btnContinue').textContent = '▶ Continuar';
}

function showModal(item) {
  resetModalUI();
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
  
  // Se a eliminação automática já tirou o item da roleta, não faz sentido
  // oferecer "Remover" de novo.
  if (state.currentDrawnIndex === null) {
    $('btnRemove').style.display = 'none';
  }
  
  requestAnimationFrame(() => {
    const target = $('btnRemove').style.display === 'none' ? $('btnContinue') : $('btnRemove');
    target.focus();
  });
}

function finishMultiSpin(winners) {
  resetModalUI();
  state.currentDrawn = winners.length ? winners[winners.length - 1].item : null;
  state.currentDrawnIndex = null;
  wheelStatus.textContent = 'Sorteio concluído!';

  lastFocusedBeforeOverlay = document.activeElement;
  modalOverlay.classList.add('active');
  modalTitle.textContent = `🏆 ${winners.length} vencedor${winners.length !== 1 ? 'es' : ''}!`;
  modalImageWrap.innerHTML = '';
  modalImageWrap.classList.remove('text-mode');
  modalImageWrap.classList.add('winners-mode');

  const list = document.createElement('div');
  list.className = 'winners-list';
  winners.forEach((w, i) => {
    const row = document.createElement('div');
    row.className = 'winner-row';
    row.style.setProperty('--item-accent', w.color || 'var(--primary)');
    const type = getItemType(w.item);
    const media = type === 'image'
      ? `<img src="${escapeHtml(w.item)}" alt="" onerror="this.style.opacity=0.3" />`
      : `<div class="winner-row-text">${escapeHtml(w.item)}</div>`;
    row.innerHTML = `<span class="winner-row-num">#${i + 1}</span>${media}`;
    list.appendChild(row);
  });
  modalImageWrap.appendChild(list);

  $('btnRemove').style.display = 'none';
  $('btnContinue').textContent = '✅ Concluir';

  requestAnimationFrame(() => $('btnContinue').focus());
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
const CONFETTI_FALLBACK_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'];
function getConfettiColors() {
  const styles = getComputedStyle(document.documentElement);
  const themed = [
    styles.getPropertyValue('--primary').trim(),
    styles.getPropertyValue('--accent-cyan').trim(),
    styles.getPropertyValue('--accent-amber').trim(),
    '#10b981', '#ec4899', '#3b82f6'
  ].filter(Boolean);
  return themed.length >= 3 ? themed : CONFETTI_FALLBACK_COLORS;
}
function burstConfetti() {
  if (prefersReducedMotion || !confettiLayer) return;
  const colors = getConfettiColors();
  const count = 46;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[i % colors.length];
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

function playCountdownBeep(isFinal) {
  if (state.muted) return;
  const ac = getAudioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.value = isFinal ? 880 : 440;
  const dur = isFinal ? 0.18 : 0.1;
  gain.gain.setValueAtTime(0.06, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  osc.connect(gain); gain.connect(ac.destination);
  osc.start(); osc.stop(ac.currentTime + dur);
}

/* ============ TEMA ============ */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $('btnTheme').textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

function applyColorTheme() {
  document.documentElement.setAttribute('data-color-theme', state.colorTheme || 'violet');
}

let lastFocusedBeforeColorTheme = null;

function renderColorThemeGrid() {
  if (!colorThemeGrid) return;
  colorThemeGrid.innerHTML = '';
  COLOR_THEMES.forEach(t => {
    const isActive = (state.colorTheme || 'violet') === t.id;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'color-theme-card' + (isActive ? ' active' : '');
    card.setAttribute('aria-pressed', String(isActive));
    card.innerHTML = `
      <span class="color-theme-swatches" aria-hidden="true">
        ${t.swatches.map(c => `<span class="color-theme-swatch" style="background:${c}"></span>`).join('')}
      </span>
      <span class="color-theme-name">${escapeHtml(t.name)}</span>
      <span class="color-theme-check">${isActive ? '✓ Ativo' : ''}</span>
    `;
    card.addEventListener('click', () => {
      state.colorTheme = t.id;
      applyColorTheme();
      saveState();
      renderColorThemeGrid();
      showToast(`🎨 Tema "${t.name}" aplicado`);
    });
    colorThemeGrid.appendChild(card);
  });
}

function openColorThemeModal() {
  lastFocusedBeforeColorTheme = document.activeElement;
  renderColorThemeGrid();
  colorThemeModalOverlay.classList.add('active');
  requestAnimationFrame(() => {
    const active = colorThemeGrid.querySelector('.color-theme-card.active') || colorThemeGrid.querySelector('.color-theme-card');
    if (active) active.focus();
  });
}

function closeColorThemeModal() {
  colorThemeModalOverlay.classList.remove('active');
  if (lastFocusedBeforeColorTheme && document.body.contains(lastFocusedBeforeColorTheme)) {
    lastFocusedBeforeColorTheme.focus();
  }
  lastFocusedBeforeColorTheme = null;
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
      colorTheme: state.colorTheme,
      muted: state.muted,
      weights: state.weights,
      settings: state.settings,
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
    <button type="button" class="icon-btn" id="btnSpinSettings" title="Mecânicas de sorteio" aria-label="Abrir configurações de mecânicas de sorteio">⚙️</button>
    <button type="button" class="icon-btn" id="btnMute" title="Ativar/desativar som" aria-label="Ativar ou desativar som" aria-pressed="${state.muted}">${state.muted ? '🔇' : '🔊'}</button>
    <button type="button" class="icon-btn" id="btnColorTheme" title="Tema de cores" aria-label="Escolher tema de cores">🎨</button>
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
      <button type="button" class="btn btn-secondary" id="btnTemplates">📋 Usar modelo</button>
      <button type="button" class="btn btn-secondary" id="btnExport">💾 Exportar JSON</button>
      <button type="button" class="btn btn-secondary" id="btnImport">📂 Importar</button>
      <input type="file" id="fileInput" class="file-input" accept=".json" aria-hidden="true" tabindex="-1" />
    </div>

    <div class="setting-row" style="margin-top: 10px;">
      <label class="switch-label" for="settingGroupMode">
        <span class="switch-text">
          <strong>🎲 Modo grupos</strong>
          <small>Divide a lista em grupos aleatórios</small>
        </span>
        <span class="switch"><input type="checkbox" id="settingGroupMode" /><span class="switch-track" aria-hidden="true"></span></span>
      </label>
      <div class="setting-sub" id="groupModeSub" style="display:none;">
        <label for="settingGroupsCount">Quantos grupos?</label>
        <input type="number" id="settingGroupsCount" min="2" max="20" value="2" class="setting-number-input" />
        <button type="button" class="btn btn-secondary" id="btnDrawGroups" style="width:100%; justify-content:center; margin-top:4px;">🎲 Sortear grupos agora</button>
      </div>
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
        <div class="countdown-overlay" id="countdownOverlay" aria-hidden="true"></div>
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

<div class="modal-overlay" id="templatesModalOverlay">
  <div class="modal wheels-modal" role="dialog" aria-modal="true" aria-labelledby="templatesModalTitle">
    <div class="modal-header">
      <h3 id="templatesModalTitle">📋 Modelos prontos</h3>
      <button type="button" class="modal-close" id="templatesModalClose" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body wheels-modal-body">
      <p class="templates-hint">Escolha um modelo para preencher o campo de itens.</p>
      <div class="templates-list" id="templatesList" aria-live="polite"></div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="colorThemeModalOverlay">
  <div class="modal wheels-modal" role="dialog" aria-modal="true" aria-labelledby="colorThemeModalTitle">
    <div class="modal-header">
      <h3 id="colorThemeModalTitle">🎨 Tema de cores</h3>
      <button type="button" class="modal-close" id="colorThemeModalClose" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body wheels-modal-body">
      <p class="templates-hint">Escolha a paleta de cores do site.</p>
      <div class="color-theme-grid" id="colorThemeGrid" aria-live="polite"></div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="settingsModalOverlay">
  <div class="modal wheels-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settingsModalTitle">
    <div class="modal-header">
      <h3 id="settingsModalTitle">⚙️ Mecânicas de sorteio</h3>
      <button type="button" class="modal-close" id="settingsModalClose" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body wheels-modal-body">
      <p class="templates-hint">Tudo aqui é opcional e fica desligado por padrão.</p>

      <div class="setting-row">
        <label class="switch-label" for="settingAutoRemove">
          <span class="switch-text">
            <strong>Eliminar automaticamente</strong>
            <small>Remove o item sorteado da roleta assim que sai</small>
          </span>
          <span class="switch"><input type="checkbox" id="settingAutoRemove" /><span class="switch-track" aria-hidden="true"></span></span>
        </label>
      </div>

      <div class="setting-row">
        <label class="switch-label" for="settingCountdown">
          <span class="switch-text">
            <strong>Contagem regressiva</strong>
            <small>Mostra 3, 2, 1 antes de girar</small>
          </span>
          <span class="switch"><input type="checkbox" id="settingCountdown" /><span class="switch-track" aria-hidden="true"></span></span>
        </label>
      </div>

      <div class="setting-row">
        <label class="switch-label" for="settingMultiWinners">
          <span class="switch-text">
            <strong>Vários vencedores</strong>
            <small>Sorteia mais de um item em sequência automaticamente</small>
          </span>
          <span class="switch"><input type="checkbox" id="settingMultiWinners" /><span class="switch-track" aria-hidden="true"></span></span>
        </label>
        <div class="setting-sub" id="multiWinnersSub" style="display:none;">
          <label for="settingWinnersCount">Quantos vencedores por sorteio?</label>
          <input type="number" id="settingWinnersCount" min="2" max="20" value="2" class="setting-number-input" />
        </div>
      </div>

      <div class="setting-row">
        <label class="switch-label" for="settingWeighted">
          <span class="switch-text">
            <strong>Pesos por item</strong>
            <small>Dá mais ou menos chance a itens específicos</small>
          </span>
          <span class="switch"><input type="checkbox" id="settingWeighted" /><span class="switch-track" aria-hidden="true"></span></span>
        </label>
        <div class="setting-sub" id="weightsSub" style="display:none;">
          <p class="weights-empty-hint" id="weightsEmptyHint">Carregue itens na roleta para ajustar os pesos.</p>
          <div class="weights-list" id="weightsList"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="groupsModalOverlay">
  <div class="modal wheels-modal" role="dialog" aria-modal="true" aria-labelledby="groupsModalTitle">
    <div class="modal-header">
      <h3 id="groupsModalTitle">🎲 Grupos sorteados</h3>
      <button type="button" class="modal-close" id="groupsModalClose" aria-label="Fechar">×</button>
    </div>
    <div class="modal-body wheels-modal-body">
      <div class="groups-result" id="groupsResult" aria-live="polite"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="btnCopyGroups">📋 Copiar resultado</button>
        <button type="button" class="btn btn-primary" id="btnCloseGroups">Fechar</button>
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

$('btnTemplates').addEventListener('click', openTemplatesModal);
$('templatesModalClose').addEventListener('click', closeTemplatesModal);
templatesModalOverlay.addEventListener('click', e => { if (e.target === templatesModalOverlay) closeTemplatesModal(); });
templatesModalOverlay.addEventListener('keydown', e => {
  if (e.key === 'Tab') trapFocus(templatesModalOverlay.querySelector('.modal'), e);
});

$('btnSpinSettings').addEventListener('click', openSettingsModal);
$('settingsModalClose').addEventListener('click', closeSettingsModal);
settingsModalOverlay.addEventListener('click', e => { if (e.target === settingsModalOverlay) closeSettingsModal(); });
settingsModalOverlay.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.stopPropagation(); closeSettingsModal(); }
  if (e.key === 'Tab') trapFocus(settingsModalOverlay.querySelector('.modal'), e);
});

$('btnColorTheme').addEventListener('click', openColorThemeModal);
$('colorThemeModalClose').addEventListener('click', closeColorThemeModal);
colorThemeModalOverlay.addEventListener('click', e => { if (e.target === colorThemeModalOverlay) closeColorThemeModal(); });
colorThemeModalOverlay.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.stopPropagation(); closeColorThemeModal(); }
  if (e.key === 'Tab') trapFocus(colorThemeModalOverlay.querySelector('.modal'), e);
});

$('settingAutoRemove').addEventListener('change', e => {
  state.settings.autoRemove = e.target.checked;
  saveState();
});

$('settingCountdown').addEventListener('change', e => {
  state.settings.countdown = e.target.checked;
  saveState();
});

$('settingMultiWinners').addEventListener('change', e => {
  state.settings.multiWinners = e.target.checked;
  $('multiWinnersSub').style.display = e.target.checked ? 'flex' : 'none';
  saveState();
});
$('settingWinnersCount').addEventListener('change', e => {
  const v = Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2));
  e.target.value = v;
  state.settings.winnersCount = v;
  saveState();
});

$('settingWeighted').addEventListener('change', e => {
  state.settings.weighted = e.target.checked;
  $('weightsSub').style.display = e.target.checked ? 'flex' : 'none';
  if (e.target.checked) renderWeightsList();
  state.sliceLabels = null;
  renderWheel();
  saveState();
});

$('settingGroupMode').addEventListener('change', e => {
  state.settings.groupMode = e.target.checked;
  $('groupModeSub').style.display = e.target.checked ? 'flex' : 'none';
  saveState();
});
$('settingGroupsCount').addEventListener('change', e => {
  const v = Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2));
  e.target.value = v;
  state.settings.groupsCount = v;
  saveState();
});
$('btnDrawGroups').addEventListener('click', drawGroups);

$('groupsModalClose').addEventListener('click', closeGroupsModal);
$('btnCloseGroups').addEventListener('click', closeGroupsModal);
groupsModalOverlay.addEventListener('click', e => { if (e.target === groupsModalOverlay) closeGroupsModal(); });
groupsModalOverlay.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.stopPropagation(); closeGroupsModal(); }
  if (e.key === 'Tab') trapFocus(groupsModalOverlay.querySelector('.modal'), e);
});
$('btnCopyGroups').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lastGroupsText);
    showToast('📋 Resultado copiado!');
  } catch(e) {
    showToast('⚠️ Não foi possível copiar automaticamente');
  }
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
    } else if (templatesModalOverlay.classList.contains('active')) {
      closeTemplatesModal();
    }
  }
  const isSpinTrigger = e.key === ' ' || (e.key === 'Enter' && e.target === wheelCanvas);
  const anyOverlayActive = [modalOverlay, wheelsModalOverlay, templatesModalOverlay, settingsModalOverlay, groupsModalOverlay, dialogModalOverlay, colorThemeModalOverlay]
    .some(el => el.classList.contains('active'));
  if (isSpinTrigger && !state.spinning && !spinLocked && !anyOverlayActive) {
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