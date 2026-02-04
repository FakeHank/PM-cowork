import { NextResponse } from 'next/server';
import { readJson, writeJson, SETTINGS_FILE } from '@/lib/fs';
import type { AppSettings } from '@/lib/types';

const DEFAULT_SETTINGS: AppSettings = {
  provider: {
    provider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  theme: 'system',
};

export async function GET() {
  const settings = await readJson<AppSettings>(SETTINGS_FILE);
  return NextResponse.json({ data: settings || DEFAULT_SETTINGS });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const settings = body as AppSettings;
    
    if (!settings.provider?.provider || !settings.provider?.defaultModel) {
      return NextResponse.json(
        { error: 'Invalid settings: provider and defaultModel required' },
        { status: 400 }
      );
    }
    
    if (settings.provider.provider === 'custom' && !settings.provider.baseUrl) {
      return NextResponse.json(
        { error: 'Custom provider requires baseUrl' },
        { status: 400 }
      );
    }
    
    await writeJson(SETTINGS_FILE, settings);
    return NextResponse.json({ data: settings });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
