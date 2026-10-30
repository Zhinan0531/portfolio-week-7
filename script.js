/* ============================================================
   Personal Website — interactivity
   - Mobile nav toggle
   - Scroll-spy (active nav link)
   - Reveal-on-scroll animations
   - Footer year
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Mobile nav toggle ---------- */
  var toggle = document.querySelector('.nav__toggle');
  var links = document.querySelector('.nav__links');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close menu when a link is clicked (mobile)
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && links.classList.contains('is-open')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Scroll-spy: highlight active nav link ---------- */
  var navAnchors = Array.prototype.slice.call(
    document.querySelectorAll('.nav__links a')
  );
  var sections = navAnchors
    .map(function (a) {
      var id = a.getAttribute('href');
      return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = entry.target.id;
            navAnchors.forEach(function (a) {
              a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
            });
          }
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealTargets = [
    '.hero__inner',
    '.about',
    '.resume__block',
    '.project',
    '.skills',
    '.favorites',
    '.contact'
  ];
  var revealEls = Array.prototype.slice.call(
    document.querySelectorAll(revealTargets.join(','))
  );

  if ('IntersectionObserver' in window && revealEls.length) {
    revealEls.forEach(function (el) { el.classList.add('reveal'); });

    var revealer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );
    revealEls.forEach(function (el) { revealer.observe(el); });
  }

  /* ---------- Subtle parallax-free smooth anchor (native smooth scroll used) ---------- */
  // Native CSS scroll-behavior handles this; nothing else needed.

  /* ============================================================
     To-Do List App
     - Calendar with month navigation + date selection
     - Add task with the selected date
     - Toggle done (strikethrough) + delete
     - Persisted to localStorage
     ============================================================ */
  (function todoApp() {
    var root = document.getElementById('todoApp');
    if (!root) return;

    var gridEl = document.getElementById('calendarGrid');
    var titleEl = document.getElementById('calendarTitle');
    var selectedDateEl = document.getElementById('selectedDateLabel');
    var inputEl = document.getElementById('todoInput');
    var formEl = document.getElementById('todoForm');
    var listEl = document.getElementById('todoList');
    var emptyEl = document.getElementById('todoEmpty');
    var countEl = document.getElementById('todoCount');

    var MONTHS = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];
    var WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    /* ---------- Supabase config ---------- */
    var SUPABASE_URL = 'https://ehlgeypjbkhufrucwcuq.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_Y7E1lnfj2WltGkhgRceG6g_exhDLMA9';
    var TODO_REST = SUPABASE_URL + '/rest/v1/todos';

    var view = new Date();      // currently-viewed month
    var selected = new Date();  // selected date for new tasks (defaults to today)
    selected.setHours(0, 0, 0, 0);

    var selectedEmoji = '';          // emoji chosen for the next task
    var selectedPriority = 'medium'; // priority chosen for the next task
    var emojiPicker = document.getElementById('emojiPicker');
    var priorityPicker = document.getElementById('priorityPicker');

    var tasks = [];
    var OVERLAY_KEY = 'todoApp.meta.v1'; // local-only: emoji + priority per task id
    var LOCAL_KEY = 'todoApp.tasks.v2';  // local mirror / fallback when Supabase is unreachable
    var overlay = loadOverlay();

    /* ---------- Database (Supabase REST) ---------- */
    function supaHeaders(extra) {
      var h = {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      };
      if (extra) { for (var k in extra) { h[k] = extra[k]; } }
      return h;
    }
    function loadOverlay() {
      try { return JSON.parse(localStorage.getItem(OVERLAY_KEY) || '{}') || {}; }
      catch (e) { return {}; }
    }
    function saveOverlay() {
      try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay)); }
      catch (e) { /* ignore */ }
    }
    // Local mirror — keeps tasks working across refreshes even if Supabase is unreachable.
    function saveLocal() {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(tasks)); }
      catch (e) { /* ignore */ }
    }
    function loadLocal() {
      try {
        var a = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
        return Array.isArray(a) ? a : [];
      } catch (e) { return []; }
    }
    // Map a Supabase row to the app's task shape.
    // DB columns: id, task, "is complete", date, "created at".
    // emoji + priority have no DB column → kept in a localStorage overlay keyed by id.
    function mapRow(r) {
      var m = overlay[r.id] || {};
      return {
        id: r.id,
        text: r.task || '',
        date: r.date || isoKey(new Date()),
        emoji: m.emoji || '',
        priority: m.priority || 'medium',
        done: !!r['is complete'],
        createdAt: r['created at']
      };
    }
    async function dbFetchTasks() {
      var res = await fetch(TODO_REST + '?order=created%20at.asc', {
        headers: supaHeaders()
      });
      if (!res.ok) throw new Error('Load failed (' + res.status + ')');
      var rows = await res.json();
      return rows.map(mapRow);
    }
    async function dbInsert(draft) {
      var res = await fetch(TODO_REST, {
        method: 'POST',
        headers: supaHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify({ task: draft.text, date: draft.date })
      });
      if (!res.ok) throw new Error('Insert failed (' + res.status + ')');
      var rows = await res.json();
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function dbPatch(id, patch) {
      var res = await fetch(TODO_REST + '?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: supaHeaders({ 'Prefer': 'return=minimal' }),
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error('Update failed (' + res.status + ')');
    }
    async function dbDelete(id) {
      var res = await fetch(TODO_REST + '?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: supaHeaders({ 'Prefer': 'return=minimal' })
      });
      if (!res.ok) throw new Error('Delete failed (' + res.status + ')');
    }
    async function refreshTasks() {
      try {
        tasks = await dbFetchTasks();
        saveLocal();
      } catch (e) {
        console.error('Could not load todos from Supabase (using local copy):', e.message);
        tasks = loadLocal();
      }
      renderTasks();
    }

    /* ---------- Date helpers ---------- */
    function startOfDay(d) {
      var c = new Date(d);
      c.setHours(0, 0, 0, 0);
      return c;
    }
    function isSameDay(a, b) {
      return a.getFullYear() === b.getFullYear() &&
             a.getMonth() === b.getMonth() &&
             a.getDate() === b.getDate();
    }
    function fmtDate(d) {
      return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    function fmtDateShort(d) {
      var m = d.getMonth() + 1;
      var day = d.getDate();
      var y = d.getFullYear();
      return m + '/' + day + '/' + y;
    }
    function isoKey(d) {
      function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function daysUntil(d) {
      var today = startOfDay(new Date());
      var target = startOfDay(d);
      return Math.round((target - today) / 86400000);
    }

    /* ---------- Calendar render ---------- */
    function renderCalendar() {
      var year = view.getFullYear();
      var month = view.getMonth();
      titleEl.textContent = MONTHS[month] + ' ' + year;

      var first = new Date(year, month, 1);
      var startWeekday = first.getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var daysInPrev = new Date(year, month, 0).getDate();

      var today = startOfDay(new Date());
      gridEl.innerHTML = '';

      // leading days from previous month
      for (var i = startWeekday - 1; i >= 0; i--) {
        gridEl.appendChild(makeDay(daysInPrev - i, true, null));
      }
      // current month
      for (var d = 1; d <= daysInMonth; d++) {
        var date = new Date(year, month, d);
        gridEl.appendChild(makeDay(d, false, date, today));
      }
      // trailing to fill 6 rows (42 cells)
      var used = startWeekday + daysInMonth;
      var trailing = (7 - (used % 7)) % 7;
      for (var t = 1; t <= trailing; t++) {
        gridEl.appendChild(makeDay(t, true, null));
      }
    }

    function makeDay(num, isOther, date, today) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.textContent = String(num);
      if (isOther) btn.classList.add('is-other');
      if (date) {
        if (today && isSameDay(date, today)) btn.classList.add('is-today');
        if (isSameDay(date, selected)) btn.classList.add('is-selected');
        btn.setAttribute('data-date', isoKey(date));
        btn.setAttribute('aria-label', fmtDate(date));
        btn.addEventListener('click', function () {
          selected = date;
          renderCalendar();
          renderSelected();
        });
      } else {
        btn.setAttribute('aria-disabled', 'true');
        btn.disabled = true;
      }
      return btn;
    }

    function renderSelected() {
      selectedDateEl.textContent = fmtDate(selected) + '  (' + WEEKDAYS[selected.getDay()] + ')';
    }

    /* ---------- Task render ---------- */
    function renderTasks() {
      listEl.innerHTML = '';
      renderCount();
      if (!tasks.length) {
        emptyEl.style.display = '';
        listEl.style.display = 'none';
        return;
      }
      emptyEl.style.display = 'none';
      listEl.style.display = '';

      // sort: incomplete first, then by date
      tasks.sort(function (a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return new Date(a.date) - new Date(b.date);
      });

      tasks.forEach(function (task) {
        listEl.appendChild(makeTaskItem(task));
      });
    }

    function renderCount() {
      var total = tasks.length;
      var done = 0;
      tasks.forEach(function (t) { if (t.done) done++; });
      countEl.textContent = done + ' of ' + total + ' task' + (total === 1 ? '' : 's') + ' completed';
      countEl.classList.toggle('is-complete', total > 0 && done === total);
    }

    function makeTaskItem(task) {
      var li = document.createElement('li');
      li.className = 'todo-item' + (task.done ? ' is-done' : '');
      li.setAttribute('data-id', task.id);

      // checkbox
      var check = document.createElement('button');
      check.type = 'button';
      check.className = 'todo-item__check';
      check.setAttribute('aria-label', task.done ? 'Mark as not done' : 'Mark as done');
      check.setAttribute('aria-pressed', task.done ? 'true' : 'false');
      check.addEventListener('click', function () {
        task.done = !task.done;
        saveLocal();
        renderTasks();
        dbPatch(task.id, { 'is complete': task.done }).catch(function (e) {
          task.done = !task.done; saveLocal(); renderTasks(); console.error(e);
        });
      });

      // body
      var body = document.createElement('div');
      body.className = 'todo-item__body';

      // top row: emoji + text
      var top = document.createElement('div');
      top.className = 'todo-item__top';
      var emoji = task.emoji || '';
      if (emoji) {
        var emojiEl = document.createElement('span');
        emojiEl.className = 'todo-item__emoji';
        emojiEl.textContent = emoji;
        top.appendChild(emojiEl);
      }
      var text = document.createElement('span');
      text.className = 'todo-item__text';
      text.textContent = task.text;
      text.title = 'Click to edit';
      text.addEventListener('click', function () { editTask(task, text); });
      top.appendChild(text);

      // meta row: date + priority badge
      var meta = document.createElement('div');
      meta.className = 'todo-item__meta';

      var dateEl = document.createElement('span');
      var d = new Date(task.date);
      dateEl.className = 'todo-item__date';
      var diff = daysUntil(d);
      var label = fmtDateShort(d) + ' (' + WEEKDAYS[d.getDay()] + ')';
      if (!task.done && diff === 0) { label += ' · Today'; dateEl.classList.add('is-soon'); }
      else if (!task.done && diff === 1) { label += ' · Tomorrow'; dateEl.classList.add('is-soon'); }
      else if (!task.done && diff > 1 && diff <= 3) { label += ' · in ' + diff + ' days'; dateEl.classList.add('is-soon'); }
      else if (!task.done && diff < 0) { label += ' · Overdue'; dateEl.classList.add('is-soon'); }
      dateEl.textContent = label;
      meta.appendChild(dateEl);

      var pri = task.priority || 'medium';
      var priEl = document.createElement('span');
      priEl.className = 'todo-item__pri';
      priEl.setAttribute('data-priority', pri);
      priEl.textContent = pri;
      meta.appendChild(priEl);

      body.appendChild(top);
      body.appendChild(meta);

      // delete
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'todo-item__delete';
      del.setAttribute('aria-label', 'Delete task');
      del.textContent = '×';
      del.addEventListener('click', function () {
        var idx = tasks.findIndex(function (t) { return t.id === task.id; });
        if (idx > -1) {
          tasks.splice(idx, 1);
          delete overlay[task.id];
          saveOverlay();
          saveLocal();
          renderTasks();
          dbDelete(task.id).catch(function (e) {
            console.error(e); refreshTasks();
          });
        }
      });

      li.appendChild(check);
      li.appendChild(body);
      li.appendChild(del);
      return li;
    }

    /* ---------- Inline edit ---------- */
    function editTask(task, span) {
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'todo-item__edit-input';
      input.value = task.text;
      input.setAttribute('aria-label', 'Edit task');
      span.replaceWith(input);
      input.focus();
      input.select();

      var finished = false;
      function finish(saveChanges) {
        if (finished) return;
        finished = true;
        document.removeEventListener('mousedown', onOutsideClick, true);
        if (saveChanges) {
          var v = input.value.trim();
          if (v && v !== task.text) {
            var prev = task.text;
            task.text = v;
            saveLocal();
            dbPatch(task.id, { task: v }).catch(function (e) {
              task.text = prev; saveLocal(); renderTasks(); console.error(e);
            });
          }
        }
        renderTasks();
      }
      function onOutsideClick(e) {
        if (e.target !== input && !input.contains(e.target)) {
          finish(true);
        }
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', function () { finish(true); });
      document.addEventListener('mousedown', onOutsideClick, true);
    }

    /* ---------- Add task ---------- */
    async function addTask(text) {
      var trimmed = (text || '').trim();
      if (!trimmed) return;
      inputEl.value = '';
      inputEl.focus();
      var draft = {
        text: trimmed,
        date: isoKey(selected),
        emoji: selectedEmoji,
        priority: selectedPriority,
        done: false
      };
      try {
        var created = await dbInsert(draft);
        if (created) {
          overlay[created.id] = { emoji: selectedEmoji, priority: selectedPriority };
          saveOverlay();
          // mapRow() ran inside dbInsert before the overlay entry existed, so
          // emoji/priority defaulted to ''/'medium' — restore the chosen values.
          created.emoji = selectedEmoji;
          created.priority = selectedPriority;
          tasks.push(created);
          saveLocal();
        }
      } catch (e) {
        console.error('Supabase insert failed (kept locally):', e.message);
        tasks.push(Object.assign(
          { id: 'local-' + Date.now(), createdAt: new Date().toISOString() },
          draft
        ));
        saveLocal();
      }
      renderTasks();
    }

    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      addTask(inputEl.value);
    });

    /* ---------- Emoji picker ---------- */
    if (emojiPicker) {
      emojiPicker.addEventListener('click', function (e) {
        var btn = e.target.closest('.emoji-opt');
        if (!btn) return;
        selectedEmoji = btn.getAttribute('data-emoji') || '';
        Array.prototype.forEach.call(
          emojiPicker.querySelectorAll('.emoji-opt'),
          function (b) { b.classList.toggle('is-active', b === btn); }
        );
      });
    }

    /* ---------- Priority picker ---------- */
    if (priorityPicker) {
      priorityPicker.addEventListener('click', function (e) {
        var btn = e.target.closest('.pri-opt');
        if (!btn) return;
        selectedPriority = btn.getAttribute('data-priority') || 'medium';
        Array.prototype.forEach.call(
          priorityPicker.querySelectorAll('.pri-opt'),
          function (b) { b.classList.toggle('is-active', b === btn); }
        );
      });
    }

    /* ---------- Month navigation ---------- */
    root.querySelectorAll('.calendar__nav').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.getAttribute('data-dir');
        view.setMonth(view.getMonth() + (dir === 'next' ? 1 : -1));
        renderCalendar();
      });
    });

    /* ---------- Init ---------- */
    renderCalendar();
    renderSelected();
    refreshTasks();
  })();

  /* ============================================================
     Weather App
     - Search a city against the UAPI Weather API
     - Loading / not-found / empty-input messages
     - Shows city, temperature, conditions and an icon
     ============================================================ */
  (function weatherApp() {
    var root = document.getElementById('weatherApp');
    if (!root) return;

    var formEl = document.getElementById('weatherForm');
    var inputEl = document.getElementById('weatherInput');
    var resultEl = document.getElementById('weatherResult');

    var API = 'https://uapis.cn/api/v1/misc/weather';
    var NOT_FOUND = 'Couldn\u2019t find that city \u2014 check the spelling.';
    var GENERIC_ERR = 'Something went wrong \u2014 please try again.';

    function showMessage(text, kind) {
      resultEl.innerHTML = '';
      var p = document.createElement('p');
      p.className = 'weather-result__msg' + (kind ? ' is-' + kind : '');
      p.textContent = text;
      resultEl.appendChild(p);
    }

    // Best-effort guard against meaningless inputs so we don't spam the API
    // with garbage the UAPI would happily fuzzy-match into some random city.
    function isValidCityInput(raw) {
      var city = (raw || '').trim();
      // After trim, must have at least 2 chars (rejects "a", single punct, etc.)
      if (city.length < 2) return false;
      // Reject purely non-word characters (punct/whitespace only)
      if (!/[\p{L}\p{N}]/u.test(city)) return false;

      // Letter-only input heuristic (covers "abcd", "zzzz", etc.):
      // all letters, no spaces, no capitals, no separators, and short.
      var letterOnly = /^[a-z]+$/.test(city);
      if (letterOnly && city.length < 5) return false;

      // Extreme repetition — e.g. "aaaaaa", "zzzzz"
      var uniqueChars = {};
      for (var i = 0; i < city.length; i++) uniqueChars[city[i]] = true;
      if (city.length >= 4 && Object.keys(uniqueChars).length / city.length < 0.3) return false;

      return true;
    }

    // Romanized city names that collide across different cities. The UAPI
    // fuzzy-matches pinyin, so "Suzhou" resolves to 宿州 (Anhui) instead of the
    // far more common 苏州 (Jiangsu). For these we send the Chinese name and let
    // the user switch between the same-spelling cities. First entry = preferred.
    var CITY_ALIASES = {
      'suzhou': [{ name: '苏州', note: '江苏' }, { name: '宿州', note: '安徽' }],
      'fuzhou': [{ name: '福州', note: '福建' }, { name: '抚州', note: '江西' }],
      'taizhou': [{ name: '台州', note: '浙江' }, { name: '泰州', note: '江苏' }],
      'yulin': [{ name: '榆林', note: '陕西' }, { name: '玉林', note: '广西' }],
      'yichun': [{ name: '宜春', note: '江西' }, { name: '伊春', note: '黑龙江' }]
    };

    function lookupAliases(input) {
      var key = (input || '').trim().toLowerCase().replace(/[\s\-]+/g, '');
      return Object.prototype.hasOwnProperty.call(CITY_ALIASES, key) ? CITY_ALIASES[key] : null;
    }

    // Map a UAPI weather_icon code (falling back to the condition text) to an emoji.
    function weatherIcon(code, text) {
      var c = parseInt(code, 10);
      var t = text || '';
      if (!isNaN(c)) {
        if (c === 100) return '\u2600\uFE0F';                             // 晴
        if (c === 150) return '\uD83C\uDF19';                             // 晴（夜）
        if (c === 101 || c === 102 || c === 103) return '\u26C5';         // 多云 / 少云
        if (c === 104 || (c >= 151 && c <= 153)) return '\u2601\uFE0F';   // 阴 / 夜间
        if (c >= 300 && c <= 399) {                                       // 雨
          if (c === 313) return '\uD83C\uDF28\uFE0F';                     // 冻雨
          return c <= 304 ? '\uD83C\uDF26\uFE0F' : '\uD83C\uDF27\uFE0F';  // 小雨 / 中大雨
        }
        if (c >= 400 && c <= 499) {                                       // 雪
          return c <= 406 ? '\uD83C\uDF28\uFE0F' : '\u2744\uFE0F';
        }
        if (c >= 500 && c <= 515) return '\uD83C\uDF2B\uFE0F';            // 雾 / 霾
        if (c === 900) return '\uD83E\uDD75';                             // 热
        if (c === 901) return '\uD83E\uDD76';                             // 冷
      }
      if (/雷/.test(t)) return '\u26C8\uFE0F';
      if (/雪/.test(t)) return '\uD83C\uDF28\uFE0F';
      if (/雨/.test(t)) return '\uD83C\uDF27\uFE0F';
      if (/雾|霾/.test(t)) return '\uD83C\uDF2B\uFE0F';
      if (/晴/.test(t)) return '\u2600\uFE0F';
      if (/云/.test(t)) return '\u26C5';
      return '\uD83C\uDF21\uFE0F';
    }

    // Buttons letting the user switch between cities that share one romanized
    // spelling (e.g. 苏州 vs 宿州), since pinyin alone cannot tell them apart.
    function buildAliasChooser(aliases, currentCity) {
      var wrap = document.createElement('div');
      wrap.className = 'weather-aliases';

      var label = document.createElement('p');
      label.className = 'weather-aliases__label';
      label.textContent = 'Same name, different city?';
      wrap.appendChild(label);

      var row = document.createElement('div');
      row.className = 'weather-aliases__row';

      aliases.forEach(function (a) {
        var isCurrent = !!currentCity && currentCity.indexOf(a.name) === 0;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'weather-aliases__btn' + (isCurrent ? ' is-active' : '');
        btn.textContent = a.name + '\uFF08' + a.note + '\uFF09';
        if (!isCurrent) {
          btn.addEventListener('click', function () {
            inputEl.value = a.name;
            search(a.name, aliases);
          });
        } else {
          btn.disabled = true;
        }
        row.appendChild(btn);
      });

      wrap.appendChild(row);
      return wrap;
    }

    function showWeather(data, aliases) {
      var temp = Number(data.temperature);
      var tempText = isFinite(temp) ? Math.round(temp) + '\u00B0C' : '\u2014';

      resultEl.innerHTML = '';

      var card = document.createElement('div');
      card.className = 'weather-card';

      var iconEl = document.createElement('div');
      iconEl.className = 'weather-card__icon';
      iconEl.setAttribute('aria-hidden', 'true');
      iconEl.textContent = weatherIcon(data.weather_icon, data.weather);

      var info = document.createElement('div');
      info.className = 'weather-card__info';

      var cityEl = document.createElement('p');
      cityEl.className = 'weather-card__city';
      cityEl.textContent = data.city || '';

      var tempEl = document.createElement('p');
      tempEl.className = 'weather-card__temp';
      tempEl.textContent = tempText;

      var condEl = document.createElement('p');
      condEl.className = 'weather-card__cond';
      condEl.textContent = data.weather || '';

      info.appendChild(cityEl);
      info.appendChild(tempEl);
      info.appendChild(condEl);
      card.appendChild(iconEl);
      card.appendChild(info);
      resultEl.appendChild(card);

      if (aliases && aliases.length > 1) {
        resultEl.appendChild(buildAliasChooser(aliases, data.city || ''));
      }
    }

    async function search(city, aliases) {
      showMessage('Loading\u2026', 'loading');
      try {
        var res = await fetch(API + '?city=' + encodeURIComponent(city));
        if (res.status === 404 || res.status === 400) {
          showMessage(NOT_FOUND, 'error');
          return;
        }
        if (res.status === 429) {
          showMessage('Too many searches \u2014 please wait a moment and try again.', 'error');
          return;
        }
        if (!res.ok) {
          showMessage(GENERIC_ERR, 'error');
          return;
        }
        var data = await res.json();
        if (!data || !data.city) {
          showMessage(NOT_FOUND, 'error');
          return;
        }
        showWeather(data, aliases);
      } catch (e) {
        // fetch() throws on network/CORS failures. The UAPI service rejects the
        // Origin: null sent by file:// pages, so it only works over http(s).
        if (location.protocol === 'file:') {
          showMessage('Open this site with a local server (e.g. http://localhost:8000) \u2014 the weather service is blocked when the page is opened as a file.', 'error');
        } else {
          showMessage(GENERIC_ERR, 'error');
        }
      }
    }

    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var city = (inputEl.value || '').trim();
      if (!city) {
        showMessage('Enter a city first.', 'error');
        inputEl.focus();
        return;
      }
      if (!isValidCityInput(city)) {
        showMessage('That doesn\u2019t look like a city name \u2014 try again.', 'error');
        return;
      }
      // Pinyin can collide across cities; search the preferred Chinese name and
      // let the user switch to the other same-spelling city from the result.
      var aliases = lookupAliases(city);
      search(aliases ? aliases[0].name : city, aliases);
    });
  })();

  /* ============================================================
     Contact Form
     - Submits name / email / message to Supabase (contacts table)
     ============================================================ */
  (function contactForm() {
    var form = document.querySelector('.contact-form');
    if (!form) return;

    var SUPABASE_URL = 'https://wuuraoasucoeluvnmvij.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_T923xMxpaxKw62LkUhEXzQ_e8OT2sha';
    var CONTACTS_REST = SUPABASE_URL + '/rest/v1/contacts';

    var nameEl = document.getElementById('contact-name');
    var emailEl = document.getElementById('contact-email');
    var messageEl = document.getElementById('contact-message');
    var statusEl = document.getElementById('contactStatus');
    var submitBtn = form.querySelector('button[type="submit"]');

    function showStatus(msg, type) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = 'contact-form__status' +
        (type ? ' contact-form__status--' + type : '');
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var name = (nameEl.value || '').trim();
      var email = (emailEl.value || '').trim();
      var message = (messageEl.value || '').trim();
      if (!name || !email || !message) return;

      submitBtn.disabled = true;
      showStatus('Sending\u2026', '');
      try {
        var res = await fetch(CONTACTS_REST, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          // contacts.created_at is NOT NULL without a DB default — send it explicitly
          body: JSON.stringify({
            name: name,
            email: email,
            message: message,
            created_at: new Date().toISOString()
          })
        });
        if (!res.ok) throw new Error('Send failed (' + res.status + ')');
        form.reset();
        showStatus('Message sent \u2014 thank you! I\u2019ll get back to you soon.', 'success');
      } catch (err) {
        console.error('Contact form submit failed:', err);
        showStatus('Sorry, something went wrong. Please try again or email me directly.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  })();
})();
