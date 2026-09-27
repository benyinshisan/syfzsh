# 协会 / 商会站点模板（Hugo + Decap CMS）

一个**响应式空骨架**：栏目、配色、内容都是占位的，拿来改成你自己的商会/协会站点即可。
纯静态输出、零运行时依赖、零构建工具链 —— 只有 Hugo 和一份 YAML 配置。

- 版式：移动优先响应式，断点 640 / 768 / 1024 / 1280，无固定版心
- 配色：CSS 变量集中管理，主色深蓝，改一个文件即可换肤
- 内容：15 个文章栏目 + 5 个固定页，每栏目 2~3 篇占位文
- 会员：**每个会员一个内容页**（`/members/directory/<别名>/`），后台可加 LOGO、
  行业、官网、联系方式；首页 LOGO 墙、名录页与页脚名录都读同一批内容页。
  先后由后台「会员天地 → 会员排序」的**一份可拖拽名单**统一决定（[CMS.md §5.2](CMS.md)）
- 后台：Decap CMS 本地编辑，非技术同事也能发文（见 [CMS.md](CMS.md)）
- 架构说明：[ARCHITECTURE.md](ARCHITECTURE.md)

---

## 1. 快速开始

### 装 Hugo

本仓库**不自带** Hugo 二进制（早期版本塞过一个 57MB 的 linux 版，clone 极慢且
在 Windows/macOS 根本跑不起来）。请自行安装：

```bash
# Windows
winget install Hugo.Hugo.Extended

# macOS
brew install hugo

# Ubuntu / Debian
sudo apt install hugo
```

要求 **Hugo >= 0.156**（模板用了 `hugo.Data` 全局函数；CI 固定 0.166.0）。
本模板**不使用 Sass**，所以 extended 版并非必需。

### 起站点

```bash
npm run dev          # http://localhost:1313
```

`npm run dev` 走 `scripts/hugo.mjs`：先找仓库根目录的 `hugo`/`hugo.exe`，找不到
再退回 PATH 里的 `hugo`。所以你也可以把二进制直接丢在仓库根目录（已在
`.gitignore` 里）。

其它命令：

```bash
npm run build        # 生成 public/，带 --gc --minify
npm run build:local  # 生成 public-local/：双击 index.html 就能脱机看的版本
npm run cms          # 启动 Decap CMS 本地后端（见 CMS.md）
npm run cms:config   # 按栏目表重新生成 static/admin/config.yml
```

> **`npm run build:local` 是什么**：产出一份**不需要服务器**的站点，直接双击
> `public-local/index.html` 就能在浏览器里翻，适合给同事发一份看效果、或拷到
> 没装 Hugo 的机器上演示。它靠 `hugo.local.toml` 打开 `relativeURLs`（资源改
> 相对路径）和 `uglyURLs`（每页输出成 `.html` 实体文件），再跑
> `scripts/fix-offline-html.mjs` 做三处 http:// 专属的收尾：
>
> 1. **摘掉 `integrity` 摘要**（不摘就没有样式）—— SRI 要求响应可读，而
>    `file://` 的响应是不透明来源，浏览器没法验证摘要，只能把整份 CSS/JS 拦掉。
> 2. 把模板里写死的目录式链接（`/news/` 这类 `relURL` 加不上 `.html` 的）
>    补成 `news/index.html`。
> 3. 把 `uglyURLs` 下没有对应目录的链接（`/about/contact/` → 实体其实是
>    `about/contact.html`）改成同名 `.html` 文件。
>
> ⚠ **它和 `public/` 是两套东西，互不影响** —— 产物目录不同（`public-local/`），
> 主配置 `hugo.toml` 一个字没动。**要部署请用 `npm run build`**，别拿
> `public-local/` 上线：相对路径在服务器上能用，但完全丧失了目录式网址。
>
> 脱机版有两个已知限制：**站内搜索不可用**（`fetch` 读 `searchindex.json` 在
> `file://` 下被浏览器拦），`admin/` 目录是死重量（5MB，后台本来就只允许从
> localhost 进），删掉不影响浏览。

---

## 2. 目录结构

```
content/          文章与栏目页，目录结构 = URL 结构
  _index.md       首页
  about/          5 个固定页（商会简介 / 章程 / 组织机构 / 入会指南 / 联系我们）
  news/           一级栏目，_index.md 是栏目页，子目录是二级栏目
  members/
    directory/    会员单位，一个会员一个文件（type: member）
    services/     会员服务（培训 / 咨询 / 对接）
  policy/         无二级栏目：文章直接放在栏目目录下
  party/          同上
  ...
  search.md       站内搜索页（layout: search）
data/             friendlinks.yaml / partners.yaml / members_order.yaml（会员展示顺序，
                  后台「会员天地 → 会员排序」维护，见 CMS.md §5.2）
layouts/          Go 模板
assets/css/       tokens → base → components → pages，四层
assets/js/        theme.js，唯一一份 JS
assets/uploads/   图片，CMS 上传目录，按栏目分子目录；页面里引用 /uploads/…
static/           favicon、admin/（CMS 后台）、uploads/（旧的上传目录，只剩占位空目录）
  admin/decap-cms.js          内置的 CMS 前端（约 5MB），见 CMS.md
  admin/config.yml            生成物：集合定义
  admin/sidebar-groups.css    生成物：左栏的分组标题与缩进
  admin/editor-components.js  正文插图对话框（中文三字段 + 版式下拉）
  admin/preview.js            实时预览 + 右下角「使用说明」
archetypes/       命令行建稿模板：news.md、members.md、default.md
scripts/          hugo.mjs 启动器、gen-cms-config.mjs 配置生成器、vendor-decap.mjs、
                  import-members.mjs 会员名单批量导入、sync-member-order.mjs
                  会员排序名单同步（npm run members:order）
hugo.toml         站点配置：导航、首页四页签与侧栏按钮、页脚联系信息
data/home.yaml    首页各版块的标题/条数/取自哪个栏目（后台可改）
README.md         改模板的人看
CMS.md            后台怎么用、为什么这么设计
WRITING.md        发稿的人看：图片放哪、插图版式、常见错误
```

`public/` 是构建产物，不需要提交。

---

## 3. 改成你自己的站点

按下面的顺序做一遍，基本就换完了。

### 3.1 站点信息

改 `hugo.toml` 顶部与 `[params]`：`baseURL`、`title`、`siteName`、`slogan`、
`description`、`keywords`，以及 `[params.contact]` 里的页脚联系方式。

> `[params.contact]` 的值**只填内容**，不要带「电话：」这类前缀 —— 前缀由
> `layouts/partials/footer.html` 统一输出，方便你一次性改排版。
> `icpCode` 留空时，页脚的备案行整行不输出。

### 3.2 换配色

只改 `assets/css/tokens.css` 的 `:root`。品牌色是一整条阶梯
（`--c-primary-50` … `--c-primary-900`），主色是 `--c-primary`。
点缀色 `--c-accent`。其余 CSS 一律引用变量，不需要动。

### 3.3 增删栏目 ⚠ 必须同改四处

漏一处不是报错就是导航空白项，这是本模板最容易出错的地方：

| # | 改哪里 | 说明 |
|---|---|---|
| 1 | `content/<一级>/_index.md` 与每个二级目录的 `_index.md` | **目录必须真实存在** |
| 2 | `hugo.toml` 的 `[[menu.main]]` | 一级给 `identifier`，二级用 `parent` 关联 |
| 3 | `hugo.toml` 的 `[params.home]` 各 `xxxSection` | 首页版块的数据来源 |
| 4 | `hugo.toml` 的 `[[params.homeTabs]]` 各 `section` | 首页四页签 |

然后**再改两处 CMS 相关**（漏了后台会「列表里看不到这篇文章」）：

```bash
node scripts/gen-cms-config.mjs   # 改 scripts/gen-cms-config.mjs 的 sections 表后运行
```

并在 `static/admin/preview.js` 的 `LIVE_COLLECTIONS` 里加上新集合名。
漏了不报错，只是那个栏目的预览退回「字段平铺」。

> 生成器会**同时**产出 `config.yml` 与 `sidebar-groups.css`（左栏的分组缩进
> 与组标题），两者必须一起更新 —— 所以永远通过 `npm run cms:config` 重新生成，
> 不要只改其中一个。

> 加栏目 = 5 处（上面 4 处 + 生成器的 `sections` 表），再加 `LIVE_COLLECTIONS`
> 这处不报错的。没有自动化检查能替你兜住 —— 改完请打开后台逐个数一遍左侧列表。

> **减栏目同理，步骤一样、只是反向。** 本仓库在 2026-09 精简过一次，可作为范例：
> 把原模板遗留的「标准规范」整个删除（团体标准编制是省级联合会的职能，市级商会
> 不适用），「服务与合作」并入「会员天地 / 会员服务」；又把「政策法规」「党群工作」
> 的三个二级栏目拍平 —— 这两类内容一年就几条，拆三个二级必然长期空着。
> **拍平不改变 `categories` 值**（它始终是一级目录名），只是文章从
> `content/policy/national/` 挪到了 `content/policy/`。
> 另外别把两处 `weight` 搞混：**导航顺序**只由 `hugo.toml` 的 `[[menu.main]]`
> 决定；`content/<栏目>/_index.md` 里的 `weight` 管的是**栏目页内子栏目入口的
> 排序**（`_default/list.html` 的 `.Sections.ByWeight`）。

> 栏目标题只有一处真相：板块标题用 `site.GetPage $section` 取 `.Title`，
> 所以改 `_index.md` 的 `title` 就够，不会出现「首页写 A、栏目页写 B」。
> **栏目页（`_index.md`）不在 CMS 里** —— 标题只能在文件里改。

### 3.4 停用 / 精简首页版块

`layouts/index.html` 里每个版块都是一个 partial，不需要的直接删掉那一行即可：

```html
{{ partial "home/featured.html" . }}     <!-- 图片新闻轮播（取 featured: true 的文章） -->
{{ partial "home/headline.html" . }}     <!-- 商会动态：头条 + 列表 -->
{{ partial "home/notice.html" . }}       <!-- 通知公告滚动 -->
{{ partial "home/members-wall.html" . }} <!-- 会员 LOGO 墙（整行，数据源＝会员内容页） -->
{{ partial "home/members-news.html" . }} <!-- 会员动态（整行，宽屏多列） -->
{{ partial "home/industry.html" . }}     <!-- 行业资讯 -->
{{ partial "home/tabs.html" . }}         <!-- 四页签 -->
{{ partial "components/sidebar.html" . }}
{{ partial "home/friendlinks.html" . }}
```

> 会员那两行是「会员天地」板块的主体，删掉首页就没有会员展示了；
> 只想留一行时，注意页脚的会员滚动名录在首页是被刻意关掉的
> （`partials/footer.html` 的 `if not .IsHome`）—— 两行都删就没有会员名单了。

首页版块取不到内容时会整块消失（不会留个空壳）。

### 3.5 配图

文章有 `image` 字段就出图，没有就渲染一个 CSS 占位块 —— **空骨架不会出现破图**。

所有图片统一走 `layouts/partials/components/img.html` 输出：`resources.Get` 从
`assets/` 取原图 → 需要时缩放 → 转 WebP → 补上 `width`/`height`（防 CLS）。
图放在 `assets/uploads/…`，页面里引用 `/uploads/…`。

**为什么是 `assets/` 而不是 `static/`**、`hugo.toml` 里那条
`assets/uploads → static/uploads` 的 module mount 是干什么用的、以及后台按
集合自动分目录的规则，见 [CMS.md 的 §7](CMS.md)。

正文插图的版式由渲染钩子 `layouts/_default/_markup/render-image.html` 决定：
`![说明](图.jpg)` 居中，引号里可写 `wide` / `left` / `right`。发稿的人看
[WRITING.md](WRITING.md)。

---

## 4. 内容与写作

### 新建文章

用后台（推荐，见 [CMS.md](CMS.md)）或命令行：

```bash
node scripts/hugo.mjs new content news/notice/2026-05-01-meeting.md
```

模板在 `archetypes/`：文章用 `news.md`，会员单位用 `members.md`
（`default.md` 是通用兜底）。三个模板产出的 front matter 与后台表单一一对应，
里面带注释说明每个字段出现在前台哪里。

**图片怎么放、正文版式怎么选、会员的三组图片怎么填** —— 发稿人看
[WRITING.md](WRITING.md)，那份是照抄用的。

### front matter 约定

```yaml
---
title: "通知标题"
slug: meeting-2026                    # ⚠ 必填，决定文件名与网址，只能英文小写/数字/连字符
date: 2026-05-01T09:00:00+08:00      # ⚠ 必须带 +08:00，见下
lastmod: 2026-05-01T09:00:00+08:00
draft: false
summary: "列表页与搜索结果的摘要"
categories: ["news"]                  # ⚠ 必须等于一级栏目的目录名
tags: ["标签"]
featured: false                       # true 则进首页「图片新闻」轮播
# image: "/uploads/news/xxx.jpg"      # 「列表封面图」：列表小图 / 首页轮播 / 正文上方。留空则渲染 CSS 占位块
---
```

> **`slug`（网址别名）必填**：它同时决定文件名 `2026-05-01-meeting-2026.md`、
> front matter 里的 `slug`、以及前台网址 `/news/notice/meeting-2026/`。
> **已发布的文章不要改**，改了等于换网址。后台这个字段带格式校验，
> 填中文或大写字母会当场报错。为什么不做成可选，见
> [CMS.md 的 §4.1](CMS.md)。

> **为什么日期必须带时区**：`date: 2026-05-01` 这种裸日期会被 Hugo 当成
> **UTC 午夜**。如果构建机时区在 UTC+8 以西，这条「今天」的文章会被判定为
> 未来，而 `buildFuture` 默认关闭，于是被**静默丢弃** —— 表现为「本地看得到、
> 线上没有」。本仓库的 CI 已固定 `TZ: Asia/Shanghai`。

> **`categories` 是给 CMS 用的过滤器**，值必须是一级栏目的目录名
> （`news` / `members` / `policy` / `party`）。
> 二级栏目共用一级的值。填错不会报错，只会让文章在后台列表里「消失」。
> 详见 [CMS.md](CMS.md)。

---

## 5. 响应式与样式约定

### 断点

| 断点 | 宽度 | 变化 |
|---|---|---|
| sm | 640px | 双栏卡片并排；文章列表图左文右 |
| md | 768px | 页脚三列；页签面板左右分栏；字号放大 |
| lg | 1024px | **首页双栏 + 内页侧栏出现；导航从汉堡恢复水平** |
| xl | 1280px | 版心撑满 1200px |

导航折叠点取 **1024 而不是 768**：8 个一级栏目排开约需 720px，768px 下会挤爆。

### 加样式

四层，按抽象层级切（不是按设备切）：

```
assets/css/tokens.css      设计令牌，换肤只改这里
assets/css/base.css        重置 / 排版 / .container / 栅格原语 / 占位块
assets/css/components.css  页头 导航 页脚 列表 轮播 页签 分页 表单 卡片
assets/css/pages.css       首页栅格 内页布局 文章页 名录页 会员页 搜索页
```

底层不引用上层。新样式先想清楚属于哪一层，不要都堆进 components。

> ⚠ **新增/改名 CSS 文件必须同步 `layouts/partials/head.html` 的 Pipes 清单。**
> `resources.Get` 取不到文件会返回 nil，紧接着 `resources.Concat` 直接硬崩 ——
> 不是优雅降级。

### 两个必须记住的坑

1. **栅格一律用 `minmax(0, 1fr)`，不要写 `1fr`。** `1fr` 的最小尺寸是 `auto`，
   内容一宽就把栅格撑破、出现横向滚动条。flex 子项同理，长文本要配
   `min-width: 0`。
2. **图片位一律走 `thumb.html`。** 直接 `<img src="">` 会渲染成破图。
   会员 LOGO 走 `member-logo.html`（与 `thumb.html` 同，但占位块不写字）。

自检（改完版式跑一下）：

```js
// 每个宽度都应为 true
document.documentElement.scrollWidth <= window.innerWidth
```

---

## 6. 发布前检查清单

- [ ] `pagerSize` 按栏目规模定（`hugo.toml` 的 `[pagination]`，默认 10）。
      **一级栏目与二级栏目现在都分页**，所以这个值决定的是每个栏目页几页。
      ⚠ 想肉眼验证分页器，临时改小（如 3）—— 全站内容不到 10 条时看不到分页器是正常的。
- [ ] `hugo.toml` 的 `baseURL` / `siteName` / `[params.contact]` 全部换成真实信息
- [ ] `static/admin/config.yml` 的 `site_url` / `display_url` 换成真实域名
      （改生成器 `scripts/gen-cms-config.mjs`，不要手改 config.yml）。
      现在指向 `http://localhost:1313`，因为后台只在本地用
- [ ] 有正式 LOGO 后替换 `static/images/cms-logo.svg`（后台左上角的占位标）
- [ ] 跑一遍 `npm run build`，控制台零警告
- [ ] 浏览器 DevTools 的 Network 面板过滤 `404`，确认没有残留的图片请求
- [ ] 手机上（或 DevTools 的 360 / 414 宽度）确认没有横向滚动
- [ ] **断网/关代理**打开一次 `localhost:1313/admin/`，确认后台能正常登录、发文
      （CMS 前端已内置在 `static/admin/decap-cms.js`，不该再有任何外部请求）
- [ ] `content/` 里的占位文全部替换或删除

---

## 7. 部署

`npm run build` 产出 `public/`，把整个目录丢给任意静态托管即可。

仓库自带 GitHub Actions（`.github/workflows/hugo.yaml`）：推 `main` 分支即构建并
发布到 GitHub Pages。**注意里面的 `TZ: Asia/Shanghai` 不要改** —— 理由见上面
「为什么日期必须带时区」。

换其它平台（Vercel / Netlify / Cloudflare Pages）时：构建命令 `hugo --gc --minify`，
产物目录 `public`，环境变量 `HUGO_VERSION` 填 `0.166.0` 或更高。
