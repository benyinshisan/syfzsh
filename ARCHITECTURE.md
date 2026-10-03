# 架构说明

面向要改模板的人。使用说明看 [README.md](README.md)，目录地图看 [STRUCTURE.md](STRUCTURE.md)，
CMS 机制看 [CMS.md](CMS.md)，写内容看 [WRITING.md](WRITING.md)。

## 1. 设计基调

三条贯穿全站的取舍：

1. **内容/配置驱动，模板里不写死内容。** 栏目标题、首页版块取数路径、页脚联系方式、
   右侧快捷入口、四页签 —— 全部来自 `hugo.toml` 或 `data/*.yaml`。模板只负责摆放。
2. **标题只有一处真相。** 首页板块标题不用字面量，而是 `site.GetPage $section` 取
   `.Title`，所以改 `_index.md` 就够了，不会出现「首页写 A、栏目页写 B」。
3. **零运行时依赖。** 没有 jQuery、没有构建工具链、没有 npm 依赖参与前端。
   `assets/js/theme.js` 是唯一一份 JS，ES5 语法，浏览器直接执行。

模板总量约 1400 行 Go template + 4 个 CSS 文件 + 1 个 JS 文件。

## 2. 数据流

```
data/home.yaml（版块配置）──┐
                           ├─→ layouts/index.html → partials/home/*.html
content/<栏目>/            ─┘                         │
                                                     ├─→ partials/components/section-head.html
                                                     └─→ partials/components/news-list.html

data/*.yaml ──→ partials/footer.html / home/friendlinks.html / components/sidebar.html
             └─→ partials/components/member-pages.html（会员顺序的唯一消费方）
                 └─→ home/members-wall.html / _default/directory.html / footer.html
```

## 3. 模板清单

### 骨架

| 文件 | 职责 |
|---|---|
| `_default/baseof.html` | 页面骨架：head / header / main / footer / scripts |
| `partials/head.html` | meta、Open Graph、RSS、**CSS Pipes 清单**、favicon |
| `partials/header.html` | 顶部工具条 + 站名横幅 |
| `partials/nav.html` | 主导航（移动端为横向滚动栏目条 + 「更多」面板） |
| `partials/footer.html` | 会员名录滚动（**首页不输出**，首页已有 LOGO 墙）+ 页脚联系信息 |
| `partials/scripts.html` | `#site-config` JSON + theme.js。**结构不要动** —— 它是 JS 读配置的唯一来源。里面每个值都跟了 `safeJS`，**别当多余删掉**：`<script>` 里的内容会被 Go 的 html/template 按 JavaScript 上下文再转义一次（不看 `type`），`jsonify` 的结果会被套上第二层引号，值里带上字面引号 → `fetch()` 解析不了 → 搜索页永远「索引加载失败」 |

### 组件（跨页面复用）

| 文件 | 职责 |
|---|---|
| `components/section-head.html` | **统一板块标题**。参数：`title` / `subtitle` / `href` / `more` / `tag` |
| `components/thumb.html` | **统一图片位**。有 `image` 出 `<img>`，没有出 `.media-ph` 占位块 |
| `components/member-logo.html` | 会员 LOGO 位。与 `thumb.html` 同，但占位块**不写字**（名号就在紧邻的卡片名里） |
| `components/news-list.html` | 通用新闻列表。参数：`pages` / `withDate` / `newDays` / `empty` |
| `components/sidebar.html` | 右栏：搜索 + 快捷入口 + 合作机构 |
| `components/breadcrumb.html` | 面包屑，走 Hugo 的 section 树，无需手工维护 |
| `components/pagination.html` | 分页器 |

### 页面

| 文件 | 对应 |
|---|---|
| `index.html` | 首页，8 个版块 partial（版块本体在 `partials/home/`） |
| `_default/list.html` | 栏目页，**自动判别一级/二级**（见下） |
| `_default/single.html` | 文章页 |
| `member/single.html` | 会员单位详情页，由 `type: member` 命中（见下） |
| `_default/directory.html` | 会员名录（`layout: directory`） |
| `_default/search.html` | 站内搜索（`layout: search`） |
| `index.searchindex.json` | 搜索索引输出格式 |
| `404.html` | 404 |

### 栏目页的两种形态

`_default/list.html` 用 `.Sections` 自动判别，不需要给栏目指定 `type`。
**两级形态都有分页器**，只是页面取集合的方式不同：

- **一级栏目**（`/news/`，有子目录）→ 先出子栏目入口卡片，再把各子栏目文章
  **汇总后分页**（`/news/page/2/`）
- **二级栏目**（`/news/notice/`，叶子）→ 本栏目文章分页

一级栏目若不特殊处理，`.Paginator.Pages` 只会拿到子栏目自身（而不是文章），
点进导航就是一个空页面。

> **⚠ 一个页面只能有一个 paginator。** `.Paginator` 与 `.Paginate` 共用同一份
> 缓存，先调谁就定死是谁的结果。所以 `.Paginator` 只能出现在叶子分支里；
> 一级栏目若先碰了 `.Paginator`，再 `.Paginate` 拿到的仍是那份「子栏目自身」
> 的缓存，汇总分页会静默失效（不报错，只是列表不对）。
> `components/pagination.html` 因此收的是显式传入的 `paginator`，不是 `.Paginator`。

### 条目型栏目（会员单位）

`hugo.toml` 的 `params.entrySections` 列出「一条目一页」的栏目
（默认 `["members/directory"]`）。一级栏目汇总文章时会**按栏目**排除它们 ——
会员企业不该被当成文章混进 `/members/` 的栏目列表里。

按栏目而非按 front matter 字段排除是有意的：字段靠人写全，漏写一个就静默混进来；
栏目路径是结构性的，漏不掉。

> ⚠ Hugo 的 `complement A B` 返回的是**最后一个**集合里、不在前面集合里的元素
> （`complement A B` = B∖A）。待筛的汇总集合必须放**最后**；放反了不报错，
> 只是列表内容整个换掉 —— 曾把 20 个会员页当文章混进了 `/news/`。

### 会员单位详情页

`content/members/directory/<slug>.md` 写 `type: member`，两件事一起办成：

1. 落到 `layouts/member/single.html`（`type` 优先于 section，比依赖目录层级查找稳定）
2. 让上面的栏目汇总把它排除掉

`type` 漏写会**静默**退回 `_default/single.html`：外观退化，且会员页混进文章列表。
迁移脚本与 CMS 生成器都默认写入该字段。

## 4. CSS 分层

```
tokens.css      设计令牌。换肤只改这里。色阶 / 字号 / 间距 / 圆角 / 阴影 / 版心 / 断点约定
base.css        重置、排版、.container、栅格原语、.media-ph 占位块、.card/.panel
components.css  页头、导航、页脚、section-head、news-list、archive-list、分页、
                轮播、页签、面包屑、侧栏、友情链接、文章体、
                会员 LOGO 与 LOGO 墙（.member-logo / .member-wall）
pages.css       首页栅格、内页两栏、栏目录入、名录页（.directory-grid 卡片）、
                会员详情页、搜索页、404、打印样式
```

规则：**底层不引用上层**。写新样式前先判断属于哪一层，不要一律塞进 `components.css`。
`head.html` 按上面顺序 `Concat` 成一个 `css/site.css` 并加指纹。

## 5. JS 模块（assets/js/theme.js）

单个 IIFE，`ready()` 里依次初始化：

| 函数 | 触发 | 说明 |
|---|---|---|
| `initTopbar()` | `#today-date` 等 | 日期、设为首页、加入收藏 |
| `initNav()` | `#nav-more-btn` + `#nav-more` | **移动端「更多」面板**的开关（含点面板外收起、Esc 收起）。断点 1024，必须与 CSS 一致 |
| `initCarousel()` | `[data-carousel]` | 图片新闻轮播 |
| `initMarquee()` | `[data-marquee]` | 无缝纵向滚动（现仅页脚会员名录；首页右栏改静态列表后不再使用） |
| `initTabs()` | `[data-tabs]` | 四页签，支持方向键 |
| `initSearch()` | `#search-form` | 读 `/searchindex.json` 做前端过滤 |
| `initFilter()` | `[data-filter]` | 通用列表筛选（会员名录） |

两个约定：

- **`prefers-reduced-motion` 全部尊重**：轮播不启动定时器、滚动不启动 rAF、
  过渡被 `--transition` 压到 0.01ms。
- **读 DOM 属性而非查表**：轮播间隔来自 `data-interval`，滚动速度来自
  `data-speed`/`data-step`/`data-pause`/`data-gap`。改行为改模板属性即可，不用动 JS。

## 6. 无障碍

- 移动端「更多」按钮带 `aria-expanded` / `aria-controls`；`Escape` 与点面板外均收起。
  面板收起的写法是 `visibility: hidden`（不只是 `max-height: 0`）——
  只靠 `max-height: 0; overflow: hidden` 的话，里面的链接**仍然能被 Tab 聚焦、
  读屏仍会念**，等于存在一个看不见却可操作的面板
- 页签是 `role="tab"` + `aria-selected`，支持左右方向键
- 占位块是 `role="img"` + `aria-label`，不是空 `<img>`
  （例外：`components/member-logo.html` 的占位块是 `aria-hidden="true"` —— 会员名就在
   紧邻的卡片标题 / `<h1>` 里，再念一遍是重复。这是有意的偏差，不是漏改）
- 点击目标统一 `--tap: 44px`
- `:focus-visible` 才显示轮廓，鼠标点击不显示
- 装饰性元素（圆点、箭头）带 `aria-hidden="true"`

## 7. 与上一版的差异（迁移备忘）

如果你手上还有旧版（浙江省商贸业联合会那个），这是主要变化：

| 项目 | 旧版 | 现在 |
|---|---|---|
| 版式 | `#wrapper` 1000px 定宽 + `body{text-align:center}` | 流式，`--page-max: 1200px` |
| 栏目标题 | 切图 + `<map>` 热区 | `section-head.html` 纯文字 |
| 站名 | `top2.jpg`（1000×217 带字切图） | `.brand` 文字块 |
| 页签 | 切图 + JS 换图 | 文字按钮 |
| 配色 | 散落的 `#1F55A9` `#0052AC` 等 7 个硬编码 | 收敛到 `--c-primary-*` |
| CSS | `legacy/default/theme` 三个文件、45+ 处固定 px | 四层 + 令牌化 |
| 图片 | 71 张切图 | 全删，只留 favicon |
| 仓库 | 自带 57MB linux `hugo` 二进制 | 删除，自行安装 |
| 栏目 | 浙商联的行业/诚信/投资等 | 通用占位栏目 |
| CI 时区 | `TZ: Europe/Oslo`（会静默丢文章） | `TZ: Asia/Shanghai` |
