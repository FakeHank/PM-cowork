'use client';

import { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff, RotateCcw, Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettingsStore } from '@/stores/app-store';
import { BUILTIN_MODELS, type ProviderType, type ProviderSettings } from '@/lib/types';

const PROVIDERS: { id: ProviderType; name: string }[] = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'custom', name: '自定义 (OpenAI 兼容)' },
];

export default function SettingsPage() {
  const { settings, setProviderSettings, resetSettings } = useSettingsStore();
  
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
          setProviderSettings(p);
        }
      } catch {
        setError('加载设置失败');
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [setProviderSettings]);

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
        body: JSON.stringify({
          provider: providerSettings,
          theme: settings.theme,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '保存失败');
      }

      setProviderSettings(providerSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存设置失败');
    } finally {
      setIsSaving(false);
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
        <header className="flex items-center justify-between px-6 py-4 border-b">
          <h1 className="text-xl font-semibold">设置</h1>
        </header>
        <div className="flex-1 p-6 space-y-6">
          <Skeleton className="h-48 w-full max-w-2xl" />
          <Skeleton className="h-32 w-full max-w-2xl" />
        </div>
      </div>
    );
  }

  const availableModels = provider !== 'custom' ? BUILTIN_MODELS[provider] : [];

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold">设置</h1>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">模型提供商</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

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

          <div className="flex items-center gap-4">
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
        </div>
      </div>
    </div>
  );
}
