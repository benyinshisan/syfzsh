# 目录地图

每个目录放什么、谁往里写、改了会怎样。**换内容看第 1 节，改样式看第 2 节，怕踩坑看第 3 节。**
（使用说明见 [README.md](README.md)，模板机制见 [ARCHITECTURE.md](ARCHITECTURE.md)，
后台见 [CMS.md](CMS.md)，怎么写内容见 [WRITING.md](WRITING.md)。）

## 0. 一眼看全

```
content/      ← 你要填的内容（文章、会员、栏目说明）
data/         ← 栏目配置与会员名单（YAML，不是文章）
layouts/      ← 页面长什么样的模板（改这里要懂 Hugo）
assets/       ← 样式、JS、图片原图（会被 Hugo 处理）
static/       ← 原样拷贝的文件：后台上文件、站点图标
scripts/      ← 辅助脚本（生成后台配置、导入会员、排序…）
archetypes/   ← 命令行建稿骨架（`hugo new` 用，后台不读）
hugo.toml     ← 唯一主配置（站点参数、导航、栏目）
public/ 等    ← 构建产物，**都可再生、不要手改、不进 git**
```

## 1. 内容：`content/`

**谁往里写：** 你（或后台编辑同事）。格式是 Markdown + front matter。

| 目录 | 放什么 | 前台对应 |
|---|---|---|
| `content/_index.md` | 首页自己的内容 | `/` |
| `content/about/` | 关于我们（`overview` 简介、`charter` 章程、`organization` 组织机构、`join` 入会指南、`contact` 联系我们） | `/about/…`，导航「关于我们」的五个二级项 |
| `content/news/` | 新闻，四个子栏目：`notice` 通知公告、`association` 商会动态、`industry` 行业资讯、`media` 媒体报道 | `/news/…` |
| `content/members/` | `directory/` 会员名录（**一家公司一个文件**）、`dynamics/` 会员动态、`services/` 会员服务 | `/members/…` |
| `content/policy/` | 政策法规，文章直接放在此目录下（没有二级栏目） | `/policy/` |
| `content/party/` | 党群工作，同上 | `/party/` |
| `content/search.md` | 站内搜索**这一个页面**，不是文章。`layout: search` 决定它用搜索模板 | `/search/` |

两个容易踩的点：

- **`content/members/directory/` 下的每个文件是「一个条目」而不是「一篇文章」。** 它们写
  `type: member`，会被排除出上级栏目的文章列表（配置在 `hugo.toml` 的
  `params.entrySections`）。漏写 `type` 不会报错，只会让会员公司混进文章流里。
- 每个栏目**目录必须存在且有 `_index.md`**，否则导航出现空白项或构建报错。

## 2. 展示：`layouts/`、`assets/`

**谁往里写：** 只有懂 Hugo 模板的人（大概率就是你）。

| 目录 | 放什么 |
|---|---|
| `layouts/_default/` | 骨架与通用页面：`baseof`（整页框架）、`list`（栏目页，自动判别一级/二级）、`single`（文章页）、`directory`（名录页）、`search`（搜索页） |
| `layouts/member/` | 会员详情页，由 `type: member` 命中 |
| `layouts/partials/components/` | 跨页复用的小块：板块标题、缩略图、分页器、面包屑、侧栏… |
| `layouts/partials/home/` | 首页 7 个版块，一个版块一个文件 |
| `layouts/index.html` | 首页，本身只有 62 行：把上面 7 个版块排一下 |
| `layouts/index.searchindex.json` | 搜索索引的产出格式（跟着上面的文章自动生成） |
| `assets/css/` | 四层样式：`tokens`（设计令牌，换肤只改它）→ `base`（重置与排版）→ `components`（组件）→ `pages`（页面）。约定**底层不引用上层**，构建时拼成一个 `site.css` |
| `assets/js/theme.js` | 全站唯一一份 JS（ES5、无依赖、无构建），7 个初始化函数 |
| `assets/uploads/` | 图片原图，按栏目分目录。Hugo 从这里取图做缩放/转 WebP/补宽高 |

## 3. 怕踩坑就看这节

### 3.1 手写 / 生成 / 内容 —— 改了会不会被盖掉

| 文件 | 性质 | 改了会怎样 |
|---|---|---|
| `content/**`、`data/**` | 内容 | 正常，这就是给你改的 |
| `layouts/**`、`assets/css/**`、`assets/js/**`、`hugo.toml` | 手写代码/配置 | 正常，改完重新构建即生效 |
| **`static/admin/config.yml`** | **生成物** | 手改会在下次跑 `npm run cms:config` 时**被覆盖**。要改就改生成器 `scripts/gen-cms-config.mjs`，再跑一次 |
| **`static/admin/sidebar-groups.css`** | **生成物** | 同上 |
| `static/admin/decap-cms.js` | 第三方内置（5MB） | 别动。升级用 `npm run cms:vendor` |
| `data/members_order.yaml` | 半生成：可手拖，脚本也会重写 | 想批量调顺序跑 `npm run members:order`；手改也行，它是给人看的名单 |
| `public/` `public-local/` `public-check/` `resources/` | 构建产物 | 全部可再生，已 gitignore，**不要手改、不要提交** |

### 3.2 别碰清单

- **`hugo.local.toml`** 不是废弃文件：它给「双击就能看的离线版」用（`npm run build:local`
  → `public-local/`）。**不要拿它的产物去部署**，部署只用 `npm run build`。
- **`static/uploads/`** 现在是空目录（只剩占位文件）。图片实际都在 `assets/uploads/` 下，
  两者都会发布到同一个 `/uploads/` 网址 —— 往哪写图片，看 `hugo.toml` 的 `[module.mounts]` 注释。
- **仓库根的 `hugo.exe`（约 64MB）** 是本地开发用的二进制，**已在 .gitignore 里**，不会被提交。
- `archetypes/` 的三个模板**只在命令行 `hugo new` 时生效**；后台 `/admin/` 新建不读它们，
  后台表单由 `scripts/gen-cms-config.mjs` 生成。两条路各有一套，改字段要改生成器。

### 3.3 几个「静默出错」的坑（不报错，只是结果不对）

- **改栏目必须同改四处**：`content/<栏目的 _index.md>`、`hugo.toml` 的 `[[menu.main]]`、
  `data/home.yaml` 的各 `xxxSection`、`hugo.toml` 的 `[[params.homeTabs]]`。漏一处不报错。
- **一页只能用一次 `.Paginator`**（另一个调用会静默拿到同一份缓存）。
- **漏填 front matter 字段是静默降级**：少个日期顺序就变了、少个封面图列表里就没图。

## 4. 配置与数据

| 文件 | 作用 | 谁消费它 |
|---|---|---|
| `hugo.toml` | 唯一主配置：站点基本信息、`[[menu.main]]` 导航、页脚联系信息、四页签、分页条数、图片挂载 | Hugo 本身 |
| `data/home.yaml` | 首页各版块的标题、条数、数据来源栏目 | `partials/home/` 的五个版块（featured / headline / industry / members-wall / members-news） |
| `data/friendlinks.yaml` | 首页「友情链接」 | `partials/home/friendlinks.html` |
| `data/partners.yaml` | 内页右栏「合作机构」 | `partials/components/sidebar.html` |
| `data/members_order.yaml` | **会员展示顺序的唯一来源** | `partials/components/member-pages.html`（名录页 / 首页 LOGO 墙 / 页脚滚动都经它取数） |

## 5. 脚本：`scripts/`

| 脚本 | 干什么 | npm 命令 |
|---|---|---|
| `hugo.mjs` | 跨平台找到 Hugo 再启动（优先仓库根的 `hugo.exe`，其次 PATH） | 被 `dev` / `build` 间接调用 |
| `gen-cms-config.mjs` | 生成后台配置与左栏样式 | `npm run cms:config` |
| `sync-member-order.mjs` | 把现有会员与 `members_order.yaml` 对齐（不改变现有顺序，只补新会员） | `npm run members:order`（`-- --dry-run` 只看不改） |
| `import-members.mjs` | 一次性：把 YAML 名单批量建成会员内容页。**没有默认输入文件**（迁移用的 `data/members.yaml` 已随改版删除，会员已导入完），留着是当范例。要再用必须显式给文件 | `npm run members:import -- --from 名单.yaml` |
| `vendor-decap.mjs` | 把 Decap CMS 前端内置到 `static/admin/`（不依赖 CDN） | `npm run cms:vendor` |
| `fix-offline-html.mjs` | 「双击可看版」收尾：修 `public-local/` 里的路径 | 被 `build:local` 调用 |

## 6. 后台：`static/admin/`

| 文件 | 性质 |
|---|---|
| `index.html`、`editor-components.js`、`preview.js` | 手写 |
| `config.yml`、`sidebar-groups.css` | **生成物**（改生成器，别手改） |
| `decap-cms.js`、`decap-cms.js.LICENSE.txt` | 内置的第三方前端，别动 |

后台是**纯静态文件**，Hugo 不会给它做子路径处理 —— 所以里面的路径必须写相对形式
（`../images/…`），写死 `/images/…` 会落到账号根站上去。

## 7. 其它

| 路径 | 说明 |
|---|---|
| `.github/workflows/hugo.yaml` | CI：构建并发布到 GitHub Pages（pin 死 Hugo/Node 版本，`TZ=Asia/Shanghai`） |
| `static/images/` | 站点图标与后台标识（`favicon.gif`、`cms-logo.svg`） |
| `package.json` | 只有命令与一个开发依赖（`decap-server`），**不参与前端构建** |
| `node_modules/`、`package-lock.json` | 本地装 Decap 本地编辑用，已 gitignore |

---

**新增目录或改动上面这些约定时，请顺手更新本文件。**
