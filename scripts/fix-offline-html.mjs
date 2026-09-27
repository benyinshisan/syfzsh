#!/usr/bin/env node
/**
 * 双击可看版收尾 —— 对 public-local/ 的 HTML 做三处修整。
 *
 * 背景
 * ---------------------------------------------------------------------------
 * hugo.local.toml 打开了 relativeURLs + uglyURLs，路径层面已经能在 file:// 下
 * 跑通。但还有两类东西是 http:// 专属的，必须在这里补掉，否则「双击打开」
 * 得到的是一张没样式的裸页面。
 *
 * A. 去掉 integrity（否则 CSS/JS 被整份拦掉）★ 这个不修就完全没法看
 *    head.html:40 与 scripts.html:11 给 <link>/<script> 带了 SRI 摘要：
 *      <link rel="stylesheet" href="..." integrity="sha256-93sR/...">
 *    SRI 要求响应可读，而 file:// 的响应被浏览器当作不透明来源 —— 没法验证
 *    摘要，按规范只能拦掉整份资源。于是样式表和执行脚本双双失效。
 *    （本地离线包里 SRI 本来也没意义：它的用途是防 CDN 被篡改。）
 *
 * B. 目录式链接 → 目录里的 index.html
 *    header.html:24 / breadcrumb.html:6   {{ "/" | relURL }}        → ./
 *    header.html:11    params.topLinks     url = "/about/contact/"  → ./about/contact/
 *    sidebar.html:22   params.sideLinks    url = "/about/join/"     → ./about/join/
 *    section-head.html:27                  栏目路径字符串            → ./news/
 *    404.html:11-14    {{ "/news/" | relURL }}                      → ./news/
 *    这些是**模板里写死的字符串**，不是页面对象，丢不进 .RelPermalink，所以
 *    Hugo 加不上 .html。http:// 下没问题（服务器会把 /news/ 解析到 index.html），
 *    file:// 下浏览器只会列出目录清单。
 *
 * C. 目录式链接 → 同名 .html（uglyURLs 兜底）★ 这类不修是彻底打不开
 *    如 ./about/contact/：正常构建里实体是 about/contact/index.html，
 *    但 uglyURLs 下实体叫 about/contact.html，**根本没有那个目录**。
 *
 * B 和 C 都**先问磁盘再改**，不是无脑字符串替换，所以外链、锚点、
 * javascript: 一律不碰，本就不存在的路径也原样留着（那属于内容问题，
 * 不该由构建脚本掩盖）。
 *
 * 用法：由 npm run build:local 自动调用，一般不需要单独跑。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(repoRoot, process.argv[2] ?? 'public-local');

// 保险丝：这个脚本会原地改写 HTML，绝不能让它跑到部署产物上去。
if (path.basename(target) === 'public') {
  console.error(`拒绝改写 ${target} —— 本脚本只用于离线双击版（public-local）。`);
  process.exit(1);
}
if (!existsSync(target)) {
  console.error(`目录不存在：${target}（先跑 npm run build:local）`);
  process.exit(1);
}

/** @returns {string[]} 目录下所有文件的绝对路径 */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// SRI 摘要。全站只有 head.html / scripts.html 两处产生，且只出现在
// <link rel="stylesheet"> 与 <script src> 上，所以直接摘掉整段属性即可。
const INTEGRITY = /\s+integrity="[^"]*"/g;
const LINK = /\b(href|action)="([^"]*)"/g;

let changedFiles = 0;
let stripped = 0;
let rewritten = 0;
const samples = [];

for (const file of walk(target)) {
  if (!file.endsWith('.html')) continue;

  const dir = path.dirname(file);
  const before = readFileSync(file, 'utf8');

  // A. 先摘 integrity
  let after = before.replace(INTEGRITY, () => {
    stripped++;
    return '';
  });

  // B / C. 再补目录式链接
  after = after.replace(LINK, (match, attr, value) => {
    if (!value.endsWith('/')) return match; // 只管指向目录的链接
    // 外链、协议相对、锚点、javascript: 一律不碰
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//') || value.startsWith('#')) {
      return match;
    }

    // 路径里可能有百分号编码（中文目录名等），解码后再问磁盘
    let onDisk;
    try {
      onDisk = path.resolve(dir, decodeURIComponent(value));
    } catch {
      return match; // 解码失败就当它不存在，原样留着
    }

    let replacement = null;
    if (existsSync(path.join(onDisk, 'index.html'))) {
      replacement = `${value}index.html`; // B：目录 + index.html
    } else if (existsSync(`${onDisk}.html`)) {
      replacement = `${value.slice(0, -1)}.html`; // C：同名 .html（uglyURLs）
    }
    if (replacement === null) return match;

    rewritten++;
    if (samples.length < 6) {
      samples.push(`${path.relative(target, file)}: ${value} → ${replacement}`);
    }
    return `${attr}="${replacement}"`;
  });

  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    changedFiles++;
  }
}

console.log(`离线产物修整：${changedFiles} 个页面`);
console.log(`  去掉 integrity 摘要 ${stripped} 处（否则 file:// 下 CSS/JS 被整份拦掉）`);
console.log(`  目录式链接改写 ${rewritten} 处`);
for (const line of samples) console.log(`    ${line}`);
