import { useMemo, useRef, useState } from 'react';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import {
  apiGetJson,
  apiPostFormJson,
  apiPublicUrl,
  type ApiArtifactsResponse,
  type ApiError,
  type ApiReportJobCreateResponse,
  type ApiReportJobInfo,
} from '../lib/api';
import { cn } from '../lib/utils';

type TemplateKey = 'weekly' | 'monthly' | 'project';

const templates: Record<TemplateKey, { name: string; outline: string[] }> = {
  weekly: { name: '周报', outline: ['本周概览', '数据要点（含表格）', '异常与风险（含表格）', '结论与下周计划'] },
  monthly: { name: '月报', outline: ['月度概览', '关键指标（含表格）', '异常与归因（含表格）', '建议与下月目标'] },
  project: { name: '项目复盘', outline: ['背景', '数据结论（含表格）', '问题与异常（含表格）', '经验与改进'] },
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  const e = error as Partial<ApiError> | null | undefined;
  return e?.message ?? '请求失败';
}

function formatStage(stage?: string | null) {
  if (!stage) return '';
  const map: Record<string, string> = {
    starting: '准备中',
    reading_inputs: '分析文件',
    generating_report: '生成报告',
    done: '完成',
    failed: '失败',
  };
  return map[stage] ?? stage;
}

const ReportGenerator = () => {
  const [template, setTemplate] = useState<TemplateKey>('weekly');
  const [title, setTitle] = useState('深度报告');
  const [notes, setNotes] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('请输出深度报告，并保证包含表格（关键指标/异常清单）。');

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [job, setJob] = useState<ApiReportJobInfo | null>(null);
  const [artifacts, setArtifacts] = useState<ApiArtifactsResponse | null>(null);
  const [reportMd, setReportMd] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const chartArtifacts = useMemo(() => {
    const list = artifacts?.artifacts ?? [];
    return list.filter((a) => a.exists && a.name.toLowerCase().endsWith('.png'));
  }, [artifacts]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter((file) => file.name.match(/\.(csv|xlsx|txt|md)$/i));
    if (validFiles.length === 0) {
      alert('请选择 CSV、XLSX、TXT 或 MD 文件');
      return;
    }
    setUploadedFiles((prev) => [...prev, ...validFiles]);
    setJob(null);
    setArtifacts(null);
    setReportMd('');
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
    await handleFileSelect(e.dataTransfer.files);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFileSelect(e.target.files);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startGenerate = async () => {
    if (uploadedFiles.length === 0) {
      alert('请先上传文件');
      return;
    }
    const t = title.trim();
    if (!t) {
      alert('请输入标题');
      return;
    }

    setIsGenerating(true);
    setJob(null);
    setArtifacts(null);
    setReportMd('');
    try {
      const formData = new FormData();
      formData.append('title', t);
      formData.append('template', template);
      formData.append('notes', notes);
      formData.append('prompt', extraPrompt.trim());
      for (const f of uploadedFiles) formData.append('files', f, f.name);

      const created = await apiPostFormJson<ApiReportJobCreateResponse>('/report/jobs', formData);
      const jobId = created.job_id;

      const startedAt = Date.now();
      const timeoutMs = 600_000;
      let info: ApiReportJobInfo | null = null;

      while (Date.now() - startedAt < timeoutMs) {
        info = await apiGetJson<ApiReportJobInfo>(`/report/jobs/${jobId}`);
        setJob(info);
        if (info.status === 'succeeded' || info.status === 'failed') break;
        await sleep(800);
      }

      if (!info) throw new Error('任务创建失败');
      if (info.status !== 'succeeded') throw new Error(info.error ?? `任务失败：${info.status}`);

      const arts = await apiGetJson<ApiArtifactsResponse>(`/report/jobs/${jobId}/artifacts`);
      setArtifacts(arts);

      const mdResp = await fetch(apiPublicUrl(`/report/jobs/${jobId}/artifacts/report.md`), {
        headers: { Accept: 'text/markdown' },
      });
      setReportMd(await mdResp.text());
    } catch (error) {
      alert(`生成失败：${formatApiError(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(reportMd || '');
  };

  const downloadMarkdown = () => {
    const blob = new Blob([reportMd || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w\s]/gi, '') || 'report'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">深度报告</h1>
            <Badge variant="info">deepseek</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">上传表格/文本，后端分析并生成带表格的 Markdown 报告。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => void startGenerate()} disabled={isGenerating || uploadedFiles.length === 0}>
            <span className="material-symbols-outlined text-[18px]">description</span>
            {isGenerating ? '生成中...' : '生成报告'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">输入</p>
            <Badge variant={uploadedFiles.length > 0 ? 'success' : 'warning'}>{uploadedFiles.length > 0 ? 'ready' : 'upload'}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {(Object.keys(templates) as TemplateKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTemplate(key)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left transition-all',
                    template === key ? 'border-[#1337ec] bg-[#1337ec]/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                  )}
                >
                  <p className="text-sm font-black text-slate-900">{templates[key].name}</p>
                  <p className="mt-1 text-xs text-slate-500">{templates[key].outline.join(' / ')}</p>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">标题</p>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：XX 业务周报（含数据分析）" />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">补充信息</p>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="可填写业务背景、口径说明、要重点关注的指标等" />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">额外要求</p>
              <Input value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} placeholder="例如：重点分析收入与订单，异常点请做成表格" />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.txt,.md"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'w-full min-h-[200px] border-2 border-dashed rounded-xl p-6',
                'flex flex-col items-center justify-center gap-3 cursor-pointer transition-all',
                isDragging
                  ? 'border-[#1337ec] bg-[#1337ec]/5 border-solid'
                  : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/60'
              )}
            >
              <div className="size-14 rounded-full bg-[#1337ec]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#1337ec] text-3xl">cloud_upload</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-900">{isDragging ? '松开以上传文件' : '点击或拖拽文件到此处上传'}</p>
                <p className="mt-1 text-xs text-slate-500">支持 CSV、XLSX、TXT、MD（可多文件）</p>
              </div>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500">已上传</p>
                <div className="space-y-2">
                  {uploadedFiles.map((f, idx) => (
                    <div key={`${f.name}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-500">{(f.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-bold text-slate-500 hover:text-slate-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">结果</p>
            <Badge variant={job?.status === 'succeeded' ? 'success' : job?.status === 'failed' ? 'error' : 'info'}>
              {job?.status ?? 'idle'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {!job ? (
              <div className="py-12 text-center text-sm text-slate-500">上传文件后点击“生成报告”。</div>
            ) : job.status === 'failed' ? (
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-900">失败原因</p>
                <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700">
                  {job.error ?? 'unknown error'}
                </pre>
                {job.detail && (
                  <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 max-h-[200px] overflow-auto custom-scrollbar">
                    {job.detail}
                  </pre>
                )}
              </div>
            ) : job.status !== 'succeeded' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{formatStage(job.stage) || '任务处理中…'}</span>
                  {typeof job.progress === 'number' && (
                    <span className="text-slate-500">{Math.round(job.progress * 100)}%</span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-[#1337ec] transition-all"
                    style={{ width: `${Math.round(((job.progress ?? 0.08) as number) * 100)}%` }}
                  />
                </div>
                {job.detail && (
                  <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 max-h-[260px] overflow-auto custom-scrollbar">
                    {job.detail}
                  </pre>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500">报告 Markdown（含表格）</p>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => void copyReport()} disabled={!reportMd}>
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                      复制
                    </Button>
                    <Button variant="secondary" onClick={downloadMarkdown} disabled={!reportMd}>
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      下载
                    </Button>
                  </div>
                </div>
                <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 max-h-[420px] overflow-auto custom-scrollbar">
                  {reportMd}
                </pre>

                {chartArtifacts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500">图表</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {chartArtifacts.map((a) => (
                        <div key={a.name} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-600">
                            {a.name}
                          </div>
                          <img
                            src={apiPublicUrl(`/report/jobs/${job.job_id}/artifacts/${encodeURIComponent(a.name)}`)}
                            alt={a.name}
                            className="w-full h-auto"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportGenerator;

