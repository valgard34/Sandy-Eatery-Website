/* menu.js — tab Pizza / Makanan / Minuman / Semua di halaman menu. */
(function () {
    'use strict';
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[data-tab]'));
    var groups = Array.prototype.slice.call(document.querySelectorAll('.menu-group[data-group]'));
    if (!tabs.length || !groups.length) return;

    function show(name, updateHash) {
        var valid = name === 'semua' || groups.some(function (g) { return g.dataset.group === name; });
        if (!valid) name = 'semua';
        tabs.forEach(function (t) { t.setAttribute('aria-pressed', String(t.dataset.tab === name)); });
        groups.forEach(function (g) { g.hidden = !(name === 'semua' || g.dataset.group === name); });
        if (updateHash) {
            try { history.replaceState(null, '', name === 'pizza' ? location.pathname : '#' + name); } catch (e) { /* abaikan */ }
        }
    }

    tabs.forEach(function (t) {
        t.addEventListener('click', function () {
            show(t.dataset.tab, true);
            var bar = document.querySelector('.menu-tabs-bar');
            var first = document.querySelector('.menu-group:not([hidden])');
            if (bar && first && bar.getBoundingClientRect().top <= 1) {
                first.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    function fromHash() {
        var h = location.hash.replace('#', '');
        show(h || 'pizza', false);
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();
})();
