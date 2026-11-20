# Sandy Eatery — Website

Situs statis tanpa dependensi (tidak perlu `npm install`). Cukup Node.js 18+.

```
node build.mjs            # hasil ada di folder dist/
node build.mjs --serve    # build + server lokal di http://localhost:4173 (ganti dengan `--port=3000`; otomatis build ulang saat file src/ berubah)
```

Upload isi folder **dist/** ke hosting (Netlify, Cloudflare Pages, GitHub Pages, hosting biasa, dsb.).

## Struktur

```
src/
  data/        isi situs: site.json, menu.json, gallery.json, testimoni.json
  pages/       halaman (index, menu, galeri, tentang, kontak, 404)
  partials/    header, footer, layout, blok ajakan (cta)
  css/ js/     style.css, main.js (semua halaman), menu.js, galeri.js, kontak.js
  img/         foto hasil optimasi (otomatis, jangan diedit manual)
  static/      file yang disalin apa adanya (favicon.ico)
assets-src/    foto asli (sumber)
tools/         optimize-images.py
build.mjs      pembuat situs
```

## Yang paling sering diubah

| Mau ubah | Edit file |
|---|---|
| Jam buka, hari tutup, alamat | `src/data/site.json` (`hours`, `address`). Footer, halaman Kontak, status "Buka sekarang", dan data Google otomatis ikut. |
| Nomor WhatsApp | `site.json` → `whatsapp`, format `08123456789` atau `628123456789`. |
| TikTok / Instagram | `site.json` → `socials`. Yang kosong tidak ditampilkan. |
| Domain | `site.json` → `url` (misal `https://sandyeatery.id`). Mengaktifkan canonical, gambar pratinjau link, dan sitemap. |
| Peta | `site.json` → `map.embedUrl` (Google Maps → Bagikan → Sematkan peta → salin isi `src`) dan `map.linkUrl`. |
| Harga & menu | `src/data/menu.json` (harga dalam ribuan: `24` = Rp 24k). |
| Galeri | `src/data/gallery.json` (lihat bawah). |
| Testimoni | `src/data/testimoni.json`. Kosong = bagian testimoni tidak tampil. |

## Foto

1. Taruh foto asli di `assets-src/` (JPG/PNG).
2. Jalankan `python3 tools/optimize-images.py` (butuh Pillow). Ini membuat versi WebP berbagai ukuran di `src/img/` dan `src/data/images.json`.
3. Jalankan `node build.mjs`.

### Mengganti foto berwatermark
Foto `pizza-apron` masih membawa watermark ALICE.CREATIVE (sementara). Setelah dapat versi bersih: timpa file dengan nama yang sama di `assets-src/`, jalankan langkah 2–3, lalu hapus baris `"watermark": true` di `gallery.json`. Peringatan di terminal akan hilang.

### Menambah foto ke galeri
Tambah satu objek di `gallery.json`:
```json
{ "img": "nama-file-tanpa-ekstensi", "cat": "pizza", "size": "normal", "caption": "Teks singkat", "alt": "Deskripsi foto untuk pembaca layar" }
```
`size`: `normal` (1×1), `wide` (2×1), `tall` (1×2), `big` (2×2), `full` (selebar grid, 2 baris; cocok untuk foto terakhir). Grid-nya 4 kolom di desktop; agar tidak ada lubang, jumlah total sel sebaiknya kelipatan 4 (normal=1, wide/tall=2, big=4). Saat filter kategori dipakai, semua kotak otomatis jadi seragam.

## Form Saran & Kritik (WhatsApp)

Tidak ada server. Setelah pengunjung mengisi dan menekan tombol, situs membuka `https://wa.me/<nomor>?text=<pesan>` sehingga WhatsApp terbuka dengan pesan sudah terisi; pengunjung tinggal menekan Kirim. Tidak ada data yang tersimpan di situs. Selama `whatsapp` di `site.json` kosong, tombol hanya menyalin pesan dan menawarkan tombol ke Instagram.

Kalau nanti mau pesan masuk otomatis tanpa pengunjung menekan Kirim (atau ke email/spreadsheet), bisa disambung ke layanan form seperti Formspree atau Google Apps Script; ubah bagian `submit` di `src/js/kontak.js`.

## Bagian pemesanan

Sengaja belum ada. Slot-nya ditandai komentar di `src/pages/index.html` (di antara "Satu menu, banyak ukuran" dan "Galeri") dan di `src/pages/menu.html`. Tambahkan HTML-nya di sana; CSS gaya `.section`, `.card`, `.btn` bisa dipakai ulang.

## Template singkat

- `{{site.name}}` teks aman, `{{{sec.menu}}}` HTML mentah (hasil build).
- `[[img nama alt="..." sizes="..." cls="..." pos="50% 50%"]]` menghasilkan `<img>` responsif lengkap dengan `srcset`, `width`, dan `height`.
- `<!--include:cta-->` menyisipkan partial.
- Komentar `<!--// ... -->` dibuang saat build.
- Halaman diawali komentar berisi `title`, `nav`, `scripts`, `description` (`{hours}` diganti kalimat jam buka).
