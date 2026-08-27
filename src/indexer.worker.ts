/// <reference lib="webworker" />
import { MboxStreamIndexer } from './mbox-scanner';
import type { MessageRecord } from './parser';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let cancelled = false;
const READ_CHUNK_BYTES = 4 * 1024 * 1024;
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
  let compressedRead = 0;
  const indexer = new MboxStreamIndexer(archiveId);
  let batch: MessageRecord[] = [];
  let lastProgress = 0;
  const addRecords = (records: MessageRecord[]) => {
    batch.push(...records);
    if (batch.length >= 200) {
      ctx.postMessage({ type: 'batch', records: batch });
      batch = [];
    }
  };

  const consume = (value: Uint8Array) => {
    compressedRead += gzip ? value.byteLength : 0;
    addRecords(indexer.write(value));
    const now = performance.now();
    if (now - lastProgress > 120) {
      lastProgress = now;
      ctx.postMessage({ type: 'progress', bytes: gzip ? Math.min(file.size, compressedRead) : indexer.bytesRead, expandedBytes: indexer.bytesRead, count: indexer.messageCount, total: file.size });
    }
  };

  if (gzip) {
    if (!('DecompressionStream' in self)) throw new Error('This browser cannot open gzip streams. Extract the .mbox file first.');
    const reader = file.stream().pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>).getReader();
    while (true) {
      if (cancelled) { await reader.cancel(); ctx.postMessage({ type: 'cancelled' }); return; }
      const { done, value } = await reader.read();
      if (done) break;
      consume(value);
    }
  } else {
    // File.stream() commonly delivers 64 KiB chunks. Four MiB slices cut
    // stream/message overhead by 64× while still keeping worker memory fixed.
    for (let offset = 0; offset < file.size; offset += READ_CHUNK_BYTES) {
      if (cancelled) { ctx.postMessage({ type: 'cancelled' }); return; }
      consume(new Uint8Array(await file.slice(offset, Math.min(file.size, offset + READ_CHUNK_BYTES)).arrayBuffer()));
    }
  }
  const final = indexer.finishStream();
  if (final) batch.push(final);
  if (batch.length) ctx.postMessage({ type: 'batch', records: batch });
  ctx.postMessage({ type: 'done', count: indexer.messageCount, bytes: indexer.bytesRead });
}
