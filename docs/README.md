# docs/ —— 专题文档

> **注（2026-10）：Decap CMS（`/admin/` 本地内容后台）已从本站移除**，仓库根目录的常驻
> 文档由四份变成**三份**（`ARCHITECTURE.md` / `STRUCTURE.md` / `WRITING.md`），`CMS.md` 已删除。
> 本目录下面的记录保留原文，只加过期提示。

本目录放**专题级**分析与方案。仓库根目录的三份文档（`ARCHITECTURE.md` / `STRUCTURE.md` / `WRITING.md`）描述的是**站点当前的形态与约定**；这里的四份是对**某一次具体决策**的分析与记录，做完就该归档，不该混进根目录的常驻文档。

## 四份文档

| 文档 | 回答什么问题 | 状态 |
| --- | --- | --- |
| [`PORTING-FEATURES.md`](PORTING-FEATURES.md) | 参照 `hugo-theme-reimu` 梳理**图片放大 / 图片懒加载 / Algolia 搜索**三个特性：它怎么实现的、能不能移植、怎么移植 | 图片放大部分是**方案（未实施）**；懒加载部分**已实施**（见下）；Algolia 结论是**不移植** |
| [`THEME-EXTRACTION.md`](THEME-EXTRACTION.md) | 为什么本站没有 `themes/`、能不能抽成主题、风险和分阶段步骤 | **方案（未实施）**。结论是现在不做 |
| [`IMAGES-AND-OSS.md`](IMAGES-AND-OSS.md) | 图片放哪里、阈值与费用、备案约束，以及**整站国内可达性** | **方案（未实施）**。⚠️ **部分结论已被 `HOSTING-DECISION.md` 取代**（见该文顶部横幅） |
| [`HOSTING-DECISION.md`](HOSTING-DECISION.md) | 要不要迁腾讯 EdgeOne / 挂 CDN / 跑备案？免费方案到底能不能提速？ | **决策记录，全部搁置，不实施**。域名后缀已定 `.org`；写明了**可达性触发条件** |

建议阅读顺序：想知道国内访问到底怎么办 → **先读 `HOSTING-DECISION.md`**（它是最新结论）；想动图片 → `PORTING-FEATURES.md`；想知道要不要抽主题 → `THEME-EXTRACTION.md`。

---

## 本轮实际改了什么代码

只动了**两件事**（其余全部只写在文档里）。

### 一、图片 CDN 扩展点（默认关闭，零行为变化）

- 新增 `layouts/partials/components/cdn-url.html`。
- `layouts/partials/components/img.html` 的站内图片 URL 统一过一道 `cdn-url.html`。
- `hugo.toml` 的 `[params]` 增加两个键：`cdnBase = ""`、`cdnStripBasePath = false`。

**`cdnBase` 为空时，输出与改动前逐字节一致** —— 已实测：把新产物里的 `fetchpriority` 属性全部删掉后与改动前产物 `diff -r`，**零差异**。

将来要迁 CDN 时，只需填一个域名 + 加一条 workflow，**不用改任何模板**。

> ⚠️ **但后续的 `HOSTING-DECISION.md` 判定这个开关在新路线下大概率用不上** —— 因为 CDN 是「整站挂在前面」，图片自然跟随，不需要单独的图片域名。它无害（默认空、零输出变化），保留即可，但**不要把它当成核心机制**。

### 二、懒加载的三处修正

1. `img.html` 的 fallback 分支补 `width`/`height`（此前完全不输出，会招 CLS）。已用一个合成的 4×2 GIF 实测：输出 `width="4" height="2"` 且**保持 `.gif` 未被转码**（动画未丢）。
2. `render-image.html` 用 `.Ordinal` + 「本页有没有头图」判断正文首屏图，给它 `eager` + `fetchpriority="high"`。
3. 文章头图与首页轮播第一张加 `fetchpriority="high"`（`single.html`、`featured.html`、`thumb.html`）。

实测：`fetchpriority` 从 0 处变为 **6 处**（轮播第一张 1 + 文章头图 5），全部落在真正的 LCP 候选上；`width`/`height` 覆盖率保持 38/38；`eager`/`lazy` 分布不变。

> 第 2 条在当前内容上**不会产生任何输出变化** —— 因为本站所有带正文图的页面都同时设了头图，按正确规则它们的正文图本就该保持 `lazy`。详见 `PORTING-FEATURES.md` §3.5。**别把它当死代码删掉。**

回归：生产 `baseURL` 构建通过（71 页 / 40 静态文件 / 27 张已处理图片 / 11 个别名，与改动前一致）；`--minify` 生产构建通过；`build:local` 离线构建通过。

---

## ⚠️ 顺带发现：离线预览版 `npm run build:local` 是坏的（既有 bug，与本次改动无关）

**已实测归因**：改动前的产物与改动后的产物在这个问题上**完全一致**，所以不是本次引入的。

**症状**：`public-local/` 里**样式表、脚本、导航链接、图片全部指向不存在的路径**。

```
page : public-local/news/association/qinglian-weiwen-gongjiawan.html
link : <link rel="stylesheet" href="./syfzsh/css/site.min.<hash>.css">   ← 文件在 public-local/css/…
img  : <img src="../../syfzsh/uploads/...">                              ← 文件在 public-local/uploads/…
nav  : <a class="brand" href="./syfzsh/index.html">                      ← 文件在 public-local/index.html
```

**实测计数**：`0/38` 张图片可解析，`2/3661` 个 `href`/`src` 可解析。也就是说双击打开得到的是一个**没有样式、没有 JS、没有图**的裸页面。

**根因**：`hugo.toml` 的 `baseURL` 带 `/syfzsh/` 子路径，而 `hugo.local.toml` 打开了 `relativeURLs`。Hugo 把资源 URL 相对化时会**连同 `baseURL` 里的子路径段一起保留**（`/syfzsh/uploads/x.webp` → `../../syfzsh/uploads/x.webp`），但产物目录里根本没有 `syfzsh/` 这一层。GitHub Pages 之所以没暴露这个问题，是因为它把产物根**挂载在** `/syfzsh/` 上；`file://` 没有这种挂载。

**连带后果**：`scripts/fix-offline-html.mjs` 的「目录式链接 → `.html`」那一步**静默失效**（报告 0 处改写）—— 因为它的判据是「先问磁盘再改」，而所有候选路径在磁盘上都不存在。

**已验证的修法**（一行）：在 `hugo.local.toml` 里加

```toml
baseURL = "/"
```

实测结果：图片 **38/38** 可解析、`href`/`src` **3740/3740** 可解析，且 `fix-offline-html.mjs` 的那一步开始正常工作（报告 **330 处**改写）。

**为什么本轮没有改**：本轮范围被明确限定为「`cdnBase` + 懒加载三处修正」，这是一处独立的既有 bug，应当单独一次改动 + 单独回归。**建议尽快修**，因为 `hugo.local.toml` 的注释和 `fix-offline-html.mjs` 的注释都建立在「除了 SRI 之外一切正常」这个（已经不成立的）前提上。

---

## 关键结论速查

- **图片放大**：能移植，但**不要照搬**。reimu 是在浏览器里事后包 `<a>`，因为它在构建期拿不到图片尺寸；本站有 `render-image.html` 钩子，应当在**构建期**就输出 PhotoSwipe 契约。另外必须用 **UMD** 而非 ESM，否则 `file://` 离线版会丢掉放大功能。
- **懒加载**：**不要**引入 lazysizes。它的 CSS 契约是 `opacity: 0` + `.lazyloaded`，属于 fail-closed —— JS 一挂整站图片**隐形**。原生 `loading="lazy"` 是 fail-open。
- **Algolia**：不移植。它需要外部账号 + 一条**仓库之外**的索引同步流水线（文档推荐的 `atomic-algolia` 已废弃），免费档在许可证上仅限评估用途，DocSearch 对非技术内容大概率拒。**而且本站现有的字符级子串搜索对中文其实优于 MiniSearch / Lunr**（它们的默认分词会把一整串无空格中文切成一个 token）。真正的短板是排序与高亮，不是分词。
- **图片存储**：现在什么都不用做。费用与容量都不会成为瓶颈 —— 实测 `public/` 只有 **24.36 MB**（距 GitHub Pages 的 1 GB 站点上限还有约 42 倍余量），全站最重页面的图片合计 **681 KB**，所以 100 GB/月的软带宽上限对应的是**十万量级**的月浏览（保守下限口径才是 13,000 次）。5/50/200 GB 月流量约 ¥1.29 / ¥12.76 / ¥51.01 —— **注意这只是"流量费"口径，不含大陆节点必须的「备案资源地板价」（≈¥420/年，见下）**。唯一真正的理由是**国内可达性** —— 而**只迁图片解决不了它**，`github.io` 打不开时再快的图也没用，HTML 必须一起迁。
- **备案是硬前置**：阿里云 OSS 自 2022-10-09 起对新账号用**默认域名**访问任意文件都会加 `Content-Disposition: attachment`（图片会被强制下载而不是显示），所以服务图片**必须自定义域名 → 必须 ICP 备案**。不存在「免备案直用 OSS 默认域名」这条路。
- **主题化**：不做。真实成本不在搬运 41 个文件，而在**没有 `i18n/`、18 个 layout 写死中文**，以及 `[module.mounts]` 的静默陷阱（主题绝不能声明自己的 mounts）。
- **托管与大陆加速（最新结论，见 `HOSTING-DECISION.md`）**：
  - **不迁 EdgeOne 个人版**（¥29.9/月）。没有备案它只能用「全球（不含中国大陆）」，**没有大陆节点**，比 Cloudflare 免费版更差。
  - **免备案 = 拿不到真正的大陆速度提升，没有例外。** Cloudflare 免费版无任何大陆节点（实测 TTFB 约 100–200 ms，社区叫它「减速器」）；`优选IP` 已构成 ToS 违规（§2.2.1(b)，2024-12-03 起）。
  - **但可达性有解**：自有域名 + Cloudflare 让访客不再接触 `github.io`，绕开运营商对它的封锁/DNS 污染。**这是可达性收益，不是速度收益。**
  - **Cloudflare 免费版挂不上 `/syfzsh/` 子路径**（Host 头覆盖是 Enterprise 专属）→ 唯一可行做法是在 GitHub Pages 填自定义域名，**站点搬到根路径**。好处是子路径陷阱与离线构建 bug **一并自愈**。
  - **大陆节点的真实地板价不是 CDN，是备案资源**：任何大陆节点方案都要额外持有一台合格资源（腾讯云正面清单 6 项，**不含 COS / CDN / EdgeOne**），最便宜 Lighthouse ¥35/月、包年包月 ≥3 个月 ⇒ **≈ ¥420/年**。备案本身 4–8 周。
  - **个人备案跑商会网站是明文红线**（甘肃管局承诺书：违规将「注销网站，并将主体和域名加入黑名单」）。要走就走**单位备案**，用《社会团体法人登记证书》即可，不需要营业执照。
  - **当前决定：全部搁置**。域名后缀已定 `.org`，域名名字未定。

---

*状态：代码改动已实施并回归通过；`THEME-EXTRACTION.md` / `IMAGES-AND-OSS.md` / `HOSTING-DECISION.md` 为方案或决策记录（均未实施）· 日期：2026-10-03*
