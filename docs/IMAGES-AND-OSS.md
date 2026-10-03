# 图片管线与 OSS / CDN 迁移评估（执行清单）

> **注（2026-10）：Decap CMS（`/admin/` 本地内容后台）已从本站移除**，`public/admin/`
> 那 5.26MB 前端与后台上传流程都不复存在；文中的体积实测数字是当时的值。原文保留，
> 作为当时的决策记录。

> ## ⚠️ 部分结论已被取代（2026-10-03 晚）
>
> 后续一轮决策（见 [`HOSTING-DECISION.md`](HOSTING-DECISION.md)）把**托管与加速**这件事整体**搁置**，并否掉了本文下面这几条：
>
> 1. **第 13 行的「推荐路线 B：阿里云 CDN 回源到 GitHub Pages」不再推荐。** 在「不备案」的前提下它拿不到大陆节点（无速度收益），而且 Cloudflare / 阿里云**免费版都挂不上 `/syfzsh/` 子路径**（Host 头覆盖是 Enterprise 专属）。可行情景变成了「自定义域名 + GitHub Pages 原生 HTTPS +（可选）Cloudflare」。
> 2. **§7「阈值」里的费用口径不完整。** 任何**大陆节点**方案都必须额外持有一个「备案资源」（腾讯云正面清单只有 6 项，**不含 COS / CDN / EdgeOne**），最便宜是 Lighthouse ¥35/月起、包年包月 ≥3 个月 ⇒ **全年地板价 ≈ ¥420**。本文的费用表只反映"流量费"，不是"大陆方案总成本"。
> 3. **§5 的 `cdnBase` 开关在新路线下大概率用不上** —— CDN 是「整站挂在前面」，图片自然跟随，不需要单独的图片域名。该开关**无害**（默认空、零输出变化），保留即可，但不要再把它当成核心机制。
> 4. **真正该盯的信号是「可达性」而不是"月带宽 50 GB"** —— 见 `HOSTING-DECISION.md` §5 的触发规则。
>
> 本文**其余部分仍然有效**：图片管线基线（§2）、三条架构对比（§3）、子路径陷阱实测（§4）、缓存失效与时序（§10）、非 ASCII 文件名（§11）、两个白捡的改进（§12）。

> **面向**：`syfzsh` 站点所有者（兰州市商业发展商会官网）
> **站点形态**：Hugo 静态站 + GitHub Pages（Actions 部署，子路径 `/syfzsh/`）+ Decap CMS（`local_backend: true`）+ 前端零依赖
> **一句话结论**：**现在不需要迁**。容量和费用都不会成为理由；唯一真正的理由是**国内可达性** —— 而国内可达性**只迁图片解决不了**，HTML 必须一起迁。
> **本文用途**：这是一份「大概率会发生、但没有排期」的决策文档。它给**阈值**和**决策规则**，不给 go/no-go。

**已经定死、本文不再重新讨论的四件事**

1. 对象存储供应商：**阿里云 OSS**。
2. 真相来源：图片**仍然提交在 `assets/uploads/`**（仓库是唯一真相），Hugo 继续在构建期做 WebP + 输出宽高。
3. 迁移「大概率会发生，但未排期」，触发条件见 [§7](#7-阈值什么时候真的需要迁)。
4. 交付路线推荐 **B：阿里云 CDN 回源到 GitHub Pages**（不需要 OSS bucket、不需要 CI 同步、没有对象 key 映射问题）。A / C 的公平对比见 [§3](#3-三条架构对比)。

**唯一已经落地的代码改动**：图片 URL 增加 `cdnBase`（默认 `""`）与 `cdnStripBasePath`（默认 `false`）两个开关，见 [§5](#5-cdnbase-扩展点的实现)。**默认值下整站输出逐字节不变**（实测证据在 §5）。

**怎么读这份文档**

- 只想确认「现在要不要动」→ 读 §1、§2、§7。
- 迁移那天要照做 → 读 §5（改代码/配置）、§6（备案与硬前置）、§10（上传时序）、§11（中文文件名）。
- 只想顺手白捡两个改进 → 读 §12。

---

## 1. 结论摘要

- **现在不需要迁。** 按当前体量（构建产物 24.4 MB、27 个派生图）离 GitHub Pages 的硬上限还有 **40 倍以上**余量，离 100 GB/月软带宽上限还有 **十几万次/月**的余量（数字与算法见 §7）。
- **唯一真正的理由是「国内可达性」。** 不是费用问题（最贵场景约 ¥51/月），也不是容量问题（1 GB 站点上限、1 GB 仓库建议值都还远），而是「大陆访客能不能打开、打开多快」。
- **只迁图片解决不了国内访问。** HTML 仍然来自 `chihayam.github.io`：首页、列表页、正文都打不开或很慢时，图片再快也没有意义。同理，Decap 后台（`/admin/`，5.26 MB 前端）也在 GitHub Pages 上。要么整站一起迁，要么不迁 —— 这是本文最重要的一条判断。
- **迁移是概率事件，不是待办事项。** 决策规则见 §7 末尾；真正的先决动作是**先测大陆可达性**（见 §9），而不是先去开通 OSS。
- **§12 有两个与 OSS 决定无关、现在就能白捡的改进**（Decap 上传前压缩、`hugo.toml` 一条已过期的「零风险」注释）。

---

## 2. 当前图片管线基线（只读描述）

### 2.1 一条图片 URL 的完整链路

| 步骤 | 位置 | 行为 |
| --- | --- | --- |
| 1. 内容里写路径 | 正文 `![说明](/uploads/...)` 或模板传 `src` | 路径形如 `/uploads/news/xxx.jpg`（前导斜杠可有可无） |
| 2. 取资源 | [`img.html:56`](../layouts/partials/components/img.html#L56) `resources.Get (strings.TrimPrefix "/" $src)` | `resources.Get` **只认 `assets/`**；取不到就进 fallback |
| 3. 判断可否转码 | [`img.html:70`](../layouts/partials/components/img.html#L70) | 白名单 `jpeg / png / webp / bmp / tiff` 才处理 |
| 4. 缩放 + 转 WebP | [`img.html:81`](../layouts/partials/components/img.html#L81) `.Resize (printf "%dx webp q82" $max)`；否则 [`img.html:83`](../layouts/partials/components/img.html#L83) `.Process "webp q82"` | 宽度超过 `max`（默认 1200）才缩放；`max=0` 表示只转格式不缩放 |
| 5. 出标签 | [`img.html:85-87`](../layouts/partials/components/img.html#L85-L87) | 输出 `src` / `width` / `height` / `alt` / `title?` / `loading` / `decoding="async"` / `fetchpriority?` / `class?` |
| 6. 取不到资源时 | [`img.html:88-96`](../layouts/partials/components/img.html#L88-L96) | 走普通 `<img src>`：gif 仍有宽高（`img.html:72-75`、`94`），**svg 与「assets 里找不到该文件」两种情况下拿不到宽高** |

- **刻意不处理的两种格式**：`gif`（转 WebP 会丢动画）、`svg`（矢量图没有像素宽度）。它们是**不转码**，不是不输出。
- **fallback 分支的 CLS 缺口**：这条分支原本**完全不输出 `width`/`height`**（是会招 CLS 的）。同期的改动已给其中的 **gif** 补上宽高；**svg 与漏搬的文件仍无宽高**，这是已知且本地无法解决的残缺点。
- **外链直通**：`http(s)://` / `//` 开头的外链不查 `assets/`、不处理、不套 CDN 前缀（[`img.html:52`](../layouts/partials/components/img.html#L52)）。

### 2.2 原图的发布路径（后台缩略图依赖它）

[`hugo.toml:62-64`](../hugo.toml#L62-L64) 把 `assets/uploads` 同时挂成 `static/uploads`：

```toml
  [[module.mounts]]
    source = "assets/uploads"
    target = "static/uploads"
```

原因：`assets/` 里的文件默认**不发布**，而 Decap 的媒体库跑在浏览器里，只能通过 `/uploads/...` 取图。代价是构建产物里**原图和 WebP 各存一份**（不占 git，只占 `public/`）。**迁移到 OSS/CDN 后这条挂载必须保留**，否则后台媒体库整片缩略图会变破图。

### 2.3 正文图片的渲染钩子

[`render-image.html:74`](../layouts/_default/_markup/render-image.html#L74) 输出 `<figure class="md-figure md-figure--{{ $layout }}">`，`$layout ∈ {center, wide, left, right, plain}`（所以实际 class 形如 `md-figure md-figure--wide`，**全小写**）。只有 `.IsBlock`（图片独占一段）才走 `<figure>`；夹在句子里的图仍输出裸 `<img>`。

### 2.4 今天的构建基线（可复核）

本地 Hugo `v0.167.0`（CI 固定的是 `0.166.0`，见 [`.github/workflows/hugo.yaml:23`](../.github/workflows/hugo.yaml#L23)，两者对本页结论无差异），`--gc --minify --baseURL https://chihayam.github.io/syfzsh/`：

| 构建汇总项 | 实测值 |
| --- | --- |
| Pages | **71** |
| Static files | **40** |
| Processed images | **27** |
| Aliases | 11 |

- **Static files = 40** 的来源可核对：`static/` 下 12 个文件 + `assets/uploads/` 挂载过来的 28 个（22 张图片 + 6 个 `.gitkeep`）。
- **Processed images = 27** 而源图只有 **22 张**：同一张图被两种宽度用到时会生成两个派生文件。
- 构建产物 `public/` = **24.36 MB**（24,364,212 字节）；其中 `public/uploads/` ≈ **17.94 MB**、`public/admin/`（Decap 前端）≈ **5.26 MB**。
- `assets/uploads/` 源图合计 **16.2 MB**（最大单张 5.4 MB：`jiandan_upscayl_4x_ultrasharp.png`）。
- 27 个派生文件合计 **1.73 MB**，平均 **64 KB**。

**派生文件名形态（已核对）**：`<原basename>_hu_<16 位十六进制>.webp`，例如

```
uploads/members/product/kushui-meigui_hu_fb3606944db6ddd8.webp
                            └────── 16 hex ──────┘
```

同图不同处理参数 = 不同文件名，例如同一张 `tktu.jpg` 得到 `tktu_hu_14775b502ec683b0.webp` 与 `tktu_hu_70d9caf4691e7c58.webp`。这是 §10「不需要 CDN 刷新」的基础。

**复核命令（只读，随时可跑）**

```bash
cd syfzsh
npm run build                                  # = node scripts/hugo.mjs --gc --minify
find public -name '*_hu_*' | wc -l             # 期望 27
find public -name '*.html'   | wc -l           # 期望 67（Pages 71 含 RSS/sitemap/searchindex 等非 HTML 输出）
du -sb public public/uploads public/admin
find assets/uploads -type f ! -name '.gitkeep' | wc -l   # 期望 22
```

---

## 3. 三条架构对比

三条路线都假定：**图片继续提交在 `assets/uploads/`，Hugo 继续在构建期转 WebP + 输出宽高**。区别只在「构建产物里的图从哪里对外提供」。

| 维度 | **A. 镜像到 OSS** | **B. CDN 回源 GitHub Pages（推荐）** | **C. CMS 直传 OSS** |
| --- | --- | --- | --- |
| CLS / 宽高 | 不受影响（HTML 仍由 Hugo 生成，宽高照旧） | 不受影响 | **会被破坏**：编辑器写入的是 OSS/CDN 上的原始 URL，`resources.Get` 找不到 `assets/` 里的文件 → 走 fallback → 无宽高（gif 除外） |
| WebP / 响应式 | 不受影响（25 个派生图照样产出） | 不受影响 | **退化为原图直出**：没有 WebP、没有宽度阶梯，手机直拍的 5 MB 原图直接砸给访客 |
| CI 复杂度 | **高**：新增「同步 `public/uploads/` 到 OSS」步骤 + AccessKey 密钥 + 失败即 fail job；还引入「HTML 已发布、对象没传完」的时序窗口（§10） | **零 CI 改动**。可以一个 CI 步骤都不加 | CI 零改动，但复杂度全搬到 CMS 侧 |
| CMS 复杂度 | 低（媒体库照旧读仓库；代价是「编辑器刚上传的图要等 CI 同步完才在线上可见」） | 低（同今天） | **最高**：需要自己写媒体库扩展 + 一个签名直传端点（见下） |
| 费用（§8） | 存储计费 + OSS 出方向流量（社区价 0.25 / 0.50 元/GB，未核实） | 阿里云侧只付 CDN 流量 **0.24 元/GB**（官方）；**回源流量 CDN 不计费**；GitHub Pages 侧仍计它的 100 GB/月软带宽 | 同 A |
| 备案 | **必须**（自定义域名，§6） | **必须**（中国内地 CDN 加速域名要备案，§6） | **必须** |
| 失败模式 | 部分上传 → 线上破图（Pages 发布是原子的，OSS 不是） | CDN 回源到 `github.io` 失败/慢时图片慢或破，但 HTML 正常；需实测回源成功率 | **唯一会静默发出坏页面的方案**：编辑器里看得见图、线上没图或没宽高，构建不报错 |
| 缓存失效 | `_hu_<hash>` 已解决，无需 purge；代价是孤儿对象 | 同左 | 要自己管 key 与旧文件清理 |

### 3.1 为什么 B 在这个规模下占优

1. **改的东西最少**：DNS + CDN 加速域名 + 一个可选的一行配置（§5）。模板、CI、CMS 全不动。
2. **没有对象 key 映射问题**：CDN 收到的路径和源站路径一模一样（§4），不需要重写、不需要镜像。
3. **没有「两份真相」**：仓库仍是唯一真相，不存在「OSS 里有、仓库里没有」的图。
4. **回源流量 CDN 不计费**（[官方计费说明](https://help.aliyun.com/zh/cdn/product-overview/billing-overview)：回源流量不计入 CDN 计费，但源站可能产生出方向流量费用）—— 这里源站是 GitHub Pages，本身不单独收出方向流量费。

**B 的诚实短板，必须实测**：CDN 边缘节点在大陆，但**源站还在 `github.io`**。如果阿里云节点到 `github.io` 回源本身就慢/不稳定，那么冷缓存请求仍会慢——CDN 只对**已缓存**的请求有效。所以开通 B 之后要看 CDN 控制台的**回源失败率、回源首包时间**，并在 §7 的探针里加上「冷缓存请求」一项。

### 3.2 C 为什么是唯一会「静默发坏页面」的方案（硬阻塞）

- 官方 S3 媒体库 `decap-cms-media-library-s3` 实际是 **Decap Turbo 的功能**：文档写明 **Pro and above**，凭据放在 Turbo 的 **site variables**、由 **Turbo edge function** 代签转发（[Decap Turbo Media library](https://decapcms.org/docs/turbo-media-proxy/)）。也就是说它依赖托管后端，**与本站采用的 `local_backend: true`（[`static/admin/config.yml:42`](../static/admin/config.yml#L42)）不是一套东西，无法一起用**。
- npm 上确实有该包，但状态是 **beta**（`0.2.0-beta.0` / `0.2.0-beta.1`），keywords 里只有 aws / r2 / cloudflare，**没有阿里云 OSS**（[npm registry](https://registry.npmjs.org/decap-cms-media-library-s3)）。
- **npm 上没有任何「阿里云 OSS 的 Decap 媒体库」**。要走 C，等于自己写并长期维护：媒体库扩展 + 一个持有 AccessKey 的签名直传端点（OSS PostObject 签名），还要处理中文 key、CORS、缩略图。
- 更致命的是**构建期不可见**：直传到 OSS 的图不在 `assets/uploads/` 里，Hugo 的 `resources.Get` 拿不到 → 无 WebP、无宽高、无响应式，而且**构建不会报错**。页面上线后才发现图片是原图直出或尺寸缺失。

> 结论：**C 在「零前端依赖 + 构建期转码」的站点上是负收益**。除非将来有非技术编辑必须绕过 git 上传大图，否则不选 C。

---

## 4. 子路径陷阱（实测）

### 4.1 现象

站点部署在 `https://chihayam.github.io/syfzsh/`。用 `--baseURL https://chihayam.github.io/syfzsh/` 构建后（`--minify` 会去掉属性引号）：

```
HTML 里：           src=/syfzsh/uploads/members/product/kushui-meigui_hu_fb3606944db6ddd8.webp
磁盘上：     public/uploads/members/product/kushui-meigui_hu_fb3606944db6ddd8.webp
```

**全站 38 处 `<img>` 的 `src` 全部带 `/syfzsh/` 前缀**（也就是 38 处 `<img>` 就是全部 `<img>`）。复核：

```bash
grep -rho 'src=/syfzsh/uploads/[^ >]*' public --include=*.html | wc -l   # 38
grep -rho '<img ' public --include=*.html | wc -l                        # 38
```

原因：`$img.RelPermalink` 是**站点绝对路径**，包含 `baseURL` 的路径部分。而 `public/` 里资源落在 `/uploads/...`。

### 4.2 两条互斥的修法

| 修法 | 做法 | 代价 |
| --- | --- | --- |
| **保留前缀**（推荐接 B 的默认） | 对象 key / 源站路径**照抄 `/syfzsh/uploads/...`**。`cdnBase = "https://cdn.example.com"`，模板原样拼 `cdnBase + RelPermalink` | 对象 key 带 `syfzsh/`；域名将来给别的站复用时路径不干净 |
| **剥掉前缀** | 模板先把 `site.BaseURL` 的路径（`/syfzsh`）从 URL 上剪掉，再拼 `cdnBase`。得到 `https://cdn.example.com/uploads/...` | 源站必须把 `/uploads/...` **重写回** `/syfzsh/uploads/...`；镜像时则要把对象 key 写成 `syfzsh/uploads/...`。**这条依赖 CDN 的回源路径改写能力，需在控制台确认**（§13） |

### 4.3 为什么走「CDN 回源」时这个问题基本消失

CDN 加速域名 `cdn.example.com` 的源站填 `chihayam.github.io`（回源 HOST 也用 `chihayam.github.io`，HTTPS/443 + SNI）。访客请求 `/syfzsh/uploads/x_hu_ab12.webp`，CDN 就按**同一个路径**回源取 `https://chihayam.github.io/syfzsh/uploads/x_hu_ab12.webp`：

```
访客 → CDN：GET /syfzsh/uploads/x_hu_ab12.webp
CDN  → 源站：GET /syfzsh/uploads/x_hu_ab12.webp   ← 同一个路径，零重写
```

**不需要对象 key 映射，因为根本没有对象存储这一层。** 这也是 B 相对 A 最大的省事之处：§4.1 那个「HTML 带前缀、磁盘不带前缀」的不一致，在 A（镜像到 bucket 根）里会立刻变成 404，在 B 里根本不存在。

### 4.4 已实现的开关

`cdnBase`（默认 `""`）+ `cdnStripBasePath`（默认 `false`）。开启后两种子路径策略的输出（实测 38 处全部同形）：

| `cdnBase` | `cdnStripBasePath` | HTML 输出 |
| --- | --- | --- |
| `""`（默认） | `false` | `src=/syfzsh/uploads/…_hu_fb3606944db6ddd8.webp` |
| `https://img.example.com` | `false` | `src=https://img.example.com/syfzsh/uploads/…` |
| `https://img.example.com` | `true` | `src=https://img.example.com/uploads/…` |

细节约束（实现里已处理）：

- `cdnBase` 末尾的 `/` 会被 `TrimSuffix` 去掉，所以 `https://img.example.com/` 和 `https://img.example.com` 等价。
- **外链永不套前缀**（否则会得到 `https://img.example.com/https://other.com/a.jpg`）。
- `cdnStripBasePath` 剥的前缀来自 `site.BaseURL` 的 path（`hugo.toml:10` → `/syfzsh`）；部署在根目录时 path 为空，等于不剥。
- **`cdnBase` 不能与离线预览叠加**：见 §5.4。

---

## 5. `cdnBase` 扩展点的实现

### 5.1 代码是什么

| 文件 | 作用 |
| --- | --- |
| [`layouts/partials/components/cdn-url.html`](../layouts/partials/components/cdn-url.html)（新增，56 行） | 把站内图片路径改写成 CDN 前缀。`cdnBase` 为空时**原样返回** |
| [`img.html:85`](../layouts/partials/components/img.html#L85) | 处理成功的分支：`src="{{ partial "components/cdn-url.html" $img.RelPermalink }}"` |
| [`img.html:91-92`](../layouts/partials/components/img.html#L91-L92) | fallback 分支：先过 `site-url.html`（补子路径），再过 `cdn-url.html` |
| [`hugo.toml:121-122`](../hugo.toml#L121-L122) | `cdnBase = ""` / `cdnStripBasePath = false`（带完整说明注释） |

顺序不能颠倒：**`site-url.html` 先补出 `/syfzsh/` 前缀，`cdn-url.html` 再加 CDN 域名**。外链在 `img.html` 里就已分流，不进这两个 partial。

`cdn-url.html` 目前**只被 `img.html` 调用**（2 处）。其他出图组件（如 `thumb.html`）都委托给 `img.html`，因此**自动继承**这个开关 —— 不要在新组件里绕过 `img.html` 直接写 `<img src>`，否则迁移后会漏掉前缀。

### 5.2 默认值 = 今天的行为（已实测）

- `cdnBase` 为空时 `cdn-url.html` 走第一分支直接返回入参（[`cdn-url.html:42-44`](../layouts/partials/components/cdn-url.html#L42-L44)），**逐字节不变**。
- 实测：同一份代码连跑三次构建（默认 / 带 `cdnBase` / 带 `cdnBase`+strip），`Pages 71 / Static files 40 / Processed images 27` 完全一致；默认模式下 `src=/syfzsh/uploads/` 仍是 **38** 处，`img.example.com` 出现 **0** 次。
- 与「改动前的同一份仓库快照」对比：全部 HTML 差异**只有 6 处 `fetchpriority=high`**（那是同期另一项改动），**没有一处来自 CDN 开关**。

### 5.3 迁移日的执行清单

**路线 B（推荐，图片走 CDN、HTML 留在 GitHub Pages）**

- [ ] 备好已备案域名，加一条子域 `img.example.com`（§6）。
- [ ] 阿里云 CDN 添加加速域名 `img.example.com`：源站类型「域名」，源站 `chihayam.github.io`；**回源 HOST = `chihayam.github.io`**；回源协议 HTTPS、端口 443、开启 SNI。
- [ ] 配 HTTPS 证书（可申请免费证书）。
- [ ] 决定接法：
  - **整站前置 CDN**（`www.example.com` 直接回源 `github.io/syfzsh/`）→ **`cdnBase` 保持 `""`**，一行都不用改。
  - **只有图片走 CDN** → 改 [`hugo.toml:121`](../hugo.toml#L121) **一行**：`cdnBase = "https://img.example.com"`（`cdnStripBasePath` 保持 `false`）。
- [ ] **CI 不需要任何改动。**
- [ ] 验收：重新构建后 `grep -rho 'src=https://img.example.com/syfzsh/uploads/' public --include=*.html | wc -l` 应为 **38**；随机抽 3 张图 `curl -I` 应为 200 且 `Content-Type: image/webp`。
- [ ] 观察 CDN 控制台的**回源失败率 / 回源首包时间 / 缓存命中率**（§3.1 的短板）。

**路线 A（镜像到 OSS，仅当将来确实要脱离 GitHub Pages 时）**

- [ ] 建 bucket（就近地域）、绑自定义域名（= 备案）、开 CDN。
- [ ] 定 key 策略：**带 `syfzsh/` 前缀**（配 `cdnStripBasePath=false`）或**干净 key**（配 `true`）。
- [ ] 在 workflow 的 `actions/upload-pages-artifact` **之前**加同步步骤，失败即 fail job（§10.2）。
- [ ] 配防盗链白名单（§6）。
- [ ] 清理孤儿：定期比对 `public/uploads/` 清单与 bucket 列表，删除不再被引用的 `_hu_` 文件。

### 5.4 离线预览版是坏的（既有 bug，与 `cdnBase` 无关）

- `npm run build:local`（叠加 [`hugo.local.toml`](../hugo.local.toml)：`relativeURLs = true` + `uglyURLs = true`）产出的**双击可看版，本来就存在路径缺陷**。**已归因**：改动前的产物与改动后的产物在这个问题上完全一致，所以**不是本次 `cdnBase` 改动引入的**。
- 与本文直接相关的**硬约束**：`relativeURLs = true` 时 `$img.RelPermalink` 已经是「按页面深度算出来的相对路径」，再套一个 CDN 域名会得到形如 `https://img.example.com/../../syfzsh/uploads/x.webp` 的废链接。**所以离线构建必须让 `cdnBase` 保持为空。**

**症状（实测）**

```text
page : public-local/news/association/qinglian-weiwen-gongjiawan.html
link : <link rel="stylesheet" href="./syfzsh/css/site.min.<hash>.css">   ← 文件在 public-local/css/…
img  : <img src="../../syfzsh/uploads/...">                              ← 文件在 public-local/uploads/…
nav  : <a class="brand" href="./syfzsh/index.html">                      ← 文件在 public-local/index.html
```

实测计数：**图片 0/38 可解析、`href`/`src` 2/3661 可解析**。双击打开得到的是一个**没有样式、没有 JS、没有图**的裸页面 —— 这正是 `fix-offline-html.mjs` 花力气去掉 SRI 想避免的结果，但它被更上层的路径问题盖住了。

**根因**

`hugo.toml` 的 `baseURL` 带 `/syfzsh/` 子路径，而 `hugo.local.toml` 打开了 `relativeURLs`。Hugo 把资源 URL 相对化时会**连同 `baseURL` 里的子路径段一起保留**（`/syfzsh/uploads/x.webp` → `../../syfzsh/uploads/x.webp`），但产物目录里根本没有 `syfzsh/` 这一层。GitHub Pages 之所以没暴露这个问题，是因为它把产物根**挂载在** `/syfzsh/` 上；`file://` 没有这种挂载机制。这与 §4 的子路径陷阱是**同一个根因的两种表现**。

**连带后果**：`scripts/fix-offline-html.mjs` 的「目录式链接 → `.html`」那一步**静默失效**（报告 **0 处**改写）—— 它的判据是「先问磁盘再改」，而所有候选路径在磁盘上都不存在，于是它一个都没改，也**不报错**。

**已验证的修法（一行）**

```toml
# hugo.local.toml
baseURL = "/"
```

实测结果：图片 **38/38** 可解析、`href`/`src` **3740/3740** 可解析，且 `fix-offline-html.mjs` 的目录改写那一步开始正常工作（**330 处**改写）。副作用很小：`build:local` 明确「不用于部署」，`baseURL` 改成 `/` 只会让 `absURL` 类输出（例如 `og:image`）变成根相对路径，对离线预览没有影响。

**为什么本次没有改**：本轮范围被限定为「`cdnBase` + 懒加载三处修正」。这是一处独立的既有 bug，应当单独一次改动 + 单独回归。**建议尽快修**，因为 [`hugo.local.toml`](../hugo.local.toml) 的注释和 `fix-offline-html.mjs` 的注释都建立在「除了 SRI 之外一切正常」这个**已经不成立**的前提上。

---

## 6. 阿里云 OSS / CDN 的硬前置与坑

### 6.1 ⚠ 更正：早期「OSS 默认域名可以当免备案图床」的说法是错的

**错误说法**：用 OSS 默认域名 `xxx.oss-cn-xxx.aliyuncs.com` 就能直接对外显示图片，不需要备案。
**更正（官方事实）**：

1. **2022-10-09 00:00 之后开通 OSS 的账号，通过 OSS 域名访问「任意文件」都会被强制下载**：响应头里加 `x-oss-force-download: true` 和 `Content-Disposition: attachment`，浏览器弹下载而不是显示图片。官方文档的示例文件就是 `test.jpg`（[0048-00000113](https://help.aliyun.com/zh/oss/user-guide/0048-00000113)）。
2. **2025-12-22 10:00 起在指定地域新建的 Bucket 上，图片类 MIME 也被纳入**：华东6（福州）、华北6（乌兰察布）、华南2（河源）、华南3（广州）、华东5（南京）、华中1（武汉）；命中 `image/jpeg`、`image/png`、`image/webp`、`image/gif`、`image/svg+xml`、`image/bmp`、`image/heic` 等都会加这两个头（[0048-00000114](https://help.aliyun.com/zh/oss/user-guide/0048-00000114)）。

**因此**：想用 OSS 对外供图，**必须绑自定义域名**；而中国内地地域的自定义域名**必须有 ICP 备案**（或把内容放到非内地节点）。「免备案图床」这条路不存在。

> 注意第 2 条是按 **Bucket 创建地域 + 创建时间**描述的，官方文档未说明它与账号开通时间的关系（§13 第 12 条）。第 1 条则明确按**账号开通时间**。

### 6.2 另外五条硬前置 / 坑

| 事项 | 官方口径 | 对你的影响 |
| --- | --- | --- |
| **数据类 API 必须走 CNAME** | 自 **2025-03-20** 起，中国内地地域 OSS 默认公网域名调用上传/下载等数据类 API 会被拒绝，报 `PublicEndpointForbidden`，必须改用自定义域名（[帮助文档](https://help.aliyun.com/zh/oss/publicendpointforbidden-error-when-upload-object) / [官方公告](https://www.alibabacloud.com/zh/notice/oss_update_notice_policy_change_in_calling_data_api_operations_via_the_default_public_domain_name_45a)） | CI 同步脚本（路线 A）**一开始就得用自定义域名/CNAME**，不能用 `*.aliyuncs.com` |
| **域名实名认证** | 必须通过域名实名认证才能备案；且实名信息与备案主体负责人信息必须一致（[备案域名注意事项](https://help.aliyun.com/zh/icp-filing/basic-icp-service/support/for-the-record-domain-faq)） | 备案前先查域名实名与主体是否一致，否则被管局驳回 |
| **欠费会删数据** | 欠费后 **360 小时（15 天）内**充值不停服；超 360 小时自动停服；停服后 **15 天内**补足自动启用；**停服 15 天仍未补足 → 全部数据被清理删除、不可恢复**（[OSS 欠费](https://www.alibabacloud.com/help/zh/oss/overdue-payments)） | 迁移到 OSS 后 **仓库必须仍是唯一真相**（本文前提），否则一次欠费就丢图；同时给账号设余额提醒 |
| **防盗链** | OSS 支持 Referer 白名单（[防盗链](https://www.alibabacloud.com/help/zh/oss/user-guide/hotlink-protection)） | 绑自定义域名后建议配 `*.example.com` 白名单，避免图片被外站盗用刷流量 |
| **HTTPS** | 默认域名走阿里云自有证书；**自定义域名要自己上传/申请证书**（CDN 侧可申请免费证书） | 迁移日必须把证书这一步算进工期，否则 `https://img.example.com` 不可用 |

### 6.3 备案与子域名

- 未备案域名解析到**中国内地**服务器/加速服务，必须先完成备案才能对外提供服务；解析到**非中国内地**服务器则无需工信备案（[备案域名注意事项](https://help.aliyun.com/zh/icp-filing/basic-icp-service/support/for-the-record-domain-faq)）。
- **子域名 `img.example.com` 不需要单独再备一次案**：备案以域名为单位，主域名已备案时子域名被覆盖。阿里云 FAQ 亦有一条同向口径：「域名已备案，如果主域名未使用阿里云服务器，子域名仍使用阿里云服务器，属于已接入阿里云备案」。
- 但要留意 **接入备案**：把已在别处备案的域名接入阿里云（或其 CDN）时，可能需要在新服务商处做**接入**操作；各省管局口径可能不同 → 列入 §13 第 7 条。
- 云厂商侧按 **apex 域名**为单位管理：Cloudflare China Network 官方写明「必须为**每个**要接入的 apex 域名持有有效的 ICP 备案或许可」（[Cloudflare China Network](https://developers.cloudflare.com/china-network/)）。

### 6.4 实操清单（迁移日逐条打勾）

- [ ] region 就近选（兰州 → 华北/华东）。
- [ ] Bucket **私有**（走 CDN 回源 + 签名/白名单），不要一上来开公共读。
- [ ] 绑自定义域名 + 证书（§6.2）。
- [ ] 开 CDN，源站类型选 OSS 域名或自定义域名（**不要**用 OSS 默认公网域名做源站）。
- [ ] 配防盗链白名单。
- [ ] 配生命周期规则，人工确认后才清理 `_hu_` 孤儿（先比对清单，别直接删）。
- [ ] 给账号设**余额/欠费提醒**（§6.2）。
- [ ] 保留仓库里的原图，OSS 只是分发层。

---

## 7. 阈值：什么时候真的需要迁

### 7.1 GitHub Pages 的官方限制

| 限制项 | 官方口径 | 出处 |
| --- | --- | --- |
| 已发布站点大小 | **≤ 1 GB（硬上限）** | [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| 源仓库大小 | **建议 ≤ 1 GB** | 同上 |
| 单次部署耗时 | 超过 **10 分钟**判超时 | 同上 |
| 带宽 | **100 GB/月（soft 软限制）** | 同上 |
| 构建频率 | 10 次/小时（soft）——**用自定义 GitHub Actions workflow 构建发布时此限制不适用** | 同上 |
| 文件数 | **未记录任何文件数上限** | 同上 |
| 政策灰区 | 原话：Pages **"is not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions…"** | 同上 |

### 7.2 今天的用量与余量

| 指标 | 今天的值 | 距上限 | 说明 |
| --- | --- | --- | --- |
| 站点大小 | **24.36 MB**（实测 `public/`） | **≈ 42×** | 1 GB ÷ 24.36 MB |
| 站点大小（研究稿保守口径 ~55–60 MB） | ~55–60 MB | **≈ 17×** | 把仓库、`.git`(20 MB)、源图等一起算进去的口径；取**保守值 17×** 作为规划数字 |
| 带宽 | 见下两行 | — | 100 GB/月是**软**限制 |
| 带宽换页浏览量（研究稿口径） | 每次浏览「全冷图片集」**≈ 7.9 MB** | **≈ 13,000 次/月** | 保守下限：相当于一次首访把 5 张手机原图级别的图都拉一遍 |
| 带宽换页浏览量（实测口径） | 全站最重页面（`members/directory/jincheng-youpin/`）图片合计 **681 KB** | **≈ 150,000 次/月** | 按实际派生图算；平均派生图仅 64 KB，普通文章页 0.1–0.2 MB |
| 构建频率 | 每天几次 `push` | 自定义 Actions workflow **不受限** | — |

**结论：无论按哪套口径，费用和容量都不会成为约束。** 需要 17–42 倍图片增长才碰到 1 GB 站点上限；需要十万量级月浏览才碰到 100 GB 软带宽。

### 7.3 第二个非技术阈值：GitHub Pages 的政策灰区

上表最后一行是真实存在的风险：官方文档明文写着 Pages **不适合也不允许**当作「运营线上业务」的免费托管。商会站不是电商、不做交易，**是否算 "online business" 是可争的**。这条不构成技术阈值，但它是「GitHub 可能请你搬家」的唯一现实来源 —— 值得和国内可达性并列写进决策记录。

### 7.4 真正的阈值：国内可达性

- **这是唯一有说服力的迁移理由**（§1）。
- **诚实的不确定性**：本文作者**无法从中国境内实时测量**，`github.io` 在大陆各运营商的可达性结论来自**二手信息**。因此在做任何迁移决定之前，第一件事是**实测**。
- 探针执行清单（§9.1 有更完整的对照）：

```text
目标 URL：
  1) https://chihayam.github.io/syfzsh/                     （首页 HTML）
  2) https://chihayam.github.io/syfzsh/uploads/news/芳乃1.jpg （原图，未压缩）
  3) https://chihayam.github.io/syfzsh/uploads/news/tktu_hu_14775b502ec683b0.webp （派生图）
记录字段：各省 × 三网（电信/联通/移动）的成功率、首字节 TTFB、总耗时、DNS 解析耗时、是否有连接重置
建议工具：17ce（https://www.17ce.com/）、boce（https://www.boce.com/）、ITDOG（https://www.itdog.cn/）
```

### 7.5 决策规则（if → then）

| 触发条件 | 动作 |
| --- | --- |
| 大陆探针**成功率 < 90%**，或首页 TTFB 中位数 **> 3 s**，且商会明确要求大陆体验 | 启动**整站**迁移评估（图片单独迁无效，§9） |
| 大陆探针**可达性可接受**（成功率 ≥ 95%、TTFB 可接受） | **不动**。继续 GitHub Pages；每半年重测一次 |
| 收到 GitHub 关于 Pages 用途的通知 | 启动整站迁移评估（此时与可达性无关，是政策驱动） |
| 源图累计 **> 300 张** 或 `assets/uploads/` **> 300 MB** | 复核 §8 费用表与 bucket/仓库大小；**按现有数字仍不构成迁移的经济理由**，只是重算一遍 |
| 站点大小 **> 500 MB**（≈ 20× 图片增长） | 认真评估 A（镜像到 OSS）或整站迁走 |
| 月带宽 **> 50 GB**（软限制的一半） | 检查是不是被外站盗用/被爬；先查访问日志，再考虑 CDN |

---

## 8. 费用表

### 8.1 假设（先摆明，再看数字）

- 口径按研究稿：**30 张原图 × 1.5 MB + 30 张 WebP × 250 KB ≈ 52.5 MB** 常驻存储。**实测当前是 22 张、源图 16.2 MB、派生图 1.73 MB**，即下表略微高估，量级不受影响。
- 存储 = 0.0513 GB × **0.12 元/GB/月**（官方文档在存储费用页给出的示例单价：[OSS 存储费用](https://help.aliyun.com/zh/oss/storage-fees)）≈ **¥0.006/月**。
- CDN 流量 = 月流量 × **0.24 元/GB**（中国内地 0 GB–10 TB 档，官方价目表：[CDN 基础服务计费](https://help.aliyun.com/zh/cdn/product-overview/billing-rules-of-basic-services)）。
- 整数人民币，不含代金券/资源包优惠。

### 8.2 走 CDN（推荐路线）的月费

| 场景月流量 | CDN 流量费（0.24 元/GB） | 存储费 | **线性直算合计** | 研究稿口径合计 |
| --- | --- | --- | --- | --- |
| 5 GB | ¥1.200 | ¥0.006 | **≈ ¥1.21** | ≈ **¥1.29** |
| 50 GB | ¥12.000 | ¥0.006 | **≈ ¥12.01** | ≈ **¥12.76** |
| 200 GB | ¥48.000 | ¥0.006 | **≈ ¥48.01** | ≈ **¥51.01** |

> 研究稿的三个合计等效于 **≈ 0.255 元/GB**，比官方 0.24 高约 **6%**（可能来自 TCP 重传/计量口径的裕量假设，[官方也提示「实际网络流量比应用层统计更高」](https://help.aliyun.com/zh/cdn/product-overview/billing-rules-of-basic-services)）。**差额来源未核实**，见 §13 第 10 条。两列差 6%，不影响任何决策。

### 8.3 不走 CDN、直连 OSS 的最坏情形

OSS 出方向流量按 **0.25 / 0.50 元/GB**（**社区来源，未在官方价目表核实**）估算：

| 场景月流量 | 按 0.50 元/GB | 按 0.25 元/GB | 存储费 | **最坏合计** |
| --- | --- | --- | --- | --- |
| 5 GB | ¥2.50 | ¥1.25 | ¥0.006 | **≈ ¥2.51** |
| 50 GB | ¥25.00 | ¥12.50 | ¥0.006 | **≈ ¥25.01** |
| 200 GB | ¥100.00 | ¥50.00 | ¥0.006 | **≈ ¥100.01** |

**直连 OSS 的最坏情况也只有 ¥100/月量级，且贵在「没有 CDN 缓存」。** 这就是为什么走 CDN 时 §8.2 才是主表。

### 8.4 哪些数字是官方的，哪些是估的

| 数字 | 性质 |
| --- | --- |
| 存储 **0.12 元/GB/月** | **官方**（[OSS 存储费用页](https://help.aliyun.com/zh/oss/storage-fees)原文示例；OSS 定价页可能有活动价，见 §13 第 1 条） |
| CDN 中国内地 0–10 TB **0.24 元/GB** | **官方价目表**（[同上](https://help.aliyun.com/zh/cdn/product-overview/billing-rules-of-basic-services)） |
| CDN **回源流量不计费** | **官方**（[CDN 计费概述](https://help.aliyun.com/zh/cdn/product-overview/billing-overview)） |
| 每月前 **500 万次静态 HTTPS 请求免费** | 研究稿称官方有此项，**本次未在官方文档定位到** → §13 第 4 条。若成立则为 0 成本；若不成立，按 [静态 HTTPS 请求数计费](https://help.aliyun.com/zh/cdn/product-overview/billing-of-https-requests-for-static-content) 另计 |
| OSS 出方向 **0.25 / 0.50 元/GB**、回源 **0.15 元/GB** | **社区来源，未核实** → §13 第 2 条 |
| 阿里云 CDN **免费流量额度** | **未找到**任何免费流量额度；只有资源包（预付费更便宜） |

### 8.5 顺带对比：Cloudflare R2（严格更便宜，但有中国区硬伤）

| 项 | R2 官方 | 换算/影响 |
| --- | --- | --- |
| 存储 | **$0.015 / GB-month** | 52.5 MB ≈ $0.0008/月 |
| 出网流量 | **免费**（官方明示 no charges for egress） | 这是 R2 最大优势 |
| 免费额度 | **10 GB-month 存储 / 月** + 100 万次 Class A + 1000 万次 Class B | 52.5 MB 完全落在免费额度内 |
| 中国区节点 | **China Network 需 Enterprise 套餐**，且必须为**每个 apex 域名**持有有效 ICP 备案 | [Cloudflare China Network](https://developers.cloudflare.com/china-network/) |
| 备注 | Cloudflare Pages 在大陆不可用（社区/二手信息，§13） | 且 R2 免费额度是否需要绑卡未核实（§13 第 8 条） |

出处：[Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)。
**结论**：单看钱，R2 完胜（存储费可忽略、出网免费）。但对本站**完全不可用**：大陆访客要快就必须上 China Network（Enterprise + 备案），而免费版节点在境外，解决不了国内可达性。**R2 不是省钱选项，是另一条要重新走一遍备案的路线。**

---

## 9. 整站国内可达性（因为图片单独迁没用）

### 9.1 五个选项对照

| 选项 | 大陆可访问性 | 是否需要备案 | 说明 |
| --- | --- | --- | --- |
| **① 继续留 GitHub Pages** | 未知（**必须实测**） | 不需要 | 现状。零成本、零运维 |
| **② 前面加 Cloudflare 免费代理** | **基本不改善** | 免费版不需要 | 免费版节点在境外，大陆访客仍要跨境到 Cloudflare 节点；只能改善部分线路 |
| **③ 阿里云 OSS 静态网站托管 + 自定义域名 + CDN** | **最好** | **必须**（内地地域/内地 CDN） | 整站 HTML + 图片一起迁，一步到位。代价：备案工期 + CI 增加同步步骤 + OSS 不是原子发布（§10） |
| **④ Vercel / Netlify** | 与 GitHub Pages 同级的境外可达性问题 | 不需要（境外） | 免费额度有（带宽/构建分钟）限制；不解决国内问题 |
| **⑤ 国内其他静态托管** | 视服务商 | 必须 | 注意 **Gitee Pages 已经下线**（2024-05-01 起不可用，社区来源：[蓝点网](https://www.landian.news/archives/103754.html)、[Wikipedia](https://zh.wikipedia.org/wiki/Gitee)）；Gitee 官方帮助页未核到公告 → §13 第 13 条 |

### 9.2 推荐顺序

1. **先测**：按 §7.4 的探针清单，对 `https://chihayam.github.io/syfzsh/` 与两张代表性图片 URL 出一次大陆探针报告，留档。
2. 若**可达性可接受** → 什么都不做，每半年重测。
3. 若**可达性不可接受** → 走 **③ 整站迁阿里云**（OSS 静态网站托管 + 已备案域名 + CDN），**而不是只迁图片**。图片只是 HTML 的附属，迁一半不解决问题。
4. **不建议** ②：它不是国内方案，只是「看起来做了点什么」。
5. **不要考虑** Gitee Pages：已下线。

### 9.3 迁整站时要额外记住的三件事

- **备案按域名走**，而且要在阿里云做**接入**（§6.3）。
- **`/admin/`（Decap）也在 Pages 上**：整站迁走时要把 `static/admin/` 一起发布；`local_backend` 只影响本地，线上后台仍需要后端配置。
- **YouTube/第三方外链不受影响**，但站内所有绝对 URL 都来自 `site-url.html` + `baseURL`，改域名时以 `hugo.toml:10` 为唯一入口，别手工改模板。

---

## 10. 缓存失效与时序风险

### 10.1 图片缓存失效：`_hu_<hash>` 已经解决了

派生文件名 = **原 basename + 内容/处理参数哈希 + 16 hex**（§2.4）。也就是说：**内容变了、宽度变了、质量参数变了，URL 就变了**。因此：

- **迁移到 CDN 后不需要做任何 CDN 刷新/purge**。老 URL 永远对应老内容，新内容天然是新 URL。
- **代价是孤儿对象**：每改一次图/参数，旧 `_hu_` 文件就永远留在 bucket 里没人引用。当前全站派生图才 1.73 MB，孤儿增长很慢，但需要一条清理规则。
- 清理建议（**人工确认后再删**）：

```bash
# 1) 构建产物里真实被引用的图片清单
find public -name '*_hu_*' -printf '%f\n' | sort -u > /tmp/referenced.txt
# 2) bucket 里的对象清单（ossutil 用法以官方文档为准）
# ossutil ls oss://<bucket>/syfzsh/uploads/ > /tmp/in-bucket.txt
# 3) 差集就是孤儿；先只输出、别删
comm -13 /tmp/referenced.txt /tmp/in-bucket.txt
```

### 10.2 时序风险：HTML 与对象必须「先上传、后发布」

- 风险场景（**只存在于路线 A/C**）：访客拿到**已经引用新图**的 HTML，但对象还没上传完 → 破图。
- **Pages 的发布是原子的，OSS 不是。** 所以上传步骤**必须放在 `actions/upload-pages-artifact` 之前**，并且**失败即 fail job**（不要 `|| true`）。
- **正确的接缝就是现有 workflow 的 build/deploy 分界**：[`.github/workflows/hugo.yaml:123-137`](../.github/workflows/hugo.yaml#L123-L137)（`build` job 的 Upload artifact 步骤 + `deploy` job）。同步步骤插在 `Upload artifact`（第 123-127 行）**之前**：

```yaml
      # ⚠ 必须在上传 artifact 之前：HTML 先发布而对象没传完 = 线上破图
      - name: Sync images to OSS
        if: vars.OSS_BUCKET != ''
        env:
          OSS_BUCKET: ${{ vars.OSS_BUCKET }}
          OSS_ACCESS_KEY_ID: ${{ secrets.OSS_ACCESS_KEY_ID }}
          OSS_ACCESS_KEY_SECRET: ${{ secrets.OSS_ACCESS_KEY_SECRET }}
        run: |
          set -euo pipefail
          # 安装 ossutil（按官方文档，锁定版本号）
          # 用「自定义域名/CNAME」访问，不能用 *.aliyuncs.com（§6.2）
          ossutil cp -r --update public/uploads/ "oss://${OSS_BUCKET}/syfzsh/uploads/"
          # 自检：本地文件数 == 远端对象数，不一致就 fail
```

> 上面是**示意骨架**：ossutil 的安装方式、参数名按你用的版本官方文档为准；密钥一律放 Actions Secrets，不要写进仓库。

- **路线 B 没有这个时序问题**：HTML 与图片都在同一个源站，CDN 按同一路径回源，不存在「HTML 先到、对象后到」的窗口（只有回源失败这一种情况，见 §3.1）。

---

## 11. 非 ASCII 文件名

`assets/uploads/` 里有 **4 个中文名文件**（实测）：

```
assets/uploads/members/env/屏幕截图-2022-09-14-223547.jpg
assets/uploads/news/屏幕截图-2020-11-19-233805.jpg
assets/uploads/news/屏幕截图-2022-02-18-222305.jpg
assets/uploads/news/芳乃1.jpg
```

- **磁盘/对象 key 上是原始 UTF-8**：`芳乃1_hu_f8579297ee9139de.webp`
- **HTML 里是百分号编码**：`src=/syfzsh/uploads/news/%E8%8A%B3%E4%B9%831_hu_f8579297ee9139de.webp`
- 两者是同一个文件，**只编码一次**。

**迁移时必须守住的三条**

- [ ] **对象 key 用原始 UTF-8**，不要预先 URL 编码后当 key（否则线上会出现 `%25E8%258A...` 这种双重编码，必然 404）。
- [ ] **同步工具不要二次编码**。上传/列举/比对三个环节的编码方式必须一致。
- [ ] **逐 URL 自检**：迁移后对每张图的最终 URL 做 `curl -I`（含中文名那 4 张），要求 200 且 `Content-Type: image/*`。

**建议（与迁移解耦）**：新上传的图片统一用 ASCII 命名（如 `fangnai-1.jpg`），并在 CMS 使用说明里写死这条约定。手机截图类文件名（`屏幕截图-2022-09-14-223547.jpg`）会不断产生，越早统一越省事。

---

## 12. 顺带白捡的两个改进

### 12.1 Decap 的 `media_processing`：现成的「上传前压缩」，一直没用

- Decap **已经有**浏览器端的图片处理配置：`media_processing`（字段级可覆盖顶层），文档入口 [Image widget → media_processing](https://decapcms.org/docs/widgets/image/)、[Configuration Options → Media Processing](https://decapcms.org/docs/configuration-options/#media-processing)。
- 本站的 CMS 配置生成器 **完全没用到它**：`scripts/gen-cms-config.mjs` 里只有 `media_folder` / `public_folder`（[`gen-cms-config.mjs:184-185`](../scripts/gen-cms-config.mjs#L184-L185)），`grep -n media_processing` **零命中**；生成的 `static/admin/config.yml` 同样没有。
- **收益与 OSS 决定无关**：在图片**进入 git 之前**就转 WebP / 限制长边 / 去元数据，直接缩小
  - 仓库与 `.git` 体积（现在 `.git` 已经 20 MB），
  - GitHub Pages 的 1 GB 仓库建议值压力，
  - 将来同步到 OSS 的字节数。
- **执行清单**
  - [ ] 在 `gen-cms-config.mjs` 里给顶层（`media_folder` 附近）加 `media_processing`，按当前 Decap 版本核对可用选项名与默认值。
  - [ ] 重新生成 `static/admin/config.yml` 并提交。
  - [ ] 用一张 5 MB 手机原图实测：上传后 `git status` 里的新文件应显著变小，且**前台显示正常**（Hugo 仍会再转一次 WebP，等于双重保险）。
  - [ ] ⚠ 不要用它做「改文件名」——它不负责命名（命名见 §11）。

### 12.2 `hugo.toml:76` 的「零风险」注释已经过期（已验证）

[`hugo.toml:75`](../hugo.toml#L75) 写着：

> 本站 content/ 下目前 0 处 Markdown 图片语法，开这个开关零风险。

**实测：现在是 5 处**，注释已过期：

| 文件 | 行 | 内容 |
| --- | --- | --- |
| [`content/members/directory/member-01.md`](../content/members/directory/member-01.md#L22) | 22 | `> ![tkmiz](/uploads/members/tktu.jpg)` |
| [`content/members/directory/jincheng-youpin.md`](../content/members/directory/jincheng-youpin.md#L82) | 82 | `![仓储物流中心](/uploads/members/env/cangchu-wuliu.jpg "wide")` |
| [`content/news/association/2026-09-30-weiwen-gongjiawan-yixiao.md`](../content/news/association/2026-09-30-weiwen-gongjiawan-yixiao.md#L18) | 18 | `![龚家湾第一小学经典诵读大赛现场](…)` |
| [`content/news/association/2026-09-30-qinglian-weiwen-gongjiawan.md`](../content/news/association/2026-09-30-qinglian-weiwen-gongjiawan.md#L18) | 18 | `![慰问活动合影](…)` |
| [`content/news/notice/2026-09-27-ceshi2.md`](../content/news/notice/2026-09-27-ceshi2.md#L13) | 13 | `![](/uploads/news/屏幕截图-2022-02-18-222305.jpg)`（注意文件名是中文，§11） |

**影响**：`wrapStandAloneImageWithinParagraph = false` 正是让 `.IsBlock = true`、从而让这 5 处走 `<figure>` 分支的开关。既然已经有 5 处依赖它，**「零风险」这个理由不再成立**——不是开关有风险，而是**注释的论证失效了**：现在改这个开关会改变 5 个页面的排版。

**执行清单**
- [ ] 把 `hugo.toml:75` 的注释改成事实（「现有 5 处 Markdown 图片语法依赖此开关，改动前先目测这 5 个页面」）。
- [ ] 顺手目测这 5 个页面的 `<figure>` 排版（尤其 `member-01.md:22` 那种**引用块里的图**，和 `jincheng-youpin.md:82` 的 `"wide"` 版式）。
- [ ] `2026-09-27-ceshi2.md:13` 的 alt 为空，顺便给它补一个 alt（无障碍 + 图注都靠它）。

---

## 13. 待核实清单

> 以下都是**本次没有核实到底**的项。凡涉及钱的，写决策前请以官方价目表/控制台报价为准。

1. **存储单价 0.09 vs 0.12 元/GB/月**：官方帮助文档在[存储费用页](https://help.aliyun.com/zh/oss/storage-fees)里用的示例是 **0.12**；研究过程中出现过 **0.09** 的数字（可能来自活动价、其他存储类型或特定地域）。以 [OSS 定价页](https://www.aliyun.com/price/detail/oss) 为准。本表用 0.12（更高、更保守）。
2. **OSS 出方向流量 0.25 / 0.50 元/GB、回源 0.15 元/GB**：均为**社区来源**，未在官方价目表核实。请核对官方定价页的「流量费用/请求费用」小节。
3. **`github.io` 的实时大陆可达性**：作者不在境内，**无法实测**；现有结论均为二手。必须做一次探针（手段见 §7.4）。
4. **阿里云 CDN 是否有免费额度**（研究稿称「每月前 500 万次静态 HTTPS 请求免费」）：**未在官方文档定位到**该免费额度。若不存在，按 [静态 HTTPS 请求数计费](https://help.aliyun.com/zh/cdn/product-overview/billing-of-https-requests-for-static-content) 另计（本站请求量级下金额很小）。
5. **OSS 默认域名的限制是否只有「强制下载」**：官方文档只写了强制下载头（§6.1），是否还伴随限速/限流/其他限制未核实。
6. **阿里云 ESA 免费套餐**：官方有[免费套餐文档页](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/free-plan)，但**来源对「是否仍开放、免费额度多少」存在冲突**，需要登录控制台确认。
7. **备案办理时长**：官方来源的时长说明未核到；另外「接入备案是否需要重走一遍流程」各省管局口径可能不同（§6.3）。这直接影响迁移工期估算。
8. **Cloudflare R2 免费额度是否需要绑定付款方式**：未核实（§8.5）。
9. **阿里云 CDN 是否原生支持「回源路径改写」**：官方文档里能查到的是 **DCDN 的[回源URI改写](https://www.alibabacloud.com/help/zh/edge-security-acceleration/dcdn/origin-uri-rewrite)** 与 [规则引擎](https://www.alibabacloud.com/help/zh/cdn/user-guide/rules-engine)；**经典 CDN 是否提供同名能力需要在控制台确认**。这一条是「`cdnStripBasePath=true` + CDN 回源」路线的**关键依赖**（默认路线 B 用 `false`，**不需要**它）。
10. **研究稿费用比线性直算高约 6% 的原因**（§8.2）：等效 ≈0.255 元/GB vs 官方 0.24。
11. ~~离线预览版（`npm run build:local`）路径 bug 的具体表现与修法~~ —— **已定位并已实测验证修法**，见 §5.4（根因：`baseURL` 的 `/syfzsh/` 子路径 + `relativeURLs`；修法：`hugo.local.toml` 加 `baseURL = "/"`；结果 38/38 图片、3740/3740 链接可解析）。**唯一待办是决定何时实施**（本轮范围外）。
12. **OSS 2025-12-22 规则与账号开通时间的关系**：官方文档按 **Bucket 创建地域 + 时间**描述，未说明 2022-10-09 之前开通的老账号是否也受影响（§6.1 注）。
13. **Gitee Pages 下线的官方公告原文**：本次只核到社区来源（[蓝点网](https://www.landian.news/archives/103754.html)、[Wikipedia](https://zh.wikipedia.org/wiki/Gitee)）；未核到 Gitee 官方帮助页公告。
14. **Cloudflare Pages 在大陆不可用**这一说法：来自二手信息，未核到官方声明。

---

## 14. 状态 / 日期

- **状态**：迁移**大概率会发生，但没有排期**。本文是决策文档，不是施工单。
- **唯一已落地的代码改动**：`cdnBase`（默认 `""`）+ `cdnStripBasePath`（默认 `false`）—— 见 [`cdn-url.html`](../layouts/partials/components/cdn-url.html)、[`img.html:85`](../layouts/partials/components/img.html#L85)、[`img.html:91-92`](../layouts/partials/components/img.html#L91-L92)、[`hugo.toml:121-122`](../hugo.toml#L121-L122)。**默认值下整站输出与改动前逐字节一致**（唯一差异是同期加入的 6 处 `fetchpriority`，与 CDN 开关无关）。
- **基线数据日期**：2026-10-03，本地 Hugo `v0.167.0`（CI 固定 `0.166.0`，见 [`hugo.yaml:23`](../.github/workflows/hugo.yaml#L23)）；`Pages 71 / Static files 40 / Processed images 27`、`public/` 24.36 MB、`<img>` 38 处。
- **重新生成基线的方法**：跑 §2.4 的复核命令，把新数字替换 §2.4 / §7.2 / §8.1 里的旧值；本文所有数字都可由这几条命令复现。
- **维护提示**：改动 `img.html`、`cdn-url.html`、`hugo.toml` 的 CDN 段或工作流之后，请重跑 §2.4 与 §5.2 的自检（默认模式 38 处 `src=/syfzsh/uploads/`、`img.example.com` 出现 0 次），确保「默认零变化」这个契约没被破坏。
- **行号基线**：本文所有 `文件:行号` 引用均以 2026-10-03 当日工作区状态为准。图片管线正在同期改动（`img.html` 已因 `fetchpriority`、gif 宽高等改动变长），**若行号对不上，以行内代码内容为准**，不要以行号为准。
