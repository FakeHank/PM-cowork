'use client';

import { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff, RotateCcw, Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownPreview } from '@/components/files/markdown-preview';
import { useSettingsStore } from '@/stores/app-store';
import {
  BUILTIN_MODELS,
  type ProviderType,
  type ProviderSettings,
} from '@/lib/types';

const PROVIDERS: { id: ProviderType; name: string }[] = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'custom', name: '自定义 (OpenAI 兼容)' },
];
const MARKDOWN_PREVIEW_SAMPLE = `# Markdown Preview / 预览示例
简短示例，覆盖常见元素。

## Headings / 标题
# H1 标题
## H2 标题
### H3 标题

## Text / 文本
**Bold 粗体** *Italic 斜体* ~~Delete 删除~~ \`inline code 行内代码\`

## Quote / 引用
> Design is how it works.  
> 设计就是它如何工作。

## Lists / 列表
- Item A / 项目 A
- Item B / 项目 B
  - Nested / 子项

1. Step 1 / 步骤一
2. Step 2 / 步骤二

## Tasks / 任务
- [ ] Todo / 待办
- [x] Done / 已完成

## Link / 链接
[Google 搜索](https://google.com "Hover 提示")

## Code / 代码
\`\`\`ts
const title: string = "Markdown 预览";
console.log(title);
\`\`\`

## Table / 表格
| Name / 名称 | Status / 状态 |
| :-- | --: |
| Preview | OK |
| CSS | OK |

## Image / 图片
![图片名称](链接 "提示")

---

\\#\\# \\* \\_ \\+ \\\`  (Escapes / 跳脱)

tags: Markdown 教学 · HackMD`;

export default function SettingsPage() {
  const { settings, setSettings, resetSettings } = useSettingsStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  
  const [provider, setProvider] = useState<ProviderType>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [markdownCss, setMarkdownCss] = useState('');
  const [isCssLoading, setIsCssLoading] = useState(true);
  const [isCssSaving, setIsCssSaving] = useState(false);
  const [cssError, setCssError] = useState<string | null>(null);
  const [cssSaved, setCssSaved] = useState(false);
  const [markdownCssTab, setMarkdownCssTab] = useState<'code' | 'preview'>('code');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        const result = await response.json();
        if (result.data) {
          const { provider: p } = result.data;
          setProvider(p.provider);
          setApiKey(p.apiKey || '');
          setBaseUrl(p.baseUrl || '');
          setDefaultModel(p.defaultModel);
          if (p.provider === 'custom') {
            setCustomModel(p.defaultModel);
          }
          setSettings(result.data);
        }
      } catch {
        setError('加载设置失败');
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [setSettings]);

  useEffect(() => {
    const loadMarkdownCss = async () => {
      setIsCssLoading(true);
      setCssError(null);
      try {
        const response = await fetch('/api/settings/markdown-css');
        const result = await response.json();
        if (response.ok && result.data?.css !== undefined) {
          setMarkdownCss(result.data.css);
        } else {
          setCssError(result.error || '加载 CSS 失败');
        }
      } catch {
        setCssError('加载 CSS 失败');
      } finally {
        setIsCssLoading(false);
      }
    };
    loadMarkdownCss();
  }, []);

  useEffect(() => {
    if (provider !== 'custom') {
      const models = BUILTIN_MODELS[provider];
      if (models && models.length > 0) {
        const currentModelExists = models.some((m) => m.id === defaultModel);
        if (!currentModelExists) {
          setDefaultModel(models[0].id);
        }
      }
    }
  }, [provider, defaultModel]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setError(null);
    setTestResult(null);

    const testSettings: ProviderSettings = {
      provider,
      defaultModel: provider === 'custom' ? customModel : defaultModel,
      ...(apiKey && { apiKey }),
      ...(provider === 'custom' && baseUrl && { baseUrl }),
    };

    if (provider === 'custom' && !baseUrl) {
      setError('自定义提供商需要填写 Base URL');
      setIsTesting(false);
      return;
    }

    if (provider === 'custom' && !customModel) {
      setError('请填写模型名称');
      setIsTesting(false);
      return;
    }

    try {
      const response = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testSettings),
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: `连接成功 (${result.latency}ms)`,
          latency: result.latency,
        });
      } else {
        const errorMsg = result.details && result.details !== result.error
          ? `${result.error}\n${result.details}`
          : (result.error || '连接失败');
        setTestResult({
          success: false,
          message: errorMsg,
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: '网络错误，无法测试连接',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    setTestResult(null);

    const providerSettings: ProviderSettings = {
      provider,
      defaultModel: provider === 'custom' ? customModel : defaultModel,
      ...(apiKey && { apiKey }),
      ...(provider === 'custom' && baseUrl && { baseUrl }),
    };
    const nextSettings = {
      ...settings,
      provider: providerSettings,
    };

    if (provider === 'custom' && !baseUrl) {
      setError('自定义提供商需要填写 Base URL');
      setIsSaving(false);
      return;
    }

    if (provider === 'custom' && !customModel) {
      setError('请填写模型名称');
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '保存失败');
      }

      setSettings(nextSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存设置失败');
    } finally {
      setIsSaving(false);
    }
  };

  const applyMarkdownCss = (css: string) => {
    const styleTag = document.getElementById('pmwork-markdown-css');
    if (styleTag) {
      styleTag.textContent = css;
    }
  };

  const handleSaveMarkdownCss = async () => {
    setIsCssSaving(true);
    setCssError(null);
    setCssSaved(false);

    try {
      const response = await fetch('/api/settings/markdown-css', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ css: markdownCss }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '保存 CSS 失败');
      }

      applyMarkdownCss(markdownCss);
      setCssSaved(true);
      setTimeout(() => setCssSaved(false), 2000);
    } catch (err) {
      setCssError(err instanceof Error ? err.message : '保存 CSS 失败');
    } finally {
      setIsCssSaving(false);
    }
  };

  const handleReloadMarkdownCss = async () => {
    setIsCssLoading(true);
    setCssError(null);
    try {
      const response = await fetch('/api/settings/markdown-css');
      const result = await response.json();
      if (response.ok && result.data?.css !== undefined) {
        setMarkdownCss(result.data.css);
        applyMarkdownCss(result.data.css);
      } else {
        setCssError(result.error || '加载 CSS 失败');
      }
    } catch {
      setCssError('加载 CSS 失败');
    } finally {
      setIsCssLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('确定要重置为默认设置吗？')) {
      resetSettings();
      setProvider('anthropic');
      setApiKey('');
      setBaseUrl('');
      setDefaultModel('claude-sonnet-4-20250514');
      setCustomModel('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <header className="border-b bg-gradient-to-b from-muted/40 via-background to-background">
          <div className="px-8 py-6">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <div className="px-8 py-8">
            <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
              <Skeleton className="h-48 w-full" />
              <div className="space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const availableModels = provider !== 'custom' ? BUILTIN_MODELS[provider] : [];
  const sections = [
    { id: 'provider', title: '模型提供商', description: '连接模型与鉴权配置' },
    { id: 'markdown-css', title: 'Markdown CSS', description: '自定义预览样式' },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-gradient-to-b from-muted/40 via-background to-background">
        <div className="px-8 py-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
            <p className="text-sm text-muted-foreground mt-1">
              集中管理模型、Markdown 与界面体验，后续扩展可直接挂载到左侧分组。
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="px-8 py-8">
          <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-6 space-y-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  分组
                </div>
                <div className="space-y-2">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="flex flex-col rounded-lg border border-transparent px-3 py-2 text-sm transition hover:border-border hover:bg-muted/40"
                    >
                      <span className="font-medium text-foreground">{section.title}</span>
                      <span className="text-xs text-muted-foreground">{section.description}</span>
                    </a>
                  ))}
                </div>
              </div>
            </aside>

            <div className="space-y-6 min-w-0">
              <Card id="provider" className="scroll-mt-28">
                <CardHeader>
                  <CardTitle className="text-base">模型提供商</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    选择模型、配置密钥与连接方式。
                  </p>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div className="space-y-2">
                    <span className="text-sm font-medium">提供商</span>
                    <div className="flex gap-2 flex-wrap" role="group" aria-label="提供商选择">
                      {PROVIDERS.map((p) => (
                        <Button
                          key={p.id}
                          variant={provider === p.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setProvider(p.id)}
                        >
                          {p.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="api-key" className="text-sm font-medium">
                      API 密钥
                      {provider !== 'custom' && (
                        <span className="text-muted-foreground font-normal ml-2">
                          (可选，留空使用环境变量)
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="api-key"
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={provider === 'custom' ? 'sk-...' : '留空使用环境变量'}
                        className="font-mono"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {provider === 'custom' && (
                    <div className="space-y-2">
                      <label htmlFor="base-url" className="text-sm font-medium">Base URL</label>
                      <Input
                        id="base-url"
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://api.example.com/v1"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {provider === 'custom' ? (
                      <>
                        <label htmlFor="custom-model" className="text-sm font-medium">模型</label>
                        <Input
                          id="custom-model"
                          value={customModel}
                          onChange={(e) => setCustomModel(e.target.value)}
                          placeholder="gpt-4o, llama-3.1-70b, etc."
                        />
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium">模型</span>
                        <div className="flex gap-2 flex-wrap" role="group" aria-label="模型选择">
                          {availableModels.map((m) => (
                            <Button
                              key={m.id}
                              variant={defaultModel === m.id ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setDefaultModel(m.id)}
                            >
                              {m.name}
                            </Button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {(error || testResult) && (
                    <div className="space-y-3">
                      {error && (
                        <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">
                          {error}
                        </div>
                      )}
                      {testResult && (
                        <div className={`text-sm px-4 py-2 rounded-md whitespace-pre-wrap ${
                          testResult.success 
                            ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950' 
                            : 'text-destructive bg-destructive/10'
                        }`}>
                          {testResult.message}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                    <Button onClick={handleSave} disabled={isSaving || isTesting}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : saveSuccess ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : null}
                      {saveSuccess ? '已保存' : '保存设置'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isTesting || isSaving}
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      测试连接
                    </Button>
                    <Button variant="ghost" onClick={handleReset} disabled={isSaving || isTesting}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      重置
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card id="markdown-css" className="scroll-mt-28">
                <CardHeader>
                  <CardTitle className="text-base">Markdown CSS</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    直接编辑预览样式，适合高级自定义。
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <style
                    dangerouslySetInnerHTML={{ __html: markdownCss }}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div
                      className="inline-flex rounded-full border bg-muted/40 p-1 text-xs"
                      role="tablist"
                      aria-label="Markdown CSS 模式切换"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={markdownCssTab === 'code'}
                        className={`rounded-full px-3 py-1.5 font-medium transition ${
                          markdownCssTab === 'code'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setMarkdownCssTab('code')}
                      >
                        代码
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={markdownCssTab === 'preview'}
                        className={`rounded-full px-3 py-1.5 font-medium transition ${
                          markdownCssTab === 'preview'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setMarkdownCssTab('preview')}
                      >
                        预览
                      </button>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      预览渲染与 workspace 保持一致
                    </div>
                  </div>

                  {markdownCssTab === 'code' ? (
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">
                        该文件会直接应用到预览样式：<span className="font-mono break-all">app/markdown-preview.css</span>
                      </div>
                      <Textarea
                        value={markdownCss}
                        onChange={(e) => setMarkdownCss(e.target.value)}
                        placeholder="在这里编辑 Markdown 预览 CSS"
                        className="min-h-[280px] font-mono text-xs leading-relaxed"
                        disabled={isCssLoading}
                      />
                      {cssError && (
                        <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                          {cssError}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <Button onClick={handleSaveMarkdownCss} disabled={isCssSaving || isCssLoading}>
                          {isCssSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : cssSaved ? (
                            <Check className="h-4 w-4 mr-2" />
                          ) : null}
                          {cssSaved ? '已保存' : '保存 CSS'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleReloadMarkdownCss}
                          disabled={isCssSaving || isCssLoading}
                        >
                          重新加载
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-muted/30 overflow-hidden">
                      <div className="flex items-center justify-between border-b px-4 py-2">
                        <span className="text-xs font-medium text-muted-foreground">预览</span>
                        <span className="text-[11px] text-muted-foreground">实时刷新</span>
                      </div>
                      <ScrollArea className="h-[460px] max-h-[60vh] w-full">
                        <div className="p-4 min-w-0 w-full">
                          <MarkdownPreview content={MARKDOWN_PREVIEW_SAMPLE} />
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
