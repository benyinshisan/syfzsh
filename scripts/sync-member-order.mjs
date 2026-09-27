#!/usr/bin/env node
/**
 * 会员展示顺序名单 → 与现有会员对齐（可重复运行）
 *
 * 背景：data/members_order.yaml 是**所有**会员展示的唯一顺序来源
 * （首页 LOGO 墙 / 会员名录页 / 页脚会员名录，消费方见
 *  layouts/partials/components/member-pages.html）。
 *
 * 它平时在后台「会员天地 → 会员排序」里拖拽维护。但后台**保存会整个重写这个
 * 文件**，文件顶部的注释说明会被抹掉；另外手动加过会员、或删过会员之后，名单
 * 也可能与实际会员对不上。这个脚本就干两件事：
 *
 *   1) 清掉名单里已经**不存在**的会员（别名写错、或会员已删）；
 *   2) 把**没进名单**的会员按现有顺序补到末尾；
 *   3) 顺带把注释说明重新写回去。
 *
 * 用法：
 *   npm run members:order              # 就地更新
 *   npm run members:order -- --dry-run # 只打印会改什么，不落盘
 *
 * ⚠ 只动 data/members_order.yaml，不碰任何会员内容页。
 * ⚠ 「补到末尾」用的顺序必须与「没有名单时前台的表现」一致，否则跑一次脚本就会
 *   把会员的位置换掉。前台那份顺序由 Hugo 的默认页面排序决定（member-pages.html
 *   把名单之外的会员直接接在后面，不再自己排），Hugo 0.166 实测为：
 *       有权重的按权重升序 → 没写权重的排在有权重的之后 → 日期新的在前 → 简称升序
 *   （实测方式：临时建 5 个内容页，权重/日期/简称各造一组并列，看版块页输出。
 *    注意「没写 weight 的排最后」这一条 —— 与「weight 不写就是 0 排最前」相反。）
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const membersDir = path.join(repoRoot, 'content', 'members', 'directory');
const orderFile = path.join(repoRoot, 'data', 'members_order.yaml');

const dryRun = process.argv.slice(2).includes('--dry-run');

/* ---------- 1. 现有哪些会员 ---------- */

/** 确定性字符串比较。不用 localeCompare：它的结果随运行机器的 locale 变，
    同一份内容在两台电脑上可能排出不同顺序，而这份名单是要进 git 的。 */
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

/** 一次读出本脚本需要的四个字段（原先每个字段各读一遍文件） */
function metaOf(file) {
  const text = readFileSync(path.join(membersDir, file), 'utf8');
  const fm = text.split(/^---\s*$/m)[1] || '';
  const pick = (key) => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '') : '';
  };
  const rawWeight = pick('weight');
  const time = Date.parse(pick('date'));
  return {
    file,
    slug: pick('slug') || file.replace(/\.md$/, ''),   // 与 Hugo 一致：没有 slug 就退回文件名
    weight: rawWeight === '' ? Number.POSITIVE_INFINITY : Number(rawWeight),
    time: Number.isNaN(time) ? 0 : time,               // 没写日期 = 最旧，在「新的在前」里排最后
    linkTitle: pick('linkTitle') || pick('title') || file.replace(/\.md$/, ''),
  };
}

const metas = readdirSync(membersDir)
  .filter((f) => f.endsWith('.md') && f !== '_index.md')
  .map(metaOf)
  .sort((a, b) => {
    if (a.weight !== b.weight) return a.weight - b.weight;
    if (a.time !== b.time) return b.time - a.time;
    const byTitle = cmp(a.linkTitle, b.linkTitle);
    return byTitle !== 0 ? byTitle : cmp(a.file, b.file);
  });

const files = metas.map((m) => m.file);
const slugToFile = new Map(metas.map((m) => [m.slug, m.file]));
const existing = new Set(slugToFile.keys());

/* ---------- 2. 名单里现在写了什么 ---------- */

const current = readFileSync(orderFile, 'utf8');
const listed = [];
let inOrder = false;
for (const line of current.split(/\r?\n/)) {
  if (/^order:\s*$/.test(line)) { inOrder = true; continue; }
  if (!inOrder) continue;
  const m = line.match(/^\s+-\s*(.+?)\s*$/);
  if (m) listed.push(m[1].replace(/^["']|["']$/g, ''));
}

const kept = listed.filter((s) => existing.has(s));
const dropped = listed.filter((s) => !existing.has(s));
const added = metas.map((m) => m.slug).filter((s) => !listed.includes(s));
const seen = new Set();
const final = [];
for (const s of [...kept, ...added]) {
  if (!seen.has(s)) { seen.add(s); final.push(s); }   // 名单里的重复项也顺手去掉
}

/* ---------- 3. 报告 ---------- */

console.log(`会员内容页 ${files.length} 个，名单里 ${listed.length} 条`);
if (dropped.length) console.log(`· 剔除失效条目（会员已删或别名写错）：${dropped.join(', ')}`);
if (added.length) console.log(`· 补进名单（排在末尾）：${added.join(', ')}`);
if (!dropped.length && !added.length) console.log('· 名单已经是最新的，无需改动');
if (dryRun) { console.log('（--dry-run，未写盘）'); process.exit(0); }

/* ---------- 4. 写回（含注释说明，等于把被后台抹掉的注释找回来） ---------- */

const body = `# ============================================================================
#  会员展示顺序 —— 一份名单决定**所有**会员展示的先后
#  ----------------------------------------------------------------------------
#  被这份名单驱动的三处（都由 layouts/partials/components/member-pages.html
#  统一取数，所以不可能出现三处顺序不一致）：
#      · 首页「会员单位」LOGO 墙
#      · 会员名录页 /members/directory/
#      · 页脚「会员名录」滚动条
#
#  后台维护方式：「会员天地 → 会员排序」，下拉选会员、拖动改顺序。
#  也可以直接改本文件 —— 但**每一条都必须与会员文件的 slug 字段逐字一致**。
#
#  ⚠ 没写进这份名单的会员**不会丢**：它们按原来的排序权重排在名单之后。
#     所以新录的会员一定会出现在名录里，想让它靠前再拖上去。
#  ⚠ 写错的条目会被忽略，并在 hugo 构建时打一条 WARNING（不会静默通过）。
#     查 WARNING：npm run build，或在 npm run dev 的窗口里看。
#  ⚠ 想让名单与现有会员对齐（补进新会员、清掉已删的）：
#         npm run members:order
#
#  ⚠ 本文件每次由后台保存都会被整个重写，上面的注释会丢 —— 那之后跑一次
#     npm run members:order 就能把注释和名单一起理回来。
# ============================================================================
order:
${final.map((s) => `  - ${s}`).join('\n')}
`;

writeFileSync(orderFile, body, 'utf8');
console.log(`✓ 已写入 data/members_order.yaml（${final.length} 条）`);
