#!/usr/bin/env node
/**
 * 跨平台 Hugo 启动器 —— 让 `npm run dev` / `npm run build` 在任何机器上都能跑。
 *
 * 查找顺序：
 *   1. 仓库根目录的 hugo / hugo.exe（本地开发时手动放一个即可，已在 .gitignore 里）
 *   2. PATH 里的 hugo
 *
 * 本仓库**不再**自带二进制 —— 早先那个 57MB 的 linux/amd64 `hugo` 无法在
 * Windows/macOS 上执行，只会让 clone 变慢，已经删掉。
 * 安装方式见 README：Windows 用 `winget install Hugo.Hugo.Extended`。
 *
 * ⚠ 跨挂载点时 `hugo server` 收不到文件变更事件：
 *   项目目录挂在 Windows 盘、由 Linux 侧（容器 / WSL / 远程开发）访问时，
 *   底层收不到 inotify 事件，Hugo 默认的 fsnotify 监听器不会触发重建 ——
 *   表现是「保存了但站点不更新、后台右栏预览也不自动刷新」。
 *   所以 `npm run dev` 带了 `--poll 700ms` 改用轮询，详见 README 的「启动」一节。
 *   本机文件系统上不需要它，去掉更省资源。
 *
 * 用法：node scripts/hugo.mjs server -D --poll 700ms
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
    '  - Windows：winget install Hugo.Hugo.Extended\n' +
    '  - macOS：brew install hugo\n' +
    '  - Linux：apt install hugo（或从 releases 下载）\n' +
    '  - 也可以把 hugo 可执行文件直接放到仓库根目录\n' +
    '  - 下载：https://github.com/gohugoio/hugo/releases'
);
process.exit(127);
