/* ==========================================================================
 *  正文插图 —— 后台编辑器组件
 *  --------------------------------------------------------------------------
 *  作用：在正文里插图时弹出一个中文对话框（图片 / 图片说明 / 版式），
 *  取代 Decap 内置的 Image / Alt Text / Title。内置那三栏的问题不在英文，
 *  而在本站把那个「Title」当**版式**用（居中 / 加宽 / 左浮 / 右浮）——
 *  直译成「标题」，没人猜得到那里该填 left。
 *
 *  ⚠ 这里用 id: 'image'，也就是**覆盖** Decap 内置的图片组件，不是新增一个。
 *    依据是仓库内 decap-cms.js 里这段写死的逻辑：
 *
 *      if (registry.has('image')) {
 *        const c = registry.get('image')
 *        c.fields = c.fields.update(            // 只改 widget === 'image' 那一项
 *          i => ...,                            // 把本 markdown 字段自己的
 *        )                                      // media_folder / public_folder
 *      }                                        // 注入进去
 *
 *    它按 **id 是不是 'image'** 来决定要不要把「图片存到本栏目的目录」这件事
 *    告诉插图组件。换成任何别的 id（比如 'tuwen'），上传的图会静默落到全局
 *    media_folder（assets/uploads/ 根目录），本仓库「新闻图进 news/、会员图进
 *    members/」的分目录设计就全部失效，**而且不报任何错**。
 *
 *  ⚠ 本文件失效也不会让插图出问题：加载失败时 Decap 退回它内置的图片组件，
 *    正文里写出的仍是标准的 ![说明](图 "版式")，前台渲染钩子
 *    （layouts/_default/_markup/render-image.html）照样出图、照样居中带图注，
 *    只是编辑时不能在下拉里选版式。所以这一步坏了，坏的只是便利性。
 *
 *  语法（与内置组件逐字一致，所以手写和后台写出来的文件长得一样）：
 *      ![图片说明](/uploads/news/xxx.jpg "left")
 *      └── alt ──┘ └──── 路径 ────┘ └ 版式，居中时省略
 * ========================================================================== */
(function () {
  if (!window.CMS) {
    console.warn('[cms-editor] 未找到 window.CMS，正文插图组件没有注册。');
    return;
  }

  // decap-cms.js 显式挂到 window 上的 React.createElement，见 index.html 里的注释。
  var h = window.h;

  /* 前台渲染钩子认识的四个版式。改这里必须同改
     layouts/_default/_markup/render-image.html 与 assets/css/components.css。 */
  var LAYOUTS = ['center', 'wide', 'left', 'right'];
  var DEFAULT_LAYOUT = 'center';

  /*
    把 title 槽位里的原文归一成版式关键字，容错 'left' 与 'layout=left' 两种写法。

    ⚠ 认不出来时退回 center，而不是把它原样留着 —— 版式占的就是 Markdown 的
      title 槽位，一个下拉框装不下任意文字。代价：如果有人在文件里手写了
      ![图](x.jpg "这是提示文字")，一旦在后台打开这篇并保存，那段提示文字会被
      改写成居中。前台渲染钩子本身是把认不出的 title 当真正的 title 用的，只有
      经后台归一这一条路会丢；目前 content/ 下没有任何带 title 的 Markdown 图片。
  */
  function normalizeLayout(raw) {
    var v = String(raw == null ? '' : raw).trim();
    if (v.indexOf('layout=') === 0) v = v.slice(7).trim();
    return LAYOUTS.indexOf(v) >= 0 ? v : DEFAULT_LAYOUT;
  }

  window.CMS.registerEditorComponent({
    id: 'image',
    label: '正文插图',
    widget: 'object',

    // 与内置组件逐字相同：只认独占一段的标准图片语法。
    pattern: /^!\[([^\]]*)\]\((.*?)(\s"([^"]*)")?\)/,

    fields: [
      /* label 写「图片」而不是「选择图片」—— 图片组件自己那个按钮就叫
         「选择图片」（Decap 的中文语言包 editorWidgets.image.choose），
         再套一层同样的字会显得像并排两个按钮。 */
      /* choose_url: false 拿掉「从 URL 插入」那个入口（图片组件的
         `get("choose_url", !0)`）。外链图片哪天对方站一改就是破图，
         而本站的图都要经 Hugo 压成 WebP，外链绕不过去。 */
      { name: 'image', label: '图片', widget: 'image', choose_url: false },
      {
        name: 'caption',
        label: '图片说明',
        widget: 'string',
        required: false,
        hint: '显示在图片下方。留空则图片下方不留空行。'
      },
      {
        name: 'layout',
        label: '版式',
        widget: 'select',
        options: [
          { label: '居中（默认）', value: 'center' },
          { label: '加宽通栏', value: 'wide' },
          { label: '左浮动（文字绕在右侧）', value: 'left' },
          { label: '右浮动（文字绕在左侧）', value: 'right' }
        ],
        hint: '「浮动」只在大屏生效，手机上自动回到居中，不会把文字挤成一列。'
      }
    ],

    fromBlock: function (match) {
      return {
        image: match[2] || '',
        /* 反向解掉 toBlock 加的转义。正常情况下走不到这里 —— 图注里真有 ] 时
           本组件的 pattern（照抄 Decap 内置那条，[^\]]* 不认转义）就匹配不上了，
           Decap 会把那张图当成普通 Markdown 图片处理（前台照常出图）。
           留着是为了「已经带着转义被解析进来」的边角情况不会把 \ 显示给编辑者。 */
        caption: (match[1] || '').replace(/\\([\\[\]])/g, '$1'),
        // match[4] 是 title 槽位，空或认不出时归一成 center
        layout: normalizeLayout(match[4])
      };
    },

    toBlock: function (obj) {
      var layout = normalizeLayout(obj.layout);
      /* 居中不写关键字 —— Markdown 里少一串没有信息量的 "center"，
         也让「没动过版式」和「明确选了居中」写出完全相同的文件。 */
      var title = layout === DEFAULT_LAYOUT ? '' : ' "' + layout + '"';
      /* ⚠ 说明里的 ] 必须转义。它是 Markdown 链接文字的结束符：图注写
         「产品图 [1]」而不转义，写出的是 ![产品图 [1]](/x.jpg) —— 图片语法当场
         断掉，这段文字会被当成普通文字，图片**在编辑器和前台都不显示**，而且
         保存时不报任何错。`\](` 是标准 Markdown 转义，前台渲染回来的图注仍是
         「产品图 [1]」。换行同理（图注里的换行会把这一行拆成两行）。 */
      var caption = String(obj.caption || '').replace(/[\\[\]]/g, '\\$&').replace(/\r?\n/g, ' ');
      return '![' + caption + '](' + (obj.image || '') + title + ')';
    },

    /*
      编辑器里的预览块。

      Decap 调用时传 (数据, getAsset, fields)：getAsset 能把 /uploads/... 解析成
      当前可用的网址，fields 是 Immutable List。

      ⚠ 图片**内联在句子中间**时（不独占一段），Decap 只传第一个参数，getAsset
        会是 undefined —— 所以这里每一步都要能单独退化。宁可预览里只显示原始
        路径，也不能抛异常：那个异常会掀掉整个预览面板。
    */
    toPreview: function (obj, getAsset, fields) {
      try {
        var path = obj.image || '';
        var src = path;

        if (typeof getAsset === 'function') {
          var field =
            fields && typeof fields.find === 'function'
              ? fields.find(function (f) {
                  return f.get('widget') === 'image';
                })
              : null;
          src = getAsset(path, field) || path;
        }

        var create = h || window.h;
        if (typeof create !== 'function') return src;

        var children = [
          create('img', {
            key: 'img',
            src: src,
            alt: obj.caption || '',
            style: { maxWidth: '100%', borderRadius: '4px' }
          })
        ];

        if (obj.caption) {
          children.push(
            create(
              'figcaption',
              { key: 'cap', style: { marginTop: '6px', fontSize: '12px', color: '#7b8593' } },
              obj.caption
            )
          );
        }

        var layout = normalizeLayout(obj.layout);
        var align = layout === 'left' ? 'left' : layout === 'right' ? 'right' : 'center';

        // 与前台一样：居中/加宽都居中显示，浮动按方向靠边，让人一眼看出自己选了哪个
        return create(
          'figure',
          { style: { margin: '8px 0', textAlign: align, opacity: 0.95 } },
          children
        );
      } catch (err) {
        // 预览再差也不能挡住编辑：退回路径字符串，React 会当纯文本渲染出来。
        console.warn('[cms-editor] 插图预览生成失败，退回文本：', err);
        return obj.image || '';
      }
    }
  });

  console.info('[cms-editor] 正文插图组件已注册（版式：' + LAYOUTS.join(' / ') + '）。');
})();
