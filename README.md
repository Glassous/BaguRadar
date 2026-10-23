# BaguRadar · 计算机八股文知识库

一个只做「加载 + 展示」的知识库前端：目录与文章全部来自可对接对象存储的桶目录，前端不依赖数据库或后端接口。

- 前端：Vite 7 + Vue 3 + Tailwind CSS v4
- 内容：选定一个专门的存储桶（manifest 清单 + Markdown 文章）
- 渲染：markdown-it + Shiki 双主题高亮 + KaTeX 公式 + 标题锚点与右侧 TOC
- 路由：`createWebHashHistory`，静态托管无需配置 SPA fallback

## 目录结构

```
BaguRadar/
├── .github/workflows/        # CI：构建并部署前端、部署搜索微服务
├── README.md                 # 本文档
├── server/                   # 全文搜索微服务（零依赖 Node）
│   ├── index.mjs             # HTTP 入口：路由、参数校验、优雅退出
│   ├── lib/
│   │   ├── indexer.mjs       # 内容扫描、内存索引快照、目录热更新
│   │   ├── search.mjs        # 归一化、多关键词 AND、加权排序、片段高亮
│   │   └── markdown-text.mjs # Markdown → 纯文本、标题锚点（与前端一致）
│   ├── deploy/
│   │   └── baguradar-search.service  # systemd unit 模板
│   └── package.json
└── frontend/                 # 前端工程
    ├── plugins/bucket-static.js   # dev/preview 阶段把 /bucket 映射到本地桶目录
    ├── src/
    │   ├── components/       # 头部、目录树、文章、TOC、顶栏搜索、状态组件
    │   ├── composables/      # 目录索引、主题状态、随打即搜状态机
    │   ├── services/         # 桶 fetch 层、搜索接口封装
    │   ├── utils/            # frontmatter 解析、Markdown 渲染管线、命中定位高亮
    │   └── views/            # 首页、文章页、404
    ├── package.json
    └── vite.config.js

BaguRadarFiles/               # 桶（对象存储）根目录
├── manifest.json             # 唯一目录索引
└── docs/                     # 文章，按 章 / 节 / 篇 组织
```

## 桶内容规范

对象存储没有可靠的“列目录”能力，因此 **`manifest.json` 是目录的唯一真相源**，前端只按 `path` 取文件。

```json
{
  "version": 1,
  "site": { "title": "BaguRadar", "subtitle": "计算机八股文知识库", "updatedAt": "2026-10-22" },
  "tree": [
    {
      "type": "dir",
      "id": "00-foundation",
      "title": "计算机基础",
      "description": "章节简介",
      "children": [
        {
          "type": "dir",
          "id": "operating-system",
          "title": "操作系统",
          "children": [
            {
              "type": "doc",
              "id": "docs/00-foundation/operating-system/process-vs-thread",
              "title": "进程与线程",
              "path": "docs/00-foundation/operating-system/process-vs-thread.md",
              "description": "文章摘要",
              "tags": ["操作系统", "面试高频"]
            }
          ]
        }
      ]
    }
  ]
}
```

约定：

- `dir` 节点可无限嵌套；第一层为章，第二层为节，目前 UI 按「章 → 节 → 篇」呈现。
- `doc.id` 是去掉 `.md` 后的路径，也是路由标识（`#/doc/<id>`）；`doc.path` 是桶内真实文件路径。
- 文章首部支持 frontmatter，`title` / `description` / `tags` 会覆盖 manifest 中的同名字段：

```markdown
---
title: 进程与线程
description: 从地址空间、切换成本与通信方式拆解线程模型
tags: [操作系统, 面试高频]
order: 1
---

# 进程与线程

正文（标题会被前端去重，不会与文章标题重复显示）。
```

- 正文支持标题（h2/h3 自动生成 TOC）、表格、引用、代码块、`$行内公式$` 与 `$$块级公式$$`。
- 正文中的原始 HTML 会被转义，避免桶内容注入脚本。

### 新增一篇文章

1. 在 `BaguRadarFiles/docs/<章>/<节>/` 下新增 `.md` 文件；
2. 在 `manifest.json` 对应节的 `children` 中追加 `doc` 节点，`id` 与 `path` 保持上面的约定；
3. 刷新页面即可看到（manifest 有 5 分钟浏览器缓存之外的本地内存缓存，开发时刷新即可）。

## 本地开发

```bash
cd BaguRadar/frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 dist/
npm run preview  # 预览构建产物
```

前端默认从线上桶 `https://baguradarfiles.vodyanitsa.top` 读取 `manifest.json` 与文章（桶内结构与 `BaguRadarFiles/` 一致），本地无需启动文件服务。

若想离线调试仓库内的桶目录，在 `frontend/.env.local` 中覆盖基址：

```bash
VITE_BUCKET_BASE_URL=/bucket
```

此时开发与预览阶段由 `plugins/bucket-static.js` 把 `/bucket/**` 映射到 `../../BaguRadarFiles/**`。

## 切换桶地址

桶地址由 `VITE_BUCKET_BASE_URL` 控制，默认已指向线上桶，通常无需改动。切换时注意：

1. 桶根目录（或指定前缀）下直接是 `manifest.json` 与 `docs/`，结构与 `BaguRadarFiles/` 一致；
2. 桶需要允许站点域名跨域读取（CORS）：`GET` / `HEAD`，放行 `Content-Type: text/markdown`；
3. 重新构建前端并部署 `dist/` 即可，代码无需改动。

> 若前端与桶同域部署，也可以把桶内文件放到站点根路径，并将 `VITE_BUCKET_BASE_URL` 设为 `/`。

## 全文搜索

对象存储只能按路径取文件，浏览器无法可靠地全量检索，因此搜索由服务器上的微服务完成：

```
BaguRadarFiles ──(GitHub Actions rsync)──▶ /opt/baguradar/content
                                                   │ 扫描 / 监听
                                                   ▼
前端 ──(同域 /api/search)──▶ 1Panel 反代 ──▶ 127.0.0.1:8787（零依赖 Node）
```

### 目录与职责

| 用途 | 目录 | 说明 |
| --- | --- | --- |
| 内容镜像 | `/opt/baguradar/content` | `manifest.json` + `docs/`，结构与 `BaguRadarFiles/` 一致，`rsync --delete-after` 镜像同步 |
| 服务代码 | `/opt/baguradar/search` | `server/` 产物，systemd 的工作目录 |

不要放进 `/opt/1panel/www/sites/baguradar/index/dist`：该目录由前端部署以 `--delete-after` 清空，且只应存放 nginx 托管的静态产物。

### 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/search?q=&limit=` | 全文检索，`limit` 上限 30，默认 12 |
| GET | `/api/health` | 索引规模、构建时间与内容目录 |
| POST | `/api/reindex` | 立即重建索引；默认仅允许回环调用，配置 `SEARCH_ADMIN_TOKEN` 后还需 `X-Admin-Token` |

```json
{
  "q": "回溯 剪枝",
  "total": 8,
  "took": 6.2,
  "results": [
    {
      "route": "docs/08-interview/algorithm-patterns/backtracking-and-bfs-dfs",
      "title": "回溯与 DFS/BFS",
      "chapter": "面试实战",
      "section": "高频题型",
      "anchor": "21-回溯三要素",
      "hits": 4,
      "snippet": [
        { "text": "if (需要", "hit": false },
        { "text": "剪枝", "hit": true },
        { "text": ") continue;", "hit": false }
      ],
      "more": { "before": true, "after": true }
    }
  ]
}
```

`snippet` 是分段数组而不是 HTML 字符串，前端直接按纯文本渲染，避免桶内容注入脚本。

实现要点：

- 索引在启动时全量构建（约 550 篇 / 5 MB，1 秒内），此后由 `fs.watch` 递归监听 + 30 秒轮询兜底，重建在后台完成并原子替换快照，进程无需重启；
- 中文不做分词，直接多关键词 AND + 子串匹配，配合 NFKC + 小写归一，标题/标签/描述/标题行/正文分别加权；
- 服务端生成标题锚点，规则与 `frontend/src/utils/markdown.js` 的 `slugify` 完全一致，保证跳转落点准确。

### 本地开发

```bash
cd BaguRadar/server
SEARCH_CONTENT_DIR=../BaguRadarFiles SEARCH_PORT=8787 node index.mjs
```

Windows PowerShell 下：

```powershell
cd BaguRadar\server
$env:SEARCH_CONTENT_DIR='..\BaguRadarFiles'; node index.mjs
```

`frontend` 的 dev/preview 已把 `/api` 代理到 `http://127.0.0.1:8787`（可用 `SEARCH_PROXY_TARGET` 覆盖）；生产环境默认请求同域 `/api/search`，需要独立地址时用 `VITE_SEARCH_API_BASE` 覆盖。

### 服务器初始化（一次性）

1. 创建目录并授予部署账户写权限：

```bash
sudo mkdir -p /opt/baguradar/content /opt/baguradar/search
sudo chown -R ubuntu:ubuntu /opt/baguradar
chmod 755 /opt/baguradar /opt/baguradar/content /opt/baguradar/search
```

2. 安装 systemd unit（首次部署后 `server/` 已经在 `/opt/baguradar/search`）：

```bash
sudo cp /opt/baguradar/search/deploy/baguradar-search.service /etc/systemd/system/
# 若 `which node` 不是 /usr/bin/node，先改 unit 里的 ExecStart
sudo systemctl daemon-reload
sudo systemctl enable --now baguradar-search
curl -fsS http://127.0.0.1:8787/api/health
```

3. 让部署账户可以免密重启（`sudoers` 白名单，避免给全量 sudo）：

```bash
echo 'ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart baguradar-search, /usr/bin/systemctl status baguradar-search' \
  | sudo tee /etc/sudoers.d/baguradar-search
sudo chmod 440 /etc/sudoers.d/baguradar-search
```

> 若 `which systemctl` 不是 `/usr/bin/systemctl`，把上面规则里的路径换成实际路径。

4. 在 1Panel 站点里新增反向代理：`/api` → `http://127.0.0.1:8787`，保留请求路径。同域反代后前端无需 CORS。

5. 在 **BaguRadarFiles** 仓库的 Secrets 中补一份与程序仓库同值的 `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY`（可选 `DEPLOY_KNOWN_HOSTS`、Variables `DEPLOY_PORT`、`SEARCH_CONTENT_PATH`、`SEARCH_REINDEX_URL`）。未配置时该步骤输出告警并跳过，不影响 COS 发布。

### 内容更新流程

`BaguRadarFiles` 推送 `docs/**` 或 `manifest.json` 后：

1. 内容照旧同步到 COS（前端阅读不受影响）；
2. 新增步骤把 `docs/` 与 `manifest.json` 镜像到 `/opt/baguradar/content`；
3. 随后调用 `POST /api/reindex` 让新内容立即可搜；调用失败时目录监听会在数秒内自动重建。

### 前端交互

- 桌面端：侧栏按钮右侧的常驻长条输入框，随侧栏展开/收起平滑移动；结果浮层显示标题、章/节路径与带上下文的命中片段；
- 移动端：分享按钮左侧的圆形入口，点击后展开独占整条顶栏，侧栏与分享按钮带位移淡出动画让位，结果区铺满下方，接入系统返回键；
- 随打即搜：160 ms 防抖 + 自动取消过期请求；`↑`/`↓` 选择、`Enter` 打开、`Esc` 关闭、`Ctrl/Cmd + K` 唤起；
- 点击结果跳转到文章对应位置并高亮约 2 秒，优先使用 CSS Custom Highlight API 精确高亮命中词，不支持时退化为段落底色提示。

## 部署

前端是纯静态产物，只需要发布 `frontend/dist/`。构建在 GitHub 托管的 runner 上完成，服务器只接收构建结果，不安装依赖、不执行构建：

| 项 | 值 |
| --- | --- |
| 工作流 | `.github/workflows/deploy-frontend.yml` |
| 触发条件 | push 到 `main` 且改动 `frontend/**`，或手动 `Run workflow` |
| 构建环境 | Node 22 → `npm ci` → `npm run build` |
| 部署方式 | SSH + `rsync --delete-after` |
| 目标目录 | `ubuntu@<服务器地址>:/opt/1panel/www/sites/baguradar/index/dist` |

> `--delete-after` 会删除目标目录中不属于构建产物的文件，该目录只放 `dist/` 内容，不要存放其他数据。

### 1. 配置仓库变量

在 GitHub 仓库 `Settings → Secrets and variables → Actions` 中按名称添加：

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `DEPLOY_HOST` | Secret | 服务器地址，IP 或域名 |
| `DEPLOY_USER` | Secret | SSH 用户，如 `ubuntu` |
| `DEPLOY_SSH_KEY` | Secret | 该用户的私钥全文，含 `BEGIN` / `END` 行 |
| `DEPLOY_PORT` | Variable（可选） | SSH 端口，默认 `22` |
| `DEPLOY_PATH` | Variable（可选） | 部署目录，默认 `/opt/1panel/www/sites/baguradar/index/dist` |
| `VITE_BUCKET_BASE_URL` | Variable（可选） | 构建时注入的桶地址，留空使用代码默认值 |
| `DEPLOY_KNOWN_HOSTS` | Secret（可选） | 预置 `known_hosts`，不配置则用 `ssh-keyscan` 获取 |

缺少必填 Secret 时，工作流会在「校验部署变量」步骤直接失败并提示名称。

生成部署密钥对（本地执行，不要提交私钥）：

```bash
ssh-keygen -t ed25519 -C "github-actions-baguradar" -f ~/.ssh/baguradar_deploy -N ""
ssh-copy-id -i ~/.ssh/baguradar_deploy.pub ubuntu@<服务器地址>
```

`~/.ssh/baguradar_deploy` 的完整内容填入 `DEPLOY_SSH_KEY`。

### 2. 准备服务器目录

用部署账户登录服务器，创建目录并授予写权限（文件保持 `755/644`，保证 1Panel 的 nginx 可读）：

```bash
sudo mkdir -p /opt/1panel/www/sites/baguradar/index/dist
sudo chown -R ubuntu:ubuntu /opt/1panel/www/sites/baguradar/index/dist
sudo find /opt/1panel/www/sites/baguradar/index/dist -type d -exec chmod 755 {} \;
sudo find /opt/1panel/www/sites/baguradar/index/dist -type f -exec chmod 644 {} \;
```

若仍提示 `Permission denied`，补充父目录的穿越权限：

```bash
sudo chmod o+x /opt/1panel/www/sites/baguradar /opt/1panel/www/sites/baguradar/index
```

服务器需安装 `rsync`（多数 Ubuntu 已预装），否则执行 `sudo apt-get install -y rsync`。1Panel 站点根目录需指向该 `dist` 目录。

### 3. 手动部署（可选）

不走 CI 时可在本地直接推送构建产物：

```bash
cd BaguRadar/frontend
npm ci
npm run build
rsync -rlptz --delete-after --chmod=D755,F644 dist/ ubuntu@<服务器地址>:/opt/1panel/www/sites/baguradar/index/dist/
```

### 4. 搜索微服务（可选）

| 项 | 值 |
| --- | --- |
| 工作流 | `.github/workflows/deploy-search.yml` |
| 触发条件 | push 到 `main` 且改动 `server/**`，或手动 `Run workflow` |
| 部署方式 | SSH + `rsync --delete-after` 到 `/opt/baguradar/search`，然后 `sudo -n systemctl restart baguradar-search` |
| 健康检查 | 远端 `curl http://127.0.0.1:8787/api/health`，失败时输出 `journalctl` 尾部 |

可选 Variables：`SEARCH_PATH`（默认 `/opt/baguradar/search`）、`SEARCH_CONTENT_PATH`（默认 `/opt/baguradar/content`）、`SEARCH_PORT`（默认 `8787`）。搜索服务与前端共用同一组 `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY`。

首次部署前请先按上文「全文搜索 → 服务器初始化」创建目录、安装 unit 并配置 sudoers。

## 设计说明

- 主题：默认跟随系统，可切换亮色 / 深色 / 跟随系统，选择保存在 `localStorage`；
- 代码高亮：Shiki 使用 JavaScript 正则引擎与按需语言包，浅色 `github-light`、深色 `github-dark`，仅切换 CSS 变量，不重新高亮；
- 公式：KaTeX 在渲染阶段生成 HTML，不依赖运行时脚本；
- 搜索：内容仍在对象存储，检索由服务器上的零依赖微服务完成，前端只发 `/api/search` 请求；
- 内容边界：不包含收藏、阅读进度、登录与评论等功能。

## 许可协议

本项目基于 [Apache License 2.0](../LICENSE) 开源发布。

```
Copyright 2026 The BaguRadar Authors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

分发本项目或其衍生作品时，请保留根目录下的 `LICENSE` 文件及上述版权声明。
