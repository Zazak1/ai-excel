# AI Excel / AI Office Suite

AI 驱动的智能办公套件项目集合。

## 📁 项目结构

```
├── ai-office-suite/              # Next.js 主项目
│   ├── src/components/ui/        # UI 组件库
│   └── src/lib/                  # 工具函数
│
├── ai-office/                    # 前后端分离项目
│   ├── backend/                  # Python 后端 API
│   └── frontend/                 # React + Vite 前端
```

## 🚀 技术栈

- **Frontend**: React 18, Next.js, Vite, TypeScript, Tailwind CSS
- **Backend**: Python (FastAPI)
- **UI Components**: shadcn/ui

## 📝 开发状态

项目目前处于早期开发阶段，正在积极开发中。

## 🛠️ 开始使用

### ai-office-suite
```bash
cd ai-office-suite
npm install
npm run dev
```

### ai-office
```bash
# 可选：复制环境变量（后端会自动向上查找并加载 .env）
cp ai-office/.env.example ai-office/.env

# Frontend
cd ai-office/frontend
npm install
npm run dev

# Backend
cd ai-office/backend
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
```

## 📄 License

MIT
