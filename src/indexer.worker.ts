/// <reference lib="webworker" />
import { indexRecordFromPrefix, type MessageRecord } from './parser';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let cancelled = false;
const PREFIX_LIMIT = 196_608;

ctx.onmessage = (event: MessageEvent<{ type: string; file?: File; archiveId?: string; gzip?: boolean }>) => {
  if (event.data.type === 'cancel') { cancelled = true; return; }
  if (event.data.type === 'start' && event.data.file && event.data.archiveId) {
    cancelled = false;
    indexFile(event.data.file, event.data.archiveId, Boolean(event.data.gzip)).catch((error: unknown) => {
      ctx.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Could not read this archive.' });
    });
  }
};

async function indexFile(file: File, archiveId: string, gzip: boolean): Promise<void> {
  let stream: ReadableStream<Uint8Array> = file.stream();
  if (gzip) {
    if (!('DecompressionStream' in self)) throw new Error('This browser cannot open gzip streams. Extract the .mbox file first.');
    stream = stream.pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>);
  }
  const reader = stream.getReader();
  let currentStart = 0;
  let absolute = 0;
  let compressedRead = 0;
  let prefix: number[] = [];
  let recent = '';
  let id = 0;
  let batch: MessageRecord[] = [];
  let lastProgress = 0;

  const finish = (end: number) => {
    if (end <= currentStart || prefix.length < 5) return;
    const bytes = new Uint8Array(prefix);
    batch.push(indexRecordFromPrefix(bytes, { archiveId, id: id++, start: currentStart, end, size: end - currentStart }));
    if (batch.length >= 200) {
      ctx.postMessage({ type: 'batch', records: batch });
      batch = [];
    }
  };

  while (true) {
    if (cancelled) { await reader.cancel(); ctx.postMessage({ type: 'cancelled' }); return; }
    const { done, value } = await reader.read();
    if (done) break;
    compressedRead += gzip ? value.byteLength : 0;
    for (let i = 0; i < value.length; i++) {
      const byte = value[i];
      if (prefix.length < PREFIX_LIMIT) prefix.push(byte);
      recent = (recent + String.fromCharCode(byte)).slice(-6);
      if (recent === '\nFrom ') {
        const nextStart = absolute - 4;
        if (nextStart > currentStart) {
          if (prefix.length < PREFIX_LIMIT) prefix.splice(Math.max(0, prefix.length - 5), 5);
          finish(nextStart - 1);
          currentStart = nextStart;
          prefix = [70, 114, 111, 109, 32];
        }
      }
      absolute++;
    }
    const now = performance.now();
    if (now - lastProgress > 120) {
      lastProgress = now;
      ctx.postMessage({ type: 'progress', bytes: gzip ? Math.min(file.size, compressedRead) : absolute, expandedBytes: absolute, count: id, total: file.size });
    }
  }
  finish(absolute);
  if (batch.length) ctx.postMessage({ type: 'batch', records: batch });
  ctx.postMessage({ type: 'done', count: id, bytes: absolute });
}
