const KEY = 'omni-inventory', THEME_KEY = 'omni-theme', LOW = 5;
const $ = id => document.getElementById(id);
const ic = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
const money = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Categorías = IDs de proveedores (sin subcategorías) */
const CATEGORIES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27'];
const catLabelOf = c => c ? `Categorias ${c}` : 'Sin categoría';

let products = [];
try { products = JSON.parse(localStorage.getItem(KEY)) || []; } catch { products = []; }
const state = { filter: 'all', q: '', sort: 'recent', cat: '', scanner: null, lastScan: '', lastScanAt: 0, flash: null };
const persist = () => localStorage.setItem(KEY, JSON.stringify(products));

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('btn-theme').innerHTML = ic(t === 'dark' ? 'sun' : 'moon');
}
applyTheme(localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('btn-theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, t); applyTheme(t);
};

function toast(msg, icon = 'check') {
  const el = document.createElement('div');
  el.className = 'toast'; el.innerHTML = `${ic(icon)}<span>${esc(msg)}</span>`;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2600);
}
let actx;
function beep() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square'; o.frequency.value = 1040; g.gain.value = .05;
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + .1);
  } catch { }
  navigator.vibrate?.(60);
}
function confirmDialog(title, text, yes = 'Eliminar') {
  return new Promise(res => {
    $('confirm-title').textContent = title; $('confirm-text').textContent = text; $('confirm-yes').textContent = yes;
    const d = $('confirm-modal'); d.showModal();
    const done = v => { d.close(); res(v); };
    $('confirm-yes').onclick = () => done(true); $('confirm-no').onclick = () => done(false);
    d.oncancel = () => res(false);
  });
}

/* ---------- Categorías (IDs): campo del modal y filtro (se crean desde JS) ---------- */
function buildCategoryUI() {
  // Campo Categoría en el modal (clonando el estilo del campo "Nombre")
  const nameWrap = $('form-name').parentElement;
  const clone = nameWrap.cloneNode(true);
  const input = clone.querySelector('input');
  const sel = document.createElement('select');
  sel.id = 'form-category';
  sel.className = $('form-status').className;
  input.replaceWith(sel);
  const lab = clone.querySelector('label, span');
  if (lab) { lab.textContent = 'Categoría (ID Categoria)'; if (lab.hasAttribute('for')) lab.setAttribute('for', 'form-category'); }
  nameWrap.after(clone);

  $('form-category').innerHTML = '<option value="">Sin categoría</option>' +
    CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  // Filtro de categorías junto al selector de orden
  const f = document.createElement('select');
  f.id = 'cat-filter';
  f.className = $('sort').className;
  f.setAttribute('aria-label', 'Filtrar por categoría');
  f.innerHTML = '<option value="">Todas las categorías</option>' +
    CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('sort').before(f);
  f.addEventListener('change', e => { state.cat = e.target.value; render(); });
}
buildCategoryUI();

/* ---------- Campos extra: Descripción y Stock mínimo (se crean desde JS) ---------- */
function buildExtraFields() {
  const mk = (srcInput, id, label, tweak) => {
    const wrap = srcInput.parentElement, clone = wrap.cloneNode(true);
    const input = clone.querySelector('input');
    input.id = id; input.value = ''; tweak(input);
    const lab = clone.querySelector('label, span');
    if (lab) { lab.textContent = label; if (lab.hasAttribute('for')) lab.setAttribute('for', id); }
    wrap.after(clone);
  };
  mk($('form-name'), 'form-description', 'Descripción', i => { i.type = 'text'; i.placeholder = 'Descripción del producto'; i.removeAttribute('required'); });
  mk($('form-stock'), 'form-stock-min', 'Stock mínimo', i => { i.type = 'number'; i.min = 0; i.placeholder = String(LOW); });
}
buildExtraFields();

const statusOf = (stock, current) => stock <= 0 ? 'Agotado' : (current === 'Agotado' ? 'Activo' : current);
const profitOf = p => (p.priceSell || 0) - (p.priceBuy || 0);

function handleCode(raw) {
  const code = String(raw).trim();
  if (!code) return;
  const p = products.find(x => x.barcode === code);
  if (p && $('quick-mode').checked) {
    p.stock = (p.stock || 0) + 1; p.status = statusOf(p.stock, p.status); p.date = new Date().toISOString();
    persist(); state.flash = code; render(); toast(`${p.name}: stock ${p.stock}`, 'plus');
    return;
  }
  openModal(p || {
    barcode: code, name: '', priceBuy: '', priceSell: '', stock: 1, status: 'Activo', category: '', $('form-description').value = p.description || '';
    $('form-stock-min').value = p.stockMin ?? ''
  }, !p);
}
$('manual-barcode').addEventListener('keydown', e => {
  if (e.key === 'Enter') { handleCode(e.target.value); e.target.value = ''; }
});
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
  if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  $('manual-barcode').focus();
});

let isNew = true;
function openModal(p, nuevo) {
  isNew = nuevo;
  $('modal-title').textContent = nuevo ? 'Nuevo producto' : 'Editar producto';
  $('form-barcode').value = p.barcode;
  $('form-name').value = p.name || '';
  $('form-category').value = CATEGORIES.includes(p.category) ? p.category : '';
  $('form-price-buy').value = p.priceBuy ?? '';
  $('form-price-sell').value = p.priceSell ?? '';
  $('form-stock').value = p.stock ?? 1;
  $('form-status').value = p.status || 'Activo';
  calcProfit();
  $('product-modal').showModal();
  setTimeout(() => $('form-name').focus(), 50);
}
function closeModal() { $('product-modal').close(); $('manual-barcode').focus(); }
function calcProfit() {
  const buy = parseFloat($('form-price-buy').value) || 0, sell = parseFloat($('form-price-sell').value) || 0;
  const diff = sell - buy, pct = buy > 0 ? ' · ' + ((diff / buy) * 100).toFixed(0) + '%' : '';
  const d = $('profit-display');
  d.className = 'profit' + (diff < 0 ? ' neg' : '');
  d.innerHTML = `<span>Ganancia por unidad</span><span>${money(diff)}${pct}</span>`;
}
['form-price-buy', 'form-price-sell'].forEach(id => $(id).addEventListener('input', calcProfit));
$('form-stock').addEventListener('input', () => {
  const s = parseInt($('form-stock').value);
  if (s === 0) $('form-status').value = 'Agotado';
  else if ($('form-status').value === 'Agotado') $('form-status').value = 'Activo';
});
function saveProduct() {
  const barcode = $('form-barcode').value;
  const name = $('form-name').value.trim();
  if (!name) { toast('El nombre es obligatorio', 'alert'); $('form-name').focus(); return; }
  const stock = Math.max(0, parseInt($('form-stock').value) || 0);
  const p = {
    barcode, name,
    category: $('form-category').value,
    priceBuy: Math.max(0, parseFloat($('form-price-buy').value) || 0),
    priceSell: Math.max(0, parseFloat($('form-price-sell').value) || 0),
    stock, status: statusOf(stock, $('form-status').value),
    date: new Date().toISOString()
  };
  const i = products.findIndex(x => x.barcode === barcode);
  if (i !== -1) products[i] = p; else products.unshift(p);
  persist(); state.flash = barcode; render(); closeModal();
  toast(isNew ? 'Producto agregado' : 'Cambios guardados');
}
$('btn-save').onclick = saveProduct;
$('btn-cancel').onclick = closeModal;
$('product-modal').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'SELECT') { e.preventDefault(); saveProduct(); } });
$('product-modal').addEventListener('close', () => $('manual-barcode').focus());

function visible() {
  const q = state.q.toLowerCase();
  let list = products.filter(p => {
    if (q && !(p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q))) return false;
    if (state.cat && p.category !== state.cat) return false;
    if (state.filter === 'all') return true;
    if (state.filter === 'low') return p.stock > 0 && p.stock <= LOW;
    return p.status === state.filter;
  });
  const sorts = {
    recent: (a, b) => (b.date || '').localeCompare(a.date || ''),
    name: (a, b) => a.name.localeCompare(b.name, 'es'),
    'stock-asc': (a, b) => a.stock - b.stock,
    'stock-desc': (a, b) => b.stock - a.stock,
    profit: (a, b) => profitOf(b) - profitOf(a)
  };
  return list.sort(sorts[state.sort]);
}
function render() {
  const list = visible();
  $('product-body').innerHTML = list.map(p => {
    const profit = profitOf(p), pct = p.priceBuy > 0 ? Math.round(profit / p.priceBuy * 100) : null;
    const cls = p.stock <= 0 ? 'zero' : p.stock <= LOW ? 'low' : '';
    const catLabel = CATEGORIES.includes(p.category) ? catLabelOf(p.category) : 'Sin categoría';
    return `<tr data-code="${esc(p.barcode)}" class="${state.flash === p.barcode ? 'flash' : ''}">
      <td class="c-name"><div class="pname">${esc(p.name)}</div><div class="pcode">${esc(catLabel)}</div></td>
      <td class="c-stock"><div class="stock ${cls}"><button data-act="minus" aria-label="Restar 1">${ic('minus')}</button><span>${p.stock}</span><button data-act="plus" aria-label="Sumar 1">${ic('plus')}</button></div></td>
      <td class="num hide-sm">${money(p.priceBuy)}</td>
      <td class="num c-sell"><b>${money(p.priceSell)}</b>${pct !== null ? `<div class="margin ${profit < 0 ? 'neg' : ''}">${profit >= 0 ? '+' : ''}${pct}%</div>` : ''}</td>
      <td class="c-status"><span class="badge b-${esc(p.status)}">${esc(p.status)}</span></td>
      <td class="c-act"><div class="rowact"><button data-act="edit" aria-label="Editar">${ic('edit')}</button><button data-act="del" aria-label="Eliminar">${ic('trash')}</button></div></td>
    </tr>`;
  }).join('');
  state.flash = null;
  const e = $('empty');
  e.hidden = list.length > 0;
  if (!list.length) {
    e.innerHTML = products.length
      ? `<div class="big">${ic('search')}</div><h2>Sin resultados</h2><p>Prueba con otra búsqueda o cambia el filtro.</p>`
      : `<div class="big">${ic('barcode')}</div><h2>Tu inventario está vacío</h2><p>Escanea un código con la cámara o escríbelo arriba para agregar tu primer producto.</p>`;
  }
  const units = products.reduce((a, p) => a + (p.stock || 0), 0);
  const cost = products.reduce((a, p) => a + (p.stock || 0) * (p.priceBuy || 0), 0);
  const prof = products.reduce((a, p) => a + (p.stock || 0) * profitOf(p), 0);
  $('s-count').textContent = products.length;
  $('s-units').textContent = units.toLocaleString('en-US');
  $('s-cost').textContent = money(cost).replace(/\.00$/, '');
  $('s-profit').textContent = money(prof).replace(/\.00$/, '');
  const low = products.filter(p => p.stock > 0 && p.stock <= LOW).length;
  $('total-count').textContent = `Mostrando ${list.length} de ${products.length}` + (low ? ` · ${low} con stock bajo` : '');
}
$('product-body').addEventListener('click', async e => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const p = products.find(x => x.barcode === tr.dataset.code); if (!p) return;
  const act = e.target.closest('button')?.dataset.act;
  if (act === 'plus' || act === 'minus') {
    p.stock = Math.max(0, (p.stock || 0) + (act === 'plus' ? 1 : -1));
    p.status = statusOf(p.stock, p.status); p.date = new Date().toISOString();
    persist(); render();
  } else if (act === 'del') {
    if (await confirmDialog('¿Eliminar producto?', `Se borrará "${p.name}" del inventario.`)) {
      products = products.filter(x => x !== p); persist(); render(); toast('Producto eliminado', 'trash');
    }
  } else if (act === 'edit' || !act) openModal(p, false);
});
$('search').addEventListener('input', e => { state.q = e.target.value; render(); });
$('sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
$('chips').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  state.filter = c.dataset.f;
  document.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === c));
  render();
});
$('btn-clear').onclick = async () => {
  if (!products.length) return toast('No hay nada que borrar', 'info');
  if (await confirmDialog('¿Vaciar inventario?', `Se eliminarán los ${products.length} productos. Exporta a Excel antes si quieres un respaldo.`, 'Vaciar todo')) {
    products = []; localStorage.removeItem(KEY); render(); toast('Inventario vaciado', 'trash');
  }
};

const setCamBtn = on => { $('btn-cam').innerHTML = `${ic('camera')}<span class="lbl">${on ? 'Cámara activa' : 'Escanear con cámara'}</span>`; };
setCamBtn(false);
async function startScanner() {
  $('cam').classList.add('on');
  state.scanner = new Html5Qrcode('reader');
  try {
    await state.scanner.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: (w, h) => ({ width: Math.min(w * .85, 320), height: Math.min(h * .6, 170) }) },
      text => {
        const now = Date.now();
        if (text === state.lastScan && now - state.lastScanAt < 2500) return;
        state.lastScan = text; state.lastScanAt = now;
        beep(); handleCode(text);
        if (!$('quick-mode').checked) stopScanner();
      }
    );
    const caps = state.scanner.getRunningTrackCapabilities?.();
    $('btn-torch').hidden = !(caps && caps.torch);
    setCamBtn(true);
  } catch (err) {
    toast('No se pudo abrir la cámara. Revisa los permisos del navegador.', 'alert');
    stopScanner();
  }
}
async function stopScanner() {
  const s = state.scanner; state.scanner = null;
  $('cam').classList.remove('on'); setCamBtn(false);
  if (s) { try { await s.stop(); s.clear(); } catch { } }
}
let torchOn = false;
$('btn-torch').onclick = async () => {
  torchOn = !torchOn;
  try { await state.scanner.applyVideoConstraints({ advanced: [{ torch: torchOn }] }); } catch { toast('Linterna no disponible', 'alert'); }
};
$('btn-cam').onclick = () => state.scanner ? stopScanner() : startScanner();
$('btn-cam-close').onclick = stopScanner;

$('btn-export').onclick = () => {
  if (!products.length) return toast('No hay productos para exportar', 'info');
  const rows = products.map(p => ({
    'Producto': p.name,
    'Categoria': p.category || '',
    'Stock': p.stock,
    'Precio compra': p.priceBuy, 'Precio venta': p.priceSell,
    'Ganancia unidad': +profitOf(p).toFixed(2), 'Estado': p.status,
    'Actualizado': p.date ? new Date(p.date).toLocaleString('es') : ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 20 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  XLSX.writeFile(wb, `OMNI_Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('Excel descargado', 'sheet');
};
$('btn-import').onclick = () => $('file-import').click();
$('file-import').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const wb = XLSX.read(await f.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    let added = 0, updated = 0;
    rows.forEach(r => {
      const barcode = String(r['Código'] ?? r['Codigo'] ?? r.barcode ?? '').trim();
      const name = String(r['Producto'] ?? r.name ?? '').trim();
      if (!barcode || !name) return;
      const stock = Math.max(0, parseInt(r['Stock'] ?? r.stock) || 0);
      const rawCat = String(r['Categoría'] ?? r['Categoria'] ?? r.category ?? '').trim();
      const p = {
        barcode, name, stock,
        category: CATEGORIES.includes(rawCat) ? rawCat : '',
        priceBuy: parseFloat(r['Precio compra'] ?? r.priceBuy) || 0,
        priceSell: parseFloat(r['Precio venta'] ?? r.priceSell) || 0,
        status: statusOf(stock, ['Activo', 'Inactivo', 'Agotado'].includes(r['Estado']) ? r['Estado'] : 'Activo'),
        date: new Date().toISOString()
      };
      const i = products.findIndex(x => x.barcode === barcode);
      if (i !== -1) { products[i] = p; updated++; } else { products.unshift(p); added++; }
    });
    persist(); render(); toast(`Importado: ${added} nuevos, ${updated} actualizados`, 'upload');
  } catch { toast('No se pudo leer el archivo', 'alert'); }
};
render();