(function () {
    'use strict';
    var root = document.documentElement;
    var body = document.body;

    var toggle = document.querySelector('.menu-toggle');
    var nav = document.getElementById('navMenu');
    if (toggle && nav) {
        var setNav = function (open) {
            nav.classList.toggle('open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Tutup navigasi' : 'Buka navigasi');
        };
        toggle.addEventListener('click', function () { setNav(!nav.classList.contains('open')); });
        nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && nav.classList.contains('open')) { setNav(false); toggle.focus(); }
        });
    }

    function nowInShop() {
        var tz = body.dataset.tz || 'Asia/Jakarta';
        try {
            var parts = new Intl.DateTimeFormat('en-US', {
                timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
            }).formatToParts(new Date());
            var map = {};
            parts.forEach(function (p) { map[p.type] = p.value; });
            var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return { day: days.indexOf(map.weekday), min: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10) };
        } catch (err) {
            var d = new Date();
            return { day: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
        }
    }

    function fmt(min) {
        var h = Math.floor(min / 60), m = min % 60;
        return (h < 10 ? '0' : '') + h + '.' + (m < 10 ? '0' : '') + m;
    }

    var DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    function updateStatus() {
        var openMin = parseInt(body.dataset.open, 10);
        var closeMin = parseInt(body.dataset.close, 10);
        if (isNaN(openMin) || isNaN(closeMin)) return;
        var closed = (body.dataset.closed || '').split(',').filter(Boolean).map(Number);
        var now = nowInShop();
        var isClosedDay = closed.indexOf(now.day) !== -1;
        var text, state;

        var next = 1;
        while (next < 7 && closed.indexOf((now.day + next) % 7) !== -1) next++;
        var nextDay = (now.day + next) % 7;
        var nextLabel = next === 1 ? 'besok' : 'hari ' + DAY_NAMES[nextDay];

        if (isClosedDay) {
            state = 'is-closed';
            text = 'Tutup hari ini (' + DAY_NAMES[now.day] + ') · buka ' + nextLabel;
        } else if (now.min >= openMin && now.min < closeMin) {
            state = 'is-open';
            var left = closeMin - now.min;
            text = left <= 60 ? 'Buka sekarang · tutup ' + left + ' menit lagi' : 'Buka sekarang · sampai ' + fmt(closeMin);
        } else if (now.min < openMin) {
            state = 'is-closed';
            text = 'Tutup · buka pukul ' + fmt(openMin);
        } else {
            state = 'is-closed';
            text = 'Tutup · buka lagi ' + nextLabel + ' pukul ' + fmt(openMin);
        }

        document.querySelectorAll('[data-status]').forEach(function (el) {
            el.classList.remove('is-open', 'is-closed');
            el.classList.add(state);
            el.textContent = text;
        });

        document.querySelectorAll('.hours li[data-day]').forEach(function (li) {
            li.classList.toggle('today', Number(li.dataset.day) === now.day);
        });
    }
    updateStatus();
    setInterval(updateStatus, 60000);

    var items = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && items.length) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        items.forEach(function (el) { io.observe(el); });
    } else {
        items.forEach(function (el) { el.classList.add('in'); });
    }

    root.dataset.ready = '1';
})();
