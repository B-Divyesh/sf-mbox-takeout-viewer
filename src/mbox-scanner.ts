import { BLOOM_BYTES, bloomAddHashPair, indexRecordFromPrefix, SEARCH_SCOPE_BYTES, type MessageRecord } from './parser';

export const PREFIX_LIMIT = 65_536;
// 192 KiB preserves useful body-search coverage beyond the preview while
// preventing a single giant HTML/base64 message from monopolising indexing.
export const WHOLE_MESSAGE_SEARCH_LIMIT = SEARCH_SCOPE_BYTES;
const DISTINCT_TOKEN_LIMIT = 4096;
// A small fixed hash table is deliberately quicker than Map here. A common
// newsletter can contain millions of repeated words; checking a typed-array
// slot keeps that work in the CPU cache and avoids allocating Map entries or
// collision arrays in the worker's hottest path.
const SEEN_TOKEN_SLOTS = 8192;
const SEEN_TOKEN_MASK = SEEN_TOKEN_SLOTS - 1;
const WORD_BYTES = new Uint8Array(256);
const LOWER_BYTES = new Uint8Array(256);
for (let byte = 0; byte < 256; byte++) {
  LOWER_BYTES[byte] = byte >= 65 && byte <= 90 ? byte + 32 : byte;
  WORD_BYTES[byte] = Number((byte >= 48 && byte <= 57) || (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122) || byte === 64 || byte === 46 || byte === 95 || byte === 45);
}

/** MBOXRD/MBOXO records start with a Unix-style `From ` envelope line. */
export function hasMboxEnvelopeStart(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 70 && bytes[1] === 114 && bytes[2] === 111
    && bytes[3] === 109 && bytes[4] === 32;
}

/**
 * A bounded, byte-oriented MBOX scanner. It deliberately avoids strings and
 * growing arrays in its byte loop: 20 GiB archives should spend their time on
 * disk reads, not allocating a six-character window and a token string per
 * byte. The one fixed prefix buffer is decoded only once per message.
 */
export class MboxStreamIndexer {
  private readonly prefix = new Uint8Array(PREFIX_LIMIT);
  private prefixLength = 0;
  private currentStart = 0;
  private absolute = 0;
  private id = 0;
  private bloom = new Uint8Array(BLOOM_BYTES);
  private tokenLength = 0;
  private tokenOverflow = false;
  private tokenFirst = 2166136261;
  private tokenSecond = 5381;
  // Repeated words do not change a Bloom filter. Remember a bounded set of
  // exact hash pairs so newsletters and long quoted threads do not redo the
  // same four modulo/bit operations millions of times.
  private readonly seenFirst = new Uint32Array(SEEN_TOKEN_SLOTS);
  private readonly seenSecond = new Uint32Array(SEEN_TOKEN_SLOTS);
  private readonly seenUsed = new Uint8Array(SEEN_TOKEN_SLOTS);
  private seenCount = 0;
  private wordScanFinished = false;
  // Keep just enough uncommitted input to recognise an envelope split across
  // two File slices. Everything before it can be searched with native
  // Uint8Array#indexOf rather than a JavaScript branch for every archive byte.
  private pending = new Uint8Array(0);

  constructor(private readonly archiveId: string) {}

  write(chunk: Uint8Array): MessageRecord[] {
    const records: MessageRecord[] = [];
    // Only a five-byte lookahead is needed after a newline to distinguish a
    // real MBOX envelope. Combining it with the next 4 MiB file slice costs a
    // bounded copy, while replacing a JS byte-by-byte scan over the other
    // ~99% of a large message with native indexOf.
    const source = this.pending.length
      ? joinChunks(this.pending, chunk)
      : chunk;
    const safeLength = Math.max(0, source.length - 5);
    let cursor = 0;
    let searchFrom = 0;
    let newline = source.indexOf(10, searchFrom);
    while (newline >= 0 && newline < safeLength) {
      if (source[newline + 1] === 70 && source[newline + 2] === 114 && source[newline + 3] === 111 && source[newline + 4] === 109 && source[newline + 5] === 32) {
        // The newline belongs to the old record; the envelope begins the new
        // one. End offsets remain exclusive, so seeking still returns exactly
        // the original EML bytes.
        this.append(source, cursor, newline + 1);
        const record = this.finish(this.absolute + newline);
        if (record) records.push(record);
        this.resetMessage(this.absolute + newline + 1);
        this.append(source, newline + 1, newline + 6);
        cursor = newline + 6;
        searchFrom = cursor;
      } else searchFrom = newline + 1;
      newline = source.indexOf(10, searchFrom);
    }
    this.append(source, cursor, safeLength);
    this.absolute += safeLength;
    this.pending = source.slice(safeLength);
    return records;
  }

  finishStream(): MessageRecord | undefined {
    if (this.pending.length) {
      this.append(this.pending, 0, this.pending.length);
      this.absolute += this.pending.length;
      this.pending = new Uint8Array(0);
    }
    return this.finish(this.absolute);
  }

  get bytesRead(): number { return this.absolute + this.pending.length; }
  get messageCount(): number { return this.id; }

  private finish(end: number): MessageRecord | undefined {
    if (end <= this.currentStart || this.prefixLength < 5) return undefined;
    this.flushToken();
    // indexRecordFromPrefix synchronously decodes the input and does not retain
    // it, so this fixed buffer can be safely reused for every record.
    return indexRecordFromPrefix(this.prefix.subarray(0, this.prefixLength), {
      archiveId: this.archiveId,
      id: this.id++,
      start: this.currentStart,
      end,
      size: end - this.currentStart,
      bloom: btoa(String.fromCharCode(...this.bloom)),
    });
  }

  private append(source: Uint8Array, start: number, end: number): void {
    if (end <= start) return;
    const prefixBytes = Math.min(end - start, PREFIX_LIMIT - this.prefixLength);
    if (prefixBytes) {
      this.prefix.set(source.subarray(start, start + prefixBytes), this.prefixLength);
      this.prefixLength += prefixBytes;
    }
    if (this.wordScanFinished) return;
    const remaining = WHOLE_MESSAGE_SEARCH_LIMIT - (this.absolute + start - this.currentStart);
    const scanEnd = remaining > 0 ? Math.min(end, start + remaining) : start;
    this.scanTokens(source, start, scanEnd);
    if (scanEnd < end || remaining <= 0) {
      this.flushToken();
      this.wordScanFinished = true;
    }
  }

  private scanTokens(source: Uint8Array, start: number, end: number): void {
    let tokenLength = this.tokenLength;
    let tokenOverflow = this.tokenOverflow;
    let tokenFirst = this.tokenFirst;
    let tokenSecond = this.tokenSecond;
    const seenFirst = this.seenFirst;
    const seenSecond = this.seenSecond;
    const seenUsed = this.seenUsed;
    let seenCount = this.seenCount;
    const flush = () => {
      if (!tokenOverflow && tokenLength > 1) {
        let isNew = true;
        if (seenCount < DISTINCT_TOKEN_LIMIT) {
          let slot = (tokenFirst ^ tokenSecond) & SEEN_TOKEN_MASK;
          while (seenUsed[slot]) {
            if (seenFirst[slot] === tokenFirst && seenSecond[slot] === tokenSecond) { isNew = false; break; }
            slot = (slot + 1) & SEEN_TOKEN_MASK;
          }
          if (isNew) {
            seenUsed[slot] = 1;
            seenFirst[slot] = tokenFirst;
            seenSecond[slot] = tokenSecond;
            seenCount++;
          }
        }
        if (isNew) bloomAddHashPair(this.bloom, tokenFirst, tokenSecond || 1);
      }
      tokenLength = 0; tokenOverflow = false; tokenFirst = 2166136261; tokenSecond = 5381;
    };
    for (let i = start; i < end; i++) {
      const byte = source[i];
      if (!WORD_BYTES[byte]) flush();
      else if (tokenLength >= 80) tokenOverflow = true;
      else {
        const code = LOWER_BYTES[byte];
        tokenFirst = Math.imul(tokenFirst ^ code, 16777619) >>> 0;
        tokenSecond = (Math.imul(tokenSecond, 33) ^ code) >>> 0;
        tokenLength++;
      }
    }
    this.tokenLength = tokenLength;
    this.tokenOverflow = tokenOverflow;
    this.tokenFirst = tokenFirst;
    this.tokenSecond = tokenSecond;
    this.seenCount = seenCount;
  }

  private resetMessage(start: number): void {
    this.currentStart = start;
    this.prefixLength = 0;
    this.bloom = new Uint8Array(BLOOM_BYTES);
    this.seenUsed.fill(0);
    this.seenCount = 0;
    this.wordScanFinished = false;
    this.resetToken();
  }

  private flushToken(): void {
    if (!this.tokenOverflow && this.tokenLength > 1) {
      bloomAddHashPair(this.bloom, this.tokenFirst, this.tokenSecond || 1);
    }
    this.resetToken();
  }

  private resetToken(): void {
    this.tokenLength = 0;
    this.tokenOverflow = false;
    this.tokenFirst = 2166136261;
    this.tokenSecond = 5381;
  }
}

function joinChunks(first: Uint8Array, second: Uint8Array): Uint8Array {
  const joined = new Uint8Array(first.length + second.length);
  joined.set(first);
  joined.set(second, first.length);
  return joined;
}
