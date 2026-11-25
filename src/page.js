// Единственный скрипт страницы. Встраивается с nonce; скрипты из самого .md режет CSP.
(function () {
  var root = document.documentElement;

  // ---------- Переключатель темы: 🌙 ☀️ ⚙️ ----------
  document.querySelectorAll('.theme-toggle button').forEach(function (b) {
    b.addEventListener('click', function () {
      var mode = b.getAttribute('data-mode');
      root.setAttribute('data-theme-mode', mode);
      chrome.webview.postMessage(mode); // окно меняет тему движка, заголовок и запоминает выбор
    });
  });

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
