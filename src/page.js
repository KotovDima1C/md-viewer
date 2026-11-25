// Единственный скрипт страницы. Встраивается с nonce; скрипты из самого .md режет CSP.
(function () {
  var root = document.documentElement;

  // Ошибки скриптов страницы — в журнал программы (%LOCALAPPDATA%\md-viewer\errors.log)
  function report(msg) { try { chrome.webview.postMessage('error:' + msg); } catch (e) { } }
  window.addEventListener('error', function (e) {
    report(e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno + ':' + e.colno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    report('promise: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason));
  });
  window.addEventListener('securitypolicyviolation', function (e) {
    report('CSP: ' + e.violatedDirective + ' ' + e.blockedURI + ' ' + (e.sourceFile || '').split('/').pop() + ':' + e.lineNumber);
  });

  // ---------- Переключатель темы: 🌙 ☀️ ⚙️ ----------
  document.querySelectorAll('.theme-toggle button').forEach(function (b) {
    b.addEventListener('click', function () {
      var mode = b.getAttribute('data-mode');
      root.setAttribute('data-theme-mode', mode);
      chrome.webview.postMessage(mode); // окно меняет тему движка, заголовок и запоминает выбор
    });
  });

  // ---------- Диаграммы Mermaid (mermaid.js подключается, только если есть ```mermaid) ----------
  // Markdig сам превращает ```mermaid в <div class="mermaid">; на всякий случай берём и code.language-mermaid.
  // window.mermaid проверяем на initialize: заголовок с id="mermaid" тоже виден как window.mermaid.
  var M = window.mermaid && typeof window.mermaid.initialize === 'function' ? window.mermaid : null;
  if (M) {
    var diagrams = [];
    document.querySelectorAll('.markdown-body .mermaid, pre > code.language-mermaid').forEach(function (el) {
      var host = el.tagName === 'CODE' ? el.parentNode : el;
      var box = document.createElement('div');
      box.className = 'mermaid-box';
      diagrams.push({ box: box, src: el.textContent });
      host.replaceWith(box);
    });
    var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    var seq = 0;
    // Своя палитра вместо стандартных тем: насыщенные цвета средней яркости читаются на обоих фонах
    var PALETTE = ['#4f8ef7', '#e5487a', '#22b8a0', '#f5a524', '#9b6cf2', '#ef6f4b',
      '#3fb6e0', '#7cb342', '#d45fbf', '#c9a227', '#5c7cfa', '#e86a92'];
    var themeVars = function (dark) {
      var ui = dark
        ? { bg: '#0d1117', fg: '#e6edf3', muted: '#9198a1', node: '#1b2433', border: '#4b5a70', soft: '#151b23', alt: '#0d1117', grid: '#30363d', note: '#2a2414' }
        : { bg: '#ffffff', fg: '#1f2328', muted: '#59636e', node: '#eef3fb', border: '#8aa1c1', soft: '#f6f8fa', alt: '#ffffff', grid: '#d1d9e0', note: '#fff8e1' };
      var v = {
        darkMode: dark, background: ui.bg, fontSize: '15px',
        // блок-схемы, последовательности, классы, состояния
        primaryColor: ui.node, primaryBorderColor: ui.border, primaryTextColor: ui.fg,
        secondaryColor: dark ? '#2a1b2e' : '#fbeef3', secondaryBorderColor: '#e5487a', secondaryTextColor: ui.fg,
        tertiaryColor: ui.soft, tertiaryBorderColor: ui.grid, tertiaryTextColor: ui.fg,
        lineColor: ui.muted, textColor: ui.fg, mainBkg: ui.node, nodeBorder: ui.border,
        clusterBkg: ui.soft, clusterBorder: ui.grid, edgeLabelBackground: ui.bg,
        actorBkg: ui.node, actorBorder: ui.border, actorTextColor: ui.fg, actorLineColor: ui.grid,
        signalColor: ui.fg, signalTextColor: ui.fg, labelBoxBkgColor: ui.node, labelBoxBorderColor: ui.border,
        labelTextColor: ui.fg, loopTextColor: ui.fg, noteBkgColor: ui.note, noteBorderColor: '#f5a524', noteTextColor: ui.fg,
        activationBkgColor: ui.soft, activationBorderColor: ui.border,
        // круговая
        pieStrokeColor: ui.bg, pieStrokeWidth: '2px', pieOuterStrokeColor: ui.grid, pieOuterStrokeWidth: '1px',
        pieOpacity: '1', pieTitleTextColor: ui.fg, pieTitleTextSize: '20px',
        pieSectionTextColor: '#ffffff', pieSectionTextSize: '15px', pieLegendTextColor: ui.fg, pieLegendTextSize: '15px',
        // Ганта: обычные задачи синие, готовые бирюзовые, текущие ягодные, критичные оранжевые
        sectionBkgColor: ui.soft, sectionBkgColor2: ui.soft, altSectionBkgColor: ui.alt, gridColor: ui.grid,
        taskBkgColor: '#4f8ef7', taskBorderColor: '#3b78e0', taskTextColor: '#ffffff', taskTextLightColor: '#ffffff',
        taskTextDarkColor: '#ffffff', taskTextOutsideColor: ui.fg, taskTextClickableColor: ui.fg,
        doneTaskBkgColor: '#22b8a0', doneTaskBorderColor: '#1a9985',
        activeTaskBkgColor: '#e5487a', activeTaskBorderColor: '#cc3366',
        critBkgColor: '#ef6f4b', critBorderColor: '#d9572f',
        todayLineColor: '#f5a524', titleColor: ui.fg, sectionTextColor: ui.fg,
      };
      PALETTE.forEach(function (c, i) { v['pie' + (i + 1)] = c; v['cScale' + i] = c; });
      return v;
    };
    var renderDiagrams = function () {
      M.initialize({
        startOnLoad: false,
        securityLevel: 'strict', // без HTML и обработчиков кликов из файла
        theme: 'base',
        themeVariables: themeVars(darkQuery.matches),
        fontFamily: '"Segoe UI Variable Text", "Segoe UI", sans-serif',
        gantt: { fontSize: 14, sectionFontSize: 14, barHeight: 28, barGap: 6, topPadding: 56, leftPadding: 120, gridLineStartPadding: 40, axisFormat: '%d.%m' },
      });
      diagrams.forEach(function (d) {
        var id = 'mmd-' + (++seq);
        M.render(id, d.src).then(function (r) {
          d.box.classList.remove('mermaid-error');
          mountDiagram(d, r.svg);
          window.dispatchEvent(new Event('resize')); // высота страницы поменялась — пересчитать оглавление
        }).catch(function (e) {
          var junk = document.getElementById('d' + id); // mermaid оставляет черновик при ошибке
          if (junk) junk.remove();
          d.svg = null;
          d.box.classList.add('mermaid-error');
          d.box.textContent = 'Ошибка в диаграмме Mermaid: ' + ((e && e.message) || e);
          var pre = document.createElement('pre');
          pre.textContent = d.src;
          d.box.appendChild(pre);
        });
      });
    };
    // Диаграмма показывается в натуральную величину (scale = 1), блок занимает всю ширину окна,
    // а если и её мало — прокрутка. Масштаб: кнопки, Ctrl+колесо над диаграммой, двойной клик.
    var MIN = 0.2, MAX = 4;
    var mountDiagram = function (d, svgText) {
      d.box.innerHTML =
        '<div class="mmd-tools">' +
        '<button type="button" data-z="out" title="Уменьшить (Ctrl+колесо)">−</button>' +
        '<button type="button" data-z="one" class="mmd-pct" title="Натуральный размер">100%</button>' +
        '<button type="button" data-z="in" title="Увеличить (Ctrl+колесо)">+</button>' +
        '<button type="button" data-z="fit" title="Вписать по ширине">↔</button></div>' +
        '<div class="mmd-scroll">' + svgText + '</div>';
      var scroller = d.box.querySelector('.mmd-scroll');
      var svg = scroller.querySelector('svg');
      var vb = svg.viewBox && svg.viewBox.baseVal;
      d.w = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
      d.h = vb && vb.height ? vb.height : svg.getBoundingClientRect().height;
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.maxWidth = 'none';
      d.svg = svg;
      d.scroller = scroller;
      applyScale(d, d.scale || 1);
      if (d.wired) return;     // после смены темы обработчики уже висят на блоке
      d.wired = true;
      d.box.addEventListener('click', function (e) {
        var b = e.target.closest('.mmd-tools button');
        if (!b) return;
        var z = b.getAttribute('data-z');
        if (z === 'in') zoomAt(d, d.scale * 1.25);
        else if (z === 'out') zoomAt(d, d.scale / 1.25);
        else if (z === 'one') zoomAt(d, 1);
        else fit(d);
      });
      d.box.addEventListener('dblclick', function (e) {
        if (e.target.closest('.mmd-tools')) return;
        if (Math.abs(d.scale - 1) < 0.01) fit(d); else zoomAt(d, 1, e.clientX);
      });
      d.box.addEventListener('wheel', function (e) {
        if (!e.ctrlKey) return;      // обычное колесо — прокрутка страницы
        e.preventDefault();          // Ctrl+колесо над диаграммой масштабирует её, а не страницу
        zoomAt(d, d.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX);
      }, { passive: false });
      // Перетаскивание мышью: по горизонтали двигает диаграмму, по вертикали — страницу
      var drag = null;
      d.box.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || e.target.closest('.mmd-tools')) return;
        drag = { x: e.clientX, y: e.clientY, sl: d.scroller.scrollLeft, sy: window.scrollY, moved: false };
        d.box.setPointerCapture(e.pointerId);
      });
      d.box.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        drag.moved = true;
        d.box.classList.add('mmd-dragging');
        d.scroller.scrollLeft = drag.sl - dx;
        window.scrollTo(window.scrollX, drag.sy - dy);
      });
      var stop = function () { drag = null; d.box.classList.remove('mmd-dragging'); };
      d.box.addEventListener('pointerup', stop);
      d.box.addEventListener('pointercancel', stop);
    };
    var applyScale = function (d, s) {
      d.scale = Math.min(MAX, Math.max(MIN, s));
      d.svg.style.width = Math.round(d.w * d.scale) + 'px';
      d.svg.style.height = Math.round(d.h * d.scale) + 'px';
      d.box.querySelector('.mmd-pct').textContent = Math.round(d.scale * 100) + '%';
      d.box.classList.toggle('mmd-wide', d.w * d.scale > d.scroller.clientWidth + 1);
    };
    var zoomAt = function (d, s, clientX) {
      // Точка под курсором (или центр) остаётся на месте
      var rect = d.scroller.getBoundingClientRect();
      var x = clientX === undefined ? rect.width / 2 : clientX - rect.left;
      var old = d.scale, contentX = d.scroller.scrollLeft + x;
      applyScale(d, s);
      d.scroller.scrollLeft = contentX * (d.scale / old) - x;
      window.dispatchEvent(new Event('resize'));
    };
    var fit = function (d) {
      zoomAt(d, Math.min(2, (d.scroller.clientWidth - 8) / d.w));
    };
    window.addEventListener('resize', function () {
      diagrams.forEach(function (d) { if (d.svg) applyScale(d, d.scale); });
    });

    renderDiagrams();
    darkQuery.addEventListener('change', renderDiagrams); // сменили тему — перерисовать в новых цветах
  }

  // ---------- Подсветка синтаксиса (highlight.js подключается, только если есть код с языком) ----------
  if (window.hljs) {
    // Частые названия языков из .md, которых нет в highlight.js как псевдонимов
    hljs.registerAliases(['bsl', 'os', '1с', 'onec'], { languageName: '1c' });
    hljs.registerAliases(['ps', 'ps1', 'pwsh'], { languageName: 'powershell' });
    hljs.registerAliases(['bat', 'cmd'], { languageName: 'dos' });
    hljs.configure({ ignoreUnescapedHTML: true });
    document.querySelectorAll('pre code[class*="language-"]').forEach(function (el) {
      var m = /language-(\S+)/.exec(el.className);
      var lang = m && hljs.getLanguage(m[1]);
      if (!lang) return; // неизвестный язык — оставить как есть
      try {
        hljs.highlightElement(el);
        if (/^1C/i.test(lang.name || '')) { // 1С — раскраска как в Конфигураторе
          el.parentNode.classList.add('code-1c');
          mark1c(el);
        }
      } catch (e) { }
    });
  }

  // Доразметка 1С поверх highlight.js: слова объявлений — ключевые, знаки и скобки — операторы
  // (в Конфигураторе и те и другие красные). Строки, комментарии и директивы не трогаем.
  function mark1c(code) {
    var L = '0-9A-Za-zА-Яа-яЁё_';
    var re = new RegExp('(^|[^' + L + '])(Процедура|Функция|КонецПроцедуры|КонецФункции|Экспорт|Перем|Знач|Асинх|Ждать)(?![' + L + '])' +
      '|([=+\\-*/<>;(),.?\\[\\]%:])', 'gi');
    var walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) {
      var n = walker.currentNode;
      if (n.parentNode.closest('.hljs-string, .hljs-comment, .hljs-meta, .hljs-keyword, .hljs-number')) continue;
      re.lastIndex = 0;
      if (re.test(n.nodeValue)) nodes.push(n);
    }
    nodes.forEach(function (n) {
      var s = n.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        var word = m[2] || m[3], start = m.index + (m[2] ? m[1].length : 0);
        frag.appendChild(document.createTextNode(s.slice(last, start)));
        var span = document.createElement('span');
        span.className = m[2] ? 'hljs-keyword' : 'op';
        span.textContent = word;
        frag.appendChild(span);
        last = start + word.length;
      }
      frag.appendChild(document.createTextNode(s.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  }

  // ---------- Широкие таблицы ----------
  // Каждая таблица — в обёртке с прокруткой; содержимое ячеек — в .cell с потолком ширины
  // (у таблиц max-width на самих ячейках не работает). Если таблице с такими колонками тесно
  // в колонке текста — обёртка раскрывается на всю ширину окна; там браузер сам сузит колонки
  // до допустимого минимума, а дальше включится прокрутка.
  var tableWraps = [];
  document.querySelectorAll('.markdown-body table').forEach(function (t) {
    t.querySelectorAll('th, td').forEach(function (c) {
      var inner = document.createElement('div');
      var text = c.textContent.trim();
      inner.className = text.length > 40 ? 'cell cell-long' : 'cell';
      // Число (в том числе «1 240», «3 972,7», «-5%») — без переноса и по правому краю, как в отчётах
      if (c.tagName === 'TD' && /^[-+−]?[\d\s  ]+([.,]\d+)?\s?%?$/.test(text) && /\d/.test(text)) c.classList.add('num');
      while (c.firstChild) inner.appendChild(c.firstChild);
      c.appendChild(inner);
    });
    var wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    t.parentNode.insertBefore(wrap, t);
    wrap.appendChild(t);
    tableWraps.push(wrap);
  });
  var layoutTables = function () {
    var article = document.querySelector('.markdown-body');
    if (!article) return;
    var column = article.clientWidth;
    tableWraps.forEach(function (w) {
      var t = w.firstChild;
      t.style.width = 'max-content';           // естественная ширина с учётом потолков колонок
      var natural = t.offsetWidth;
      t.style.width = '';
      w.classList.toggle('table-wide', natural > column + 1);
      w.classList.toggle('table-compact', natural < column / 2); // совсем узкую не растягиваем — пустота посередине
    });  };
  if (tableWraps.length) {
    layoutTables();
    var tablesPending = false;
    window.addEventListener('resize', function () {
      if (tablesPending) return;
      tablesPending = true;
      requestAnimationFrame(function () { tablesPending = false; layoutTables(); });
    });
  }

  // ---------- Оглавление и переключатель темы поверх широкой схемы — полупрозрачные ----------
  var overlapPending = false;
  var checkOverlap = function () {
    overlapPending = false;
    var boxes = document.querySelectorAll('.mermaid-box:not(.mermaid-error), .table-wrap.table-wide');
    [document.querySelector('.theme-toggle'), document.querySelector('.toc')].forEach(function (f) {
      if (!f) return;
      var r = f.getBoundingClientRect(), over = false;
      for (var i = 0; i < boxes.length && !over; i++) {
        var b = boxes[i].getBoundingClientRect();
        over = b.top < r.bottom && b.bottom > r.top && b.left < r.right && b.right > r.left;
      }
      f.classList.toggle('over-diagram', over);
    });
  };
  var scheduleOverlap = function () {
    if (overlapPending || !document.querySelector('.mermaid-box, .table-wrap.table-wide')) return;
    overlapPending = true;
    requestAnimationFrame(checkOverlap);
  };
  window.addEventListener('scroll', scheduleOverlap, { passive: true });
  window.addEventListener('resize', scheduleOverlap); // в том числе после отрисовки схем

  // ---------- Оглавление: полоски слева, при наведении — список ----------
  var heads = Array.prototype.filter.call(
    document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3'),
    function (h) { return h.id && h.textContent.trim(); });
  if (heads.length < 2) return;

  var top = Math.min.apply(null, heads.map(function (h) { return +h.tagName.charAt(1); }));
  var toc = document.createElement('nav');
  toc.className = 'toc';
  toc.setAttribute('aria-label', 'Оглавление');
  var rail = document.createElement('div');
  rail.className = 'toc-rail';
  var panel = document.createElement('div');
  panel.className = 'toc-panel';
  var bars = [], links = [];

  heads.forEach(function (h) {
    var level = 'l' + (+h.tagName.charAt(1) - top); // l0 — верхний уровень документа
    var bar = document.createElement('span');
    bar.className = 'toc-bar ' + level;
    rail.appendChild(bar);
    bars.push(bar);

    var a = document.createElement('a');
    a.className = 'toc-link ' + level;
    a.href = '#' + h.id;
    a.textContent = h.textContent.trim();
    a.title = a.textContent;
    var index = links.length;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      picked = index; // в конце документа подсвечивать выбранный раздел, а не последний
      a.blur();       // иначе карточка остаётся открытой из-за фокуса
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      schedule();
    });
    panel.appendChild(a);
    links.push(a);
  });
  toc.appendChild(rail);
  toc.appendChild(panel);
  document.body.appendChild(toc);

  // Активный раздел — последний заголовок, ушедший выше верхней трети экрана
  var current = -1, picked = -1;
  function update() {
    var line = Math.min(140, window.innerHeight / 3), idx = 0;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= line) idx = i; else break;
    }
    if (window.innerHeight + window.scrollY >= root.scrollHeight - 2) {
      // Долистали до конца: последние разделы могут так и не дойти до верха экрана
      var t = picked >= 0 ? heads[picked].getBoundingClientRect().top : -1;
      idx = t >= 0 && t < window.innerHeight ? picked : heads.length - 1;
    }
    if (idx === current) return;
    if (current >= 0) { bars[current].classList.remove('active'); links[current].classList.remove('active'); }
    bars[idx].classList.add('active');
    links[idx].classList.add('active');
    current = idx;
  }

  var pending = false; // не чаще одного пересчёта на кадр — прокрутка не тормозит
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; update(); });
  }
  window.addEventListener('scroll', schedule, { passive: true });
  // Пользователь сам крутит страницу — выбор из оглавления больше не главный
  ['wheel', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { picked = -1; }, { passive: true });
  });
  window.addEventListener('resize', schedule);
  toc.addEventListener('mouseenter', function () {
    // В длинном оглавлении прокрутить сам список к текущему пункту (страницу не трогаем)
    var a = links[current];
    if (!a) return;
    var y = a.offsetTop, h = a.offsetHeight, view = panel.clientHeight;
    if (y < panel.scrollTop) panel.scrollTop = y - 6;
    else if (y + h > panel.scrollTop + view) panel.scrollTop = y + h - view + 6;
  });
  update();
})();
