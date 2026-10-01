import './style.css';
import { products, drop, nextDrop } from './data.js';
import { money, statusLabels, conditions, categories, brands, categoryConfig, brandConfig, locationConfig, dropTitle, isActive, productStatus, findProducts, lockMessage, whatsappUrl, othersLast, escapeHtml as e } from './catalog.js';
import { currentSupabaseUser, getSupabaseSession, signInWithPassword, signOut, supabaseConfigured, supabaseTable } from './supabase.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const phone = import.meta.env.VITE_WHATSAPP_NUMBER || '60175799853';
const adminEmail = () => currentSupabaseUser()?.email || '';
const isAdminAuthenticated = () => { const session = getSupabaseSession(); return Boolean(session?.access_token && (!session.expires_at || session.expires_at > Math.floor(Date.now() / 1000) + 15)); };
const adminProfileName = () => { const email = adminEmail(); try { const profiles = JSON.parse(localStorage.getItem('rimstackle-admin-profiles') || '{}'); return profiles[email] || JSON.parse(localStorage.getItem('rimstackle-admin-profile') || '{}').name || ''; } catch { return ''; } };
const auditLog = (() => { const email = adminEmail(); const displayActor = adminProfileName() || email; try { const value = JSON.parse(localStorage.getItem('rimstackle-audit-log') || '[]'); const cleaned = Array.isArray(value) ? value.filter(item => !String(item.id || '').startsWith('seed-')).map(item => item.actor === email && displayActor !== email ? { ...item, actor: displayActor } : item) : []; localStorage.setItem('rimstackle-audit-log', JSON.stringify(cleaned)); return cleaned; } catch { return []; } })();
const pageSize = 10;
let route;
let lastRoute = '';
let timer;
let toastTimer;
let returnFocus;
let dialogCloseTimer;
let menuCloseTimer;
let pageLeaveTimer;
let deferredInstallPrompt = null;
let appInstalled = false;
let catalogReturn = '#/catalog';
let catalogStatus = supabaseConfigured ? 'loading' : 'ready';
let wasActive = isActive(drop);
const nextDropState = { value: nextDrop };
const brandAssets = {
  Shimano: '/brands/shimano.webp',
  Daiwa: '/brands/daiwa.webp',
  Megabass: '/brands/megabass.webp',
  'Abu Garcia': '/brands/abugarcia.webp',
  Jackall: '/brands/jackall.webp',
  Evergreen: '/brands/evergreen.svg',
};
const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  filter: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  chat: '<path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z"/><path d="M8 10h8m-8 4h5"/>',
  whatsapp: '<circle cx="12" cy="12" r="8.5"/><path d="m7.8 18.2 1-2.7"/><path d="M9.2 8.7c.2-.3.4-.4.7-.3l1 .4c.2.1.3.3.2.5l-.4.7c-.1.2-.1.3 0 .5.3.5.8 1 1.3 1.3.2.1.3.1.5 0l.6-.4c.2-.1.4-.1.5.1l.5 1c.1.2 0 .4-.2.5-.4.3-.9.4-1.3.2-1.1-.3-2-.9-2.8-1.7-.7-.7-1.2-1.5-1.5-2.4-.1-.4 0-.7.2-1Z"/>',
  home: '<path d="m3 10 9-7 9 7v11H3Z"/><path d="M9 21v-8h6v8"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  box: '<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M7 2v6m10-6v6M7 14h3m4 0h3m-10 4h3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  eye: '<path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff: '<path d="m3 3 18 18M10.6 6.7A10.5 10.5 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a17.8 17.8 0 0 1-3 3.5M6.2 6.3C3.9 7.8 2.5 12 2.5 12s3.5 5.5 9.5 5.5c1 0 1.9-.2 2.8-.5"/><path d="M9.9 9.9a2.5 2.5 0 0 0 3.5 3.5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  logout: '<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><path d="M14 8l4 4-4 4M8 12h10"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M10 5h4M10.5 18.5h3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.arrow}</svg>`;
const adminInstallButton = () => isStandalonePwa() || appInstalled ? '' : `<button class="admin-install-button" type="button" data-action="install-app">${icon('phone')}<span>Install app</span></button>`;
const whatsappLogo = '<img class="whatsapp-logo" src="/whatsapp.webp" alt="" width="24" height="24">';
const url = (page, filters = {}) => `#/${page}${Object.values(filters).some(Boolean) ? `?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '')).toString()}` : ''}`;
const status = value => `<span class="status ${value.toLowerCase()}"><span aria-hidden="true"></span>${statusLabels[value]}</span>`;
const condition = product => `${e(product.condition)}${product.grade ? ` · ${product.grade}/10` : ''}`;
const categoryLabel = category => ({ Kekili: 'Reel', 'Alat ganti': 'Spare part' }[category] || category);
const dateLabel = value => new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'long', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value));
const endLabel = () => dateLabel(new Date(Date.parse(drop.ends_at) - 1));
function currentRoute() {
  const [path, query = ''] = location.hash.slice(2).split('?');
  const [page = 'home', code] = path.split('/');
  let decodedCode = '';
  try { decodedCode = code ? decodeURIComponent(code) : ''; } catch { /* Malformed links show the normal not-found state. */ }
  return { page: page || 'home', code: decodedCode, filters: Object.fromEntries(new URLSearchParams(query)) };
}
const isStandalonePwa = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
function syncAdminPwa(admin) {
  const existing = document.querySelector('#admin-manifest');
  if (admin) {
    if (!existing) { const link = document.createElement('link'); link.id = 'admin-manifest'; link.rel = 'manifest'; link.href = '/admin-manifest.json'; document.head.append(link); }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin-sw.js', { scope: '/' }).catch(() => {});
  } else {
    existing?.remove();
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(registrations => registrations.filter(registration => registration.active?.scriptURL.endsWith('/admin-sw.js')).forEach(registration => registration.unregister())).catch(() => {});
  }
}

function header() {
  const active = route.page;
  return `  <header class="site-header"><div class="shell header-inner">
    <a class="wordmark" href="#/home" aria-label="RIMSTACKLE, laman utama">RIMS<span>TACKLE</span><small>JAPAN SOURCING. MALAYSIA ANGLERS.</small></a>
    <nav class="desktop-nav" aria-label="Menu utama">${[['home', 'Utama'], ['catalog', 'Cari produk'], ['help', 'Bantuan']].map(([key, label]) => `<a href="#/${key}" ${active === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <div class="header-actions"><button class="text-size" data-action="text-size" aria-pressed="${document.documentElement.classList.contains('large-text')}" aria-label="Besarkan tulisan">A<span>A</span></button></div>
  </div></header>`;
}
function adminHeader() {
  const current = route.code || 'dashboard';
  return `<header class="site-header admin-header"><div class="shell header-inner">
    <a class="wordmark" href="#/admin" aria-label="RIMSTACKLE, dashboard admin">RIMS<span>TACKLE</span><small>ADMIN PANEL</small></a>
    <nav class="admin-primary-nav" aria-label="Menu admin">${[['dashboard', 'Dashboard'], ['products', 'Produk'], ['drop', 'Weekly Drop'], ['brands', 'Brand & Logo'], ['locations', 'Tempat & Kedai'], ['categories', 'Kategori'], ['audit', 'Rekod perubahan']].map(([target, label]) => `<button type="button" data-action="admin-route" data-target="${target}" ${current === target ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</nav>
    <div class="admin-menu-wrap"><button class="button admin-menu-toggle" type="button" data-action="admin-menu" aria-expanded="false" aria-controls="admin-menu">Menu</button><div id="admin-menu" class="admin-menu" hidden><button class="admin-account-email admin-profile-link" type="button" data-action="admin-route" data-target="profile" aria-label="Buka tetapan profil"><span>${e(adminProfileName() || adminEmail())}</span>${icon('chevron')}</button><button type="button" data-action="admin-route" data-target="import">Import</button>${adminInstallButton()}<button class="admin-logout-button" type="button" data-action="admin-placeholder" data-label="Log keluar">${icon('logout')}<span>Log keluar</span></button></div></div>
  </div></header>`;
}
function adminLogin() {
  return `<main id="main" class="shell admin-login-page" tabindex="-1"><section class="admin-login-card"><p class="eyebrow">RUANG KERJA ADMIN</p><h1>Log masuk</h1><p class="admin-login-copy">Masuk untuk mengurus produk, Weekly Drop dan rekod perubahan.</p><form id="admin-login-form" class="admin-login-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Kata laluan<div class="password-field"><input name="password" type="password" autocomplete="current-password" required><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Tunjukkan kata laluan">${icon('eye')}</button></div></label><p id="admin-login-error" class="form-error" role="alert"></p><button class="button dark" type="submit">Masuk ke panel</button></form></section></main><footer class="site-footer shell admin-footer"><p class="footer-note">© ${new Date().getFullYear()} RIMSTACKLE<br>Web Developed by @amnhmb</p></footer>`;
}
function adminBottomNav() {
  const current = route.code || 'dashboard';
  return `<nav class="admin-mobile-nav" aria-label="Menu admin telefon"><button type="button" data-action="admin-route" data-target="dashboard" ${current === 'dashboard' ? 'aria-current="page"' : ''}>${icon('home')}<span>Dashboard</span></button><button type="button" data-action="admin-route" data-target="products" ${current === 'products' ? 'aria-current="page"' : ''}>${icon('box')}<span>Produk</span></button><button type="button" data-action="admin-menu" aria-expanded="false" aria-controls="admin-mobile-menu">${icon('grid')}<span>Menu</span></button><div id="admin-mobile-menu" class="admin-menu admin-mobile-menu" hidden><button class="admin-account-email admin-profile-link" type="button" data-action="admin-route" data-target="profile" aria-label="Buka tetapan profil"><span>${e(adminProfileName() || adminEmail())}</span>${icon('chevron')}</button><button type="button" data-action="admin-route" data-target="drop">Weekly Drop</button><button type="button" data-action="admin-route" data-target="brands">Brand & Logo</button><button type="button" data-action="admin-route" data-target="locations">Tempat & Kedai</button><button type="button" data-action="admin-route" data-target="categories">Kategori</button><button type="button" data-action="admin-route" data-target="audit">Rekod perubahan</button><button type="button" data-action="admin-route" data-target="import">Import</button>${adminInstallButton()}<button class="admin-logout-button" type="button" data-action="admin-placeholder" data-label="Log keluar">${icon('logout')}<span>Log keluar</span></button></div></nav>`;
}
function search() {
  return `<div class="search-row shell"><form class="search-form" role="search">${icon('search')}<label class="sr-only" for="search">Cari jenama, model atau ID produk</label><input id="search" name="q" type="search" autocomplete="off" placeholder="Cari jenama, model atau ID produk" value="${e(route.filters.q || '')}"><button class="button dark" type="submit">${icon('search')}Cari</button></form><p class="search-note">Pilihan dari Jepun.<br><strong>Urusan terus di WhatsApp.</strong></p></div>`;
}
function bottomNav() {
  return `<nav class="mobile-nav" aria-label="Menu telefon">${[['home', 'home', 'Utama'], ['catalog', 'search', 'Cari produk'], ['help', 'chat', 'Bantuan']].map(([key, glyph, label]) => `<a href="#/${key}" ${route.page === key ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></a>`).join('')}</nav>`;
}
function footer(admin = false) {
  if (admin) return `<footer class="site-footer shell admin-footer"><p class="footer-note">© ${new Date().getFullYear()} RIMSTACKLE<br>Web Developed by @amnhmb</p></footer>`;
  return `<footer class="site-footer shell"><div><a class="wordmark" href="#/home">RIMS<span>TACKLE</span></a><p>Pilihan tackle Jepun untuk kaki pancing Malaysia.</p></div><div class="footer-links"><a href="#/help">Cara LOCK item</a><a href="#/categories">Kategori</a></div><p class="footer-note">Ketersediaan disahkan melalui WhatsApp.<br>© ${new Date().getFullYear()} RIMSTACKLE<br>Web Developed by @amnhmb</p></footer>`;
}

function hero() {
  const active = isActive(drop);
  const count = findProducts(products, drop, { status: 'AVAILABLE' }).length;
  if (!active) return `<section class="drop-hero inactive"><div class="hero-copy"><p class="eyebrow">${e(dropTitle(drop).toUpperCase())}</p><h1>Jumpa lagi di<br>drop seterusnya.</h1><p>Tempoh sourcing semasa sudah tamat. Semak semula untuk pilihan terbaru.</p><a href="#/help" class="button light">Bagaimana Weekly Drop berfungsi ${icon('arrow')}</a></div></section>`;
  return `<section class="drop-hero" aria-labelledby="hero-title"><div class="hero-copy"><p class="eyebrow"><span class="live-dot"></span> SOURCING DARI JEPUN <span class="drop-edition">DROP ${e(drop.number)}</span></p><h1 id="hero-title">Tackle pilihan.<br><span>Peluang terhad.</span></h1><p>Pilihan tackle dari Jepun.<br> Sahkan stok melalui WhatsApp.</p><a class="button gold" href="${url('catalog', { status: 'AVAILABLE' })}">Lihat ${count} item tersedia ${icon('arrow')}</a></div>
  <div class="hero-product"><img src="/images/conquest.jpg" alt="Reel Shimano Calcutta Conquest, foto rujukan katalog" width="481" height="481" fetchpriority="high"><div class="hero-caption"><span>DALAM DROP INI</span><strong>Calcutta Conquest</strong><a href="#/product/OSK02-SHI-0098" aria-label="Lihat Shimano Calcutta Conquest">${icon('arrow')}</a></div></div>
  <div class="drop-bottom"><div><span class="eyebrow">${e(dropTitle(drop))}</span><p>${dateLabel(drop.starts_at)} – ${endLabel()} <span>· Waktu Malaysia</span></p></div><div class="countdown-wrap"><span>Tamat dalam</span><div id="countdown" class="countdown" aria-label="Baki tempoh Weekly Drop"></div></div></div></section>`;
}

function productCard(product) {
  const photo = product.images[0] ? `<img src="${product.images[0]}" alt="${e(product.name)} - gambar rujukan" width="480" height="480" loading="lazy" decoding="async">` : '<span class="no-photo-label">Tiada foto</span>';
  return `<article class="product-card"><a href="#/product/${encodeURIComponent(product.code)}" class="product-link" aria-label="${e(product.name)}, ${money(product.price)}, ${statusLabels[product.status]}"><div class="product-photo ${product.images.length ? '' : 'no-photo'}">${photo}</div><div class="photo-copy"><div class="photo-topline">${status(product.status)}<span class="card-arrow" aria-hidden="true">${icon('arrow')}</span></div><p class="brand-name">${e(product.brand)}</p><h3>${e(product.model)}</h3><div class="photo-meta"><p class="product-condition">${condition(product)}</p><p class="price">${money(product.price)}</p></div><p class="product-code">ID: ${e(product.code)}</p></div></a></article>`;
}

function catalog() {
  const filters = route.filters;
  const items = findProducts(products, drop, filters);
  const preview = route.page === 'home' && !Object.keys(filters).length;
  const pageCount = preview ? 1 : Math.max(1, Math.ceil(items.length / pageSize));
  const page = preview ? 1 : Math.min(Math.max(1, Number.parseInt(filters.page || '1', 10) || 1), pageCount);
  const visibleItems = preview ? items.slice(0, 4) : items.slice((page - 1) * pageSize, page * pageSize);
  const isHome = route.page === 'home';
  const chips = Object.entries(filters).filter(([key, value]) => !['sort', 'page'].includes(key) && value);
  const labels = { q: 'Carian', brand: 'Jenama', category: 'Kategori', condition: 'Kondisi', status: 'Status', min: 'Min RM', max: 'Maks RM' };
  return `<section id="catalog" class="catalog-section" aria-labelledby="catalog-title"><div class="section-heading"><div><p class="eyebrow">${route.page === 'weekly' ? e(dropTitle(drop)) : 'PILIHAN MINGGU INI'}</p><h${isHome ? '2' : '1'} id="catalog-title">${filters.q ? `Carian “${e(filters.q)}”` : filters.brand || filters.category ? e(filters.brand || filters.category) : route.page === 'weekly' ? 'Semua item dalam drop' : isHome ? 'Cari peneman trip seterusnya.' : 'Semua produk'}</h${isHome ? '2' : '1'}></div><span class="result-count" role="status">${items.length} produk</span></div>
  <div class="category-tabs" aria-label="Kategori produk">${['', ...categories].map(category => { const nextFilters = { ...filters, category }; delete nextFilters.page; return `<a class="category-tab ${(filters.category || '') === category ? 'selected' : ''}" href="${url('catalog', nextFilters)}" ${(filters.category || '') === category ? 'aria-current="true"' : ''}>${category ? categoryLabel(category) : 'Semua'}</a>`; }).join('')}</div><p class="category-scroll-hint">← Boleh slide kiri kanan →</p>
  <div class="catalog-tools"><button class="button" data-action="filters">${icon('filter')} Tapis produk ${chips.length ? `<span class="filter-count">${chips.length}</span>` : ''}</button><label class="sort-label">Susun:<select id="sort" aria-label="Susun produk"><option value="newest" ${filters.sort === 'newest' ? 'selected' : ''}>Terbaru</option><option value="price-asc" ${filters.sort === 'price-asc' ? 'selected' : ''}>Harga rendah dahulu</option><option value="price-desc" ${filters.sort === 'price-desc' ? 'selected' : ''}>Harga tinggi dahulu</option></select></label></div>
  ${chips.length ? `<div class="filter-chips">${chips.map(([key, value]) => `<button data-remove-filter="${e(key)}" aria-label="Buang penapis ${labels[key]} ${e(value)}">${labels[key]}: ${e(key === 'status' ? statusLabels[value] : key === 'category' ? categoryLabel(value) : value)} ${icon('close')}</button>`).join('')}<a href="${url(route.page)}">Padam semua</a></div>` : ''}
  ${items.length ? `<div class="product-grid">${visibleItems.map(productCard).join('')}</div><div class="pagination-wrap"><p>${preview ? '4 pilihan untuk anda' : `Menunjukkan ${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, items.length)} daripada ${items.length} produk`}</p>${preview ? '<a class="button" href="#/catalog">Lihat semua produk</a>' : pageCount > 1 ? `<nav class="pagination" aria-label="Halaman produk">${Array.from({ length: pageCount }, (_, index) => index + 1).map(number => `<a class="pagination-link ${number === page ? 'selected' : ''}" href="${url(route.page, { ...filters, page: number })}" ${number === page ? 'aria-current="page"' : ''}>${number}</a>`).join('')}</nav>` : ''}</div>` : `<div class="empty-state">${icon('search')}<h2>${isActive(drop) ? 'Tiada produk dijumpai' : 'Drop semasa sudah tamat'}</h2><p>${isActive(drop) ? 'Cuba nama model lain atau kurangkan penapis.' : 'Pilihan baru akan dipaparkan apabila sesi sourcing seterusnya bermula.'}</p><a class="button dark" href="${isActive(drop) ? '#/catalog' : '#/help'}">${isActive(drop) ? 'Lihat semua produk' : 'Tentang Weekly Drop'}</a></div>`}</section>`;
}
function brandStrip() {
  const featuredBrands = brands.filter(brand => !/^others?$/i.test(brand));
  return `<section class="brand-strip" aria-label="Cari mengikut jenama"><span>JENAMA PILIHAN</span><div class="brand-logo-row">${featuredBrands.map(brand => `<a href="${url('catalog', { brand })}" class="brand-logo" aria-label="${e(brand)}"><span class="brand-logo-mark">${brandAssets[brand] ? `<img src="${brandAssets[brand]}" alt="${e(brand)}" width="140" height="44" loading="lazy" decoding="async">` : `<span class="brand-logo-text">${e(brand)}</span>`}</span></a>`).join('')}<a class="all-brands" href="#/brands">Semua jenama ${icon('arrow')}</a></div><p class="brand-scroll-hint" aria-label="Boleh slide kiri kanan">← Boleh slide kiri kanan →</p></section>`;
}
function howItWorks() {
  return `<section class="how-it-works"><div><p class="eyebrow">DARI JEPUN, UNTUK ANDA</p><h2>Jumpa. LOCK. Kami uruskan.</h2><a href="#/help">Nak tahu cara beli? ${icon('arrow')}</a></div><ol><li><span>01</span><div><h3>Pilih item</h3><p>Semak harga, kondisi dan gambar.</p></div></li><li><span>02</span><div><h3>LOCK di WhatsApp</h3><p>ID produk dimasukkan dalam mesej.</p></div></li><li><span>03</span><div><h3>Tunggu pengesahan</h3><p>Pasukan kami semak stok di Jepun.</p></div></li></ol></section>`;
}

function productDetail() {
  const product = products.find(item => item.code === route.code && item.status !== 'DRAFT');
  if (!product) return `<div class="empty-state"><h1>Produk tidak dijumpai</h1><p>Pautan mungkin tidak lengkap atau produk belum diterbitkan.</p><a class="button dark" href="#/catalog">Kembali ke katalog</a></div>`;
  const state = productStatus(product, drop);
  const available = state === 'AVAILABLE';
  const ended = state === 'EXPIRED';
  const galleryMain = product.images[0] ? `<div class="gallery-main"><img id="main-photo" src="${product.images[0]}" alt="${e(product.name)} - foto rujukan model" width="640" height="640"></div>` : '<div class="gallery-main no-photo"><span class="no-photo-label">Tiada foto</span></div>';
  document.title = `${product.name} · ${money(product.price)} - RIMSTACKLE`;
  return `<a class="back-link" href="${e(catalogReturn)}">${icon('back')} Kembali ke katalog</a><div class="product-detail"><section class="gallery" aria-label="Gambar produk"><div class="gallery-stage">${galleryMain}</div>${product.images.length > 1 ? `<div class="thumbnails">${product.images.map((image, index) => `<button data-photo="${image}" aria-label="Gambar ${index + 1}" aria-pressed="${index === 0}"><img src="${image}" alt="Sudut ${index + 1}" width="80" height="80"></button>`).join('')}</div>` : ''}<p class="photo-note">Gambar kondisi sebenar disahkan oleh pasukan.</p></section>
  <section class="detail-copy">${status(state)}<p class="brand-name">${e(product.brand)}</p><h1>${e(product.model)}</h1><p class="detail-subtitle">${e(product.subtitle)}</p><div class="detail-id">Product ID: <strong>${e(product.code)}</strong><button data-action="copy-id" class="text-button">Salin ID</button></div><p class="detail-price">${money(product.price)}</p><dl class="detail-facts"><div><dt>Kondisi</dt><dd>${condition(product)}</dd></div><div><dt>Weekly Drop</dt><dd>${e(dropTitle(drop))}</dd></div><div><dt>Kategori</dt><dd>${categoryLabel(product.category)}</dd></div></dl>
  <div class="availability-note ${ended ? 'expired-note' : ''}"><strong>${ended ? 'Tempoh sourcing sudah tamat' : state === 'RESERVED' ? 'Item ini sedang ditempah' : state === 'SOLD' ? 'Item ini sudah terjual' : 'Stok disahkan melalui WhatsApp'}</strong><p>${ended ? 'Item daripada drop ini tidak lagi boleh di-LOCK. Lihat pilihan dalam drop terkini.' : available ? 'Item berada di lokasi sourcing Jepun, bukan stok sedia ada. LOCK ialah permintaan semakan, bukan jaminan stok.' : 'Terokai produk lain dalam Weekly Drop semasa.'}</p></div>
  <div class="detail-cta">${available ? `<button class="button whatsapp" data-action="lock">${whatsappLogo} LOCK ITEM VIA WHATSAPP</button><p>Harga & ketersediaan akhir disahkan oleh pasukan.</p>` : `<a class="button dark" href="#/weekly">Lihat Weekly Drop terkini ${icon('arrow')}</a>`}</div>
  <h2>Butiran produk</h2><p class="description">${e(product.description).replaceAll('Kekili', 'Reel').replaceAll('Alat ganti', 'Spare part')}</p><a href="#/help" class="help-link">Pertama kali LOCK item? Tengok cara beli ${icon('arrow')}</a></section></div>`;
}

function directory(type) {
  const listing = type === 'brands' ? brands : categories;
  const key = type === 'brands' ? 'brand' : 'category';
  return `<section class="directory"><p class="eyebrow">TEROKAI KATALOG</p><h1>${type === 'brands' ? 'Cari mengikut jenama' : 'Cari mengikut kategori'}</h1><p>Pilih ${type === 'brands' ? 'jenama' : 'kategori'} untuk melihat produk dalam drop semasa.</p><div class="directory-grid">${listing.map(item => `<a href="${url('catalog', { [key]: item })}"><h2>${e(type === 'brands' ? item : categoryLabel(item))}</h2><p>${findProducts(products, drop, { [key]: item }).length} produk</p>${icon('arrow')}</a>`).join('')}</div></section>`;
}
function help() {
  return `<section class="help-page"><p class="eyebrow">KAMI BANTU SAMPAI JELAS</p><h1>Macam mana nak LOCK item?</h1><p class="intro">Pilih di sini. Sahkan di WhatsApp.<br>Pasukan RIMSTACKLE bantu langkah seterusnya.</p>${howItWorks()}<h2>Soalan biasa</h2>${[
    ['Barang ini ready stock?', 'Bukan. Item berada di lokasi sourcing di Jepun ketika disenaraikan. Pasukan kami perlu semak semula ketersediaan sebelum pembelian disahkan.'],
    ['Tekan LOCK terus dapat barang?', 'Belum. Butang LOCK menyediakan mesej WhatsApp dengan nama, ID dan harga item. Hantar mesej itu; pasukan kami akan sahkan ketersediaan. Item hanya ditempah selepas pengesahan pasukan.'],
    ['Apa maksud Weekly Drop?', 'Weekly Drop ialah pilihan produk bagi satu tempoh sourcing. Selepas tempoh tersebut tamat, item tidak lagi boleh di-LOCK melalui katalog.'],
    ['Bagaimana dengan bayaran dan penghantaran?', 'Jumlah akhir, kaedah bayaran, kos dan anggaran penghantaran akan diterangkan oleh pasukan melalui WhatsApp sebelum anda bersetuju membeli. Tiada pembayaran dalam laman ini.'],
    ['Boleh tengok kondisi sebenar?', 'Boleh minta gambar kondisi daripada pasukan melalui WhatsApp. Gambar dan harga tertakluk kepada pengesahan semasa.'],
  ].map(([title, body]) => `<details><summary>${title}</summary><p>${body}</p></details>`).join('')}<div class="help-contact"><h2>Masih ada pertanyaan?</h2><button class="button whatsapp" data-action="contact">${whatsappLogo} Hubungi melalui WhatsApp</button></div></section>`;
}

function render({ preserveScroll = false, immediate = false } = {}) {
  const currentMain = document.querySelector('main#main');
  if (!immediate && !preserveScroll && currentMain && !currentMain.classList.contains('is-leaving')) {
    currentMain.classList.add('is-leaving');
    clearTimeout(pageLeaveTimer);
    pageLeaveTimer = setTimeout(() => render({ preserveScroll, immediate: true }), 140);
    return;
  }
  if (dialog.open) closeDialog(true);
  route = currentRoute();
  if (isStandalonePwa() && route.page !== 'admin') { location.replace('#/admin'); return; }
  syncAdminPwa(route.page === 'admin');
  if (['home', 'weekly', 'catalog'].includes(route.page)) catalogReturn = location.hash || '#/home';
  const adminAuthenticated = route.page !== 'admin' || isAdminAuthenticated();
  document.title = route.page === 'admin' ? 'RIMSTACKLE - Admin Panel' : 'RIMSTACKLE - Pilihan tackle dari Jepun';
  document.body.classList.toggle('detail-page', route.page === 'product');
  document.body.classList.toggle('admin-page-route', route.page === 'admin' && adminAuthenticated);
  if (route.page === 'admin' && !adminAuthenticated) {
    app.innerHTML = adminLogin();
    document.querySelector('#admin-login-form').onsubmit = async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); const error = document.querySelector('#admin-login-error'); error.textContent = ''; if (!supabaseConfigured) { error.textContent = 'Supabase belum dikonfigurasi.'; return; } try { await signInWithPassword(values.email.trim(), values.password); await hydrateRemoteCatalog(); render({ preserveScroll: true }); } catch (reason) { error.textContent = reason.message || 'Email atau kata laluan tidak sah.'; } };
    clearInterval(timer);
    if (!preserveScroll) window.scrollTo({ top: 0, behavior: 'instant' });
    lastRoute = location.hash;
    return;
  }
  const needsCatalog = ['home', 'weekly', 'catalog', 'brands', 'categories', 'product'].includes(route.page) || route.page === 'admin' && adminAuthenticated;
  if (needsCatalog && catalogStatus !== 'ready') {
    const admin = route.page === 'admin';
    app.innerHTML = `${admin ? adminHeader() : header()}<main id="main" class="shell" tabindex="-1"><div class="empty-state">${catalogStatus === 'loading' ? '<p class="muted" role="status">Memuatkan katalog…</p>' : '<h1>Katalog belum dapat dimuatkan</h1><p>Periksa sambungan dan cuba muatkan semula data.</p><button class="button dark" type="button" data-action="catalog-retry">Cuba lagi</button>'}</div></main>${footer(admin)}${admin ? adminBottomNav() : bottomNav()}`;
    clearInterval(timer);
    lastRoute = location.hash;
    return;
  }
  app.innerHTML = `${route.page === 'admin' ? adminHeader() : header()}${['home', 'weekly', 'catalog', 'brands', 'categories'].includes(route.page) ? search() : ''}<main id="main" class="shell" tabindex="-1">${route.page === 'home' || route.page === 'weekly' ? `${hero()}<p class="sourcing-note">${icon('check')} Pilihan sourcing Jepun <span>·</span> Bukan ready stock <span>·</span> Pengesahan melalui WhatsApp</p>${brandStrip()}${catalog()}${route.page === 'home' ? howItWorks() : ''}` : route.page === 'catalog' ? catalog() : route.page === 'product' ? productDetail() : ['brands', 'categories'].includes(route.page) ? directory(route.page) : route.page === 'help' ? help() : route.page === 'admin' ? '<div id="admin-root"></div>' : '<div class="empty-state"><h1>Halaman tidak dijumpai</h1><a class="button dark" href="#/home">Kembali ke utama</a></div>'}</main>${footer(route.page === 'admin')}${route.page === 'admin' ? adminBottomNav() : ['product'].includes(route.page) ? '' : bottomNav()}`;
  if (route.page === 'admin') import('./admin.js').then(module => { if (route.page === 'admin') module.renderAdmin(document.querySelector('#admin-root'), products, drop, { section: route.code || 'dashboard', toast, openDialog, closeDialog, refresh: () => render({ preserveScroll: true }), auditLog, actor: adminProfileName() || adminEmail(), actorEmail: adminEmail(), nextDropState }); }).catch(() => { document.querySelector('#admin-root').innerHTML = '<p>Paparan pengurusan tidak dapat dimuatkan. Sila muat semula halaman.</p>'; });
  tick();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
  if (!preserveScroll) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (lastRoute) document.querySelector('#main').focus({ preventScroll: true });
  }
  lastRoute = location.hash;
}

async function hydrateRemoteCatalog() {
  if (!supabaseConfigured) return;
  catalogStatus = 'loading';
  try {
    const hasSession = Boolean(getSupabaseSession());
    const [remoteDrops, remoteProducts, [remoteCategories, remoteBrands, remoteLocations, remoteAudit, remoteProfiles]] = await Promise.all([
      supabaseTable('weekly_drops', hasSession ? '?select=*&order=starts_at.desc' : '?select=*&status=eq.ACTIVE&order=starts_at.desc&limit=1'),
      supabaseTable('products', `${hasSession ? '?select=*' : '?select=code,drop_id,brand_code,brand,model,category,price,condition,grade,status,images,subtitle,description,created_at'}&order=created_at.desc`),
      hasSession ? Promise.all([supabaseTable('categories', '?select=*&order=name.asc'), supabaseTable('brands', '?select=*&order=name.asc'), supabaseTable('locations', '?select=*&order=code.asc'), supabaseTable('audit_log', '?select=*&order=created_at.desc&limit=100'), supabaseTable('admin_profiles', '?select=user_id,display_name')]) : Promise.resolve([[], [], [], [], []]),
    ]);
    if (Array.isArray(remoteDrops) && remoteDrops.length) {
      const activeDrop = remoteDrops.find(item => item.status === 'ACTIVE' && isActive(item)) || remoteDrops.find(item => item.status === 'ACTIVE') || (hasSession ? remoteDrops[0] : null);
      if (activeDrop) Object.assign(drop, activeDrop, { number: String(activeDrop.number) });
      if (hasSession) {
        const upcoming = remoteDrops.filter(item => item.id !== drop.id && item.status !== 'EXPIRED').sort((a, b) => (Date.parse(a.starts_at) || 0) - (Date.parse(b.starts_at) || 0))[0];
        nextDropState.value = upcoming ? { ...upcoming, number: String(upcoming.number) } : null;
      }
    } else Object.assign(drop, { status: 'EXPIRED' });
    if (Array.isArray(remoteProducts)) {
      products.splice(0, products.length, ...remoteProducts.map((product, index) => ({ ...product, name: `${product.brand} ${product.model}`, dropId: product.drop_id, locationCode: product.location_code, brandCode: product.brand_code, japanPrice: product.japan_price, images: Array.isArray(product.images) ? product.images : [], sequence: remoteProducts.length - index })));
    }
    if (Array.isArray(remoteCategories) && remoteCategories.length) { categoryConfig.splice(0, categoryConfig.length, ...remoteCategories.filter(item => !/^others?$/i.test(item.name.trim())).map(item => ({ name: item.name, label: item.label }))); categories.splice(0, categories.length, ...categoryConfig.map(item => item.name), 'Others'); }
    if (Array.isArray(remoteBrands) && remoteBrands.length) { brandConfig.splice(0, brandConfig.length, ...remoteBrands.filter(item => !/^others?$/i.test(item.name.trim())).map(item => ({ name: item.name, code: item.code, logo: item.logo || '' }))); brands.splice(0, brands.length, ...brandConfig.map(item => item.name), 'Others'); }
    if (Array.isArray(remoteLocations) && remoteLocations.length) { const grouped = remoteLocations.reduce((groups, item) => { (groups[item.city] ||= []).push({ code: item.code, name: item.name, stores: Array.isArray(item.stores) ? item.stores : [] }); return groups; }, {}); locationConfig.splice(0, locationConfig.length, ...Object.entries(grouped).map(([city, sections]) => ({ city, sections }))); }
    const profileNames = new Map((remoteProfiles || []).map(item => [item.user_id, item.display_name?.trim()]).filter(([, name]) => name));
    if (Array.isArray(remoteAudit)) { auditLog.splice(0, auditLog.length, ...remoteAudit.map(item => ({ id: item.id, at: item.created_at, actorId: item.actor_user_id || null, actor: profileNames.get(item.actor_user_id) || item.actor_name, action: item.action, target: item.target, detail: item.detail || '' }))); localStorage.setItem('rimstackle-audit-log', JSON.stringify(auditLog)); }
    const profileName = profileNames.get(currentSupabaseUser()?.id);
    if (profileName && currentSupabaseUser()?.email) { let profiles = {}; try { profiles = JSON.parse(localStorage.getItem('rimstackle-admin-profiles') || '{}'); } catch { /* Ignore invalid local profile cache. */ } profiles[currentSupabaseUser().email] = profileName; localStorage.setItem('rimstackle-admin-profiles', JSON.stringify(profiles)); }
    catalogStatus = 'ready';
    render({ preserveScroll: true });
  } catch (error) {
    console.warn('Supabase catalog belum boleh dimuatkan:', error.message);
    catalogStatus = 'error';
    render({ preserveScroll: true });
  }
}

function tick() {
  const active = isActive(drop);
  if (active !== wasActive) { wasActive = active; render({ preserveScroll: true }); return; }
  const countdown = document.querySelector('#countdown');
  const remaining = Math.max(0, Math.floor((Date.parse(drop.ends_at) - Date.now()) / 1000));
  if (countdown && remaining === 0) { render({ preserveScroll: true }); return; }
  if (countdown) countdown.innerHTML = [[Math.floor(remaining / 86400), 'hari'], [Math.floor(remaining % 86400 / 3600), 'jam'], [Math.floor(remaining % 3600 / 60), 'min'], [remaining % 60, 'saat']].map(([number, label]) => `<span><strong>${String(number).padStart(2, '0')}</strong><small>${label}</small></span>`).join('<b aria-hidden="true">:</b>');
  if (route.page === 'product' && !isActive(drop) && document.querySelector('[data-action="lock"]')) render({ preserveScroll: true });
}

export function toast(message) {
  const target = document.querySelector('#toast');
  target.textContent = message;
  target.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => target.classList.remove('visible'), 3500);
}
function openDialog(title, contents, className = '', { closable = true, dismissible = true } = {}) {
  clearTimeout(dialogCloseTimer);
  returnFocus = document.activeElement;
  dialog.className = className;
  dialog.dataset.dismissible = String(dismissible);
  dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${title}</h2>${closable ? `<button class="close-button" data-action="close" aria-label="Tutup">${icon('close')}</button>` : ''}</div>${contents}`;
  document.body.classList.add('dialog-open');
  dialog.showModal();
}
function closeDialog(immediate = false) {
  if (!dialog.open) return;
  clearTimeout(dialogCloseTimer);
  if (immediate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { dialog.close(); return; }
  dialog.classList.add('is-closing');
  dialogCloseTimer = setTimeout(() => { dialog.classList.remove('is-closing'); if (dialog.open) dialog.close(); }, 180);
}
dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); delete dialog.dataset.dismissible; if (returnFocus?.isConnected) returnFocus.focus(); });
dialog.addEventListener('cancel', event => { event.preventDefault(); if (dialog.dataset.dismissible !== 'false') closeDialog(); });
dialog.addEventListener('click', event => { if (event.target === dialog && dialog.dataset.dismissible !== 'false') { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
function selectField(name, label, options, selected = '') {
  return `<label>${label}<select name="${name}"><option value="">Semua ${label.toLowerCase()}</option>${othersLast(options).map(option => { const [value, title] = Array.isArray(option) ? option : [option, option]; return `<option value="${e(value)}" ${value === selected ? 'selected' : ''}>${e(title)}</option>`; }).join('')}</select></label>`;
}
function filterDialog() {
  const f = route.filters;
  openDialog('Tapis produk', `<form id="filter-form"><div class="filter-fields">${selectField('brand', 'Jenama', brands, f.brand)}${selectField('category', 'Kategori', categories.map(category => [category, categoryLabel(category)]), f.category)}${selectField('condition', 'Kondisi', conditions, f.condition)}${selectField('status', 'Status', ['AVAILABLE', 'RESERVED', 'SOLD'].map(value => [value, statusLabels[value]]), f.status)}<fieldset><legend>Julat harga (RM)</legend><div class="price-fields"><label>Minimum<input type="number" inputmode="decimal" min="0" step="0.01" name="min" placeholder="0" value="${e(f.min || '')}"></label><span>–</span><label>Maksimum<input type="number" inputmode="decimal" min="0" step="0.01" name="max" placeholder="Tiada had" value="${e(f.max || '')}"></label></div></fieldset><p id="filter-error" class="form-error" role="alert"></p></div><div class="dialog-footer"><button class="text-button" type="reset">Tetapkan semula</button><button class="button dark" type="submit" id="filter-apply">Lihat produk</button></div></form>`, 'filter-dialog');
  const form = document.querySelector('#filter-form');
  const update = () => {
    const values = Object.fromEntries(new FormData(form));
    const invalid = values.min && values.max && Number(values.min) > Number(values.max);
    document.querySelector('#filter-error').textContent = invalid ? 'Harga maksimum mesti sama atau lebih tinggi daripada minimum.' : '';
    document.querySelector('#filter-apply').disabled = Boolean(invalid);
    document.querySelector('#filter-apply').textContent = `Lihat ${findProducts(products, drop, { ...f, ...values }).length} produk`;
  };
  form.addEventListener('input', update);
  form.addEventListener('reset', event => { event.preventDefault(); for (const field of form.querySelectorAll('input, select')) field.value = ''; update(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = url('catalog', { ...f, ...Object.fromEntries(new FormData(form)), page: '' });
    closeDialog();
    if (location.hash === next) render({ preserveScroll: true }); else location.hash = next;
  });
  update();
}

function contact(product) {
  if (product && productStatus(product, drop) !== 'AVAILABLE') { render(); toast('Item ini tidak lagi boleh di-LOCK.'); return; }
  const message = product ? lockMessage(product) : 'Hi RIMSTACKLE, saya ingin bertanya tentang sourcing tackle dari Jepun.';
  const link = whatsappUrl(phone, message);
  if (link) { window.open(link, '_blank', 'noopener,noreferrer'); return; }
  openDialog('Mesej WhatsApp', `<div class="dialog-body"><p class="notice">Nombor WhatsApp RIMSTACKLE belum ditetapkan. Tiada mesej dihantar.</p><label class="message-label">Mesej yang akan dihantar<textarea id="lock-message" rows="9" readonly>${e(message)}</textarea></label><button class="button dark full-width" data-action="copy-message">Salin mesej</button><p class="muted">LOCK tidak mengubah status produk. Tempahan hanya selepas pengesahan pasukan.</p></div>`);
}
async function copy(text, success) {
  try { await navigator.clipboard.writeText(text); toast(success); } catch { openDialog('Salin secara manual', `<div class="dialog-body"><p>Tekan lama teks di bawah untuk menyalin.</p><textarea rows="6" readonly>${e(text)}</textarea></div>`); }
}
function closeAdminMenus() {
  const openMenus = [...document.querySelectorAll('.admin-menu')].filter(menu => !menu.hidden);
  clearTimeout(menuCloseTimer);
  openMenus.forEach(menu => {
    menu.classList.add('is-closing');
    menu._closeTimer = setTimeout(() => { menu.hidden = true; menu.classList.remove('is-closing'); }, 180);
  });
  document.querySelectorAll('[aria-controls^="admin-"]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
  menuCloseTimer = setTimeout(() => document.body.classList.remove('admin-menu-open'), 180);
}

document.addEventListener('submit', event => {
  if (!event.target.matches('.search-form')) return;
  event.preventDefault();
  location.hash = url('catalog', { q: new FormData(event.target).get('q').trim() });
});
document.addEventListener('change', event => { if (event.target.id === 'sort') location.hash = url('catalog', { ...route.filters, sort: event.target.value }); });
document.addEventListener('click', event => {
  if (route?.page === 'admin' && !event.target.closest('.admin-menu-wrap, .admin-mobile-nav')) closeAdminMenus();
  if (event.target.closest('.skip-link')) { event.preventDefault(); document.querySelector('#main').focus(); document.querySelector('#main').scrollIntoView(); return; }
  const button = event.target.closest('[data-action], [data-remove-filter], [data-photo]');
  if (!button) return;
  if (button.dataset.removeFilter) { const filters = { ...route.filters }; delete filters[button.dataset.removeFilter]; delete filters.page; location.hash = url(route.page, filters); return; }
  if (button.dataset.photo) { document.querySelector('#main-photo').src = button.dataset.photo; document.querySelectorAll('[data-photo]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); return; }
  const product = products.find(item => item.code === route.code);
  switch (button.dataset.action) {
    case 'close': closeDialog(); break;
    case 'filters': filterDialog(); break;
    case 'text-size': { const large = document.documentElement.classList.toggle('large-text'); button.setAttribute('aria-pressed', String(large)); try { localStorage.setItem('rimstackle-large-text', String(large)); } catch { /* Browser storage is optional for this preference. */ } toast(large ? 'Tulisan dibesarkan.' : 'Saiz tulisan biasa.'); break; }
    case 'lock': if (product) contact(product); break;
    case 'contact': contact(); break;
    case 'copy-id': if (product) copy(product.code, 'ID produk disalin.'); break;
    case 'copy-message': copy(document.querySelector('#lock-message').value, 'Mesej disalin.'); break;
    case 'toggle-password': { const password = document.querySelector('#admin-login-form input[name="password"]'); const visible = password.type === 'text'; password.type = visible ? 'password' : 'text'; button.innerHTML = icon(visible ? 'eye' : 'eyeOff'); button.setAttribute('aria-label', visible ? 'Tunjukkan kata laluan' : 'Sembunyikan kata laluan'); break; }
    case 'admin-menu': { const menu = document.querySelector(`#${button.getAttribute('aria-controls') || 'admin-menu'}`); const expanded = button.getAttribute('aria-expanded') === 'true'; clearTimeout(menu._closeTimer); menu.classList.remove('is-closing'); menu.hidden = expanded; button.setAttribute('aria-expanded', String(!expanded)); clearTimeout(menuCloseTimer); document.body.classList.toggle('admin-menu-open', !expanded); break; }
    case 'admin-route': { closeAdminMenus(); const next = button.dataset.target === 'dashboard' ? '#/admin' : `#/admin/${button.dataset.target}`; if (location.hash === next) render({ preserveScroll: true }); else location.replace(next); break; }
    case 'install-app': { closeAdminMenus(); if (!deferredInstallPrompt) { toast('Install app belum tersedia pada browser ini.'); break; } const prompt = deferredInstallPrompt; deferredInstallPrompt = null; prompt.prompt(); prompt.userChoice.then(choice => { if (choice.outcome === 'accepted') appInstalled = true; render({ preserveScroll: true }); }).catch(() => render({ preserveScroll: true })); break; }
    case 'catalog-retry': hydrateRemoteCatalog(); break;
    case 'admin-placeholder': closeAdminMenus(); if (button.dataset.label === 'Log keluar') { openDialog('Log keluar?', `<div class="dialog-body"><p>Anda pasti mahu log keluar daripada panel admin?</p><div class="dialog-actions"><button class="button" id="cancel-logout" type="button">Batal</button><button class="button dark" id="confirm-logout" type="button">${icon('logout')}<span>Ya, log keluar</span></button></div></div>`, 'logout-dialog', { closable: false, dismissible: false }); document.querySelector('#cancel-logout').onclick = closeDialog; document.querySelector('#confirm-logout').onclick = () => { closeDialog(); signOut().finally(() => render({ preserveScroll: true })); }; } else toast(`${button.dataset.label} belum disambungkan.`); break;
  }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && route?.page === 'admin') closeAdminMenus(); });
document.addEventListener('error', event => { if (event.target instanceof HTMLImageElement) { const target = event.target; target.hidden = true; const note = document.createElement('span'); note.className = 'image-fallback'; note.textContent = 'Gambar belum tersedia'; target.parentElement.append(note); } }, true);
window.addEventListener('hashchange', () => render());
window.addEventListener('pageshow', event => { if (event.persisted) tick(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && route) tick(); });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; appInstalled = false; if (route?.page === 'admin') render({ preserveScroll: true }); });
window.addEventListener('appinstalled', () => { appInstalled = true; deferredInstallPrompt = null; if (route?.page === 'admin') render({ preserveScroll: true }); });
try { document.documentElement.classList.toggle('large-text', localStorage.getItem('rimstackle-large-text') === 'true'); } catch { /* Keep the readable default when storage is unavailable. */ }
render();
hydrateRemoteCatalog();
