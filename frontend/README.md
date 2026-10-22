# BaguRadar Frontend

Vite 7 + Vue 3 + Tailwind CSS v4 的纯静态知识库前端，内容来自对象存储桶 `https://baguradarfiles.vodyanitsa.top`（结构与仓库内 `BaguRadarFiles/` 一致）。

## 常用命令

```bash
npm install
npm run dev       # 开发，默认 http://localhost:5173
npm run build     # 生产构建
npm run preview   # 预览构建产物
```

## 关键约定

- 内容基址：`VITE_BUCKET_BASE_URL`，默认 `https://baguradarfiles.vodyanitsa.top`，依赖桶开启 CORS。想在本地改回仓库内的 `BaguRadarFiles/`，在 `.env.local` 设置 `VITE_BUCKET_BASE_URL=/bucket`，由 `plugins/bucket-static.js` 映射。
- 目录来源：`manifest.json`，不调用列目录 API；切换存储桶只需改环境变量。
- 路由：hash 模式，`#/doc/<manifest 中 doc.id>`，静态托管免 fallback 配置。
- 渲染管线：`src/utils/markdown.js`（markdown-it + Shiki + KaTeX + anchor），文章页只负责加载与展示。
- 目录索引与上下篇：`src/composables/useCatalog.js`。

更完整的桶结构、manifest 字段说明与部署步骤见上一级目录的 `README.md`。
