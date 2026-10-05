# 目录地图

每个目录放什么、谁往里写、改了会怎样。**换内容看第 1 节，改样式看第 2 节，怕踩坑看第 3 节。**
（使用说明见 [README.md](README.md)，模板机制见 [ARCHITECTURE.md](ARCHITECTURE.md)，
怎么写内容见 [WRITING.md](WRITING.md)，专题分析见 [docs/](docs/README.md)。）

## 0. 一眼看全

```
content/      ← 你要填的内容（文章、会员、栏目说明）
data/         ← 栏目配置（YAML，不是文章）
layouts/      ← 页面长什么样的模板（改这里要懂 Hugo）
assets/       ← 样式、JS、图片原图（会被 Hugo 处理）
static/       ← 原样拷贝的文件：站点图标、还没迁进 assets/ 的老图
scripts/      ← 辅助脚本（启动 Hugo、批量导入会员、离线版收尾）
archetypes/   ← 新建内容时的字段骨架（`hugo new` 用）
hugo.toml     ← 唯一主配置（站点参数、导航、栏目）
public/ 等    ← 构建产物，**都可再生、不要手改、不进 git**
```

> 本站**没有后台**：内容一律用编辑器直接改文件，改完提交、推送，CI 自动发布。
> 字段含义、图片放哪、正文插图版式都写在 [WRITING.md](WRITING.md)。

## 1. 内容：`content/`

**谁往里写：** 你（用编辑器直接改文件）。格式是 Markdown + front matter。

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
| `layouts/index.searchindex.json` | 搜索索引的产出格式；**字段定义在 `layouts/partials/search-index-data.html`**（搜索页内联的是同一份数据） |
| `assets/css/` | 四层样式：`tokens`（设计令牌，换肤只改它）→ `base`（重置与排版）→ `components`（组件）→ `pages`（页面）。约定**底层不引用上层**，构建时拼成一个 `site.css` |
| `assets/js/theme.js` | 唯一的**手写** JS（ES5、无构建），7 个初始化函数 |
| `assets/js/vendor/flexsearch.min.js` | 站内搜索的检索引擎（Apache-2.0，来源/版本/更新方式见同目录 `README.txt`）。**只在搜索页加载**，别挂到全站 |
| `assets/uploads/` | 图片原图，按栏目分目录。Hugo 从这里取图做缩放/转 WebP/补宽高 |

## 3. 怕踩坑就看这节

### 3.1 手写 / 生成 / 内容 —— 改了会不会被盖掉

| 文件 | 性质 | 改了会怎样 |
|---|---|---|
| `content/**`、`data/**` | 内容 | 正常，这就是给你改的 |
| `layouts/**`、`assets/css/**`、`assets/js/**`、`hugo.toml` | 手写代码/配置 | 正常，改完重新构建即生效 |
| `public/` `public-local/` `public-check/` `resources/` | 构建产物 | 全部可再生，已 gitignore，**不要手改、不要提交** |

> 仓库里已经没有「跑脚本会被覆盖」的源文件了 —— 原先唯一那类文件是「内容后台」的
> 生成配置，它已随后台一起移除。剩下的「生成物」只有构建产物本身。

### 3.2 别碰清单

- **`hugo.local.toml`** 不是废弃文件：它给「双击就能看的离线版」用（`npm run build:local`
  → `public-local/`）。**不要拿它的产物去部署**，部署只用 `npm run build`。
  （⚠ 离线版目前有个既有的路径 bug，见 [docs/README.md](docs/README.md) 末尾。）
- **`assets/uploads/` 与 `static/uploads/` 的区别**：见第 6 节。往哪写图片别凭感觉。
- **仓库根的 `hugo.exe`（约 64MB）** 是本地开发用的二进制，**已在 .gitignore 里**，不会被提交。
- `archetypes/` 的三个模板**只在命令行 `hugo new` 时生效**；直接用编辑器新建文件也行，
  把字段照抄过去即可。**字段的权威说明是 [WRITING.md](WRITING.md)**，模板注释与它同步。

### 3.3 几个「静默出错」的坑（不报错，只是结果不对）

- **改栏目必须同改四处**：`content/<栏目的 _index.md>`、`hugo.toml` 的 `[[menu.main]]`、
  `data/home.yaml` 的各 `xxxSection`、`hugo.toml` 的 `[[params.homeTabs]]`。漏一处不报错。
- **一页只能用一次 `.Paginator`**（另一个调用会静默拿到同一份缓存）。
- **漏填 front matter 字段是静默降级**：少个日期顺序就变了、少个封面图列表里就没图。
- **会员顺序＝每个会员页自己的 `weight`**，而 `weight` 写 `0` 或省略会排到**最后**（不是最前），
  且有并列时会落到 date / linkTitle 兜底键上。约定用不重复的正整数、留空隙 —— 见 WRITING.md。
- **跨挂载点时 `hugo server` 收不到文件变更**：项目目录挂在 Windows 盘、由 Linux 侧
  （容器 / WSL / 远程开发）访问时，底层收不到 inotify 事件，Hugo **不重建也不报错** ——
  表现是「保存了但站点没反应」，后台编辑器右栏预览也不自动刷新。
  `npm run dev` 因此带了 `--poll 700ms` 改用轮询，见 README 的「启动」一节。

## 4. 配置与数据

| 文件 | 作用 | 谁消费它 |
|---|---|---|
| `hugo.toml` | 唯一主配置：站点基本信息、`[[menu.main]]` 导航、页脚联系信息、四页签、分页条数、图片挂载 | Hugo 本身 |
| `data/home.yaml` | 首页各版块的标题、条数、数据来源栏目 | `partials/home/` 的五个版块（featured / headline / industry / members-wall / members-news） |
| `data/friendlinks.yaml` | 首页「友情链接」（顶层键就是分组标题） | `partials/home/friendlinks.html` |
| `data/partners.yaml` | 内页右栏「合作机构」 | `partials/components/sidebar.html` |

> 会员展示顺序**不在 `data/` 里**，也没有单独的顺序文件：它由每个会员页自己的
> `weight` 决定，`partials/components/member-pages.html` 直接返回 Hugo 的原生排序。

## 5. 脚本：`scripts/`

| 脚本 | 干什么 | npm 命令 |
|---|---|---|
| `hugo.mjs` | 跨平台找到 Hugo 再启动（优先仓库根的 `hugo.exe`，其次 PATH） | 被 `dev` / `build` / `build:local` 间接调用 |
| `import-members.mjs` | 批量把名单建成会员内容页（权重自动接在现有最大值之后）。**没有默认输入文件**，要显式给 `--from` | `npm run members:import -- --from 名单.yaml` |
| `fix-offline-html.mjs` | 「双击可看版」收尾：修 `public-local/` 里的路径 | 被 `build:local` 调用 |

> **没有依赖要装**：`package.json` 的 `devDependencies` 已空，`npm install` 不再需要
> （直接 `node scripts/…` 或 `./hugo` 也能跑，npm 只是省得敲长命令）。

## 6. 图片：`assets/uploads/` 与 `static/uploads/`

两条路都会发布到同一个 `/uploads/…` 网址，但处理方式不同：

| 放哪 | 会被 Hugo 处理吗 | 适用 |
|---|---|---|
| `assets/uploads/<栏目>/` | **会**：缩放 + 转 WebP + 补宽高（防 CLS） | 正常情况，图片都放这里 |
| `static/uploads/<栏目>/` | 不会，原样发布 | 只用于「老图慢慢搬」的过渡 |

- 引用时写 `/uploads/<栏目>/<文件名>`（前导斜杠可有可无），模板 `components/img.html` 负责处理。
- `hugo.toml` 的 `assets/uploads → static/uploads` 挂载会把**原图也发布一份**，这是给
  `og:image`（分享缩略图）与 `img.html` 的 fallback 分支（SVG / GIF / assets 里找不到的图）
  用的 —— 删掉它这两处会 404。详见 `hugo.toml` 里 `[module.mounts]` 的注释。

## 7. 其它

| 路径 | 说明 |
|---|---|
| `.github/workflows/hugo.yaml` | CI：构建并发布到 GitHub Pages（pin 死 Hugo 版本，`TZ=Asia/Shanghai`；纯 Hugo 构建，不装 Node） |
| `static/images/` | 站点图标（`favicon.gif`） |
| `package.json` | 只有几条 `npm run` 便利命令，**无依赖、不参与前端构建** |

---

**新增目录或改动上面这些约定时，请顺手更新本文件。**
