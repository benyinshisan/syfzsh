/* ==========================================================================
 * theme.js — 浙江省商贸业联合会 站点交互
 * --------------------------------------------------------------------------
 * 旧站依赖 jQuery 1.4.2 + SuperSlide 2.1.1 + web.js 实现四类交互：
 *   1. 主导航二级下拉（SuperSlide 的 type:"menu"）   -> 已改为纯 CSS
 *   2. 图片新闻轮播（SuperSlide 的 autoPlay）        -> initCarousel()
 *   3. 通知公告 / 会员名录无缝滚动（web.js srcMarquee）-> initMarquee()
 *   4. 四页签切换（web.js SwapImage）                -> initTabs()
 * 另外补上站内搜索（读取 /searchindex.json）。
 * 无任何第三方依赖，ES5 语法，直接由浏览器执行。
 * ========================================================================== */
(function (window, document) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 工具
   * ------------------------------------------------------------------ */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn, false); }

  function ready(fn) {
    if (document.readyState !== 'loading') { fn(); return; }
    document.addEventListener('DOMContentLoaded', fn, false);
  }

  /** 读取 <script id="site-config" type="application/json"> 里的站点配置 */
  function config() {
    var node = document.getElementById('site-config');
    if (!node) return {};
    try { return JSON.parse(node.textContent || node.innerHTML); } catch (e) { return {}; }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ------------------------------------------------------------------ *
   * 1. 顶部工具条：日期 / 设为首页 / 加入收藏
   * ------------------------------------------------------------------ */
  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function initTopbar() {
    var el = document.getElementById('today-date');
    if (el) {
      var d = new Date();
      el.textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' +
                       d.getDate() + '日  ' + WEEKDAYS[d.getDay()];
    }

    on(document.getElementById('set-homepage'), 'click', function () {
      // 现代浏览器已禁用脚本改主页，这里退化为提示
      alert('请使用浏览器菜单中的「设为首页 / 主页」功能，或把 ' + window.location.origin + ' 加入书签。');
    });

    on(document.getElementById('add-favorite'), 'click', function () {
      var title = document.title, url = window.location.href;
      if (window.sidebar && window.sidebar.addPanel) {          // Firefox 老版本
        window.sidebar.addPanel(title, url, '');
      } else if (window.external && ('AddFavorite' in window.external)) { // IE
        window.external.AddFavorite(url, title);
      } else {
        alert('请按 Ctrl+D（Mac 为 Command+D）把本站加入收藏夹。');
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. 图片新闻轮播
   *    DOM: [data-carousel] > .sy_ban_p > li  +  .sy_ban_x > span
   * ------------------------------------------------------------------ */
  function initCarousel(root) {
    var slides = $$('.sy_ban_p > li', root);
    var dots = $$('.sy_ban_x > span', root);
    if (slides.length < 2) { return; }

    var interval = parseInt(root.getAttribute('data-interval'), 10) || 3000;
    var index = 0, timer = null, paused = false;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (li, n) { li.className = n === index ? 'on' : ''; });
      dots.forEach(function (sp, n) { sp.className = n === index ? 'on' : ''; });
    }

    function tick() { if (!paused) { show(index + 1); } }

    function start() {
      stop();
      if (prefersReducedMotion()) { return; }
      timer = window.setInterval(tick, interval);
    }
    function stop() { if (timer) { window.clearInterval(timer); timer = null; } }

    dots.forEach(function (sp, n) {
      on(sp, 'mouseenter', function () { paused = true; show(n); });
      on(sp, 'mouseleave', function () { paused = false; });
    });
    on(root, 'mouseenter', function () { paused = true; });
    on(root, 'mouseleave', function () { paused = false; });

    show(0);
    start();
  }

  /* ------------------------------------------------------------------ *
   * 3. 无缝纵向滚动（通知公告 / 会员名录）
   *    DOM: [data-marquee] > <任意单子元素>
   *    属性: data-speed 毫秒/步  data-step 每步像素  data-pause 每轮暂停毫秒
   *          data-gap 两份内容之间的空白像素
   * ------------------------------------------------------------------ */
  function initMarquee(root) {
    var content = root.firstElementChild;
    if (!content) { return; }

    var speed = parseInt(root.getAttribute('data-speed'), 10) || 90;
    var step = parseFloat(root.getAttribute('data-step')) || 1;
    var gap = parseInt(root.getAttribute('data-gap'), 10) || 0;
    var pause = parseInt(root.getAttribute('data-pause'), 10) || 0;

    // 循环单元 = 一份内容 + 间隔；必须先把高度读出来（appendChild 之后会被 track 影响）
    var unit = content.offsetHeight + gap;
    if (unit <= root.clientHeight) { return; }   // 内容不足一屏，无需滚动

    var track = document.createElement('div');
    var copy = content.cloneNode(true);
    track.appendChild(content);
    if (gap > 0) {
      var spacer = document.createElement('div');
      spacer.style.height = gap + 'px';
      track.appendChild(spacer);
    }
    track.appendChild(copy);
    root.appendChild(track);

    var offset = 0;
    var paused = false;
    var pxPerMs = step / speed;
    var last = null;
    var holdUntil = 0;

    function frame(now) {
      if (last === null) { last = now; }
      var dt = now - last;
      last = now;

      if (!paused && now >= holdUntil) {
        offset += pxPerMs * dt;
        if (offset >= unit) {
          offset -= unit;
          if (pause > 0) { holdUntil = now + pause; }
        }
        track.style.transform = 'translateY(' + (-offset) + 'px)';
      }
      window.requestAnimationFrame(frame);
    }

    on(root, 'mouseenter', function () { paused = true; });
    on(root, 'mouseleave', function () { paused = false; });

    if (prefersReducedMotion()) { return; }
    window.requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ *
   * 4. 四页签切换
   *    DOM: [data-tabs] > [data-tab="n"] 与 [data-tab-panel="n"]
   * ------------------------------------------------------------------ */
  function initTabs(root) {
    var buttons = $$('[data-tab]', root);
    var panels = $$('[data-tab-panel]', root);
    if (!buttons.length) { return; }

    function activate(n) {
      buttons.forEach(function (b) {
        var active = b.getAttribute('data-tab') === n;
        b.className = active ? 'on' : '';
        var img = b.querySelector('img');
        if (img) {
          var src = active ? (b.getAttribute('data-img-active') || b.getAttribute('data-img'))
                           : b.getAttribute('data-img');
          if (src && img.getAttribute('src') !== src) { img.setAttribute('src', src); }
        }
      });
      panels.forEach(function (p) {
        p.className = p.getAttribute('data-tab-panel') === n ? 'tab-panel on' : 'tab-panel';
      });
      var more = $('.tab-more', root);
      if (more) {
        var cur = buttons.filter(function (b) { return b.getAttribute('data-tab') === n; })[0];
        if (cur && cur.getAttribute('data-href')) { more.setAttribute('href', cur.getAttribute('data-href')); }
      }
    }

    buttons.forEach(function (b) {
      var n = b.getAttribute('data-tab');
      on(b, 'mouseenter', function () { activate(n); });
      on(b, 'focus', function () { activate(n); });
      on(b, 'click', function (e) { e.preventDefault(); activate(n); });
    });

    var current = buttons.filter(function (b) { return b.className.indexOf('on') > -1; })[0] || buttons[0];
    activate(current.getAttribute('data-tab'));
  }

  /* ------------------------------------------------------------------ *
   * 5. 站内搜索（读取 Hugo 生成的 /searchindex.json）
   * ------------------------------------------------------------------ */
  function initSearch(cfg) {
    var form = document.getElementById('search-form');
    if (!form) { return; }

    var input = document.getElementById('search-input');
    var box = document.getElementById('search-results');
    var indexUrl = cfg.searchIndex || 'searchindex.json';
    var cache = null;

    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }

    function keyword() {
      var q = (input.value || '').trim();
      if (!q) {
        var m = window.location.search.match(/[?&]q=([^&]*)/);
        if (m) { q = decodeURIComponent(m[1].replace(/\+/g, ' ')); input.value = q; }
      }
      return q;
    }

    function render(pages, q) {
      if (!pages.length) {
        box.innerHTML = '<p class="search-empty">没有找到与「' + esc(q) + '」相关的内容。</p>';
        return;
      }
      var html = '<p class="search-count">共找到 <strong>' + pages.length + '</strong> 条结果</p><ul>';
      pages.slice(0, 100).forEach(function (p) {
        html += '<li class="search-result">' +
                '<h3><a href="' + esc(p.url) + '">' + esc(p.title) + '</a></h3>' +
                '<div class="url">' + esc(p.url) + ' · ' + esc(p.date) +
                (p.section ? ' · ' + esc(p.section) : '') + '</div>' +
                '<div class="excerpt">' + esc(p.excerpt) + '</div></li>';
      });
      box.innerHTML = html + '</ul>';
    }

    function search(q) {
      if (!q) { box.innerHTML = ''; return; }
      var run = function (pages) {
        cache = pages;
        var lower = q.toLowerCase();
        var hits = pages.filter(function (p) {
          return (p.title + ' ' + p.content + ' ' + (p.tags || '')).toLowerCase().indexOf(lower) > -1;
        });
        hits.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        render(hits, q);
      };
      if (cache) { run(cache); return; }
      box.innerHTML = '<p class="search-empty">正在加载索引…</p>';
      fetch(indexUrl).then(function (r) { return r.json(); }).then(run).catch(function () {
        box.innerHTML = '<p class="search-empty">索引加载失败，请确认已执行 hugo 构建。</p>';
      });
    }

    on(form, 'submit', function (e) {
      e.preventDefault();
      var q = keyword();
      if (!q) { alert('请输入要搜索的关键字！'); input.focus(); return; }
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', form.getAttribute('action') + '?q=' + encodeURIComponent(q));
      }
      search(q);
    });

    var initial = keyword();
    if (initial) { search(initial); }
  }

  /* ------------------------------------------------------------------ *
   * 6. 通用列表筛选（会员名录等）
   *    DOM: <input data-filter="#list li"> + <ul id="list">
   * ------------------------------------------------------------------ */
  function initFilter() {
    $$('[data-filter]').forEach(function (input) {
      var list = document.querySelector(input.getAttribute('data-filter'));
      if (!list) { return; }
      var items = $$('li', list);
      var empty = document.getElementById('member-empty');

      on(input, 'input', function () {
        var q = (input.value || '').trim().toLowerCase();
        var shown = 0;
        items.forEach(function (li) {
          var hit = !q || li.textContent.toLowerCase().indexOf(q) > -1;
          li.style.display = hit ? '' : 'none';
          if (hit) { shown++; }
        });
        if (empty) { empty.style.display = shown ? 'none' : ''; }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 启动
   * ------------------------------------------------------------------ */
  ready(function () {
    var cfg = config();
    initTopbar();
    $$('[data-carousel]').forEach(initCarousel);
    $$('[data-marquee]').forEach(initMarquee);
    $$('[data-tabs]').forEach(initTabs);
    initSearch(cfg);
    initFilter();
  });

})(window, document);
