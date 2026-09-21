# 浙江省商贸业联合会 — Hugo 站点

把旧版静态站（`assets/index.html`，1000px 定宽 table 拼版 + jQuery 1.4.2 +
SuperSlide 2.1.1）重写为 **Hugo 静态站点**：版式与切图保持不变，
结构改为数据驱动，交互改为零依赖原生 JS。

* 旧站结构逐块解析 → 见 [`ARCHITECTURE.md`](ARCHITECTURE.md)
* 79 篇新闻 / 29 个栏目 / 202 家会员 / 38 条友情链接已从旧首页自动抽取

---

## 快速开始

```bash
# 需要 Hugo >= 0.128
hugo version

hugo server -D          # http://localhost:1313/
hugo --minify           # 产出到 public/
```

发布 `public/` 到任意静态托管（Nginx / OSS / GitHub Pages / Vercel）即可，
不需要 Node、不需要数据库、不需要后端。

### Hugo 版本兼容性

本项目刻意只用了各版本都支持的模板 API，实测矩阵：

| Hugo 版本 | 构建 | 页面数 | 提示 |
| --------- | ---- | ------ | ---- |
| 0.140.2 extended | ✅ | 161 | 无 |
| 0.154.5 extended | ✅ | 161 | 无（Ubuntu 26.04 `apt install hugo` 即此版本） |
| 0.166.0 extended | ✅ | 161 | 1 条弃用警告，见下 |

唯一残留的提示是 `WARN deprecated: .Site.Data ... Use hugo.Data instead`。
**为什么不直接改掉**：`hugo.Data` 是 0.156 才引入的，在 0.140 / 0.154 上会直接构建失败，
而 `site.Data` 在所有版本都能用。如果你固定使用 **>= 0.156** 的 Hugo，
把下面 5 处 `site.Data` 换成 `hugo.Data` 即可消除警告（不影响功能）：

```
layouts/partials/footer.html            site.Data.members.members
layouts/partials/home/friendlinks.html  site.Data.friendlinks
layouts/partials/components/sidebar.html site.Data.partners.partners
layouts/_default/directory.html         site.Data.members.members
layouts/index.html                      site.Data.ads.top
```

其他已避开的版本坑（都改成了各版本通吃的写法）：

| 写法 | 问题 | 现在用的 |
| ---- | ---- | -------- |
| `_build:` front matter | 0.145 弃用、后续版本**直接报错** | 已移除（搜索页不需要额外的 build 选项） |
| `.Site.LanguageCode` | 0.158 弃用 | `site.Language.Lang` |
| `.Page.IsNode` | 0.163 弃用 | `not .IsPage` |
| `languageCode =` 配置项 | 0.158 弃用 | `locale =`（旧版本静默忽略，已验证不报错） |

---

## 目录结构

```
zjsm-hugo/
├── hugo.toml                 站点配置 + 全部栏目菜单（9 个一级 / 28 个二级）
├── ARCHITECTURE.md           旧站结构解析与逐项映射表
├── README.md                 本文件
├── archetypes/default.md     `hugo new` 的文章模板
├── scripts/import-legacy.py  从旧站 HTML 重新抽取内容
│
├── assets/                   Hugo Pipes 编译（合并 + 压缩 + 指纹）
│   ├── css/legacy.css        旧 style.css（已修复中文编码与非法类名）
│   ├── css/default.css       旧 default.css
│   ├── css/theme.css         新版式（1000px 定宽 + flex 重排）
│   └── js/theme.js           原生 JS：轮播 / 滚动 / 页签 / 搜索 / 筛选
│
├── static/
│   ├── images/               71 张模板切图（相对 CSS 引用，路径不变）
│   └── uploads/news|ad/      18 张正文配图与 logo
│
├── data/
│   ├── members.yaml          202 家会员名录
│   ├── friendlinks.yaml      4 组 38 条友情链接
│   └── partners.yaml         5 个"协会链接"图片位
│
├── content/                  栏目（_index.md）+ 文章（.md）
│   ├── _index.md             首页
│   ├── about/  news/  industry/  policy/  members/
│   ├── party/  standards/  services/
│   └── search.md             站内搜索页
│
└── layouts/
    ├── index.html            首页
    ├── index.searchindex.json  搜索索引
    ├── 404.html
    ├── _default/             baseof / list / single / directory / search / taxonomy / terms
    ├── partials/
    │   ├── head.html header.html nav.html footer.html scripts.html
    │   ├── components/       news-list / breadcrumb / pagination / sidebar / page-banner
    │   └── home/             featured / headline / notice / dual / tabs / friendlinks
    └── _legacy/              旧 jQuery / SuperSlide / 原始 CSS 与 index.html（备查，不发布）
```

---

## 日常使用

### 发一篇文章

```bash
hugo new content news/association/my-article.md
```

或直接在对应栏目目录下新建 `.md`：

```yaml
---
title: "标题"
date: 2026-09-21
summary: "列表页与头条摘要用"
# image: "/uploads/news/xxx.jpg"   # 列表缩略图 / 首页轮播图
# featured: true                   # 加入首页"图片新闻"轮播
# source: "来源"
---

正文……
```

> **目录即栏目**：放进 `content/news/notice/` 就出现在「通知公告」，
> 放进 `content/party/news/` 就出现在「党建动态」，无需改任何模板。

### 增删栏目 / 改导航

改 `hugo.toml` 的两处：

1. `[[menu.main]]` —— 导航条目，二级用 `parent = "<一级的 identifier>"` 关联；
2. `content/<栏目>/_index.md` —— 栏目页本体（标题、排序 `weight`、简介）。

导航由 `layouts/partials/nav.html` 递归渲染，模板不需要改动。

### 改首页各版块的数据来源

全部集中在 `hugo.toml` 的 `[params.home]`：

```toml
[params.home]
  featuredCount   = 6                  # 图片新闻轮播条数（取 featured=true 的文章）
  headlineSection = "news/association" # 头条+列表取哪个栏目
  headlineCount   = 8
  noticeSection   = "news/notice"      # 通知公告（滚动）
  noticeCount     = 10
  headlinesSection = "industry/headlines"  # 综合要闻
  membersSection   = "members/dynamics"    # 会员动态
```

首页「四页签」在 `[[params.homeTabs]]`，可自由增删：

```toml
[[params.homeTabs]]
  label   = "党建工作"
  section = "party/news"
  image   = "menu_r1_c4.jpg"
  imageActive = "menuhover_r1_c4.jpg"   # 选中时的切图（可选）
  width   = 85
  active  = true                        # 默认展开哪个页签
```

### 改右栏图片位 / 页脚联系方式

* 右栏三个图片位 → `[[params.sideLinks]]`
* "协会链接" logo → `data/partners.yaml`
* 页脚地址电话 → `[params.contact]`
* 友情链接 → `data/friendlinks.yaml`（旧站是隐藏的下拉框，这里渲染成可见链接块；
  想恢复原样就给 `.friendlinks` 加 `style="display:none"`）
* 首页广告位 → 新建 `data/ads.yaml` 即自动启用：

  ```yaml
  top:
    image: /uploads/ad/637112254220728287.jpg
    url: ""
    alt: 第九届浙江商贸高峰论坛
  ```

### 站内搜索

构建时由 `layouts/index.searchindex.json` 生成 `/searchindex.json`，
`/search/` 页面用原生 `fetch` 做前端过滤 —— **纯静态即可用**，不需要后端。

---

## 从旧站重新导入内容

`scripts/import-legacy.py` 会解析旧站 HTML，重建 `content/` 与 `data/`：

```bash
python3 scripts/import-legacy.py ../assets/index.html --dry-run   # 先看会写哪些
python3 scripts/import-legacy.py ../assets/index.html
```

它做四件事：

| 输出                    | 来源                                            |
| ----------------------- | ----------------------------------------------- |
| `content/<栏目>/<id>.md`| 首页各版块的新闻条目（79 篇）                    |
| `data/members.yaml`     | 首页底部"商联会会员"滚动表的 202 家              |
| `data/friendlinks.yaml` | 首页底部 4 个 `<select>` 的 38 条                |
| `data/partners.yaml`    | "协会链接"图片位（**已人工校对，默认不覆盖**）    |

**关于日期**：旧站列表只显示 `[MM-DD]`，年份已丢失。脚本按
"倒序列表中月份变大即回退一年"的规则反推年份，并用 `--today`（默认今天）
校准首条年份，确保不产生未来日期（Hugo 会丢弃未来日期的页面）。
想复现同一次结果：

```bash
python3 scripts/import-legacy.py ../assets/index.html --today 2026-09-21
```

其他参数：

* `--force` —— 连人工校对过的 `data/partners.yaml` 也覆盖
* `--root DIR` —— 指定站点根目录（默认脚本的上一级）

**正文**：下载包只有首页，没有文章正文。导入的每条内容都带 `legacyUrl`
指向旧站原文，抓取正文后替换掉占位段落即可。

---

## 常用样式钩子（`assets/css/theme.css`）

| 类名 | 用途 |
| ---- | ---- |
| `.site-main` `.home-row` `.col-a-main` `.col-a-side` `.col-b-main` `.col-b-side` | 首页 1000px 定宽骨架 |
| `.news-list` / `.notice-list` | 首页与页签的新闻列表 |
| `.archive-list` | 栏目页列表（带缩略图 + 摘要 + 日期） |
| `.article-body` | 文章正文排版 |
| `.panel` `.panel-head` `.panel-body` | 内页通用面板 |
| `.directory-list` | 会员名录网格 |
| `.friendlinks` `.member-strip` `.footer-contact` | 首页底部三个区块 |

切图路径由 CSS 里的 `url(../images/xxx.jpg)` 引用。编译产物位于 `/css/`，
正好解析到 `/images/`，所以**不必改动切图路径**。

---

## 与旧站的差异

| 项目 | 旧站 | 现在 |
| ---- | ---- | ---- |
| 页面尺寸 | 1000px 定宽 table | 1000px 定宽，`flex` 重排（视觉一致） |
| 依赖 | jQuery 1.4.2 + SuperSlide 2.1.1 + web.js（103 KB） | 零依赖 `theme.js`（源码 12.5 KB / minify 5.6 KB） |
| 导航下拉 | SuperSlide `slideDown` | 纯 CSS `:hover` |
| 图片新闻 / 通知公告 / 会员名录滚动 | SuperSlide + `setInterval` | `theme.js`（`requestAnimationFrame`，悬停暂停，尊重 `prefers-reduced-motion`） |
| 页签切换 | `SwapImage()` 全局函数 | 声明式 `data-tab` |
| 站内搜索 | 服务端 `search.htm?con=` | 构建期 JSON 索引 + 前端过滤 |
| 备案 / 统计 | 外部 `beian.ashx` / `stat.php` / `c.js` | 静态备案链接；统计留 `params.analytics.cnzzId` 开关 |
| 友情链接 | 隐藏的 `<select>` | 可见链接块 |
| 隐藏登录栏 | 指向 `hz.gaokor.com` 的跳转壳 | 删除（无实际功能） |
| 页面体积 | 首页 HTML 120 KB（未压缩） | 首页 HTML 61.7 KB（minify 后） |
| JS 体积 | 103 KB | 5.6 KB（minify 后） |
| CSS 体积 | 14.8 KB（未压缩） | 21.1 KB（合并 3 个文件后 minify，含新版式） |

**保真度**：所有标题切图、`<area>` 图片热区坐标、栏宽、行高、配色、
背景切图均按原值复刻，首页外观与旧站一致。

---

## 已知限制

1. **正文缺失** —— 只有首页被下载，文章正文为占位内容，见上文 `legacyUrl`。
2. **会员名录无分组** —— 旧站是平铺的 202 个名字，这里保持平铺并加了一个
   前端筛选框（`data-filter`）。如需按地区/行业分组，把 `data/members.yaml`
   改成嵌套结构并调整 `layouts/_default/directory.html` 即可。
3. **`static/images/dian1.gif`** 同时用作 favicon；如需换图标，改
   `layouts/partials/head.html` 里的 `<link rel="icon">`。
4. **`assets/` 目录**（仓库外面那份原始下载）仍是权威素材，`_legacy/` 里
   留了一份 jQuery / SuperSlide / 原始 CSS 与 `index.html` 备查，Hugo 不会发布。
