// Public catalog data. Replace with a public, protected API when backend is connected.
// ponytail: one sample drop; query active drops server-side when the backend is introduced.
import { parseProductId } from './catalog.js';
import { supabaseConfigured, supabaseUpsert, supabaseDelete } from './supabase.js';
const defaultDrop = {
  id: 'drop-0007', name: 'Japan Weekly Drop', number: '7', status: 'ACTIVE',
  starts_at: '2026-09-30T00:00:00+08:00', ends_at: '2026-10-07T00:00:00+08:00',
};
const readStorage = key => { try { return typeof localStorage === 'undefined' ? null : JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const savedDrop = readStorage('rimstackle-drop');
const savedNextDrop = readStorage('rimstackle-next-drop');
const savedProductDrops = readStorage('rimstackle-product-drops') || {};
export const drop = { ...defaultDrop, ...(savedDrop && typeof savedDrop === 'object' ? savedDrop : {}) };
export const nextDrop = savedNextDrop && typeof savedNextDrop === 'object' ? { ...savedNextDrop } : null;
let storedNextDrop = nextDrop;
const productRow = product => ({ code: product.code, drop_id: product.dropId, location_code: product.locationCode || null, brand_code: product.brandCode || null, brand: product.brand, model: product.model, category: product.category, store: product.store || null, subtitle: product.subtitle || null, description: product.description || null, price: product.price, japan_price: product.japanPrice || null, condition: product.condition, grade: product.grade || null, status: product.status, images: Array.isArray(product.images) ? product.images : [], updated_at: new Date().toISOString() });
export function saveDrop(value, products = []) {
  try {
    localStorage.setItem('rimstackle-drop', JSON.stringify(value));
    localStorage.setItem('rimstackle-product-drops', JSON.stringify(Object.fromEntries(products.map(product => [product.code, product.dropId]))));
  } catch { /* Browser storage is optional. */ }
  if (supabaseConfigured) {
    const remoteDrop = { id: value.id, number: value.number, status: value.status, starts_at: value.starts_at, ends_at: value.ends_at };
    supabaseUpsert('weekly_drops', remoteDrop).then(() => products.length ? supabaseUpsert('products', products.map(productRow)) : null).catch(() => {});
  }
}
export function saveNextDrop(value) {
  const previousId = storedNextDrop?.id;
  storedNextDrop = value;
  try {
    if (value) localStorage.setItem('rimstackle-next-drop', JSON.stringify(value));
    else localStorage.removeItem('rimstackle-next-drop');
  } catch { /* Browser storage is optional. */ }
  if (supabaseConfigured) { if (value) supabaseUpsert('weekly_drops', { id: value.id, number: value.number, status: value.status, starts_at: value.starts_at, ends_at: value.ends_at }).catch(() => {}); else if (previousId) supabaseDelete('weekly_drops', `?id=eq.${encodeURIComponent(previousId)}`).catch(() => {}); }
}

const items = [
  ['TKY03-SHI-0125', 'Shimano', 'Antares DC MD', 'Reel', 1850, 'Terpakai', 8, 'AVAILABLE', 'antares', 'Baitcasting · Pemegang kanan', 'Kekili baitcasting dengan kemasan hitam. Contoh kondisi: sedikit kesan penggunaan pada badan. Gambar katalog ialah rujukan model; foto kondisi sebenar perlu disahkan dengan pasukan.'],
  ['OSK02-SHI-0098', 'Shimano', 'Calcutta Conquest', 'Reel', 1680, 'Seperti baru', 9, 'AVAILABLE', 'conquest', 'Baitcasting · Badan bulat', 'Kekili berbadan bulat dengan kemasan emas. Contoh kondisi: penggunaan ringan. Sahkan saiz, arah pemegang dan aksesori yang disertakan melalui WhatsApp.'],
  ['TKY03-DAI-0132', 'Daiwa', 'Exist LT', 'Reel', 2450, 'Seperti baru', 9, 'AVAILABLE', 'exist', 'Spinning · Kemasan perak', 'Kekili spinning untuk pemancing yang mengutamakan rasa ringan. Contoh kondisi: kemasan terjaga. Saiz sebenar akan disahkan oleh pasukan.'],
  ['OSK02-MEG-0041', 'Megabass', 'Vision 110', 'Lure', 85, 'Baru', null, 'AVAILABLE', 'vision', 'Jerkbait · French Pearl', 'Gewang Vision 110 dalam warna French Pearl. Foto rujukan model sahaja. Pasukan akan sahkan warna serta pembungkusan sebelum pembelian.'],
  ['TKY03-SHI-0129', 'Shimano', 'Zodias', 'Rod', 520, 'Terpakai', 8, 'AVAILABLE', 'zodias', 'Joran spinning', 'Joran dalam siri Zodias. Contoh kondisi: kesan penggunaan ringan pada pemegang. Panjang, kuasa dan keadaan cincin perlu disahkan sebelum LOCK.'],
  ['OSK02-SHI-0102', 'Shimano', 'Calcutta Conquest', 'Reel', 1380, 'Terpakai', 7, 'RESERVED', 'conquest', 'Baitcasting · Badan bulat', 'Contoh unit terpakai dengan kesan penggunaan. Item ini sedang ditempah selepas pengesahan pasukan.'],
  ['TKY03-DAI-0133', 'Daiwa', 'Exist LT', 'Reel', 2100, 'Terpakai', 8, 'AVAILABLE', 'exist', 'Spinning · Kemasan perak', 'Contoh unit terpakai dalam siri Exist. Sahkan keadaan spool, arah pemegang dan saiz melalui WhatsApp.'],
  ['OSK02-MEG-0042', 'Megabass', 'Vision 110', 'Lure', 65, 'Terpakai', 8, 'SOLD', 'vision', 'Jerkbait · French Pearl', 'Unit contoh ini sudah terjual. Terokai Weekly Drop untuk pilihan lain.'],
  ['TKY03-SHI-0130', 'Shimano', 'Zodias', 'Rod', 650, 'Seperti baru', 9, 'AVAILABLE', 'zodias', 'Joran spinning', 'Contoh unit dengan penggunaan minimum. Sila semak spesifikasi dan gambar kondisi sebenar bersama pasukan.'],
  ['TKY03-SHI-0131', 'Shimano', 'Antares DC MD', 'Reel', 2050, 'Seperti baru', 9, 'AVAILABLE', 'antares', 'Baitcasting · Pemegang kanan', 'Contoh unit terjaga daripada siri Antares DC MD. Kotak dan aksesori tertakluk kepada pengesahan pasukan.'],
  ['TKY03-SHI-0110', 'Shimano', 'Calcutta Conquest', 'Reel', 1200, 'Vintage', 7, 'EXPIRED', 'conquest', 'Baitcasting · Koleksi terdahulu', 'Tempoh sourcing untuk item ini sudah tamat.'],
  ['TKY03-SHI-0134', 'Shimano', 'Antares DC MD', 'Reel', 1900, 'Terpakai', 8, 'DRAFT', 'antares', 'Baitcasting', 'Draf contoh yang belum diterbitkan.'],
];

items.push(...Array.from({ length: 8 }, (_, index) => [
  `DUMMY-${String(index + 1).padStart(2, '0')}`,
  index % 2 ? 'Daiwa' : 'Shimano',
  `Model ${index + 1}`,
  'Reel',
  300 + index * 50,
  'Baru',
  null,
  'AVAILABLE',
  index < 3 ? 'conquest' : index === 7 ? null : ['exist', 'vision', 'zodias', 'antares'][index % 4],
  index === 7 ? 'Foto belum dimuat naik' : index < 3 ? 'Beberapa sudut foto' : 'Foto produk',
  'Maklumat produk untuk susunan dan pagination katalog.',
]));

export const products = items.map(([code, brand, model, category, price, condition, grade, status, image, subtitle, description], index) => {
  const parsed = parseProductId(code);
  return {
  code, brand, model, name: `${brand} ${model}`, ...parsed, store: parsed.locationCode === 'TKY03' ? 'Kedai Shibuya' : parsed.locationCode === 'OSK02' ? 'Kedai Namba' : '', dropId: savedProductDrops[code] || drop.id, category, price, condition, grade, status, subtitle, description,
  sequence: items.length - index,
  images: image ? [`/images/${image}.${image === 'exist' ? 'png' : 'jpg'}`, ...(image === 'conquest' ? ['/images/conquest-side.jpg'] : [])] : [],
  };
});

