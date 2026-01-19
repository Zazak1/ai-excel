import { useMemo, useState, useRef } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';

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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reportText = useMemo(() => {
    const outline = templates[template].outline;
    const blocks = outline.map((section) => `## ${section}\n- ...\n`);
    const extra = notes.trim() ? `\n## 补充信息\n${notes.trim()}\n` : '';
    const filesInfo = uploadedFiles.length > 0 
      ? `\n## 上传文件\n${uploadedFiles.map((f) => `- ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join('\n')}\n`
      : '';
    return `# ${title}\n\n${blocks.join('\n')}${extra}${filesInfo}\n（基于上传文件分析生成的深度报告）\n`;
  }, [notes, template, title, uploadedFiles]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['doc', 'docx', 'pdf', 'txt'].includes(ext || '');
    });

    if (validFiles.length === 0) {
      alert('请选择 Word、PDF 或 TXT 文件');
      return;
    }

    setUploadedFiles((prev) => [...prev, ...validFiles]);
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

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    setPdfGenerated(false);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const htmlContent = reportText
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('# ')) {
            return `<h1 style="color: #1337ec; border-bottom: 2px solid #1337ec; padding-bottom: 10px; margin-top: 30px;">${trimmed.replace('# ', '')}</h1>`;
          }
          if (trimmed.startsWith('## ')) {
            return `<h2 style="color: #334155; margin-top: 25px; font-size: 1.25em;">${trimmed.replace('## ', '')}</h2>`;
          }
          if (trimmed.startsWith('- ')) {
            return `<li style="margin-left: 20px; margin-top: 8px;">${trimmed.replace('- ', '')}</li>`;
          }
          if (trimmed === '') {
            return '<br/>';
          }
          return `<p style="margin-top: 10px; line-height: 1.6;">${trimmed}</p>`;
        })
        .join('');

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap');
              body { 
                font-family: 'Noto Sans SC', sans-serif; 
                padding: 40px; 
                line-height: 1.6; 
                color: #1e293b;
                max-width: 800px;
                margin: 0 auto;
              }
              h1 { 
                color: #1337ec; 
                border-bottom: 2px solid #1337ec; 
                padding-bottom: 10px; 
                margin-top: 30px;
                font-size: 1.8em;
              }
              h2 { 
                color: #334155; 
                margin-top: 25px; 
                font-size: 1.25em;
              }
              ul { 
                margin-left: 20px; 
                margin-top: 10px;
              }
              li {
                margin-top: 8px;
              }
              p {
                margin-top: 10px;
              }
              @media print { 
                body { padding: 20px; }
                @page { margin: 2cm; }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
            ${uploadedFiles.length > 0 ? `
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <h2>附件列表</h2>
                <ul>
                  ${uploadedFiles.map((f) => `<li>${f.name} (${(f.size / 1024).toFixed(1)} KB)</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #64748b; font-size: 0.9em;">
              <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
            </div>
          </body>
        </html>
      `;

      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfGenerated(true);

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error('生成 PDF 失败:', error);
      alert('生成 PDF 失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(reportText);
  };

  const downloadPDF = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${title.replace(/[^\w\s]/gi, '')}_报告.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const totalFileSize = useMemo(() => {
    return uploadedFiles.reduce((sum, file) => sum + file.size, 0);
  }, [uploadedFiles]);


  // 生成报告数据图表数据
  const chartData = useMemo(() => {
    const baseData = template === 'weekly' 
      ? [
          { name: '周一', value: 85, target: 90 },
          { name: '周二', value: 92, target: 90 },
          { name: '周三', value: 78, target: 90 },
          { name: '周四', value: 95, target: 90 },
          { name: '周五', value: 88, target: 90 },
        ]
      : template === 'monthly'
      ? [
          { name: '第1周', value: 320, target: 350 },
          { name: '第2周', value: 380, target: 350 },
          { name: '第3周', value: 340, target: 350 },
          { name: '第4周', value: 365, target: 350 },
        ]
      : [
          { name: '阶段1', value: 65, target: 80 },
          { name: '阶段2', value: 78, target: 80 },
          { name: '阶段3', value: 82, target: 80 },
          { name: '阶段4', value: 88, target: 80 },
        ];
    
    return baseData;
  }, [template]);

  // 饼图数据 - 报告章节占比
  const pieData = useMemo(() => {
    const sections = templates[template].outline;
    const baseValues = [35, 28, 22, 15];
    return sections.map((section, index) => ({
      name: section,
      value: baseValues[index] || 10,
    }));
  }, [template]);

  const COLORS = ['#1337ec', '#3b82f6', '#60a5fa', '#93c5fd', '#cbd5e1'];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">深度报告</h1>
            <Badge variant="info">demo</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">上传 Word、PDF 文件，AI 分析生成深度报告并导出 PDF。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => void copyReport()}>
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
            复制
          </Button>
          <Button variant="primary" onClick={generatePDF} disabled={isGenerating || uploadedFiles.length === 0}>
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            {isGenerating ? '生成中...' : '生成 PDF 报告'}
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
              <p className="text-xs font-bold text-slate-500">文件上传</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx,.pdf,.txt"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClickUpload}
                className={cn(
                  'w-full min-h-32 border-2 border-dashed rounded-xl p-6',
                  'flex flex-col items-center justify-center gap-3',
                  'cursor-pointer transition-all',
                  isDragging
                    ? 'border-primary bg-primary-light border-solid'
                    : 'border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary-light/30'
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-2xl">upload_file</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-900">
                      {isDragging ? '松开以上传文件' : '点击或拖拽文件到此处上传'}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">支持 Word、PDF、TXT 格式</p>
                  </div>
                </div>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="material-symbols-outlined text-slate-400 text-sm">description</span>
                        <span className="text-xs font-medium text-slate-700 truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-400">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="ml-2 p-1 hover:bg-slate-100 rounded transition-colors"
                      >
                        <span className="material-symbols-outlined text-slate-400 text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">补充信息</p>
              <textarea
                className="w-full min-h-32 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 focus:ring-2 focus:ring-[#1337ec] focus:border-[#1337ec] focus:bg-white transition-colors"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="粘贴数据、关键结论、业务背景..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* PDF 下载区域 */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <p className="text-sm font-black text-slate-900">PDF 下载</p>
              <Badge variant={pdfGenerated ? 'success' : 'info'}>
                {pdfGenerated ? '已生成' : '待生成'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {pdfGenerated ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-emerald-900">PDF 报告已生成</p>
                      <p className="text-xs text-emerald-700 mt-0.5">点击下方按钮下载或打印</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={downloadPDF} className="flex-1">
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      下载 PDF
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (pdfUrl) {
                          const printWindow = window.open(pdfUrl, '_blank');
                          if (printWindow) {
                            setTimeout(() => printWindow.print(), 500);
                          }
                        }
                      }}
                      className="flex-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">print</span>
                      打印/预览
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-slate-400 text-3xl">picture_as_pdf</span>
                  </div>
                  <p className="text-sm font-bold text-slate-700 mb-1">PDF 报告尚未生成</p>
                  <p className="text-xs text-slate-500">上传文件后点击"生成 PDF 报告"按钮</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 关键数据看板 */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <p className="text-sm font-black text-slate-900">关键数据看板</p>
              <Badge variant="info">实时</Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 折线图 - 报告趋势数据 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-slate-400 text-sm">show_chart</span>
                  <p className="text-xs font-bold text-slate-500">报告数据趋势</p>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#1337ec" 
                        strokeWidth={2}
                        dot={{ fill: '#1337ec', r: 4 }}
                        name="实际值"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="target" 
                        stroke="#94a3b8" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ fill: '#94a3b8', r: 4 }}
                        name="目标值"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 饼图 - 报告章节占比 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-slate-400 text-sm">pie_chart</span>
                  <p className="text-xs font-bold text-slate-500">报告章节占比</p>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                        fontSize={11}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200">
                <div className="text-center">
                  <p className="text-lg font-black text-slate-900">{uploadedFiles.length}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">上传文件</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-slate-900">
                    {totalFileSize > 1024 * 1024
                      ? (totalFileSize / (1024 * 1024)).toFixed(1)
                      : (totalFileSize / 1024).toFixed(1)}
                    {totalFileSize > 1024 * 1024 ? 'MB' : 'KB'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">文件大小</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-slate-900">{templates[template].outline.length}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">报告章节</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;
