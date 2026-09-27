---
# 会员单位（公司）的模板 —— 只用于 content/members/directory/ 下的条目
#
# ⚠ 这个文件只在命令行建稿时生效：
#     ./hugo.exe new content members/directory/qiye-mingcheng.md
#   后台（/admin/）新建会员**不读**这里 —— 后台表单由
#   scripts/gen-cms-config.mjs 生成，字段顺序与下面的注释一一对应。
#   日常录名单走后台即可，两种写法产出的 front matter 是一样的。
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

# 排序权重：**不用填**，后台表单里也已经看不到这一项了。
# 会员的展示顺序（首页 LOGO 墙 / 名录页 / 页脚名录）由后台
# 「会员天地 → 会员排序」那份可拖拽名单统一决定，见 CMS.md §5.2。
# 它只剩一个兜底作用：没排进名单的会员按 weight 排序，而新录的会员没有 weight，
# 所以一律落在末尾 —— 这正是我们要的，因此不要填。
# weight: 100

# 一级栏目的目录名。不要改。
categories: [members]

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
    而且顺序可以拖动调整；塞进正文得自己一张张调位置。
-->
