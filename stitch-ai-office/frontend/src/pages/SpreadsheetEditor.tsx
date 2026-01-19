import { Fragment, useMemo, useState } from 'react';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';

const columnLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function createGrid(rows: number, cols: number) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

const SpreadsheetEditor = () => {
  const [grid, setGrid] = useState(() => createGrid(20, columnLabels.length));
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);
  const [formula, setFormula] = useState('');
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantOutput, setAssistantOutput] = useState<string | null>(null);

  const activeValue = useMemo(() => {
    if (!active) return '';
    return grid[active.row]?.[active.col] ?? '';
  }, [active, grid]);

  const setCell = (row: number, col: number, value: string) => {
    setGrid((prev) => prev.map((r, ri) => (ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r)));
  };

  const applyFormula = () => {
    if (!active) return;
    setCell(active.row, active.col, formula);
  };

  const runAssistant = () => {
    const prompt = assistantPrompt.trim();
    if (!prompt) return;
    const suggestions = [
      '建议：用 `=SUM(B2:B10)` 汇总区间。',
      '建议：用 `=IF(A2>0,"增长","下降")` 标记趋势。',
      '建议：先清洗空值，再做透视表。',
    ];
    const seed = prompt.length % suggestions.length;
    setAssistantOutput(`${suggestions[seed]}\n\n（当前为前端演示占位：后续可接入真实 LLM / API）`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">AI 智能表格</h1>
            <Badge variant="info">demo</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">可编辑网格、公式栏与 AI 助手占位。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setGrid(createGrid(20, columnLabels.length));
              setActive(null);
              setFormula('');
              setAssistantOutput(null);
            }}
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            重置
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">grid_on</span>
              <p className="text-sm font-black text-slate-900">表格</p>
            </div>
            <div className="text-xs text-slate-500">
              选中单元格：{active ? `${columnLabels[active.col]}${active.row + 1}` : '—'}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-20 text-xs font-bold text-slate-500">公式栏</div>
              <Input
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="例如：=SUM(A1:A10)"
              />
              <Button onClick={applyFormula} disabled={!active}>
                <span className="material-symbols-outlined text-[18px]">done</span>
                应用
              </Button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="grid" style={{ gridTemplateColumns: `44px repeat(${columnLabels.length}, minmax(120px, 1fr))` }}>
                <div className="bg-slate-50 border-b border-slate-200"></div>
                {columnLabels.map((label) => (
                  <div
                    key={label}
                    className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs font-black text-slate-600"
                  >
                    {label}
                  </div>
                ))}

                {grid.map((row, rowIndex) => (
                  <Fragment key={`r-${rowIndex}`}>
                    <div
                      key={`row-${rowIndex}`}
                      className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs font-black text-slate-600"
                    >
                      {rowIndex + 1}
                    </div>
                    {row.map((cell, colIndex) => {
                      const isActive = active?.row === rowIndex && active.col === colIndex;
                      return (
                        <button
                          key={`${rowIndex}-${colIndex}`}
                          className={cn(
                            'border-b border-slate-200 border-l border-slate-200 px-3 py-2 text-left text-sm text-slate-800',
                            'hover:bg-slate-50 focus:outline-none',
                            isActive && 'grid-cell-active'
                          )}
                          onClick={() => {
                            setActive({ row: rowIndex, col: colIndex });
                            setFormula(cell);
                          }}
                        >
                          {cell || <span className="text-slate-300">—</span>}
                        </button>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              当前单元格值：<span className="font-mono">{active ? activeValue || '""' : '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">auto_awesome</span>
              <p className="text-sm font-black text-slate-900">AI 助手</p>
            </div>
            <Badge variant="warning">placeholder</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={assistantPrompt}
              onChange={(e) => setAssistantPrompt(e.target.value)}
              placeholder="例如：帮我生成一列同比增长公式"
              icon={<span className="material-symbols-outlined text-[18px]">chat</span>}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={runAssistant} disabled={!assistantPrompt.trim()}>
                生成建议
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setAssistantPrompt('');
                  setAssistantOutput(null);
                }}
              >
                清空
              </Button>
            </div>
            <div className="min-h-40 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {assistantOutput ?? (
                <span className="text-slate-400">
                  输入需求后点击“生成建议”。此处展示前端占位结果，后续可对接后端 LLM API。
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SpreadsheetEditor;
