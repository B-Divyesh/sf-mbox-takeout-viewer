import { BLOOM_BYTES, bloomAddHashPair, indexRecordFromPrefix, type MessageRecord } from './parser';

export const PREFIX_LIMIT = 65_536;
// 192 KiB preserves useful body-search coverage beyond the preview while
// preventing a single giant HTML/base64 message from monopolising indexing.
export const WHOLE_MESSAGE_SEARCH_LIMIT = 192 * 1024;
type TokenHashes = Map<number, number | number[]>;
const DISTINCT_TOKEN_LIMIT = 4096;
const WORD_BYTES = new Uint8Array(256);
const LOWER_BYTES = new Uint8Array(256);
for (let byte = 0; byte < 256; byte++) {
  LOWER_BYTES[byte] = byte >= 65 && byte <= 90 ? byte + 32 : byte;
  WORD_BYTES[byte] = Number((byte >= 48 && byte <= 57) || (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122) || byte === 64 || byte === 46 || byte === 95 || byte === 45);
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
  private seenTokens: TokenHashes = new Map();
  private wordScanFinished = false;
  // State after a newline: 1 expects F, then r/o/m/space complete a boundary.
  private fromState = 0;

  constructor(private readonly archiveId: string) {}

  write(chunk: Uint8Array): MessageRecord[] {
    const records: MessageRecord[] = [];
    // Keep the byte loop in local variables. Chromium does not consistently
    // inline private method/property accesses in a short-lived Worker, and at
    // Takeout scale that otherwise becomes billions of needless lookups.
    let prefixLength = this.prefixLength;
    let currentStart = this.currentStart;
    let absolute = this.absolute;
    let bloom = this.bloom;
    let tokenLength = this.tokenLength;
    let tokenOverflow = this.tokenOverflow;
    let tokenFirst = this.tokenFirst;
    let tokenSecond = this.tokenSecond;
    let seenTokens = this.seenTokens;
    let wordScanFinished = this.wordScanFinished;
    let fromState = this.fromState;
    const wasSeen = () => {
      const known = seenTokens.get(tokenFirst);
      return typeof known === 'number' ? known === tokenSecond : Boolean(known?.includes(tokenSecond));
    };
    const remember = () => {
      if (seenTokens.size >= DISTINCT_TOKEN_LIMIT) return;
      const known = seenTokens.get(tokenFirst);
      if (known === undefined) seenTokens.set(tokenFirst, tokenSecond);
      else if (typeof known === 'number') seenTokens.set(tokenFirst, [known, tokenSecond]);
      else known.push(tokenSecond);
    };
    const flushToken = () => {
      if (!tokenOverflow && tokenLength > 1 && !wasSeen()) {
        bloomAddHashPair(bloom, tokenFirst, tokenSecond || 1);
        remember();
      }
      tokenLength = 0; tokenOverflow = false; tokenFirst = 2166136261; tokenSecond = 5381;
    };

    for (let i = 0; i < chunk.length; i++) {
      const byte = chunk[i];
      if (prefixLength < PREFIX_LIMIT) this.prefix[prefixLength++] = byte;

      if (absolute - currentStart < WHOLE_MESSAGE_SEARCH_LIMIT) {
        if (!WORD_BYTES[byte]) flushToken();
        else if (tokenLength >= 80) tokenOverflow = true;
        else {
          const code = LOWER_BYTES[byte];
          tokenFirst = Math.imul(tokenFirst ^ code, 16777619) >>> 0;
          tokenSecond = (Math.imul(tokenSecond, 33) ^ code) >>> 0;
          tokenLength++;
        }
      } else if (!wordScanFinished) {
        flushToken();
        wordScanFinished = true;
      }

      let boundary = false;
      if (fromState === 0) fromState = byte === 10 ? 1 : 0;
      else {
        const expected = fromState === 1 ? 70
          : fromState === 2 ? 114
            : fromState === 3 ? 111
              : fromState === 4 ? 109 : 32;
        if (byte === expected) {
          fromState++;
          if (fromState === 6) { fromState = 0; boundary = true; }
        } else fromState = byte === 10 ? 1 : 0;
      }

      if (boundary) {
        // We just consumed "\nFrom ". The newline belongs to the old record;
        // the envelope belongs to the next one.
        const nextStart = absolute - 4;
        if (nextStart > currentStart) {
          if (prefixLength < PREFIX_LIMIT) prefixLength = Math.max(0, prefixLength - 5);
          this.prefixLength = prefixLength;
          this.bloom = bloom;
          this.tokenLength = tokenLength;
          this.tokenOverflow = tokenOverflow;
          this.tokenFirst = tokenFirst;
          this.tokenSecond = tokenSecond;
          const record = this.finish(nextStart - 1);
          if (record) records.push(record);
          currentStart = nextStart;
          this.prefix[0] = 70; this.prefix[1] = 114; this.prefix[2] = 111; this.prefix[3] = 109; this.prefix[4] = 32;
          prefixLength = 5;
          tokenLength = 0; tokenOverflow = false; tokenFirst = 2166136261; tokenSecond = 5381;
          bloom = new Uint8Array(BLOOM_BYTES);
          seenTokens = new Map();
          wordScanFinished = false;
        }
      }
      absolute++;
    }
    this.prefixLength = prefixLength;
    this.currentStart = currentStart;
    this.absolute = absolute;
    this.bloom = bloom;
    this.tokenLength = tokenLength;
    this.tokenOverflow = tokenOverflow;
    this.tokenFirst = tokenFirst;
    this.tokenSecond = tokenSecond;
    this.seenTokens = seenTokens;
    this.wordScanFinished = wordScanFinished;
    this.fromState = fromState;
    return records;
  }

  finishStream(): MessageRecord | undefined {
    return this.finish(this.absolute);
  }

  get bytesRead(): number { return this.absolute; }
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
