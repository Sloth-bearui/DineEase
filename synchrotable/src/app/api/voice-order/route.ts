import { NextRequest, NextResponse } from 'next/server';
import { parseVoiceOrder } from '@/lib/voiceParser';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript } = body;
    const result = parseVoiceOrder(transcript || '');
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

