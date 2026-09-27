#!/usr/bin/env node
/**
 * 一次性生成器：产出 static/admin/config.yml
 *
 * 为什么用生成而非手写 —— 每个文章集合有【四处必须逐字一致】：
 *   folder              文章落盘目录
 *   preview_path        预览 iframe 的地址（不同步 → 预览 404）
 *   filter.value        Decap 用它过滤 categories 字段，把栏目的 _index.md
 *                       （没有 categories）挡在列表之外
 *   categories.default  新建文章时自动写入的分类（不同步 → 文章保存成功
 *                       但在列表里“消失”）
 * 手写这么多份必然漂移，这里从同一张表派生。
 *
 * ⚠ 改完栏目后请重新运行：
 *      node scripts/gen-cms-config.mjs
 *   它只往 static/admin/config.yml 写，不会碰任何内容文件。
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(repoRoot, 'static', 'admin', 'config.yml');

/**
 * dir      content/ 下的相对路径
 * cat      所属一级栏目的目录名 —— 必须等于 content/<cat>/ 的目录名
 *          （栏目标题改了没关系，目录名与 categories 值是绑定的）
 * members  true = 条目型集合（会员单位）：字段集更精简、文件名不带日期前缀，
 *          详见下面 memberFields() 与 collection() 里的 slug 模板
 */
const sections = [
  { group: '新闻中心', items: [
    { name: 'news-notice',      label: '通知公告', dir: 'news/notice',      cat: 'news', desc: '本会发布的各类通知、公告与征求意见稿。（另：本栏是首页右栏「通知公告」滚动栏的数据源）' },
    { name: 'news-association', label: '商会动态', dir: 'news/association', cat: 'news', desc: '本会的会议、走访、合作等工作动态。（另：本栏是首页「商会动态」头条区的数据源）' },
    { name: 'news-industry',    label: '行业资讯', dir: 'news/industry',    cat: 'news', desc: '行业层面的资讯与要闻。（另：本栏是首页「行业资讯」卡的数据源）' },
    { name: 'news-media',       label: '媒体报道', dir: 'news/media',       cat: 'news', desc: '媒体对本会及行业的报道。（另：本栏是首页四页签「媒体报道」的数据源）' },
  ]},
  { group: '会员天地', items: [
    { name: 'members-directory', label: '会员单位', dir: 'members/directory', cat: 'members', members: true,
      desc: '会员单位名单，一条目一页。保存后同时出现在首页 LOGO 墙、名录页与页脚滚动条上。' },
    { name: 'members-dynamics', label: '会员动态', dir: 'members/dynamics', cat: 'members', desc: '会员单位的最新动态。（另：本栏是首页「会员动态」整行的数据源）' },
    { name: 'members-services', label: '会员服务', dir: 'members/services', cat: 'members', desc: '面向会员的培训、咨询与对接服务。（另：本栏是首页四页签「会员服务」的数据源）' },
  ]},
  /*
    政策法规与党群工作**没有二级栏目**：文章直接落在 content/policy/、
    content/party/ 下。国家/地方/解读这类细分改用 tags 区分，不再占导航位 ——
    市级商会的这两类内容一年就几条，拆成三个二级栏目必然长期空着。
  */
  { group: '政策法规', items: [
    { name: 'policy', label: '政策法规', dir: 'policy', cat: 'policy', desc: '国家与地方的相关政策、文件与解读。（另：本栏是首页四页签「政策法规」的数据源，该页签默认展开）' },
  ]},
  { group: '党群工作', items: [
    { name: 'party', label: '党群工作', dir: 'party', cat: 'party', desc: '党建工作动态、学习教育与清廉社会组织建设。（另：本栏是首页四页签「党群工作」的数据源）' },
  ]},
  /*
    原模板的「标准规范」「服务与合作」两个一级栏目已移除：
    前者是省级联合会的职能（团体标准编制），市级商会不适用；
    后者的培训/咨询本就是「为会员服务」，已并入 members-services。
  */
];

/*
  正文工具栏允许出现的按钮。

  刻意去掉 heading-one —— 页面标题已经是 <h1 class="article-title">，
  正文里再来一个 h1 是 SEO 与无障碍的双重问题。目录（TOC）也只取 h2/h3
  （见 hugo.toml 的 markup.tableOfContents）。

  ⚠ 这里是**合法枚举**，写错任何一个 Decap 不会报错，只是那个按钮消失。
    完整枚举见 decap-cms 的 markdown 组件 schema：bold / italic / strikethrough /
    code / link / heading-one … heading-six / quote / bulleted-list / numbered-list。
*/
const ARTICLE_BUTTONS = `[bold, italic, strikethrough, code, link, heading-two, heading-three, heading-four, quote, bulleted-list, numbered-list]`;

/*
  正文里插图的编辑器组件。

  ⚠ 必须写 image —— 这是在**覆盖** Decap 内置的图片组件（见 static/admin/
    editor-components.js），不是引用一个自定义组件。名字换掉就会丢掉两样东西：
      1. Decap 里有一段写死的 if (components.has("image"))，会把这个 markdown
         字段自己的 media_folder 传播给插图组件（已在本仓库内的
         decap-cms.js 里核对过）。换 id 就传播不到，插图会静默落到全局
         assets/uploads/ 根目录 —— 整个「图片分栏目存放」的努力白费，且不报错。
      2. 内置那条图片正则会与自定义组件并存，同一条 ![](...) 归谁解析变得含糊。
*/
const EDITOR_COMPONENTS = `[image]`;

const rules = `# ============================================================================
#  商会站点 — Decap CMS 配置
#  https://decapcms.org/
#
#  ⚠ 本文件由 scripts/gen-cms-config.mjs 生成，请勿手工编辑。
#    改栏目请改生成器的 sections 表，然后跑：
#        node scripts/gen-cms-config.mjs
#
#  本地编辑（本仓库采用的方案）：
#     npm install          # 首次安装 decap-server
#     npm run cms          # 终端 A：decap-server（http://localhost:8081）
#     npm run dev          # 终端 B：hugo server （http://localhost:1313）
#     浏览器打开 http://localhost:1313/admin/
#
#  三处关键约定，详见 CMS.md：
#   1) 文章集合用 filter 过滤 categories 字段，从而把 Hugo 的 _index.md
#      （栏目页，没有 categories）挡在列表之外。
#   2) 每个集合的 categories 都是 hidden 字段并带 default，新建文章会自动
#      带上正确分类；categories 的值是**一级栏目的目录名**（news / members /
#      policy / party），二级栏目（若有）共用一级的值。
#      填错不会报错，只会让文章在后台列表里“消失”。
#   3) date/lastmod 用 'YYYY-MM-DDTHH:mm:ssZ' 存储，写出的是带 +08:00 偏移
#      的本地时间，避免纯日期被 Hugo 当成 UTC 午夜而在构建时按“未来文章”
#      静默丢弃（本地有、线上没有）。
#   4) 每个集合都有**必填**的 slug 字段（「网址别名」）。文件名模板与
#      preview_path 都用 {{fields.slug}}（不是 {{slug}}）——
#      三者由此对齐：文件名 2026-03-02-jiangong.md / front matter 的
#      slug: jiangong / Hugo 网址 /栏目/jiangong/ / 预览 /栏目/jiangong/。
#      ⚠ 不要改回 {{slug}}：{{slug}} 取的是**标题**的字面值，而 Hugo 认
#      slug front matter，两者会分叉，表现为「预览面板 404」。
#      ⚠ 也别把 slug 改成 required: false：Decap 的模板没有“为空就退回标题”
#      的条件语法，留空会让文件名塌成 2026-03-02-.md。原因详见 CMS.md。
#   5) 会员单位（members-directory）是**条目型集合**，与文章集合有两处不同：
#      文件名不带日期前缀（slug 模板就是 {{fields.slug}}），因为会员网址
#      /members/directory/<别名>/ 是长期稳定的，不该随建站日期变；
#      字段集也更精简，并带一个隐藏的 type: member —— 它决定前台用
#      layouts/member/single.html 渲染，同时让会员页不被当成文章混进
#      /members/ 的列表（见 layouts/_default/list.html）。
# ============================================================================

# ---- 本地后端（beta）：由 decap-server 代理读写本机 git 工作区 ----
local_backend: true

# local_backend 生效时，请求都走本机代理；此处 backend 仅作为占位。
# 若日后要开放线上编辑，改成 github 后端并配置 OAuth 代理，例如：
#   backend:
#     name: github
#     repo: <你的组织>/<你的仓库>
#     branch: main
#     base_url: https://<你的 OAuth 代理域名>
backend:
  name: git-gateway
  branch: main

# 本地后端不支持编辑工作流，只能用 simple
publish_mode: simple

# ⚠ site_url / display_url 决定右上角那个「查看站点」链接跳到哪。
#   本仓库走的是**纯本地编辑**（decap-server，见 CMS.md），线上 /admin/ 打不开，
#   所以这里指向本机 Hugo，点开就能对照刚保存的内容。
#   日后若开放线上编辑，换成真实域名。
site_url: http://localhost:1313
display_url: http://localhost:1313

# 后台左上角的标识。留空会显示 Decap 自带的图标，编辑同事会以为
# 「进错了别人的系统」。换成自己的标即可（图在 static/images/ 下）。
# ⚠ 必须写相对路径 ../images/…，不能写 /images/… —— 后台是纯静态文件，
#   不走 Hugo 的子路径处理，写死根路径会落到账号根站上、换域名后 404。
#   ../images 相对本页 <站点>/admin/ 解析，根部署与子路径部署都对。
logo_url: ../images/cms-logo.svg

# 非英语界面；index.html 加载的是完整版 decap-cms，已内置全部语言包
locale: zh_Hans

# 本地后端不产生部署预览，关掉工具条上的预览链接按钮
show_preview_links: false

# 这个 slug 段只影响**媒体库**的文件名（图片等），以及各集合 slug 模板里
# 标题 slugify 的兜底行为。文章文件名现在由 slug 字段（网址别名）决定，
# 与下面这段无关。
# 保留 unicode 是因为上传的中文图片名直接丢弃会撞名；Hugo 已开启
# hasCJKLanguage，中文媒体名可以正常工作。
slug:
  encoding: unicode
  clean_accents: false
  sanitize_replacement: '-'

# 图片上传到 assets/uploads/，页面里引用 /uploads/...
#
# ⚠ 不能改用 static/ —— 放在那里的图片 Hugo 不做任何处理：手机直出的 5–10MB
#   原图会原样发给访客，而且 <img> 拿不到宽高，加载完成时页面会「跳一下」。
#   放在 assets/ 里 Hugo 会缩放、转 WebP、补上宽高。
#   assets/ 里的文件默认不发布，所以 hugo.toml 里额外挂了一条 module.mounts，
#   把 assets/uploads 同时当静态文件发布一份原图 —— 后台上传后的缩略图预览
#   靠的就是它（后台跑在浏览器里，只能通过网址取图）。
media_folder: assets/uploads
public_folder: /uploads

collections:
`;

/*
  关于我们（固定页面）。
  栏目页 content/about/_index.md 不在 CMS 中 —— 栏目页有 weight、layout 等字段，
  混进文章列表会让 filter 机制失去意义，所以栏目标题只能在文件里改。

  ⚠ 下面 fields 里的 &about_fields 锚点与 *about_fields 别名，必须与这 5 个文件
    条目留在同一份 YAML 文档里才有效。这里只是把它从上面的模板字符串里挪成一个
    独立常量，五条仍会一起拼进同一个 config.yml，锚点照常生效。
*/
const aboutSection = `
  # ==========================================================================
  #  关于我们（固定页面）
  # ==========================================================================
  - name: about
    label: 关于我们
    description: 商会简介、章程、组织机构、入会指南与联系方式。栏目页（_index.md）不在 CMS 中维护。
    media_folder: /assets/uploads/about
    public_folder: /uploads/about
    files:
      - name: overview
        label: 商会简介
        file: content/about/overview.md
        fields: &about_fields
          - {label: 标题, name: title, widget: string}
          - {label: 导航短标题, name: linkTitle, widget: string, required: false}
          - {label: 排序权重, name: weight, widget: number, value_type: int, required: false, hint: 数字越小越靠前}
          - {label: 描述, name: description, widget: text, required: false}
          - {label: 正文, name: body, widget: markdown, buttons: ${ARTICLE_BUTTONS}, editor_components: ${EDITOR_COMPONENTS}, media_folder: /assets/uploads/about, public_folder: /uploads/about, hint: 点工具栏的「添加组件」→「正文插图」加图，能选版式（居中 / 宽图 / 左浮 / 右浮）并写图注}
      - name: charter
        label: 商会章程
        file: content/about/charter.md
        fields: *about_fields
      - name: organization
        label: 组织机构
        file: content/about/organization.md
        fields: *about_fields
      - name: join
        label: 入会指南
        file: content/about/join.md
        fields: *about_fields
      - name: contact
        label: 联系我们
        file: content/about/contact.md
        fields: *about_fields
`;

/*
  「网址别名」的校验规则。

  为什么值得加：Hugo 用 slug front matter 顶掉文件名那一段，别名里混进中文或
  大写字母**不会报任何错**，只会静默生成一个 %E4%B8%AD%E6%96%87/ 那样的网址，
  贴出去才发现。Decap 的 string 组件支持 pattern：[正则, 报错文案]，
  在保存的那一刻就把这类输入挡住，错误提示直接显示在输入框下方。

  ⚠ 正则与文案里都不能出现单引号（YAML 单引号标量的转义符），也别用半角逗号
    —— 这个字段是内联流式写法（{...}），半角逗号会被当成字段分隔符。
*/
const SLUG_PATTERN = `pattern: ['^[a-z0-9]+(-[a-z0-9]+)*$', '只能填小写英文字母、数字和连字符-，不能有中文或空格']`;

/*
  会员页的图片分区（企业环境 / 产品案例 / 资质荣誉）。

  三个分区结构完全一样，抽成一个函数，避免三份几乎相同的 YAML 漂移。

  为什么用 list 而不是普通图片字段：一个分区要放多张图，而且每张图各自需要
  说明文字。「列表 + 对象」正好表达「一组带说明的图片」。

  ⚠ collapsed: false 是**必须的**，不是偏好。
     Decap 的 list 控件把每一项折叠起来，折叠行里只渲染 summary 那个**字符串**
     —— 它不会渲染缩略图（这点网上不少说法是错的：折叠行里根本没有取图片字段）。
     于是相册在后台看起来只有一串「分拣加工车间」「线下门店」的文字，图片一张也
     看不见，编辑的人根本不知道自己传没传错图。
     collapsed: false 让每一项**默认展开**，object 里的 image 字段就会渲染缩略图。
     想临时收起来，点分组标题右边的折叠按钮即可（那不影响默认状态）。

     代价是表单变长：一家传满 8 张图的会员，这三组会撑开 8 行。这是有意换的 ——
     看不见图比表单长更糟。若以后有会员照片特别多，可以再议分页或换成
     allow_multiple 的纯图片字段（但那样就丢掉每张图的说明了）。

  ⚠ 内层字段名 image 保持不变：它与渲染钩子、前台模板和已有内容文件对齐，
     改名要连模板一起改，没有收益。

  ⚠⚠ 必须用 fields（复数），不能用 field + name。
      写成 `field: {name: item, widget: object, fields: [...]}` 时，Decap 会把
      每一项**再套一层键名**，存下来是 `photosEnv: [{item: {image: …}}]`；
      而前台模板与 archetypes/ WRITING.md 里写的都是扁的 `{image, caption}`。
      后果是：后台看着填好了、保存也成功，但会员页上**一张图都不出现**，
      而且不报任何错。2026-09-27 实测踩到：content/members/directory/member-01.md
      里就是这么写进去的。fields（复数）写在 list 自己身上，条目才是扁的。

  ⚠⚠ mediaFolder 必须以 / 开头，理由见上面 collection() 里那段 —— 不写斜杠时
      Decap 会把它当成**相对于条目文件**的路径。
*/
function photoGroup(name, label, mediaFolder, publicFolder, hint) {
  return `      - label: ${label}
        name: ${name}
        widget: list
        required: false
        collapsed: false
        summary: '{{fields.caption}}'
        media_folder: ${mediaFolder}
        public_folder: ${publicFolder}
        hint: ${hint}
        fields:
          - {label: 图片, name: image, widget: image, choose_url: false}
          - {label: 说明, name: caption, widget: string, required: false, hint: 显示在这张图下方。留空则该图只出图不出字}
`;
}

/* 文章集合的字段 */
function articleFields(dir, cat, mediaFolder, publicFolder) {
  return `
      - {label: 标题, name: title, widget: string, hint: 列表、详情页、搜索结果的标题都用它}
      - {label: 网址别名, name: slug, widget: string, ${SLUG_PATTERN}, hint: 必填。决定前台网址：填 jiangong-2026 → /${dir}/jiangong-2026/。⚠ 已发布的文章别改，改了等于换网址，原有链接会失效}
      - {label: 发布日期, name: date, widget: datetime, format: 'YYYY-MM-DDTHH:mm:ssZ', default: '{{now}}', hint: 列表按它倒序。要发一篇「补录的旧闻」就把它改成当时的日期}
      - {label: 正文, name: body, widget: markdown, buttons: ${ARTICLE_BUTTONS}, editor_components: ${EDITOR_COMPONENTS}, media_folder: ${mediaFolder}, public_folder: ${publicFolder}, hint: 点工具栏的「添加组件」→「正文插图」加图，能选版式（居中 / 宽图 / 左浮 / 右浮）并写图注。⚠ 插图前后各留一个空行，版式才生效}
      - {label: 列表封面图, name: image, widget: image, required: false, choose_url: false, hint: ⚠ 一张图同时用在三个地方：栏目列表里的小图、首页「图片新闻」轮播、本篇详情页正文上方的大图。和正文里插的图没有关系 —— 正文插图请写在正文里。留空时前台渲染灰色占位块，不会出现破图}
      - {label: 摘要, name: summary, widget: text, required: false, hint: 列表页、搜索结果、分享到微信/QQ 时的描述都用它。⚠ 建议每篇都填：留空会自动截取正文开头，而正文以图开头时截出来的是图注}
      - {label: 更新日期, name: lastmod, widget: datetime, format: 'YYYY-MM-DDTHH:mm:ssZ', required: false}
      - {label: 标签, name: tags, widget: list, required: false, hint: 回车加一个。用于站内搜索与将来的聚合页}
      - {label: 来源, name: source, widget: string, required: false, hint: 转载或供稿方，如「兰州日报」}
      - {label: 首页图片新闻, name: featured, widget: boolean, required: false, default: false, hint: 勾选后进入首页顶部轮播，用的就是上面那张「列表封面图」。轮播取几条在「首页 → ② 首页各版块」里调。列表页顶部也有一个「上首页轮播的」筛选可以查漏}
      - {label: 草稿, name: draft, widget: boolean, default: false, hint: 勾上后前台不显示这篇。发布前记得取消勾选}
      - {label: 栏目分类, name: categories, widget: hidden, default: [${cat}], hint: 一级栏目的目录名，不要改}
`;
}

/*
  会员单位的字段。刻意精简 —— 会员是「条目」不是「文章」：标签、来源、
  首页轮播、草稿这些字段对它没有意义，留着只会让录名单的人多填十几项。
  字段名与 layouts/member/single.html 一一对应，模板里没填的字段不渲染那一行。

  字段顺序：必填的、最常填的排前面。三个图片分区紧跟企业简介 —— 它们同属
  「这家企业长什么样」，放一起比散落各处好找。
*/
function memberFields(dir, cat, mediaFolder, publicFolder) {
  return `
      - {label: 单位全称, name: title, widget: string, hint: 工商登记全称，会员页的标题就是它}
      - {label: 网址别名, name: slug, widget: string, ${SLUG_PATTERN}, hint: 必填。决定会员页网址：填 lanzhou-maoyi → /${dir}/lanzhou-maoyi/。⚠ 已收录的会员别改，改了首页 LOGO 墙与会刊上的链接都会失效}
      - {label: 单位简称, name: linkTitle, widget: string, required: false, hint: 首页 LOGO 墙与名录卡片上用的短名，留空则显示全称}
      - {label: 单位 LOGO, name: image, widget: image, required: false, choose_url: false, hint: 建议方形或横版图，前台按 contain 缩放不裁切。它会出现在名录卡片、首页 LOGO 墙与会员页页头三处。留空时渲染占位块，不会出现破图}
      - {label: 单位类型 / 所属行业, name: industry, widget: string, required: false, hint: 如「批发零售」「装备制造」，显示在名录卡片上}
      - {label: 一句话简介, name: summary, widget: text, required: false, hint: 名录卡片与会员页名片上显示，建议 40 字以内}
      - {label: 企业简介, name: body, widget: markdown, buttons: ${ARTICLE_BUTTONS}, editor_components: ${EDITOR_COMPONENTS}, media_folder: ${mediaFolder}, public_folder: ${publicFolder}, hint: 可写经营范围、主要产品、合作意向等。点工具栏的「添加组件」→「正文插图」加图，能选版式并写图注}
${photoGroup('photosEnv', '企业环境 / 门店实拍', `${mediaFolder}/env`, `${publicFolder}/env`, '厂区、门店、车间、办公环境的实拍照片。可一次选多张，拖动调整顺序。前台在企业简介下方按网格展示')}${photoGroup('photosProduct', '产品 / 案例图', `${mediaFolder}/product`, `${publicFolder}/product`, '主要产品或服务案例的图片，每张可以写一句说明。前台在企业环境下方按网格展示')}${photoGroup('photosHonor', '资质 / 荣誉', `${mediaFolder}/honor`, `${publicFolder}/honor`, '获奖证书、资质证照、荣誉牌匾等。⚠ 公示证照前请先征得企业同意，有些企业不愿意把证照公开')}      - {label: 企业官网, name: website, widget: string, required: false, hint: 完整地址，含 https://}
      - {label: 联系人, name: contact, widget: string, required: false}
      - {label: 联系电话, name: phone, widget: string, required: false}
      - {label: 单位地址, name: address, widget: string, required: false}
      - {label: 收录日期, name: date, widget: datetime, format: 'YYYY-MM-DDTHH:mm:ssZ', default: '{{now}}'}
      # 排序权重：表单里不再出现（前端展示顺序改由「会员天地 → 会员排序」那份
      # 可拖拽名单决定，见 data/members_order.yaml）。这里必须保留一行 widget: hidden，
      # 而不是把这一行删掉 —— Decap 只会写回**声明过**的字段，声明漏一个，
      # 从后台保存一次就把那个键从 front matter 里删掉了。hidden 则把原值原样带走。
      - {label: 排序权重, name: weight, widget: hidden}
      - {label: 栏目分类, name: categories, widget: hidden, default: [${cat}], hint: 一级栏目的目录名，不要改}
      - {label: 页面类型, name: type, widget: hidden, default: member, hint: ⚠ 固定为 member，不要改：它决定前台用哪个模板（layouts/member/single.html），并让会员页不被当成文章混进栏目文章列表}
`;
}

function collection({ name, label, dir, cat, desc, members }, group) {
  const isMember = !!members;

  /*
    图片按一级栏目分目录存放（assets/uploads/news、assets/uploads/members…），
    这样「图片存哪、路径怎么写」有章可循，不再全堆在一个目录里。

    ⚠ media_folder 与 public_folder 必须**成对**出现。只写 media_folder 时，
      Decap 会把 public_folder 赋成同一个字符串（decap-cms 的字段归一化：
      "media_folder" in e && !("public_folder" in e) → public_folder = media_folder），
      于是 front matter 里存下的就是 assets/uploads/news 这种**磁盘路径**，
      前台拿它当网址用 → 全站破图，而且不报任何错。

    ⚠⚠ media_folder 必须以 / 开头，这是**实测踩出来的坑**，不是风格问题。
      Decap 的字段目录解析（decap-cms.js 里 2026-09 版）是这样的：

          if (解析后的路径.startsWith("/")) 落点 = join(路径)          // 仓库根
          else                              落点 = join(dirname(条目文件), 路径)

      media_folder 写 assets/uploads/members/env（没有斜杠）时走 else 分支，
      于是图被传到**条目文件旁边**：content/members/directory/assets/uploads/members/env/。
      而 public_folder 是 /uploads/members/env，front matter 里记的也是
      /uploads/members/env/xxx.jpg —— 磁盘上那个位置根本没有文件。
      后果：编辑器里缩略图裂开成白的，前台那张图也不出现，且**全程不报错**。
      2026-09-27 实测：content/members/directory/assets/uploads/members/env/ 下
      躺着两张这样传上去的图。

      加上前导斜杠后走 if 分支，落点就是仓库根的 assets/uploads/…，与前台
      /uploads/… 一一对应。写到磁盘时各 backend 会自己去掉这个前导斜杠
      （decap-cms.js 里随处可见 `path.startsWith("/") ? path.slice(1) : path`）。
  */
  const mediaFolder = `/assets/uploads/${cat}`;
  const publicFolder = `/uploads/${cat}`;
  /*
    条目型集合的文件名**不带日期前缀**：会员网址 /members/directory/<别名>/
    是要长期贴出去、印在名片上的，不该随建站日期变。文章则相反 ——
    日期前缀让文件在编辑器里天然按时间排序。
  */
  const slug = isMember
    ? '{{fields.slug}}'
    : '{{year}}-{{month}}-{{day}}-{{fields.slug}}';

  /*
    ⚠ label 只用**短名**（通知公告），不要写成「新闻中心 · 通知公告」。

    Decap 的 label 是纯文本，写进 config.yml 就只能一字不差地显示出来，
    而真正的「缩进 + 分组标题」是由 sidebarGroupsCss() 生成的一份 CSS
    做到的（见该函数上方那段说明）。两边配合起来才是：
        新闻中心          ← CSS 生成的组标题
          通知公告        ← 这里的 label
          商会动态
    只改这里而不改 CSS（或反过来），左栏就会出现重复或错位。
  */
  const prefixed = label;

  /*
    列表页顶部的筛选按钮与排序选项。
    view_filters 的匹配规则（读的是 decap-cms-core 源码）：
      值 !== undefined 且 new RegExp(String(pattern)).test(String(值))
    所以 pattern: true 只命中该字段真的为 true 的条目；
    没有这个字段的条目（如草稿字段从未写过）因为 undefined 被直接排除。
    ⚠ 它**没法表达「没填」**：pattern: '' 会命中所有**填了**的条目，
      想筛「还没配 LOGO 的会员」做不到，别照直觉写。
  */
  const listTools = isMember
    ? `
    sortable_fields: ['weight', 'title', 'date']`
    : `
    sortable_fields: ['date', 'title', 'lastmod']
    view_filters:
      - {label: 草稿（还没发布的）, field: draft, pattern: true}
      - {label: 上首页轮播的, field: featured, pattern: true}`;

  return `
  # --------------------------------------------------------------------------
  #  ${prefixed}
  #  folder / filter.value / categories.default / preview_path 四处同源，
  #  改目录名请改生成器的 sections 表，不要手改本文件。
  # --------------------------------------------------------------------------
  - name: ${name}
    label: ${prefixed}
    label_singular: ${label}
    description: ${desc}
    folder: content/${dir}
    create: true
    slug: '${slug}'
    preview_path: '${dir}/{{fields.slug}}'
    filter: {field: categories, value: ${cat}}
    media_folder: ${mediaFolder}
    public_folder: ${publicFolder}${listTools}
    fields:${isMember ? memberFields(dir, cat, mediaFolder, publicFolder) : articleFields(dir, cat, mediaFolder, publicFolder)}
`;
}

/*
  侧栏分组样式 —— 生成 static/admin/sidebar-groups.css。

  为什么是 CSS 而不是配置：

  Decap 的左侧栏是**一个扁平列表**（`<ul>` 里一行一个 `<li>`），官方没有
  任何「分组」配置项。它确实有一个 `nested` 选项能把一个集合折叠成树，
  但那个树的**文件夹节点的名字取的是该文件夹里第一条内容的标题**
  （decap-cms-core 的 NestedCollection：
     function getNodeTitle(node, collection) {
       if (!node.isRoot && node.isDir && hasSubfolders) {
         const first = node.children.find(c => !c.isDir);
         if (first && first.title) return first.title;   // ← 内容标题
       }
       return node.title;                                 // ← 目录名 notice
     }
   而 hasSubfolders:false 会让内容列表整个空掉，所以那个分支不能走）。
  也就是说折叠之后，子栏会显示成「关于开展2026年度会费收缴工作的通知」
  这种文章标题 —— 对编辑同事比不折叠更难用。

  所以改成纯样式的做法：**不动 DOM**（Decap 是 React + styled-components，
  挪它的节点会被重渲染打回原形），只用 CSS 给这一组链接加左缩进，
  并在组内第一项前面用 ::before 插一个组标题。
  依据是 Decap 给每个集合的侧栏链接打了 data-testid="<集合名>"。

  这样做的两个好处：
    · 分组信息仍然只有 sections 表一个来源，不会和 config.yml 漂移；
    · 万一将来 Decap 改了 DOM，最坏结果只是退回「扁平 + 短名」，
      链接本身照常能用，不会报错也不会白屏。

  ⚠ 只给**二级栏目**（目录里带 '/' 的）加缩进：政策法规、党群工作自己
    就是一级栏目，缩进会让它们看起来隶属于上面那一组。
*/
function sidebarGroupsCss() {
  const groups = sections
    .map((g) => ({ group: g.group, subs: g.items.filter((i) => i.dir.includes('/')) }))
    .filter((g) => g.subs.length > 0);

  const sel = (i) => `a[data-testid="${i.name}"]`;
  const indented = groups.flatMap((g) => g.subs.map(sel));

  /* 「会员排序」不在 sections 表里（它不是一个文章集合），但要跟同组的会员
     集合一样缩进，所以单独把它补进缩进名单 —— 少了这行它会顶格显示在
     「会员天地」组里，看起来像另一个一级分组。 */
  indented.push(`a[data-testid="members-order"]`);

  const heads = groups
    .map((g) => `li:has(> ${sel(g.subs[0])})::before { content: "${g.group}"; }`)
    .join('\n');

  /* ⚠ ::before 要挂在**每一条**选择器上。写成 `A, B::before {}` 只对 B 生效
        （CSS 里伪元素只作用于它紧跟的那一个复合选择器），组标题会只剩一个。 */
  const headSels = groups.map((g) => `li:has(> ${sel(g.subs[0])})::before`).join(',\n');

  return `/* ==========================================================================
 *  后台左侧栏的分组标题与缩进
 *
 *  ⚠ 本文件由 scripts/gen-cms-config.mjs 生成，请勿手工编辑。
 *    改分组请改生成器的 sections 表，然后跑：
 *        node scripts/gen-cms-config.mjs
 *
 *  为什么是 CSS：Decap 的侧栏是扁平列表，且它的 nested 折叠功能会把子栏
 *  显示成文章标题（详见生成器里 sidebarGroupsCss() 上方的说明）。
 *  这里只加缩进和一个 ::before 组标题，完全不碰 DOM。
 *
 *  组标题是 <li> 上的 ::before，不在 <a> 里 —— 所以它不可点，也不影响跳转。
 *  用 :has() 选择器定位（Chrome/Edge 105+、Safari 15.4+、Firefox 121+）。
 *  不支持 :has() 的老浏览器只会少掉组标题和缩进，链接照常工作。
 * ========================================================================== */

/* 组标题：每个分组第一条前面插一行组名 */
${headSels} {
  display: block;
  margin: 16px 20px 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #8a93a1;
}

${heads}

/* 组内条目左缩进，做出「子栏」的层次 */
${indented.join(',\n')} {
  padding-left: 34px !important;
}
`;
}

/*
  首页分组。

  Decap 的左侧栏里「一行 = 一个 collection」，没有真正的子分组概念，所以
  「首页」只能做成**一个集合**、把三个文件装进它的 files 列表 —— 左栏会显示成
  「首页 ▾」加一个文件下拉。

  为什么合并：原来「友情链接」「合作机构」各自是一个独立 collection、各只有
  一个文件，在左栏里跟「关于我们」「新闻中心」平级，看不出它们其实是首页的
  组成部分；而首页自身（content/_index.md）根本没接进 CMS。

  ⚠ 这三条都是**文件型**条目，没有 categories，不参与文章集合那套 filter 机制。
  ⚠ 首页版块的条数、四页签、侧栏按钮在 hugo.toml 里，**不在 CMS 中**。
  ⚠ Decap 保存时会重新序列化整个 YAML，data/*.yaml 顶部的注释会丢失。
*/
/*
  首页版块的「取哪个栏目」下拉选项 —— 由上面的 sections 表派生，所以新增栏目后
  这里会自动跟上。用 select 而不是自由文本，是因为 section 写错**不会报错**，
  只会让那个版块在首页整个消失，用下拉能挡住这类手误。
*/
const sectionSelect = (() => {
  const opts = sections
    .flatMap((g) => g.items)
    .map((i) => `{label: ${i.label}, value: ${i.dir}}`);
  return `[${opts.join(', ')}]`;
})();

const home = `
  # ==========================================================================
  #  首页 —— 首页设置 + 首页版块 + 友情链接 + 合作机构
  # ==========================================================================
  - name: home
    label: 首页
    description: 首页自身的标题与描述、各版块的标题与条数、首页底部的友情链接、首页右栏的合作机构。⚠ 首页四页签与侧栏按钮在 hugo.toml 里，不在这里。
    files:
      - name: index
        label: ① 首页设置（有页面）
        file: content/_index.md
        fields:
          - {label: 标题, name: title, widget: string}
          - {label: 描述, name: description, widget: text, required: false, hint: 首页的 meta description，也用于分享卡片；留空回落到站点级描述}
          - {label: 正文, name: body, widget: markdown, required: false, hint: 首页顶部的正文区，一般留空}
      # ----------------------------------------------------------------------
      #  ⚠ 这个文件（data/home.yaml）会被后台**整个重写**：它里面每一个键都
      #    必须在下面声明，漏一个，从后台保存一次就会把那个键删掉。
      #    这是 Decap 的固有行为（同 CMS.md §5 说的 YAML 注释会丢）。
      - name: blocks
        label: ② 首页各版块（条数 / 取自哪个栏目）
        file: data/home.yaml
        fields:
          - label: 图片新闻（顶部轮播）
            name: featured
            widget: object
            fields:
              - {label: 标题, name: title, widget: string, required: false, hint: 图片新闻横跨全部栏目，没有对应的栏目页可取标题，所以在这里填}
              - {label: 条数, name: count, widget: number, value_type: int, required: false, hint: 取最近这么多篇。「上哪些文章」由文章自己的「首页图片新闻」开关决定，不在这里}
          - label: 商会动态（头条 + 列表）
            name: headline
            widget: object
            fields:
              - {label: 取哪个栏目, name: section, widget: select, options: ${sectionSelect}, hint: ⚠ 选错不会报错，只会让这个版块在首页整个消失}
              - {label: 条数, name: count, widget: number, value_type: int, required: false, hint: 第 1 条作头条，其余作下面的列表}
          - label: 通知公告（滚动栏）
            name: notice
            widget: object
            fields:
              - {label: 取哪个栏目, name: section, widget: select, options: ${sectionSelect}, hint: ⚠ 选错不会报错，只会让这个版块在首页整个消失}
              - {label: 条数, name: count, widget: number, value_type: int, required: false}
              - {label: 滚动区高度, name: marqueeHeight, widget: number, value_type: int, required: false, hint: 单位 px。⚠ 这是**移动端的兜底高度**，桌面端由布局算出；滚动逻辑靠容器的确定高度判断「内容够不够一屏」，别当装饰随意改}
          - label: 行业资讯
            name: industry
            widget: object
            fields:
              - {label: 取哪个栏目, name: section, widget: select, options: ${sectionSelect}, hint: ⚠ 选错不会报错，只会让这个版块在首页整个消失}
              - {label: 条数, name: count, widget: number, value_type: int, required: false}
          - label: 会员单位（LOGO 墙）
            name: membersWall
            widget: object
            fields:
              - {label: 标题, name: title, widget: string, required: false}
              - {label: 条数, name: count, widget: number, value_type: int, required: false, hint: ⚠ 只展示前几家，其余在「会员名录」页里（版块右上角「查看名录」）。填 0 = 全部展示。数据来自「会员天地 / 会员单位」的内容页，不是文章。⚠ 墙是自动分列的，列数随窗口宽度变，所以填 9 在宽屏上可能是「一行 7 家 + 第二行 2 家」，不是齐整的一行}
          - label: 会员动态（整行）
            name: membersNews
            widget: object
            fields:
              - {label: 取哪个栏目, name: section, widget: select, options: ${sectionSelect}, hint: ⚠ 选错不会报错，只会让这个版块在首页整个消失}
              - {label: 条数, name: count, widget: number, value_type: int, required: false, hint: 整行宽度能排下多列，可比上面几张卡多给几条}
      # ----------------------------------------------------------------------
      - name: friendlinks
        label: ③ 友情链接（首页底部）
        file: data/friendlinks.yaml
        # ⚠ 下面的字段名必须与 data/friendlinks.yaml 的顶层键完全一致：
        #   模板 layouts/partials/home/friendlinks.html 直接把这些键当分组标题渲染。
        #   改标题要同时改 YAML 与本文件两处，否则后台存回去会把分组弄丢。
        fields:
          - label: 协会站点
            name: 协会站点
            widget: list
            required: false
            field: {label: 链接, name: item, widget: object, fields: [{label: 名称, name: name, widget: string}, {label: 网址, name: url, widget: string}]}
          - label: 企业站点
            name: 企业站点
            widget: list
            required: false
            field: {label: 链接, name: item, widget: object, fields: [{label: 名称, name: name, widget: string}, {label: 网址, name: url, widget: string}]}
          - label: 政府站点
            name: 政府站点
            widget: list
            required: false
            field: {label: 链接, name: item, widget: object, fields: [{label: 名称, name: name, widget: string}, {label: 网址, name: url, widget: string}]}

      # ----------------------------------------------------------------------
      - name: partners
        label: ④ 合作机构（首页右栏）
        file: data/partners.yaml
        fields:
          - label: 机构列表
            name: partners
            widget: list
            required: false
            field:
              label: 机构
              name: item
              widget: object
              fields:
                - {label: 名称, name: name, widget: string}
                - {label: 标志图片, name: logo, widget: image, required: false, hint: 留空时前台渲染文字块}
                - {label: 网址, name: url, widget: string, required: false}
`;

/*
  会员排序：一份名单决定所有会员展示的先后。

  为什么单独一个集合：Decap 的 list 控件只能排**同一个条目内**的列表，集合之间
  的条目没有"拖拽换位"这种能力。所以"调整会员位置"必须落到某个文件里的一份
  名单上，再由 layouts/partials/components/member-pages.html 统一消费 ——
  首页 LOGO 墙、会员名录页、页脚名录三处共用它，顺序不可能分叉。

  为什么是 list + 一个 relation 字段（2026-09-27 改，起因是编辑者反馈"排序手感
  非常差"）：上一版用的是 `widget: relation` + `multiple: true`，已选会员渲染成
  一排 **chip**，只能拖那个小方块本身（× 号旁边、空白处都不行，还得先点中它
  才能用键盘的 dnd-kit 通道）。chip 又小又挤，一屏二十个会员根本拖不动。

  现在每一项是**一整行**（实测 624x75px）：行左侧是 list 自己的拖拽把手
  （18x26px，**拖拽只认这个把手**，拖行内其他地方只会响应下拉框），行内是一个
  可搜索的下拉框 —— 输入公司名就能选，仍然不用手打网址别名。
  ⚠ `field:` 是**单数**：单数字段表示"每一项就是这个字段的值"，所以存盘形状
    仍然是 slug 字符串数组（与旧版一模一样），模板和 scripts/sync-member-order.mjs
    都不必改。写成复数 `fields:` 会让每一项变成对象，形状就变了 —— 别顺手改。
    这个"存的是 slug 数组"是前台排序的依据，改形状要同步改三处消费方。

  ⚠ 存进去的是 value_field 指定的字段值，这里是 slug（网址别名）。所以每个
    会员文件都必须有 slug 字段。老会员文件（scripts/import-members.mjs 早期
    版本生成的）没有写 slug，已于 2026-09 补齐；该脚本也已改成会写 slug。

  ⚠ 降级方案：万一 relation 在本地后端下不工作（它要查集合列表），把那三行
    relation 参数换成
        widget: string
    存的数据形状完全一样（还是 slug 字符串数组），模板一个字都不用改，
    代价只是编辑要手打网址别名。
*/
const memberOrder = `
  # --------------------------------------------------------------------------
  #  ⚠ 这是**顶层集合**，缩进必须与上面的文章集合齐平（2 格）。
  #    写成 6 格会被 YAML 当成上一个集合的嵌套内容吞掉 —— 不报错，
  #    只是左栏里少一项、集合总数不变。改缩进后请数一遍左侧列表。
  # --------------------------------------------------------------------------
  - name: members-order
    label: 会员排序
    description: 一行一个会员，抓住行左侧的把手上下拖就能改顺序。首页 LOGO 墙、会员名录页、页脚会员名录三处都按这个顺序排。没有列在这里的会员不会被隐藏，它们排在名单之后。
    files:
      - name: order
        label: 会员排序（拖动调整）
        file: data/members_order.yaml
        fields:
          - label: 顺序
            name: order
            widget: list
            required: false
            default: []
            hint: '一行一个会员。**改顺序：按住左边那个点状的小把手（⋮⋮）上下拖**——只有这个把手能拖，按在行里其他地方会变成打开下拉框。每行本身是一个可搜索的下拉框，显示的是公司全称，输入公司名就能换人，不用手打网址别名。改完点右上角「保存」才会生效（保存后前台立刻变序）。没列出来的会员不会消失 —— 它们排在名单之后，按「排序权重」。⚠ 保存会重写整个 data/members_order.yaml，文件里的注释会丢；想找回注释跑 npm run members:order。'
            field:
              label: 会员
              name: item
              widget: relation
              collection: members-directory
              value_field: slug
              search_fields: [title, linkTitle]
              display_fields: [title]
              multiple: false
`;

/*
  拼接顺序 = CMS 左侧栏的显示顺序。首页排最前，与导航一致。
*/
let body = rules;
body += home;
body += aboutSection;
for (const { group, items } of sections) {
  body += `\n  # ==========================================================================\n  #  ${group}（${items.length} 个文章集合）\n  # ==========================================================================\n`;
  for (const item of items) {
    body += collection(item, group);
    /* 「会员排序」紧跟「会员单位」，因为排的就是它的条目。 */
    if (item.members) body += memberOrder;
  }
}

writeFileSync(out, body, 'utf8');

/*
  左栏的分组缩进与组标题。与 config.yml 同源（同一张 sections 表），
  由 static/admin/index.html 用 <link> 引入。
*/
const cssOut = path.join(repoRoot, 'static', 'admin', 'sidebar-groups.css');
writeFileSync(cssOut, sidebarGroupsCss(), 'utf8');

const countBy = (fn) => sections.reduce((n, s) => n + s.items.filter(fn).length, 0);
const articleTotal = countBy((i) => !i.members);
const memberTotal = countBy((i) => i.members);
console.log(`已生成 ${out}`);
console.log(`已生成 ${cssOut}`);
console.log(`  首页 1 个（含 4 个文件）+ 关于我们 1 个（含 5 个文件）`);
console.log(`  文章集合 ${articleTotal} 个 + 会员集合 ${memberTotal} 个`);
