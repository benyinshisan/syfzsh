/*
 * Decap CMS 自定义预览 + 后台使用说明。
 *
 * 为什么需要它：Decap 默认预览只是把各字段平铺出来（见 decap-cms-core 的
 * EditorPreview），看不到真实版式。这里改成 iframe 加载 Hugo 渲染结果，
 * 于是「实时浏览」看到的就是最终页面。
 *
 * 生效前提：
 *   1) npm run dev 正在运行（Hugo 站点在 http://localhost:1313）；
 *   2) 该条目已经保存过一次。Hugo 只读取磁盘文件，所以未保存的新文章
 *      还生成不了页面，此时面板会给出提示。
 *
 * 预览地址是从条目的**文件路径**推算的，不是读 config.yml 的 preview_path
 * —— 因为我们这个自定义预览组件整个替换掉了 Decap 的默认预览。所以推算
 * 逻辑必须跟上 Hugo 的 URL 规则，包括 slug front matter 顶掉文件名那一段，
 * 见下面 entryPath() 里的注释。
 *
 * 保存后会自动刷新：订阅 Decap 的 postSave 事件（允许的事件名见
 * decap-cms-core/lib/registry.js）。Hugo 自身的 LiveReload 也会让
 * iframe 内的页面自动重载。
 *
 * 新增栏目时，记得把集合名加进下面的 LIVE_COLLECTIONS（与
 * static/admin/config.yml 的 collections[].name 对应）。
 */
(function () {
  'use strict';

  var CMS = window.CMS;
  var h = window.h;
  var createClass = window.createClass;

  // h / createClass 由 decap-cms 挂在 window 上（无构建步骤的写法）
  if (!CMS || !h || !createClass) {
    console.warn('[cms-preview] 未检测到 Decap CMS 全局对象，保留默认预览。');
    return;
  }

  /*
   * ⚠ 新增/改名栏目时最容易漏的一处：
   *   这里每漏一个集合名都不会报错，只是那个栏目静默退回「字段平铺」预览，
   *   看起来「预览坏了」但控制台一片干净。
   *   集合名必须与 static/admin/config.yml 的 collections[].name 逐字一致。
   */
  var LIVE_COLLECTIONS = [
    // 关于我们（固定页面）
    'about',
    // 新闻中心
    'news-notice', 'news-association', 'news-industry', 'news-media',
    // 会员天地
    // 会员单位的文件名不带头日期（content/members/directory/<别名>.md），
    // entryPath() 按路径推算，正好得到 /members/directory/<别名>/，与前台一致。
    'members-directory', 'members-dynamics', 'members-services',
    // 政策法规 / 党群工作（无二级栏目，文章直接落在栏目目录下）
    'policy', 'party'
  ];

  // admin 页面位于 <base>/admin/，据此反推站点根路径，兼容子路径部署
  function siteBase() {
    return window.location.pathname.replace(/admin(\/.*)?$/, '');
  }

  // content/news/notice/foo.md -> /news/notice/foo/
  // content/news/notice/_index.md -> /news/notice/
  function entryPath(entry) {
    var filePath = entry && entry.get ? entry.get('path') : null;
    if (!filePath) return null;

    var p = String(filePath).replace(/^\/+/, '');
    if (p.indexOf('content/') === 0) p = p.slice('content/'.length);
    p = p.replace(/\.md$/i, '');

    /*
     * ⚠ slug front matter 会顶掉文件名那一段（Hugo 的行为）：文件叫
     *   2026-03-02-jiangong.md、front matter 写 slug: jiangong，
     *   最终网址是 /栏目/jiangong/ 而不是 /栏目/2026-03-02-jiangong/。
     *   预览地址必须跟着走，否则填了「网址别名」的文章预览会指向 404
     *   —— 而且它不报错，只是 iframe 里一片空白，最难查。
     */
    var slug = entry.getIn ? entry.getIn(['data', 'slug']) : null;
    if (slug) {
      p = p.replace(/[^/]+$/, '') + String(slug).replace(/^\/+|\/+$/g, '');
    }

    p = p.replace(/(^|\/)_index$/, '$1');
    p = p.replace(/\/+$/, '');
    return siteBase() + (p ? p + '/' : '');
  }

  var NOTE_STYLE = {
    padding: '24px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: '14px',
    lineHeight: '1.8',
    color: '#555'
  };

  var BAR_STYLE = {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 10px',
    borderBottom: '1px solid #e5e5e5',
    background: '#fafafa',
    font: "12px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif",
    color: '#666'
  };

  var BTN_STYLE = {
    marginLeft: 'auto',
    padding: '3px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    font: 'inherit',
    color: '#333'
  };

  var LINK_STYLE = { color: '#1a6fb5', textDecoration: 'none' };

  /* 带刷新按钮的 iframe 预览骨架，文章页与首页共用 */
  function frame(url, token, onReload) {
    return h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: '75vh'
        }
      },
      h(
        'div',
        { style: BAR_STYLE },
        h('span', null, '实时预览（本机 Hugo）'),
        h('code', { style: { color: '#999' } }, url),
        h('button', { type: 'button', style: BTN_STYLE, onClick: onReload }, '刷新'),
        h(
          'a',
          { href: url, target: '_blank', rel: 'noopener', style: LINK_STYLE },
          '新窗口打开'
        )
      ),
      h('iframe', {
        title: '实时预览',
        src: url + (token ? '?cms=' + token : ''),
        style: { flex: '1 1 auto', width: '100%', border: '0', background: '#fff' }
      })
    );
  }

  /* 「还没保存过」的提示 */
  function notSavedYet() {
    return h(
      'div',
      { style: NOTE_STYLE },
      h('p', { style: { margin: '0 0 8px' } }, '这篇内容还没有对应的页面文件。'),
      h(
        'p',
        { style: { margin: 0 } },
        'Hugo 只读取磁盘上的文件，所以请先按 ',
        h('strong', null, 'Ctrl/Cmd + S'),
        ' 保存一次，预览面板就会自动加载真实页面。'
      )
    );
  }

  var LivePreview = createClass({
    getInitialState: function () {
      return { token: 0 };
    },

    componentDidMount: function () {
      var self = this;
      this._mounted = true;
      // 保存后刷新 iframe，使新写入的文件立刻可见
      this._onSave = function () {
        if (self._mounted) {
          self.setState({ token: self.state.token + 1 });
        }
      };
      CMS.registerEventListener({ name: 'postSave', handler: this._onSave });
    },

    componentWillUnmount: function () {
      // Decap 没有提供注销事件的接口，这里只做标记，避免卸载后 setState
      this._mounted = false;
    },

    reload: function () {
      this.setState({ token: this.state.token + 1 });
    },

    render: function () {
      var url = entryPath(this.props.entry);
      if (!url) return notSavedYet();
      return frame(url, this.state.token, this.reload);
    }
  });

  /*
   * 「首页」集合的预览。
   *
   * 这个集合装的是四个**不同性质**的文件：content/_index.md 有真实页面（/），
   * 而 data/home.yaml、data/friendlinks.yaml、data/partners.yaml 是数据文件，
   * 不产生任何页面。
   *
   * 早先的做法是把整个集合排除在实时预览之外（因为 Decap 的预览模板是
   * **按集合**注册的，管不到单个文件，注册了就会把三个 YAML 推成
   * /data/home.yaml/ 这种 404 地址）。结果是首页这一组的预览退化成字段平铺，
   * 编辑同事看着一堆「图片新闻 / 商会动态 / 通知公告」的输入框，不知道
   * 自己改的是首页的哪一块。
   *
   * 改成按**文件路径**分流就好：是 .yaml 就渲染一张说明卡（讲清它是数据文件、
   * 改完去哪看效果），是 _index.md 就走正常的 iframe。这样四张卡各得其所。
   */
  var HomePreview = createClass({
    getInitialState: function () {
      return { token: 0 };
    },

    componentDidMount: function () {
      var self = this;
      this._mounted = true;
      this._onSave = function () {
        if (self._mounted) self.setState({ token: self.state.token + 1 });
      };
      CMS.registerEventListener({ name: 'postSave', handler: this._onSave });
    },

    componentWillUnmount: function () {
      this._mounted = false;
    },

    reload: function () {
      this.setState({ token: this.state.token + 1 });
    },

    render: function () {
      var entry = this.props.entry;
      var path = String((entry && entry.get && entry.get('path')) || '');

      // 数据文件（data/*.yaml）：没有页面可预览，给一张说明卡
      if (/\.ya?ml$/i.test(path)) {
        var root = siteBase() || '/';
        var isHome = /home\.ya?ml$/i.test(path);
        return h(
          'div',
          { style: NOTE_STYLE },
          h(
            'p',
            { style: { margin: '0 0 10px', fontSize: '15px', color: '#333' } },
            '这是首页的数据文件，本身不是文章，没有单独的页面可以预览。'
          ),
          h(
            'p',
            { style: { margin: '0 0 10px' } },
            isHome
              ? '这里调的是首页各版块的标题、条数与取自哪个栏目。左边的输入框从上到下就对应首页从上到下的版块顺序。'
              : '左边填的内容会直接出现在首页上，保存后回首页即可对照。'
          ),
          h(
            'p',
            { style: { margin: 0 } },
            '保存后到 ',
            h('a', { href: root, target: '_blank', rel: 'noopener', style: LINK_STYLE }, '首页'),
            ' 看效果（本机 Hugo 会热重载，刷新即可）。'
          )
        );
      }

      var url = entryPath(entry);
      if (!url) return notSavedYet();
      return frame(url, this.state.token, this.reload);
    }
  });

  CMS.registerPreviewTemplate('home', HomePreview);
  LIVE_COLLECTIONS.forEach(function (name) {
    CMS.registerPreviewTemplate(name, LivePreview);
  });

  console.info(
    '[cms-preview] 已为 ' + (LIVE_COLLECTIONS.length + 1) + ' 个集合注册预览。'
  );

  /* ==========================================================================
   *  后台使用说明（右下角悬浮按钮）
   *  ------------------------------------------------------------------------
   *  Decap 没有「帮助 / 上手引导」这类配置项，栏目说明只能写在各集合顶部的
   *  description 里 —— 而编辑同事最难的不是「这个字段填什么」，是**整件事的
   *  流程**：先做哪步、哪些字段是必填的、改完去哪看。所以这里补一个入口。
   *
   *  刻意用原生 DOM 挂在 document.body 上，不碰 React 组件树：
   *  Decap 用的是 styled-components + React，往它的树里插节点会被重渲染抹掉。
   *  挂成 body 的兄弟节点则完全独立，样式与 z-index 都自带，不会与后台打架。
   * ========================================================================== */
  function mountHelp() {
    if (document.getElementById('cms-help-root')) return;

    var Z = 2147483000;
    var FONT =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

    var root = document.createElement('div');
    root.id = 'cms-help-root';
    root.style.cssText =
      'position:fixed;right:20px;bottom:20px;z-index:' + Z + ';font-family:' + FONT +
      ';text-align:right';

    var panel = document.createElement('div');
    panel.style.cssText =
      'display:none;width:380px;max-width:calc(100vw - 40px);max-height:70vh;overflow:auto;' +
      'margin-bottom:10px;padding:18px 20px;text-align:left;background:#fff;color:#333;' +
      'border:1px solid #dfe3e8;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.16);' +
      'font-size:13px;line-height:1.85';

    panel.innerHTML = [
      '<div style="font-size:15px;font-weight:700;margin:0 0 10px;color:#1b4a86">发内容的顺序</div>',
      '<ol style="margin:0 0 14px;padding-left:20px">',
      '<li>左侧点进要发的栏目（如「新闻中心 · 通知公告」）</li>',
      '<li>右上角「新建」</li>',
      '<li>填<b>标题</b>、<b>网址别名</b>，再写<b>正文</b> —— 保存就能发布，其余字段全部选填</li>',
      '</ol>',

      '<div style="font-size:15px;font-weight:700;margin:0 0 6px;color:#1b4a86">图片放哪</div>',
      '<p style="margin:0 0 6px"><b>封面图</b>和<b>正文里的图</b>是两回事：封面图是表单里那个「列表封面图」字段，只有一张，会出现在栏目列表小图、首页轮播和正文上方；正文里的图要在正文里插。两者互不影响。</p>',
      '<p style="margin:0 0 6px">正文插图：工具栏点 <b>「添加组件」→「正文插图」</b>，选图片、写图注、选版式（居中 / 加宽通栏 / 左浮动 / 右浮动），图片位置随你插在哪。</p>',
      '<p style="margin:0 0 14px">图一律上传到 <code>assets/uploads/</code> 下按栏目分的目录，路径后台自动填，不用记。⚠ 会员的厂区、产品、证书图请填「企业环境 / 产品案例 / 资质荣誉」那三组，不要塞进正文 —— 填在字段里前台才会排成整齐的网格。更多例子见仓库根目录的 <code>WRITING.md</code>。</p>',

      '<div style="font-size:15px;font-weight:700;margin:0 0 6px;color:#1b4a86">容易踩的三个坑</div>',
      '<p style="margin:0 0 6px"><b>网址别名必填</b>，只能小写字母、数字、连字符（如 <code>jiangong-2026</code>）。已有文章的别名<b>不要改</b>，改了等于换网址。填错时输入框下方会当场提示。</p>',
      '<p style="margin:0 0 6px"><b>要上首页轮播</b>：在文章里勾「首页图片新闻」。轮播取几条在「首页 → ② 首页各版块」里调。</p>',
      '<p style="margin:0 0 14px"><b>栏目页的大标题</b>（「关于我们」这种）不在后台改，要直接改 <code>content/</code> 下对应的 <code>_index.md</code>。</p>',

      '<div style="font-size:15px;font-weight:700;margin:0 0 6px;color:#1b4a86">改完在哪看</div>',
      '<p style="margin:0 0 14px">保存后用 <b>Ctrl/Cmd + S</b> 之外不用做任何事：右侧「实时预览」就是真实页面，Hugo 会热重载。也可以点右上角「查看站点」另开一个标签页对照。</p>',

      '<div style="font-size:15px;font-weight:700;margin:0 0 6px;color:#1b4a86">想改首页版块</div>',
      '<p style="margin:0">「首页 → ② 首页各版块」：每个版块显示几条、取自哪个栏目，都在那里。</p>'
    ].join('');

    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = '使用说明';
    button.style.cssText =
      'padding:8px 16px;border:0;border-radius:999px;background:#2f5d95;color:#fff;' +
      'cursor:pointer;font:600 13px/1 ' + FONT + ';box-shadow:0 4px 14px rgba(47,93,149,.35)';

    button.addEventListener('click', function () {
      var open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      button.style.background = open ? '#2f5d95' : '#1b4a86';
    });

    root.appendChild(panel);
    root.appendChild(button);
    document.body.appendChild(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHelp);
  } else {
    mountHelp();
  }
})();
