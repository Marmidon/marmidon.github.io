/* Bread and Steel portfolio: progressive enhancement only. The page reads fully without it.
   Loaded in <head> so the theme and the html.js / motion classes land before first paint. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  // ---------- theme (stored choice wins, else prefers-color-scheme) ----------
  var stored = null;
  try { stored = localStorage.getItem('fk-theme'); } catch (e) {}
  if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);

  // ---------- motion variant (?motion=tour|calm|drift|atlas); tour is the default ----------
  var params = new URLSearchParams(location.search);
  var MODES = ['calm', 'drift', 'tour', 'atlas'];
  var mode = MODES.indexOf(params.get('motion')) >= 0 ? params.get('motion') : 'tour';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('motion-' + mode);

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initReveal();
    initLightbox();
    initSliders();
    initSwitcher();
    if (!reduced.matches) {
      if (mode === 'tour') initTour();
      if (mode === 'atlas') initAtlas();
    }
  });

  function initTheme() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    var media = window.matchMedia('(prefers-color-scheme: light)');
    var current = function () { return root.getAttribute('data-theme') || (media.matches ? 'light' : 'dark'); };
    var sync = function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      btn.setAttribute('data-next', next);
      btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    };
    btn.hidden = false;
    sync();
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('fk-theme', next); } catch (e) {}
      sync();
    });
    if (media.addEventListener) media.addEventListener('change', sync);
  }

  // ---------- scroll reveals: one IntersectionObserver, unobserve after first hit ----------
  function initReveal() {
    var els = [].slice.call(document.querySelectorAll('[data-reveal]'));
    if (!('IntersectionObserver' in window) || reduced.matches) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      // Stagger only what enters together, 80 ms apart, capped at six steps.
      var batch = entries.filter(function (e) { return e.isIntersecting; });
      batch.forEach(function (e, i) {
        e.target.style.setProperty('--d', Math.min(i, 5) * 80 + 'ms');
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---------- lightbox on <dialog> ----------
  function initLightbox() {
    var dlg = document.querySelector('.lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') return; // links still open the JPEG
    var img = dlg.querySelector('img');
    var sources = dlg.querySelectorAll('source');
    var cap = dlg.querySelector('.lb-caption');
    var count = dlg.querySelector('.lb-count');
    var prev = dlg.querySelector('.lb-prev');
    var next = dlg.querySelector('.lb-next');
    var group = [], index = 0, opener = null;

    function show(i) {
      index = (i + group.length) % group.length;
      var a = group[index], name = a.getAttribute('data-full');
      var thumb = a.querySelector('img');
      var gif = a.getAttribute('data-gif');
      if (gif) {
        // A clip: the GIF at its native 1280, or its still under reduced motion.
        var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        sources[0].srcset = still ? 'img/' + name + '-1280.avif' : '';
        sources[1].srcset = still ? 'img/' + name + '-1280.webp' : '';
        img.src = still ? 'img/' + name + '-1280.jpg' : gif;
      } else {
        sources[0].srcset = 'img/' + name + '-1920.avif';
        sources[1].srcset = 'img/' + name + '-1920.webp';
        img.src = 'img/' + name + '-1920.jpg';
      }
      img.alt = thumb ? thumb.alt : '';
      cap.textContent = a.getAttribute('data-caption') || '';
      count.textContent = group.length > 1 ? (index + 1) + ' / ' + group.length : '';
      prev.hidden = next.hidden = group.length < 2;
      // restart the open animation for each step
      img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-full]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      var box = a.closest('[data-lightbox-group]');
      group = [].slice.call(box.querySelectorAll('a[data-full]'));
      opener = a;
      show(group.indexOf(a));
      dlg.showModal();
      dlg.querySelector('.lb-close').focus();
    });
    prev.addEventListener('click', function () { show(index - 1); });
    next.addEventListener('click', function () { show(index + 1); });
    dlg.querySelector('.lb-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (group.length < 2) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });
    // click on the dark area outside the image closes
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('lb-stage')) dlg.close(); });
    dlg.addEventListener('close', function () {
      img.removeAttribute('src');
      if (opener) opener.focus();
    });
  }

  // ---------- before/after: upgrade each side-by-side pair to a range-driven slider ----------
  function initSliders() {
    [].forEach.call(document.querySelectorAll('.ba-pair'), function (pair) {
      var after = pair.querySelector('.ba-after');
      var label = pair.getAttribute('data-label') || 'Comparison';
      var handle = document.createElement('div');
      handle.className = 'ba-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.innerHTML = '<span class="ba-knob"><svg viewBox="0 0 20 20"><path d="M7.5 5.5 3 10l4.5 4.5M12.5 5.5 17 10l-4.5 4.5"/></svg></span>';
      var input = document.createElement('input');
      input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '1'; input.value = '50';
      input.className = 'ba-range';
      input.setAttribute('aria-label', label + ': before and after');
      pair.classList.add('is-slider');
      pair.appendChild(handle);
      pair.appendChild(input);
      // Divider position p (0..100 from the left): before shows left of it, after to the right.
      function set(p) {
        after.style.clipPath = 'inset(0 0 0 ' + p + '%)';
        handle.style.transform = 'translateX(' + (pair.clientWidth * p / 100) + 'px)';
        input.setAttribute('aria-valuetext', (100 - p) + '% after');
      }
      input.addEventListener('input', function () { set(+input.value); });
      input.addEventListener('pointerdown', function () { pair.classList.add('is-dragging'); });
      window.addEventListener('pointerup', function () { pair.classList.remove('is-dragging'); });
      if ('ResizeObserver' in window) new ResizeObserver(function () { set(+input.value); }).observe(pair);
      set(50);
    });
  }

  // ---------- review switcher: only with ?motion= or ?review ----------
  function initSwitcher() {
    var nav = document.querySelector('.motion-switch');
    if (!nav || !(params.has('motion') || params.has('review'))) return;
    [].forEach.call(nav.querySelectorAll('a'), function (a) {
      var k = a.getAttribute('data-k'), v = a.getAttribute('data-v');
      var q = new URLSearchParams(location.search);
      q.set(k, v);
      a.href = '?' + q.toString();
      if (v === mode) a.setAttribute('aria-current', 'true');
    });
    nav.hidden = false;
  }

  // ---------- tour (default): cross-fade through five frames; extra frames load after `load` ----------
  // A decorative full-bleed frame with the hero's responsive set, so the browser picks the
  // width by viewport x DPR (a 1920 screen gets the 1920 tier, a phone the 640).
  function picture(name) {
    var set = function (ext) {
      return [640, 1280, 1920].map(function (w) { return 'img/' + name + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', ');
    };
    var pic = document.createElement('picture');
    pic.innerHTML = '<source type="image/avif" srcset="' + set('avif') + '" sizes="100vw">' +
      '<source type="image/webp" srcset="' + set('webp') + '" sizes="100vw">' +
      '<img src="img/' + name + '-1280.jpg" srcset="' + set('jpg') + '" sizes="100vw" alt="" width="1920" height="1080" decoding="async">';
    return pic;
  }
  function loaded(img) {
    return img.complete && img.naturalWidth ? Promise.resolve() : new Promise(function (r) {
      img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true });
    });
  }
  function afterLoad(fn) {
    if (document.readyState === 'complete') fn(); else window.addEventListener('load', fn, { once: true });
  }
  // The hero frame stays first; each frame holds HOLD ms. The tour runs only while the tab is
  // visible and the hero is on screen; pausing freezes the pan (html.tour-paused) and keeps the
  // time left on the current frame.
  var HOLD = 6000;
  function initTour() {
    var media = document.querySelector('.hero-media');
    var first = media.querySelector('.hero-frame');
    first.classList.add('is-active');
    var frames = [first], i = 0, timer = null, due = 0, remaining = HOLD;
    var tabHidden = document.hidden, offscreen = false, stopped = false;

    function sync() {
      var run = !stopped && !tabHidden && !offscreen;
      root.classList.toggle('tour-paused', !run);
      if (run && !timer && frames.length > 1) {
        due = Date.now() + remaining;
        timer = setTimeout(step, remaining);
      } else if (!run && timer) {
        clearTimeout(timer); timer = null;
        remaining = Math.max(0, due - Date.now());
      }
    }
    function step() {
      timer = null; remaining = HOLD;
      var next = frames[(i + 1) % frames.length];
      loaded(next.querySelector('img')).then(function () {
        if (stopped) return;
        var prev = frames[i];
        i = (i + 1) % frames.length;
        // restart the pan on the frame that becomes active
        var im = next.querySelector('img'); im.style.animation = 'none'; void im.offsetWidth; im.style.animation = '';
        next.classList.add('is-active');
        // Later layers stack above earlier ones: fade the new one in over the old, then drop
        // the old. The first frame is the base, so returning to it fades the top layer out.
        if (i === 0) prev.classList.remove('is-active');
        else setTimeout(function () { if (prev !== frames[0]) prev.classList.remove('is-active'); }, 1500);
        sync();
      });
    }
    document.addEventListener('visibilitychange', function () { tabHidden = document.hidden; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { offscreen = !entries[0].isIntersecting; sync(); })
        .observe(document.querySelector('.hero'));
    }
    // Reduced motion switched on mid-visit: back to the static first frame.
    reduced.addEventListener && reduced.addEventListener('change', function () {
      if (!reduced.matches) return;
      stopped = true; sync();
      frames.slice(1).forEach(function (l) { l.remove(); });
      root.classList.remove('tour-paused');
    });

    afterLoad(function () {
      if (stopped) return;
      ['atlas', 'inland', 'capital', 'north'].forEach(function (n) {
        var layer = document.createElement('div');
        layer.className = 'hero-layer';
        layer.setAttribute('aria-hidden', 'true');
        layer.appendChild(picture(n));
        media.appendChild(layer);
        frames.push(layer);
      });
      sync();
    });
  }

  // ---------- atlas: open on the paper atlas, dissolve and scale into the painted view ----------
  function initAtlas() {
    var media = document.querySelector('.hero-media');
    var heroImg = media.querySelector('.hero-frame img');
    var layer = document.createElement('div');
    layer.className = 'atlas-layer';
    layer.setAttribute('aria-hidden', 'true');
    var pic = picture('atlas');
    media.appendChild(layer);
    layer.appendChild(pic);
    var atlasImg = pic.querySelector('img');
    Promise.all([loaded(heroImg), loaded(atlasImg)]).then(function () {
      // hold the paper briefly, then dissolve into the terrain
      setTimeout(function () {
        root.classList.add('atlas-go');
        setTimeout(function () { root.classList.add('atlas-done'); }, 1700);
      }, 500);
    });
  }
})();
