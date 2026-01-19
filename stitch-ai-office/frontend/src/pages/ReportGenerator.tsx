import { useMemo, useState } from 'react';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

type TemplateKey = 'weekly' | 'monthly' | 'project';

const templates: Record<TemplateKey, { name: string; outline: string[] }> = {
  weekly: { name: '周报', outline: ['本周进展', '问题与风险', '下周计划'] },
  monthly: { name: '月报', outline: ['关键指标', '业务进展', '预算与成本', '下月目标'] },
  project: { name: '项目复盘', outline: ['背景', '实施过程', '结果与数据', '经验与改进'] },
};

const ReportGenerator = () => {
  const [template, setTemplate] = useState<TemplateKey>('weekly');
  const [title, setTitle] = useState('AI 办公套件演示报告');
  const [notes, setNotes] = useState('');

  const reportText = useMemo(() => {
    const outline = templates[template].outline;
    const blocks = outline.map((section) => `## ${section}\n- ...\n`);
    const extra = notes.trim() ? `\n## 补充信息\n${notes.trim()}\n` : '';
    return `# ${title}\n\n${blocks.join('\n')}${extra}\n（当前为前端 Demo 占位，可接入后端生成并导出 PDF/Word）\n`;
  }, [notes, template, title]);

  const copyReport = async () => {
    await navigator.clipboard.writeText(reportText);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">深度报告</h1>
            <Badge variant="info">demo</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">模板 + 本地生成占位文本（可复制）。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => void copyReport()}>
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
            复制
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">输入</p>
            <Badge variant="warning">placeholder</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">标题</p>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="输入报告标题" />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">模板</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(templates) as TemplateKey[]).map((key) => (
                  <Button
                    key={key}
                    variant={key === template ? 'primary' : 'secondary'}
                    className="justify-center"
                    onClick={() => setTemplate(key)}
                  >
                    {templates[key].name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">补充信息</p>
              <textarea
                className="w-full min-h-40 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 focus:ring-2 focus:ring-[#1337ec] focus:border-[#1337ec] focus:bg-white transition-colors"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="粘贴数据、关键结论、业务背景..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">预览</p>
            <Badge variant="info">markdown</Badge>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[420px]">
              {reportText}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportGenerator;

