#!/usr/bin/env node
/**
 * 跨平台 Hugo 启动器。
 *
 * 背景：本仓库根目录自带一个 linux/amd64 的 `hugo` 二进制，但很多机器上
 * `hugo` 并不在 PATH 里，于是 `npm run dev` 会报 `sh: 1: hugo: not found`。
 *
 * 策略：优先用仓库根目录的二进制；若不存在、无执行权限或平台不匹配
 * （例如 macOS 上跑 linux 二进制会 ENOEXEC），再回退到 PATH 里的 `hugo`。
 *
 * 用法：node scripts/hugo.mjs server -D
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localBin = path.join(repoRoot, process.platform === 'win32' ? 'hugo.exe' : 'hugo');
const args = process.argv.slice(2);

const candidates = [];
if (existsSync(localBin)) candidates.push(localBin);
candidates.push('hugo');

function run(bin) {
  return new Promise(resolve => {
    const child = spawn(bin, args, { stdio: 'inherit', cwd: repoRoot });

    const forward = signal => () => {
      try {
        child.kill(signal);
      } catch {
        /* 子进程可能已退出 */
      }
    };
    process.on('SIGINT', forward('SIGINT'));
    process.on('SIGTERM', forward('SIGTERM'));

    child.on('error', error => resolve({ error }));
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
}

for (const bin of candidates) {
  const result = await run(bin);

  if (!result.error) {
    process.exit(result.code ?? 0);
  }

  // 只有“找不到 / 跑不起来”才换下一个候选；Hugo 自身报错则原样退出。
  const message = String(result.error.message || '');
  const retryable =
    result.error.code === 'ENOENT' ||
    result.error.code === 'EACCES' ||
    /ENOEXEC|Exec format error/i.test(message);

  if (!retryable) {
    console.error(`启动 Hugo 失败：${message}`);
    process.exit(1);
  }
}

console.error(
  '未找到可用的 Hugo。\n' +
    `  - 已尝试：${candidates.join('、')}\n` +
    '  - 处理方式：把 hugo 可执行文件放到仓库根目录，或安装 Hugo 并加入 PATH。\n' +
    '  - 下载：https://github.com/gohugoio/hugo/releases'
);
process.exit(127);
