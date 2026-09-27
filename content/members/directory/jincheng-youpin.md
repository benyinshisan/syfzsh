---
# ============================================================================
#  示例会员页（版式范例）
#  ----------------------------------------------------------------------------
#  ⚠ 这是一家**虚构**的企业，用来演示会员页的字段与三组图片该怎么填。
#    企业名称、成立时间、联系方式、网址均为编造；照片来自 Pexels 免费图库，
#    是「示意图」而不是这家公司真实的门店/产品/证书。
#    正式发布前请**删除本文件**，或把它替换成真实会员的信息：
#        rm content/members/directory/jincheng-youpin.md
#        npm run members:order     ← 别漏这步：它在「会员排序」名单里占了位，
#                                    不跑的话名单里会留一条对不上的条目，构建会打 WARN
#    图片来源清单见 WRITING.md 第七节（其中「线下门店」一张是 CC BY-SA 3.0，
#    必须在页面上署名 —— 那行署名在正文末尾，换图后请一并删掉）。
#
#  字段与 layouts/member/single.html 一一对应，模板里没填的字段整行不渲染。
# ============================================================================
title: 甘肃金城优品商贸有限公司

# 网址别名。决定前台网址 /members/directory/jincheng-youpin/
slug: jincheng-youpin

# 单位简称：首页 LOGO 墙与名录卡片上的短名
linkTitle: 金城优品

date: 2026-09-27T09:00:00+08:00

# 单位 LOGO。三处使用：名录卡片、首页 LOGO 墙、本页页头。
# 本站占位图，纯图形、不含任何真实机构信息。
image: /uploads/members/jincheng-youpin-logo.png

# 单位类型 / 所属行业
industry: 商贸流通 / 特色农产品

# 一句话简介：名录卡片与会员页名片上显示
summary: 兰州本土特色农产品供应链企业，主营苦水玫瑰、兰州百合等西北特产的收购、分级、加工与销售，供货商超、电商与单位食堂。

# ---- 三组图片 --------------------------------------------------------------
# 每张图各自带说明，前台在企业简介下方按网格展示，顺序即下面的顺序。
photosEnv:
  - image: /uploads/members/env/fenjian-chejian.jpg
    caption: 分拣加工车间
  # ⚠ 「仓储物流中心」那张没放在这里，而是放在下面正文里当「加宽通栏」的示范
  #   —— 同一张图既进网格又进正文会让人以为是填重了。一张图只用一处。
  - image: /uploads/members/env/xianshang-mendian.jpg
    caption: 线下门店
  - image: /uploads/members/env/lenglian-zhanlan.jpg
    caption: 冷链展示柜
photosProduct:
  - image: /uploads/members/product/techan-zhuanqu.jpg
    caption: 特产专区陈列
  - image: /uploads/members/product/kushui-meigui.jpg
    caption: 苦水玫瑰（干花）
  - image: /uploads/members/product/hongzao-ganhuo.jpg
    caption: 西北红枣
photosHonor:
  # ⚠ 资质/荣誉是最敏感的一组：公示证照前务必先征得企业同意。
  #   这里只放一张「荣誉奖杯」的示意图，是因为图库里没有、也不该有这家
  #   公司的真实证照 —— 真实会员的这一组，必须由企业自己提供。
  - image: /uploads/members/honor/rongyu-jiangbei.jpg
    caption: 荣誉奖杯陈列（示意图）

website: https://example.com
contact: 王经理
phone: 0931-0000000
address: 甘肃省兰州市城关区示意路 000 号

categories:
  - members
type: member
---

> **本页是版式范例（示例企业，非真实会员）。** 企业名称、成立时间、联系方式与图片
> 均为虚构或示意图，只用于对照填写格式。正式发布前请删除本页，或替换为真实会员信息。

甘肃金城优品商贸有限公司成立于 2016 年，是一家立足兰州的西北特色农产品供应链企业。
公司围绕苦水玫瑰、兰州百合、高原夏菜等地方特色农产品，做收购、分级、加工与销售
的全链条经营，目前为省内多家商超、电商平台与企事业单位食堂稳定供货。

公司现有仓储与分拣场地约 3000 平方米，建有低温冷藏库与净菜加工线各一条；
玫瑰系列产品（干花、花茶、糕点原料）已形成稳定的商品线，可按客户要求做贴牌与礼盒定制。

![仓储物流中心](/uploads/members/env/cangchu-wuliu.jpg "wide")

合作方式、供货品类与报价，欢迎通过本页下方的联系方式洽谈。

---

图片来源：本页照片均为图库示意图，不是这家公司的实拍，仅用于演示版式。
其中「线下门店」一张取自维基共享资源
[Chinese supermarket.jpg](https://commons.wikimedia.org/wiki/File:Chinese_supermarket.jpg)
（上传者 Bartux~commonswiki，**CC BY-SA 3.0**，须署名）；其余为 Pexels 免费图库，
无需署名。完整清单见 `WRITING.md` 第七节。
