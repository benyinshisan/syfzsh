---
# 会员单位（公司）的模板 —— 只用于 content/members/directory/ 下的条目
#
# ⚠ 这个文件只在命令行建稿时生效：
#     ./hugo new content members/directory/qiye-mingcheng.md
#   直接用编辑器新建文件当然也可以 —— 把下面的字段与注释照抄过去即可。
#   批量录一份名单用：node scripts/import-members.mjs --from 名单.txt
#
# 会员是「条目」不是「文章」：没有标签、来源、首页轮播、草稿这些字段，
# 网址也是长期稳定的（/members/directory/<别名>/，不带日期）。
title: "{{ replace .File.ContentBaseName "-" " " | title }}"   # 工商登记全称

# 网址别名。必填，只能小写字母、数字、连字符。
# ⚠ 已收录的会员别改，改了首页 LOGO 墙与会刊上的链接都会失效。
slug: ""

# 单位简称。首页 LOGO 墙与名录卡片上的短名，留空则显示全称。
# linkTitle: ""

# ---- 单位 LOGO -----------------------------------------------------------
# 建议方形或横版图，前台按 contain 缩放不裁切。
# 它会出现在**三处**：名录卡片、首页 LOGO 墙、会员页页头。
# 图上传后放在 assets/uploads/members/，这里填 /uploads/members/xxx.png
# 留空时渲染占位块，不会出现破图。
image: ""

# 单位类型 / 所属行业，显示在名录卡片上，如「批发零售」「装备制造」
# industry: ""

# 一句话简介，名录卡片与会员页名片上显示，建议 40 字以内
# summary: ""

# ---- 三个图片分区 --------------------------------------------------------
# 与上面的 LOGO、与正文插图都是**分开的**：这三组图各带自己的说明，
# 在每一家会员页上都出现在同一个位置（企业简介的下方），按网格排。
# 没有图就留空数组，前台整块不输出，不会留下空标题。
#
# 落盘目录与引用路径（三个分区各不相同，别填串）：
#   photosEnv      → assets/uploads/members/env/      → /uploads/members/env/xxx.jpg
#   photosProduct  → assets/uploads/members/product/  → /uploads/members/product/xxx.jpg
#   photosHonor    → assets/uploads/members/honor/    → /uploads/members/honor/xxx.jpg
#
# 写法（每一项一张图，caption 可以留空）：
# photosEnv:
#   - image: /uploads/members/env/mendian.jpg
#     caption: 门店外景
#   - image: /uploads/members/env/chejian.jpg
#     caption: 生产车间
photosEnv: []       # 企业环境 / 门店实拍
photosProduct: []   # 产品 / 案例图
photosHonor: []     # 资质 / 荣誉（⚠ 公示证照前先征得企业同意）

# website: ""       # 企业官网，完整地址含 https://
# contact: ""       # 联系人
# phone: ""         # 联系电话
# address: ""       # 单位地址

date: {{ .Date }}

# 排序权重：**会员展示顺序的唯一来源**（首页 LOGO 墙 / 名录页 / 页脚名录三处
# 共用 layouts/partials/components/member-pages.html，它直接返回 Hugo 的原生
# 排序＝weight 升序 → date 降序 → linkTitle）。
# 约定：**互不相同的正整数，并留空隙**（10、20、30……），插队时取空位即可。
# ⚠ 实测坑：weight 写 0 或干脆不写，Hugo 会把该页排在**所有正权重之后**，不是
#   最前 —— 想让这位会员排第一，得给它一个比所有人都小的正整数。
# 新建时先看一眼名录里最后一位的 weight，取比它大 10 的值。
weight: 100

# ⚠ 固定为 member，不要改：它决定前台用 layouts/member/single.html 渲染，
#   并让会员页不被当成文章混进 /members/ 的文章列表。
type: member
---

<!--
  这里是「企业简介」正文：经营范围、主要产品、合作意向等。
  插图方式与新闻完全一样，图片独占一段，引号里可选 center / wide / left / right：

      ![车间全景](/uploads/members/product/chejian.jpg)
      ![产品特写](/uploads/members/product/xinghao-a.jpg "left")

  ⚠ 但**厂区、门店、产品、证书这类「一组成组」的图，请填在上面的三个
    photosXxx 字段里**，不要塞进正文 —— 放在字段里前台会排成整齐的网格，
    而且顺序就是你写在字段里的先后，不用自己一张张调位置。
-->
