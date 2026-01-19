# Docker Compose 部署指南

## 🚀 快速启动

### 1. 构建并启动所有服务
```bash
docker-compose up -d --build
```

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
