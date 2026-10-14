/* Nam Interior Constructs — progressive enhancement layer.
 *
 * The page is fully server-rendered, so everything in this file is optional:
 * if it fails to load, the site still reads correctly. Each feature is wrapped
 * so one broken piece can never take the others down with it.
 *
 * Note for whoever edits this next: the Content-Security-Policy forbids inline
 * scripts, so this file must stay external. Use event delegation rather than
 * inline `onclick` attributes.
 */

(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /// Runs `fn` at most once per animation frame.
  function rafThrottle(fn) {
    var queued = false;
    return function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; fn(); });
    };
  }

  function safe(name, fn) {
    try { fn(); } catch (err) { console.warn('[nic] ' + name + ' failed:', err); }
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  // The stylesheet already follows the OS preference by default. This only
  // records an explicit override, and it runs as early as possible to keep the
  // flash of the wrong theme as short as it can be.
  safe('theme', function () {
    var STORE_KEY = 'nic-theme';
    var root = document.documentElement;
    var toggle = $('#themeToggle');

    var stored = null;
    try { stored = localStorage.getItem(STORE_KEY); } catch (e) { /* private mode */ }
    if (stored === 'dark' || stored === 'light') root.setAttribute('data-theme', stored);

    function effectiveTheme() {
      var explicit = root.getAttribute('data-theme');
      if (explicit === 'dark' || explicit === 'light') return explicit;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    if (!toggle) return;

    toggle.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(STORE_KEY, next); } catch (e) { /* ignore */ }
      toggle.setAttribute(
        'title',
        next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      );
    });

    toggle.setAttribute(
      'title',
      effectiveTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    );
  });

  // ── Header: scrolled state, progress bar, mobile menu ──────────────────────
  safe('header', function () {
    var header = $('#siteHeader');
    var progress = $('#scrollProgress');
    var toggle = $('#menuToggle');
    var nav = $('#primaryNav');

    function onScroll() {
      var y = window.scrollY || window.pageYOffset || 0;
      if (header) header.classList.toggle('is-scrolled', y > 12);

      if (progress) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        progress.style.transform = 'scaleX(' + pct + ')';
      }
    }

    window.addEventListener('scroll', rafThrottle(onScroll), { passive: true });
    window.addEventListener('resize', rafThrottle(onScroll), { passive: true });
    onScroll();

    if (toggle && nav) {
      var closeMenu = function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
      };

      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      });

      // Any navigation closes the sheet, and so does Escape.
      nav.addEventListener('click', function (e) {
        if (e.target.closest('a')) closeMenu();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
      });
      window.matchMedia('(min-width: 861px)').addEventListener('change', closeMenu);
    }
  });

  // ── Toast ──────────────────────────────────────────────────────────────────
  var toastTimer = null;
  function toast(message, tone) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('toast--err', tone === 'error');
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 5200);
  }

  // ── Gallery filtering ──────────────────────────────────────────────────────
  // The chips are rendered by the server (one per category that actually has
  // published work) and the cards carry `data-category`, so this stays a pure
  // enhancement: with JavaScript off, every project is simply visible.
  safe('filter', function () {
    var bar = $('.filter-bar');
    var gallery = $('#gallery');
    if (!bar || !gallery) return;

    var chips = $$('.chip', bar);
    var cards = $$('.project-card', gallery);
    var empty = $('#galleryEmpty');

    function apply(value, updateUrl) {
      // Ignore an unknown value (e.g. a stale ?category= link) rather than
      // hiding every card and leaving the visitor staring at an empty grid.
      var known = chips.some(function (chip) {
        return chip.getAttribute('data-filter') === value;
      });
      if (!known) value = 'all';

      var shown = 0;
      cards.forEach(function (card) {
        var match = value === 'all' || card.getAttribute('data-category') === value;
        card.classList.toggle('is-hidden', !match);
        if (match) shown++;
      });

      chips.forEach(function (chip) {
        chip.setAttribute('aria-pressed', String(chip.getAttribute('data-filter') === value));
      });

      if (empty) empty.hidden = shown !== 0;

      // Keep a filtered view shareable without a page load.
      if (updateUrl && window.history && history.replaceState) {
        var url = new URL(window.location.href);
        if (value === 'all') url.searchParams.delete('category');
        else url.searchParams.set('category', value);
        history.replaceState(null, '', url);
      }
    }

    bar.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      apply(chip.getAttribute('data-filter'), true);
    });

    // Honour ?category=… on first paint so a shared link lands pre-filtered.
    var initial = new URL(window.location.href).searchParams.get('category');
    if (initial) apply(initial, false);
  });

  // ── Lightbox ───────────────────────────────────────────────────────────────
  safe('lightbox', function () {
    var dialog = $('#lightbox');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    var imgEl = $('#lightboxImg');
    var captionEl = $('#lightboxCaption');
    var counterEl = $('#lightboxCounter');
    var thumbsEl = $('#lightboxThumbs');

    var items = [];
    var index = 0;
    var lastFocused = null;
    var currentTitle = '';

    function readPool(slug) {
      var tpl = $('template[data-gallery="' + slug + '"]');
      if (!tpl) return [];
      return $$('img', tpl.content).map(function (node) {
        return {
          src: node.getAttribute('data-src'),
          srcset: node.getAttribute('data-srcset') || '',
          alt: node.getAttribute('data-alt') || '',
          width: Number(node.getAttribute('data-width')) || null,
          height: Number(node.getAttribute('data-height')) || null,
        };
      });
    }

    function show(i) {
      if (!items.length) return;
      index = (i + items.length) % items.length;
      var item = items[index];

      imgEl.src = item.src;
      if (item.srcset) imgEl.srcset = item.srcset; else imgEl.removeAttribute('srcset');
      imgEl.alt = item.alt;
      if (item.width) imgEl.width = item.width; else imgEl.removeAttribute('width');
      if (item.height) imgEl.height = item.height; else imgEl.removeAttribute('height');

      counterEl.textContent = index + 1 + ' / ' + items.length;

      captionEl.innerHTML = '';
      var strong = document.createElement('strong');
      strong.textContent = currentTitle;
      var span = document.createElement('span');
      span.textContent = 'Photo ' + (index + 1) + ' of ' + items.length;
      captionEl.appendChild(strong);
      captionEl.appendChild(span);

      $$('img', thumbsEl).forEach(function (thumb, n) {
        thumb.setAttribute('aria-current', String(n === index));
      });
      var active = thumbsEl.children[index];
      if (active && active.scrollIntoView) {
        active.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
    }

    function buildThumbs() {
      thumbsEl.innerHTML = '';
      items.forEach(function (item, i) {
        var thumb = document.createElement('img');
        thumb.src = item.src;
        thumb.alt = '';
        thumb.setAttribute('role', 'button');
        thumb.setAttribute('tabindex', '0');
        thumb.setAttribute('aria-label', 'Photo ' + (i + 1) + ' of ' + items.length);
        thumb.addEventListener('click', function () { show(i); });
        thumb.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); }
        });
        thumbsEl.appendChild(thumb);
      });
    }

    function open(slug, startIndex) {
      items = readPool(slug);
      if (!items.length) return;

      // The project title lives on the nearest ancestor that carries it — a
      // `.project-card` on the work index, or the whole gallery section on a
      // project page. Fall back to the only one on the page if neither matches.
      var trigger = $('[data-open-gallery="' + slug + '"]');
      var owner = trigger ? trigger.closest('[data-project-title]') : null;
      if (!owner) owner = $('[data-project-title]');
      currentTitle = owner ? owner.getAttribute('data-project-title') || '' : '';

      lastFocused = document.activeElement;
      buildThumbs();
      dialog.showModal();
      show(startIndex || 0);
      document.documentElement.style.overflow = 'hidden';
    }

    function close() {
      dialog.close();
      document.documentElement.style.overflow = '';
      // Free the decoded full-size image.
      imgEl.removeAttribute('src');
      imgEl.removeAttribute('srcset');
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    // Any element carrying `data-open-gallery` opens the pool for that project.
    // The gallery grid also marks each thumbnail with `data-gallery-index`, so
    // clicking the fifth photo opens the fifth photo; the work-index card has
    // no index and correctly falls back to the first.
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-open-gallery]');
      if (trigger) {
        e.preventDefault();
        var start = Number.parseInt(trigger.getAttribute('data-gallery-index'), 10);
        open(trigger.getAttribute('data-open-gallery'), Number.isFinite(start) ? start : 0);
      }
    });

    $('#lightboxClose').addEventListener('click', close);
    $('#lightboxPrev').addEventListener('click', function () { show(index - 1); });
    $('#lightboxNext').addEventListener('click', function () { show(index + 1); });

    // Clicking the backdrop (outside the inner panel) closes the viewer.
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) close();
    });

    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    });

    // `<dialog>` fires `close` for Escape and for form-method=dialog too.
    dialog.addEventListener('close', function () {
      document.documentElement.style.overflow = '';
    });

    // Swipe on touch devices.
    var startX = null;
    dialog.addEventListener('touchstart', function (e) {
      startX = e.changedTouches[0].clientX;
    }, { passive: true });
    dialog.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var delta = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(delta) > 45) show(index + (delta < 0 ? 1 : -1));
    }, { passive: true });
  });

  // ── Contact form ───────────────────────────────────────────────────────────
  // NOTE: there is deliberately no "pre-fill from a service link" handler any
  // more. The buttons on a service page are plain links to
  // `/contact?service=<id>` and the server pre-selects the option, so the
  // behaviour works with JavaScript disabled too.
  safe('form', function () {
    var form = $('#enquiryForm');
    if (!form) return;

    var status = $('#formStatus');
    var submit = $('#submitBtn');
    var submitLabel = submit.innerHTML;

    var RULES = {
      name: function (v) { return v.length >= 2 ? '' : 'Please tell us your name.'; },
      email: function (v) {
        if (!v) return 'We need an email address to reply to.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'That email address does not look right.';
      },
      phone: function (v) {
        if (!v) return 'A phone number lets us call you back quickly.';
        return v.replace(/[^\d]/g, '').length >= 7 ? '' : 'Please enter a full phone number.';
      },
      message: function (v) { return v.length >= 10 ? '' : 'A sentence or two about the project, please.'; },
    };

    function fieldWrap(name) { return form.querySelector('[data-field="' + name + '"]'); }
    function errorEl(name) { return form.querySelector('[data-error="' + name + '"]'); }

    function setError(name, message) {
      var wrap = fieldWrap(name);
      var el = errorEl(name);
      if (el) el.textContent = message || '';
      if (wrap) wrap.classList.toggle('has-error', Boolean(message));
    }

    function clearErrors() {
      Object.keys(RULES).forEach(function (name) { setError(name, ''); });
      if (status) {
        status.textContent = '';
        status.classList.remove('form-status--ok', 'form-status--err');
      }
    }

    // Validate on blur so the user is not scolded mid-typing, then live-clear.
    Object.keys(RULES).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      input.addEventListener('blur', function () { setError(name, RULES[name](input.value.trim())); });
      input.addEventListener('input', function () {
        if (errorEl(name) && errorEl(name).textContent) setError(name, '');
      });
    });

    function showStatus(message, ok) {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('form-status--ok', Boolean(ok));
      status.classList.toggle('form-status--err', !ok);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();

      var payload = {};
      new FormData(form).forEach(function (value, key) {
        if (typeof value === 'string') payload[key] = value.trim();
      });

      // Honeypot: a real person never sees this field. Stay quiet so bots
      // cannot tell they were detected — the server drops it too.
      if (payload.website) {
        showStatus('Thank you — your enquiry has been received.', true);
        form.reset();
        return;
      }

      var firstBad = null;
      Object.keys(RULES).forEach(function (name) {
        var message = RULES[name]((payload[name] || '').toString());
        if (message) {
          setError(name, message);
          if (!firstBad) firstBad = fieldWrap(name);
        }
      });

      if (firstBad) {
        firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var focusable = firstBad.querySelector('input, textarea, select');
        if (focusable) focusable.focus({ preventScroll: true });
        showStatus('Please check the highlighted fields.', false);
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Sending…';

      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            return { ok: res.ok, status: res.status, body: body };
          });
        })
        .then(function (result) {
          if (result.ok) {
            form.reset();
            clearErrors();
            showStatus(
              result.body.message || 'Thank you — your enquiry has been received. We will be in touch within one working day.',
              true
            );
            toast('Enquiry sent — thank you!');
            if (status) status.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }

          // Surface field-level validation errors from the server.
          var fields = result.body.fields || {};
          var hasFieldError = false;
          Object.keys(fields).forEach(function (name) {
            if (errorEl(name)) { setError(name, fields[name]); hasFieldError = true; }
          });

          if (result.status === 429) {
            showStatus('Too many messages from this device. Please wait a few minutes, or call us directly.', false);
          } else if (hasFieldError) {
            showStatus(result.body.error || 'Please check the highlighted fields.', false);
          } else {
            showStatus(result.body.error || 'We could not send that just now. Please try again, or call us.', false);
          }
        })
        .catch(function () {
          showStatus('Network problem — please check your connection, or call us on the number opposite.', false);
        })
        .finally(function () {
          submit.disabled = false;
          submit.innerHTML = submitLabel;
        });
    });
  });

  // ── Reveal fallback ────────────────────────────────────────────────────────
  // Scroll-driven animations are used where supported. Where they are not, the
  // `@supports` guard in the stylesheet leaves elements visible, so there is
  // deliberately nothing to do here.
})();
