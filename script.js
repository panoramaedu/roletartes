/* ============ ESTADO GLOBAL ============ */
const state = {
  items: [],          // URLs ou data URLs carregadas
  colors: [],         // Cores atribuídas a cada item
  spinning: false,
  currentAngle: 0,
  history: [],
  muted: false,
  theme: 'light',
  title: 'Minha Roleta',
  presentationMode: false,
  currentDrawn: null  // URL atualmente exibida no modal
};

/* ============ PALETA EDUCACIONAL ============ */
const PALETTE = [
  '#7c3aed', // púrpura
  '#06b6d4', // ciano
  '#f59e0b', // âmbar
  '#10b981', // esmeralda
  '#ec4899', // rosa
  '#3b82f6', // azul
  '#ef4444', // vermelho
  '#84cc16', // lima
  '#f97316', // laranja
  '#8b5cf6', // violeta
  '#14b8a6', // teal
  '#eab308'  // amarelo
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
const modalLoader = $('modalLoader');
const presentationOverlay = $('presentationOverlay');
const presentationImg = $('presentationImg');
const toast = $('toast');
const ctx = wheelCanvas.getContext('2d');
const uploadArea = $('uploadArea');
const imageUpload = $('imageUpload');
const storageWarning = $('storageWarning');

/* ============ UTILITÁRIOS ============ */
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2500);
}

function checkStorageQuota() {
  try {
    const used = JSON.stringify(state.items).length;
    const limit = 5 * 1024 * 1024; // 5MB
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

function saveState() {
  try {
    localStorage.setItem('roletartes_links', JSON.stringify(state.items));
    localStorage.setItem('roletartes_title', state.title);
    localStorage.setItem('roletartes_theme', state.theme);
    localStorage.setItem('roletartes_muted', state.muted);
    localStorage.setItem('roletartes_history', JSON.stringify(state.history));
    checkStorageQuota();
  } catch(e) {
    if (e.name === 'QuotaExceededError') {
      showToast('⚠️ localStorage cheio! Remova algumas imagens.');
      storageWarning.classList.add('show');
    }
  }
}

function loadState() {
  try {
    const links = localStorage.getItem('roletartes_links');
    const title = localStorage.getItem('roletartes_title');
    const theme = localStorage.getItem('roletartes_theme');
    const muted = localStorage.getItem('roletartes_muted');
    const history = localStorage.getItem('roletartes_history');
    if (links) state.items = JSON.parse(links);
    if (title) { state.title = title; $('titleEdit').value = title; }
    if (theme) { state.theme = theme; applyTheme(); }
    if (muted === 'true') { state.muted = true; $('btnMute').textContent = '🔇'; }
    if (history) state.history = JSON.parse(history);
    if (state.items.length) {
      const remoteUrls = state.items.filter(item => !item.startsWith('data:'));
      linksInput.value = remoteUrls.join('\n');
      assignColors();
      renderWheel();
    }
    renderHistory();
    checkStorageQuota();
  } catch(e) {}
}

/* ============ UPLOAD DE IMAGENS ============ */
function handleImageUpload(files) {
  const fileArray = Array.from(files);
  if (fileArray.length === 0) return;
  
  let processed = 0;
  const total = fileArray.length;
  
  fileArray.forEach(file => {
    if (!file.type.startsWith('image/')) {
      processed++;
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      state.items.push(dataUrl);
      processed++;
      
      if (processed === total) {
        assignColors();
        renderWheel();
        saveState();
        showToast(`✅ ${total} imagem${total > 1 ? 'ns' : ''} carregada${total > 1 ? 's' : ''}`);
        updateCounter();
      }
    };
    reader.onerror = () => {
      processed++;
      if (processed === total) {
        showToast('⚠️ Algumas imagens não puderam ser carregadas');
      }
    };
    reader.readAsDataURL(file);
  });
}

function updateCounter() {
  const remoteCount = linksInput.value.split('\n').filter(l => l.trim().length > 0).length;
  const localCount = state.items.filter(item => item.startsWith('data:')).length;
  const total = remoteCount + localCount;
  counterHint.textContent = `${total} imagem${total !== 1 ? 'ns' : ''} (${localCount} local${localCount !== 1 ? 'is' : ''}, ${remoteCount} link${remoteCount !== 1 ? 's' : ''})`;
}

/* ============ CORES SEM REPETIÇÃO ADJACENTE ============ */
function assignColors() {
  const n = state.items.length;
  state.colors = [];
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
  
  const size = wheelCanvas.width;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 4;
  const sliceAngle = (Math.PI * 2) / n;
  
  ctx.clearRect(0, 0, size, size);
  
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
    
    if (n <= 30) {
      const mid = start + sliceAngle / 2;
      const tr = r * 0.75;
      const tx = cx + Math.cos(mid) * tr;
      const ty = cy + Math.sin(mid) * tr;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${Math.max(12, Math.min(20, 400/n))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, 0, 0);
      ctx.restore();
    }
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
  wheelStatus.textContent = 'Girando...';
  
  const extraTurns = 5 + Math.random() * 3;
  const randomFinal = Math.random() * Math.PI * 2;
  const totalRotation = extraTurns * Math.PI * 2 + randomFinal;
  const startAngle = state.currentAngle;
  const duration = 4500 + Math.random() * 1500;
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
  const url = state.items[index];
  state.currentDrawn = url;
  wheelStatus.textContent = 'Sorteado!';
  showModal(url);
  addToHistory(url);
}

function showModal(url) {
  modalOverlay.classList.add('active');
  modalImageWrap.innerHTML = '';
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
  img.src = url;
  img.alt = 'Imagem sorteada';
}

function closeModal() {
  modalOverlay.classList.remove('active');
  state.currentDrawn = null;
  wheelStatus.textContent = 'Clique na roleta para girar';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============ HISTÓRICO ============ */
function addToHistory(url) {
  state.history.unshift({ url, time: Date.now() });
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
    div.innerHTML = `
      <img src="${escapeHtml(item.url)}" alt="" onerror="this.style.opacity=0.3"/>
      <div class="history-item-info">
        <div class="history-item-num">#${state.history.length - i}</div>
        <div class="history-item-url" title="${escapeHtml(item.url)}">${item.url.startsWith('data:') ? '📷 Imagem local' : escapeHtml(item.url)}</div>
      </div>
    `;
    historyList.appendChild(div);
  });
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

/* ============ EVENTOS ============ */
$('btnLoad').addEventListener('click', () => {
  const raw = linksInput.value;
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const unique = [...new Set(lines)];
  
  const localImages = state.items.filter(item => item.startsWith('data:'));
  state.items = [...localImages, ...unique];
  
  assignColors();
  state.currentAngle = 0;
  renderWheel();
  updateCounter();
  saveState();
  if (state.items.length > 0) showToast('✅ Roleta carregada!');
  else showToast('⚠️ Nenhum link válido encontrado');
});

linksInput.addEventListener('input', updateCounter);

// Upload de imagens
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
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data.items)) {
        state.items = data.items;
        const remoteUrls = data.items.filter(item => !item.startsWith('data:'));
        linksInput.value = remoteUrls.join('\n');
        if (data.title) { state.title = data.title; $('titleEdit').value = data.title; }
        assignColors();
        renderWheel();
        saveState();
        updateCounter();
        showToast('📂 JSON importado!');
      } else {
        showToast('⚠️ JSON inválido');
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
  saveState();
});

$('btnPresent').addEventListener('click', () => {
  if (!state.currentDrawn) {
    showToast('⚠️ Sorteie uma imagem primeiro');
    return;
  }
  presentationImg.src = state.currentDrawn;
  presentationOverlay.classList.add('active');
  state.presentationMode = true;
});

$('presentationClose').addEventListener('click', () => {
  presentationOverlay.classList.remove('active');
  state.presentationMode = false;
});

wheelCanvas.addEventListener('click', spinWheel);

$('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

$('btnRemove').addEventListener('click', () => {
  if (!state.currentDrawn) return;
  state.items = state.items.filter(u => u !== state.currentDrawn);
  const remoteUrls = state.items.filter(item => !item.startsWith('data:'));
  linksInput.value = remoteUrls.join('\n');
  assignColors();
  renderWheel();
  updateCounter();
  saveState();
  closeModal();
  showToast('⭐ Imagem removida da roleta');
});

$('btnContinue').addEventListener('click', closeModal);

$('btnRespin').addEventListener('click', () => {
  closeModal();
  setTimeout(spinWheel, 300);
});

$('btnClearHistory').addEventListener('click', () => {
  if (state.history.length === 0) return;
  if (confirm('Limpar todo o histórico?')) {
    state.history = [];
    renderHistory();
    saveState();
    showToast('🗑️ Histórico limpo');
  }
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') {
    if (state.presentationMode) {
      presentationOverlay.classList.remove('active');
      state.presentationMode = false;
    } else if (modalOverlay.classList.contains('active')) {
      closeModal();
    }
  }
  if (e.key === ' ' && !state.spinning && !modalOverlay.classList.contains('active')) {
    e.preventDefault();
    spinWheel();
  }
});

/* ============ INICIALIZAÇÃO ============ */
applyTheme();
document.title = state.title + ' — RoletArtes';
loadState();
updateCounter();