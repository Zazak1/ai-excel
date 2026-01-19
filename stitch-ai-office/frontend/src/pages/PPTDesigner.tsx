import { useMemo, useState } from 'react';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';

type Slide = {
  id: string;
  title: string;
  bullets: string[];
};

const initialSlides: Slide[] = [
  { id: 's1', title: '项目概览', bullets: ['目标与背景', '核心价值', '里程碑'] },
  { id: 's2', title: '解决方案', bullets: ['架构设计', '关键功能', '落地路径'] },
  { id: 's3', title: '收益评估', bullets: ['效率提升', '成本节约', '风险控制'] },
];

const PPTDesigner = () => {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [activeId, setActiveId] = useState<string>(initialSlides[0]?.id ?? '');
  const [prompt, setPrompt] = useState('');

  const activeSlide = useMemo(() => slides.find((s) => s.id === activeId) ?? null, [activeId, slides]);

  const updateActive = (patch: Partial<Slide>) => {
    setSlides((prev) => prev.map((s) => (s.id === activeId ? { ...s, ...patch } : s)));
  };

  const addSlide = () => {
    const nextId = `s${slides.length + 1}`;
    const next: Slide = { id: nextId, title: `新幻灯片 ${slides.length + 1}`, bullets: ['要点 1', '要点 2'] };
    setSlides((prev) => [...prev, next]);
    setActiveId(nextId);
  };

  const generateFromPrompt = () => {
    const text = prompt.trim();
    if (!text) return;
    updateActive({
      title: `AI：${text.slice(0, 18)}${text.length > 18 ? '…' : ''}`,
      bullets: ['提炼关键点', '补充论据', '给出结论与行动项'],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">AI PPT 设计</h1>
            <Badge variant="info">demo</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">幻灯片结构编辑 + 画布预览占位。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={addSlide}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            新建幻灯片
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-3">
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">幻灯片</p>
            <Badge variant="default">{slides.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {slides.map((s, index) => (
              <button
                key={s.id}
                className={cn(
                  'w-full text-left rounded-xl border px-3 py-3 transition-all',
                  s.id === activeId
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                )}
                onClick={() => setActiveId(s.id)}
              >
                <p className="text-xs font-black text-slate-500">Slide {index + 1}</p>
                <p className="mt-1 text-sm font-bold text-slate-900 line-clamp-2">{s.title}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-6">
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">画布预览</p>
            <Badge variant="warning">placeholder</Badge>
          </CardHeader>
          <CardContent>
            <div className="aspect-[16/9] w-full rounded-2xl bg-white border border-slate-200 canvas-shadow p-10">
              {activeSlide ? (
                <>
                  <p className="text-xl font-black text-slate-900">{activeSlide.title}</p>
                  <div className="mt-6 space-y-2">
                    {activeSlide.bullets.map((b, i) => (
                      <div key={`${activeSlide.id}-${i}`} className="flex items-start gap-2 text-slate-700">
                        <span className="mt-1 size-1.5 rounded-full bg-slate-400"></span>
                        <p className="text-sm">{b}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-slate-500">请选择左侧幻灯片。</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">编辑与生成</p>
            <Badge variant="info">local</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">标题</p>
              <Input
                value={activeSlide?.title ?? ''}
                onChange={(e) => updateActive({ title: e.target.value })}
                placeholder="输入标题"
                disabled={!activeSlide}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">要点</p>
              <div className="space-y-2">
                {(activeSlide?.bullets ?? []).map((b, i) => (
                  <Input
                    key={`bullet-${i}`}
                    value={b}
                    onChange={(e) => {
                      const next = [...(activeSlide?.bullets ?? [])];
                      next[i] = e.target.value;
                      updateActive({ bullets: next });
                    }}
                    placeholder={`要点 ${i + 1}`}
                  />
                ))}
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => updateActive({ bullets: [...(activeSlide?.bullets ?? []), '新要点'] })}
                disabled={!activeSlide}
              >
                添加要点
              </Button>
            </div>

            <div className="h-[1px] bg-slate-200 my-2"></div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">AI 需求（占位）</p>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：生成一页 ROI 评估"
                icon={<span className="material-symbols-outlined text-[18px]">magic_button</span>}
              />
              <Button className="w-full" onClick={generateFromPrompt} disabled={!activeSlide || !prompt.trim()}>
                生成当前页内容
              </Button>
              <p className="text-[11px] text-slate-500">当前为本地占位逻辑；后续可接入后端生成。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PPTDesigner;

