

## 环境

| 依赖 | 版本 | 备注 |
|---|---|---|
| Hugo | 0.166.0 | **扩展版非必需**（本站不用 Sass），0.156 以上即可 |
| Node.js | 24.20.0 | **可选**：只为 `npm run` 那几条便利命令而装；直接用 `./hugo` 构建、用编辑器改内容，完全不需要它 |

Windows 上把 `hugo.exe` 直接放在仓库根目录即可，`scripts/hugo.mjs` 会优先用它，
不用配 PATH（该文件已被 `.gitignore` 忽略、不会提交）。

## 安装

没有依赖要装 —— 项目不引用任何第三方包，`npm install` 不再需要。
机器上有 Hugo 即可（Node 可选，见上）。

## 启动

```bash
npm run dev     # 站点：http://localhost:1313
```

### ⚠ `dev` 为什么带 `--poll 700ms`

因为**项目目录经常挂在 Windows 盘上、由 Linux 侧访问**（容器 / WSL / 远程开发）。
这种跨挂载点的目录**收不到 inotify 事件**，Hugo 默认的 fsnotify 监听器什么都听不到，
表现为：

- 保存文件后 `hugo server` **不重建**（命令行里看不到新的构建输出）
- 后台编辑器（`hugo-editor/`）右栏预览**不自动刷新**，只有点「刷新」按钮才更新

`--poll 700ms` 让 Hugo 改用**轮询**检查文件变更，跨挂载点也能触发。
代价是每 700ms 扫一遍目录 —— 本项目量级下开销可忽略。

> 反过来：如果项目在**本机文件系统**上（原生 Linux / macOS，或 Hugo 直接跑在
> Windows 侧），轮询是多余的，把 `--poll 700ms` 去掉更省资源。
> 觉得扫得太勤就调大，例如 `--poll 2000ms`。

## 构建

```bash
npm run build        # 产出 public/（带 --gc --minify）
npm run build:local  # 产出 public-local/：双击 index.html 就能脱机看，不用服务器
```

部署是自动的：推 `main` 分支即由 GitHub Actions 构建并发布。

## 内容怎么改

**本站没有后台**：用编辑器直接改文件，改完提交、推送即可。

- 文章 → `content/<栏目>/`；会员单位 → `content/members/directory/`
- 首页各版块的标题与条数、友情链接、合作机构 → `data/`
- 字段含义、图片放哪、正文插图版式、栏目一览 → 全在 `WRITING.md`

批量导入一份会员名单：

```bash
npm run members:import -- --from 名单.txt
```

## 详细说明

- `WRITING.md` — 发稿规范、字段含义、图片与正文插图版式、栏目一览
- `ARCHITECTURE.md` — 模板、CSS、JS 分层
- `STRUCTURE.md` — 目录地图与踩坑清单
- `docs/` — 专题分析（主题抽离、托管与备案、图片与 OSS、特性移植）
