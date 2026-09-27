# 兰州市商业发展商会

## 环境

| 依赖 | 版本 | 备注 |
|---|---|---|
| Node.js | 24.20.0 | 只用来跑命令，CI 固定此版本 |
| Hugo | 0.166.0 | **扩展版非必需**（本站不用 Sass），0.156 以上即可 |
| decap-server | 3.11.3 | 由 `npm install` 安装，只有用后台编辑时才需要 |

Windows 上把 `hugo.exe` 直接放在仓库根目录即可，`scripts/hugo.mjs` 会优先用它，
不用配 PATH（该文件已被 `.gitignore` 忽略、不会提交）。

## 安装

```bash
npm install
```

只有需要用后台编辑器时才要装；纯看站点、纯构建都不需要。

## 启动

```bash
npm run dev     # 站点：http://localhost:1313
npm run cms     # 后台后端：另开一个终端跑，然后访问 http://localhost:1313/admin/
```

两个都要开着，后台才连得上（`npm run cms` 监听 8081，站点监听 1313）。

## 构建

```bash
npm run build        # 产出 public/（带 --gc --minify）
npm run build:local  # 产出 public-local/：双击 index.html 就能脱机看，不用服务器
npm run cms:config   # 改了栏目之后重新生成 static/admin/config.yml
```

部署是自动的：推 `main` 分支即由 GitHub Actions 构建并发布。

## 用不到可以不管的脚本

批量导入会员 `members:import`、同步会员排序名单 `members:order`、重新内置后台前端
`cms:vendor` —— 见 `package.json` 的 `scripts`。

## 详细说明

- `CMS.md` — 后台怎么用、字段与图片规则
- `WRITING.md` — 发稿规范、正文插图版式
- `ARCHITECTURE.md` — 模板、CSS、JS 分层
