import { useMemo, useRef, useState } from 'react';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';
import {
  apiGetJson,
  apiPostFormJson,
  apiPublicUrl,
  type ApiAnalyticsJobCreateResponse,
  type ApiAnalyticsJobInfo,
  type ApiArtifactsResponse,
  type ApiError,
} from '../lib/api';

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
    reading_metadata: '读取元信息',
    generating_code: '生成分析代码',
    retrying: '重试中',
    validating_code: '校验代码',
    running_sandbox: '运行分析',
    summarizing: '生成摘要',
    finalizing: '整理结果',
    done: '完成',
    failed: '失败',
  };
  return map[stage] ?? stage;
}

const DataAnalysis = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [prompt, setPrompt] = useState('请对表格内容生成摘要（规模/字段/缺失/分布/趋势），识别异常点，并绘制折线图展示主要指标趋势。');
  const [isRunning, setIsRunning] = useState(false);
  const [job, setJob] = useState<ApiAnalyticsJobInfo | null>(null);
  const [artifacts, setArtifacts] = useState<ApiArtifactsResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.name.match(/\.(csv|txt|xlsx)$/i)) {
      alert('请选择 CSV、TXT 或 XLSX 文件');
      return;
    }

    setFile(file);
    setFileName(file.name);
    setJob(null);
    setArtifacts(null);
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

  const chartArtifacts = useMemo(() => {
    const list = artifacts?.artifacts ?? [];
    return list.filter((a) => a.exists && a.name.toLowerCase().endsWith('.png'));
  }, [artifacts]);

  const startAnalysis = async () => {
    if (!file) {
      alert('请先上传数据文件');
      return;
    }
    const p = prompt.trim();
    if (!p) {
      alert('请输入分析需求');
      return;
    }

    setIsRunning(true);
    setJob(null);
    setArtifacts(null);
    try {
      const formData = new FormData();
      formData.append('prompt', p);
      formData.append('file', file, file.name);

      const created = await apiPostFormJson<ApiAnalyticsJobCreateResponse>('/analytics/jobs', formData);
      const jobId = created.job_id;

      const startedAt = Date.now();
      const timeoutMs = 600_000;
      let info: ApiAnalyticsJobInfo | null = null;

      while (Date.now() - startedAt < timeoutMs) {
        info = await apiGetJson<ApiAnalyticsJobInfo>(`/analytics/jobs/${jobId}`);
        setJob(info);
        if (info.status === 'succeeded' || info.status === 'failed') break;
        await sleep(700);
      }

      if (!info) throw new Error('任务创建失败');
      if (info.status !== 'succeeded') throw new Error(info.error ?? `任务失败：${info.status}`);

      const arts = await apiGetJson<ApiArtifactsResponse>(`/analytics/jobs/${jobId}/artifacts`);
      setArtifacts(arts);
    } catch (error) {
      alert(`分析失败：${formatApiError(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">数据分析</h1>
            <Badge variant="info">deepseek</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">上传数据，DeepSeek 生成摘要与异常分析，并用 Python 绘制图表。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => void startAnalysis()} disabled={isRunning || !file}>
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            {isRunning ? '分析中...' : '开始分析'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">输入</p>
            <Badge variant={file ? 'success' : 'warning'}>{file ? 'ready' : 'upload'}</Badge>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleClickUpload}
              className={cn(
                'w-full min-h-[260px] border-2 border-dashed rounded-xl p-8',
                'flex flex-col items-center justify-center gap-4 cursor-pointer transition-all',
                isDragging
                  ? 'border-[#1337ec] bg-[#1337ec]/5 border-solid'
                  : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/60'
              )}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="size-16 rounded-full bg-[#1337ec]/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#1337ec] text-3xl">cloud_upload</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">
                    {isDragging ? '松开以上传文件' : '点击或拖拽文件到此处上传'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">支持 CSV、TXT、XLSX 格式文件</p>
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

            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-slate-500">分析需求</p>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：按日期绘制收入折线图，识别异常波动并给出解释"
              />
              <p className="text-[11px] text-slate-500">
                提示：尽量说明时间列、指标列、业务口径；如果是 xlsx 可说明 sheet 名。
              </p>
            </div>
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
              <div className="py-12 text-center text-sm text-slate-500">上传文件并点击“开始分析”。</div>
            ) : job.status === 'failed' ? (
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-900">失败原因</p>
                <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700">
                  {job.error ?? 'unknown error'}
                </pre>
                {job.detail && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500">进度信息</p>
                    <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 max-h-[200px] overflow-auto custom-scrollbar">
                      {job.detail}
                    </pre>
                  </div>
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
                {job.detail ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500">实时输出</p>
                    <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 max-h-[260px] overflow-auto custom-scrollbar">
                      {job.detail}
                    </pre>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">请稍候，任务正在运行…</div>
                )}
              </div>
            ) : (
              <>
                {(() => {
                  const summary = job.summary as any;
                  const llm = summary?.llm;
                  const llmText = typeof llm?.text === 'string' ? (llm.text as string) : '';
                  const highlights = Array.isArray(llm?.highlights) ? (llm.highlights as unknown[]) : [];
                  const suggestions = Array.isArray(llm?.suggestions) ? (llm.suggestions as unknown[]) : [];
                  if (!llmText && highlights.length === 0 && suggestions.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500">大模型摘要</p>
                      {llmText && (
                        <div className="text-sm whitespace-pre-wrap bg-white border border-slate-200 rounded-xl p-3 text-slate-800">
                          {llmText}
                        </div>
                      )}
                      {highlights.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {highlights.slice(0, 10).map((h, idx) => (
                            <span
                              key={`${idx}-${String(h).slice(0, 12)}`}
                              className="text-[11px] rounded-full bg-[#1337ec]/10 text-[#1337ec] px-3 py-1"
                            >
                              {String(h)}
                            </span>
                          ))}
                        </div>
                      )}
                      {suggestions.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-500">建议</p>
                          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                            {suggestions.slice(0, 8).map((s, idx) => (
                              <li key={`${idx}-${String(s).slice(0, 12)}`}>{String(s)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500">结构化结果 JSON</p>
                  <pre className="text-xs whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 max-h-[240px] overflow-auto custom-scrollbar">
                    {JSON.stringify(job.summary ?? {}, null, 2)}
                  </pre>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500">图表</p>
                  {chartArtifacts.length === 0 ? (
                    <p className="text-sm text-slate-500">未生成图表（请在需求中明确要绘制哪些图）。</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {chartArtifacts.map((a) => (
                        <div key={a.name} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-600">
                            {a.name}
                          </div>
                          <img
                            src={apiPublicUrl(`/analytics/jobs/${job.job_id}/artifacts/${encodeURIComponent(a.name)}`)}
                            alt={a.name}
                            className="w-full h-auto"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataAnalysis;
