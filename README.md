# BaguRadar · 计算机八股文知识库

一个只做「加载 + 展示」的知识库前端：目录与文章全部来自可对接对象存储的桶目录，前端不依赖数据库或后端接口。

- 前端：Vite 7 + Vue 3 + Tailwind CSS v4
- 内容：选定一个专门的存储桶（manifest 清单 + Markdown 文章）
- 渲染：markdown-it + Shiki 双主题高亮 + KaTeX 公式 + 标题锚点与右侧 TOC
- 路由：`createWebHashHistory`，静态托管无需配置 SPA fallback

## 目录结构

```
BaguRadar/
├── README.md                 # 本文档
└── frontend/                 # 前端工程
    ├── plugins/bucket-static.js   # dev/preview 阶段把 /bucket 映射到本地桶目录
    ├── src/
    │   ├── components/       # 头部、目录树、文章、TOC、状态组件
    │   ├── composables/      # 目录索引与主题状态
    │   ├── services/bucket.js     # 桶 fetch 层（基址、超时、缓存、错误）
    │   ├── utils/            # frontmatter 解析、Markdown 渲染管线
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

## 设计说明

- 主题：默认跟随系统，可切换亮色 / 深色 / 跟随系统，选择保存在 `localStorage`；
- 代码高亮：Shiki 使用 JavaScript 正则引擎与按需语言包，浅色 `github-light`、深色 `github-dark`，仅切换 CSS 变量，不重新高亮；
- 公式：KaTeX 在渲染阶段生成 HTML，不依赖运行时脚本；
- 内容边界：不包含搜索、收藏、阅读进度、登录与评论等功能。

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
