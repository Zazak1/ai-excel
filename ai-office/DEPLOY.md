# Docker Compose 部署指南

## 🚀 快速启动

### 1. 构建并启动所有服务
```bash
docker-compose up -d --build
```

会启动：
- `frontend`：前端静态站点
- `backend`：FastAPI API 服务
- `worker`：后台任务 worker（执行 Excel Code Interpreter）
- `redis`：任务队列
- `nginx`：反向代理

### 2. 查看服务状态
```bash
docker-compose ps
```

### 3. 查看日志
```bash
# 所有服务
docker-compose logs -f

# 单个服务
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 4. 停止服务
```bash
docker-compose down
```

## 🌐 访问地址

- **前端**: http://localhost
- **API**: http://localhost/api
- **健康检查**: http://localhost/api/health
- **Excel 处理（异步任务）**:
  - 创建任务：`POST http://localhost/api/excel/jobs`（multipart：`file` + `prompt`）
  - 查询任务：`GET http://localhost/api/excel/jobs/{job_id}`
  - 下载结果：`GET http://localhost/api/excel/jobs/{job_id}/download`
- **数据分析（异步任务）**:
  - 创建任务：`POST http://localhost/api/analytics/jobs`（multipart：`file` + `prompt`）
  - 查询任务：`GET http://localhost/api/analytics/jobs/{job_id}`
  - 产物列表：`GET http://localhost/api/analytics/jobs/{job_id}/artifacts`
  - 下载图表：`GET http://localhost/api/analytics/jobs/{job_id}/artifacts/{name}`（png/json）

## 📁 项目结构

```
ai-office/
├── docker-compose.yml      # Docker Compose 配置
├── nginx/
│   └── nginx.conf          # Nginx 反向代理配置
├── frontend/
│   ├── Dockerfile          # 前端构建镜像
│   ├── nginx.conf          # 前端 SPA 路由配置
│   └── ...
└── backend/
    ├── Dockerfile          # 后端构建镜像
    └── ...
```

## 🔧 生产环境部署

1. 修改 `nginx/nginx.conf` 中的 `server_name` 为你的域名
2. 配置 SSL 证书 (推荐使用 Let's Encrypt)
3. 设置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件
```

后端需要设置 `DEEPSEEK_API_KEY` 才能生成 Excel 处理代码（Code Interpreter 工作流）。
