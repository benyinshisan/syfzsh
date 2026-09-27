---
# 通用兜底模板。发文章用 archetypes/news.md，录会员用 archetypes/members.md ——
# 那两个带完整注释（每个字段出现在前台哪里、图该放哪）。这个只在没想好用哪个时兜底。
# ⚠ 模板只在命令行建稿时生效：./hugo.exe new content news/notice/xxx.md
#   后台（/admin/）新建不读这里，后台表单由 scripts/gen-cms-config.mjs 生成。
title: "{{ replace .File.ContentBaseName "-" " " | title }}"

# 网址别名。必填，只能小写字母、数字、连字符。⚠ 发表后别改，改了等于换网址。
slug: ""

date: {{ .Date }}
lastmod: {{ .Date }}
draft: true
summary: ""

# categories 必须填所属一级栏目的目录名（news / members / policy / party），
# Decap CMS 靠它过滤本栏目的文章列表；填错会导致文章在后台列表里"消失"。
categories: []
tags: []
# image: "/uploads/news/xxxx.jpg"   # 「列表封面图」：列表小图 / 首页轮播 / 正文上方。留空则渲染 CSS 占位块
# featured: true                    # 加入首页"图片新闻"轮播
---

正文内容……
