import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiGetJson, type ApiError, type ApiHealth } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';

type HealthState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: ApiHealth; latencyMs: number }
  | { kind: 'error'; error: ApiError };

const Dashboard = () => {
  const [health, setHealth] = useState<HealthState>({ kind: 'idle' });

  const statusBadge = useMemo(() => {
    if (health.kind === 'loading' || health.kind === 'idle') return <Badge variant="info">checking</Badge>;
    if (health.kind === 'error') return <Badge variant="error">offline</Badge>;
    return health.data.status === 'healthy' ? (
      <Badge variant="success">healthy</Badge>
    ) : (
      <Badge variant="warning">{health.data.status}</Badge>
    );
  }, [health]);

  const fetchHealth = async () => {
    const startedAt = performance.now();
    try {
      const data = await apiGetJson<ApiHealth>('/health');
      const latencyMs = Math.round(performance.now() - startedAt);
      setHealth({ kind: 'ready', data, latencyMs });
    } catch (error) {
      const apiError = (error ?? { message: 'Unknown error' }) as ApiError;
      setHealth({ kind: 'error', error: apiError });
    }
  };

  const refreshHealth = () => {
    setHealth({ kind: 'loading' });
    void fetchHealth();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">控制台</h1>
          <p className="mt-1 text-sm text-slate-500">前端演示 Demo（静态页面 + /api 反向代理）。</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">API</span>
            {statusBadge}
          </div>
          <Button variant="secondary" onClick={refreshHealth}>
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            刷新
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card hover>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">运行状态</p>
              <span className="material-symbols-outlined text-slate-400">monitor_heart</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-slate-900">
              {health.kind === 'ready' ? health.data.status : health.kind === 'error' ? 'error' : 'checking'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {health.kind === 'ready'
                ? `latency ${health.latencyMs}ms`
                : health.kind === 'error'
                  ? health.error.message
                  : 'connecting to backend'}
            </p>
          </CardContent>
        </Card>

        <Card hover>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">AI 智能表格</p>
              <span className="material-symbols-outlined text-slate-400">table_chart</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">可编辑网格 + 右侧 AI 助手占位。</p>
            <div className="mt-4">
              <Link className="text-sm font-bold text-[#1337ec] hover:underline" to="/spreadsheet">
                进入编辑器 →
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">AI PPT 设计</p>
              <span className="material-symbols-outlined text-slate-400">slideshow</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">幻灯片列表 + 画布预览（占位）。</p>
            <div className="mt-4">
              <Link className="text-sm font-bold text-[#1337ec] hover:underline" to="/ppt">
                打开工作台 →
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">深度报告</p>
              <span className="material-symbols-outlined text-slate-400">description</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">报告生成与导出（占位）。</p>
            <div className="mt-4">
              <Link className="text-sm font-bold text-[#1337ec] hover:underline" to="/report">
                生成报告 →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-900">部署提示</p>
            <p className="mt-1 text-xs text-slate-500">推荐用 Docker Compose 一键拉起 nginx + frontend + backend。</p>
          </div>
          <Badge variant="info">docker</Badge>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">terminal</span>
            <span className="font-mono text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1">
              docker-compose up -d --build
            </span>
          </p>
          <p className="text-xs text-slate-500">默认通过 `/api` 代理到后端；前端静态文件由 nginx 提供。</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
