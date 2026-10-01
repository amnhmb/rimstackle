# RIMSTACKLE

Pratonton fungsi UI/UX katalog sourcing tackle Jepun. Bahasa Melayu, mobile-first, mesra pengguna berusia. Vite + JavaScript + CSS; tiada framework UI tambahan.

```sh
npm install
npm run dev
npm test
npm run build
```

Node.js 22.12+ disyorkan. Buka URL yang dipaparkan oleh Vite.

## Fungsi

- Laman utama / Weekly Drop dengan countdown berdasarkan tarikh data.
- Katalog dua lajur pada telefon; carian jenama, model, nama dan Product ID.
- Penapis jenama, kategori, kondisi, harga, status; susunan harga dan muat lebih banyak.
- Butiran produk, galeri/zoom, salin ID, status expired / reserved / sold dan pautan produk terus.
- LOCK membuka WhatsApp `60175799853` dengan mesej terisi. Tidak menukar status produk.
- Navigasi telefon berlabel, butang 48px+, pilihan tulisan besar, keyboard focus, dialog native dan FAQ pembelian.
- `#/admin`: demo awam pengurusan produk, edit harga/kondisi/status, pilihan pukal dan tempoh Weekly Drop. Perubahan dalam memori sahaja, hilang apabila reload. Bukan admin sebenar atau sistem autentikasi.

Semua produk, harga, kondisi dan stok ialah **contoh**, bukan listing jualan sebenar. Gambar ialah rujukan model. Data contoh berada dalam `src/data.js`; tamat drop ialah 7 Oktober 2026, 00:00 MYT. Selepas tarikh ini, keadaan tiada drop aktif akan dipaparkan. Demo pengurusan boleh mengubah tarikh untuk ujian tanpa mengubah kod.

Supabase, auth/RLS, operasi admin sebenar, Google Sheets import, scheduled expiry dan retention belum disambungkan, mengikut skop UI/UX dahulu. Sebelum produksi, data awam mesti datang daripada API/view yang hanya membenarkan medan awam; maklumat kedai dan harga Jepun tidak boleh dihantar kepada pelayar awam. Pemeriksaan masa di browser ini ialah demo UX, bukan penguatkuasaan backend.

## Semakan manual

1. Cari `TKY03-SHI-0125`, buka produk, tekan LOCK; semak destinasi serta mesej WhatsApp tanpa menghantar.
2. Gabungkan penapis, cuba julat harga terbalik, kosongkan penapis dan semak keadaan tiada hasil.
3. Buka `#/product/TKY03-SHI-0110` (expired) dan `#/product/TKY03-SHI-0134` (draf tidak awam).
4. Semak pada lebar 320/390px, desktop, zoom 200%, tulisan besar dan keyboard sahaja.
5. Demo pengurusan: edit draf, terbitkan, pilih pukal, tamatkan drop; kembali ke katalog. Reload mengembalikan data demo.

## Gambar rujukan

Gambar dimuat turun untuk pratonton tempatan; ganti dengan foto produk milik RIMSTACKLE yang dibenarkan sebelum penerbitan. Tiada gambar kondisi unit sebenar dibekalkan.

- Antares: [PLAT](https://www.plat.co.jp/shop/catalog/product_info/language/es/products_id/67853/cPath/4027_85_7530/reel/shimano-antares-dc-md-xg-extra-high-gear-right.html)
- Calcutta: [7 Seas Proshop](https://www.7seasproshopthai.com/product/view/74029), [Chí Thành](https://docauchithanh.com.vn/may-ngang-shimano-calcutta-conquest)
- Exist: [Daiwa](https://daiwa.us/products/22-exist/1000)
- Vision 110: [Pacific Pêche](https://www.pacificpeche.com/c/carnassier/leurres/poissons-nageurs/jerkbaits/p/leurre-jerkbait-minnow-megabass-vision-110-fw-suspending-11cm-14g/139640.html)
- Zodias: [Shimano](https://fishshop.shimano.com/products/zodias-spinning-a)

Tipografi: DM Sans + Barlow Condensed (Google Fonts), dengan fallback sistem jika rangkaian tidak tersedia. Wordmark sementara menggunakan teks; logo rasmi belum dibekalkan.
