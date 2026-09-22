# 内容管理（Decap CMS）

本站使用 [Decap CMS](https://decapcms.org/)（原 Netlify CMS）作为内容管理后台。
采用 **仅本地编辑** 模式：编辑者在本机通过 `decap-server` 读写本地 git 工作区，
改完自行 `git commit / push`，由 GitHub Actions 重新构建发布。

> 线上 `https://www.zjsm.org/admin/` 打开只会看到一段说明，**无法登录**——
> 这是有意为之，原因见文末「为什么线上不能登录」。

---

## 快速开始

```bash
# 1. 首次安装依赖（只需一次）
npm install

# 2. 终端 A：启动本地内容代理（http://localhost:8081）
npm run cms

# 3. 终端 B：启动 Hugo 预览（http://localhost:1313）
npm run dev

# 4. 浏览器打开后台
open http://localhost:1313/admin/
```

在后台里新增/修改内容 → 保存时会直接写入本机 `content/` 或 `data/` 文件 →
在终端 B 的 Hugo 预览里立即能看到效果 → 确认无误后提交：

```bash
git add -A
git commit -m "content: 新增通知公告 xxx"
git push
```

### 端口被占用

`decap-server` 默认监听 `8081`，被占用时换端口：

```bash
PORT=8082 npm run cms
```

同时把 `static/admin/config.yml` 里的 `local_backend` 改成：

```yaml
local_backend:
  url: http://localhost:8082/api/v1
```

---

## 实时预览（编辑页右侧的预览面板）

预览面板已改为 **内嵌本机 Hugo 渲染出来的真实页面**（`static/admin/preview.js`
为 20 个集合注册了自定义预览模板），所以你看到的是最终版式，而不是字段罗列。

两个前提：

1. **`npm run dev` 必须在运行**。面板里的 iframe 指向 `http://localhost:1313`，
   Hugo 没起来就是一片空白——这也是「预览不正常」最常见的原因。
2. **内容必须先保存一次**。Hugo 只读取磁盘文件，未保存的新文章还没有生成页面文件，
   此时面板会提示「请先保存」。

保存后预览会自动刷新：`preview.js` 订阅了 Decap 的 `postSave` 事件；
此外 Hugo 自带的 LiveReload 也会让 iframe 里的页面自动重载。面板右上角另有
「刷新」与「新窗口打开」两个按钮。

> 新增栏目时，除了改 `config.yml`，还要把集合名加进
> `static/admin/preview.js` 的 `LIVE_COLLECTIONS`；否则该栏目会退回 Decap
> 默认的字段罗列预览。

---

## 后台能管理什么

| 后台分组 | 对应目录 | 说明 |
| --- | --- | --- |
| 通知公告 / 浙商联新闻 / 商联会活动 / 诚信评选 | `content/news/*` | 5 个一级栏目 |
| 要闻集锦 / 专家视点 / 民生热点 | `content/industry/*` | |
| 国家政策 / 省内政策 / 政策文件 | `content/policy/*` | |
| 会员动态 | `content/members/dynamics` | |
| 党建动态 / 党建活动 / 清廉园地 | `content/party/*` | |
| 标准化动态 / 标准下载 / 标准化政策法规 | `content/standards/*` | 目录已建好，暂无文章 |
| 投资服务 / 浙江商贸 | `content/services/*` | 目录已建好，暂无文章 |
| 关于浙商联 | `content/about/*.md` | 概况 / 章程 / 组织机构 / 入会指南 / 联系我们 |
| 数据 · 会员名单 | `data/members.yaml` | 首页「会员名录」滚动 |
| 数据 · 友情链接 | `data/friendlinks.yaml` | 首页底部四组友情链接 |
| 数据 · 协会链接 | `data/partners.yaml` | 首页右栏图片位 |

共 **19 个文章栏目 + 5 个关于页 + 3 个数据文件**。

### 不在后台管理的内容

* **栏目页 `_index.md`**（如 `content/news/notice/_index.md`）：负责栏目标题、
  导航排序 `weight` 和栏目简介，属于结构性配置，仍由开发者直接改文件。
  CMS 的文章列表会自动把它们排除（原理见下）。
* **首页版块 / 导航菜单**：在 `hugo.toml` 里，见 README。
* `content/search.md`、`layouts/`、`static/` 等模板与静态资源。

---

## 几个关键设计（改配置前请先读）

### 1. 用 `filter` 把 `_index.md` 挡在文章列表外

Decap 的 folder 集合会列出目录下所有 `.md`，包括 Hugo 的栏目页 `_index.md`。
而 Decap 目前**还没有**官方的 `ignore` 选项
（[issue #2727](https://github.com/decaporg/decap-cms/issues/2727) 仍未关闭；
相关 PR [#7382 `index_file`](https://github.com/decaporg/decap-cms/pull/7382) 尚未合并）。

本站的做法是利用 Decap 的过滤语义（源码 `filterEntries`）：

```js
const fieldValue = entry.data[filterRule.get('field')];
if (Array.isArray(fieldValue)) return fieldValue.includes(filterRule.get('value'));
return fieldValue === filterRule.get('value');
```

于是每个文章集合都写了：

```yaml
filter: {field: categories, value: news}   # 各栏目换成自己的分类
```

* 文章都有 `categories: [news]`（数组）→ `includes('news')` → **收录**；
* `_index.md` 没有 `categories` → `undefined === 'news'` 为假 → **排除**。

**好处：现有 80 篇文章一行都不用改。**
代价是：`_index.md` 里绝对不能加 `categories`，否则它会重新混进文章列表。

### 2. 新建文章的 `categories` 必须自动带上

每个集合里都有一个隐藏字段：

```yaml
- {label: 栏目分类, name: categories, widget: hidden, default: [news]}
```

如果去掉它，新建的文章没有 `categories`，会被上面的 `filter` 判定为不匹配，
**保存后在列表里“消失”**。新增栏目时务必同步这三处：
`folder`、`filter.value`、`categories.default`。

### 3. 日期为什么带 `+08:00`

```yaml
- {label: 发布日期, name: date, widget: datetime,
   format: 'YYYY-MM-DDTHH:mm:ssZ', default: '{{now}}'}
```

`format` 里的 `Z` 让 Decap 写出**带本地时区偏移**的时间，例如
`2026-09-22T03:29:00+08:00`，与 `hugo new content` 生成的一致。

不要改成纯日期格式（`date_format: 'YYYY-MM-DD'`）：Hugo 会把纯日期当成
**UTC 午夜**，而 `buildFuture` 默认为 false，于是「今天」新建的文章在
UTC 跨日之前（CST 早上 8 点前）会被构建**静默丢弃**——这是本仓库踩过的坑。

### 4. 未声明的字段不会被删掉

Decap 序列化时会 `values.merge(serializedData)` 保留所有未配置的 front matter
键（源码 `lib/serializeEntryValues.js`）。因此旧站导入的 `legacyId`、`legacyUrl`
以及 `carousel`、`headline` 等字段即使不在 `config.yml` 里，编辑保存后依然保留。

### 5. 中文文件名

`slug.encoding: unicode`，新文章文件名取自标题，例如
`content/news/notice/2026-09-22-关于xxx的通知.md`。Hugo 已开启
`hasCJKLanguage = true`，中文路径可正常构建，URL 会被浏览器按百分号编码。
若希望文件名保持 ASCII，把 `encoding` 改成 `ascii`（中文会被丢弃，可能得到空
名字，需配合手动改文件名）。

### 6. 数据文件的两点注意

* Decap 保存 YAML 时会**重新序列化整个文件**，文件顶部的 `#` 说明注释会丢失。
* `data/friendlinks.yaml` 的顶层键（`协会站点` 等）会被
  `layouts/partials/home/friendlinks.html` 直接当作分组标题渲染，所以
  `config.yml` 里这几个字段的 `name` 必须与 YAML 键**一字不差**。

---

## 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| `/admin/` 空白 | 打不开 jsDelivr CDN；检查网络，或把 `decap-cms.js` 下载到 `static/admin/` 改成本地引用 |
| 提示 `Failed to load config.yml` | `config.yml` YAML 语法错误。用 `python3 -c "import yaml;yaml.safe_load(open('static/admin/config.yml'))"` 检查 |
| 后台里看不到已有文章 | 该文章的 `categories` 与集合的 `filter.value` 不一致 |
| 保存后文章从列表消失 | 同上，或 `categories` 隐藏字段的 `default` 被改坏 |
| 改动没进 Hugo 预览 | 看终端 B 有没有报错。`content/` 与 `data/` 改动 Hugo 都会自动重载（已实测），页面若没刷新按 Ctrl+F5 强刷 |
| 预览面板一片空白 | `npm run dev` 没在运行；或这是还没保存过的新文章（Hugo 只读磁盘文件） |
| `npm run dev` 报 `hugo: not found` | 已修复：脚本改走 `scripts/hugo.mjs`，优先用仓库根目录自带的 `hugo`，找不到再回退 PATH |
| `decap-server` 起不来 | 8081 被占用，见上文「端口被占用」 |
| `npm install` 报缓存只读 / EROFS | 沙箱/容器里 `~/.npm` 不可写，加 `--cache ./.npm-cache` |

---

## 为什么线上不能登录

Decap 是纯前端应用，要读写 GitHub 仓库必须有一个 **OAuth 代理**来保管
GitHub OAuth App 的 client secret；GitHub Pages 是纯静态托管，跑不了这段服务。
`decap-server` 只监听本机、且 CORS 默认只接受 `localhost / 127.0.0.1`
（`decap-server >= 3.8.0` 的安全策略），所以线上 `/admin/` 无法用它。

`static/admin/index.html` 里因此加了一段守卫：非本地域名直接显示中文说明，
不加载 CMS，避免编辑者看到无法使用的登录页。

### 以后想开放线上编辑

1. 部署一个 OAuth 代理（官方推荐 Cloudflare Worker 模板
   [sterlingwes/decap-proxy](https://github.com/sterlingwes/decap-proxy)），
   在 GitHub 建 OAuth App 并把回调指向它；
2. 修改 `static/admin/config.yml`：

   ```yaml
   backend:
     name: github
     repo: benyinshisan/zjsm-hugo
     branch: main
     base_url: https://<你的代理域名>
   ```

   并把 `local_backend` 改成 `false`（或删掉）；
3. 删除 `static/admin/index.html` 里那段本地域名守卫；
4. 也可以考虑改用 Netlify 的 Git Gateway，或官方托管的 Decap Turbo。

---

## 不要提交的东西

`node_modules/` 与 `package-lock.json` 都已加入 `.gitignore`。`npm install` 只用于本地编辑，
GitHub Actions 的构建不依赖它们：工作流仅在存在 `package-lock.json` 时才安装 Node 并
`npm ci`，本仓库刻意不提交 lockfile，以免 CI 为了一个纯 Hugo 构建多装一遍无关依赖。
