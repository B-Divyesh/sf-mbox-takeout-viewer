/// <reference lib="webworker" />
import { hasMboxEnvelopeStart, MboxStreamIndexer } from './mbox-scanner';
import { fileReadRanges } from './file-read-plan';
import type { MessageRecord } from './parser';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let cancelled = false;
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
  let envelopeChecked = false;
  let envelopePrefix: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  const addRecords = (records: MessageRecord[]) => {
    batch.push(...records);
    if (batch.length >= 200) {
      ctx.postMessage({ type: 'batch', records: batch });
      batch = [];
    }
  };

  const consume = (chunk: Uint8Array) => {
    // A `.mbox` suffix alone is not meaningful. Delay the first scan until we
    // have enough bytes to validate the MBOX envelope, including streams that
    // happen to split those five bytes across reads.
    let value: Uint8Array<ArrayBufferLike> = chunk;
    if (!envelopeChecked) {
      value = envelopePrefix.length ? join(envelopePrefix, chunk) : chunk;
      if (value.length < 5) { envelopePrefix = value; return; }
      if (!hasMboxEnvelopeStart(value)) {
        throw new Error("This is not an MBOX archive: it must start with a 'From ' envelope line. Export Gmail Takeout as MBOX, or unzip the download and choose the .mbox file.");
      }
      envelopeChecked = true;
      envelopePrefix = new Uint8Array(0);
    }
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
    // File.stream() commonly delivers 64 KiB chunks. The bounded 32 MiB plan
    // avoids thousands of cold-disk Blob-read dispatches without scaling
    // worker memory with archive size.
    for (const { start, end } of fileReadRanges(file.size)) {
      if (cancelled) { ctx.postMessage({ type: 'cancelled' }); return; }
      consume(new Uint8Array(await file.slice(start, end).arrayBuffer()));
    }
  }
  if (!envelopeChecked) {
    throw new Error("This MBOX file is empty or incomplete. Choose the original Gmail Takeout .mbox file and try again.");
  }
  const final = indexer.finishStream();
  if (final) batch.push(final);
  if (batch.length) ctx.postMessage({ type: 'batch', records: batch });
  ctx.postMessage({ type: 'done', count: indexer.messageCount, bytes: indexer.bytesRead });
}

function join(first: Uint8Array<ArrayBufferLike>, second: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBufferLike> {
  const joined = new Uint8Array(first.length + second.length);
  joined.set(first);
  joined.set(second, first.length);
  return joined;
}
