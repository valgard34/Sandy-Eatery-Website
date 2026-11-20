/* galeri.js — filter kategori + lightbox (<dialog>) dengan panah, swipe, dan keyboard. */
(function () {
    'use strict';
    var chips = document.querySelectorAll('.chip[data-filter]');
    var tiles = Array.prototype.slice.call(document.querySelectorAll('#galGrid .tile'));
    var count = document.getElementById('galCount');
    var dlg = document.getElementById('lightbox');
    if (!tiles.length) return;

    // ---------- Filter ----------
    function applyFilter(cat) {
        var n = 0;
        tiles.forEach(function (t) {
            var show = cat === 'semua' || t.dataset.cat === cat;
            t.hidden = !show;
            if (show) n++;
        });
        // saat difilter, semua kotak seragam supaya tidak ada lubang di grid
        var grid = document.getElementById('galGrid');
        if (grid) grid.classList.toggle('is-filtered', cat !== 'semua');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.filter === cat)); });
        if (count) count.textContent = 'Menampilkan ' + n + ' foto';
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { applyFilter(c.dataset.filter); }); });
    applyFilter('semua');

    // ---------- Lightbox ----------
    if (!dlg || typeof dlg.showModal !== 'function') return; // tanpa <dialog>: tautan foto terbuka biasa
    var img = document.getElementById('lbImg');
    var cnt = document.getElementById('lbCount');
    var current = 0, opener = null;

    function visible() { return tiles.filter(function (t) { return !t.hidden; }); }

    function render(list, i) {
        var a = list[i].querySelector('a');
        current = i;
        img.src = a.getAttribute('href');
        img.alt = a.dataset.alt || '';
        img.style.setProperty('--nw', a.dataset.w || 1600);
        cnt.textContent = (i + 1) + ' dari ' + list.length;
        // muat foto tetangga lebih awal supaya geser terasa mulus
        [i - 1, i + 1].forEach(function (j) {
            if (list[j]) { var p = new Image(); p.src = list[j].querySelector('a').getAttribute('href'); }
        });
    }

    function step(d) {
        var list = visible();
        if (!list.length) return;
        render(list, (current + d + list.length) % list.length);
    }

    tiles.forEach(function (t) {
        t.querySelector('a').addEventListener('click', function (e) {
            e.preventDefault();
            var list = visible();
            opener = e.currentTarget;
            render(list, list.indexOf(t));
            dlg.showModal();
        });
    });

    dlg.querySelector('.lb-close').addEventListener('click', function () { dlg.close(); });
    dlg.querySelector('.lb-prev').addEventListener('click', function () { step(-1); });
    dlg.querySelector('.lb-next').addEventListener('click', function () { step(1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('lb-inner')) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') step(-1);
        else if (e.key === 'ArrowRight') step(1);
    });
    dlg.addEventListener('close', function () { img.removeAttribute('src'); if (opener) opener.focus(); });

    // swipe di layar sentuh
    var x0 = null;
    dlg.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });
})();
