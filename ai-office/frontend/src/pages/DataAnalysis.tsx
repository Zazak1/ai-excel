import { useMemo, useState, useRef } from 'react';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';

type Summary = {
  rows: number;
  columns: number;
  numericColumns: number;
  sampleHeaders: string[];
  notes: string[];
};

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] as string[][] };

  const rows = lines.map((l) => l.split(',').map((cell) => cell.trim()));
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows };
}

function isFiniteNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n);
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

const DataAnalysis = () => {
  const [csv, setCsv] = useState(
    'date,revenue,cost\n2025-01-01,120,80\n2025-01-02,140,90\n2025-01-03,160,110\n'
  );
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      alert('请选择 CSV 或 TXT 文件');
      return;
    }
    
    try {
      const content = await readFileAsText(file);
      setCsv(content);
      setFileName(file.name);
    } catch (error) {
      console.error('读取文件失败:', error);
      alert('读取文件失败，请重试');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const summary = useMemo<Summary>(() => {
    const { headers, rows } = parseCsv(csv);
    const columns = Math.max(headers.length, ...rows.map((r) => r.length));
    if (rows.length === 0 || columns === 0) {
      return {
        rows: 0,
        columns: 0,
        numericColumns: 0,
        sampleHeaders: headers,
        notes: ['请上传 CSV 文件（逗号分隔），首行为表头。'],
      };
    }

    const numericColumnFlags = Array.from({ length: columns }, (_, col) =>
      rows.some((r) => isFiniteNumber(r[col] ?? ''))
    );
    const numericColumns = numericColumnFlags.filter(Boolean).length;

    const notes: string[] = [];
    if (headers.length === 0) notes.push('未检测到表头（默认使用第 1 行）。');
    if (numericColumns === 0) notes.push('未检测到数值列；请上传包含数值的 CSV 文件以查看统计。');
    if (rows.length > 5000) notes.push('行数较多：建议后续做后端分页/采样。');

    return { rows: rows.length, columns, numericColumns, sampleHeaders: headers, notes };
  }, [csv]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">数据分析</h1>
            <Badge variant="info">demo</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">支持 CSV/TXT 文件上传，本地解析与摘要统计（无第三方图表依赖）。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setCsv('date,revenue,cost\n2025-01-01,120,80\n2025-01-02,140,90\n2025-01-03,160,110\n');
              setFileName('');
            }}
          >
            恢复示例
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">文件导入</p>
            <Badge variant="warning">placeholder</Badge>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleClickUpload}
              className={`
                w-full min-h-[420px] border-2 border-dashed rounded-xl p-8
                flex flex-col items-center justify-center gap-4
                cursor-pointer transition-all
                ${
                  isDragging
                    ? 'border-primary bg-primary-light border-solid'
                    : 'border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary-light/30'
                }
              `}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-3xl">cloud_upload</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">
                    {isDragging ? '松开以上传文件' : '点击或拖拽文件到此处上传'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">支持 CSV、TXT 格式文件</p>
                </div>
              </div>
              {fileName && (
                <div className="mt-2 px-4 py-2 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-sm">description</span>
                    <span className="text-xs font-medium text-slate-700">{fileName}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">摘要</p>
            <Badge variant="info">local</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500">Rows</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{summary.rows}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500">Columns</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{summary.columns}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500">Numeric</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{summary.numericColumns}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">Headers</p>
              <div className="flex flex-wrap gap-2">
                {(summary.sampleHeaders.length ? summary.sampleHeaders : ['(none)']).map((h) => (
                  <span
                    key={h}
                    className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">Notes</p>
              <ul className="text-sm text-slate-700 space-y-1">
                {(summary.notes.length ? summary.notes : ['解析成功：可在此扩展图表、异常检测、聚合等功能。']).map(
                  (n, i) => (
                    <li key={String(i)} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 rounded-full bg-slate-400"></span>
                      <span>{n}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataAnalysis;

