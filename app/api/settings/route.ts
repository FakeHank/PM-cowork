import { NextResponse } from 'next/server';
import { readJson, writeJson, SETTINGS_FILE } from '@/lib/fs';
import { DEFAULT_MARKDOWN_SETTINGS, type AppSettings } from '@/lib/types';

const DEFAULT_SETTINGS: AppSettings = {
  provider: {
    provider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  theme: 'system',
  markdown: DEFAULT_MARKDOWN_SETTINGS,
};

const normalizeSettings = (settings?: AppSettings): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  provider: { ...DEFAULT_SETTINGS.provider, ...settings?.provider },
  markdown: { ...DEFAULT_MARKDOWN_SETTINGS, ...settings?.markdown },
});

export async function GET() {
  const settings = await readJson<AppSettings>(SETTINGS_FILE);
  return NextResponse.json({ data: normalizeSettings(settings || undefined) });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const incoming = body as AppSettings;
    
    if (!incoming.provider?.provider || !incoming.provider?.defaultModel) {
      return NextResponse.json(
        { error: 'Invalid settings: provider and defaultModel required' },
        { status: 400 }
      );
    }
    
    if (incoming.provider.provider === 'custom' && !incoming.provider.baseUrl) {
      return NextResponse.json(
        { error: 'Custom provider requires baseUrl' },
        { status: 400 }
      );
    }
    
    const settings = normalizeSettings(incoming);
    await writeJson(SETTINGS_FILE, settings);
    return NextResponse.json({ data: settings });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
