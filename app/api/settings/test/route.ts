import { NextResponse } from 'next/server';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { ProviderSettings } from '@/lib/types';

async function testCustomProvider(baseUrl: string, apiKey: string, model: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 10,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[${response.status}] ${url} - ${text}`);
  }

  return response.json();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, apiKey, baseUrl, defaultModel } = body as ProviderSettings;

    if (!provider || !defaultModel) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    if (provider === 'custom' && !baseUrl) {
      return NextResponse.json(
        { error: '自定义提供商需要 Base URL' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    if (provider === 'custom') {
      if (!apiKey) {
        return NextResponse.json(
          { error: '自定义提供商需要填写 API 密钥' },
          { status: 400 }
        );
      }
      
      const result = await testCustomProvider(baseUrl!, apiKey, defaultModel);
      const latency = Date.now() - startTime;
      const responseText = result.choices?.[0]?.message?.content || 'OK';

      return NextResponse.json({
        success: true,
        message: '连接成功',
        latency,
        response: responseText,
      });
    }

    let model: ReturnType<ReturnType<typeof createAnthropic>> | ReturnType<ReturnType<typeof createOpenAI>>;
    switch (provider) {
      case 'anthropic': {
        const key = apiKey || process.env.ANTHROPIC_API_KEY;
        if (!key) {
          return NextResponse.json(
            { error: '未配置 Anthropic API 密钥（请在设置中填写或设置 ANTHROPIC_API_KEY 环境变量）' },
            { status: 400 }
          );
        }
        const anthropicProvider = createAnthropic({ apiKey: key });
        model = anthropicProvider(defaultModel);
        break;
      }
      case 'openai': {
        const key = apiKey || process.env.OPENAI_API_KEY;
        if (!key) {
          return NextResponse.json(
            { error: '未配置 OpenAI API 密钥（请在设置中填写或设置 OPENAI_API_KEY 环境变量）' },
            { status: 400 }
          );
        }
        const openaiProvider = createOpenAI({ apiKey: key });
        model = openaiProvider(defaultModel);
        break;
      }
      default:
        return NextResponse.json(
          { error: '不支持的提供商类型' },
          { status: 400 }
        );
    }

    const result = await generateText({
      model,
      prompt: 'Say "OK" and nothing else.',
      maxOutputTokens: 10,
    });
    const latency = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: '连接成功',
      latency,
      response: result.text.trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '连接失败';
    
    let userFriendlyMessage = message;
    if (message.includes('401') || message.includes('Unauthorized') || message.includes('invalid_api_key')) {
      userFriendlyMessage = 'API 密钥无效';
    } else if (message.includes('404') || message.includes('not found')) {
      userFriendlyMessage = '模型不存在或 URL 错误';
    } else if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      userFriendlyMessage = '无法连接到服务器';
    } else if (message.includes('timeout')) {
      userFriendlyMessage = '连接超时';
    }

    return NextResponse.json(
      { error: userFriendlyMessage, details: message },
      { status: 400 }
    );
  }
}
