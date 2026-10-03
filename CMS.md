# Decap CMS 使用说明

后台跑在本机，直接读写仓库里的文件。编辑者不需要懂 git，也不需要联网后台。

## 1. 启动

```bash
npm install     # 首次：装 decap-server
npm run cms     # 终端 A：decap-server，监听 http://localhost:8081
npm run dev     # 终端 B：hugo server，http://localhost:1313
```

浏览器打开 <http://localhost:1313/admin/>。

> `static/admin/index.html` 里有一段 localhost 守卫：**非本地域名不加载 CMS**，
> 只显示一段中文提示。因为 decap-server 出于安全只接受 localhost 来源，
> 线上 `/admin/` 本来就登录不了，不如给个明确提示。

### CMS 前端是本仓库内置的，不走 CDN

`static/admin/decap-cms.js` 是提交进仓库的 Decap CMS 完整前端（约 5MB，
gzip 后 ~1.4MB）。**前台访客不会下到它**，它只在打开 `/admin/` 时加载。

之所以内置而不是从 CDN 引：原本引的是 `cdn.jsdelivr.net`，而它在国内经常连不上，
此时后台是**整页空白、控制台一条报错都没有**（脚本压根没下载下来），
编辑同事看到的就是个白屏，且无从排查。内置之后后台彻底离线可用。

```bash
npm run cms:vendor              # 按脚本里 PINNED 的版本重新下载
npm run cms:vendor -- 3.17.0    # 升级到指定版本（升级后务必自测一遍后台）
npm run cms:vendor -- --check   # 只对比本地与线上的体积，不下载
```

国内下载慢时挂代理：`HTTPS_PROXY=http://127.0.0.1:7890 npm run cms:vendor`。

## 2. 核心机制：三处必须逐字一致

每个文章集合有**四个字段同源**，全部由同一个 `dir` + `cat` 派生：

| 字段 | 作用 | 不同步的后果 |
|---|---|---|
| `folder` | 文章落盘目录 | 存到别处，Hugo 不生成页面 |
| `preview_path` | 预览地址（Decap 自带的预览用；本仓库替换成了 `preview.js`，见 §4） | 预览 404 |
| `filter.value` | Decap 用它过滤 `categories` | 列表里看不到自己的文章 |
| `categories.default` | 新建文章时写入的分类 | **保存成功但列表里“消失”** |

> 另外还有一组必须一致但更容易被忽略的：`slug` 模板里的 `{{fields.slug}}`、
> `preview_path` 里的 `{{fields.slug}}`，以及 `preview.js` 的路径推导逻辑 ——
> 三者都要跟 Hugo 的 URL 规则对齐，见 §4.1。

### `filter` 到底在挡什么

Hugo 的 `_index.md`（栏目页）和文章放在同一个目录里，`_index.md` 没有
`categories` 字段。Decap 的 `filter` 就是按 `categories` 的值筛，从而把
`_index.md` 挡在文章列表之外 —— 否则每个栏目下面都会混进一个「通知公告」
这样的栏目页条目。

### `categories` 填什么

**一级栏目的目录名**，二级栏目共用一级的值：

| 一级栏目 | 目录 | `categories` 值 |
|---|---|---|
| 新闻中心 | `content/news/` | `news` |
| 会员天地 | `content/members/` | `members` |
| 政策法规 | `content/policy/` | `policy` |
| 党群工作 | `content/party/` | `party` |

这是 hidden 字段并带 `default`，新建文章会自动带上，**不要改**。

> `categories` 只服务于 CMS。`hugo.toml` 里已经 `disableKinds = ["taxonomy","term"]`，
> 不会生成 `/categories/` 归档页。

### 为什么是生成而不是手写

8 个文章集合 × 4 个必须逐字一致的字段，手写必然漂移。所以：

```bash
# 改 scripts/gen-cms-config.mjs 里的 sections 表，然后：
npm run cms:config
```

`static/admin/config.yml` 是**生成产物，不要手工编辑**（文件头也写了这句）。

## 3. 后台的几处「为了少犯错」的设计

编辑同事反馈原来的后台「难用、不符合直觉」，下面这些是照着具体痛点改的。
改集合定义请改生成器，不要手改 `config.yml`。

### 3.1 左栏按一级栏目分组显示（子栏缩进 + 组标题）

Decap 的左侧栏是**一个扁平列表**（`<ul>` 里一行一个 `<li>`），官方没有分组配置。
9 个栏目平铺下来，「通知公告 / 商会动态 / 行业资讯 / 媒体报道 / 会员单位 /
会员动态 / 会员服务 / 政策法规 / 党群工作」看不出谁属于谁。

现在左栏长这样：

```
首页            ▾
关于我们        ▾
新闻中心                  ← 组标题
    通知公告              ← 缩进的子栏
    商会动态
    行业资讯
    媒体报道
会员天地                  ← 组标题
    会员单位
    会员动态
    会员服务
政策法规        ▾
党群工作        ▾
```

**实现方式是一份生成的 CSS**：`static/admin/sidebar-groups.css`，由
`scripts/gen-cms-config.mjs` 的 `sidebarGroupsCss()` 从同一张 `sections` 表产出，
在 `static/admin/index.html` 里用 `<link>` 引入。config.yml 里的 `label`
仍然是短的「通知公告」—— 组标题和缩进由 CSS 加，两边配合才是上图的效果。

> ⚠ 改栏目（增删、改分组名）之后必须重新跑 `npm run cms:config`，
> 否则 `config.yml` 与 `sidebar-groups.css` 会对不上。

#### 为什么不用 Decap 自带的 `nested` 折叠

Decap 确实有个 `nested: {depth: 1}` 能把一个集合折叠成树，看着正是我们要的。
但它**文件夹节点的名字取的是该文件夹里第一条内容的标题**
（`decap-cms-core` 的 `NestedCollection`：

```js
function getNodeTitle(node, collection) {
  if (!node.isRoot && node.isDir && hasSubfolders) {
    const first = node.children.find(c => !c.isDir);
    if (first && first.title) return first.title;   // ← 文章标题
  }
  return node.title;                                 // ← 英文目录名 notice
}
```

另一条分支 `subfolders: false` 会让内容列表整个空掉（它的过滤条件是
「相对路径里不含 `/`」，而我们的文章都在子目录里），所以走不通。

也就是说折叠之后，四个子栏会显示成**各自最新一篇文章的标题**，例如
「关于开展2026年度会费收缴工作的通知」——比不折叠更难用。

> 那为什么不是「写进 label 前缀」？试过（`新闻中心 · 通知公告`），
> 四行都以「新闻中心」开头，看着重复；而且它只是文字前缀，
> 没有真正的层级感。CSS 方案能做出缩进和独立组标题，且不碰 DOM。

#### 为什么是纯 CSS 而不是改 DOM

Decap 是 React + styled-components。**挪动它渲染出来的节点会被下一次重渲染
打回原形**，甚至报错。CSS 只改外观，React 完全不知情，最坏情况是样式不生效
—— 那就退回「扁平 + 短名」，链接照常能用，不会白屏。

选择器用的是 Decap 给每个集合的侧栏链接打的 `data-testid="<集合名>"`，
配合 `:has()`（Chrome/Edge 105+、Safari 15.4+、Firefox 121+）。
组标题是 `<li>` 上的 `::before`，**不在 `<a>` 里**，所以不可点、不影响跳转。

> 只有**二级栏目**才缩进。政策法规、党群工作自己就是一级栏目，缩进会让它们
> 看起来隶属于上面那一组。判据是目录里有没有 `/`。

### 3.2 「网址别名」填错会当场报错

别名（`slug`）里混进中文或大写字母，Hugo **不报任何错**，只会静默生成
`/news/notice/%E4%B8%AD%E6%96%87/` 这样的网址，贴出去才发现。

现在 `slug` 字段带 `pattern` 校验（生成器的 `SLUG_PATTERN`），只能是小写字母、
数字、连字符，填错时错误提示直接显示在输入框下方。

> ⚠ 正则与提示文案里都不能出现**单引号**（YAML 单引号标量的转义符），
> 也不能出现**半角逗号** —— 这些字段是内联流式写法 `{...}`，
> 半角逗号会被当成字段分隔符。

### 3.3 列表页可以筛选与排序

| 集合 | 列表顶部多出来的东西 |
|---|---|
| 文章集合 | 筛选「草稿（还没发布的）」「上首页轮播的」；按 日期 / 标题 / 更新日期 排序 |
| 会员单位 | 按 权重 / 名称 / 收录日期 排序 —— **只影响你在后台列表里看到的顺序，不影响前台**。前台的先后由「会员排序」那份名单一处决定，见下一节 |

> ⚠ `view_filters` 的匹配规则是「字段有值 且 `new RegExp(pattern).test(值)`」。
> 所以它**表达不了「没填」**：`pattern: ''` 会命中所有**填了**的条目，
> 想筛「还没配 LOGO 的会员」做不到 —— 别照直觉写。

### 3.4 右下角的「使用说明」

Decap 没有帮助/上手引导这类配置项。`preview.js` 末尾用原生 DOM 挂了一个
悬浮按钮（`mountHelp()`），点开是发内容的顺序与三个常见坑。

它**刻意挂在 `document.body` 上、不进 React 组件树** —— Decap 用
styled-components + React，往它的树里插节点会被重渲染抹掉。

### 3.5 表单字段按「写稿顺序」排

最常用的三项在前：**标题 → 网址别名 → 正文**，其余全部选填。原来「正文」
排在最底部，每次写稿都要先滚过十来个字段。

会员单位的字段也重排过一次：名片类字段（LOGO / 行业 / 简介 / 官网 / 联系方式）
连着排，正文随后，收录日期与权重这类管理字段放最后。

### 3.6 后台标识

`logo_url: /images/cms-logo.svg`（图在 `static/images/cms-logo.svg`）。
留空的话 Decap 会显示它自带的图标，编辑同事会以为进错了别人的系统。
那只是一个主色方块加一个「商」字，**不含任何机构信息**，将来有正式 LOGO
直接替换该文件即可，`config.yml` 不用动。

`site_url` / `display_url` 指向 `http://localhost:1313`：本仓库是纯本地编辑，
线上 `/admin/` 打不开，指向示例域名只会让右上角「查看站点」点了没反应。

## 4. 实时预览

`static/admin/preview.js` 把本机 Hugo 渲染的真实页面内嵌进预览面板，而不是
Decap 默认的「字段平铺」。

- 前提：`npm run dev` 正在跑，且该条目**已经保存过一次**（Hugo 只读磁盘文件，
  未保存的新文章还没有页面，此时面板会给出提示）
- 保存后自动刷新 iframe；Hugo 自己的 LiveReload 也会让 iframe 内页面重载
- 路径由 `entry.path` 推导：`content/news/notice/foo.md` → `/news/notice/foo/`

> ⚠ **新增栏目时最容易漏的一处**：`preview.js` 顶部的 `LIVE_COLLECTIONS`。
> 漏一个不报错，只是那个栏目静默退回「字段平铺」预览，看起来像「预览坏了」
> 但控制台一片干净。集合名必须与 `config.yml` 的 `collections[].name` 逐字一致。

### 4.1 网址别名（`slug`）与预览地址的联动

每篇新文章都**必须**填「网址别名」，它同时决定三件事：

| 填 `jiangong-2026` | 结果 |
|---|---|
| 文件名 | `content/news/notice/2026-03-02-jiangong-2026.md` |
| front matter | `slug: jiangong-2026` |
| 前台网址 | `/news/notice/jiangong-2026/`（Hugo 用 `slug` 顶掉文件名那一段） |
| CMS 预览 | `/news/notice/jiangong-2026/` |

四者对齐靠的是三处都在用**同一个字段**：`config.yml` 的
`slug: '{{year}}-{{month}}-{{day}}-{{fields.slug}}'`、`preview_path`、
以及 `preview.js` 里显式读 `entry.getIn(['data','slug'])`。

**改它等于换网址**，已发布的文章不要动，否则原有链接失效。

#### ⚠ 为什么是「必填」而不是「可选」

这件事看着该做成可选（不填就退回日期+标题），但 Decap 3.x 做不到，实测结论：

1. Decap 的 `slug:` 模板**没有「字段为空就退回默认」的条件语法**。
   用 `{{fields.slug}}` 时，字段留空会让文件名塌成 `2026-03-02-.md`。
2. 字段名若叫 `slug`，Decap 自己的文件名模板 `{{slug}}` **并不读它**
   （`{{slug}}` 取的是标题的字面值），但 Hugo 会认 front matter 里的
   `slug` —— 于是文件名是中文、网址是别名，`preview.js` 推导出的预览地址
   两边都不是，直接 404。

所以只能二选一：要么全站中文 URL（不加这个字段），要么必填。本仓库选了后者。
现有 38 篇占位文的 `slug` 已按**当前文件名主干**补齐（如
`slug: 2026-04-11-sample-01`），因此**网址与加字段之前完全一致**，编辑打开
老文章也不会被空值卡住。

> 想在 `content/` 里手写、不走后台的文章，记得同样补上 `slug`。

## 5. 集合一览

| 类型 | 数量 | 说明 |
|---|---|---|
| 文章集合 | 8 | 每个二级栏目一个；政策法规与党群工作没有二级，各 1 个 |
| 会员集合 | 1 | `members-directory`：会员单位，一条目一页 |
| 会员排序 | 1 | `members-order`：一份名单（不是内容页），决定首页 LOGO 墙 / 名录页 / 页脚会员名录的先后，见 §5.2 |
| 固定页集合 | 1 | `about`：商会简介 / 章程 / 组织机构 / 入会指南 / 联系我们 |
| 首页集合 | 1 | `home`：首页设置 / 首页版块 / 友情链接 / 合作机构，四个文件装在同一个集合里，见 §6 |

**栏目页（`_index.md`）不在 CMS 里。** 栏目标题、栏目简介只能在文件里改。
这是有意的取舍 —— 栏目页有 `weight`、`layout` 等字段，混进文章列表会让
`filter` 机制失去意义。

### 5.1 会员单位（唯一的条目型集合）

会员**不是数据文件**，而是内容页：`content/members/directory/<别名>.md`。
改版前它是 `data/members.yaml` 里的一串名字，而数据文件不产生页面 ——
会员因此拿不到独立网址，也没有放 LOGO、简介的位置。

| 与文章集合的差别 | 说明 |
|---|---|
| 文件名不带日期前缀 | 模板是 `{{fields.slug}}` 而不是 `{{year}}-{{month}}-{{day}}-…`。会员网址 `/members/directory/<别名>/` 是长期贴出去的，不该随建站日期变 |
| 字段更精简 | 标签 / 来源 / 首页轮播 / 草稿这些文章字段没有意义，换成单位类型、官网、联系人、电话、地址 |
| 隐藏字段 `type: member` | 决定前台用 `layouts/member/single.html`，并让会员页不被当成文章混进 `/members/` 的文章列表。<br>**⚠ 不要改，也不要删** —— 丢了会静默退回默认文章模板 |

一份会员名单要批量导入，用 `scripts/import-members.mjs`：

```bash
node scripts/import-members.mjs --from 会员名单.txt --dry-run   # 先看会生成什么
node scripts/import-members.mjs --from 会员名单.txt
```

名单一行一个企业名，想自己定别名就写「企业名|slug」。脚本**默认不覆盖**已存在的
文件（后台补过的 LOGO / 简介不该被重跑冲掉），确实要重建加 `--force`。

新增的会员会同时出现在三处：首页 LOGO 墙、`/members/directory/` 名录页、
以及内页页脚的滚动名录 —— 三处都读同一批内容页，没有第二份名单。

**但「出现在哪」和「排在第几位」是两件事**：位置由 §5.2 的排序名单决定。

### 5.2 会员排序（调整会员在各处的先后）

后台左侧「会员天地 → 会员排序」。控件是**一行一个会员的列表**：

- **改顺序**：按住行**左侧那个点状的小把手（⋮⋮）**上下拖 —— **只有把手能拖**，
  按在行里其他地方会变成打开下拉框。每行 75px 高、行距 92px，一行一个会员竖直
  排列（旧版是一堆 chip 挤在一起、行会回流）。这是 2026-09-27 按编辑者
  "排序手感太差"的反馈改的。
- **换人**：每行本身是一个**可搜索下拉框**，行里显示的是**公司全称**，输入公司名
  （或简称）就能选，**不用手打网址别名**。
- 行首的「＋ 新增顺序」在末尾追加一行。

存进 `data/members_order.yaml`，形如：

```yaml
order:
  - lanzhou-maoyi
  - gansu-jiancai
```

存的是会员的**网址别名（`slug`）**，不是标题 —— 所以改标题不会打乱顺序。
这也是为什么 §3.2 强调别名对已收录的会员不要改。

> 控件改版**不影响这个文件的结构**：`order:` 下面仍然是一串裸别名（不是
> `- item: 别名` 那种对象）。这一点很重要 ——
> `layouts/partials/components/member-pages.html` 与
> `scripts/sync-member-order.mjs` 都按"字符串数组"读它。
> 后台的 list 控件只有写成**复数** `fields:` 才会把每项存成对象，本项目用的是
> **单数** `field:`（见 `scripts/gen-cms-config.mjs` 的 `memberOrder`），别顺手改。

**三处展示共用这份顺序**：首页 LOGO 墙、会员名录页、页脚滚动名录。它们都调
`layouts/partials/components/member-pages.html` 取数，所以不可能出现
「墙上和名录页顺序不一样」——那会让人以为墙上漏了几家。

两条兜底规则（都是为了不让内容凭空消失）：

| 情况 | 结果 |
|---|---|
| 名单里**没写**的会员 | **不会隐藏**，排在名单之后（这一段按 `weight` 兜底；新会员没有 `weight`，一律落在最末尾）。所以新录的会员一定出现在名录里，想让它靠前再拖上去 |
| 名单里写了但**对不上**的条目（别名打错、会员已删） | 该行被忽略，并在 `npm run build` / `npm run dev` 的输出里打一条 `WARN [会员排序] …`。想一次看全哪些条目失效：跑 `npm run members:order -- --dry-run`，它会列出「剔除失效条目」 |

> **为什么需要一条兜底**：如果只认名单，新会员保存成功后会在名录里"消失" ——
> 这种"保存成功了但看不见"的故障最难查，所以这里一律兜住。

**生成的文件会被重写**：后台保存会整个重写 `data/members_order.yaml`，
文件顶部的注释说明会丢。跑一次下面这条命令能把注释和名单一起理回来，
顺带补进新会员、清掉已删的：

```bash
npm run members:order              # 就地更新
npm run members:order -- --dry-run # 只看会改什么
```

> **「排序权重」这个字段已经从前台隐去** —— 会员表单里看不到它了。理由就是这份名单：
> 顺序由名单一处决定，再留一个权重输入框，两个地方都能改顺序，迟早对不上。
> 字段本身没有删掉：Decap 只会写回**声明过**的字段，声明一删，后台保存一次就会
> 把 front matter 里的 `weight` 抹掉，所以它改成了 `widget: hidden`，原值原样留在文件里。
>
> 它剩下的唯一作用是**兜底顺序**：名单里没写的会员排在名单之后，这一段仍按
> `weight` 排（实测过一条反直觉行为：**不填或填 0 会排在填了的后面**，不是
> "视为 0 排最前"）。新录的会员没有 `weight`，所以一律落在最末尾，
> 再拖到想要的位置即可。

## 6. 首页集合与数据文件的约定

侧栏里的**「首页」是一个集合，里面装四个文件**：

| 文件 | 前台对应 | 内容 |
|---|---|---|
| `content/_index.md`（首页设置） | `/` 的正文区 | 富文本，显示在首页中部 |
| `data/home.yaml`（首页版块） | 首页各版块 | 每个版块一段：标题、条数、数据来源栏目 |
| `data/friendlinks.yaml`（友情链接） | 首页底部友情链接带 | 四个分组，键名即分组标题 |
| `data/partners.yaml`（合作机构） | 首页右栏「合作机构」 | 名称 / LOGO / 网址 |

它们都是首页的组成部分，所以收在一起。

> **为什么是一个集合而不是四个？** Decap 的左侧栏「一行 = 一个 collection」，
> 没有子分组。原来友情链接、合作机构各是一个独立集合、各只有一个文件，
> 在左栏里跟「关于我们」「新闻中心」平级，看不出它们属于首页。
> 合集之后左栏显示为「首页 ▾ + 文件下拉」。

> **首页这一组的预览是「按文件」分流的**（`preview.js` 里的 `HomePreview`）：
> `content/_index.md` 走正常 iframe，三个 `data/*.yaml` 显示一张说明卡
> （告诉编辑「这是数据文件、改完回首页看效果」）。
> 之所以要分流：Decap 的预览模板是**按集合**注册的，管不到单个文件，
> 早先注册整个集合会把三个 YAML 推成 `/data/home.yaml/` 这种 404 地址 ——
> 于是当时干脆整个集合都不注册，代价是首页这组的预览退化成字段平铺。
> 路径分流之后两个问题一起解决了。

### 6.1 `data/home.yaml`：首页版块

首页每个版块（图片新闻、新闻中心、行业资讯、会员 LOGO 墙、会员动态）
各有 `count`（最多几条）；除「图片新闻」外还各有 `section`（数据取自哪个栏目）。
改条数、换来源栏目都在这里改，不用动模板。

> **「新闻中心」块取的是整个栏目，连同子栏目一起。** 它默认 `section: news`，
> 模板用 `.RegularPagesRecursive` 把四个子栏目（商会动态 / 通知公告 /
> 行业资讯 / 媒体报道）的文章一并捞进来，按日期混排。所以首页不再单列
> 「通知公告」「媒体报道」等小栏，一栏就看得到全部新闻。
> 换成叶子栏目（如 `news/notice`）也成立 —— 那时它等价于只取那一栏。
>
> ⚠ **「新闻中心」的 `count` 数的是列表，不含头条。** 模板先取第 1 条当头条
> （只出标题），再从剩下的里面取 `count` 条作列表 —— 所以这一栏最多显示
> `count + 1` 篇。填 6 就是「1 条头条 + 6 条列表 = 7 篇」。

> ⚠ **Decap 保存时会重写整个 YAML，字段里没声明的键会被删掉。**
> 这是 Decap 的固有行为（同 §6 末尾那条注释丢失的说明）。所以往
> `data/home.yaml` 加键时，必须同时在 `scripts/gen-cms-config.mjs` 的 `home`
> 集合里补上对应字段，否则下次在后台点保存，新键就没了。

> ⚠ **「图片新闻」是唯一没有 `section` 的版块**：它读的是文章的
> `featured: true` 勾选（文章编辑页里的「首页轮播」开关），不是某个栏目。
> 后台只能改它的标题与条数，选哪几篇要去文章里勾。

### 6.2 仍然只能在文件里改的首页配置

- **四页签**、**侧栏快捷按钮**：`hugo.toml` 的 `[[params.homeTabs]]` / `[[params.sideLinks]]`
- **页脚会员滚动条高度**：`hugo.toml` 的 `[params.footer] membersMarqueeHeight`
  （注意是 `[params.footer]`，不是首页版块 —— 那条滚动条在页脚，且首页不显示它）

- **`data/friendlinks.yaml`**：**顶层键本身就是分组标题**，
  `home/friendlinks.html` 直接把它们当 `<dt>` 渲染。因此生成器里 `home` 集合
  `friendlinks` 文件（`data/friendlinks.yaml`）的字段 `name` 必须与这三个键
  **一字不差**（协会站点 / 企业站点 / 政府站点）。
  改标题要同时改 YAML 与生成器两处。

  > 这里的「协会站点」指的是**其他兄弟协会**的网站，不是本会，别顺手改成「商会」。

- **`data/partners.yaml`**：顶层键 `partners` 是对象数组（名称 / LOGO / 网址），
  对应首页右栏的「合作机构」。

> Decap 保存时会**重新序列化整个 YAML 文件，顶部的说明性注释会丢失**。
> 这是 Decap 的固有行为，不是配置问题。

## 7. 图片上传与排版

图片存 `assets/uploads/`，引用写 `/uploads/…`；后台按集合**自动分目录**：

| 集合 | 上传后落在 | 页面里引用 |
|---|---|---|
| 文章（news / policy / party） | `assets/uploads/<一级栏目>/` | `/uploads/<一级栏目>/xxx.jpg` |
| 会员单位（LOGO 与正文） | `assets/uploads/members/` | `/uploads/members/xxx.png` |
| 会员「企业环境 / 产品案例 / 资质荣誉」三组 | `assets/uploads/members/{env,product,honor}/` | `/uploads/members/env/xxx.jpg` |
| 关于我们 | `assets/uploads/about/` | `/uploads/about/xxx.jpg` |

`static/uploads/{ad,news}/` 是旧方案的遗留空目录（各有 `.gitkeep`），新图不要再往那里放。

### 为什么是 `assets/` 而不是 `static/`

`static/` 里的图片 Hugo 不做任何处理：手机直出的 5–10MB 原图会原样发给访客，
而且 `<img>` 拿不到宽高，加载完成时页面会「跳一下」。放在 `assets/` 里的图，
构建时由 `layouts/partials/components/img.html` 统一缩放、转 WebP、补上
`width`/`height`。

代价是 `assets/` 的东西默认**不发布**，而后台跑在浏览器里、只能通过网址取图 ——
所以 `hugo.toml` 里额外挂了一条：

```toml
[[module.mounts]]
  source = "assets/uploads"
  target = "static/uploads"
```

把原图也当静态文件发布一份，后台的缩略图预览才不是一片破图。结果是
`public/` 里原图和 WebP 各存一份（构建产物，不进版本库）；访客拿到的仍然
是页面里引用的 WebP，原图只在后台上传/预览时被请求。

⚠ 一旦写了 `[[module.mounts]]`，Hugo 的**默认挂载会被整体替换**，
所以 `hugo.toml` 里把用到的目录一个不落地列全了。新增顶层目录
（如 `i18n/`）时要记得补一条，否则那个目录会静默失效。

### 两条必须成对的规则

**① `media_folder` 与 `public_folder` 必须成对出现。** 只写 `media_folder` 时，
Decap 会把 `public_folder` 赋成同一个字符串（decap-cms 的字段归一化：
`"media_folder" in e && !("public_folder" in e) → public_folder = media_folder`），
于是引用路径里混进 `assets/` 前缀，前台全部 404。生成器里每个集合都成对输出。

**② 正文那个 markdown 字段必须带上自己那一对。** 字段级的 `media_folder` 不会
从集合级继承到正文插图组件上 —— Decap 里那段传播逻辑只认字段自己有没有配
（见下面「插图组件的 id 必须是 image」）。

### 正文插图的版式

正文图片由渲染钩子 `layouts/_default/_markup/render-image.html` 统一处理，
引号里的关键字决定版式：

| 写法 | 效果 |
|---|---|
| `![说明](图.jpg)` | 居中，正文宽度（默认） |
| `![说明](图.jpg "wide")` | 加宽通栏 |
| `![说明](图.jpg "left")` | 左浮动，文字绕右侧 |
| `![说明](图.jpg "right")` | 右浮动，文字绕左侧 |
| `![说明](图.jpg "plain")` | 只出 `<img>`，不加 `<figure>`、不显示图注（手写备用） |

方括号里是 `alt`，同时用作图片下方的图注；为空则不输出 `<figcaption>`。

⚠ **图片必须独占一段**（上下各留空行）。夹在句子中间会被当成行内小图，不加版式。
这依赖 `hugo.toml` 里的 `markup.goldmark.parser.wrapStandAloneImageWithinParagraph = false`
—— 它默认为 `true`，此时钩子拿到的 `.IsBlock` 恒为 `false`，输出的 `<figure>`
会被套进 `<p>` 里变成非法嵌套，浏览器容错会补出一个空 `<p>`、多吃一倍段间距。

### 插图组件的 id 必须是 `image`

`static/admin/editor-components.js` 注册的是**中文的**插图对话框
（图片 / 图片说明 / 版式）。它的 `id` 特意写成 `image`，也就是**覆盖** Decap
内置的图片组件，而不是新增一个。依据是仓库内 `decap-cms.js` 里这段写死的逻辑：

```js
if (registry.has('image')) {
  const c = registry.get('image')
  c.fields = c.fields.update(找 widget === 'image' 的那一项, 把本 markdown 字段
                             自己的 media_folder / public_folder 注入进去)
}
```

它按 **id 是不是 `image`** 来决定要不要把「图片存到本栏目的目录」告诉插图组件。
换成别的 id（如 `tuwen`），上传的图会静默落到全局 `media_folder`
（`assets/uploads/` 根目录），分目录设计全部失效，**而且不报任何错**。

这条路径失效也不会让插图坏掉：加载失败时 Decap 退回它内置的图片组件，
正文里写出的仍是标准 `![说明](图 "版式")`，前台照常出图、居中、带图注 ——
坏的只是「编辑时能选版式」这个便利。

真要回退成内置那个英文的 Image / Alt Text / Title 对话框：把
`static/admin/index.html` 里加载 `editor-components.js` 的那一段去掉即可。
⚠ 别去改生成器里 `EDITOR_COMPONENTS` 的 `[image]` —— 它管的是工具栏组件列表
收窄到哪一个，改它并不能把内置组件换回来（`image` 这个 id 已经被本文件占了）。

文章没有配图时前台渲染 CSS 占位块，**不会出现破图**，所以不配图也完全没问题。

## 8. 媒体名与中文

```yaml
slug:
  encoding: unicode
```

这一段只管**媒体库**（上传的图片等）的文件名，与文章文件名无关 ——
文章文件名由「网址别名」字段决定，见 §4.1。

媒体名保留中文是因为 Hugo 开了 `hasCJKLanguage`，中文文件名正常工作；
改成 `encoding: ascii` 会把中文名直接丢弃，多张中文名图片可能撞名。

## 9. 以后要开放线上编辑

当前的 `backend: git-gateway` 只是占位（`local_backend: true` 时所有请求都走本机
代理）。要开放线上编辑：

1. `config.yml` 改成 GitHub 后端（生成器里已备好注释模板）
2. 配一个 OAuth 代理，填进 `base_url`
3. 删掉 `static/admin/index.html` 里的 localhost 守卫
4. `site_url` / `display_url` 换成真实域名
