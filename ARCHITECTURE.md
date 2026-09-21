# 旧站架构解析 → Hugo 模板映射

本文档记录 `assets/` 目录里那份"另存为"下来的旧站页面（浙江省商贸业联合会官网首页）
的完整结构，以及它被拆解、重写成 Hugo 模板的对应关系。

---

## 一、原始素材清单

`assets/` 是一个被压平的目录树 —— 下载工具把原来的四层目录全部倒进了同一层：

| 原始路径              | 数量 | 实际内容                                        | 在 `assets/` 里的形态        |
| --------------------- | ---- | ----------------------------------------------- | ---------------------------- |
| `index.html`          | 1    | 首页（1364 行）                                  | `index.html`                 |
| `Scripts/*.js`        | 3    | jQuery 1.4.2 / web.js（自研交互）/ SuperSlide.js | `jquery-1.4.2.min.js`、`web.js`、`SuperSlide.js` |
| `css/*.css`           | 2    | `style.css` 站内样式、`default.css` 焦点图样式   | `style.css`、`default.css`   |
| `images/*`            | 71   | 模板切图（标题栏 / 背景 / 按钮 / 图标）           | 同名散落在 `assets/`         |
| `file/news/*`         | 15   | 正文配图、合作单位 logo                          | 同名散落在 `assets/`         |
| `file/ad/*`           | 3    | 广告位图片                                       | 同名散落在 `assets/`         |
| 第三方脚本            | 4    | `beian.ashx`、`stat.php`、`stat.htm`、`c.js`     | 备案号 / 站长统计，已废弃     |

### 编码问题（重要）

下载过程中发生了 **GBK → UTF-8 的有损转换**：

* `index.html` 声明 `charset=gb2312`，但文件实际存为 UTF-8，中文正常。
* `style.css` / `default.css` 里的中文字体名 `"宋体"` 变成了 60 + 26 个替换字符
  `U+FFFD`（`����`）。Hugo 重写时已全部还原为 `"宋体"`。
* `style.css` 里两个类名以数字开头（`.1` / `.2`），是旧站源码本身的 bug，
  已改名 `.__bad1` / `.__bad2`。

### 缺失资源

首页引用了两张图片但下载包中没有，且**都位于 `display:none` 的隐藏区块**：

* `images/index_r28_c15.jpg` —— 隐藏登录栏的底图
* `images/index_r83_c2.gif` —— 隐藏友情链接栏的底图

迁移时对应区块已直接用 CSS 渐变替代，不再依赖这两张切图。

---

## 二、页面结构解析

旧站是典型的 **1000px 定宽 table 拼版**：整页由嵌套 `<table>` 组成，
每栏的"标题"都是一张切图（`<img src="images/index_r3_c25.jpg">`），
"更多"入口用 `<map>/<area>` 图片热区实现，列表行用背景切图做分隔线。

结构化之后，首页由 4 个纵向区块、共 10 个内容版块构成：

```
┌─ ① 顶部工具条 (h30, bg=toptop.jpg) ─────────────────────────────┐
│   左：今天日期（JS document.write 动态生成）                      │
│   右：设为首页 / 加入收藏 / 联系我们                              │
├─ ② 站点横幅 (1000×217, top2.jpg) ──────────────────────────────┤
├─ ③ 主导航 (h32, bg=topbg.jpg) ─────────────────────────────────┤
│   ul#nav > li.nLi × 9，每项带 .sub 二级下拉（SuperSlide menu）    │
├─ ④ 广告位 (1000×100, display:none) ────────────────────────────┤
├─ ⑤ 行一 (987px) ──────────────────────────────────────────────┤
│   ├ 左 727px ────────────────────────────────────────────────┐ │
│   │  ├ 图片新闻 342px：.sy_ban 轮播 ×6（SuperSlide autoPlay） │ │
│   │  └ 浙商联动态 375px：1 头条(含摘要) + 8 条列表             │ │
│   └──────────────────────────────────────────────────────────┘ │
│   └ 右 260px：通知公告 253px，10 条无缝向上滚动(setInterval)     │
├─ ⑥ 行二 (987px) ──────────────────────────────────────────────┤
│   ├ 左 748px ────────────────────────────────────────────────┐ │
│   │  ├ 综合要闻 344px（10 条） + 会员动态 371px（10 条）      │ │
│   │  └ 四页签切换 728px：民生热点/专家视点/政策法规/党建工作   │ │
│   │     每个面板 = 1 张大图 + 8 条列表（SwapImage 切 display） │ │
│   └──────────────────────────────────────────────────────────┘ │
│   └ 右 239px：搜索框 / 党群建设图片位 / 3 个图片位 / 协会链接 logo│
├─ ⑦ 商联会会员名录 (987px, 202 家, 无缝横向滚动) ────────────────┤
├─ ⑧ 友情链接 (4 个 display:none 的 <select> 下拉框) ────────────┤
└─ ⑨ 页脚 (h6 红条 #D31111 + 联系方式块 #CADFFE + 二维码) ────────┘
```

### 版块与切图对照（模板标题都是图片，无 alt 文本，已逐张读图确认）

| 版块       | 标题切图                     | 尺寸    | 热区 coords      | 旧链接目标        |
| ---------- | ---------------------------- | ------- | ---------------- | ----------------- |
| 图片新闻   | `images/sypic_1.jpg`         | 342×50  | —                | —                 |
| 浙商联动态 | `images/index_r3_c25.jpg`    | 375×29  | `319,3,369,24`   | `slhdt4002.htm`   |
| 通知公告   | `images/index_r1_c37.jpg`    | 253×30  | `202,5,241,26`   | `slhdt4001.htm`   |
| 综合要闻   | `images/index_r36_c4.jpg`    | 344×34  | `281,11,331,29`  | `xwzx5001.htm`    |
| 会员动态   | `images/index_r36_c25.jpg`   | 371×34  | `311,9,361,31`   | `hytd2002.htm`    |
| 党群建设   | `images/index_r18_c39.jpg`   | 248×36  | `186,13,233,31`  | `slhdt4004.htm`   |
| 协会链接   | `images/index_r50_c38.jpg`   | 252×40  | —                | —                 |
| 商联会会员 | `images/index_r86_c4.jpg`    | 984×35  | —                | —                 |
| 页签       | `images/menu_r1_c1..c4.jpg`  | 82–85×23| 悬停 `menuhover_r1_c4.jpg` | 见下方页签表 |

**页签标签与目标的错位**（旧站的一个内容 bug，已按标签语义重新映射）：

| 页签序号 | 切图上的字 | 旧站指向               | 重写后指向                  |
| -------- | ---------- | ---------------------- | --------------------------- |
| 1        | 民生热点   | `xwzx5002.htm`         | `content/industry/livelihood` |
| 2        | 专家视点   | `xwzx5003.htm`         | `content/industry/experts`    |
| 3        | 政策法规   | `zcfg7001.htm`         | `content/policy/national`     |
| 4        | 党建工作   | `dqjs14002.htm`（默认） | `content/party/news`          |

---

## 三、导航树 → Hugo Section 树

旧站用**文件名前缀 + 四位数字**编码栏目层级（`slhdt` = 浙商联动态，`slhdt4001` = 其下的通知公告）。
Hugo 用**目录嵌套**表达同一件事，这也让 URL 变得可读：

| 旧站栏目入口      | 旧 URL             | Hugo 内容目录                | 新 URL                     |
| ----------------- | ------------------ | ---------------------------- | -------------------------- |
| 首页              | `./`               | `content/_index.md`          | `/`                        |
| 关于浙商联        | `slhgk.htm`        | `content/about/`             | `/about/`                  |
| ├ 概况            | `slhgk3001.htm`    | `content/about/overview.md`  | `/about/overview/`         |
| ├ 章程            | `slhgk3002.htm`    | `content/about/charter.md`   | `/about/charter/`          |
| ├ 组织机构        | `slhgk3003.htm`    | `content/about/organization.md` | `/about/organization/`  |
| ├ 入会指南        | `slhgk3004.htm`    | `content/about/join.md`      | `/about/join/`             |
| └ 联系我们        | `slhgk3005.htm`    | `content/about/contact.md`   | `/about/contact/`          |
| 浙商联动态        | `slhdt.htm`        | `content/news/`              | `/news/`                   |
| ├ 通知公告        | `slhdt4001.htm`    | `content/news/notice/`       | `/news/notice/`            |
| ├ 浙商联新闻      | `slhdt4002.htm`    | `content/news/association/`  | `/news/association/`       |
| ├ 商联会活动      | `slhdt4004.htm`    | `content/news/events/`       | `/news/events/`            |
| └ 诚信评选        | `slhdt4008.htm`    | `content/news/integrity/`    | `/news/integrity/`         |
| 行业动态          | `xwzx.htm`         | `content/industry/`          | `/industry/`               |
| ├ 要闻集锦        | `xwzx5001.htm`     | `content/industry/headlines/`| `/industry/headlines/`     |
| ├ 民生热点        | `xwzx5002.htm`     | `content/industry/livelihood/`| `/industry/livelihood/`   |
| └ 专家视点        | `xwzx5003.htm`     | `content/industry/experts/`  | `/industry/experts/`       |
| 政策法规          | `zcfg.htm`         | `content/policy/`            | `/policy/`                 |
| ├ 国家政策        | `zcfg7001.htm`     | `content/policy/national/`   | `/policy/national/`        |
| ├ 省内政策        | `zcfg7003.htm`     | `content/policy/provincial/` | `/policy/provincial/`      |
| └ 政策文件        | `zcfg7005.htm`     | `content/policy/documents/`  | `/policy/documents/`       |
| 会员天地          | `shhy.htm`         | `content/members/`           | `/members/`                |
| ├ 会员名录        | `shhy.htm`         | `content/members/directory/` | `/members/directory/`      |
| ├ 会员动态        | `hytd2002.htm`     | `content/members/dynamics/`  | `/members/dynamics/`       |
| └ 申请入会        | `join.htm`         | `content/about/join.md`      | `/about/join/`             |
| 党群建设          | `dqjs14002.htm`    | `content/party/`             | `/party/`                  |
| ├ 党建动态        | `dqjs14002.htm`    | `content/party/news/`        | `/party/news/`             |
| ├ 党建活动        | `dqjs14004.htm`    | `content/party/activities/`  | `/party/activities/`       |
| └ 清廉园地        | `dqjs14005.htm`    | `content/party/integrity/`   | `/party/integrity/`        |
| 标准化工作        | `bzhgz13006.htm`   | `content/standards/`         | `/standards/`              |
| ├ 标准化动态      | `bzhgz13001.htm`   | `content/standards/news/`    | `/standards/news/`         |
| ├ 标准下载        | `bzhgz13004001.htm`| `content/standards/downloads/`| `/standards/downloads/`   |
| └ 政策法规        | `bzhgz13005.htm`   | `content/standards/policy/`  | `/standards/policy/`       |
| 服务中心          | `lxwm.htm`         | `content/services/`          | `/services/`               |
| ├ 投资服务        | `lxwm6001.htm`     | `content/services/investment/`| `/services/investment/`   |
| └ 浙江商贸        | `lxwm6010.htm`     | `content/services/trade/`    | `/services/trade/`         |
| 单篇文章          | `html6568.htm`     | `content/<栏目>/6568.md`     | `/<栏目>/6568/`            |
| 站内搜索          | `search.htm?con=`  | `content/search.md`          | `/search/?q=`              |

导航本身写在 `hugo.toml` 的 `[[menu.main]]` 里（两级用 `parent` 关联），
模板 `layouts/partials/nav.html` 递归渲染，**增删栏目只改配置、不碰 HTML**。

---

## 四、资源引用关系 → Hugo 资源管线

旧站用相对路径硬编码：`src="file/news/xxx.jpg"`、`background="images/topbg.jpg"`、
CSS 里 `url(../images/bg.gif)`。Hugo 侧重新组织为：

```
旧站                          新站
──────────────────────────    ────────────────────────────────────────────
images/*          (71 张)  →  static/images/*            （模板切图，CSS 相对引用）
file/news/*       (15 张)  →  static/uploads/news/*      （正文配图 / logo）
file/ad/*         (3 张)   →  static/uploads/ad/*        （广告位，默认不启用）
css/style.css              →  assets/css/legacy.css      ┐
css/default.css            →  assets/css/default.css     ├─ Hugo Pipes: Concat + Minify + Fingerprint
（新增布局）                →  assets/css/theme.css       ┘   → /css/zjsm.min.<hash>.css
web.js + SuperSlide.js     →  （删除，改由 theme.js 原生实现）
jquery-1.4.2.min.js        →  （删除，不再需要）
```

CSS 里的 `url(../images/bg.gif)` 在编译产物 `/css/zjsm.min.<hash>.css` 中
正好解析到 `/images/bg.gif`，因此切图路径**不需要改动**。

---

## 五、交互与第三方依赖

旧站首页总共只有 6 处 JS 行为，全部依赖 **jQuery 1.4.2（2010 年）+ SuperSlide 2.1.1（2013 年）**：

| 旧实现                                                        | 重写为                                          |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `jQuery("#nav").slide({type:"menu", effect:"slideDown"})`      | 纯 CSS：`.nav .nLi:hover .sub { display:block }` |
| `jQuery(".sy_ban").slide({autoPlay:true, interTime:3000})`     | `theme.js` → `initCarousel()`（rAF/定时器 + 淡入淡出） |
| `setInterval(Marquee4, 90)`（通知公告 scrollTop++）            | `theme.js` → `initMarquee()`（`translateY` 无缝滚动，悬停暂停） |
| `new srcMarquee("ScrollMe", …)`（会员名录滚动）                | 同上，复用 `initMarquee()`                       |
| `SwapImage(i, pn, id)`（页签切 display + 换图）                | `theme.js` → `initTabs()`，声明式 `data-tab` 属性 |
| `Search()` / `SubmitKeyClick()`                                | 原生 `<form method="get">` + 前端 JSON 索引检索   |
| `setHomepage()` / `AddFavorite()` / 日期 `document.write`      | `theme.js` → `initTopbar()`（现代浏览器已禁用改主页，退化为提示） |

去掉依赖后，JS 体积从 **103 KB 降到 5.6 KB**（jquery 70.5 KB + SuperSlide 11.2 KB +
web.js 21.4 KB → `theme.js` 源码 12.5 KB，Hugo Pipes minify 后 5.6 KB），
且不再有 15 年前的浏览器兼容分支。

搜索结果也一并从"服务端 `search.htm?con=`"改为 **Hugo 生成的 `/searchindex.json` + 前端过滤**，
静态托管即可工作（`layouts/index.searchindex.json`）。

---

## 六、Hugo 目录结构

```
zjsm-hugo/
├── hugo.toml                    ← 站点配置 + 9 个一级栏目 / 28 个二级栏目的菜单树
├── ARCHITECTURE.md              ← 本文档
├── README.md                    ← 使用说明
├── archetypes/default.md        ← `hugo new` 的文章模板
├── scripts/import-legacy.py     ← 从旧站 HTML 重新抽取 content / data
│
├── assets/                      ← 参与 Hugo Pipes 编译
│   ├── css/legacy.css           ← 旧 style.css（已修复中文与非法类名）
│   ├── css/default.css          ← 旧 default.css（焦点图样式）
│   ├── css/theme.css            ← 新版式：1000px 定宽 + flex 重排
│   └── js/theme.js              ← 新版交互（替代 jQuery + SuperSlide）
│
├── static/                      ← 原样发布
│   ├── images/                  ← 71 张模板切图
│   └── uploads/{news,ad}/       ← 18 张正文配图 / logo / 广告
│
├── data/
│   ├── members.yaml             ← 202 家会员名录（页脚滚动 + 会员名录页）
│   ├── friendlinks.yaml         ← 4 组 38 条友情链接
│   └── partners.yaml            ← 5 个"协会链接"图片位
│
├── content/                     ← 29 个 _index.md（栏目）+ 5 个单页 + 79 篇新闻
│
└── layouts/
    ├── index.html               ← 首页（组装下列 home/* partial）
    ├── index.searchindex.json   ← 搜索索引
    ├── 404.html
    ├── _default/
    │   ├── baseof.html          ← 骨架
    │   ├── list.html            ← 栏目/子栏目列表 + 分页
    │   ├── single.html          ← 文章页
    │   ├── directory.html       ← 会员名录（含前端筛选）
    │   ├── search.html          ← 站内搜索
    │   ├── taxonomy.html / terms.html
    ├── partials/
    │   ├── head.html  header.html  nav.html  footer.html  scripts.html
    │   ├── components/          ← news-list / breadcrumb / pagination / sidebar / page-banner
    │   └── home/                ← featured / headline / notice / dual / tabs / friendlinks
    └── _legacy/                 ← 旧 jQuery/SuperSlide/原始 CSS 与 index.html（Hugo 忽略 `_` 开头的目录）
```

---

## 七、重写时做出的取舍

1. **保留 1000px 定宽与全部切图**：这是协会站点对外一致的门面，重排但不变样。
   `table` → `flex`，行高、栏宽、背景切图、颜色全部按原值复刻。
2. **标题切图与图片热区照搬**：`<img usemap>` + `<map><area coords="…">` 一比一平移，
   "更多"仍然点在原位。
3. **隐藏区块的处理**：
   * 登录栏（`display:none`）→ 删除（旧站是外部 `hz.gaokor.com` 的跳转壳，无实际功能）。
   * 友情链接（`display:none`）→ 改为**可见**的链接块（数据本身有价值）。
     想恢复原样，给 `.friendlinks` 加 `display:none` 即可。
   * 广告位（`display:none`）→ 保留结构，创建 `data/ads.yaml` 即自动启用。
   * 党群建设图片位（`display:none`）→ 改为可见。
4. **日期重建**：旧站列表只显示 `[MM-DD]`。导入脚本按"顺序中月份变大即回退一年"的规则
   还原出完整日期（旧站是倒序排列，跨年会表现为月份跳变）。无日期的版块
   （通知公告、页签列表）按顺序插值，原始顺序通过 `date` 排序保持。
5. **正文内容**：下载包只有首页，没有文章正文。导入脚本为每个条目生成标题/日期/栏目/原链接，
   正文留空待补 —— 用 `legacyUrl` 字段可以定位到旧站原文。
6. **备案与统计**：旧的 `beian.ashx` / `stat.php` / `c.js`（外部域名）已删除，
   备案号改为指向 `beian.miit.gov.cn` 的静态文本，统计留 `params.analytics.cnzzId` 开关。
