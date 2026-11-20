(function () {
    'use strict';
    var form = document.getElementById('formKontak');
    if (!form) return;

    var WA = (form.dataset.wa || '').trim();
    var IG = (form.dataset.ig || '').trim();
    var SHOP = form.dataset.name || 'Sandy Eatery';
    var MAX = 300, MIN = 10;

    var $ = function (id) { return document.getElementById(id); };
    var f = {
        nama: $('nama'), subjek: $('subjek'), tgl: $('tglKunjungan'), pesan: $('pesan'),
        email: $('email'), hp: $('hp'), setuju: $('setuju')
    };
    var ratingBox = $('f-nilai');
    var ratingText = $('nilai-teks');
    var counter = $('hitung-pesan');
    var result = $('hasil');
    var LABELS = { 1: 'Kurang', 2: 'Cukup', 3: 'Baik', 4: 'Enak', 5: 'Sangat enak' };

    function rating() {
        var r = form.querySelector('input[name="nilai"]:checked');
        return r ? Number(r.value) : 0;
    }

    function setError(key, msg, el) {
        var out = $('err-' + key);
        if (out) out.textContent = msg || '';
        var target = el || f[key];
        if (target && target.setAttribute) {
            if (msg) { target.classList.add('invalid'); target.setAttribute('aria-invalid', 'true'); }
            else { target.classList.remove('invalid'); target.removeAttribute('aria-invalid'); }
        }
    }

    function isDigits(s) {
        if (!s.length) return false;
        for (var i = 0; i < s.length; i++) { if (s.charAt(i) < '0' || s.charAt(i) > '9') return false; }
        return true;
    }

    function validEmail(s) {
        if (s.indexOf(' ') !== -1) return false;
        var at = s.indexOf('@');
        if (at < 1 || at !== s.lastIndexOf('@')) return false;
        var domain = s.slice(at + 1);
        var dot = domain.lastIndexOf('.');
        return dot > 0 && dot < domain.length - 1 && domain.charAt(0) !== '.';
    }

    function todayISO() {
        var d = new Date();
        var m = d.getMonth() + 1, day = d.getDate();
        return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    var checks = {
        nama: function () {
            var v = f.nama.value.trim();
            if (!v) return 'Nama wajib diisi.';
            if (v.length < 2) return 'Nama minimal 2 karakter.';
            if (v.length > 50) return 'Nama maksimal 50 karakter.';
            return '';
        },
        subjek: function () { return f.subjek.value ? '' : 'Pilih jenis pesan.'; },
        nilai: function () { return rating() ? '' : 'Pilih jumlah bintang.'; },
        tglKunjungan: function () {
            var v = f.tgl.value;
            if (v && v > todayISO()) return 'Tanggal kunjungan tidak boleh di masa depan.';
            return '';
        },
        pesan: function () {
            var v = f.pesan.value.trim();
            if (!v) return 'Pesan wajib diisi.';
            if (v.length < MIN) return 'Pesan minimal ' + MIN + ' karakter (sekarang ' + v.length + ').';
            if (v.length > MAX) return 'Pesan maksimal ' + MAX + ' karakter.';
            return '';
        },
        email: function () {
            var v = f.email.value.trim();
            return !v || validEmail(v) ? '' : 'Format email belum benar. Contoh: nama@email.com';
        },
        hp: function () {
            var v = f.hp.value.split(' ').join('').split('-').join('');
            if (!v) return '';
            if (v.charAt(0) === '+') v = v.slice(1);
            return isDigits(v) && v.length >= 9 && v.length <= 15 ? '' : 'Nomor HP 9–15 angka. Contoh: 081234567890';
        },
        setuju: function () { return f.setuju.checked ? '' : 'Centang persetujuan dulu ya.'; }
    };

    function run(key) {
        var msg = checks[key]();
        if (key === 'nilai') {
            setError('nilai', msg, ratingBox);
            ratingBox.classList.toggle('invalid', !!msg);
        } else if (key === 'tglKunjungan') {
            setError('tglKunjungan', msg, f.tgl);
        } else {
            setError(key, msg);
        }
        return msg;
    }

    function updateCounter() {
        var n = f.pesan.value.length;
        counter.textContent = n + ' / ' + MAX;
        counter.style.color = n > MAX ? 'var(--danger)' : '';
    }
    f.pesan.addEventListener('input', updateCounter);
    updateCounter();

    form.querySelectorAll('input[name="nilai"]').forEach(function (r) {
        r.addEventListener('change', function () {
            ratingText.textContent = rating() + ' dari 5 · ' + LABELS[rating()];
            run('nilai');
        });
    });

    ['nama', 'subjek', 'pesan', 'email', 'hp'].forEach(function (k) {
        f[k].addEventListener('blur', function () { run(k); });
        f[k].addEventListener('input', function () { if (f[k].classList.contains('invalid')) run(k); });
    });
    f.subjek.addEventListener('change', function () { run('subjek'); });
    f.tgl.addEventListener('change', function () { run('tglKunjungan'); });
    f.setuju.addEventListener('change', function () { run('setuju'); });
    f.tgl.max = todayISO();

    function formatDate(iso) {
        var p = iso.split('-');
        var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return Number(p[2]) + ' ' + months[Number(p[1]) - 1] + ' ' + p[0];
    }

    function buildMessage() {
        var n = rating();
        var stars = '';
        for (var i = 1; i <= 5; i++) stars += i <= n ? '★' : '☆';
        var lines = [
            '*' + f.subjek.value + ' untuk ' + SHOP + '*',
            '',
            'Nama: ' + f.nama.value.trim(),
            'Penilaian: ' + stars + ' (' + n + '/5)'
        ];
        if (f.tgl.value) lines.push('Tanggal kunjungan: ' + formatDate(f.tgl.value));
        lines.push('', f.pesan.value.trim());
        var reply = [];
        if (f.email.value.trim()) reply.push('Email: ' + f.email.value.trim());
        if (f.hp.value.trim()) reply.push('WhatsApp: ' + f.hp.value.trim());
        if (reply.length) { lines.push('', 'Boleh dibalas ke:'); lines = lines.concat(reply); }
        return lines.join('\n');
    }

    function button(label, cls, onClick, href) {
        var el = document.createElement(href ? 'a' : 'button');
        el.className = 'btn small ' + cls;
        el.textContent = label;
        if (href) { el.href = href; el.target = '_blank'; el.rel = 'noopener'; }
        else { el.type = 'button'; el.addEventListener('click', onClick); }
        return el;
    }

    function showResult(title, text, actions, preText) {
        $('hasilJudul').textContent = title;
        $('hasilTeks').textContent = text;
        var box = $('hasilAksi');
        box.textContent = '';
        var old = result.querySelector('pre');
        if (old) old.remove();
        if (preText) {
            var pre = document.createElement('pre');
            pre.textContent = preText;
            result.insertBefore(pre, box);
        }
        actions.forEach(function (a) { box.appendChild(a); });
        result.hidden = false;
        result.scrollIntoView({ behavior: 'smooth', block: 'center' });
        result.focus({ preventScroll: true });
    }

    function copyText(text, btn) {
        var done = function () { var t = btn.textContent; btn.textContent = 'Tersalin ✓'; setTimeout(function () { btn.textContent = t; }, 2000); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
        } else { fallbackCopy(text); done(); }
    }
    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        ta.remove();
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var firstBad = null;
        ['nama', 'subjek', 'nilai', 'tglKunjungan', 'pesan', 'email', 'hp', 'setuju'].forEach(function (k) {
            if (run(k) && !firstBad) firstBad = k;
        });
        if (firstBad) {
            var target = firstBad === 'nilai' ? ratingBox.querySelector('input') : firstBad === 'tglKunjungan' ? f.tgl : f[firstBad];
            if (target) target.focus();
            return;
        }

        var msg = buildMessage();

        if (WA) {
            var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
            var w = window.open(url, '_blank', 'noopener');
            showResult(
                'WhatsApp sudah disiapkan',
                w ? 'Pesanmu sudah terisi di WhatsApp. Tinggal tekan Kirim di sana. Kalau tab tidak terbuka, pakai tombol di bawah.'
                  : 'Pop-up diblokir browser. Pakai tombol di bawah untuk membuka WhatsApp.',
                [button('Buka WhatsApp', 'primary', null, url)]
            );
        } else {
            var copyBtn = button('Salin pesan', 'primary', function () { copyText(msg, copyBtn); });
            var actions = [copyBtn];
            if (IG) actions.push(button('Buka Instagram', 'ghost', null, IG));
            showResult(
                'Pesan siap dikirim',
                'Nomor WhatsApp toko belum diatur di situs ini. Salin pesan di bawah, lalu kirim lewat media sosial kami.',
                actions, msg
            );
        }
    });
})();
