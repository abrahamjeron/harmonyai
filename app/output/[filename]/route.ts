import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize — only allow simple filenames, no path traversal
  if (!filename || /[/\\]/.test(filename) || !filename.endsWith('.wav')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filePath = path.resolve(
    process.cwd(),
    'app/lib/agent/output',
    filename
  );

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
