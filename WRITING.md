# 写稿范例 —— 新闻与会员单位

这份文件是给**发稿的人**看的，不是给改模板的人看的。它是本站内容的**唯一指南**：
字段含义、图该放哪、正文插图版式、这份稿子该进哪个目录、哪些坑会让内容「消失」。

**本站没有后台**，用编辑器直接改文件：

1. 本地起站点看效果：`npm run dev` → http://localhost:1313
2. 新建文件：命令行 `./hugo new content news/notice/xxx.md`，或直接用编辑器新建，
   把 `archetypes/news.md` / `archetypes/members.md` 里的字段照抄过去
3. 改完提交、推送，CI 自动发布

「这份稿子该放哪个目录」直接查 **第八节：栏目一览**。

---

## 一、先把四类图片分清（最容易搞混的就是这里）

| 你想要的图 | 填在哪 | 上传后落在 | 正文里怎么写 | 出现在前台哪 |
|---|---|---|---|---|
| 文章的**列表封面图** | 表单字段「列表封面图」 | `assets/uploads/news/` | —— | 栏目列表的小图、首页「图片新闻」轮播、详情页正文**上方**的大图 |
| 会员的**单位 LOGO** | 表单字段「单位 LOGO」 | `assets/uploads/members/` | —— | 名录卡片、首页 LOGO 墙、会员页**页头** |
| 正文里插的图 | 正文内部 | 同上（按栏目分目录） | `![说明](路径)` | 你把它插在哪就出现在哪 |
| 会员的**三组图片** | 表单字段 `photosEnv` / `photosProduct` / `photosHonor` | `assets/uploads/members/{env,product,honor}/` | —— | 会员页「企业简介」下方的网格 |

一句话：**「列表封面图」和「单位 LOGO」是字段，不是正文里的图。**
它们各只有一张，前台位置上固定；正文里的图可以有很多张，位置随你插。
两者互不影响 —— 换了封面图，正文里的图不会有任何变化。

---

## 二、图片存哪、路径怎么写

图片文件直接拷进仓库，规则就两条：**按栏目分目录放好、引用时写 `/uploads/…`**
（比如一次给一家会员传 20 张实拍图，就是往 `assets/uploads/members/…` 里拷）。具体对应：

```
图片放这里（仓库里的真实位置）          正文/字段里写这个（网址）
assets/uploads/news/zhongqiu.jpg   →   /uploads/news/zhongqiu.jpg
assets/uploads/members/logo.png    →   /uploads/members/logo.png
```

也就是：**磁盘上是 `assets/uploads/…`，引用时写 `/uploads/…`**，两者只差一个
`assets` 前缀。这个前缀不是笔误 —— 放在 `assets/` 里的图，Hugo 构建时会自动
缩放、转成 WebP、并给 `<img>` 补上宽高（防页面加载时跳一下），所以页面实际
发出的往往是一个 `.webp` 文件。原图也会另存一份进产物：分享卡片（`og:image`）
与「Hugo 不处理的那几类图」（SVG、动图 GIF）用的就是原图 ——
这也是 `hugo.toml` 里那条 `assets/uploads → static/uploads` 挂载存在的理由。

⚠ **不要把图放进 `static/uploads/`**。那里的图 Hugo 不做任何处理：手机直出的
5–10MB 原图会原样发给访客，这也是老站打开慢的主因。

⚠ 常见的写错法：写成 `E:\图片\xx.jpg`（本机路径，别人打不开）、
写成 `assets/uploads/news/xx.jpg`（多了 `assets`）、写成 `static/uploads/…`。

⚠ 中文文件名可以用，但建议用英文或拼音 —— 出问题时看日志、在文件管理器里
搜文件都方便些。

---

## 三、正文怎么插图（四行版式，照抄即可）

图片**独占一段**（上下各留一个空行），方括号是说明，引号是版式关键字：

```markdown
![图片说明](/uploads/news/xxx.jpg)              居中（默认，不用写关键字）

![图片说明](/uploads/news/xxx.jpg "wide")       加宽通栏，比正文更宽

![图片说明](/uploads/news/xxx.jpg "left")       左浮动，文字绕在右侧

![图片说明](/uploads/news/xxx.jpg "right")      右浮动，文字绕在左侧
```

| 关键字 | 效果 | 什么时候用 |
|---|---|---|
| 不写 | 居中，正文宽度 | 绝大多数情况，默认就用它 |
| `wide` | 加宽通栏 | 全景照、大合影、需要看清细节的图表 |
| `left` | 左浮动，文字绕右侧 | 一张小图配一段说明性文字 |
| `right` | 右浮动，文字绕左侧 | 同上，换边让版面有变化 |

**方括号里的「图片说明」有两个作用**：给视障读者和搜索引擎的替代文字，
以及显示在图片下方的那行小字。不写说明，图片下方就不留空行。

「浮动」只在大屏（≥768px）生效，手机上会自动回到居中，不会把文字挤成一列。

❌ **图片夹在句子中间不生效**：

```markdown
    ……详见下图 ![车间](/uploads/news/chejian.jpg) 所示……     ← 错：成了行内小图
```

```markdown
    ……详见下图。                                            ← 对：独占一段

    ![车间实拍](/uploads/news/chejian.jpg "wide")
```

> 还认一种等价写法 `"layout=left"`，前缀 `layout=` 可有可无，两种效果一样。
>
> 另外还认第五个关键字 `"plain"`（只出图，连图注都不显示）——
> 它是「这张图不当正文插图处理」的开关，极少用，属于备用项。

---

## 四、会员页的三组图片怎么填

会员页有三组图片字段，每组是一个列表，可以放多张、每张带自己的说明，**你在列表里
写的先后就是前台的先后**：

| 字段 | 放什么图 | 前台位置 |
|---|---|---|
| 企业环境 / 门店实拍 | 厂区、门店、车间、办公环境 | 企业简介下方，第一组 |
| 产品 / 案例图 | 主要产品或服务案例 | 第二组 |
| 资质 / 荣誉 | 获奖证书、资质证照、荣誉牌匾 | 第三组 |

文件里是这样写：

```yaml
photosEnv:
  - image: /uploads/members/env/mendian.jpg
    caption: 门店外景
  - image: /uploads/members/env/chejian.jpg
    caption: 生产车间
photosProduct:
  - image: /uploads/members/product/xinghao-a.jpg
    caption: 主打产品 A 型
photosHonor: []
```

- 某一组没图就留空（`[]`），**前台整块不输出**，不会留下一个空标题。
- 每张图的 `caption` 可以留空，留空就是只出图不出字。
- 三组的目录各不相同（`env` / `product` / `honor`），别填串了。
- ⚠ 资质证照涉及企业信息公开，**放上去之前先征得企业同意**，有些企业不愿意
  把证照挂在网上。

**「一组成组的图」请填这三组字段，不要塞进正文**：填在字段里前台会排成整齐的
网格、顺序可拖动；塞进正文得自己一张张调位置，而且每张图的大小对齐全靠运气。
正文只留给「这张图是这段话的一部分」这种确实需要图文穿插的地方。

---

## 五、几个会让内容「消失」的坑

| 现象 | 原因 | 怎么改 |
|---|---|---|
| 新写的稿子在栏目里找不到 | 目录放错了；或 front matter 里 `draft: true` 还没改成 `false` | 文章按**所在目录**归属栏目（见第八节）。`draft: true` 时前台不输出（`npm run dev` 要加 `-D` 才看得到） |
| 本地能看到，线上没有 | 日期没带时区，被 Hugo 当成 UTC 午夜，比现在晚 → 判为「未来文章」静默丢弃 | 日期写成带偏移的完整形式 `2026-03-02T10:00:00+08:00`（archetype 与导入脚本都已带好） |
| 已发布的文章外面链接打不开了 | 改了 `slug`（网址别名） | 别改已发布的 `slug`。要换标题就只改 `title` |
| 封面图是灰块 | front matter 的 `image` 留空 | 这是正常的占位块，不是破图。填一张图就好 |
| 会员页少了页头 LOGO / 联系信息 | `type: member` 丢了，前台静默退回通用文章模板，不报错 | 确保有 `type: member`（`archetypes/members.md` 里已带） |
| 某家会员的名次不对 | 它的 `weight` 与别人重复，或没写 —— 实测**不写 / 写 0 会排到所有正权重之后**（不是最前） | 改成不重复的正整数、留空隙（10/20/30…）：**数字小的在前**。见第四、六节 |
| 正文里的图不居中、没有图注 | 图夹在句子中间，或前后没留空行 | 见上面第三节 |

---

## 六、从零发一篇新闻 / 录一家会员

**发新闻**

1. 在 `content/news/<子栏目>/` 下新建一个 `.md`，**文件名就是网址的一部分**
   （`zhongqiu-2026.md` → `/news/notice/zhongqiu-2026/`）
2. 照 `archetypes/news.md` 填 front matter：**标题**、**网址别名**（`slug`，小写字母 /
   数字 / 连字符，必须手填）、日期（带 `+08:00`）、正文
3. 正文要插图就照第三节写
4. 一张**列表封面图**填进 `image:`（写 `/uploads/news/xxx.jpg`）。要上首页轮播
   就再加 `featured: true`
5. 填**摘要** `summary`（建议每篇都填）
6. `npm run dev` 看效果 → 提交、推送

**录一家会员**

1. 在 `content/members/directory/` 下新建 `<网址别名>.md`；一次录一批就用
   `npm run members:import -- --from 名单.txt`（权重会自动接在现有最大值之后）
2. 照 `archetypes/members.md` 填：**单位全称**、**网址别名**、**`type: member`**、
   **`weight`**、**单位 LOGO**（`image`）
3. 填**单位类型 / 所属行业**（`industry`）与**一句话简介**（`summary`）——
   这两项显示在名录卡片上
4. 写**企业简介**，再往下依次填三组图片：企业环境 / 产品案例 / 资质荣誉
5. 填官网、联系人、电话、地址
6. `npm run dev` 看效果 → 提交、推送

> 会员的显示名次由它自己的 **`weight`** 决定：**数字小的在前**，三处展示（首页 LOGO 墙、
> 会员名录页、页脚滚动名录）共用同一个取数模板，所以不会出现「墙上和名录页不一样」。
> 用**不重复的正整数、留空隙**（10/20/30…），以后插队取中间空位即可，不用重编号。
>
> ⚠ 两个坑：`weight` **写 0 或干脆不写会排到最后**（不是最前）；和别人**重复**时会落到
> 日期 / 简称这些兜底规则上，名次不好预期。

> 「网址别名」`slug` 是唯一必须手填、又最容易填错的字段 —— 它决定前台网址。
> 已发布的会员**不要改 slug**，改了首页 LOGO 墙与外面转发过的链接都会失效。

---

## 七、本仓库自带的示例会员页

`content/members/directory/jincheng-youpin.md` 是**版式范例**，用来对照「三组图片怎么填、
正文插图怎么写」。它是一家**虚构企业**（甘肃金城优品商贸有限公司），名称、成立时间、
联系方式、官网全是编造的，照片是图库里的**示意图** —— 不是这家公司的真实门店、产品
或证照。

**正式发布前请删掉它**（或在它基础上改成真实会员）：

```bash
rm content/members/directory/jincheng-youpin.md
```

删文件就完事 —— **没有需要同步的名单**：会员顺序完全由各会员页自己的 `weight`
决定（它原来是 `weight: 10`，删掉之后后面的会员自动往前挪），不需要再跑任何脚本。

> ⚠ 连带删掉图片不是必须的（没人引用的图不会出现在前台），但为了仓库干净，
> 可以一并删掉 `assets/uploads/members/` 下的 `env/` `product/` `honor/` 三个目录
> 和那张 `jincheng-youpin-logo.png`。**删完记得清一次 `public/`**：
> Hugo 的构建产物不会因为源文件没了就自动消失（`npm run build` 不带
> `--cleanDestinationDir`），否则本地还能打开这个网址。

### 图片来源

那张 LOGO 是本仓库自己生成的占位图（纯图形，不含任何真实机构信息）。其余八张
分两类：

| 文件 | 来源 | 许可 |
|---|---|---|
| `env/fenjian-chejian.jpg` | [Pexels 34207364](https://www.pexels.com/photo/34207364/) | Pexels License，**无需署名** |
| `env/cangchu-wuliu.jpg` | [Pexels 31112238](https://www.pexels.com/photo/31112238/) | 同上 |
| `env/lenglian-zhanlan.jpg` | [Pexels 29409104](https://www.pexels.com/photo/29409104/) | 同上 |
| `product/techan-zhuanqu.jpg` | [Pexels 35056246](https://www.pexels.com/photo/35056246/) | 同上 |
| `product/kushui-meigui.jpg` | [Pexels 3989407](https://www.pexels.com/photo/3989407/) | 同上 |
| `product/hongzao-ganhuo.jpg` | [Pexels 30688212](https://www.pexels.com/photo/30688212/) | 同上 |
| `honor/rongyu-jiangbei.jpg` | [Pexels 29707905](https://www.pexels.com/photo/29707905/) | 同上 |
| `env/xianshang-mendian.jpg` | 维基共享资源 [Chinese supermarket.jpg](https://commons.wikimedia.org/wiki/File:Chinese_supermarket.jpg)，上传者 Bartux~commonswiki | **CC BY-SA 3.0，必须署名** |

**只有最后一张需要署名。** CC BY-SA 3.0 有两条硬要求：署名（作者 + 许可 + 链接）、
以及**改过的版本要沿用同一许可** —— Hugo 把它缩放、转成 WebP，产出的就是「改过的
版本」。所以：

- 署名**必须出现在页面上**（写进 `WRITING.md` 不算，这份文件读者看不到）。
  范例页正文末尾已经放了一行图片来源，照那个位置写。
- 想省事就别用它：换成 Pexels 的（无需署名）或企业实拍。**真实会员页本来就该用
  企业自己提供的照片** —— 图库照片只能出现在这种版式范例里。

> 一句话：**图库图只配当范例**。真上线的会员页，图片请一律由企业提供，
> 免得既担版权又担「这家公司到底长什么样」的责任。

---

## 八、栏目一览（这份稿子该放哪）

**一篇稿子进哪个栏目，由它所在的目录决定**（不是由 front matter 里的字段决定）：

| 前台栏目 | 放这里 | 放什么 | 首页哪里用到它 |
|---|---|---|---|
| 新闻中心 · 通知公告 | `content/news/notice/` | 本会发布的各类通知、公告与征求意见稿 | 首页左上「新闻中心」块（与另三个新闻子栏目混排） |
| 新闻中心 · 商会动态 | `content/news/association/` | 本会的会议、走访、合作等工作动态 | 同上 |
| 新闻中心 · 行业资讯 | `content/news/industry/` | 行业层面的资讯与要闻 | 首页「行业资讯」卡 +「新闻中心」块 |
| 新闻中心 · 媒体报道 | `content/news/media/` | 媒体对本会及行业的报道 | 首页四页签「媒体报道」+「新闻中心」块 |
| 会员天地 · 会员单位 | `content/members/directory/` | 会员单位名单，**一家公司一个文件**（是「条目」不是文章，必须 `type: member`） | 首页 LOGO 墙、会员名录页、页脚滚动名录 |
| 会员天地 · 会员动态 | `content/members/dynamics/` | 会员单位的最新动态 | 首页行一右栏「会员动态」 |
| 会员天地 · 会员服务 | `content/members/services/` | 面向会员的培训、咨询与对接服务 | 首页四页签「会员服务」 |
| 政策法规 | `content/policy/` | 国家与地方的相关政策、文件与解读 | 首页四页签「政策法规」（默认展开） |
| 党群工作 | `content/party/` | 党建工作动态、学习教育与清廉社会组织建设 | 首页四页签「党群工作」 |
| 关于我们 | `content/about/` | `overview` 简介、`charter` 章程、`organization` 组织机构、`join` 入会指南、`contact` 联系我们 | 导航「关于我们」的五个二级项 |
| 首页自身 | `content/_index.md` | 首页的正文区（一般留空） | `/` |
| 站内搜索 | `content/search.md` | **不是文章**：`layout: search` 让它用搜索模板 | `/search/` |

几条与栏目相关的约定：

- **政策法规、党群工作没有二级栏目**：文章直接放在 `content/policy/`、`content/party/`
  下，国家 / 地方 / 解读这类细分用 `tags` 区分，不再占导航位（市级商会这两类内容一年
  就几条，拆成二级栏目必然长期空着）。
- **原模板的「标准规范」「服务与合作」两个一级栏目已移除**：前者是省级联合会的职能
  （团体标准编制），市级商会不适用；后者的培训 / 咨询本就是「为会员服务」，已并入
  「会员天地 · 会员服务」。
- 新增或改名栏目，**必须同改四处**（漏一处不报错，只是导航出现空白项）：
  该栏目的 `_index.md`、`hugo.toml` 的 `[[menu.main]]`、`data/home.yaml` 里的
  `xxxSection`、`hugo.toml` 的 `[[params.homeTabs]]`。
- 首页每个版块取哪个栏目、取几条、标题叫什么，全在 `data/home.yaml` 里配。
