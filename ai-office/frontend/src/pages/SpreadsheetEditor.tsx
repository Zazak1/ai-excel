import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import {
  apiDownloadBlob,
  apiGetJson,
  apiPostFormJson,
  type ApiError,
  type ApiExcelJobCreateResponse,
  type ApiExcelJobInfo,
} from '../lib/api';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  file?: File;
  excelData?: any[][];
  timestamp: Date;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  const e = error as Partial<ApiError> | null | undefined;
  return e?.message ?? '请求失败';
}

function extractXlsxFilename(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, '');
  return `processed-${base}.xlsx`;
}

const SpreadsheetEditor = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentExcelData, setCurrentExcelData] = useState<any[][]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [lastOutputFile, setLastOutputFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const readExcelFile = async (file: File): Promise<{ data: any[][]; headers: string[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
          const dataArray = jsonData as any[][];
          const headers = dataArray[0] || [];
          resolve({ data: dataArray, headers: headers.map(String) });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const runBackendJob = async (file: File, userPrompt: string): Promise<{ job: ApiExcelJobInfo; output: File }> => {
    const formData = new FormData();
    formData.append('prompt', userPrompt);
    formData.append('file', file, file.name);

    const created = await apiPostFormJson<ApiExcelJobCreateResponse>('/excel/jobs', formData);
    const jobId = created.job_id;

    let job: ApiExcelJobInfo | null = null;
    const startedAt = Date.now();
    const timeoutMs = 120_000;

    while (Date.now() - startedAt < timeoutMs) {
      job = await apiGetJson<ApiExcelJobInfo>(`/excel/jobs/${jobId}`);
      if (job.status === 'succeeded' || job.status === 'failed') break;
      await sleep(500);
    }

    if (!job) throw new Error('任务创建失败');
    if (job.status !== 'succeeded' && job.status !== 'failed') {
      throw new Error(`任务超时（job_id=${jobId}，status=${job.status}）`);
    }
    if (job.status !== 'succeeded') {
      throw new Error(job.error ?? `任务失败：${job.status}`);
    }

    const blob = await apiDownloadBlob(`/excel/jobs/${jobId}/download`);
    const outputName = extractXlsxFilename(file.name);
    const outputFile = new File([blob], outputName, {
      type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return { job, output: outputFile };
  };

  const handleFileUpload = async (file: File) => {
    try {
      const { data, headers } = await readExcelFile(file);
      setCurrentExcelData(data);
      setExcelHeaders(headers);
      setCurrentFile(file);
      setLastOutputFile(null);

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: `上传了文件：${file.name}`,
        file,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // AI 自动分析文件
      setIsProcessing(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `已成功读取文件 "${file.name}"。\n\n文件信息：\n- 行数：${data.length}\n- 列数：${headers.length}\n- 列名：${headers.join(', ')}\n\n我可以帮您：\n1. 数据排序和筛选\n2. 数据汇总和计算\n3. 数据清洗和格式化\n4. 生成图表和报告\n\n请告诉我您需要如何处理这些数据？`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsProcessing(false);
    } catch (error) {
      console.error('读取文件失败:', error);
      alert('读取 Excel 文件失败，请确保文件格式正确');
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() && !fileInputRef.current?.files?.length) return;

    const file = fileInputRef.current?.files?.[0];
    const prompt = inputValue.trim();

    // 处理文件上传
    if (file) {
      await handleFileUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setInputValue('');
      return;
    }

    // 处理文本消息
    if (!prompt) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    if (!currentFile) {
      setIsProcessing(true);
      await sleep(400);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '请先上传一个 .xlsx 文件，然后再告诉我你希望如何处理（例如：透视表、跨表合并、公式列等）。',
          timestamp: new Date(),
        },
      ]);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `已提交后端任务，正在处理：${prompt}`,
        timestamp: new Date(),
      },
    ]);

    try {
      const { job, output } = await runBackendJob(currentFile, prompt);
      const { data, headers } = await readExcelFile(output);
      setCurrentExcelData(data);
      setExcelHeaders(headers);
      setCurrentFile(output);
      setLastOutputFile(output);

      const summaryText =
        job.summary != null ? `\n\n摘要：\n${JSON.stringify(job.summary, null, 2)}` : '';

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `处理完成（job_id=${job.job_id}）。结果已更新到右侧预览区，点击右上角“下载”可获取新文件。${summaryText}`,
          excelData: data,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      const message = formatApiError(error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `处理失败：${message}\n\n请确认后端已启动（/api/health），且已配置 DEEPSEEK_API_KEY。`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const downloadExcel = () => {
    if (lastOutputFile) {
      const url = URL.createObjectURL(lastOutputFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = lastOutputFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    if (currentExcelData.length === 0) return;

    const ws = XLSX.utils.aoa_to_sheet(currentExcelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'processed_data.xlsx');
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

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.match(/\.(xlsx)$/i)) {
        await handleFileUpload(file);
      } else {
        alert('请上传 Excel 文件（.xlsx）');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">AI 智能表格</h1>
            <Badge variant="info">demo</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">上传 Excel 文件，AI 助手帮您智能处理数据。</p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-180px)] gap-4">
      {/* 左侧：AI 助手聊天界面 (2/3) */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* 聊天头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="size-8 bg-[#1337ec] rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">auto_awesome</span>
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">AI 表格助手</h2>
              <p className="text-[10px] text-slate-500">智能处理 Excel 数据</p>
            </div>
          </div>
          <Badge variant="info">在线</Badge>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="size-16 rounded-full bg-[#1337ec]/10 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[#1337ec] text-3xl">table_chart</span>
              </div>
              <p className="text-sm font-bold text-slate-700 mb-1">开始使用 AI 表格助手</p>
              <p className="text-xs text-slate-500">上传 Excel 文件，告诉我您需要如何处理数据</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="size-8 rounded-full bg-[#1337ec]/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#1337ec] text-sm">auto_awesome</span>
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-xl px-4 py-3',
                    message.role === 'user'
                      ? 'bg-[#1337ec] text-white shadow-lg shadow-blue-200/40'
                      : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                  )}
                >
                  {message.file && (
                    <div className="mb-2 flex items-center gap-2 text-xs opacity-90">
                      <span className="material-symbols-outlined text-sm">description</span>
                      <span>{message.file.name}</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <p
                    className={cn(
                      'text-[10px] mt-2',
                      message.role === 'user' ? 'text-white/80' : 'text-slate-500'
                    )}
                  >
                    {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-slate-600 text-sm">person</span>
                  </div>
                )}
              </div>
            ))
          )}
          {isProcessing && (
            <div className="flex gap-3 justify-start">
              <div className="size-8 rounded-full bg-[#1337ec]/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[#1337ec] text-sm">auto_awesome</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div
          className={cn(
            'border-t border-slate-200 p-4 transition-colors',
            isDragging && 'bg-[#1337ec]/5'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">attach_file</span>
            </Button>
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={isDragging ? '松开以上传文件' : '输入消息或拖拽 Excel 文件到此处...'}
                className={cn(
                  'w-full min-h-[44px] max-h-32 px-4 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#1337ec] focus:border-[#1337ec] focus:bg-white transition-colors resize-none',
                  isDragging ? 'border-[#1337ec] border-2 border-dashed' : 'border-slate-200'
                )}
                rows={1}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSendMessage}
              disabled={isProcessing || (!inputValue.trim() && (!fileInputRef.current || !fileInputRef.current.files?.length))}
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            {isDragging ? '松开鼠标以上传文件' : '支持拖拽 Excel 文件到输入框，或按 Enter 发送消息'}
          </p>
        </div>
      </div>

      {/* 右侧：表格预览 (1/3) */}
      <div className="w-1/3 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-sm">preview</span>
            <h3 className="text-sm font-black text-slate-900">表格预览</h3>
          </div>
          {currentExcelData.length > 0 && (
            <Button variant="secondary" size="sm" onClick={downloadExcel}>
              <span className="material-symbols-outlined text-[16px]">download</span>
              下载
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {currentExcelData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-slate-400 text-3xl">table_chart</span>
              </div>
              <p className="text-sm font-bold text-slate-700 mb-1">暂无数据</p>
              <p className="text-xs text-slate-500">上传 Excel 文件后，处理结果将显示在这里</p>
            </div>
          ) : (
            <div className="p-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {excelHeaders.map((header, index) => (
                          <th
                            key={index}
                            className="bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 text-left min-w-[100px]"
                          >
                            {header || `列 ${index + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentExcelData.slice(1).map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-slate-50">
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="border border-slate-200 px-3 py-2 text-xs text-slate-800"
                            >
                              {cell !== null && cell !== undefined ? String(cell) : ''}
                            </td>
                          ))}
                          {/* 填充空列 */}
                          {row.length < excelHeaders.length &&
                            Array.from({ length: excelHeaders.length - row.length }).map((_, i) => (
                              <td
                                key={`empty-${i}`}
                                className="border border-slate-200 px-3 py-2 text-xs text-slate-300"
                              >
                                —
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500 text-center">
                共 {currentExcelData.length - 1} 行 × {excelHeaders.length} 列
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default SpreadsheetEditor;
