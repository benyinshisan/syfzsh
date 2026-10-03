---
# 通用兜底模板。发文章用 archetypes/news.md，录会员用 archetypes/members.md ——
# 那两个带完整注释（每个字段出现在前台哪里、图该放哪）。这个只在没想好用哪个时兜底。
# ⚠ 模板只在命令行建稿时生效：./hugo new content news/notice/xxx.md
#   直接用编辑器新建文件当然也可以 —— 把下面这些字段与注释照抄过去即可。
title: "{{ replace .File.ContentBaseName "-" " " | title }}"

# 网址别名。必填，只能小写字母、数字、连字符。⚠ 发表后别改，改了等于换网址。
slug: ""

date: {{ .Date }}
lastmod: {{ .Date }}
draft: true
summary: ""

tags: []
# image: "/uploads/news/xxxx.jpg"   # 「列表封面图」：列表小图 / 首页轮播 / 正文上方。留空则渲染 CSS 占位块
# featured: true                    # 加入首页"图片新闻"轮播
---

正文内容……
