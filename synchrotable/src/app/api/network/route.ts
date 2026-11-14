import os from 'os';
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// Returns the public HTTPS tunnel URL (for Android/4G/Wi-Fi QR scanning) and LAN address fallback.
export async function GET() {
  const addrs: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) addrs.push(ni.address);
    }
  }
  const preferred =
    addrs.find((a) => a.startsWith('192.168.')) ||
    addrs.find((a) => a.startsWith('172.20.')) ||
    addrs.find((a) => a.startsWith('10.')) ||
    addrs[0] ||
    'localhost';

  let publicUrl = process.env.PUBLIC_TUNNEL_URL || '';
  try {
    const p = path.join(process.cwd(), '.tunnel_url');
    if (fs.existsSync(p)) {
      publicUrl = fs.readFileSync(p, 'utf8').trim();
    }
  } catch {
    // ignore
  }

  return NextResponse.json({
    host: preferred,
    port: process.env.PORT || '3001',
    publicUrl,
    all: addrs,
  });
}
