import { money, conditions, categories, categoryConfig, brands, brandConfig, locationConfig, makeProductId, parseProductId, dropTitle, statusLabels, escapeHtml as e, isActive, newestFirst, othersLast } from './catalog.js';
import { saveDrop, saveNextDrop } from './data.js';
import { currentSupabaseUser, supabaseConfigured, supabaseDelete, supabaseUpsert } from './supabase.js';

const brandLogos = { Shimano: '/brands/shimano.webp', Daiwa: '/brands/daiwa.webp', Megabass: '/brands/megabass.webp', 'Abu Garcia': '/brands/abugarcia.webp', Jackall: '/brands/jackall.webp', Evergreen: '/brands/evergreen.svg' };
const trashIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16m-10 0V4h4v3m-7 0 1 13h8l1-13M10 11v6m4-6v6"></path></svg>';
const compressImage = file => new Promise((resolve, reject) => {
  if (!file?.type?.startsWith('image/')) { reject(new Error('Fail gambar tidak sah.')); return; }
  const finish = (source, cleanup = () => {}) => {
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / source.width, maxDimension / source.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext('2d');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      cleanup();
      if (!blob || blob.type !== 'image/webp') { reject(new Error('Browser ini tidak menyokong WebP.')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Gambar tidak dapat diproses.'));
      reader.readAsDataURL(blob);
    }, 'image/webp', .9);
  };
  if (typeof createImageBitmap === 'function') {
    createImageBitmap(file, { imageOrientation: 'from-image' }).then(bitmap => finish(bitmap, () => bitmap.close())).catch(() => {
      const image = new Image();
      image.onload = () => finish(image, () => URL.revokeObjectURL(image.src));
      image.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
      image.src = URL.createObjectURL(file);
    });
  } else {
    const image = new Image();
    image.onload = () => finish(image, () => URL.revokeObjectURL(image.src));
    image.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
    image.src = URL.createObjectURL(file);
  }
});

const startProcessing = (form, label = 'Memproses gambar...') => {
  const button = form.querySelector('button[type="submit"]');
  const original = button?.innerHTML || '';
  form.dataset.processing = 'true';
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = label; }
  return () => { delete form.dataset.processing; if (button) { button.disabled = false; button.removeAttribute('aria-busy'); button.innerHTML = original; } };
};

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"' && quoted) { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(value => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

// Deliberately a public UI, not authentication or production administration.
// ponytail: edits live in memory; authenticated backend writes replace this later.
export function renderAdmin(root, products, drop, { section = 'dashboard', toast, openDialog, closeDialog, refresh, auditLog = [], actor = 'admin', actorEmail = actor, nextDropState = { value: null } }) {
  products.forEach(product => { if (product.brand && product.model) product.name = `${product.brand} ${product.model}`; });
  let query = '';
  let filter = '';
  let categoryFilter = '';
  let page = 1;
  const savedView = key => { try { return localStorage.getItem(key) === 'grid' ? 'grid' : 'list'; } catch { return 'list'; } };
  let viewMode = savedView('rimstackle-admin-product-view');
  let locationViewMode = savedView('rimstackle-admin-location-view');
  const pageSize = 16;
  const brandItems = brandConfig.map(brand => ({ ...brand, logo: brand.logo || brandLogos[brand.name] || '' }));
  const otherBrand = { name: 'Others', code: 'OTH', logo: '' };
  const locations = locationConfig.flatMap(city => city.sections.map(section => ({ ...section, city: city.city })));
  const categoriesList = categoryConfig.map(category => ({ ...category }));
  const syncBrands = () => { brandConfig.splice(0, brandConfig.length, ...brandItems.map(({ name, code, logo }) => ({ name, code, logo }))); brands.splice(0, brands.length, ...brandItems.map(brand => brand.name), 'Others'); };
  const syncCategories = () => { categoryConfig.splice(0, categoryConfig.length, ...categoriesList.map(({ name, label }) => ({ name, label }))); categories.splice(0, categories.length, ...categoriesList.map(category => category.name)); };
  const syncLocations = () => { const grouped = locations.reduce((groups, location) => { (groups[location.city] ||= []).push({ code: location.code, name: location.name, stores: location.stores }); return groups; }, {}); locationConfig.splice(0, locationConfig.length, ...Object.entries(grouped).map(([city, sections]) => ({ city, sections }))); };
  const brandChoices = () => [...brandItems, otherBrand];
  const locationChoices = () => locations;
  const storeChoices = location => location?.stores || [];
  const managedDrops = () => [drop, ...(nextDropState.value ? [nextDropState.value] : [])];
  const dropOptions = selected => options(managedDrops().map(item => [item.id, dropTitle(item)]), selected);
  const getDrop = id => managedDrops().find(item => item.id === id) || drop;
  const selected = new Set();
  let profileName = (() => { try { const profiles = JSON.parse(localStorage.getItem('rimstackle-admin-profiles') || '{}'); return profiles[actorEmail] || JSON.parse(localStorage.getItem('rimstackle-admin-profile') || '{}').name || ''; } catch { return ''; } })();
  const options = (values, current) => othersLast(values).map(([value, label]) => `<option value="${e(value)}" ${value === current ? 'selected' : ''}>${e(label)}</option>`).join('');
  const adminStatusLabel = value => value === 'EXPIRED' ? 'Tidak aktif' : statusLabels[value];
  const states = Object.entries(statusLabels).filter(([value]) => value !== 'EXPIRED');
  const editableStates = states;
  const dropEnd = () => new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(drop.ends_at));
  const dropEndLabel = value => new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value.ends_at));
  const dropState = value => value.status === 'DRAFT' ? ['draft', 'Draf'] : isActive(value) ? ['available', 'Aktif'] : ['expired', 'Tidak aktif'];
  const recordChange = (action, target, detail = '') => { const actorId = currentSupabaseUser()?.id || null; const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), actorId, actor, action, target, detail }; auditLog.unshift(entry); auditLog.splice(100); try { localStorage.setItem('rimstackle-audit-log', JSON.stringify(auditLog)); } catch { /* Browser storage is optional. */ } if (supabaseConfigured) supabaseUpsert('audit_log', { actor_user_id: actorId, actor_name: actor, action, target, detail, created_at: entry.at }).catch(() => {}); };
  const recordStatusChange = (product, previous, next) => { if (previous === next) return; const action = next === 'SOLD' ? 'Produk terjual' : next === 'RESERVED' ? 'Produk ditempah' : 'Tukar status produk'; recordChange(action, product.code, `${product.name} · ${statusLabels[previous] || previous} ke ${statusLabels[next] || next}`); };
  const formatAuditDate = value => new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short', hour12: true, timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value));
  const auditMarkup = entries => entries.length ? entries.map(item => {
    const isStatusChange = ['Produk terjual', 'Produk ditempah', 'Tukar status produk'].includes(item.action);
    const separator = isStatusChange ? String(item.detail || '').lastIndexOf(' · ') : -1;
    const productName = separator >= 0 ? item.detail.slice(0, separator) : '';
    const statusChange = separator >= 0 ? item.detail.slice(separator + 3) : item.detail;
    const target = `${item.target}${isStatusChange && productName ? ` · ${productName}` : !isStatusChange && item.detail ? ` · ${item.detail}` : ''}`;
    return `<article class="admin-audit-item"><span class="admin-audit-marker" aria-hidden="true"></span><div class="admin-audit-copy"><strong>${e(item.action)}</strong><span>${e(target)}</span>${isStatusChange && statusChange ? `<span class="audit-change-detail">${e(statusChange)}</span>` : ''}</div><div class="admin-audit-meta"><time datetime="${e(item.at)}">${e(formatAuditDate(item.at))}</time><span>${e(item.actor)}</span></div></article>`;
  }).join('') : '<p class="muted">Tiada rekod perubahan.</p>';
  function draw() {
    if (section === 'dashboard') return drawDashboard();
    if (section === 'brands') return drawBrands();
    if (section === 'locations') return drawLocations();
    if (section === 'categories') return drawCategories();
    if (section === 'audit') return drawAudit();
    if (section === 'import') return drawImport();
    if (section === 'drop') return drawDrop();
    if (section === 'profile') return drawProfile();
    const visible = products.filter(product => `${product.name} ${product.code} ${product.store || ''}`.toLowerCase().includes(query.toLowerCase()) && (!filter || product.status === filter) && (!categoryFilter || product.category === categoryFilter)).sort(newestFirst);
    const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
    page = Math.min(page, pageCount);
    const pageItems = visible.slice((page - 1) * pageSize, page * pageSize);
    root.innerHTML = `<section id="admin-products-page" class="admin-page"><p class="eyebrow">RUANG KERJA PASUKAN · PRODUK</p><div class="admin-title-row"><h1>Pengurusan produk</h1><button type="button" class="button dark" id="add-product"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>Tambah produk</button></div><p class="notice admin-retention-note"><strong>Auto-padam:</strong> Produk akan dinyahaktifkan selepas Weekly Drop tamat.</p>
    <form id="admin-search" class="admin-tools"><label class="sr-only" for="admin-query">Cari jenama, model atau ID produk</label><div class="admin-search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 5 5"></path></svg><input id="admin-query" name="q" type="search" placeholder="Cari jenama, model atau ID produk" value="${e(query)}"><button class="button dark" type="submit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 5 5"></path></svg>Cari</button></div><label class="sr-only" for="admin-status">Tapis status</label><select id="admin-status"><option value="">Semua status</option>${options(states, filter)}</select><label class="sr-only" for="admin-category">Tapis kategori</label><select id="admin-category"><option value="">Semua kategori</option>${options(categoriesList.map(category => [category.name, category.label]), categoryFilter)}</select></form>
    <div class="admin-view-toggle" role="group" aria-label="Paparan produk"><strong>Paparan</strong><button type="button" class="button ${viewMode === 'list' ? 'selected' : ''}" data-product-view="list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"></path></svg>Senarai</button><button type="button" class="button ${viewMode === 'grid' ? 'selected' : ''}" data-product-view="grid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="6" height="6"></rect><rect x="14" y="4" width="6" height="6"></rect><rect x="4" y="14" width="6" height="6"></rect><rect x="14" y="14" width="6" height="6"></rect></svg>Grid</button></div><div class="admin-tools admin-bulk-tools"><strong id="selection-count">${selected.size} dipilih</strong><label for="bulk-status">Status baru untuk item dipilih<select id="bulk-status">${options(editableStates, 'AVAILABLE')}</select></label><button class="button" id="bulk-apply" ${selected.size ? '' : 'disabled'}>Simpan status</button></div>
    <div class="admin-select-all"><input type="checkbox" id="select-all-mobile" aria-label="Pilih semua produk pada halaman ini" ${pageItems.length && pageItems.every(product => selected.has(product.code)) ? 'checked' : ''}><span>Pilih semua produk pada halaman ini</span></div><div id="admin-products" class="admin-table-wrap ${viewMode === 'grid' ? 'grid-view' : ''}" tabindex="0" role="region" aria-label="Senarai produk"><table class="admin-table"><thead><tr><th><label class="check-target"><input type="checkbox" id="select-all" aria-label="Pilih semua produk pada halaman ini" ${pageItems.length && pageItems.every(product => selected.has(product.code)) ? 'checked' : ''}></label></th><th>Produk / ID</th><th>Kedai</th><th>Harga jualan</th><th>Harga kedai (¥)</th><th>Kondisi</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>${pageItems.map(product => `<tr><td><label class="check-target"><input type="checkbox" data-select="${e(product.code)}" aria-label="Pilih ${e(product.code)}" ${selected.has(product.code) ? 'checked' : ''}></label></td><td>${e(product.name)}${product.subtitle ? `<small>${e(product.subtitle)}</small>` : ''}<small>${e(product.code)}</small></td><td>${e(product.store || '-')}</td><td>${money(product.price)}</td><td>${product.japanPrice ? `¥${new Intl.NumberFormat('ja-JP').format(product.japanPrice)}` : '-'}</td><td>${e(product.condition)}</td><td><span class="status ${product.status.toLowerCase()}">${e(adminStatusLabel(product.status))}</span></td><td><div class="admin-row-actions"><button class="button admin-delete-button" data-delete="${e(product.code)}" aria-label="Padam ${e(product.code)}">${trashIcon}<span>Padam</span></button><button class="button admin-edit-button" data-edit="${e(product.code)}" aria-label="Ubah ${e(product.code)}">Ubah</button></div></td></tr>`).join('')}</tbody></table>${visible.length ? '' : '<div class="empty-state"><p>Tiada produk dijumpai. Cuba carian atau status lain.</p></div>'}</div><div class="pagination-wrap admin-pagination"><p>${visible.length ? `Menunjukkan ${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, visible.length)} daripada ${visible.length} produk` : ''}</p>${pageCount > 1 ? `<nav class="pagination" aria-label="Halaman senarai produk">${Array.from({ length: pageCount }, (_, index) => index + 1).map(number => `<button type="button" class="pagination-link ${number === page ? 'selected' : ''}" data-admin-page="${number}" ${number === page ? 'aria-current="page"' : ''}>${number}</button>`).join('')}</nav>` : ''}</div></section>`;
    root.querySelector('#admin-search').onsubmit = event => { event.preventDefault(); query = new FormData(event.target).get('q'); selected.clear(); page = 1; draw(); root.querySelector('#admin-query').focus(); };
    root.querySelector('#admin-status').onchange = event => { filter = event.target.value; selected.clear(); page = 1; draw(); root.querySelector('#admin-status').focus(); };
    root.querySelector('#admin-category').onchange = event => { categoryFilter = event.target.value; selected.clear(); page = 1; draw(); root.querySelector('#admin-category').focus(); };
    root.querySelectorAll('[data-product-view]').forEach(button => { button.onclick = () => { viewMode = button.dataset.productView; try { localStorage.setItem('rimstackle-admin-product-view', viewMode); } catch { /* Browser storage is optional. */ } draw(); }; });
    root.querySelectorAll('[data-admin-page]').forEach(button => { button.onclick = () => { page = Number(button.dataset.adminPage); draw(); root.querySelector('#admin-products').focus(); }; });
    const selectAll = checked => { for (const product of pageItems) checked ? selected.add(product.code) : selected.delete(product.code); draw(); };
    root.querySelector('#select-all').onchange = event => selectAll(event.target.checked);
    root.querySelector('#select-all-mobile').onchange = event => selectAll(event.target.checked);
    root.querySelectorAll('[data-select]').forEach(input => { input.onchange = () => { input.checked ? selected.add(input.dataset.select) : selected.delete(input.dataset.select); const allSelected = pageItems.length > 0 && pageItems.every(product => selected.has(product.code)); const someSelected = pageItems.some(product => selected.has(product.code)); root.querySelector('#selection-count').textContent = `${selected.size} dipilih`; root.querySelector('#bulk-apply').disabled = !selected.size; root.querySelectorAll('#select-all, #select-all-mobile').forEach(selectAllInput => { selectAllInput.checked = allSelected; selectAllInput.indeterminate = someSelected && !allSelected; }); }; });
    root.querySelectorAll('[data-edit]').forEach(button => { button.onclick = () => editProduct(products.find(product => product.code === button.dataset.edit)); });
    root.querySelectorAll('[data-delete]').forEach(button => { button.onclick = () => deleteProduct(products.find(product => product.code === button.dataset.delete)); });
    root.querySelector('#bulk-apply').onclick = () => {
      const next = root.querySelector('#bulk-status').value;
      if (next === 'AVAILABLE' && products.some(product => selected.has(product.code) && !isActive(getDrop(product.dropId)))) { toast('Aktifkan tempoh drop dahulu sebelum menerbitkan produk.'); return; }
      openDialog('Sahkan perubahan status', `<div class="dialog-body"><p>Tukar ${selected.size} produk kepada <strong>${statusLabels[next]}</strong>? Perubahan ini akan kelihatan dalam katalog pada pelayar ini.</p><button id="confirm-bulk" class="button dark full-width" style="margin-top:20px">Ya, tukar status</button></div>`);
      document.querySelector('#confirm-bulk').onclick = () => { const changed = []; for (const product of products) if (selected.has(product.code) && product.status !== next) { const previous = product.status; product.status = next; changed.push({ product, previous }); } changed.forEach(({ product, previous }) => recordStatusChange(product, previous, next)); if (changed.length) saveDrop(drop, products); else recordChange('Tukar status', `${selected.size} produk`, statusLabels[next]); closeDialog(); toast(`${changed.length || selected.size} produk dikemas kini.`); selected.clear(); draw(); };
    };
    root.querySelector('#add-product').onclick = addProduct;
  }
  function drawDashboard() {
    root.innerHTML = `<section id="admin-dashboard" class="admin-page"><p class="eyebrow">RUANG KERJA PASUKAN · ADMIN</p><div class="admin-title-row"><h1>Dashboard</h1></div><p class="notice">Ringkasan pengurusan untuk ${e(dropTitle(drop))}.</p><div class="admin-stats">${['DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD'].map(state => `<div><strong>${products.filter(product => product.status === state).length}</strong><span>${statusLabels[state]}</span></div>`).join('')}</div><div class="admin-priority-grid"><button class="button dark admin-priority-button" data-admin-link="products"><span>Urus produk</span><small>Tambah, ubah dan kemas kini stok</small></button><button class="button dark admin-priority-button admin-priority-drop" data-admin-link="drop"><span>Urus Weekly Drop</span><small>Tempoh, status dan drop semasa</small></button></div><div class="admin-dashboard-audit"><div class="admin-section-heading"><div><p class="eyebrow">AKTIVITI</p><h2>Perubahan terkini</h2></div><button class="button" data-admin-link="audit">Lihat semua</button></div><div class="admin-audit-list">${auditMarkup(auditLog.slice(0, 10))}</div></div></section>`;
    root.querySelectorAll('[data-admin-link]').forEach(button => { button.onclick = () => { location.replace(`#/admin/${button.dataset.adminLink}`); }; });
  }
  function drawAudit() {
    let auditAction = '';
    let auditActor = '';
    let auditDate = '';
    const render = () => {
      const actions = [...new Set(auditLog.map(item => item.action))].sort();
      const actorKey = item => item.actorId || `name:${String(item.actor || '').trim()}`;
      const actorLabels = new Map(auditLog.map(item => [actorKey(item), String(item.actor || '').trim()]).filter(([, label]) => label));
      const actors = [...actorLabels].sort(([, a], [, b]) => a.localeCompare(b, 'ms'));
      const entries = [...auditLog].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).filter(item => (!auditAction || item.action === auditAction) && (!auditActor || actorKey(item) === auditActor) && (!auditDate || item.at.slice(0, 10) === auditDate));
      root.innerHTML = `<section id="admin-audit" class="admin-page"><div class="admin-section-heading"><div><p class="eyebrow">AKTIVITI</p><h1>Rekod perubahan</h1><p class="muted">Semak siapa yang mengubah data dan bila perubahan dibuat.</p></div></div><form id="audit-filter" class="admin-tools"><label>Jenis perubahan<select id="audit-action"><option value="">Semua perubahan</option>${options(actions.map(value => [value, value]), auditAction)}</select></label><label>Pengguna<select id="audit-actor"><option value="">Semua pengguna</option>${options(actors, auditActor)}</select></label><label>Tarikh<input id="audit-date" type="date" value="${e(auditDate)}"></label></form><div class="admin-audit-list">${auditMarkup(entries)}</div></section>`;
      root.querySelector('#audit-action').onchange = event => { auditAction = event.target.value; render(); };
      root.querySelector('#audit-actor').onchange = event => { auditActor = event.target.value; render(); };
      root.querySelector('#audit-date').onchange = event => { auditDate = event.target.value; render(); };
    };
    render();
  }
  function drawBrands() {
    root.innerHTML = `<section id="admin-brands" class="admin-page"><div class="admin-section-heading"><div><p class="eyebrow">KATALOG</p><h1>Brand & Logo</h1><p class="muted">Short form ini digunakan untuk jana Product ID.</p></div><button class="button dark" id="add-brand">Tambah brand</button></div><div class="admin-brand-grid">${brandItems.map((brand, index) => `<article class="admin-brand-card"><div class="admin-brand-logo">${brand.logo ? `<img src="${brand.logo}" alt="${e(brand.name)}">` : '<span>Tiada logo</span>'}</div><strong>${e(brand.name)}</strong><small class="muted">Short form: ${e(brand.code)}</small><button class="button" type="button" data-edit-brand="${index}">Ubah brand</button></article>`).join('')}</div></section>`;
    root.querySelector('#add-brand').onclick = () => editBrand();
    root.querySelectorAll('[data-edit-brand]').forEach(button => { button.onclick = () => editBrand(Number(button.dataset.editBrand)); });
  }
  function drawDrop() {
    const [currentClass, currentLabel] = dropState(drop);
    const next = nextDropState.value;
    const nextCard = next ? (() => { const [nextClass, nextLabel] = dropState(next); const deleteButton = isActive(next) ? '' : `<button class="button admin-delete-button" id="delete-next-drop" type="button">${trashIcon}<span>Padam</span></button>`; return `<article class="admin-drop admin-drop-next"><div><p class="eyebrow">PERSEDIAAN SETERUSNYA</p><h2>${e(dropTitle(next))}</h2><div class="admin-drop-meta"><span><b>Status</b><strong class="status ${nextClass}">${nextLabel}</strong></span><span><b>Tamat</b>${e(dropEndLabel(next))} MYT</span></div></div><div class="admin-drop-actions"><button class="button" id="edit-next-drop" type="button">Ubah drop seterusnya</button>${deleteButton}</div></article>`; })() : '<article class="admin-drop admin-drop-next"><div><p class="eyebrow">PERSEDIAAN SETERUSNYA</p><h2>Belum disediakan</h2><p class="muted">Sediakan tempoh dan ID untuk Weekly Drop minggu depan.</p></div><button class="button dark" id="add-next-drop">Tambah Weekly Drop</button></article>';
    root.innerHTML = `<section id="admin-drop" class="admin-page"><p class="eyebrow">KATALOG</p><h1>Weekly Drop</h1><div class="admin-drop-list"><article class="admin-drop"><div><h2>${e(dropTitle(drop))}</h2><div class="admin-drop-meta"><span><b>Status</b><strong class="status ${currentClass}">${currentLabel}</strong></span><span><b>Tamat</b>${e(dropEnd())} MYT</span></div></div><button class="button" id="edit-drop">Ubah tempoh drop</button></article>${nextCard}</div></section>`;
    root.querySelector('#edit-drop').onclick = editDrop;
    root.querySelector('#edit-next-drop')?.addEventListener('click', () => editDrop('next'));
    root.querySelector('#add-next-drop')?.addEventListener('click', () => addNextDrop());
    root.querySelector('#delete-next-drop')?.addEventListener('click', deleteNextDrop);
  }
  function drawProfile() {
    root.innerHTML = `<section id="admin-profile" class="admin-page"><div class="admin-profile-card"><p class="eyebrow">TETAPAN</p><h1>Profil</h1><p class="admin-profile-copy">Urus nama yang dipaparkan dalam ruang kerja admin.</p><div class="admin-profile-account"><span>Nama akaun</span><strong>${e(profileName || actorEmail)}</strong>${profileName ? `<small>${e(actorEmail)}</small>` : ''}</div><form id="profile-form" class="admin-profile-form"><label>Nama paparan<input name="name" maxlength="80" value="${e(profileName)}" placeholder="Nama admin" required></label><p id="profile-error" class="form-error" role="alert"></p><button class="button dark" type="submit">Simpan perubahan</button></form></div></section>`;
    root.querySelector('#profile-form').onsubmit = async event => { event.preventDefault(); const name = new FormData(event.target).get('name').trim(); let profiles = {}; try { profiles = JSON.parse(localStorage.getItem('rimstackle-admin-profiles') || '{}'); } catch { profiles = {}; } if (Object.entries(profiles).some(([email, value]) => email !== actorEmail && String(value).trim().toLowerCase() === name.toLowerCase())) { document.querySelector('#profile-error').textContent = 'Nama ini sudah digunakan. Sila pilih nama lain.'; return; } if (supabaseConfigured && currentSupabaseUser()?.id) { try { await supabaseUpsert('admin_profiles', { user_id: currentSupabaseUser().id, display_name: name, updated_at: new Date().toISOString() }); } catch (error) { document.querySelector('#profile-error').textContent = error.message || 'Nama profil tidak dapat disimpan.'; return; } } profileName = name; profiles[actorEmail] = name; actor = name; try { localStorage.setItem('rimstackle-admin-profiles', JSON.stringify(profiles)); localStorage.setItem('rimstackle-admin-profile', JSON.stringify({ name })); auditLog.forEach(item => { if (item.actor === actorEmail) item.actor = name; }); localStorage.setItem('rimstackle-audit-log', JSON.stringify(auditLog)); } catch { /* Browser storage is optional. */ } recordChange('Ubah profil', actor, profileName); toast('Nama profil disimpan.'); drawProfile(); };
  }
  function drawImport() {
    let rows = [];
    const field = (row, names) => names.map(name => row[name]).find(value => value != null && value !== '') || '';
    const normalizeRows = rawRows => rawRows.map(row => {
      const code = field(row, ['code', 'product_id', 'id']);
      const parsed = parseProductId(code);
      const images = field(row, ['images', 'image']).split('|').map(value => value.trim()).filter(Boolean);
      return { raw: row, code, brand: field(row, ['brand', 'jenama']), model: field(row, ['model', 'nama_model']), category: field(row, ['category', 'kategori']), price: field(row, ['price', 'harga', 'harga_jualan']), japanPrice: field(row, ['japan_price', 'harga_kedai', 'harga_kedai_jepun']), condition: field(row, ['condition', 'kondisi']) || 'Baru', grade: field(row, ['grade', 'score', 'skor']), status: field(row, ['status']) || 'DRAFT', subtitle: field(row, ['subtitle', 'subtajuk']), description: field(row, ['description', 'butiran']), dropId: field(row, ['drop_id', 'weekly_drop']) || drop.id, locationCode: field(row, ['location_code', 'tempat']) || parsed.locationCode, brandCode: field(row, ['brand_code']) || parsed.brandCode, idNumber: field(row, ['id_number', 'number']) || parsed.idNumber, store: field(row, ['store', 'kedai']), images }; });
    const validate = item => { const errors = []; if (!item.code || !/^[A-Za-z0-9]+-[A-Za-z0-9]+-.+$/.test(item.code)) errors.push('Product ID'); if (!item.brand || !item.model) errors.push('brand/model'); if (!categoriesList.some(category => category.name === item.category)) errors.push('kategori'); if (!Number.isFinite(Number(item.price)) || Number(item.price) <= 0) errors.push('harga'); if (!Object.keys(statusLabels).includes(item.status)) errors.push('status'); if (products.some(product => product.code.toLowerCase() === item.code.toLowerCase())) errors.push('ID sudah ada'); return errors; };
    const renderPreview = () => { const valid = rows.filter(item => !validate(item).length); root.querySelector('#import-preview').innerHTML = rows.length ? `<p>${valid.length} daripada ${rows.length} baris sedia untuk diimport.</p><div class="admin-import-table"><table><thead><tr><th>Product ID</th><th>Produk</th><th>Kategori</th><th>Semakan</th></tr></thead><tbody>${rows.slice(0, 10).map(item => `<tr><td>${e(item.code || '-')}</td><td>${e(`${item.brand} ${item.model}`.trim() || '-')}</td><td>${e(item.category || '-')}</td><td class="${validate(item).length ? 'import-error' : 'import-ok'}">${validate(item).length ? e(validate(item).join(', ')) : 'OK'}</td></tr>`).join('')}</tbody></table></div>${rows.length > 10 ? '<p class="muted">Pratonton menunjukkan 10 baris pertama.</p>' : ''}` : '<p class="muted">Belum ada fail dipilih.</p>'; root.querySelector('#import-submit').disabled = !rows.length || valid.length !== rows.length; };
    root.innerHTML = `<section id="admin-import" class="admin-page"><div class="admin-section-heading"><div><p class="eyebrow">DATA</p><h1>Import produk</h1><p class="muted">Isi Mobile Form untuk satu produk. Untuk banyak produk, isi Bulk Import kemudian simpan sheet itu sebagai CSV UTF-8.</p></div><div class="admin-import-links"><a class="button" href="/rimstackle-product-template.xlsx" download>Muat turun template Excel</a><a class="button" href="https://drive.google.com/drive/folders/18cLYMQqUvrxRfuMCc2cjhF2dQNQjrO16?usp=sharing" target="_blank" rel="noreferrer">Buka folder Google Drive</a></div></div><div class="notice"><strong>Kolum wajib:</strong> product_id, brand, model, category, price. Kolum tambahan: location_code, brand_code, id_number, store, subtitle, japan_price, condition, grade, status, description, images.</div><label class="import-file-label">Pilih fail CSV<input id="import-file" type="file" accept=".csv,text/csv"></label><div id="import-preview" class="admin-import-preview"><p class="muted">Belum ada fail dipilih.</p></div><div class="dialog-actions import-actions"><button class="button dark" id="import-submit" type="button" disabled>Import produk</button></div></section>`;
    root.querySelector('#import-file').onchange = async event => { const file = event.target.files[0]; if (!file) return; rows = normalizeRows(parseCSV(await file.text())); renderPreview(); };
    root.querySelector('#import-submit').onclick = () => { for (const item of rows) { const parsed = parseProductId(item.code); products.push({ code: item.code.trim(), brand: item.brand.trim(), model: item.model.trim(), name: `${item.brand.trim()} ${item.model.trim()}`, locationCode: item.locationCode || parsed.locationCode, brandCode: item.brandCode || parsed.brandCode, idNumber: item.idNumber || parsed.idNumber, store: item.store.trim(), subtitle: item.subtitle.trim(), dropId: item.dropId, category: item.category, price: Number(item.price), japanPrice: item.japanPrice ? Number(item.japanPrice.replace(/[^0-9.]/g, '')) : null, condition: item.condition, grade: item.grade ? Number(item.grade) : null, status: item.status, description: item.description.trim(), sequence: products.length + 1, images: item.images }); } saveDrop(drop, products); recordChange('Import produk', `${rows.length} produk`); toast(`${rows.length} produk berjaya diimport.`); location.replace('#/admin/products'); };
  }
  function drawLocations() {
    const grouped = locations.reduce((groups, location, index) => { (groups[location.city] ||= []).push({ ...location, index }); return groups; }, {});
    root.innerHTML = `<section id="admin-locations" class="admin-page ${locationViewMode === 'grid' ? 'location-grid-view' : ''}"><div class="admin-section-heading"><div><p class="eyebrow">KATALOG</p><h1>Tempat & Kedai</h1><p class="muted">Bandar dibahagi kepada beberapa bahagian. Setiap bahagian boleh mempunyai banyak kedai.</p></div><div class="admin-view-toggle" role="group" aria-label="Paparan tempat dan kedai"><strong>Paparan</strong><button type="button" class="button ${locationViewMode === 'list' ? 'selected' : ''}" data-location-view="list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"></path></svg>Senarai</button><button type="button" class="button ${locationViewMode === 'grid' ? 'selected' : ''}" data-location-view="grid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="6" height="6"></rect><rect x="14" y="4" width="6" height="6"></rect><rect x="4" y="14" width="6" height="6"></rect><rect x="14" y="14" width="6" height="6"></rect></svg>Grid</button></div><button class="button dark" id="add-location">Tambah bahagian</button></div>${Object.entries(grouped).map(([city, cityLocations]) => `<section class="admin-location-group"><h2>${e(city)}</h2><div class="admin-location-grid ${locationViewMode === 'grid' ? 'grid-view' : ''}">${cityLocations.map(location => `<article class="admin-location-card"><strong>${e(location.name)}</strong><code>${e(location.code)}</code><span>${location.stores.length} kedai</span><ul>${location.stores.map(store => `<li>${e(store)}</li>`).join('')}</ul><button class="button" type="button" data-edit-location="${location.index}">Ubah bahagian & kedai</button></article>`).join('')}</div></section>`).join('')}</section>`;
    root.querySelector('#add-location').onclick = () => editLocation();
    root.querySelectorAll('[data-location-view]').forEach(button => { button.onclick = () => { locationViewMode = button.dataset.locationView; try { localStorage.setItem('rimstackle-admin-location-view', locationViewMode); } catch { /* Browser storage is optional. */ } root.querySelector('#admin-locations').classList.toggle('location-grid-view', locationViewMode === 'grid'); root.querySelectorAll('.admin-location-grid').forEach(grid => grid.classList.toggle('grid-view', locationViewMode === 'grid')); root.querySelectorAll('[data-location-view]').forEach(item => item.classList.toggle('selected', item === button)); }; });
    root.querySelectorAll('[data-edit-location]').forEach(button => { button.onclick = () => editLocation(Number(button.dataset.editLocation)); });
  }
  function drawCategories() {
    root.innerHTML = `<section id="admin-categories" class="admin-page"><div class="admin-section-heading"><div><p class="eyebrow">KATALOG</p><h1>Kategori produk</h1><p class="muted">Kategori ini digunakan dalam borang produk dan filter senarai.</p></div><button class="button dark" id="add-category">Tambah kategori</button></div><div class="admin-category-list">${categoriesList.map((category, index) => `<article class="admin-category-card"><strong>${e(category.name)}</strong><span>${e(category.label)}</span><button class="button" type="button" data-edit-category="${index}">Ubah kategori</button></article>`).join('')}</div></section>`;
    root.querySelector('#add-category').onclick = () => editCategory();
    root.querySelectorAll('[data-edit-category]').forEach(button => { button.onclick = () => editCategory(Number(button.dataset.editCategory)); });
  }
  function editCategory(index) {
    const current = index == null ? { name: '', label: '' } : categoriesList[index];
    openDialog(index == null ? 'Tambah kategori' : 'Ubah kategori', `<form id="category-form" class="editor-form"><label>Nama kategori<input name="name" required maxlength="60" value="${e(current.name)}" placeholder="Contoh: Accessories"></label><label>Nama paparan<input name="label" required maxlength="60" value="${e(current.label)}" placeholder="Accessories"></label><p id="category-error" class="form-error" role="alert"></p><button class="button dark" type="submit">Simpan kategori</button></form>`);
    document.querySelector('#category-form').onsubmit = async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); const name = values.name.trim(); if (categoriesList.some((category, i) => i !== index && category.name.toLowerCase() === name.toLowerCase())) { document.querySelector('#category-error').textContent = 'Kategori ini sudah ada.'; return; } const value = { name, label: values.label.trim() }; if (supabaseConfigured) { try { await supabaseUpsert('categories', value); } catch (error) { document.querySelector('#category-error').textContent = error.message || 'Kategori tidak dapat disimpan.'; return; } } if (index == null) categoriesList.push(value); else categoriesList[index] = value; syncCategories(); recordChange(index == null ? 'Tambah kategori' : 'Ubah kategori', value.name); closeDialog(); draw(); toast('Kategori dikemas kini.'); };
  }
  function editBrand(index) {
    const current = index == null ? { name: '', code: '', logo: '' } : brandItems[index];
    openDialog(index == null ? 'Tambah brand' : 'Ubah brand', `<form id="brand-form" class="editor-form"><label>Nama brand<input name="name" required maxlength="60" value="${e(current.name)}" placeholder="Contoh: Shimano"></label><label>Short form<input name="code" required maxlength="5" pattern="[A-Za-z0-9]{2,5}" value="${e(current.code)}" placeholder="SHI"></label><label>Logo brand<input name="logo" type="file" accept="image/*" ${current.logo ? '' : 'required'}></label>${current.logo ? `<div class="admin-brand-form-preview"><img src="${current.logo}" alt="Pratonton ${e(current.name)}"></div>` : ''}<p id="brand-error" class="form-error" role="alert"></p><button class="button dark" type="submit">Simpan brand</button></form>`);
    const form = document.querySelector('#brand-form');
    form.onsubmit = async event => {
      event.preventDefault();
      if (form.dataset.processing) return;
      const name = form.elements.name.value.trim();
      const code = form.elements.code.value.trim().toUpperCase();
      const file = form.elements.logo.files[0];
      const finishProcessing = startProcessing(form);
      let logo = current.logo;
      if (file) { try { logo = await compressImage(file); } catch (error) { finishProcessing(); document.querySelector('#brand-error').textContent = error.message || 'Logo tidak dapat diproses.'; return; } }
      finishProcessing();
      if (!/^[A-Z0-9]{2,5}$/.test(code) || brandItems.some((brand, i) => i !== index && brand.code === code)) { document.querySelector('#brand-error').textContent = 'Short form mesti 2–5 aksara dan unik.'; return; }
      if (brandItems.some((brand, i) => i !== index && brand.name.toLowerCase() === name.toLowerCase())) { document.querySelector('#brand-error').textContent = 'Brand ini sudah ada.'; return; }
      if (index == null) brandItems.push({ name, code, logo }); else Object.assign(brandItems[index], { name, code, logo });
      if (supabaseConfigured) { try { await supabaseUpsert('brands', { code, name, logo }); } catch (error) { document.querySelector('#brand-error').textContent = error.message || 'Brand tidak dapat disimpan.'; return; } }
      syncBrands(); recordChange(index == null ? 'Tambah brand' : 'Ubah brand', name, code); closeDialog(); draw(); toast('Brand dan logo dikemas kini.');
    };
  }
  function editLocation(index) {
    const current = index == null ? { city: '', code: '', name: '', stores: [] } : locations[index];
    openDialog(index == null ? 'Tambah bahagian tempat' : 'Ubah bahagian & kedai', `<form id="location-form" class="editor-form"><label>Bandar<input name="city" required maxlength="60" value="${e(current.city)}" placeholder="Tokyo"></label><label>Kod bahagian<input name="code" required maxlength="10" pattern="[A-Za-z0-9]+" value="${e(current.code)}" placeholder="TKY03"></label><label>Nama bahagian<input name="name" required maxlength="60" value="${e(current.name)}" placeholder="Tokyo 03"></label><label>Senarai kedai <small>(satu kedai setiap baris)</small><textarea name="stores" rows="5" required placeholder="Kedai Shibuya\nKedai Ueno">${e(current.stores.join('\n'))}</textarea></label><p id="location-error" class="form-error" role="alert"></p><button class="button dark" type="submit">Simpan bahagian</button></form>`);
     document.querySelector('#location-form').onsubmit = async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); const code = values.code.trim().toUpperCase(); const stores = values.stores.split('\n').map(store => store.trim()).filter(Boolean); if (!/^[A-Z0-9]+$/.test(code) || locations.some((location, i) => i !== index && location.code === code) || !stores.length) { document.querySelector('#location-error').textContent = 'Kod bahagian mesti unik dan sekurang-kurangnya satu kedai diperlukan.'; return; } const value = { city: values.city.trim(), code, name: values.name.trim(), stores }; if (supabaseConfigured) { try { await supabaseUpsert('locations', value); } catch (error) { document.querySelector('#location-error').textContent = error.message || 'Bahagian tidak dapat disimpan.'; return; } } if (index == null) locations.push(value); else locations[index] = value; syncLocations(); recordChange(index == null ? 'Tambah bahagian' : 'Ubah bahagian', `${value.city} · ${value.name}`, `${stores.length} kedai`); closeDialog(); draw(); toast('Bahagian dan senarai kedai dikemas kini.'); };
  }
  function addProduct() {
    const firstLocation = locations[0];
    const firstBrand = brandItems[0];
    openDialog('Tambah produk', `<form id="add-form" class="editor-form"><div class="admin-product-preview" id="add-card-preview"><div class="admin-preview-photo"><span>Tiada foto</span></div><div class="admin-preview-copy"></div></div><div class="admin-image-list" id="add-image-list"><p class="muted">Tiada gambar dipilih.</p></div><label>Tempat / bahagian<select name="locationCode">${options(locationChoices().map(location => [location.code, `${location.city} · ${location.name}`]), firstLocation.code)}</select></label><label>Kedai (pilihan)<select name="store">${options(firstLocation.stores.map(store => [store, store]), '')}</select></label><label>Brand<select name="brand">${options(brandChoices().map(brand => [brand.name, `${brand.name} · ${brand.code}`]), firstBrand.name)}</select></label><label>Nombor ID<input name="idNumber" type="text" inputmode="numeric" pattern="[0-9]+" required placeholder="0125"><output id="add-generated-id" class="generated-product-id">Product ID: ${e(makeProductId(firstLocation.code, firstBrand.code, ''))}</output></label><label>Model<input name="model" required placeholder="Nama model"></label><label>Subtajuk produk<input name="subtitle" maxlength="120" placeholder="Baitcasting · Pemegang kanan"></label><label>Weekly Drop<select name="dropId">${dropOptions(drop.id)}</select></label><label>Kategori<select name="category">${options(categoriesList.map(category => [category.name, category.label]), 'Reel')}</select></label><label>Harga jualan (RM)<input name="price" type="number" min="0.01" max="1000000" step="0.01" required></label><label>Kondisi<select name="condition">${options(conditions.map(value => [value, value]), 'Baru')}</select></label><label>Skor kondisi (1–10, pilihan)<input name="grade" type="number" min="1" max="10" step="1"></label><label>Status<select name="status">${options(editableStates, 'DRAFT')}</select></label><label>Gambar produk (kamera atau galeri)<input name="images" type="file" accept="image/*" capture="environment" multiple></label><label>Butiran produk<textarea name="description" rows="4" maxlength="1500" required placeholder="Butiran ringkas produk"></textarea></label><p id="add-error" class="form-error" role="alert"></p><button class="button dark" type="submit">Tambah produk</button></form>`);
    const addForm = document.querySelector('#add-form');
    let draftImages = [];
    const syncPreview = () => {
      const location = locations.find(item => item.code === addForm.elements.locationCode.value) || firstLocation;
      const brand = brandChoices().find(item => item.name === addForm.elements.brand.value) || firstBrand;
      const code = makeProductId(location.code, brand.code, addForm.elements.idNumber.value);
      document.querySelector('#add-generated-id').textContent = `Product ID: ${code}`;
      document.querySelector('#add-card-preview .admin-preview-photo').innerHTML = draftImages[0] ? `<img src="${draftImages[0]}" alt="Pratonton gambar">` : '<span>Tiada foto</span>';
      document.querySelector('#add-card-preview .admin-preview-copy').innerHTML = `<span class="status ${addForm.elements.status.value.toLowerCase()}">${statusLabels[addForm.elements.status.value]}</span><small>${e(brand.name)}</small><strong>${e(addForm.elements.model.value.trim() || 'Nama model')}</strong>${addForm.elements.subtitle.value.trim() ? `<span>${e(addForm.elements.subtitle.value.trim())}</span>` : ''}<span>${e(addForm.elements.condition.value)}${addForm.elements.grade.value ? ` · ${e(addForm.elements.grade.value)}/10` : ''}</span><b>${addForm.elements.price.value ? money(addForm.elements.price.value) : 'RM0'}</b><small>Product ID: ${e(code)}</small>`;
    };
    const drawImages = () => { document.querySelector('#add-image-list').innerHTML = draftImages.length ? draftImages.map((image, index) => `<div class="admin-image-item"><img src="${image}" alt="Gambar ${index + 1}"><button type="button" class="text-button" data-remove-image="${index}">Buang</button></div>`).join('') : '<p class="muted">Tiada gambar dipilih.</p>'; syncPreview(); };
    const syncId = syncPreview;
    addForm.elements.locationCode.onchange = () => { const location = locations.find(item => item.code === addForm.elements.locationCode.value); addForm.elements.store.innerHTML = options(storeChoices(location).map(store => [store, store]), ''); syncId(); }; addForm.querySelectorAll('input, select').forEach(field => field.addEventListener('input', syncPreview)); addForm.querySelectorAll('select').forEach(field => field.addEventListener('change', syncPreview));
    document.querySelector('#add-image-list').onclick = event => { const remove = event.target.closest('[data-remove-image]'); if (!remove) return; draftImages.splice(Number(remove.dataset.removeImage), 1); drawImages(); };
    addForm.elements.images.onchange = async () => { if (addForm.dataset.processing) return; const files = [...addForm.elements.images.files]; const finishProcessing = startProcessing(addForm); try { draftImages = await Promise.all(files.map(compressImage)); drawImages(); } catch (error) { document.querySelector('#add-error').textContent = error.message || 'Gambar tidak dapat diproses.'; } finally { finishProcessing(); } };
    addForm.elements.price.closest('label').insertAdjacentHTML('beforebegin', '<label>Harga kedai Jepun (¥)<input name="japanPrice" type="number" min="0" step="1"></label>');
    syncPreview();
    addForm.onsubmit = async event => {
      event.preventDefault();
      const form = event.target;
      if (form.dataset.processing) return;
      const values = Object.fromEntries(new FormData(event.target));
      const location = locations.find(item => item.code === values.locationCode);
      const brand = brandChoices().find(item => item.name === values.brand);
      if (!/^\d+$/.test(values.idNumber.trim())) { document.querySelector('#add-error').textContent = 'Nombor ID mesti diisi dengan nombor.'; return; }
      const code = makeProductId(location.code, brand.code, values.idNumber);
      if (products.some(product => product.code.toLowerCase() === code.toLowerCase())) { document.querySelector('#add-error').textContent = 'Product ID sudah digunakan.'; return; }
      if (values.status === 'AVAILABLE' && !isActive(getDrop(values.dropId))) { document.querySelector('#add-error').textContent = 'Drop mesti aktif sebelum produk diterbitkan.'; return; }
      const images = draftImages;
      products.push({ code, locationCode: location.code, store: values.store, brandCode: brand.code, idNumber: values.idNumber.trim(), brand: brand.name, model: values.model.trim(), name: `${brand.name} ${values.model.trim()}`, dropId: values.dropId, category: values.category, price: Number(values.price), condition: values.condition, grade: values.grade ? Number(values.grade) : null, status: values.status, subtitle: values.subtitle.trim(), description: values.description.trim(), sequence: products.length + 1, images });
      products.at(-1).japanPrice = values.japanPrice ? Number(values.japanPrice) : null;
      saveDrop(drop, products);
      recordChange('Tambah produk', code, `${brand.name} ${values.model.trim()}`);
      closeDialog(); draw(); toast('Produk ditambah.');
    };
  }
  function deleteProduct(product) {
    if (!product) return;
    openDialog('Padam produk?', `<div class="dialog-body"><p>Padam <strong>${e(product.name)}</strong> (${e(product.code)}) daripada senarai?</p><div class="dialog-actions"><button class="button" id="cancel-delete">Batal</button><button class="button dark" id="confirm-delete">${trashIcon}<span>Ya, padam</span></button></div></div>`);
    document.querySelector('#cancel-delete').onclick = closeDialog;
    document.querySelector('#confirm-delete').onclick = () => { const index = products.indexOf(product); if (index >= 0) products.splice(index, 1); saveDrop(drop, products); if (supabaseConfigured) supabaseDelete('products', `?code=eq.${encodeURIComponent(product.code)}`).catch(() => {}); recordChange('Padam produk', product.code, product.name); selected.delete(product.code); closeDialog(); draw(); toast('Produk dipadam.'); };
  }
  function editProduct(product) {
    let draftImages = [...product.images];
    const parsed = parseProductId(product.code);
    const selectedLocation = product.locationCode || parsed.locationCode || locations[0].code;
    const selectedBrand = brandChoices().find(brand => brand.name === product.brand || brand.code === (product.brandCode || parsed.brandCode)) || otherBrand;
    const selectedNumber = product.idNumber || parsed.idNumber || '';
    const editLocation = locations.find(location => location.code === selectedLocation) || locations[0];
    openDialog('Ubah produk', `<form id="edit-form" class="editor-form"><div class="admin-product-preview" id="editor-card-preview"><div class="admin-preview-photo">${product.images[0] ? `<img src="${product.images[0]}" alt="">` : '<span>Tiada foto</span>'}</div><div class="admin-preview-copy"><span class="status ${product.status.toLowerCase()}">${e(adminStatusLabel(product.status))}</span><small>${e(product.brand)}</small><strong>${e(product.model)}</strong>${product.subtitle ? `<span>${e(product.subtitle)}</span>` : ''}<span>${e(product.condition)}${product.grade ? ` · ${product.grade}/10` : ''}</span><b>${money(product.price)}</b><small>Product ID: ${e(product.code)}</small></div></div><div class="admin-image-list" id="editor-image-list"></div><label>Tempat / bahagian<select name="locationCode">${options(locationChoices().map(location => [location.code, `${location.city} · ${location.name}`]), selectedLocation)}</select></label><label>Kedai (pilihan)<select name="store">${options(editLocation.stores.map(store => [store, store]), product.store || '')}</select></label><label>Brand<select name="brand">${options(brandChoices().map(brand => [brand.name, `${brand.name} · ${brand.code}`]), selectedBrand.name)}</select></label><label>Model<input name="model" required maxlength="120" value="${e(product.model)}" placeholder="Nama model"></label><label>Nombor ID<input name="idNumber" type="text" inputmode="numeric" pattern="[0-9]+" value="${e(selectedNumber)}" required><output id="edit-generated-id" class="generated-product-id">Product ID: ${e(makeProductId(selectedLocation, selectedBrand.code, selectedNumber))}</output></label><label>Subtajuk produk<input name="subtitle" maxlength="120" value="${e(product.subtitle || '')}" placeholder="Baitcasting · Pemegang kanan"></label><label>Weekly Drop<select name="dropId">${dropOptions(product.dropId || drop.id)}</select></label><label>Kategori<select name="category">${options(categoriesList.map(category => [category.name, category.label]), product.category)}</select></label><label>Harga jualan (RM)<input name="price" type="number" min="0.01" max="1000000" step="0.01" value="${product.price}" required></label><label>Kondisi<select name="condition">${options(conditions.map(value => [value, value]), product.condition)}</select></label><label>Skor kondisi (1–10, pilihan)<input name="grade" type="number" min="1" max="10" step="1" value="${product.grade || ''}"></label><label>Status<select name="status">${options(product.status === 'EXPIRED' ? [...editableStates, ['EXPIRED', 'Tidak aktif']] : editableStates, product.status)}</select></label><label>Tambah gambar produk (kamera atau galeri)<input name="images" type="file" accept="image/*" capture="environment" multiple></label><p class="muted">Pilih beberapa gambar, kemudian buang mana-mana gambar yang tersilap.</p><label>Butiran produk<textarea name="description" rows="4" maxlength="1500" required>${e(product.description)}</textarea></label><p id="editor-error" class="form-error" role="alert"></p><button class="button dark" type="submit">Simpan perubahan</button></form>`);
    const form = document.querySelector('#edit-form');
    const syncId = () => { const location = locations.find(item => item.code === form.elements.locationCode.value); const brand = brandChoices().find(item => item.name === form.elements.brand.value); document.querySelector('#edit-generated-id').textContent = `Product ID: ${makeProductId(location.code, brand.code, form.elements.idNumber.value)}`; }; form.elements.locationCode.onchange = () => { const location = locations.find(item => item.code === form.elements.locationCode.value); form.elements.store.innerHTML = options(storeChoices(location).map(store => [store, store]), ''); syncId(); }; form.elements.brand.onchange = syncId; form.elements.idNumber.oninput = syncId;
    form.elements.price.closest('label').insertAdjacentHTML('beforebegin', `<label>Harga kedai Jepun (¥)<input name="japanPrice" type="number" min="0" step="1" value="${product.japanPrice || ''}"></label>`);
    const imageList = document.querySelector('#editor-image-list');
    const drawImages = () => { imageList.innerHTML = draftImages.length ? draftImages.map((image, index) => `<div class="admin-image-item"><img src="${image}" alt="Gambar ${index + 1}"><button type="button" class="text-button" data-remove-image="${index}">Buang</button></div>`).join('') : '<p class="muted">Tiada gambar dipilih.</p>'; document.querySelector('#editor-card-preview .admin-preview-photo').innerHTML = draftImages[0] ? `<img src="${draftImages[0]}" alt="Pratonton gambar">` : '<span>Tiada foto</span>'; };
    drawImages();
    imageList.onclick = event => { const remove = event.target.closest('[data-remove-image]'); if (!remove) return; draftImages.splice(Number(remove.dataset.removeImage), 1); drawImages(); };
      form.elements.images.onchange = async () => { if (form.dataset.processing) return; const files = [...form.elements.images.files]; const finishProcessing = startProcessing(form); try { draftImages = await Promise.all(files.map(compressImage)); drawImages(); } catch (error) { document.querySelector('#editor-error').textContent = error.message || 'Gambar tidak dapat diproses.'; } finally { finishProcessing(); } };
    form.onsubmit = async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.target));
      if (values.status === 'AVAILABLE' && !isActive(getDrop(values.dropId))) { document.querySelector('#editor-error').textContent = 'Drop mesti aktif sebelum produk diterbitkan.'; return; }
      const location = locations.find(item => item.code === values.locationCode);
      const brandConfig = brandChoices().find(item => item.name === values.brand);
      if (!/^\d+$/.test(values.idNumber.trim())) { document.querySelector('#editor-error').textContent = 'Nombor ID mesti diisi dengan nombor.'; return; }
      const code = makeProductId(location.code, brandConfig.code, values.idNumber);
      if (products.some(item => item !== product && item.code.toLowerCase() === code.toLowerCase())) { document.querySelector('#editor-error').textContent = 'Product ID sudah digunakan.'; return; }
      const oldCode = product.code;
      const oldStatus = product.status;
      const model = values.model.trim();
      Object.assign(product, { code, locationCode: location.code, store: values.store, brandCode: brandConfig.code, idNumber: values.idNumber.trim(), brand: brandConfig.name, model, name: `${brandConfig.name} ${model}`, dropId: values.dropId, category: values.category, price: Number(values.price), condition: values.condition, grade: values.grade ? Number(values.grade) : null, status: values.status, subtitle: values.subtitle.trim(), description: values.description.trim(), images: draftImages });
      if (selected.has(oldCode)) { selected.delete(oldCode); selected.add(code); }
      product.japanPrice = values.japanPrice ? Number(values.japanPrice) : null;
      saveDrop(drop, products);
      recordStatusChange(product, oldStatus, product.status);
      if (oldStatus === product.status) recordChange('Ubah produk', code, product.name);
      closeDialog(); draw(); toast('Produk dikemas kini.');
    };
  }
  function deleteNextDrop() {
    const target = nextDropState.value;
    if (!target) return;
    openDialog('Padam Weekly Drop?', `<div class="dialog-body"><p>Padam <strong>${e(dropTitle(target))}</strong> daripada persediaan?</p><p class="muted">Produk yang ditetapkan pada drop ini akan kembali menjadi Draf.</p><div class="dialog-actions"><button class="button" id="cancel-delete-drop" type="button">Batal</button><button class="button dark" id="confirm-delete-drop" type="button">${trashIcon}<span>Ya, padam</span></button></div></div>`);
    document.querySelector('#cancel-delete-drop').onclick = closeDialog;
    document.querySelector('#confirm-delete-drop').onclick = () => { for (const product of products) if (product.dropId === target.id) { product.dropId = drop.id; product.status = 'DRAFT'; } nextDropState.value = null; saveNextDrop(null); saveDrop(drop, products); recordChange('Padam Weekly Drop', target.id, dropTitle(target)); closeDialog(); refresh(); toast('Weekly Drop seterusnya dipadam.'); };
  }
  function editDrop(kind = 'current', seed = null) {
    const isNext = kind === 'next';
    const wasExisting = isNext && Boolean(nextDropState.value);
    const target = isNext ? (nextDropState.value || seed) : drop;
    if (!target) return;
    const localMY = value => new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16);
    openDialog(isNext ? 'Weekly Drop seterusnya' : 'Tempoh Weekly Drop', `<form id="drop-form" class="editor-form"><p>Title dijana automatik daripada ID. Contoh: drop-0007 → Japan Weekly Drop 7.</p><label>ID Weekly Drop<input name="id" required maxlength="40" pattern="drop-[0-9]+" value="${e(target.id)}"></label><label>Mula<input name="start" type="datetime-local" value="${localMY(target.starts_at)}" required></label><label>Tamat<input name="end" type="datetime-local" value="${localMY(target.ends_at)}" required></label><label>Status<select name="status">${options([['ACTIVE', 'Aktif'], ['DRAFT', 'Draf']], target.status)}</select></label><p id="drop-error" class="form-error" role="alert"></p><button class="button dark" type="submit">Simpan tempoh</button></form>`);
    document.querySelector('#drop-form').onsubmit = event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.target));
      const start = `${values.start}:00+08:00`;
      const end = `${values.end}:00+08:00`;
      const id = values.id.trim();
      if (!/^drop-[0-9]+$/i.test(id)) { document.querySelector('#drop-error').textContent = 'Format ID mesti seperti drop-0007.'; return; }
      if (Date.parse(end) <= Date.parse(start)) { document.querySelector('#drop-error').textContent = 'Waktu tamat mesti selepas waktu mula.'; return; }
      if (managedDrops().some(item => item !== target && item.id === id.toLowerCase())) { document.querySelector('#drop-error').textContent = 'ID Weekly Drop sudah digunakan.'; return; }
      const oldId = target.id;
      for (const product of products) if (product.dropId === oldId) product.dropId = id.toLowerCase();
      Object.assign(target, { id: id.toLowerCase(), number: String(Number(id.slice(5))), starts_at: start, ends_at: end, status: values.status });
      const activated = isNext && values.status === 'ACTIVE';
      if (activated) { Object.assign(drop, target); nextDropState.value = null; saveNextDrop(null); saveDrop(drop, products); }
      else if (isNext) { nextDropState.value = target; saveNextDrop(target); saveDrop(drop, products); }
      else saveDrop(drop, products);
      recordChange(activated ? 'Aktifkan Weekly Drop' : isNext ? (wasExisting ? 'Ubah Weekly Drop' : 'Tambah Weekly Drop') : 'Ubah Weekly Drop', id.toLowerCase(), dropTitle(target));
      closeDialog(); refresh(); toast(activated ? 'Weekly Drop ini kini aktif untuk customer.' : isNext ? 'Weekly Drop seterusnya disimpan.' : 'Tempoh dikemas kini.');
    };
  }
  function addNextDrop() {
    const number = Number(drop.number || String(drop.id).replace(/\D/g, '')) + 1;
    const starts = new Date(Date.parse(drop.ends_at));
    const ends = new Date(starts.getTime() + 7 * 24 * 3600000);
    editDrop('next', { id: `drop-${String(number).padStart(4, '0')}`, number: String(number), status: 'DRAFT', starts_at: starts.toISOString(), ends_at: ends.toISOString() });
  }
  draw();
}







