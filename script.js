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
  currentDrawn: null
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
    const used = JSON.stringify(state.items).length;
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

function saveState() {
  if (IS_OFFLINE) return; // Não salvar no modo offline
  try {
    localStorage.setItem('roletartes_links', JSON.stringify(state.items));
    localStorage.setItem('roletartes_title', state.title);
    localStorage.setItem('roletartes_theme', state.theme);
    localStorage.setItem('roletartes_muted', state.muted);
    localStorage.setItem('roletartes_history', JSON.stringify(state.history));
    checkStorageQuota();
  } catch(e) {
    if (e.name === 'QuotaExceededError') {
      showToast('⚠️ localStorage cheio! Remova alguns itens.');
      storageWarning.classList.add('show');
    }
  }
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
    }
    
    if (state.items.length) {
      linksInput.value = state.items.join('\n');
      assignColors();
      renderWheel();
    }
    
    // Ajustar UI para modo offline
    if (offlineSection) offlineSection.style.display = 'none';
    if (offlineHint) offlineHint.style.display = 'block';
    
    updateCounter();
    return;
  }
  
  // MODO ONLINE: comportamento normal
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
      linksInput.value = state.items.join('\n');
      assignColors();
      renderWheel();
    }
    renderHistory();
    checkStorageQuota();
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
        linksInput.value = state.items.join('\n');
        assignColors();
        renderWheel();
        saveState();
        showToast(`✅ ${total} imagem${total > 1 ? 'ns' : ''} adicionada${total > 1 ? 's' : ''}`);
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
  const total = state.items.length;
  const imageCount = state.items.filter(item => getItemType(item) === 'image').length;
  const textCount = total - imageCount;
  counterHint.textContent = `${total} ite${total !== 1 ? 'ns' : 'm'} (${imageCount} image${imageCount !== 1 ? 'ns' : 'm'}, ${textCount} texto${textCount !== 1 ? 's' : ''})`;
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
    
    const item = state.items[i];
    const type = getItemType(item);
    const sliceDeg = (sliceAngle * 180) / Math.PI;
    
    if (type === 'text' && sliceDeg >= 12 && n <= 40) {
      const fontSize = Math.max(10, Math.min(18, (sliceAngle * r * 0.4)));
      ctx.font = `bold ${fontSize}px Fredoka, sans-serif`;
      
      const maxArcLen = sliceAngle * r * 0.85;
      let displayText = item;
      ctx.font = `bold ${fontSize}px Fredoka, sans-serif`;
      
      while (ctx.measureText(displayText).width > maxArcLen && displayText.length > 1) {
        displayText = displayText.slice(0, -1);
      }
      if (displayText !== item) displayText += '…';
      
      ctx.fillText(displayText, 0, 0);
    } else {
      const fontSize = Math.max(12, Math.min(22, 400/n));
      ctx.font = `bold ${fontSize}px Fredoka, sans-serif`;
      ctx.fillText(i + 1, 0, 0);
    }
    
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
  const item = state.items[index];
  state.currentDrawn = item;
  wheelStatus.textContent = 'Sorteado!';
  showModal(item);
  addToHistory(item);
}

function showModal(item) {
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
function addToHistory(item) {
  state.history.unshift({ url: item, time: Date.now() });
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
    
    const type = getItemType(item.url);
    let mediaHtml;
    
    if (type === 'image') {
      mediaHtml = `<img src="${escapeHtml(item.url)}" alt="" onerror="this.style.opacity=0.3"/>`;
    } else {
      mediaHtml = `<div class="history-text-icon">📝</div>`;
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
  <div class="logo"><span class="logo-icon">🎨</span> RoletArtes</div>
  <input type="text" class="title-edit" id="titleEdit" placeholder="Digite o título da roleta..." value="${escapeHtml(state.title)}" />
  <div class="header-actions">
    <button class="icon-btn" id="btnMute" title="Ativar/desativar som">${state.muted ? '🔇' : '🔊'}</button>
    <button class="icon-btn" id="btnTheme" title="Alternar tema">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
    <button class="icon-btn" id="btnPresent" title="Modo apresentação">⛶</button>
  </div>
</header>

<main>
  <section class="panel">
    <h2>📥 Itens da roleta</h2>
    <textarea id="linksInput" placeholder="Itens carregados...">${escapeHtml(state.items.join('\\n'))}</textarea>
    <p class="hint" id="counterHint">0 itens carregados</p>
    
    <div class="upload-area" id="uploadArea" style="display:none;">
      <div class="upload-area-icon">📤</div>
      <div class="upload-area-text">Clique ou arraste imagens aqui</div>
    </div>
    <input type="file" id="imageUpload" class="file-input" accept="image/*" multiple />
    
    <div class="storage-warning" id="storageWarning">
      ⚠️ Atenção: localStorage tem limite de ~5MB.
    </div>
    
    <div class="btn-row">
      <button class="btn btn-primary" id="btnLoad">🎯 Carregar</button>
      <button class="btn btn-secondary" id="btnExport">💾 Exportar JSON</button>
      <button class="btn btn-secondary" id="btnImport">📂 Importar</button>
      <input type="file" id="fileInput" class="file-input" accept=".json" />
    </div>
    
    <p class="offline-hint" id="offlineHint" style="display:block;">
      💡 Esta é uma versão offline. Os dados já estão embutidos neste arquivo.
    </p>
  </section>

  <section class="panel wheel-container">
    <div id="wheelArea">
      <div class="wheel-empty" id="wheelEmpty" style="display:none;">
        <div class="wheel-empty-icon">🎡</div>
        <p>Nenhum item carregado.</p>
      </div>
      <div class="wheel-wrapper" id="wheelWrapper" style="display:block;">
        <div class="wheel-pointer"></div>
        <canvas class="wheel" id="wheelCanvas" width="600" height="600"></canvas>
        <div class="wheel-center">🎨</div>
      </div>
    </div>
    <div class="wheel-status" id="wheelStatus">Clique na roleta para girar</div>
  </section>

  <aside class="panel">
    <h2>📜 Histórico <span class="badge" id="historyCount">0</span></h2>
    <div class="history-list" id="historyList">
      <div class="history-empty">Nenhum sorteio ainda.</div>
    </div>
    <div class="btn-row" style="margin-top: 12px;">
      <button class="btn btn-ghost" id="btnClearHistory" style="flex:1;">🗑️ Limpar histórico</button>
    </div>
  </aside>
</main>

<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <div class="modal-header">
      <h3 id="modalTitle">🎉 Sorteado!</h3>
      <button class="modal-close" id="modalClose">×</button>
    </div>
    <div class="modal-body">
      <div class="modal-image-wrap" id="modalImageWrap">
        <div class="loader" id="modalLoader"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-highlight" id="btnRemove">⭐ Remover</button>
        <button class="btn btn-secondary" id="btnContinue">▶ Continuar</button>
        <button class="btn btn-secondary" id="btnRespin">🔄 Sortear de novo</button>
      </div>
    </div>
  </div>
</div>

<div class="presentation-overlay" id="presentationOverlay">
  <button class="presentation-close" id="presentationClose">×</button>
  <img id="presentationImg" src="" alt="" />
  <div class="presentation-text" id="presentationText"></div>
</div>

<div class="toast" id="toast"></div>

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
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data.items)) {
        state.items = data.items;
        linksInput.value = data.items.join('\n');
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
    showToast('⚠️ Sorteie um item primeiro');
    return;
  }
  
  const type = getItemType(state.currentDrawn);
  presentationOverlay.classList.remove('text-mode');
  
  if (type === 'image') {
    presentationImg.src = state.currentDrawn;
  } else {
    presentationText.textContent = state.currentDrawn;
    presentationOverlay.classList.add('text-mode');
  }
  
  presentationOverlay.classList.add('active');
  state.presentationMode = true;
});

$('presentationClose').addEventListener('click', () => {
  presentationOverlay.classList.remove('active');
  presentationOverlay.classList.remove('text-mode');
  state.presentationMode = false;
});

wheelCanvas.addEventListener('click', spinWheel);

$('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

$('btnRemove').addEventListener('click', () => {
  if (!state.currentDrawn) return;
  state.items = state.items.filter(u => u !== state.currentDrawn);
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
  if (confirm('Limpar todo o histórico?')) {
    state.history = [];
    renderHistory();
    saveState();
    showToast('🗑️ Histórico limpo');
  }
});

// Handler do botão offline
if (btnOffline) {
  btnOffline.addEventListener('click', generateOfflineHTML);
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') {
    if (state.presentationMode) {
      presentationOverlay.classList.remove('active');
      presentationOverlay.classList.remove('text-mode');
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