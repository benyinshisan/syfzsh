/*
 * Decap CMS 自定义预览：把本机正在运行的 Hugo 站点真实页面内嵌进预览面板。
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
    console.warn('[zjsm-cms] 未检测到 Decap CMS 全局对象，保留默认预览。');
    return;
  }

  var LIVE_COLLECTIONS = [
    // 浙商联动态
    'news-notice', 'news-association', 'news-events', 'news-integrity',
    // 行业动态
    'industry-headlines', 'industry-experts', 'industry-livelihood',
    // 政策法规
    'policy-national', 'policy-provincial', 'policy-documents',
    // 会员天地
    'members-dynamics',
    // 党群建设
    'party-news', 'party-activities', 'party-integrity',
    // 标准化工作
    'standards-news', 'standards-downloads', 'standards-policy',
    // 服务中心
    'services-investment', 'services-trade',
    // 关于浙商联
    'about'
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
      var entry = this.props.entry;
      var url = entryPath(entry);

      if (!url) {
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

      var src = url + (this.state.token ? '?cms=' + this.state.token : '');

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
          h(
            'button',
            { type: 'button', style: BTN_STYLE, onClick: this.reload },
            '刷新'
          ),
          h(
            'a',
            { href: url, target: '_blank', rel: 'noopener', style: LINK_STYLE },
            '新窗口打开'
          )
        ),
        h('iframe', {
          title: '实时预览',
          src: src,
          style: {
            flex: '1 1 auto',
            width: '100%',
            border: '0',
            background: '#fff'
          }
        })
      );
    }
  });

  LIVE_COLLECTIONS.forEach(function (name) {
    CMS.registerPreviewTemplate(name, LivePreview);
  });

  console.info('[zjsm-cms] 已为 ' + LIVE_COLLECTIONS.length + ' 个集合注册实时预览。');
})();
