# AI Excel / AI Office Suite

AI 驱动的智能办公套件项目集合。

## 📁 项目结构

```
├── ai-office-suite/              # Next.js 主项目
│   ├── src/components/ui/        # UI 组件库
│   └── src/lib/                  # 工具函数
│
├── stitch-ai-office/             # 前后端分离项目
│   ├── backend/                  # Python 后端 API
│   └── frontend/                 # React + Vite 前端
│
└── stitch_ai_office_suite_dashboard/  # Dashboard 子项目集合
    ├── ai_office_suite_dashboard_1/
    ├── ai_office_suite_dashboard_2/
    ├── ai_office_suite_dashboard_3/
    ├── ai_ppt_designer_workspace/
    └── ai_smart_spreadsheet_editor/
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

### stitch-ai-office
```bash
# Frontend
cd stitch-ai-office/frontend
npm install
npm run dev

# Backend
cd stitch-ai-office/backend
source venv/bin/activate
python app/main.py
```

## 📄 License

MIT
