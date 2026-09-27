#!/usr/bin/env node
/**
 * 把 Decap CMS 前端内置到 static/admin/decap-cms.js
 *
 * 为什么内置而不是走 CDN ——
 *   /admin/ 原本从 cdn.jsdelivr.net 加载 decap-cms.js。jsdelivr 在国内经常
 *   连不上，此时后台是**整页空白且控制台无报错**（脚本压根没下载下来），
 *   编辑同事看到的就是个白屏。内置之后后台彻底离线可用，也符合本模板
 *   「零运行时依赖、零外网依赖」的基调。
 *
 * 用法：
 *     npm run cms:vendor                 # 按下面的 PINNED 版本重新下载
 *     npm run cms:vendor -- 3.17.0       # 升到指定版本（升级后请跑一遍后台自测）
 *     npm run cms:vendor -- --check      # 只对比本地与线上的体积，不下载
 *
 * 国内下载慢/失败时挂代理（curl 认这个环境变量）：
 *     HTTPS_PROXY=http://127.0.0.1:7890 npm run cms:vendor
 *
 * ⚠ decap-cms.js 体积约 5MB（gzip 后 ~1.4MB）。它是构建期一次性引入的
 *   静态资源，不参与 Hugo 构建，也不影响前台页面体积 —— 前台访客不会下到它。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** 升级时改这里，改完跑一次 npm run cms:vendor 并自测后台 */
const PINNED = '3.16.3';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destDir = path.join(repoRoot, 'static', 'admin');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const version = args.find(a => !a.startsWith('-')) || PINNED;

const BASE = `https://cdn.jsdelivr.net/npm/decap-cms@${version}/dist`;
// 第二个是被 bundle 头部 banner 引用的第三方许可清单，内置时一并带上（Decap 是 MIT）
const FILES = ['decap-cms.js', 'decap-cms.js.LICENSE.txt'];

const kb = n => (n / 1024 / 1024).toFixed(2) + ' MB';

function sizeOf(p) {
  return existsSync(p) ? statSync(p).size : 0;
}

/** curl 优先：它原生认 HTTPS_PROXY，国内挂代理时省事；没有 curl 再退回 fetch */
async function download(url, dest) {
  try {
    execFileSync('curl', ['-fsSL', '--retry', '3', '--retry-delay', '2', '-o', dest, url], { stdio: 'pipe' });
    return;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;   // 有 curl 但下载失败 —— 不要再退回 fetch
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

mkdirSync(destDir, { recursive: true });

if (checkOnly) {
  let bad = 0;
  for (const f of FILES) {
    const local = sizeOf(path.join(destDir, f));
    const tmp = path.join(destDir, f + '.tmp');
    let remote;
    try {
      await download(`${BASE}/${f}`, tmp);
      remote = sizeOf(tmp);
    } catch (e) {
      console.log(`  ? ${f}: 本地 ${kb(local)}，线上取不到（${String(e.message).slice(0, 60)}）`);
      if (existsSync(tmp)) unlinkSync(tmp);
      continue;
    }
    unlinkSync(tmp);
    const same = local === remote;
    if (!same) bad++;
    console.log(`  ${same ? '✅' : '⚠ '} ${f}: 本地 ${kb(local)} / 线上(${version}) ${kb(remote)}`);
  }
  console.log(bad ? '\n本地与线上不一致，跑 npm run cms:vendor 更新。' : '\n本地与线上一致。');
  process.exit(0);
}

for (const f of FILES) {
  const dest = path.join(destDir, f);
  const before = sizeOf(dest);
  try {
    await download(`${BASE}/${f}`, dest);
  } catch (e) {
    console.error(`✗ 下载失败 ${f}: ${String(e.message).slice(0, 120)}`);
    console.error('  国内网络请挂代理重试：HTTPS_PROXY=http://127.0.0.1:7890 npm run cms:vendor');
    process.exit(1);
  }
  const after = sizeOf(dest);
  console.log(`✓ static/admin/${f}  ${before ? kb(before) + ' → ' : ''}${kb(after)}`);
}

console.log(`\nDecap CMS ${version} 已内置到 static/admin/`);
console.log('升级或重装后请自测一遍：npm run cms + npm run dev → localhost:1313/admin/');
