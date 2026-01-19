# Stitch AI Office Suite Frontend (Demo)

React + Vite 的前端演示站点，默认通过同域 `/api` 访问后端（生产环境由 nginx 反向代理）。

## 开发

1) 启动后端（FastAPI，默认 `8000`）
2) 启动前端（Vite，默认 `5173`）

```bash
cd stitch-ai-office/frontend
npm install
npm run dev
```

开发环境已在 `vite.config.ts` 中配置了 `/api -> http://localhost:8000` 的代理，因此前端直接请求 `/api/*` 即可。

## 构建

```bash
cd stitch-ai-office/frontend
npm run build
```

产物在 `dist/`。

## 部署（推荐）

使用 `stitch-ai-office/docker-compose.yml` 一键启动：

```bash
cd stitch-ai-office
docker-compose up -d --build
```

- 前端：`http://<server-ip>/`
- API：`http://<server-ip>/api/health`

## 可选配置

Vite 构建期可通过 `VITE_API_URL` 覆盖 API 前缀（默认 `/api`）。

