#!/usr/bin/env node
/**
 * 会员名单 → 会员内容页（一次性 / 可重复运行）
 *
 * 背景：会员原先只是 data/members.yaml 里的一串名字。数据文件**不产生页面**，
 * 所以那种形态下会员拿不到独立网址、也没有 LOGO / 简介的位置。改成
 * content/members/directory/<slug>.md 之后，每个会员是一个正常内容页：
 * 有网址、能直接改文件、会进站内搜索。
 *
 * 用法：
 *   node scripts/import-members.mjs --from 名单.txt      # 读纯文本，一行一个
 *   node scripts/import-members.mjs --from 名单.yaml     # 读 data/members.yaml 那种格式
 *   node scripts/import-members.mjs --dry-run           # 只打印将生成什么
 *   node scripts/import-members.mjs --force             # 覆盖已存在的会员页
 *
 * ⚠ 没有默认输入文件：迁移用的 data/members.yaml 已随改版删除（会员名单现在
 *   就是这些内容页本身）。要批量导入新名单，先把名单存成文本文件再 --from。
 *
 * 两种输入格式：
 *   YAML  取顶层 members: 下的列表项（只认 "…" / '…' / 裸值 三种写法）
 *   TXT   一行一个名称，# 开头为注释；想自己指定网址别名就写「名称|slug」
 *
 * ⚠ 默认**不覆盖**已存在的文件：会员页一旦补过 LOGO / 简介，重跑本脚本不该把它
 *   冲掉。确实要重建用 --force。
 * ⚠ 默认 slug 是 member-01 这样的序号，网址会是 /members/directory/member-01/。
 *   建议趁早改成有意义的别名（如 lanzhou-maoyi）——**发布后改别名等于换网址**，
 *   原有链接会失效。改别名只需改 front matter 里的 `slug:`（文件名不必跟着改）。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'content', 'members', 'directory');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const dryRun = flag('dry-run');
const force = flag('force');
const from = opt('from') ? path.resolve(repoRoot, opt('from')) : null;

if (!from) {
  console.error('✗ 请用 --from 指定名单文件，例如：');
  console.error('    node scripts/import-members.mjs --from 会员名单.txt');
  console.error('  （一行一个企业名；想自己定网址别名就写「企业名|slug」）');
  process.exit(1);
}

if (!existsSync(from)) {
  console.error(`✗ 找不到输入文件：${from}`);
  process.exit(1);
}

/** 把任意字符串写成安全的 YAML 双引号标量（JSON 的转义规则是 YAML 双引号风格的子集） */
const yamlStr = (s) => JSON.stringify(String(s));

function parseYamlList(text) {
  const names = [];
  let inMembers = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trimEnd();          // 去掉行尾注释
    if (!line.trim()) continue;
    if (/^\S/.test(line)) {                                   // 顶格 = 顶层键
      inMembers = /^members\s*:/.test(line.trim());
      continue;
    }
    if (!inMembers) continue;
    const m = line.match(/^\s*-\s*(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
    if (v) names.push(v);
  }
  return names;
}

function parseTextList(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);
}

const isYaml = /\.ya?ml$/i.test(from);
const raw = readFileSync(from, 'utf8');
const entries = (isYaml ? parseYamlList(raw) : parseTextList(raw)).map((line, i) => {
  const [name, slug] = line.split('|').map((s) => (s || '').trim());   // 允许「名称|slug」
  return { name, slug: slug || `member-${String(i + 1).padStart(2, '0')}` };
});

if (!entries.length) {
  console.error(`✗ 没解析出任何会员名称（输入：${from}）。YAML 需形如 members: 下一行 \"名称\"。`);
  process.exit(1);
}

const badSlug = entries.filter((e) => !/^[a-z0-9][a-z0-9-]*$/.test(e.slug));
if (badSlug.length) {
  console.error(`✗ 以下网址别名不合法（只能小写字母/数字/连字符）：${badSlug.map((e) => e.slug).join(', ')}`);
  process.exit(1);
}

/*
  排序权重：会员的展示顺序（首页 LOGO 墙 / 名录页 / 页脚名录）**只由各会员页的
  weight 决定**，见 layouts/partials/components/member-pages.html。约定是正整数、
  互不相同、且留空隙（10、20、30……），所以这里接在**现有最大值之后**按 10 递增，
  新导入的会员一律排在末尾，也不会与已有会员撞号。
  ⚠ weight 写 0 或不写会被 Hugo 排到所有正权重之后 —— 那就不是「排末尾」而是
    「和所有没写 weight 的挤在一起」，所以必须显式写正整数。
*/
function nextBaseWeight() {
  if (!existsSync(outDir)) return 10;
  let max = 0;
  for (const name of readdirSync(outDir)) {
    if (!name.endsWith('.md') || name.startsWith('_')) continue;   // _index.md 是栏目页，不参与
    const m = readFileSync(path.join(outDir, name), 'utf8').match(/^weight:\s*(\d+)\s*$/m);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 10;
}

/*
  收录日期用**运行当天**，不能写死也不能只写日期：
    · 写死 → 换一份名单重跑时，日期还是旧的；
    · 只写 2026-09-27 → Hugo 当成 UTC 午夜，在 UTC+8 就是当天 08:00 之前
      构建时属于「未来文章」而被静默丢弃 —— 表现是刚导入的会员页不出现，
      构建日志里一个字都没有。
（上面这两条与排序无关，别顺手删。）
*/
const pad = (n) => String(n).padStart(2, '0');
const today = new Date();
const stamp = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00:00+08:00`;

const page = ({ name, slug }, weight) => `---
title: ${yamlStr(name)}
slug: ${slug}
linkTitle: ${yamlStr(name)}
type: member
date: ${stamp}
weight: ${weight}
summary: "占位会员单位，正式发布前请替换为真实企业信息。"
# ---- 以下字段留空不影响构建，补上后前台自动显示 ----
# image: "/uploads/members/example.png"   # 企业 LOGO，留空时渲染 CSS 占位块
# industry: "批发零售"                     # 单位类型 / 所属行业
# website: "https://example.com"           # 企业官网
# contact: "张三"                          # 联系人
# phone: "0931-00000000"                   # 联系电话
# address: "兰州市…"                       # 单位地址
---

此处于「会员天地 / 会员单位」的企业介绍。

> 本文为占位内容，直接修改 \`content/members/directory/${slug}.md\` 即可。
> 发布前请替换为真实企业信息。
`;

if (!dryRun && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });

let created = 0, skipped = 0;
/* 只算一次：以现有会员的最大 weight 为基准，本批新建的依次 +10 */
const baseWeight = nextBaseWeight();
for (const [i, entry] of entries.entries()) {
  const file = path.join(outDir, `${entry.slug}.md`);
  if (existsSync(file) && !force) {
    skipped++;
    console.log(`· 跳过（已存在）  ${path.relative(repoRoot, file)}`);
    continue;
  }
  if (dryRun) {
    console.log(`· 将生成 ${entry.name}  →  content/members/directory/${entry.slug}.md  (weight: ${baseWeight + i * 10})`);
    continue;
  }
  writeFileSync(file, page(entry, baseWeight + i * 10), 'utf8');
  created++;
}

console.log(
  dryRun
    ? `\n[dry-run] 共 ${entries.length} 条，未写入任何文件。`
    : `\n✓ 新建 ${created} 个会员页，跳过 ${skipped} 个已存在的。\n  目录：${path.relative(repoRoot, outDir)}/`
);
if (created) {
  console.log('  下一步：逐个补 LOGO / 行业 / 简介（直接改文件，见 WRITING.md），');
  console.log('         并把 member-01 这类序号别名改成有意义的网址别名（发布后改会换网址）。');
}
