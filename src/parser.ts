export interface MessageRecord {
  archiveId: string;
  id: number;
  start: number;
  end: number;
  size: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  messageId: string;
  snippet: string;
  search: string;
  bloom?: string;
}

export interface ParsedAttachment {
  name: string;
  type: string;
  size: number;
  blob: Blob;
  contentId?: string;
}

export interface ParsedMessage {
  headers: Record<string, string>;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  text: string;
  html: string;
  attachments: ParsedAttachment[];
}

const decoder = new TextDecoder('utf-8', { fatal: false });
const encoder = new TextEncoder();

export function parseHeaders(input: string): Record<string, string> {
  const unfolded = input.replace(/\r?\n[ \t]+/g, ' ');
  const headers: Record<string, string> = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }
  return headers;
}

export function decodeHeader(value = ''): string {
  return value.replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (_all, charset: string, encoding: string, data: string) => {
    try {
      const bytes = encoding.toLowerCase() === 'b'
        ? base64Bytes(data)
        : quotedPrintableBytes(data.replace(/_/g, ' '));
      return decodeBytes(bytes, charset);
    } catch {
      return data;
    }
  }).replace(/\?=\s+=\?/g, '?==?');
}

export function indexRecordFromPrefix(prefix: Uint8Array, base: Omit<MessageRecord, 'subject' | 'from' | 'to' | 'date' | 'messageId' | 'snippet' | 'search'>): MessageRecord {
  let source = decoder.decode(prefix);
  if (source.startsWith('From ')) source = source.slice(source.indexOf('\n') + 1);
  const split = source.search(/\r?\n\r?\n/);
  const headerText = split >= 0 ? source.slice(0, split) : source;
  const body = split >= 0 ? source.slice(split).replace(/^\s+/, '') : '';
  const headers = parseHeaders(headerText);
  const cleanBody = body
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[A-Za-z0-9+/]{72,}={0,2}$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const subject = decodeHeader(headers.subject || '(no subject)');
  const from = decodeHeader(headers.from || 'Unknown sender');
  const to = decodeHeader(headers.to || '');
  const date = normaliseDate(headers.date || '');
  const snippet = cleanBody.slice(0, 220);
  return {
    ...base,
    subject,
    from,
    to,
    date,
    messageId: headers['message-id'] || '',
    snippet,
    search: `${subject}\n${from}\n${to}\n${headerText}\n${cleanBody}`.toLocaleLowerCase().slice(0, 4_096),
  };
}

export const BLOOM_BYTES = 1024;

export function bloomAdd(bloom: Uint8Array, token: string): void {
  const [a, b] = bloomHashes(token);
  bloomAddHashPair(bloom, a, b);
}

/**
 * Adds a precomputed pair of ASCII token hashes to a Bloom filter.
 *
 * The streaming reader computes these hashes while it scans bytes so it never
 * needs to allocate one JavaScript string for every word in a multi-GB file.
 */
export function bloomAddHashPair(bloom: Uint8Array, a: number, b: number): void {
  for (let i = 0; i < 4; i++) {
    const bit = (a + i * b + i * i) % (bloom.length * 8);
    bloom[bit >>> 3] |= 1 << (bit & 7);
  }
}

export function bloomHas(encoded: string | undefined, token: string): boolean {
  if (!encoded || !token) return false;
  try {
    const binary = atob(encoded);
    const [a, b] = bloomHashes(token.toLocaleLowerCase());
    for (let i = 0; i < 4; i++) {
      const bit = (a + i * b + i * i) % (binary.length * 8);
      if (!(binary.charCodeAt(bit >>> 3) & (1 << (bit & 7)))) return false;
    }
    return true;
  } catch { return false; }
}

function bloomHashes(value: string): [number, number] {
  let first = 2166136261;
  let second = 5381;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = (Math.imul(second, 33) ^ code) >>> 0;
  }
  return [first, second || 1];
}

export function parseMessage(raw: Uint8Array): ParsedMessage {
  let bytes = raw;
  if (startsWithAscii(bytes, 'From ')) {
    const newline = bytes.indexOf(10);
    if (newline >= 0) bytes = bytes.slice(newline + 1);
  }
  const headers = parseHeaders(decoder.decode(bytes.slice(0, headerEnd(bytes))));
  const result: ParsedMessage = {
    headers,
    subject: decodeHeader(headers.subject || '(no subject)'),
    from: decodeHeader(headers.from || 'Unknown sender'),
    to: decodeHeader(headers.to || ''),
    cc: decodeHeader(headers.cc || ''),
    date: normaliseDate(headers.date || ''),
    text: '',
    html: '',
    attachments: [],
  };
  const bodies: { text: string[]; html: string[] } = { text: [], html: [] };
  parseEntity(bytes, result.attachments, bodies);
  result.text = bodies.text.find(Boolean) || htmlToPlain(bodies.html[0] || '') || '(This message has no readable text body.)';
  result.html = bodies.html.find(Boolean) || '';
  return result;
}

function parseEntity(bytes: Uint8Array, attachments: ParsedAttachment[], bodies: { text: string[]; html: string[] }): void {
  const split = headerEnd(bytes);
  const sepLength = separatorLength(bytes, split);
  const headers = parseHeaders(decoder.decode(bytes.slice(0, split)));
  const body = bytes.slice(split + sepLength);
  const contentType = parseParameterized(headers['content-type'] || 'text/plain; charset=utf-8');
  const disposition = parseParameterized(headers['content-disposition'] || '');

  if (contentType.value.startsWith('multipart/') && contentType.params.boundary) {
    for (const part of splitMultipart(body, contentType.params.boundary)) parseEntity(part, attachments, bodies);
    return;
  }

  const decoded = decodeTransfer(body, headers['content-transfer-encoding'] || '');
  const filename = decodeHeader(disposition.params.filename || contentType.params.name || '');
  const isAttachment = disposition.value === 'attachment' || Boolean(filename) || (!contentType.value.startsWith('text/') && contentType.value !== 'message/rfc822');
  if (isAttachment) {
    const name = safeFilename(filename || `attachment-${attachments.length + 1}.${extensionFor(contentType.value)}`);
    attachments.push({
      name,
      type: contentType.value || 'application/octet-stream',
      size: decoded.byteLength,
      blob: new Blob([decoded.buffer as ArrayBuffer], { type: contentType.value || 'application/octet-stream' }),
      contentId: (headers['content-id'] || '').replace(/[<>]/g, ''),
    });
    return;
  }
  if (contentType.value === 'message/rfc822') {
    parseEntity(decoded, attachments, bodies);
  } else if (contentType.value === 'text/html') {
    bodies.html.push(decodeBytes(decoded, contentType.params.charset));
  } else if (contentType.value.startsWith('text/')) {
    bodies.text.push(decodeBytes(decoded, contentType.params.charset));
  }
}

function headerEnd(bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 10 && bytes[i + 1] === 10) return i;
    if (i < bytes.length - 3 && bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) return i;
  }
  return bytes.length;
}

function separatorLength(bytes: Uint8Array, at: number): number {
  return bytes[at] === 13 ? 4 : at < bytes.length ? 2 : 0;
}

function parseParameterized(raw: string): { value: string; params: Record<string, string> } {
  const sections = raw.split(';');
  const value = sections.shift()?.trim().toLowerCase() || '';
  const params: Record<string, string> = {};
  for (const section of sections) {
    const match = section.match(/^\s*([^=]+)=\s*(?:"([\s\S]*)"|([^\s]*))\s*$/);
    if (match) params[match[1].trim().toLowerCase()] = (match[2] ?? match[3] ?? '').replace(/\\"/g, '"');
  }
  return { value, params };
}

function splitMultipart(body: Uint8Array, boundary: string): Uint8Array[] {
  const binary = bytesToBinary(body);
  const marker = `--${boundary}`;
  return binary.split(marker).slice(1).flatMap((part) => {
    if (part.startsWith('--')) return [];
    const trimmed = part.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
    return trimmed ? [binaryToBytes(trimmed)] : [];
  });
}

function decodeTransfer(body: Uint8Array, encoding: string): Uint8Array {
  const kind = encoding.trim().toLowerCase();
  if (kind === 'base64') return base64Bytes(decoder.decode(body).replace(/\s/g, ''));
  if (kind === 'quoted-printable') return quotedPrintableBytes(decoder.decode(body));
  return body;
}

function base64Bytes(value: string): Uint8Array {
  const cleaned = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const binary = atob(cleaned);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function quotedPrintableBytes(value: string): Uint8Array {
  const softRemoved = value.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < softRemoved.length; i++) {
    if (softRemoved[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(softRemoved.slice(i + 1, i + 3))) {
      out.push(Number.parseInt(softRemoved.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const encoded = encoder.encode(softRemoved[i]);
      out.push(...encoded);
    }
  }
  return new Uint8Array(out);
}

function decodeBytes(bytes: Uint8Array, charset = 'utf-8'): string {
  try { return new TextDecoder((charset || 'utf-8').replace(/^"|"$/g, '')).decode(bytes); }
  catch { return decoder.decode(bytes); }
}

function bytesToBinary(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 0x8000) result += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return result;
}

function binaryToBytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i) & 255;
  return out;
}

function startsWithAscii(bytes: Uint8Array, value: string): boolean {
  return value.split('').every((char, i) => bytes[i] === char.charCodeAt(0));
}

function htmlToPlain(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function extensionFor(type: string): string {
  const known: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'application/pdf': 'pdf', 'text/calendar': 'ics', 'application/zip': 'zip' };
  return known[type] || 'bin';
}

export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').slice(0, 160) || 'message.eml';
}

export function normaliseDate(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 1) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** unit).toFixed(unit ? 1 : 0)} ${units[unit]}`;
}
