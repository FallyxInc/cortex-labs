import { NextRequest, NextResponse } from 'next/server';

// Import the shared progress store from process-behaviours
// Note: In production, use Redis or database for shared state
export const progressStore = new Map<string, { percentage: number; message: string; step: string }>();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const progress = progressStore.get(jobId);
  
  if (!progress) {
    return NextResponse.json({ percentage: 0, message: 'Processing not started', step: 'initializing' });
  }

  return NextResponse.json(progress);
}

export async function POST(request: NextRequest) {
  const { jobId, percentage, message, step } = await request.json();

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  progressStore.set(jobId, { percentage, message, step });

  // Clean up old progress entries (older than 1 hour)
  setTimeout(() => {
    progressStore.delete(jobId);
  }, 3600000); // 1 hour

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get('jobId');

  if (jobId) {
    progressStore.delete(jobId);
  }

  return NextResponse.json({ success: true });
}

