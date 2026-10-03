# syfzsh 主题抽离（Theme Extraction）评估与执行清单

> **状态：这是一份"未来决策 + 将来可直接照做"的计划文档，本轮不执行任何抽离。**
> 本文不改动任何文件，只是把"要不要做 / 做的话每一步怎么走 / 怎么验收 / 怎么回滚"一次性写清楚，
> 让决策能够在以后单独发生，且**不需要重新做一遍调研**。
>
> 事实来源：本会话中两份只读审计报告（关于"为什么 syfzsh 没有 `themes/`"、"抽离要付出什么代价"）。
> 本文**没有**在写文档时重新逐行复核仓内代码；所有 `file:line` 均沿用审计报告的结论，执行前请在对应
> 阶段用本文给出的命令再确认一次（见 §8、§9）。

---

## 1. 结论摘要

**结论：不建议现在做主题抽离。**

理由（按权重排序）：

1. **收益低。** `syfzsh` 是单一站点，历史上从未有过第二个站点复用需求，也没有任何文档讨论过主题化
   （见 §2）。抽离出来的产物在可预见的将来只有一个消费者，等于把"单站点代码"改造成"带抽象层的单站点代码"。
2. **成本集中在最不该动的地方。** 机械搬文件只有 **41 个文件 / 约 4049 行**（`layouts/**` 33 文件 1408 行、
   `assets/css/**` 4 文件 2055 行、`assets/js/theme.js` 402 行、`archetypes/**` 3 文件 184 行），
   这不是难点。真正的成本是：**全站没有 `i18n/`，中文 UI 文案硬编码在 18 个 layout 文件里**（§4a）；
   模板里写死了站点栏目路径、`type: member` 这一垂直业务（§4b/§4c）；
   以及 mounts / `resources.Get` / `static/admin` / 离线构建脚本交叉引用等一连串**静默失败**陷阱（§5）。
3. **失败模式是静默的。** 本次审计已经证明：主题自己声明 `[[module.mounts]]` 时可能拿到 `mounts: null`，
   于是**零 layout、零 CSS、零 static，且不报错**；`hugo.toml` 里漏掉 `source="static" target="static"`
   会让 `static/admin/**` 与 `static/images/**` **不再发布且不报错**（§5a）。
   抽离一旦出错，站点不是"编译失败"，而是"悄悄少了一半页面"，回归成本高。
4. **有一次性的破坏面：** `scripts/fix-offline-html.mjs` 用注释形式交叉引用了 `head.html:40`、
   `scripts.html:11`、`header.html:24/11`、`breadcrumb.html:6`、`sidebar.html:22`、
   `section-head.html:27`、`404.html:11-14` 的**行号**（§5e）。文件一搬，这些注释全部失真，
   而离线 `file://` 构建链路只有在真正打开 html 时才会暴露问题。

**什么条件下才值得做**（满足任意一条再启动 §7）：

- **C1 复用需求落地**：确认要新建第二个 Hugo 站点（例如另一家商会 / 另一个区县分站），且它需要同一套
  会员名录 + 图集 + 政策资讯外壳。这是唯一强的理由。
- **C2 长期外包/交接**：站点将交给第三方维护，需要把"外壳（主题）"与"内容（站点）"的责任边界用目录硬隔离，
  以便外包方只改主题、站方只改内容。
- **C3 IPC 式开源发布**：打算把外壳作为独立开源主题发布（这需要额外补齐 §6 所列的 `theme.toml`、
  `config/_default/params` 默认值、`i18n/`、`data/` 默认值、README/LICENSE 等，成本比"内部抽离"更高）。

**若以上条件均不成立：不要做。** 现在真正值得投入的是 §4a（补齐 `i18n/`、消除硬编码中文）和
§4c（把写死的路径配置化）——**这两件事即使永不抽离主题，也能独立带来收益**，可以先做、且不会引入 §5 的风险。

---

## 2. 为什么现在没有 `themes/`

以下是审计报告给出的、可复核的证据：

| 证据 | 说明 |
| --- | --- |
| 仓库从未出现过 `themes/` | 全历史中该目录不存在，非"曾经删掉" |
| 没有 `.gitmodules` | 不存在任何 git submodule 形式的主题引入（Hugo 社区最常见的主题引入方式） |
| 提交数 19 | 仓库生命周期短、参与者少，属于"从模板起步的站点仓" |
| `hugo.toml:2` | 项目本身就是从一个复制粘贴模板开始的（该行即模板痕迹） |
| `package.json` 的 `name` | 仍是模板遗留的包名，而非站点自有命名 |
| 文档 | 4 份文档（`README.md`、`ARCHITECTURE.md`、`STRUCTURE.md`、`WRITING.md`、`CMS.md`）中**没有任何一份讨论过主题化 / 抽离 / 复用** |

**同时需要纠正一处不精确的表述：`CMS.md:467` 说 mounts 是被"整体"替换的。**
经核实的真实语义是 **per-component（按挂载目标的第一个路径段分别生效）**，不是整体替换。
其后果很关键：

- 站点**仍然保留**未被显式声明的**默认挂载**，至少包括：
  - 默认 `i18n` 挂载（这也是为什么 §4a 说"现在没有 `i18n/` 却也不报错"）；
  - Hugo 自动生成的 `package.json → assets/_jsconfig/package.json` 挂载（因为 `package.json` 存在）。
- 因此"声明了 `[[module.mounts]]` 就等于接管全部挂载"这一直觉是**错的**，
  这直接决定了 §5a 的风险描述方式。

> 执行动作：将来做抽离时，顺手把 `CMS.md:467` 这句话改成 per-component 的准确表述（属 §7 阶段 6 范围）。

---

## 3. 现状分类表

"theme-like"= 只有外壳语义、可被任意同构站点复用；"site-like"= 站点内容/配置/业务数据，必须留在站点侧。

### 3.1 Theme-like（候选搬迁对象）

| 路径 | 规模 | 分类 | 备注 |
| --- | --- | --- | --- |
| `layouts/**` | **33 文件 / 1408 行** | theme-like（但含站点耦合，见 §4b/§4c） | 外壳主体 |
| `assets/css/**` | **4 文件 / 2055 行** | theme-like | 样式主体 |
| `assets/js/theme.js` | **402 行** | theme-like | 前端交互 |
| `archetypes/**` | **3 文件 / 184 行** | theme-like | 新建内容骨架（若垂直业务留存站点侧，则 archetype 也可能要留站点侧，见 §4b） |
| `i18n/` | **不存在** | theme-like（缺失） | 主题最该有的一层，当前为 0 |

机械搬迁合计：**41 文件 / 约 4049 行**。

### 3.2 Site-like（必须留在站点侧）

| 路径 | 性质 | 为什么不能进主题 |
| --- | --- | --- |
| `content/` | 站点内容 | 含 `content/members/directory/<slug>.md` 等真实业务内容 |
| `hugo.toml` | 站点配置 | 站点语言、baseURL、`params`、mounts 的唯一权威位置 |
| `hugo.local.toml` | 站点离线构建配置 | 属于本仓库的构建路径（§5e） |
| `data/*.yaml` | **站点取值、主题形状** | 键名是主题形状（如 `members_order.yaml`、导航/首页分组），值是站点数据；主题应只提供"默认值"或"样例"，站点值必须在站点侧 |
| `static/admin/**` | **站点侧，且是生成物** | 7 个文件，含约 5MB vendored `decap-cms.js`；`config.yml`、`sidebar-groups.css` 由 `gen-cms-config.mjs:23,740` 生成（§5c） |
| `static/images/` | 站点图片资产 | 站点内容；且只通过 `static` 挂载发布（§5a） |
| `static/uploads/` | CMS 上传目录 | 站点内容 |
| `assets/uploads/**` | **站点内容，但位于 asset 树内** | 被 `resources.Get` 处理，与主题资源同树 → §5b 的同名解析风险 |
| `scripts/**` | 站点工具链 | `import-members.mjs`、`gen-cms-config.mjs`、`fix-offline-html.mjs` 都是站点专属 |
| `.github/` | CI | `.github/workflows/hugo.yaml:111` 直接跑站点构建（§5d） |
| 4 份文档 | 站点文档 | `README.md`、`ARCHITECTURE.md`、`STRUCTURE.md`、`WRITING.md`、`CMS.md` |

---

## 4. 真实成本（重点）

机械搬运 **41 文件 / 约 4049 行**只是体力活。真正的工作量在下面三项。

### 4a. 完全没有 `i18n/`，中文 UI 硬编码在 18 个 layout 文件里 —— 这是最大的复用阻塞

事实：`i18n/` 目录不存在；中文界面文案直接写在模板里。目前站点只有中文，所以"能跑"，
但只要主题要被第二个站点（或未来加英文）复用，这 18 个文件就是硬阻塞：**主题无法在不改模板的情况下换语言。**

典型例子（`file:line`）：

- `layouts/member/single.html`：单位类型 / 企业官网 / 联系人 / 联系电话 / 单位地址；
  图集分组标题 企业环境 / 门店实拍；产品 / 案例图；资质 / 荣誉。
- `layouts/_default/directory.html:23`：`会员名录（共 N 家）`。
- `layouts/_default/directory.html:45`：`没有匹配的会员单位。`。

执行方向（**先做不亏**）：

1. 新建站点侧 `i18n/zh-cn.toml`（站点自己的文案，站点可覆盖），把上表字符串抽成 key，
   例如 `member.field.unit_type`、`member.gallery.environment`、`directory.count`、`directory.empty`。
2. 逐个替换 18 个 layout 中的字面量为 `{{ i18n "..." }}`（或 `{{ T "..." }}`）。
3. 验收：`grep -rn` 中文文案的命中数应从 18 个 layout 文件降到 0（注释除外），且 `npm run build` 输出与改前一致。

> 注意：这一项**本身就是独立收益**，不必等主题抽离。它也是 §6 中 reimu 那条"主题必须有 `i18n/`"的对照点。

### 4b. 领域垂直业务：会员名录（member directory）

被绑定的位置不止模板，而是**模板 + 内容约定 + 数据文件 + 站点脚本**四位一体：

- `layouts/member/single.html`：绑定 `type: member` 的单页渲染。
- `layouts/_default/directory.html`：名录列表页。
- `content/members/directory/<slug>.md`：内容落位约定（slug 即会员）。
- `data/members_order.yaml`：站点维护的排序数据。
- **`directory.html:48-49` 在模板里写死了给编辑者看的操作提示：运行 `node scripts/import-members.mjs`。**

最后一条最要命：**主题模板引用站点脚本**。一旦搬进 `themes/<name>/`，主题就会依赖一个它自己不拥有、
也不应该拥有的脚本。

**决策点（必须二选一，写进结论，不要含糊）：**

- **方案 A（推荐用于 C1 内部复用）**：会员名录作为**可选主题特性**，只搬 `layouts/member/**` 与
  `layouts/_default/directory.html`，并把 `directory.html:48-49` 的脚本文案改为**站点侧可注入的 hint 参数**
  （例如 `params.memberDirectory.importHint`，站点不配则整段不渲染）；`data/members_order.yaml`
  只在主题里放 `.yaml.example`，真实数据留站点侧。
- **方案 B**：会员名录**整体留在站点侧**（`layouts/member/**`、`layouts/_default/directory.html`、
  archetype、data 全部不搬），主题只负责通用外壳。成本最低、风险最小，但复用度也最低。

选 A 还是 B，取决于 C1 中"第二个站点是否也需要名录"。**在 C1 未落地前，默认按 B 记录。**

### 4c. 写死的站点路径与默认栏目

这些在单站点下完全正确，在主题里就是"写死另一个站点的信息"：

| 位置 | 写死内容 |
| --- | --- |
| `layouts/partials/components/member-pages.html:24` | `site.GetPage "/members/directory"` |
| `layouts/partials/home/members-wall.html:25` | `site.GetPage "/members/directory"` |
| `layouts/member/single.html:60` | `site.GetPage "/members/directory"` |
| `layouts/partials/footer.html:16` | 站点链接路径 |
| `layouts/partials/components/sidebar.html:11` | 默认搜索路径 `"/search/"` |
| `layouts/_default/search.html:10` | 默认搜索路径 `"/search/"` |
| `layouts/404.html:12-14` | 硬编码 `/news/`、`/policy/`、`/search/` 三个链接 + 其中文标签 |
| `layouts/partials/home/headline.html:15` | 字面默认栏目 `"news"` |

补充事实：`headline.html:15` 的 `"news"` 是**全站唯一**的字面栏目默认值（其他栏目的同类计数为 0）。
这条既是"容易改"的好消息，也是"改的时候只需要盯一处"的清单依据。

配置化方向：把上述路径收敛到 `params` 下（例如 `params.paths.membersDirectory`、
`params.paths.search`、`params.nav.quickLinks`），模板只读参数、不写字面量；
主题提供 `config/_default/params.toml` 默认值（见 §6），站点在 `hugo.toml` 覆盖。

---

## 5. 风险清单

每条都带证据与"出错时的表现"。**注意多数风险是静默的。**

### 5a. mounts 陷阱（最高危）

- **绝不建议给抽离出来的主题声明自己的 `[[module.mounts]]`。** 审计已证明：主题声明 mounts 时可能最终
  得到 `mounts: null`，导致该主题**贡献 0 个 layout、0 个 CSS、0 个 static，并且不报错**。
  → 决策固化：**mounts 全部留在站点侧 `hugo.toml`，主题只做"无 mounts 的普通主题"。**
  这正是 §6 中 reimu 那种"根 `config.toml` 里完全没有 `[[module.mounts]]`"的形状。
- **`source="static" target="static"` 必须继续留在站点 `hugo.toml` 的 mounts 列表里。**
  一旦漏掉，`static/admin/**` 与 `static/images/**` **静默地不再被发布**——CMS 后台打不开、图片 404，
  而 `hugo build` 依旧成功。
- 语义纠正：mounts 是 **per-component（按目标第一段）** 生效，不是整体替换（纠正 `CMS.md:467`）。
  未声明的默认挂载仍存在（默认 `i18n`、自动 `package.json → assets/_jsconfig/package.json`）。
- **验证动作**：抽离后必须用"静态产物清单"对比（§8），而不是只看构建是否成功。

### 5b. `resources.Get` 与 `assets/uploads/...` 的耦合

- `layouts/partials/.../img.html:48` 对 `assets/uploads/...` 使用 `resources.Get`。
  该查找是**针对站点 assets 挂载**解析的。
- 合并挂载（主题 assets + 站点 assets 合并）本身能工作，但后果是：
  **同名文件会静默解析到站点版本**——即主题里的同名资源被站点无声覆盖，排查时非常反直觉。
- `layouts/partials/head.html:35-44` 明确警告：**`resources.Get` 返回 nil 时，`resources.Concat` 会硬失败**。
  也就是说资源改名/挪位不是"降级渲染"，而是构建报错；反过来，如果被静默解析到站点同名文件，
  则是"不报错但内容错了"。两种失败方向都要覆盖到回归清单。
- 结论：`assets/uploads/**`（CMS 内容）**必须留在站点侧**；主题不得把 `uploads/` 打进自己的 assets。

### 5c. `static/admin/**` 必须留在站点侧

- 7 个文件，含约 **5MB** vendored `decap-cms.js`；**只通过 `static` 挂载发布**。
- 其中 `config.yml` 与 `sidebar-groups.css` 是 **生成物**：由 `scripts/gen-cms-config.mjs:23,740` 生成。
- 因此它既不能进主题（主题不该带 CMS 后台与大体积 vendor 文件），也不能停止发布（§5a）。
- **验证动作**：每次构建后确认 `public/admin/config.yml` 仍存在且内容为最新生成结果（§8）。

### 5d. CI 与在仓主题的引入方式

- `.github/workflows/hugo.yaml:111` 执行：
  `hugo build --gc --minify --baseURL …`。
- 若主题以**在仓目录**形式存在（`themes/<name>/`），引入只需要在 `hugo.toml` 加一行
  `theme = "<name>"`，CI **无需改动**。
- CI 已经支持 submodule（`:34`、`:86-90`），并且在存在 `go.mod` 时会安装 Go。
  这为"将来改成 submodule/独立仓"留了路。
- **`.gitignore` 目前并不忽略 `themes/`** → 在仓主题会被正常提交，不会出现"本地能构建、CI 缺目录"的假象。

### 5e. 离线 `build:local` 路径与脚本交叉引用

- 存在离线构建路径 `npm run build:local`（配套 `hugo.local.toml`），产物要能**直接以 `file://` 打开、无需服务器**。
- `scripts/fix-offline-html.mjs` 的注释里**以行号交叉引用**了许多模板位置（`fix-offline-html.mjs:20-31` 引用了
  `head.html:40`、`scripts.html:11`、`header.html:24/11`、`breadcrumb.html:6`、`sidebar.html:22`、
  `section-head.html:27`、`404.html:11-14`）。
  **文件一旦搬进 `themes/<name>/`，这些行号引用全部失真**——注释不会报错，但会误导后续维护者。
- 该脚本还依赖一个**假设：离线产物需要剥离 SRI**。主题化后若脚本/资源路径变化，这个假设需要重新验证。
- 处理方式：搬迁时把行号引用改成 **锚点/片段（snippet）引用或文件:符号名**，而不是行号（纳入 §7 阶段 6）。

### 5f. `site.Params` 依赖与"没有主题默认 params"的静默空白

- 模板中共有 **16 处 `site.Params` 引用**。
- 主题**不提供** `config/_default/params.toml`，因此若换一个"只有内容"的站点：
  **导航、标签页等会静默渲染为空**（不报错、页面能打开、就是没内容）。
- 其中 `params.entrySections = ["members/directory"]` 是**领域特定**的（会员名录），
  进一步说明默认值必须由站点侧提供或由主题给出中性默认。
- 处理方式：主题提供 `config/_default/params.toml`（中性默认），站点 `hugo.toml` 覆盖；
  并把 §4c 的路径也收敛进 params。

### 5g. 已核实但在主题抽离语境下更危险的一点：baseURL 与产物路径

- 用真实生产 baseURL 构建时，HTML 中出现 `/syfzsh/uploads/...`，而文件实际落在 `public/uploads/...`。
- 现网可接受（部署时子路径前缀生效），但抽离主题后一旦资源查找/改写逻辑变动，
  这类"前缀与落盘路径不一致"会变成难查的 404。
- 已核实：**38 处 image `src` 携带 `/syfzsh/` 前缀**。

---

## 6. 好主题长什么样 —— 以 `reimu` 为参照

`reimu` 是一个可对照的"形状正确"的主题。它给 syfzsh 的启示主要是**目录与默认值分层**：

| 组成 | reimu 的做法 | 对 syfzsh 的意义 |
| --- | --- | --- |
| `theme.toml` | 有 | 主题元数据（复用/发布时需要） |
| `go.mod` | 有，且**无依赖** | 不需要 Hugo Modules 依赖链，简单可复制 |
| 根 `config.toml` | **只包含** `[module.hugoVersion]`（`extended=true`、`min="0.158.0"`），**全文没有任何 `[[module.mounts]]`** | **这正是避免 §5a 陷阱的形状**：主题不声明 mounts |
| `config/_default/params.yml` | 有 | 主题默认参数（对应 §5f：syfzsh 缺这一层） |
| `data/` | 有主题默认数据 | 对应 §3.2：站点值 vs 主题默认值分层 |
| `i18n/` | 有 en / ja / pt-BR / zh-CN / zh-TW | **这正是 syfzsh 完全为零的一层**（§4a） |

**两点必须写清的 caveat：**

1. `reimu` 不涉及图片处理管线、也不涉及 CMS，因此它验证的是**主题的"形状"**（目录分层、
   默认值分层、无 mounts、有 i18n），**不能验证 syfzsh 特有的 `assets/uploads` 耦合**（§5b）。
   syfzsh 抽离时必须单独处理上传/图片这一块。
2. `reimu` **要求 Hugo Extended**（它用了 `toCSS` / dart-sass）；而 **syfzsh 是刻意不用 Extended 的**。
   因此**不能照抄 reimu 的 `extended=true`**：一旦主题引入 dart-sass，
   syfzsh 现有构建环境（CI + 离线构建）都要跟着升级，属于本次决策外的额外破坏面。

---

## 7. 分阶段改造步骤（若将来要做）

> 每个阶段都有**回滚点**与**验收标准**。建议一阶段一个 commit，便于精确回滚。
> 全程遵守 §5a 的固化决策：**mounts 只在站点侧，主题不声明 mounts。**

### 阶段 0：准备与基线（不改变产物）

1. 记录基线：跑一次 `npm run build`，保存 `public/` 的文件清单与关键文件哈希
   （至少覆盖 `public/admin/config.yml`、`public/index.html`、若干 `public/uploads/**`）。
2. 记录基线：`npm run build:local`，确认产出的 html 能以 `file://` 直接打开（§8）。
3. 记录基线：统计已处理图片数量（当前为 **27** 张）。
4. **验收**：三份基线快照落盘保存。
   **回滚**：无（未改动） 。

### 阶段 1：建立主题骨架，先"空跑"不搬文件

1. 创建 `themes/<name>/`，放入最小骨架：
   - `themes/<name>/theme.toml`
   - `themes/<name>/config/_default/params.toml`（中性默认值，后续阶段 4 用到）
   - `themes/<name>/i18n/`（阶段 3 用到）
2. 在 `hugo.toml` 增加 `theme = "<name>"`，此时主题为空，站点模板仍走站点 `layouts/**`。
3. **验收**：`npm run build` 成功；`public/` 文件清单与阶段 0 基线**逐文件一致**。
   **回滚**：删除 `theme = ...` 一行 + 删除 `themes/<name>/`。

### 阶段 2：搬迁主题资产（分批，每批一验）

按"低耦合 → 高耦合"顺序搬，每批都跑一次验收：

1. `assets/css/**`（4 文件）→ `themes/<name>/assets/css/**`
2. `assets/js/theme.js` → `themes/<name>/assets/js/theme.js`
3. `layouts/**`（33 文件）→ `themes/<name>/layouts/**`，**但按 §4b 的决策 A/B 排除或保留
   `layouts/member/**`、`layouts/_default/directory.html`**
4. `archetypes/**`（3 文件，按 §4b 决策决定去留）

**验收（每批）**：
- `npm run build` 成功，且 `public/` 清单与阶段 0 基线一致；
- `npm run build:local` 成功，且离线 html 仍可直接打开；
- 抽查 §5a：`static/admin/**`、`static/images/**` 仍在 `public/` 中。
- **迁移期必须叠一个"命中检查"**：`hugo --printPathWarnings`（或逐页比对）确认没有 layout 静默缺失。

**回滚**：把文件移回原位（`themes/<name>/` 中对应文件删除）。因为此阶段**没有改任何模板内容**，
回滚是纯文件位移，风险最低。

### 阶段 3：补齐 `i18n/` 并去硬编码（§4a）

1. 在 `themes/<name>/i18n/zh-cn.toml` 提供**主题基准文案**；同时创建**站点侧 `i18n/zh-cn.toml`**
   用于站点覆盖（层级清晰，主题升级不冲掉站点文案）。
2. 把 §4a 列举的字符串（含 `member/single.html` 的"单位类型/企业官网/联系人/联系电话/单位地址、
   企业环境/门店实拍、产品/案例图、资质/荣誉"，`directory.html:23`、`directory.html:45`）
   以及其他 layout 中的中文文案，替换为 `{{ i18n "key" }}`。
3. **验收**：
   - layout 中的中文字面量命中数降为 0（注释除外）；
   - `npm run build` 的页面文本与阶段 0 基线一致（逐页 diff 可见文本）；
   - 新增一个假语言（例如临时 `i18n/en.toml`）验证：不改模板即可切换文案。
4. **回滚**：还原模板替换 + 删除 `i18n/`。

### 阶段 4：路径与参数配置化（§4c、§5f）

1. 把 §4c 表中的字面量收敛为 `params`：
   `/members/directory`（`components/member-pages.html:24`、`home/members-wall.html:25`、
   `member/single.html:60`）、`footer.html:16`、默认搜索路径（`components/sidebar.html:11`、
   `_default/search.html:10`）、`404.html:12-14` 的三个链接与中文标签、
   `partials/home/headline.html:15` 的字面 `"news"`。
2. 主题 `config/_default/params.toml` 给出中性默认；syfzsh 在 `hugo.toml` 中显式覆盖
   （含 `entrySections = ["members/directory"]`）。
3. **验收**：
   - 16 处 `site.Params` 引用的键都能在"默认 + 站点覆盖"两层中被解析（无空渲染）；
   - 构造一个"只有内容、无 params 覆盖"的最小测试站点，确认导航/标签页不会静默为空（或按设计给出默认）；
   - `npm run build` 产物与基线一致。
4. **回滚**：还原模板与新增 params 键。

### 阶段 5：会员名录垂直业务定案（§4b）

1. 按 §4b 选定方案 A 或 B，并写进本文件（更新 §1 决策记录）。
2. 若选 A：搬 `layouts/member/**` + `_default/directory.html`；
   把 `directory.html:48-49` 的 `node scripts/import-members.mjs` 提示改为参数注入
   （如 `params.memberDirectory.importHint`，未配置则不渲染）；
   `data/members_order.yaml` 仅在主题留 `.yaml.example`。
3. 若选 B：不搬这组文件，主题与名录解耦。
4. **验收**：`/members/directory/` 与各 `<slug>` 页渲染与基线一致；
   主题中 `grep -rn "import-members" themes/` 命中数为 0。
5. **回滚**：按原目录归位。

### 阶段 6：工具链与文档同步（§5e、§2）

1. `scripts/fix-offline-html.mjs:20-31`：把行号引用改成锚点/片段引用（不再引用 `head.html:40` 等具体行号），
   并复核其"剥离 SRI"的假设在主题化后仍成立。
2. 更新 4 份文档中的路径与结构描述：`README.md`、`ARCHITECTURE.md`、`STRUCTURE.md`、`WRITING.md`；
   以及 `CMS.md`，其中 **`CMS.md:467` 必须改成 per-component 的准确表述**。
3. 确认 `.github/workflows/hugo.yaml` **无需改动**（`:111` 的构建命令不变；主题在仓时只需 `theme = "<name>"`，§5d）。
4. **验收**：`npm run build` 与 `npm run build:local` 均通过；文档中不再出现对已搬迁文件的原路径引用。
5. **回滚**：还原脚本文案与文档。

---

## 8. 验收标准与回归清单

抽离后**必须全部通过**才算成功（任一失败即回滚到上一阶段）：

### 8.1 构建

- [ ] `npm run build` 成功（对照 `hugo build --gc --minify --baseURL …`，见 `.github/workflows/hugo.yaml:111`）。
- [ ] `npm run build:local` 成功，产物 html **以 `file://` 直接打开、无需起服务器**（§5e）。
- [ ] `hugo` 无 path warnings；无 "layout not found" 类警告。

### 8.2 产物清单（防静默缺失，§5a）

- [ ] `public/admin/config.yml` **仍存在**且为最新生成结果（`gen-cms-config.mjs:23,740`，§5c）。
- [ ] `public/admin/sidebar-groups.css` 仍存在。
- [ ] `public/images/**` 仍有内容（`static` 挂载未掉，§5a）。
- [ ] `public/uploads/**` 仍有内容。
- [ ] 与阶段 0 基线**逐文件比对** `public/` 清单：除有意变更外应完全一致。

### 8.3 资源与图片

- [ ] 已处理图片数量仍为 **27**（对照基线）。
- [ ] `resources.Get` 相关路径仍解析成功；无 `resources.Concat` 硬失败（`head.html:35-44`，§5b）。
- [ ] 抽查 `img.html:48` 处理的 `assets/uploads/...`：确认解析到**站点**版本，未被同名资源静默替换。
- [ ] HTML 中 `/syfzsh/` 子路径 URL 仍正确；已知有 **38 处** image `src` 携带该前缀（§5g）。

### 8.4 业务页面

- [ ] `/members/directory/` 列表页正常（`directory.html:23`、`:45` 文案正确）。
- [ ] 至少一个 `/members/directory/<slug>/` 单页正常（图集分组、资质荣誉齐全）。
- [ ] `/search/`、`/news/`、`/policy/` 仍可达；`404.html` 三个快捷链接仍指向正确路径。
- [ ] 首页模块（`home/headline.html`、`home/members-wall.html`）渲染正常。

### 8.5 可复用性（仅当目标为 C1/C3）

- [ ] 换一个"只有 content、无 params 覆盖"的测试站点，页面不出现"静默空白"（§5f）。
- [ ] 不改模板即可切换语言（新增一版 `i18n/*.toml` 验证，§4a）。
- [ ] 主题目录内 `grep -rn "\[\[module.mounts\]\]" themes/` 命中数为 0（§5a 固化决策）。

---

## 9. 待核实清单

以下项在写本文时**未逐条复核**，执行前请先验证：

1. **`i18n/` 的挂载层级**：站点侧 `i18n/` 与主题 `i18n/` 的覆盖顺序（站点优先）需实机验证一次。
2. **默认 `i18n` 挂载的存在性**：§2 说"项目保留了未声明的默认 `i18n` 挂载"，需用
   `hugo config mounts`（或等价命令）确认当前实际挂载列表，并据此更新 §5a 的表述。
3. **`package.json → assets/_jsconfig/package.json` 自动挂载**：确认其是否真的存在于当前挂载列表。
4. **per-component 语义的官方依据**：`CMS.md:467` 的纠正应以 Hugo 官方 `module.mounts` 文档为准再落笔。
5. **`fix-offline-html.mjs` 的 SRI 剥离假设**：主题化后是否仍必要/仍正确，需实测离线产物。
6. **"18 个 layout 文件含硬编码中文"** 的精确名单：本文只给了抽样与总数，替换前应产出完整清单（含 file:line）。
7. **"16 处 `site.Params`"** 的精确 key 列表：配置化时以实际清单为准。
8. **`archetypes/**` 的去留**：取决于 §4b 的 A/B 决策，本文未定案。
9. **`data/*.yaml` 的"站点值 / 主题形状"边界**：需逐个文件判定哪些键可作主题默认值。
10. **CI 在 submodule 模式下的主题引入**：`:34`、`:86-90` 已支持 submodule，但"改用 submodule"的
    具体步骤与 `go.mod` 分支行为未实测。

---

*状态：计划（未执行） · 日期：2026-10-03 · 本文档只描述"将来怎么做"，本轮不改动任何仓库文件。*
