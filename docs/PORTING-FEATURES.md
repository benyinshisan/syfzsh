# 从 hugo-theme-reimu 移植三个特性：图片放大 / 图片懒加载 / Algolia 搜索

> 对象：`hugo-theme-reimu`（被参照的主题，commit `246177b`，v0.16.1）
> 受体：`syfzsh`（本站，独立 Hugo 站点，无 `themes/` 目录）
> 性质：**架构梳理 + 可移植性判断 + 移植方法**。
> 与本轮实际代码改动的边界见下面的「本轮做了什么 / 没做什么」。

---

## 0. 结论速览

| 特性 | reimu 的实现 | 能否移植到 syfzsh | 怎么移植 | 本轮 |
| --- | --- | --- | --- | --- |
| **图片放大** | PhotoSwipe 5.4.4，**浏览器端事后包 `<a>`** | **能，而且应该做得比 reimu 好** | 在 Markdown 图片渲染钩子里**构建期**输出 PhotoSwipe 契约 | **只出方案**（未实现） |
| **图片懒加载** | lazysizes 5.3.2，**浏览器端事后改写 `data-src`** | 能，但**不该照搬** | 保留原生 `loading=lazy`，只补三个缺陷 | **已实现** |
| **Algolia 搜索** | Hugo 出 `algolia.json` + **仓库外手动/CLI 上传** + instantsearch 前端 | 技术上能，**但不建议** | 见 §5.6；推荐改为升级现有自建搜索 | **不移植** |

三条一句话理由：

1. reimu 的放大与懒加载都建立在「**主题没有图片渲染钩子、构建期拿不到图片尺寸**」这个前提上，所以在浏览器里做事后手术。syfzsh **有** `render-image.html` 钩子，而且 `img.html` 在构建期就输出了 `width`/`height` —— 前提不同，照搬会把 reimu 的缺陷一起搬进来。
2. reimu 的懒加载是 **fail-closed** 的：CSS 让图先 `opacity: 0`，靠 lazysizes 加 `.lazyloaded` 才显示。JS 一挂（CDN 被墙、SRI 不匹配），或用户关了 JS，**整站图片全部隐形**。syfzsh 现在用原生 `loading="lazy"`，关掉 JS 照常显示。
3. Algolia 需要**外部账号**，而且索引上传是 **Hugo 构建之外的一步**（reimu 文档给的是手工上传或 `npx atomic-algolia`，需要 Admin Key）。对一个 41 页的站点，你要永久维护一个密钥 secret 和一条同步流水线 —— 而免费档在许可证上只允许「评估用途」。详见 §5.5。

---

## 1. 前提：两个站点的地基差异

移植前必须先认清这一点，否则会把「reimu 的变通」当成「正确做法」抄过来。

| | `hugo-theme-reimu` | `syfzsh` |
| --- | --- | --- |
| 形态 | 标准 Hugo 主题（`theme.toml` + `go.mod` + `config/_default/params.yml`） | 独立站点，**没有 `themes/`**，布局在站点根 |
| Hugo 版本要求 | `config.toml`：`[module.hugoVersion] extended = true, min = "0.158.0"` —— **强制 Extended** | Hugo ≥ 0.156，**刻意不用 Extended**（`hugo.toml:7`、`README.md:8`，CI 下载的是非 extended 包） |
| 样式 | SCSS → `toCSS`（dart-sass，**要 Extended**） | 4 个纯 CSS，`resources.Concat` + `minify` + `fingerprint` |
| 脚本 | TypeScript → `js.Build`（esbuild，标准版自带） | 单个手写 `assets/js/theme.js` |
| 第三方库 | **不打包**，登记在 `data/vendor.yml`，运行时从 CDN（`npm.webcache.cn`）取 | 前端**零运行时依赖**（`ARCHITECTURE.md:14`） |
| **图片渲染钩子** | **没有**。`layouts/_default/_markup/` 只有 `render-blockquote-alert` / `render-codeblock-mermaid` / `render-heading` | **有** `layouts/_default/_markup/render-image.html` |
| 内容图尺寸 | 构建期**不知道** | `img.html:64` 输出 `width`/`height` |
| `loading=` 属性 | **全仓一个都没有**（`grep 'loading=' layouts/` 空） | `img.html` 默认 `lazy`，可传 `eager` |
| 页面切换 | pjax（`theme-shokax-pjax`，默认关） | **无 pjax**，整页导航 |

**关键推论**：reimu 里所有「图片相关」的 JS，本质上都在**补偿它自己没有渲染钩子这件事**。syfzsh 不需要补偿 —— 它可以在建站时就把该有的信息写进 HTML。

还有一条容易忽略的：reimu 的 `config.toml` 里**一个 `[[module.mounts]]` 都没有**。这不是巧合，是避坑 —— 主题一旦声明 mounts，且声明的 `source` 在主题里不存在，那条会被静默丢弃；若它是唯一一条，主题的 mounts 变成 `null`，**主题贡献 0 个 layout/CSS/static 且不报错**。详见 `docs/THEME-EXTRACTION.md`。

---

## 2. 特性一：图片放大（reimu 用 PhotoSwipe 5.4.4）

### 2.1 reimu 怎么做的

**库**：PhotoSwipe **5.4.4**，三个文件，全部从 CDN 取（`data/vendor.yml:17-22` 与 `:104-107`）：

```yaml
  photoswipe:
    src: webcache|photoswipe@5.4.4/dist/photoswipe.esm.min.js
    integrity: sha384-WkkO3GCmgkC3VQWpaV8DqhKJqpzpF9JoByxDmnV8+oTJ7m3DfYEWX1fu1scuS4+s
  photoswipe_lightbox:
    src: webcache|photoswipe@5.4.4/dist/photoswipe-lightbox.esm.min.js
    integrity: sha384-DiL6M/gG+wmTxmCRZyD1zee6lIhawn5TGvED0FOh7fXcN9B0aZ9dexSF/N6lrZi/
css:
  photoswipe:
    src: webcache|photoswipe@5.4.4/dist/photoswipe.css
    integrity: sha384-IfxC36XL/toUyJ939C73PcgMuRzAZuIzZxE38drsmO5p6jD7ei+Zx/1oA/0l8ysE
```

**初始化**在 `layouts/partials/afterFooter.html:228-252`，一个内联 `<script type="module">`：

```js
const initPswp = (gallery, children) => {
  if (_$$(`${gallery} ${children}`).length > 0) {
    new PhotoSwipeLightbox({ gallery, children, pswpModule: () => safeImport(...) }).init();
  }
}
const pswp = () => {
  initPswp('.article-entry', 'a.article-gallery-item');
  initPswp('.article-gallery', 'a.article-gallery-item');
}
pswp()
```

**它自己一个 DOM 都不生成。** PhotoSwipe 只认「容器里有 `<a>` + `data-pswp-width/height`」。reimu 是在 `assets/js/pjax_main.ts:77-96` 手动把每张图包进锚点的：

```js
// lightbox
_$$(".article-entry img").forEach((element) => {
  if (element.parentElement?.classList.contains("friend-icon") ||
      element.parentElement?.tagName === "A" ||
      element.classList.contains("no-lightbox")) return;
  const a = document.createElement("a");
  a.href = element.src;
  a.dataset.pswpWidth  = element.naturalWidth;   // ← 此刻图通常还没加载完
  a.dataset.pswpHeight = element.naturalHeight;  //   → 很可能是 0
  a.target = "_blank";
  a.classList.add("article-gallery-item");
  element.parentNode?.insertBefore(a, element);
  element.parentNode?.removeChild(element);
  a.appendChild(element);
});
```

另有两处同时产出这个契约：`layouts/partials/post/gallery.html`（读 front matter `photos:`，用 `onload=` 补尺寸）和 `layouts/shortcodes/gallery.html:147-148`（用预加载的 `new Image()` 拿尺寸，是三条路里唯一可靠的）。

ESM 用自定义的 `window.safeImport`（`assets/js/main.ts:248-272`）加载：`fetch` 取文本 → `crypto.subtle.digest("SHA-384")` 比对 SRI → 包成 Blob URL → `import()`。

### 2.2 reimu 这套做法的四个缺陷（移植时会一起搬过来）

1. **尺寸竞态，会得到 0×0**。`pjax_main.ts:88-89` 在 DOM 就绪时立刻读 `naturalWidth`，而图通常还没解码完。PhotoSwipe 的默认 dataSource 是 `i.width = s.dataset.pswpWidth ? parseInt(...) : 0`（已在 5.4.4 源码中核对），拿到 0 就没法算缩放比例。reimu 的另外两条路（`onload`、预加载 Image）正是为了绕开这一点。
2. **执行顺序是隐式的**。同文件的懒加载改写（`:178-187`）跑在包锚点之后，会把 `src` 摘掉；`window.lightboxStatus = "ready"` 那套同步机制在 commit `e07f292` 里被删掉了，现在只靠「`pjax_main.ts` 是阻塞的经典脚本、PhotoSwipe 初始化是 deferred 模块」这个隐式顺序兜底。
3. **`init-time guard` 与延迟构建的画廊互斥**。`afterFooter.html:235` 的 `length > 0` 是**初始化那一刻**的快照。`shortcodes/gallery.html` 在 `DOMContentLoaded` 里才建 DOM，而内联 module 脚本在那之前就执行了 —— 于是「整页图都在 `{{< gallery >}}` 里」的页面根本不会创建 PhotoSwipe 实例，点击只能 `target="_blank"`。
4. **ESM 在 `file://` 下必然失效**（见 §2.4）。

### 2.3 syfzsh 的地基更好，所以移植方式应该不同

syfzsh 已有的能力，恰好覆盖了 reimu 缺失的那一环：

```gotemplate
{{- /* layouts/_default/_markup/render-image.html */ -}}
{{- if and .IsBlock (ne $layout "plain") -}}
<figure class="md-figure md-figure--{{ $layout }}">
  {{- partial "components/img.html" (dict "src" .Destination "alt" $alt "width" 1200 ...) }}
  {{- if $alt }}<figcaption>{{ $caption }}</figcaption>{{- end }}
</figure>
{{- end -}}
```

`img.html` 在构建期就把 `.Width`/`.Height` 写进了 HTML。所以放大所需的尺寸**根本不需要在浏览器里猜**。

**结论：在渲染钩子里构建期输出契约，而不是在浏览器里做事后手术。**

### 2.4 为什么不照搬 reimu 的加载方式（UMD vs ESM）

这是本方案的关键取舍，必须写明：

- `npm run build:local` 产出 `public-local/`，要用**双击 `index.html`、无服务器**的方式打开。
- **ESM 的 `<script type="module">` 在 `file://` 下会被 CORS 拦死**（`file://` 是不透明来源，模块脚本必须走 CORS，浏览器直接拒绝）。reimu 的 `safeImport`（fetch + Blob）在 `file://` 下同样会失败。
- 也就是说：照搬 reimu 会让**离线预览版丢掉放大功能**。
- 而 PhotoSwipe 5.4.4 官方发行**同时提供 UMD 版**（已在 jsDelivr 的文件清单中核对）：

  | 文件 | 大小 | 全局名 |
  | --- | --- | --- |
  | `dist/umd/photoswipe.umd.min.js` | 54,495 B | `PhotoSwipe` |
  | `dist/umd/photoswipe-lightbox.umd.min.js` | 14,569 B | `PhotoSwipeLightbox` |
  | `dist/photoswipe.css` | 7,423 B | —— |

  官方 UMD README 自带的最小示例就是经典 `<script>` + `pswpModule: PhotoSwipe`。

- **代价（如实说明）**：UMD README 自己写着 *"Use it only if you are unable to use ESM version"* —— UMD 是转译出来的降级产物。用它换的是「离线构建能跑、且不需要 `safeImport` 那套 fetch+Blob+SRI 自校验」。
- **注意：`dist/` 里没有压缩版 CSS**，`photoswipe.css` 就是未压缩的 7.4 KB，所以 CSS 必须走 Hugo Pipes 的 `minify`。

### 2.5 PhotoSwipe 的 DOM 契约（已从 5.4.4 源码核对）

`photoswipe-lightbox.esm.min.js` 里的默认 dataSource，逐个子元素执行：

```js
const s = t.tagName === "A" ? t : t.querySelector("a");
if (s) {
  i.src    = s.dataset.pswpSrc || s.href;             // 大图 URL：优先 data-pswp-src，否则 href
  if (s.dataset.pswpSrcset) i.srcset = s.dataset.pswpSrcset;
  i.width  = s.dataset.pswpWidth  ? parseInt(s.dataset.pswpWidth, 10)  : 0;
  i.height = s.dataset.pswpHeight ? parseInt(s.dataset.pswpHeight, 10) : 0;
  i.w = i.width; i.h = i.height;
  if (s.dataset.pswpType) i.type = s.dataset.pswpType;
  const e = t.querySelector("img");
  if (e) { i.msrc = e.currentSrc || e.src; i.alt = e.getAttribute("alt") ?? ""; }
}
```

可核对出的结论，逐条对应到我们的实现：

| 契约 | 说明 |
| --- | --- |
| 子元素是 `<a>` | 或容器内任一元素里的 `<a>`；没有 `<a>` 就没有大图源 |
| `data-pswp-width` / `data-pswp-height` | **必需**，且必须是**大图**的像素尺寸（不是缩略图的） |
| `data-pswp-src` | 选填；不写就用 `href` |
| `data-pswp-srcset` | 选填；**源码里只有 `pswpSrcset`，没有 `pswpSizes`** —— sizes 由它内部按视口算，所以不要写 `data-pswp-sizes` |
| `data-pswp-type` | 选填，如 `image`；我们不需要 |
| `i.msrc` | **取自 `<a>` 里的 `<img>` 的 `currentSrc`/`src`** —— 把现有 `<img>` 包进 `<a>` 就白得一个占位图，用于放大动画的起手位置 |
| `i.alt` | **取自 `<a>` 里的 `<img>` 的 `alt`** —— 我们的 `alt` 会自动流进 PhotoSwipe 的无障碍标签 |

### 2.6 目标 HTML 形状

在 `render-image.html` 里把现有的 `<img>` 包一层 `<a>`，得到：

```html
<figure class="md-figure md-figure--center">
  <a class="md-zoom"
     href="/syfzsh/uploads/news/x_hu_2000.webp"
     data-pswp-width="2000" data-pswp-height="1333"
     data-pswp-srcset="/syfzsh/uploads/news/x_hu_1200.webp 1200w, /syfzsh/uploads/news/x_hu_2000.webp 2000w"
     target="_blank" rel="noopener">
    <img src="/syfzsh/uploads/news/x_hu_1200.webp" width="1200" height="800"
         alt="慰问活动合影" loading="lazy" decoding="async">
  </a>
  <figcaption>慰问活动合影</figcaption>
</figure>
```

要点：

- **`data-pswp-width/height` 用 2000px 那一档的尺寸**，不是 `<img>` 的 1200px —— 两者比例一致但像素不同，写错会让 PhotoSwipe 算错缩放级别，放大后发糊。
- `href` 同时是**无 JS 时的降级目标**（点开原图看），所以它必须是真能打开的 URL。
- `target="_blank" rel="noopener"`：有 JS 时 PhotoSwipe 会 `preventDefault`，无 JS 时新标签页打开大图。
- `data-pswp-srcset` 是可选的带宽优化：小屏只下 1200，大屏才下 2000。
- **`<a>` 必须在 `<figure>` 内部、包住 `<img>`** —— 不要把整个 `<figure>` 包进 `<a>`，那会让 `<figcaption>` 也变成链接文字。

### 2.7 2000px 那一档怎么生成

`img.html` 现在对正文图做的是 `$res.Resize (printf "%dx webp q82" 1200)`。放大档需要**同一次构建里再生成一档**：

```gotemplate
{{- $zoom := "" -}}
{{- if and $processable (gt $res.Width 1200) -}}
  {{- $zoom = $res.Resize (printf "%dx webp q82" 2000) -}}
{{- else -}}
  {{- $zoom = $img -}}{{- /* 原图本来就不到 2000，放大档就等于正文档 */ -}}
{{- end -}}
```

注意事项：

- `%dx` 是**只按宽度**缩放、高度自动。竖图（本站有 `屏幕截图-*.jpg` 这类）按宽 2000 会得到很大的高度，建议改成按长边限制，或在报告的执行阶段实测单张体积后再定；`q82` 与现有约定一致。
- **`$res.Width` 小于 2000 时不要放大小图**（Hugo 会真的插值放大，只会更糊更占空间），所以上面的 `gt $res.Width 1200` 判断和 `else` 分支是必需的。
- 这会**多一个 `resources/_gen` 衍生物**：构建变慢一点、缓存变大一点。本站 27 张已处理图，影响很小。
- 生成的衍生物文件名带内容哈希（`_hu_<hash>`），所以换图/改参数会自动破缓存，不必刷 CDN。

### 2.8 资产怎么放（三个方案的对比结论）

**选定：方案 2 —— CSS 单独一个 `<link>`，各自指纹；JS 两个经典 `<script>`。**

| | 方案 1（并入 `site.css` bundle） | **方案 2（独立 `<link>`，选定）** | 方案 3（`static/` 直引） |
| --- | --- | --- | --- |
| CSS 请求数 | 1（不变） | 2 | 2 |
| 指纹 | 有，但**PhotoSwipe 升级会连带主 CSS 失效** | 有，**各自独立** | **无**（升级后旧缓存无法自动失效） |
| SRI | 有 | 有 | **无** |
| vendor CSS 被压缩 | 是 | 是 | **否** |
| 触发 `resources.Concat` 硬崩 | **有风险** | 无 | 无 |
| 将来能改成按页加载 | **不能** | 能 | 能 |

`head.html:35-38` 明确警告过：往那个 slice 里加的文件必须真实存在，`resources.Get` 取不到会返回 `nil`，紧接着 `resources.Concat` **直接硬崩**（不是优雅降级）。方案 2 不碰那个 slice，天然避开。

具体改动：

- 新增目录 `assets/vendor/photoswipe/`，放三个文件。
- `layouts/partials/head.html`：在现有 `site.css` 那一段**之后**追加
  ```gotemplate
  {{- $pswpCss := resources.Get "vendor/photoswipe/photoswipe.css" | minify | fingerprint }}
  <link rel="stylesheet" href="{{ $pswpCss.RelPermalink }}" integrity="{{ $pswpCss.Data.Integrity }}">
  ```
- `layouts/partials/scripts.html`：在 `theme.js` **之前**追加（**顺序不能反，lightbox 依赖核心**）
  ```gotemplate
  {{- $pswp   := resources.Get "vendor/photoswipe/photoswipe.umd.min.js" | fingerprint }}
  {{- $pswpLb := resources.Get "vendor/photoswipe/photoswipe-lightbox.umd.min.js" | fingerprint }}
  <script src="{{ $pswp.RelPermalink }}" integrity="{{ $pswp.Data.Integrity }}"></script>
  <script src="{{ $pswpLb.RelPermalink }}" integrity="{{ $pswpLb.Data.Integrity }}"></script>
  ```
  两个 UMD 已是 `.min.js`，**不需要再 `minify`**；但 `fingerprint` 必须留。
- 已有约定：`scripts/fix-offline-html.mjs:68` 会剥掉 `public-local/` 里**所有** `integrity=`（`file://` 下 SRI 无法校验，不剥会整份资源被拦）。这是既有行为，新加的 SRI 会被同样处理，符合预期。
- 按 Q13 的决定，CSS 与 JS **全站加载**（不做按页判断），保持行为最一致。

### 2.9 初始化脚本

放进 `assets/js/theme.js`（保持「零运行时依赖、单文件 ES5」的约定），在 `ready()` 里加一个 `initZoom()`：

```js
function initZoom() {
  if (!window.PhotoSwipeLightbox) return;      // 优雅降级：库没加载就什么都不做
  var galleries = document.querySelectorAll('.md-zoom');
  if (!galleries.length) return;
  new window.PhotoSwipeLightbox({
    gallery: '.article-body',                  // 容器：正文
    children: 'a.md-zoom',                     // 子元素：我们构建期写好的锚点
    pswpModule: window.PhotoSwipe,
    showHideAnimationType: prefersReducedMotion() ? 'none' : 'zoom',
    bgOpacity: 0.9
  }).init();
}
```

要点：

- **不需要任何 DOM 手术** —— 锚点已经在 HTML 里了。
- `gallery` 用正文容器、`children` 用 `a.md-zoom`：PhotoSwipe 的事件是**委托**在容器上的，子元素在**点击时**才收集（源码：`init()` 里 `addEventListener("click", onThumbnailsClick)`，`loadAndOpen` 里 `querySelectorAll(children)`），所以完全不存在 reimu 那个「init 时快照为空」的问题。
- `showHideAnimationType` 跟随 `prefers-reduced-motion` —— 这是 `ARCHITECTURE.md:127-146` 的既有约定，必须遵守。
- 若将来要支持多组画廊（比如会员相册各成一组），给每组的容器一个 `data-pswp-gallery="<id>"`，初始化时按容器分别 `init()`。本期只做正文，所以不需要。

### 2.10 样式与无障碍

- **深色模式**：`photoswipe.css` 用自带变量。syfzsh 的深色模式是 `assets/css/tokens.css` 里的一套 CSS 变量，需要把 PhotoSwipe 的 `--pswp-*` 变量在深色选择器下重新映射，否则深色页面上打开白底灯箱会闪眼。**新样式按 `ARCHITECTURE.md:112-126` 的分层规则放进 `pages.css`（页面级），不要塞进 `components.css`。**
- **`cursor: zoom-in`**：给 `a.md-zoom` 加上，让「可点开放大」这件事可被发现。这是 reimu 没做的（它没有任何视觉提示，只能在 README 之外口口相传）。
- **无障碍**：
  - `<a>` 是天然可聚焦元素，键盘用户能 Tab 到并回车打开 —— 这点比 reimu 好（它也是 `<a>`，但由 JS 事后插入，且在 `init` 快照为空时可能根本不存在）。
  - PhotoSwipe 自带 `Escape` 关闭、方向键翻页、焦点陷阱；官方 UI 是内联 SVG，无 i18n 依赖。
  - **PhotoSwipe 的 aria label 默认是英文**。若要中文化，在初始化时传入 `closeTitle` / `zoomTitle` / `arrowPrevTitle` / `arrowNextTitle` / `errorMsg` / `loadingMsg` 等选项（这些是它公开的 option，需在实现时对照 5.4.4 的 option 名核对一遍）。本站是中文站，建议做。
  - `alt` 会自动从 `<img>` 流进 PhotoSwipe（见 §2.5 源码），所以**正文图的 alt 质量直接决定灯箱的无障碍质量** —— 这也是 `render-image.html` 把 `.PlainText` 当 alt 的既有约定的额外收益。

### 2.11 出口：哪些图不参与放大

复用**已有的 `plain` 版式关键字**，再加三条自动跳过规则：

```markdown
![说明](/uploads/xxx.jpg "plain")     ← 输出裸 <img>，不包锚点、不参与放大
```

自动跳过（不需要作者写任何东西）：

| 情况 | 为什么 |
| --- | --- |
| 外链图（`http://` / `https://` / `//`） | 构建期拿不到尺寸，写不出 `data-pswp-width/height` |
| GIF（`img.html` 刻意不转码以保动画） | 同理：尺寸虽有（Hugo 能解码 gif），但不值得为动图做灯箱 |
| SVG | 矢量图没有像素尺寸 |
| `assets/` 里找不到的图（历史 `static/uploads/` 引用） | 构建期无尺寸 |
| 已经被 `<a>` 包裹的图 | 那层链接有它自己的语义（比如链到文章），不该被顶掉 |

**无 JS 时的行为**：锚点仍在，点击在新标签页打开 2000px 大图 —— 这叫渐进增强，reimu 在 CDN 挂掉时恰好也是退化成这个（但它的图本身是隐形的，见 §2.2）。

### 2.12 逐步执行清单（将来实施时照着做）

| # | 文件 | 动作 | 验收 |
| --- | --- | --- | --- |
| 1 | `assets/vendor/photoswipe/` | 新建，放 `photoswipe.css`、`photoswipe.umd.min.js`、`photoswipe-lightbox.umd.min.js`（5.4.4） | 三个文件在 `assets/` 下，Hugo 能 `resources.Get` 到 |
| 2 | `layouts/partials/head.html` | 在 `site.css` 之后追加独立 `<link>` | 页面出现两个 stylesheet，第二个带 `sha256-` SRI |
| 3 | `layouts/partials/scripts.html` | 在 `theme.js` 之前追加两个经典 `<script>` | `curl` 页面能查到 `photoswipe.umd.min.js` 在 `theme.js` **之前** |
| 4 | `layouts/partials/components/img.html` | 增加「放大档」输出（返回一个 dict 或新增 partial），生成 2000px 衍生物并回传其 `.RelPermalink`/`.Width`/`.Height` | 构建后 `public/uploads/**` 出现 2000px 后缀的 `_hu_*.webp` |
| 5 | `layouts/_default/_markup/render-image.html` | 在 `figure` 分支里给 `<img>` 包 `<a class="md-zoom" …>`；`plain` 分支与三条自动跳过规则保持裸 `<img>` | 正文页出现 `<a class="md-zoom" data-pswp-width=…>`；`plain` 的图没有 |
| 6 | `assets/js/theme.js` | 加 `initZoom()`，在 `ready()` 里调用 | 有图页面点击图片能打开灯箱；无 JS 时点开新标签大图 |
| 7 | `assets/css/pages.css` | `a.md-zoom { cursor: zoom-in }` + 深色模式下的 `--pswp-*` 变量映射 | 深色模式下灯箱配色正常，不刺眼 |
| 8 | `docs/` 与 `WRITING.md` | 记录 `plain` 的双重含义（不当正文插图 + 不放大）与放大档的存在 | 编辑者知道怎么写「这张图不要放大」 |

**不要做的事**（reimu 的弯路）：不要引入 `safeImport`/Blob/`type="module"`；不要在 `theme.js` 里遍历 `.article-body img` 去包锚点；不要用 pjax（本站没有）。

### 2.13 回归清单

- `npm run build` 通过，`Processed images` 数量约为原来的 2 倍（正文图多一档）。
- `npm run build:local` 仍能 `file://` 双击打开，**且灯箱可用**（这正是选 UMD 的原因）。
- 无 JS 打开正文页：图片正常显示、可点开大图。
- 首屏没有任何布局跳动（CLS）：`<img>` 的 `width`/`height` 仍在。
- 会员名录页（`photo-grid`，本期范围外）行为**不变**。
- 深色模式、`prefers-reduced-motion` 两种状态下都验一遍。
- 键盘：Tab 到图片 → 回车打开 → `Escape` 关闭 → 焦点回到原处。

---

## 3. 特性二：图片懒加载

### 3.1 reimu 怎么做的

**库**：lazysizes **5.3.2**，只用核心包，`afterFooter.html:6` 无条件加载（`data/vendor.yml:14-16`）。

**它对正文图的处理，同样是对已渲染 DOM 的事后改造**（`assets/js/pjax_main.ts:178-187`）：

```js
// lazyload
_$$(".article-entry img").forEach((element) => {
  if (element.classList.contains("lazyload")) return;
  element.classList.add("lazyload");
  element.setAttribute("data-src", element.src);   // 把 src 搬到 data-src
  element.setAttribute("data-sizes", "auto");
  element.removeAttribute("src");                  // 然后摘掉 src
});
```

**CSS 是契约的一半**：`.article-entry img { opacity: 0 }`，只有 lazysizes 加上 `.lazyloaded` 才 `opacity: 1` + 淡入动画（`assets/css/partials/article.scss:206-223`）。深色模式下还要额外把那套动画覆盖掉（`assets/css/_variables.scss:102-116`），并且专门写了 `.pswp__img { opacity:1; filter:none; animation:none }` 来**排除灯箱**——即懒加载的淡入会污染 PhotoSwipe 的图。

### 3.2 为什么不该照搬

**它是 fail-closed 的。** 因为没有 `<noscript>`、没有并列的 `src` 兜底、没有 `no-js` 类（三者 grep 全空）：

- **JS 关闭** → 图永远停在 `opacity: 0` → **整站图片隐形**（不是「不懒加载」，是「看不见」）。
- **lazysizes 加载失败**（CDN 被墙、SRI 不匹配）→ 改写已经把 `src` 删了 → 图既没有 `src` 也不可见。

而 syfzsh 现在用的是**原生 `loading="lazy"`**：JS 关了照常显示，库挂了不存在这个问题，零 JS 体积。

**结论：保留原生 `loading=lazy`，只做「补齐 + 修正」。**

### 3.3 syfzsh 的现状与三处缺陷

`img.html` 输出 `loading`（默认 `lazy`）与 `decoding="async"`，调用方按需传 `eager`。改动前的实测分布（生产 baseURL 构建）：**38 张图，6 张 `eager`，32 张 `lazy`，0 处 `fetchpriority`**。

三处缺陷：

1. **fallback 分支完全没有 `width`/`height`**。`img.html` 里 `resources.Get` 拿不到（文件不在 `assets/`）或格式不可处理（gif/svg）时走 fallback，那一段原本连宽高属性都不输出 → 会招 CLS。
2. **正文图全部默认 `lazy`**，`render-image.html` 两个分支都没传 `loading`。
3. **文章头图没有 `fetchpriority`**，与正文图、侧栏图、页脚 logo 同优先级抢带宽。

### 3.4 本轮已实现的改动（实测结果）

改动集中在 `img.html`、`render-image.html`、`single.html`、`featured.html`、`thumb.html`。

**（1）fallback 分支补尺寸。** 关键认识：「不转码」不等于「读不出尺寸」。gif Hugo 能解码，所以刻意不转码（保动画）的 gif **仍然可以**输出真实宽高：

```gotemplate
{{- with $res -}}
  {{- $sub := .MediaType.SubType -}}
  {{- if in (slice "jpeg" "png" "webp" "bmp" "tiff") $sub -}}
    {{- $processable = true -}}
  {{- else if eq $sub "gif" -}}
    {{- $rawW = .Width -}}
    {{- $rawH = .Height -}}
  {{- end -}}
{{- end -}}
```

**已用一个 4×2 的合成 GIF 实测**：输出 `<img src="/syfzsh/uploads/probe/pixel.gif" width="4" height="2" …>`，且**保持 `.gif` 未被转成 WebP**（动画未丢）。验证后该测试文件已从仓库外删除，未进入站点。

**仍无法补的情况（如实说明）**：SVG（矢量图无像素尺寸）、外链图、以及 `assets/` 里找不到的历史 `static/uploads/` 引用。对它们建站期确实拿不到尺寸。彻底解决只有三条路，都有代价：改用 `resources.GetRemote`（构建期联网抓取 + 解码，冷缓存会失败并且会让构建依赖网络）、在 front matter / 数据文件里维护一份尺寸表（多一个真相来源、会漂移）、或运行时用 JS 补（就回到 reimu 那条路，且 CLS 已经发生）。**本期不做**，在下面的「待核实」里留档。

**（2）正文首屏图 `eager`。** 用 `.Ordinal`（Hugo 给图片渲染钩子的页内序号，从 0 开始，**已实测可用**）判断是不是第一张：

```gotemplate
{{- $loading := "lazy" -}}
{{- $fetchpriority := "" -}}
{{- if and (eq .Ordinal 0) (not .Page.Params.image) -}}
  {{- $loading = "eager" -}}
  {{- $fetchpriority = "high" -}}
{{- end -}}
```

**为什么加 `not .Page.Params.image` 这个条件**：文章有头图时，头图在折叠线以上、是真正的 LCP，正文第一张图在下面。两张都标 `high` 只会让浏览器把带宽分给看不见的那张，**反而拖慢 LCP**。所以规则不是「第一张正文图一律 eager」，而是「**没有头图时**，第一张正文图才是首屏图」。

**（3）头图 `fetchpriority="high"`**：`single.html` 的文章头图，以及首页图片新闻轮播的第一张（`featured.html` → `thumb.html` → `img.html`，新增了 `fetchpriority` 参数透传）。

**实测（生产 baseURL 构建）**：

| 指标 | 改动前 | 改动后 |
| --- | --- | --- |
| `fetchpriority` 出现次数 | 0 | **6**（首页轮播第一张 1 + 文章头图 5） |
| `eager` / `lazy` | 6 / 32 | 6 / 32 |
| 带 `width`/`height` 的 `<img>` | 38 / 38 | 38 / 38 |

**归一化后与改动前逐字节一致**：把新产物里的 `fetchpriority="…"` 全部删掉，再与改动前的产物 `diff -r`，**零差异**。也就是说这三处改动没有触及其它任何输出。

### 3.5 一个必须如实说明的结论

**缺陷（2）在当前内容上不会触发。** 本站所有带正文图的页面（4 篇 + 1 篇空 alt）**都同时设了 `image:` 头图**，另外两篇有正文图的会员页也有 `logo`。所以按上面那条正确规则，它们的正文图**应当**保持 `lazy` —— 实测确实是 32 张 `lazy`，与改动前一致。

换句话说：审计报告里「正文图全部默认 lazy」这一条，在本站**其实是正确行为**，不是缺陷。这条规则真正的价值是**防止将来回归** —— 一旦出现「没有头图、但正文有图」的页面（很可能是常态），第一张图就会自动拿到 `eager` + `high`。这一点写在这里，是为了避免以后有人看到「这条改动没有任何输出变化」而把它当死代码删掉。

### 3.6 遗留与将来对策

- SVG / 外链 / 历史 `static/uploads/` 引用仍无宽高 → 见 §3.4。
- `hugo.toml:76` 的注释**已经过期**：它写着「本站 `content/` 下目前 **0 处** Markdown 图片语法，开这个开关零风险」，而实测**现在是 5 处**（`content/members/directory/member-01.md:22`、`content/members/directory/jincheng-youpin.md:82`、两篇 2026-09-30 国庆新闻、`content/news/notice/2026-09-27-ceshi2.md:13`）。`wrapStandAloneImageWithinParagraph = false` 是 `render-image.html` 能拿到 `.IsBlock` 的前提，而「零风险」这个论据已经不成立 —— **建议单独改一次这条注释**（本轮按「只改两处」的范围没有动它）。顺带实测确认：被 blockquote 包住的 Markdown 图（`member-01.md:22` 的 `> ![tkmiz](…)`）**同样**会产出 `<figure class="md-figure md-figure--center">`，所以上面放大方案里「统一包 `<a>`」对所有位置都成立。

---

## 4. 特性三：Algolia 搜索

### 4.1 reimu 的完整链路

```
(1) 站点主自己的 hugo.toml（主题不自带）
      [outputs] home = ["Algolia", "HTML", "RSS"]
      [outputFormats.Algolia]
        baseName = "algolia"; isPlainText = true
        mediaType = "application/json"; notAlternative = true
                    ↓
(2) hugo 构建 → 用 layouts/_default/list.algolia.json 渲染
      产出 public/algolia.json（多语言时还有 public/en/algolia.json）
                    ↓
(3) 上传 —— 100% 在仓库之外，仓库里没有任何代码做这件事
      3a. 人在 Algolia 后台点「Add records → 上传文件」
      3b. npx cross-env ALGOLIA_APP_ID=… ALGOLIA_ADMIN_KEY=… \
            ALGOLIA_INDEX_NAME=… ALGOLIA_INDEX_FILE=algolia.json atomic-algolia
                    ↓
(4) 构建 HTML：afterFooter.html:36-58 注入 window.ALGOLIA_CONFIG
      然后从 CDN 拉 algoliasearch-lite + instantsearch，再跑 algolia_search.ts
                    ↓
(5) 浏览器：DOMContentLoaded → instantsearch({...}).start()
      直接向 *.algolia.net 发请求（带 Search-Only Key）
```

**索引模板** `layouts/_default/list.algolia.json:1-18`：

```gotemplate
{{- $limit := 1000 -}}
[
  {{- range $index, $entry := where .Page.Site.RegularPages "Section" "in" .Site.Params.mainSections -}}
  {{ if $index }}, {{ end }}
  {
    "objectID": "{{ sha1 .RelPermalink }}",
    "permalink": "{{ .Permalink | relURL }}",
    "title": {{ .Title | jsonify }},
    "content": {{ .Plain | truncate $limit | jsonify | safeJS }},
    "date": {{ .Date.Format $.Site.Params.timeFormat | jsonify }},
    "updated": {{ .Lastmod.Format $.Site.Params.timeFormat | jsonify }}
  }
  {{- end -}}
]
```

- **粒度是「一页一条」**，不按标题切。
- 只索引 `mainSections`（默认 `["post"]`）下的 `RegularPages`。
- `content` 是**全文** `.Plain`（不是 `.Summary`），`WordCount > 1000` 才截断。
- `objectID = sha1(.RelPermalink)`：改 slug 会产生新 ID，旧记录要靠同步工具删。

**配置表面**（`config/_default/params.yml:487-493`）：

```yaml
algolia_search:
  enable: false
  appID:
  apiKey:
  indexName:
  hits:
    per_page: 10
```

注意：键是 `appID`（注入 JS 时才改名成 `applicationID`）；**没有 `labels.*` 参数**，文案来自 i18n（`i18n/*.yml` 的 `algolia.input_placeholder` / `hits_empty` / `hits_stats`）。`enable` 在 **5 个地方**同时把关：`header.html:32` 的触发按钮、`baseof.html:51-67` 的弹层 DOM、`404.html:24-38` 的同一份 DOM、`afterFooter.html:36` 的配置与脚本、`main.scss:324` 的样式导入。

前端 CDN（`data/vendor.yml:38-43`）：

```yaml
  algolia:
    src: webcache|algoliasearch@4.17.1/dist/algoliasearch-lite.umd.js
  instantsearch:
    src: webcache|@reimujs/instantsearch.js@4.57.0-beta.1/dist/instantsearch.production.min.js
```

**`@reimujs/instantsearch.js` 是第三方 fork，且版本号是 beta**（自带 banner 写 `InstantSearch.js UNRELEASED`），不是官方 `instantsearch.js`。

### 4.2 硬前置（site owner 必须自己提供）

1. Algolia 账号 + application。
2. 一个索引，名字与 `algolia_search.indexName` 一致。
3. Application ID → `appID`。
4. **Search-Only Key** → `apiKey`（会明文写进每个页面的 HTML）。
5. **Admin Key**（保密）—— 只在上传那一步用，绝不能进构建产物。reimu 的 README 专门用粗体警告过这点。
6. 站点自己的 `hugo.toml` 里加 `[outputFormats.Algolia]` 与 `[outputs]`（**主题不自带**）。
7. **一条「构建后把 `algolia.json` 推上去」的流水线** —— 手动，或自建 CI 并把 Admin Key 放进 secret。
8. 能访问 `npm.webcache.cn`（或覆盖 `data/vendor.yml` 自托管）。

缺任何一条的表现：`enable: false` → 完全没有搜索 UI；key 缺失但 `enable: true` → `console.error("Algolia Settings are invalid.")` 并 **early return**，于是**连弹层触发器的点击都没绑上**，点搜索图标毫无反应。

### 4.3 为什么本报告建议不移植

| # | 理由 | 依据 |
| --- | --- | --- |
| 1 | **一定要外部账号 + 一条仓库外的同步流水线** | 仓库里没有 `.github/`、没有 CI、没有 `atomic-algolia` 依赖；只有 README 的两行命令 |
| 2 | **文档推荐的 CLI 已废弃** | `atomic-algolia` npm 0.3.19 停在 2020-08，最后一次提交 2024-01；官方**没有**「把构建产物推索引」的 GitHub Action（唯一的官方 Action 是 Crawler，且需要 Crawler Public API 权限） |
| 3 | **免费档在许可证上不允许正式站点** | Algolia Build 计划条款：*"provided only for evaluation purposes and may not be relied on by Subscriber for production or other commercial use"*；超限时可能 *"apply an Algolia attribution to the search results"*；可单方终止；30 天不活动删数据 |
| 4 | **DocSearch（免费的合规路径）大概率走不通** | 官方*"Open to developer documentation and technical blogs"*，且*"we usually turn down applications … [with] non-technical content"*。商会站点属于非技术内容 |
| 5 | **依赖一个 fork 的 beta 包** | `@reimujs/instantsearch.js@4.57.0-beta.1`，非官方 |
| 6 | **规模不划算** | 41 页 ≈ 41 条记录。为它永久维护一个 Admin Key secret + 同步流水线 |

补充：**本站的搜索现状并不差**。`initSearch()`（`assets/js/theme.js:242-314`）读 `searchindex.json` 做**字符级子串匹配**。对中文来说，字符级匹配 ≈ 精确子串匹配，召回其实优于很多「通用」库 —— **MiniSearch 与 Lunr 的默认分词只按空白/标点切，一串没有空格的中文会变成一个 token**（MiniSearch 的 issue #201 至今开着），换上去是**退步**。本站真正的短板不是分词，而是**排序**（没有相关性、没有标题加权）、**多词 AND**、以及**摘要高亮**。

### 4.4 如果将来一定要接，怎么做

1. `hugo.toml` 加 output format（照 §4.1 第 (1) 步）。**注意别和已有的 `searchindex` 冲突** —— 现在是 `home = ["HTML", "RSS", "searchindex"]`，要变成 `["HTML", "RSS", "searchindex", "Algolia"]`。
2. 照 `list.algolia.json` 写一份模板，但**字段要对齐本站需要**：本站有 `type: member` 的会员条目（会被 `RegularPages` 收进去），要不要索引它们是个决定。
3. **只放 Search-Only Key 进页面**；Admin Key 只进 CI secret。
4. 上传步骤放在 `actions/upload-pages-artifact` **之后**还是之前，要明确 —— 建议在部署成功后，避免「索引里已有、页面还没上」。
5. 前端只引 **css/js**，不引 reimu 的弹层 DOM（它硬编码在 `baseof.html` 与 `404.html` 两处，还要改 `#reimu-*` 一堆 id）。本站已有 `/search/` 页面和 `initSearch()`，把它换成 instantsearch 的 widget 容器是更小的改动面。
6. 别忘了 `queryLanguages: ["zh"]` —— Algolia 需要显式开启中文分词。
7. 因为 `_highlightResult` 存在时 reimu 的模板把标题塞进 `title="…"` 属性且**未转义**，自己写模板时记得转义。

### 4.5 替代方案（全部 $0、无后端，按推荐度排序）

| 排序 | 方案 | 成本 | 中文 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | **保留现有搜索，升级打分**（bigram 二元组 + 标题加权 + 多词 AND + 摘要高亮） | $0，改 `theme.js` | 最好（无需分词） | 无新依赖、不破坏零依赖约定。**最高性价比** |
| 2 | **Fuse.js** | $0，~30 分钟 | 尚可 | 近乎直插替换（`new Fuse(list,o).search(q)` 替掉那段 `filter`）；字符级模糊对短标题够用；20.5k★ 活跃 |
| 3 | **FlexSearch + `Charset.CJK`** | $0，~1 小时 | 好 | 内置 CJK 编码器；13.8k★ 活跃 |
| 4 | **Pagefind** | $0，但要**在 CI 加一条 post-build 命令** | 最好（`zh-*` 专门分词） | 静态搜索里工程质量最高；代价是引入自己的 `_pagefind/` 产物与 UI，破坏「零构建」 |
| — | MiniSearch / Lunr / Stork | $0 | **差或已停维护** | Lunr 最后提交 2024-07；Stork 最后发版 2023-01 |
| — | Typesense Cloud ≈$21.6/月、Meilisearch Cloud $20+/月 | 有月费 | 好 | **要服务器，破坏纯静态无后端模型** |

---

## 5. 从这次移植里提炼的原则

1. **先看受体有没有「服务端钩子」，再决定抄不抄客户端的变通。** reimu 的图片 JS 全是在补偿它没有 `render-image.html`。有钩子就不该在浏览器里补。
2. **不要引入「JS 一挂内容就消失」的降级方式。** lazysizes 那套 `opacity:0` + `.lazyloaded` 是 fail-closed；原生 `loading="lazy"` 是 fail-open。同样功能的两种做法，故障时的表现差一个数量级。
3. **`file://` 是本站的硬约束。** 它直接排除了 ESM（`<script type="module">` 在 `file://` 下被 CORS 拦死），因此排除了 reimu 的 `safeImport` 路线。
4. **别把「第三方库的版本节奏」绑上自己的主样式表。** 这是 `site.css` 合并方案的隐藏代价，也是选方案 2 的原因。
5. **凡是要外部账号 + 手工步骤的功能，先算「长期维护成本」，不要只算「接入成本」。** Algolia 的 41 条记录就是这个问题的教科书案例。
6. **移植前先量一遍受体现状。** 本次「正文图全部 lazy」这条审计结论，实测下来在本站是**正确行为**而不是缺陷（§3.5）—— 量过才知道哪条该修、哪条不该动。

---

## 6. 待核实清单

实施 §2 之前需要确认的：

1. **2000px 放大档的单张体积**：用本站最大的几张（`jiandan_upscayl_4x_ultrasharp.png`、`屏幕截图-*.jpg`）实测。竖图按宽 2000 可能过大，需要改成按长边限制或降 quality。
2. **`%dx` 对超大宽高比图片的行为**：确认不会产生异常巨大的高度。
3. **PhotoSwipe 5.4.4 的无障碍 label option 名**：`closeTitle` / `zoomTitle` / `arrowPrevTitle` / `arrowNextTitle` / `loadingMsg` / `errorMsg` 需对着 5.4.4 的 option 定义核对（中文站的 a11y 值得做）。
4. **深色模式下 `--pswp-*` 变量的实际变量名与取值**：需对着 `photoswipe.css` 逐个映射到本站 `tokens.css` 的变量。
5. **`data-pswp-srcset` 的浏览器收益**：确认 PhotoSwipe 内部对 srcset 的选择逻辑符合预期后再决定是否加。
6. **UMD 版的体积与 gzip 后大小**：`54,495 + 14,569 B` 是原始值，gzip 后约 25–28 KB，需实测确认。
7. **`resources/_gen` 对 CI 的影响**：`resources/_gen/` 被 `.gitignore` 忽略，所以每次 CI 都要重新生成衍生物。多一档放大图会让构建变慢 —— 实测当前全站构建约 1.3 秒，多一档后的实际耗时要量。

本文档中所有 `hugo-theme-reimu` 的行号与代码片段，均来自对 commit `246177b`（v0.16.1）源码的直接阅读；PhotoSwipe 的 DOM 契约来自对 `photoswipe@5.4.4/dist/photoswipe-lightbox.esm.min.js` 源码的直接核对。`syfzsh` 的实测数据来自用仓库自带 `hugo v0.167.0`、以生产 `baseURL` 构建的产物。

---

*状态：方案（§2 未实施；§3.4 已实施并回归通过） · 日期：2026-10-03 · 相关文档：`docs/README.md`*
