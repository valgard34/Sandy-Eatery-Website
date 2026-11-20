#!/usr/bin/env node
/* =========================================================
   SANDY EATERY — build.mjs
   Pembuat situs statis TANPA dependensi (cukup Node 18+).

     node build.mjs            -> hasil ke folder dist/
     node build.mjs --serve    -> build + server lokal + build ulang otomatis
     node build.mjs --serve --port=3000

   Isi situs:
     src/data/*.json   data (info toko, menu, galeri, testimoni)
     src/pages/*.html  teks tiap halaman (bisa diedit langsung)
     src/partials/*    kerangka halaman, header, footer
     src/css, src/js   tampilan & perilaku
   ========================================================= */
import {
  readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync, watch,
} from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const args = process.argv.slice(2);

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAV = [
  ['index', 'Beranda', 'index.html'],
  ['menu', 'Menu', 'menu.html'],
  ['galeri', 'Galeri', 'galeri.html'],
  ['tentang', 'Tentang', 'tentang.html'],
  ['kontak', 'Kontak & Lokasi', 'kontak.html'],
];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const readText = (...p) => readFileSync(join(SRC, ...p), 'utf8');
const readJson = (name) => JSON.parse(readText('data', name));
const hash = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 8);
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/* ---------- ikon media sosial ---------- */
const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICONS = {
  whatsapp: `${SVG_OPEN}<path d="M3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 8 19.5l-4.5 1z"/><path d="M9 8.5c.2 2.6 3 5.9 6.5 6.6l1.3-1.5-2.2-1.1-1 1c-1.2-.5-2.4-1.7-2.9-2.9l1-1-1-2.2z"/></svg>`,
  instagram: `${SVG_OPEN}<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor"/></svg>`,
  tiktok: `${SVG_OPEN}<path d="M14 3.5v10.8a3.7 3.7 0 1 1-3.7-3.7"/><path d="M14 3.5c.3 2.4 1.9 4.1 4.2 4.3"/></svg>`,
};

/* =========================================================
   Data
   ========================================================= */
function loadData(warnings) {
  const site = readJson('site.json');
  const menu = readJson('menu.json');
  const gallery = readJson('gallery.json');
  const testimoni = readJson('testimoni.json');
  const images = readJson('images.json');

  // WhatsApp: terima "0812…", "+62 812…", atau "62812…" — dijadikan 62812…
  let wa = String(site.whatsapp || '').replace(/\D/g, '');
  if (wa.startsWith('0')) wa = '62' + wa.slice(1);
  else if (wa.startsWith('8')) wa = '62' + wa;
  site.waNumber = wa;
  site.waUrl = wa ? `https://wa.me/${wa}` : '';

  const a = site.address;
  site.fullAddress = `${a.street}, ${a.city}, ${a.region} ${a.postal}`;
  const h = site.hours;
  site.hoursRange = `${h.open}–${h.close}`;
  site.closedNames = h.closedDays.map((d) => DAY_NAMES[d]);
  site.closedText = site.closedNames.join(', ');
  site.hoursSentence = site.closedNames.length
    ? `Buka setiap hari ${h.open}–${h.close}, ${site.closedText} tutup`
    : `Buka setiap hari ${h.open}–${h.close}`;
  site.baseUrl = String(site.url || '').replace(/\/+$/, '');
  const toMin = (s) => { const [hh, mm] = s.split('.').map(Number); return hh * 60 + (mm || 0); };
  site.openMin = toMin(h.open);
  site.closeMin = toMin(h.close);
  site.closedCsv = h.closedDays.join(',');
  site.daysLine = site.closedNames.length ? `Setiap hari, ${site.closedText} tutup` : 'Setiap hari';
  site.statusFallback = site.hoursSentence;
  site.hoursLine1 = `Setiap hari ${h.open}–${h.close}`;
  site.hoursLine2Html = site.closedNames.length ? `<li>${site.closedText} tutup</li>` : '';

  const prices = menu.groups.flatMap((g) => g.categories.flatMap((c) => c.items.map((i) => i.price)));
  site.minPrice = Math.min(...prices);
  site.maxPrice = Math.max(...prices);

  if (!site.baseUrl) warnings.push('site.url masih kosong → canonical, gambar pratinjau link (og:image), dan sitemap belum dibuat. Isi setelah domain jadi.');
  if (!site.waNumber) warnings.push('whatsapp masih kosong → form Saran & Kritik hanya menyalin pesan (belum bisa membuka WhatsApp), dan ikon WhatsApp disembunyikan.');
  const wm = gallery.items.filter((i) => i.watermark).map((i) => i.img);
  if (wm.length) warnings.push(`Foto berwatermark masih dipakai di galeri: ${wm.join(', ')}. Ganti file bersihnya di assets-src/ lalu hapus "watermark": true di gallery.json.`);

  return { site, menu, gallery, testimoni, images };
}

/* =========================================================
   Komponen HTML
   ========================================================= */
function makeImg(images) {
  return function img(name, o = {}) {
    const m = images[name];
    if (!m) throw new Error(`Foto "${name}" tidak ada di src/data/images.json — jalankan: python3 tools/optimize-images.py`);
    const v = m.variants;
    const srcset = v.map((w) => `img/${name}-${w}.webp ${w}w`).join(', ');
    const src = `img/${name}-${v[Math.min(1, v.length - 1)]}.webp`;
    const attrs = [
      `src="${src}"`,
      `srcset="${srcset}"`,
      `sizes="${esc(o.sizes || '100vw')}"`,
      `width="${m.w}"`, `height="${m.h}"`,
      `alt="${esc(o.alt || '')}"`,
    ];
    if (o.cls) attrs.push(`class="${esc(o.cls)}"`);
    if (o.pos) attrs.push(`style="object-position:${esc(o.pos)}"`);
    if (o.eager) attrs.push('fetchpriority="high"'); else attrs.push('loading="lazy"', 'decoding="async"');
    return `<img ${attrs.join(' ')}>`;
  };
}

function navLinks(current) {
  return NAV.map(([id, label, href]) =>
    `<a href="${href}"${id === current ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('\n                ');
}

function socialEntries(site) {
  const out = [];
  const handle = (url) => {
    try {
      const seg = new URL(url).pathname.split('/').filter(Boolean)[0] || '';
      return seg ? (seg.startsWith('@') ? seg : '@' + seg) : 'Kunjungi';
    } catch { return 'Kunjungi'; }
  };
  if (site.waUrl) out.push({ id: 'whatsapp', label: 'WhatsApp', url: site.waUrl, hint: 'Chat dengan kami' });
  if (site.socials.instagram) out.push({ id: 'instagram', label: 'Instagram', url: site.socials.instagram, hint: handle(site.socials.instagram) });
  if (site.socials.tiktok) out.push({ id: 'tiktok', label: 'TikTok', url: site.socials.tiktok, hint: handle(site.socials.tiktok) });
  return out;
}
const socialCircles = (site) => socialEntries(site).map((s) =>
  `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${s.label} (tab baru)" title="${s.label}">${ICONS[s.id]}</a>`).join('\n                    ');
const socialCards = (site) => socialEntries(site).map((s) =>
  `<a class="social" href="${esc(s.url)}" target="_blank" rel="noopener">${ICONS[s.id]}<span class="s-label">${s.label}<small>${esc(s.hint)}</small></span></a>`).join('\n                    ');

function hoursRows(site) {
  const h = site.hours;
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const closed = h.closedDays.includes(d);
    return `<li data-day="${d}"${closed ? ' class="off"' : ''}><span>${DAY_NAMES[d]}</span><span>${closed ? 'Tutup' : `${h.open} – ${h.close}`}</span></li>`;
  }).join('\n                        ');
}

function menuHtml(menu, img) {
  const fmt = (n) => `${n}k`;
  return menu.groups.map((g) => {
    const head = g.banner
      ? `<div class="group-head has-banner">${img(g.banner.img, { alt: g.banner.alt, sizes: '(min-width: 1200px) 1160px, 100vw', pos: g.banner.position })}<div class="group-head-text"><h2 id="h-${g.id}">${esc(g.title)}</h2><span>${esc(g.subtitle)}</span></div></div>`
      : `<div class="group-head"><div class="group-head-text"><h2 id="h-${g.id}">${esc(g.title)}</h2><span>${esc(g.subtitle)}</span></div></div>`;
    const cats = g.categories.map((c) => {
      const lead = c.thumb
        ? `<div class="cat-thumb">${img(c.thumb, { alt: '', sizes: '76px', pos: c.thumbPosition })}</div>`
        : c.badge ? `<div class="cat-badge" aria-hidden="true">${esc(c.badge)}</div>` : '';
      const items = c.items.map((i) =>
        `<li><span class="n">${esc(i.name)}</span><span class="p"><span class="visually-hidden">Rp </span>${fmt(i.price)}</span></li>`).join('\n                                ');
      return `<article class="cat">
                        <header class="cat-head${lead ? ' with-lead' : ''}">
                            ${lead}
                            <div class="cat-titles"><h3>${esc(c.title)}</h3>${c.meta ? `<small>${esc(c.meta)}</small>` : ''}</div>
                        </header>
                        <ul>
                                ${items}
                        </ul>
                    </article>`;
    }).join('\n                    ');
    return `<section class="menu-group" id="${g.id}" data-group="${g.id}" aria-labelledby="h-${g.id}">
            <div class="wrap">
                ${head}
                <div class="menu-cats">
                    ${cats}
                </div>
            </div>
        </section>`;
  }).join('\n\n        ');
}

function galleryHtml(gallery, images, img) {
  const chips = ['<button class="chip" type="button" data-filter="semua" aria-pressed="true">Semua</button>']
    .concat(gallery.categories.map((c) => `<button class="chip" type="button" data-filter="${c.id}" aria-pressed="false">${esc(c.label)}</button>`)).join('\n                    ');
  const tiles = gallery.items.map((it) => {
    const m = images[it.img];
    const full = m.variants.filter((w) => w <= 1600).pop();
    const sizes = it.size === 'full' ? '100vw' : it.size === 'big' || it.size === 'wide'
      ? '(min-width: 900px) 50vw, 100vw' : '(min-width: 900px) 25vw, 50vw';
    return `<li class="tile t-${it.size || 'normal'}" data-cat="${it.cat}">
                    <a href="img/${it.img}-${full}.webp" data-w="${m.w}" data-alt="${esc(it.alt)}">
                        ${img(it.img, { alt: it.alt, sizes })}
                    </a>
                </li>`;
  }).join('\n                ');
  return { chips, tiles };
}

function mosaicHtml(gallery, img) {
  const pick = [
    ['pizza-cheese-pull-close', 'm1', '(min-width: 900px) 50vw, 100vw'],
    ['tokkebi', 'm2', '(min-width: 900px) 25vw, 50vw'],
    ['pizza-hands-top', 'm3', '(min-width: 900px) 25vw, 50vw'],
    ['pizza-top-down', 'm4', '(min-width: 900px) 25vw, 50vw'],
  ];
  return pick.map(([name, cls, sizes]) => {
    const it = gallery.items.find((i) => i.img === name);
    return `<li class="${cls}">${img(name, { alt: it ? it.alt : '', sizes })}</li>`;
  }).join('\n                    ');
}

function testimoniHtml(list) {
  if (!list.length) return '';
  const cards = list.map((t) =>
    `<figure class="quote reveal"><blockquote><p>${esc(t.text)}</p></blockquote><figcaption><b>${esc(t.name)}</b>${t.source ? `<span>${esc(t.source)}</span>` : ''}</figcaption></figure>`).join('\n                    ');
  return `<section class="section tint" id="testimoni">
            <div class="wrap">
                <div class="section-head center">
                    <p class="eyebrow">Kata Pelanggan</p>
                    <h2>Mereka sudah <em class="hl">mampir.</em></h2>
                </div>
                <div class="quotes">
                    ${cards}
                </div>
            </div>
        </section>`;
}

/* =========================================================
   SEO
   ========================================================= */
function jsonLd(site) {
  const a = site.address;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: site.name,
    description: `${site.slogan}. Pizza, kopi, dan camilan di Malang.`,
    servesCuisine: ['Pizza', 'Kopi'],
    priceRange: `Rp${(site.minPrice * 1000).toLocaleString('id-ID')}–Rp${(site.maxPrice * 1000).toLocaleString('id-ID')}`,
    address: {
      '@type': 'PostalAddress', streetAddress: a.street, addressLocality: a.city,
      addressRegion: a.region, postalCode: a.postal, addressCountry: a.country,
    },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [1, 2, 3, 4, 5, 6, 0].filter((d) => !site.hours.closedDays.includes(d))
        .map((d) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]),
      opens: site.hours.open.replace('.', ':'),
      closes: site.hours.close.replace('.', ':'),
    }],
  };
  if (site.baseUrl) {
    ld.url = `${site.baseUrl}/`;
    ld.image = `${site.baseUrl}/img/og-image.jpg`;
    ld.hasMenu = `${site.baseUrl}/menu.html`;
  }
  if (site.waNumber) ld.telephone = `+${site.waNumber}`;
  const same = [site.socials.instagram, site.socials.tiktok].filter(Boolean);
  if (same.length) ld.sameAs = same;
  return `<script type="application/ld+json">\n    ${JSON.stringify(ld, null, 2).replace(/\n/g, '\n    ')}\n    </script>`;
}

function seoHead(page, site, file) {
  const title = page.fullTitle;
  const lines = [
    `<meta name="description" content="${esc(page.description)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="id_ID">',
    `<meta property="og:site_name" content="${esc(site.name)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
  ];
  if (site.baseUrl) {
    const pageUrl = file === 'index.html' ? `${site.baseUrl}/` : `${site.baseUrl}/${file}`;
    lines.push(`<link rel="canonical" href="${pageUrl}">`, `<meta property="og:url" content="${pageUrl}">`,
      `<meta property="og:image" content="${site.baseUrl}/img/og-image.jpg">`,
      '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${esc(site.name)} — ${esc(site.slogan)}">`,
      '<meta name="twitter:card" content="summary_large_image">');
  }
  return lines.join('\n    ');
}

/* =========================================================
   Template mini
   ========================================================= */
function render(tpl, ctx) {
  return tpl.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g, (_, raw, esc2) => {
    const v = get(ctx, raw || esc2);
    if (v == null) throw new Error(`Placeholder tidak dikenal: {{${raw || esc2}}}`);
    return raw ? String(v) : esc(v);
  });
}

// [[img nama alt="…" sizes="…" cls="…" pos="…" eager]]
function expandDirectives(html, img) {
  return html.replace(/\[\[img\s+([\w-]+)([^\]]*)\]\]/g, (_, name, rest) => {
    const o = {};
    rest.replace(/(\w+)="([^"]*)"/g, (__, k, v) => { o[k] = v; return ''; });
    if (/\beager\b/.test(rest.replace(/"[^"]*"/g, ''))) o.eager = true;
    return img(name, o);
  });
}

function parsePage(src) {
  const m = src.match(/^<!--([\s\S]*?)-->\s*/);
  const meta = {};
  if (m) {
    m[1].split('\n').forEach((line) => {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
  }
  return { meta, body: m ? src.slice(m[0].length) : src };
}

/* =========================================================
   Build
   ========================================================= */
function build() {
  const t0 = Date.now();
  const warnings = [];
  const { site, menu, gallery, testimoni, images } = loadData(warnings);
  const img = makeImg(images);

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(join(DIST, 'css'), { recursive: true });
  mkdirSync(join(DIST, 'js'), { recursive: true });

  // salin aset
  cpSync(join(SRC, 'img'), join(DIST, 'img'), { recursive: true });
  if (existsSync(join(SRC, 'static'))) cpSync(join(SRC, 'static'), DIST, { recursive: true });
  const version = {};
  for (const [dir, ext] of [['css', '.css'], ['js', '.js']]) {
    for (const f of readdirSync(join(SRC, dir)).filter((x) => x.endsWith(ext))) {
      const buf = readFileSync(join(SRC, dir, f));
      writeFileSync(join(DIST, dir, f), buf);
      version[`${dir}/${f}`] = hash(buf);
    }
  }
  const asset = (p) => `${p}?v=${version[p] || '0'}`;

  const gal = galleryHtml(gallery, images, img);
  const baseCtx = {
    site,
    sec: {
      hoursRows: hoursRows(site),
      footerSocial: socialCircles(site) ? `<div class="footer-social">${socialCircles(site)}</div>` : '',
      socialBlock: socialCards(site)
        ? `<div class="card"><h2>Ikuti kami</h2><div class="social-list">${socialCards(site)}</div></div>` : '',
      formLead: site.waNumber
        ? 'Masukanmu membantu Sandy Eatery jadi lebih baik. Isi formulir ini, lalu pesanmu kami buka di WhatsApp siap dikirim.'
        : 'Masukanmu membantu Sandy Eatery jadi lebih baik. Isi formulir ini, lalu salin pesannya dan kirim ke kami.',
      formButton: site.waNumber ? 'Kirim lewat WhatsApp' : 'Siapkan Pesan',
      menu: menuHtml(menu, img),
      galleryChips: gal.chips,
      galleryTiles: gal.tiles,
      mosaic: mosaicHtml(gallery, img),
      testimoni: testimoniHtml(testimoni),
      jsonld: jsonLd(site),
      mapEmbed: site.map.embedUrl
        || `https://www.google.com/maps?q=${encodeURIComponent(`${site.name} ${site.fullAddress}`)}&output=embed`,
      mapLink: site.map.linkUrl
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name} ${site.fullAddress}`)}`,
    },
    body: {
      open: site.hours.open, close: site.hours.close,
    },
  };

  const layout = readText('partials', 'layout.html');
  const partial = (name) => readText('partials', `${name}.html`);
  const pagesDir = join(SRC, 'pages');

  for (const file of readdirSync(pagesDir).filter((f) => f.endsWith('.html'))) {
    const id = file.replace(/\.html$/, '');
    const { meta, body } = parsePage(readFileSync(join(pagesDir, file), 'utf8'));
    const page = {
      ...meta,
      fullTitle: meta.home ? meta.title : `${meta.title} | ${site.name}`,
      description: (meta.description || '').replace(/\{hours\}/g, site.hoursSentence),
    };
    const scripts = ['main', ...(meta.scripts ? meta.scripts.split(',').map((s) => s.trim()) : [])]
      .map((s) => `<script src="${asset(`js/${s}.js`)}" defer></script>`).join('\n    ');
    const preload = meta.preload && images[meta.preload]
      ? `<link rel="preload" as="image" type="image/webp" imagesrcset="${images[meta.preload].variants.map((w) => `img/${meta.preload}-${w}.webp ${w}w`).join(', ')}" imagesizes="(min-width: 900px) 62vw, 100vw">`
      : '';

    const ctx = {
      ...baseCtx,
      page,
      sec: {
        ...baseCtx.sec,
        nav: navLinks(id === 'index' ? 'index' : meta.nav || id),
        jsonld: meta.home ? baseCtx.sec.jsonld : '',
        seo: seoHead(page, site, file),
        scripts,
        preload,
        css: asset('css/style.css'),
      },
    };

    // urutan: partial -> directive gambar -> placeholder
    let content = body.replace(/<!--include:([\w-]+)-->/g, (_, n) => partial(n));
    content = content.replace(/<!--\/\/[\s\S]*?-->\s*/g, '');
    content = expandDirectives(content, img);
    content = render(content, ctx);
    const header = render(partial('header'), ctx);
    const footer = render(partial('footer'), ctx);
    const html = render(layout, { ...ctx, content, header, footer });
    writeFileSync(join(DIST, file), html);
  }

  // robots, sitemap, manifest
  const pages = readdirSync(pagesDir).filter((f) => f.endsWith('.html') && f !== '404.html');
  writeFileSync(join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\n${site.baseUrl ? `\nSitemap: ${site.baseUrl}/sitemap.xml\n` : ''}`);
  if (site.baseUrl) {
    const urls = pages.map((f) => `  <url><loc>${site.baseUrl}/${f === 'index.html' ? '' : f}</loc></url>`).join('\n');
    writeFileSync(join(DIST, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  }
  writeFileSync(join(DIST, 'site.webmanifest'), JSON.stringify({
    name: site.name, short_name: site.name, lang: 'id', start_url: './index.html', display: 'standalone',
    background_color: '#fff8ea', theme_color: site.themeColor,
    icons: [
      { src: 'img/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'img/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }, null, 2));

  console.log(`\n✔ Build selesai: ${pages.length} halaman → dist/  (${Date.now() - t0} ms)`);
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}

/* =========================================================
   Server lokal (opsional)
   ========================================================= */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

function serve(port) {
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(DIST, p);
    if (!file.startsWith(DIST) || !existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(existsSync(join(DIST, '404.html')) ? readFileSync(join(DIST, '404.html')) : 'Tidak ditemukan');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  }).listen(port, () => console.log(`\n→ Buka http://localhost:${port}  (Ctrl+C untuk berhenti)`));
}

try {
  build();
} catch (e) {
  console.error('\n✘ Build gagal:', e.message);
  process.exit(1);
}

if (args.includes('--serve')) {
  const port = Number((args.find((a) => a.startsWith('--port=')) || '--port=4173').split('=')[1]);
  serve(port);
  let timer;
  watch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { build(); } catch (e) { console.error('✘', e.message); }
    }, 150);
  });
}
