#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import-legacy.py — 把"另存为"下来的旧站 HTML 页面转换成 Hugo 的 content / data 文件。

用法:
    python3 scripts/import-legacy.py <legacy-index.html> [--dry-run]

它做四件事：
  1. 抽取首页各版块的新闻条目  -> content/<section>/<sub>/<id>.md
  2. 抽取会员名录表            -> data/members.yaml
  3. 抽取友情链接下拉框        -> data/friendlinks.yaml
  4. 抽取"协会链接"图片位      -> data/partners.yaml

脚本是幂等的：重复运行只会覆盖自己生成的 .md 文件，不会碰手写的 _index.md。
"""

import argparse
import datetime
import os
import re
import sys
import unicodedata
from collections import OrderedDict

# --------------------------------------------------------------------------
# 旧站版块 -> Hugo 内容目录的映射
# 旧站用一串 .htm 文件名编码栏目：slhdt4001.htm = 栏目 slhdt 下的 4001 子栏目。
# --------------------------------------------------------------------------
SECTIONS = {
    # key            hugo 路径                     中文名
    "about":         ("about",                      "关于浙商联"),
    "news":          ("news",                       "浙商联动态"),
    "industry":      ("industry",                   "行业动态"),
    "policy":        ("policy",                     "政策法规"),
    "members":       ("members",                    "会员天地"),
    "party":         ("party",                      "党群建设"),
    "standards":     ("standards",                  "标准化工作"),
    "services":      ("services",                   "服务中心"),
}

# 首页每个版块的数据来源 -> (hugo 目录, 默认分类)
HOME_REGIONS = {
    "featured":   ("news/association",   "news"),      # 图片新闻（轮播）
    "headline":   ("news/association",   "news"),      # 浙商联动态头条
    "topnews":    ("news/association",   "news"),      # 浙商联动态列表
    "notice":     ("news/notice",        "news"),      # 通知公告（滚动）
    "zjsd":       ("industry/headlines", "industry"),  # 综合要闻
    "szyw":       ("members/dynamics",   "members"),   # 会员动态
    "tab1":       ("industry/livelihood", "industry"), # 民生热点
    "tab2":       ("industry/experts",   "industry"),  # 专家视点
    "tab3":       ("policy/national",    "policy"),    # 政策法规/国家政策
    "tab4":       ("party/news",         "party"),     # 党建工作
}

# 旧站列表只显示 MM-DD，年份信息在下载时丢失。重建规则见 build_dates()。
# REF_DATE 是"今天"，用来保证重建出来的日期不会落到未来
# （Hugo 默认会丢弃未来日期的页面，会把内容吃掉）。
REF_DATE = datetime.date.today()

# 图片新闻在旧站是较早的文章，无日期时锚定到"当年 6 月"向外推
FEATURED_ANCHOR = (6, 20)


# --------------------------------------------------------------------------
# 小工具
# --------------------------------------------------------------------------
def strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)
    s = (s.replace("&nbsp;", " ").replace("&amp;", "&")
          .replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"'))
    return re.sub(r"\s+", " ", s).strip()


def yaml_str(s: str) -> str:
    """把任意字符串安全地写成 YAML 双引号标量。"""
    s = unicodedata.normalize("NFC", s or "")
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    s = s.replace("\r", " ").replace("\n", " ")
    return '"%s"' % s


class Item(object):
    __slots__ = ("lid", "title", "text", "date", "image", "region", "summary")

    def __init__(self, lid, title, text="", date=None, image=None,
                 region=None, summary=""):
        self.lid, self.title, self.text = lid, title, text
        self.date, self.image = date, image
        self.region, self.summary = region, summary

    def __repr__(self):
        return "<Item %s %s %s>" % (self.lid, self.date, self.title[:20])


def rows(html: str):
    return re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I)


LINK_RE = re.compile(
    r'<a\b([^>]*?)href="(html(\d+)\.htm)"([^>]*)>(.*?)</a>', re.S | re.I)
DATE_RE = re.compile(r"\[(\d{2})-(\d{2})\]")
IMG_RE = re.compile(r'src="(?:file/news|\.\./file/news)/([^"]+)"', re.I)
TITLE_RE = re.compile(r'title="([^"]*)"')


def parse_rows(html: str, region: str):
    """从一组 <tr> 里抽新闻条目（列表型版块）。"""
    out = []
    for tr in rows(html):
        m = LINK_RE.search(tr)
        if not m:
            continue
        attrs = m.group(1) + " " + m.group(4)
        tm = TITLE_RE.search(attrs)
        title = tm.group(1).strip() if tm else ""
        text = strip_tags(m.group(5))
        if not title:
            title = text
        dm = DATE_RE.search(strip_tags(tr))
        date = (int(dm.group(1)), int(dm.group(2))) if dm else None
        im = IMG_RE.search(tr)
        out.append(Item(lid=m.group(3), title=title, text=text, date=date,
                        image=im.group(1) if im else None, region=region))
    return out


def slice_between(html: str, start: str, end: str) -> str:
    i = html.find(start)
    if i < 0:
        return ""
    j = html.find(end, i + len(start))
    return html[i:j if j > 0 else len(html)]


# --------------------------------------------------------------------------
# 各版块解析
# --------------------------------------------------------------------------
def parse_featured(html: str):
    """图片新闻轮播：<ul class="sy_ban_p"><li>...</li></ul>"""
    block = slice_between(html, 'class="sy_ban_p"', "</ul>")
    out = []
    for li in re.findall(r"<li[^>]*>(.*?)</li>", block, re.S | re.I):
        m = LINK_RE.search(li)
        if not m:
            continue
        attrs = m.group(1) + " " + m.group(4)
        tm = TITLE_RE.search(attrs)
        pm = re.search(r"<p>(.*?)</p>", li, re.S | re.I)
        im = IMG_RE.search(li)
        out.append(Item(
            lid=m.group(3),
            title=(tm.group(1).strip() if tm else strip_tags(m.group(5))),
            text=strip_tags(pm.group(1)) if pm else "",
            image=im.group(1) if im else None,
            region="featured"))
    return out


def parse_headline(html: str):
    """浙商联动态头条：a#ContentPlaceHolder1_hyp1 + 后面一段摘要。"""
    m = re.search(
        r'<a\s+id="ContentPlaceHolder1_hyp1"([^>]*)href="html(\d+)\.htm"([^>]*)>(.*?)</a>',
        html, re.S | re.I)
    if not m:
        return None
    attrs = m.group(1) + " " + m.group(3)
    tm = TITLE_RE.search(attrs)
    seg = html[m.end():m.end() + 1200]
    sm = re.search(r"<td[^>]*>(.*?)\[详细\]", seg, re.S | re.I)
    summary = strip_tags(sm.group(1)) if sm else ""
    summary = re.sub(r"&nbsp;$", "", summary).strip()
    return Item(lid=m.group(2), title=tm.group(1).strip() if tm else "",
                text=strip_tags(m.group(4)), summary=summary,
                region="headline")


def parse_tabs(html: str):
    """四个切换页签 news_div_1..4 -> tab1..tab4，每个含 1 张图 + 1 个列表。"""
    out = {}
    for n in (1, 2, 3, 4):
        block = slice_between(html, '<div id="news_div_%d"' % n,
                              "<div id=\"news_div_%d\"" % (n + 1)
                              if n < 4 else "</td></tr>")
        if not block:
            block = slice_between(html, '<div id="news_div_%d"' % n, "</div>\n              <div")
        items = parse_rows(block, "tab%d" % n)
        # 页签里的主图（单独一张 <a><img></a>）挂到该页签第一条上
        im = IMG_RE.search(block)
        if im and items:
            items[0].image = im.group(1)
        out["tab%d" % n] = items
    return out


def parse_members(html: str):
    block = slice_between(html, 'id="ContentPlaceHolder1_dls"', "</table>")
    names, seen = [], set()
    for td in re.findall(r"<td[^>]*>(.*?)</td>", block, re.S | re.I):
        m = re.search(r'<a\b[^>]*title="([^"]*)"[^>]*>(.*?)</a>', td, re.S | re.I)
        if not m:
            continue
        name = m.group(1).strip()
        if name and name not in seen:
            seen.add(name)
            names.append(name)
    return names


def parse_friendlinks(html: str):
    """四个 <select>：协会站点 / 企业站点 / 政府站点 / 智囊站点。"""
    groups = OrderedDict()
    for sel in re.findall(r"<select\b.*?</select>", html, re.S | re.I):
        opts = re.findall(r"<option[^>]*value=\"([^\"]*)\"[^>]*>(.*?)</option>",
                          sel, re.S | re.I)
        if not opts:
            continue
        head = strip_tags(opts[0][1]).strip("= ")
        head = head or "友情链接"
        groups[head] = [{"name": strip_tags(t), "url": v}
                        for v, t in opts[1:] if v.strip()]
    return groups


def parse_partners(html: str):
    block = slice_between(html, 'background="images/fzjg_bg.jpg"', "</table>")
    out = []
    for m in re.finditer(
            r'<a\s+href="([^"]+)"[^>]*>\s*<img\s+src="file/news/([^"]+)"', block, re.I):
        out.append({"url": m.group(1).strip(), "logo": m.group(2).strip()})
    return out


# --------------------------------------------------------------------------
# 日期重建
#
# 旧站列表只显示 [MM-DD]，且按时间倒序排列，所以跨年时会出现"月份突然变大"
# （例如 07-22 → 03-04 → 10-29）。据此可以反推出真实年份：
# 从榜单第一条开始逐年向前走，一旦发现月份比上一条大，就把年份减一。
#
# 第一条的年份则用 REF_DATE（今天）校准：选最大的、使第一条不晚于今天的年份。
# 这样重建出来的日期永远不会落在未来 —— 否则 Hugo 会把它们当作"定时发布"
# 的页面直接丢掉。
# --------------------------------------------------------------------------
def base_year_for(first_mmdd, ref):
    if not first_mmdd:
        return ref.year
    year = ref.year
    if first_mmdd > (ref.month, ref.day):
        year -= 1
    return year


def build_dates(items, base_year):
    year, prev_month = base_year, None
    for it in items:
        if not it.date:
            continue
        mm, dd = it.date
        if prev_month is not None and mm > prev_month:
            year -= 1
        prev_month = mm
        it.date = (year, mm, dd)


# --------------------------------------------------------------------------
# 输出
# --------------------------------------------------------------------------
FM = """---
title: {title}
date: {date}
lastmod: {date}
draft: false
legacyId: {lid}
legacyUrl: "http://www.zjsm.org/html{lid}.htm"
summary: {summary}
{extra}categories: [{cat}]
---

{summary}

> 本条目由 `scripts/import-legacy.py` 从旧站首页自动抽取（原链接 `html{lid}.htm`）。
> 重新抓取正文后，用 `hugo new content` 或直接编辑本文件补充内容即可。
"""


def write_content(root, items, dry=False):
    written = 0
    for it in items:
        dest_dir, cat = HOME_REGIONS[it.region]
        d = os.path.join(root, "content", dest_dir)
        if not dry:
            os.makedirs(d, exist_ok=True)
        path = os.path.join(d, "%s.md" % it.lid)
        y, m, dd = it.date
        extra = ""
        if it.image:
            extra += 'image: "/uploads/news/%s"\n' % it.image
        if it.region == "featured":
            extra += "featured: true\ncarousel: true\n"
        if it.region == "headline":
            extra += "headline: true\n"
        summary = it.summary or it.text or it.title
        body = FM.format(title=yaml_str(it.title),
                         date="%04d-%02d-%02d" % (y, m, dd),
                         lid=it.lid, extra=extra, cat=cat,
                         summary=yaml_str(summary))
        if not dry:
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
        written += 1
    return written


def write_yaml(path, lines, dry=False, only_if_missing=False):
    """only_if_missing=True 用于人工校对过的数据文件（如 partners.yaml），
    首次导入时生成骨架，之后不再覆盖。加 --force 可强制重写。"""
    if dry:
        return
    if only_if_missing and os.path.exists(path):
        print("skip    : %s（已存在，人工校对过的数据；--force 可覆盖）"
              % os.path.relpath(path))
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(lines)


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="连人工校对过的 data/partners.yaml 也一并覆盖")
    ap.add_argument("--today", metavar="YYYY-MM-DD",
                    default=REF_DATE.isoformat(),
                    help="用于重建年份的参考日期（默认今天），"
                         "指定它可让重建结果可复现")
    a = ap.parse_args()
    a.today = datetime.date(*[int(x) for x in a.today.split("-")])

    html = open(a.html, encoding="utf-8", errors="replace").read()
    root = a.root

    # ---- 新闻 ----
    regions = OrderedDict()
    regions["featured"] = parse_featured(html)
    hl = parse_headline(html)
    if hl:
        regions["headline"] = [hl]

    top_block = slice_between(html, 'id="ContentPlaceHolder1_hyp1"', "</table>")
    regions["topnews"] = parse_rows(top_block, "topnews")

    regions["notice"] = parse_rows(
        slice_between(html, '<div id="demo10"', '<div id="demo11">'), "notice")
    regions["zjsd"] = parse_rows(
        slice_between(html, 'class="zjsd"', "</table>"), "zjsd")
    regions["szyw"] = parse_rows(
        slice_between(html, 'class="szyw"', "</table>"), "szyw")
    tabs = parse_tabs(html)
    for k, v in tabs.items():
        regions[k] = v

    # 合并去重：同一条新闻可能出现在多个版块，按 legacyId 归并
    merged, order = {}, []
    for name, items in regions.items():
        for it in items:
            if it.lid in merged:
                # 补充缺失的图片 / 摘要
                keep = merged[it.lid]
                if not keep.image and it.image:
                    keep.image = it.image
                if not keep.summary and it.summary:
                    keep.summary = it.summary
                continue
            merged[it.lid] = it
            order.append(it)

    # ---- 重建日期 ----
    ref = a.today
    base = {}

    # ① 有日期的条目：按榜单顺序逐年回溯
    for name, items in regions.items():
        canonical = [it for it in items if it.lid in merged]
        dated = [it for it in canonical if it.date]
        b = base_year_for(dated[0].date if dated else None, ref)
        base[name] = b
        build_dates(canonical, b)

    # ② 无日期的条目：从参考日往前逐条排，保证顺序与原站一致且不落在未来
    for name, items in regions.items():
        idx = 0
        for it in items:
            if it.lid not in merged or it.date:
                continue
            if name == "featured":
                # 图片新闻锚定到该年 6 月，避免挤掉"浙商联动态"的头条
                anchor = datetime.date(base.get("topnews", ref.year),
                                       FEATURED_ANCHOR[0], FEATURED_ANCHOR[1])
                d = anchor - datetime.timedelta(days=idx * 3)
            else:
                d = ref - datetime.timedelta(days=idx)
            it.date = (d.year, d.month, d.day)
            idx += 1

    n = write_content(root, order, a.dry_run)
    print("content : %d 篇 -> %d 个版块" % (n, len(HOME_REGIONS)))

    # ---- 会员名录 ----
    names = parse_members(html)
    lines = ["# 商联会会员（自动抽取自旧站首页）", "members:"]
    lines += ["  - %s" % yaml_str(x) for x in names]
    write_yaml(os.path.join(root, "data", "members.yaml"),
               "\n".join(lines) + "\n", a.dry_run)
    print("members : %d 家" % len(names))

    # ---- 友情链接 ----
    groups = parse_friendlinks(html)
    out = ["# 友情链接（自动抽取自旧站首页 <select>）"]
    for g, items in groups.items():
        out.append("%s:" % yaml_str(g).replace('"', "").strip())
        for it in items:
            out.append("  - name: %s" % yaml_str(it["name"]))
            out.append("    url: %s" % yaml_str(it["url"]))
    write_yaml(os.path.join(root, "data", "friendlinks.yaml"),
               "\n".join(out) + "\n", a.dry_run)
    print("links   : %d 组 / %d 条" % (len(groups), sum(len(v) for v in groups.values())))

    # ---- 协会链接（图片位） ----
    ps = parse_partners(html)
    out = ["# 协会链接 / 会员单位图片位（由 scripts/import-legacy.py 自动抽取）",
           "# 首次导入生成骨架后不再覆盖，请手工补全 name 字段。", "partners:"]
    for p in ps:
        out.append("  - logo: %s" % yaml_str("/uploads/news/" + p["logo"]))
        out.append("    url: %s" % yaml_str(p["url"]))
        out.append("    name: %s" % yaml_str("会员单位"))
    write_yaml(os.path.join(root, "data", "partners.yaml"),
               "\n".join(out) + "\n", a.dry_run,
               only_if_missing=not a.force)
    print("partners: %d 个" % len(ps))


if __name__ == "__main__":
    sys.exit(main())
