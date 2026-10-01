export const money = value => `RM${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 2 }).format(value)}`;
export const statusLabels = { AVAILABLE: 'Boleh di-LOCK', RESERVED: 'Ditempah', SOLD: 'Terjual', EXPIRED: 'Tamat', DRAFT: 'Draf' };
export const conditions = ['Baru', 'Seperti baru', 'Terpakai', 'Vintage'];
export const categories = ['Reel', 'Rod', 'Lure', 'Accessories', 'Spare part', 'Others'];
export const categoryConfig = categories.map(name => ({ name, label: name }));
export const brandConfig = [{ name: 'Shimano', code: 'SHI' }, { name: 'Daiwa', code: 'DAI' }, { name: 'Megabass', code: 'MEG' }, { name: 'Abu Garcia', code: 'ABU' }, { name: 'Jackall', code: 'JAC' }, { name: 'Evergreen', code: 'EVE' }];
export const brands = [...brandConfig.map(brand => brand.name), 'Others'];
export const othersLast = values => [...values].sort((a, b) => {
  const label = value => String(Array.isArray(value) ? value[1] : value).trim();
  const rank = value => /^others?$/i.test(label(value)) ? 1 : 0;
  return rank(a) - rank(b);
});
export const locationConfig = [
  { city: 'Tokyo', sections: [{ code: 'TKY03', name: 'Tokyo 03', stores: ['Kedai Shibuya', 'Kedai Ueno'] }] },
  { city: 'Osaka', sections: [{ code: 'OSK02', name: 'Osaka 02', stores: ['Kedai Namba', 'Kedai Umeda'] }] },
];
export const parseProductId = value => { const match = String(value || '').match(/^([A-Za-z0-9]+)-([A-Za-z0-9]+)-(.+)$/); return match ? { locationCode: match[1].toUpperCase(), brandCode: match[2].toUpperCase(), idNumber: match[3] } : {}; };
export const makeProductId = (locationCode, brandCode, idNumber) => `${String(locationCode || '').toUpperCase()}-${String(brandCode || '').toUpperCase()}-${String(idNumber || '').trim()}`;
export const dropTitle = drop => { const match = String(drop?.id || '').match(/(\d+)$/); return `Japan Weekly Drop ${match ? Number(match[1]) : String(drop?.number || '').replace(/^0+(?=\d)/, '')}`.trim(); };
export const newestFirst = (a, b) => { const aCreated = Date.parse(a.created_at || '') || 0; const bCreated = Date.parse(b.created_at || '') || 0; return bCreated - aCreated || (b.sequence || 0) - (a.sequence || 0); };

export function isActive(drop, now = Date.now()) {
  return drop?.status === 'ACTIVE' && now >= Date.parse(drop.starts_at) && now < Date.parse(drop.ends_at);
}

export function productStatus(product, drop, now = Date.now()) {
  if (product.status === 'DRAFT') return 'DRAFT';
  if (!product.dropId || product.dropId !== drop?.id) return 'EXPIRED';
  if (product.status === 'EXPIRED' || !isActive(drop, now)) return 'EXPIRED';
  return product.status;
}

export function findProducts(products, drop, filters = {}, now = Date.now()) {
  const words = (filters.q || '').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return products.filter(product => {
    const status = productStatus(product, drop, now);
    const haystack = `${product.name} ${product.brand} ${product.model} ${product.code}`.toLocaleLowerCase();
    return !['DRAFT', 'EXPIRED'].includes(status)
      && words.every(word => haystack.includes(word))
      && (!filters.brand || product.brand === filters.brand)
      && (!filters.category || product.category === filters.category)
      && (!filters.condition || product.condition === filters.condition)
      && (!filters.status || status === filters.status)
      && (filters.min == null || filters.min === '' || product.price >= Number(filters.min))
      && (filters.max == null || filters.max === '' || product.price <= Number(filters.max));
  }).sort((a, b) => filters.sort === 'price-asc' ? a.price - b.price : filters.sort === 'price-desc' ? b.price - a.price : newestFirst(a, b));
}

export function lockMessage(product) {
  return `Hi RIMSTACKLE, saya nak LOCK item ini.\n\nProduk: ${product.name}\nProduct ID: ${product.code}\nHarga: ${money(product.price)}\nKondisi: ${product.condition}${product.grade ? ` · ${product.grade}/10` : ''}\n\nBoleh bantu sahkan ketersediaan item ini?`;
}

export function whatsappUrl(phone, message) {
  const digits = (phone || '').replace(/[\s+()-]/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

export const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

