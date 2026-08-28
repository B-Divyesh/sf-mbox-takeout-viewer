import { describe, expect, it } from 'vitest';
import { BLOOM_BYTES, bloomAdd, bloomHas, decodeHeader, formatBytes, indexRecordFromPrefix, parseMessage, safeFilename, searchPrefixContainsTerms } from './parser';
import { createZip } from './zip';

const encode = (value: string) => new TextEncoder().encode(value);

describe('mail parsing', () => {
  it('decodes RFC 2047 subjects and indexes searchable body text', () => {
    const raw = encode('From person@example.test Thu Jan 01 00:00:00 2026\r\nFrom: Person <person@example.test>\r\nTo: Records <records@example.test>\r\nSubject: =?UTF-8?B?UmVjb3ZlcmVkIOKckw==?=\r\nDate: Thu, 1 Jan 2026 00:00:00 +0000\r\n\r\nThe special invoice is here.');
    const record = indexRecordFromPrefix(raw, { archiveId: 'a', id: 0, start: 0, end: raw.length, size: raw.length });
    expect(record.subject).toBe('Recovered ✓');
    expect(record.search).toContain('special invoice');
    expect(record.from).toContain('person@example.test');
  });

  it('parses multipart text and a base64 attachment', () => {
    const raw = encode('From sender@example.test Thu Jan 01 00:00:00 2026\r\nSubject: Files\r\nFrom: Sender <sender@example.test>\r\nContent-Type: multipart/mixed; boundary="b"\r\n\r\n--b\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello archive\r\n--b\r\nContent-Type: text/plain; name="note.txt"\r\nContent-Disposition: attachment; filename="note.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nSGVsbG8h\r\n--b--\r\n');
    const message = parseMessage(raw);
    expect(message.text).toContain('Hello archive');
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0].name).toBe('note.txt');
    expect(message.attachments[0].size).toBe(6);
  });

  it('handles utility edge cases', () => {
    expect(decodeHeader('=?UTF-8?Q?hello_=E2=9C=93?=')).toBe('hello ✓');
    expect(safeFilename('../../bad:name')).toBe('_.._bad_name');
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('keeps a compact, case-insensitive whole-message word index', () => {
    const bloom = new Uint8Array(BLOOM_BYTES);
    bloomAdd(bloom, 'needleinahaystack');
    const encoded = btoa(String.fromCharCode(...bloom));
    expect(bloomHas(encoded, 'NeedleInAHaystack')).toBe(true);
    expect(bloomHas(encoded, 'definitely-absent')).toBe(false);
  });

  it('confirms likely Bloom hits against original bytes before accepting them', () => {
    const source = encode(`From sender@example.test Thu Jan 01 00:00:00 2026\r\nSubject: Vocabulary\r\n\r\n${Array.from({ length: 5_000 }, (_, index) => `uniquetoken${String(index).padStart(5, '0')}`).join(' ')}`);
    const bloom = new Uint8Array(BLOOM_BYTES);
    for (let index = 0; index < 5_000; index++) bloomAdd(bloom, `uniquetoken${String(index).padStart(5, '0')}`);
    const encoded = btoa(String.fromCharCode(...bloom));

    // At this vocabulary density a 1 KiB Bloom filter has false positives;
    // it is a candidate filter, never search-result evidence.
    const absent = Array.from({ length: 20 }, (_, index) => `definitelyabsent${String(index).padStart(4, '0')}`);
    expect(absent.some((term) => bloomHas(encoded, term))).toBe(true);
    expect(absent.every((term) => !searchPrefixContainsTerms(source, [term]))).toBe(true);
    expect(searchPrefixContainsTerms(source, ['uniquetoken01234'])).toBe(true);
  });
});

describe('ZIP export', () => {
  it('writes valid local and end-of-central-directory signatures', async () => {
    const blob = createZip([{ name: 'message.eml', data: encode('Subject: Test\r\n\r\nHello') }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...bytes.slice(-22, -18)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});
