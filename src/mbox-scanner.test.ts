import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { bloomHas } from './parser';
import { MboxStreamIndexer, WHOLE_MESSAGE_SEARCH_LIMIT } from './mbox-scanner';

const encoder = new TextEncoder();

describe('bounded MBOX scanner', () => {
  it('keeps offsets, whole-message search, and split envelope detection intact', () => {
    const source = encoder.encode('From first@example.test Thu Jan 01 00:00:00 2026\r\nSubject: First\r\n\r\nalpha needleword\r\nFrom second@example.test Fri Jan 02 00:00:00 2026\r\nSubject: Second\r\n\r\nbeta\r\n');
    const scanner = new MboxStreamIndexer('test');
    const records = [
      ...scanner.write(source.subarray(0, 71)),
      ...scanner.write(source.subarray(71, 109)),
      ...scanner.write(source.subarray(109)),
    ];
    const final = scanner.finishStream();
    if (final) records.push(final);

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.subject)).toEqual(['First', 'Second']);
    expect(records[1].start).toBe(new TextDecoder().decode(source).indexOf('\nFrom second') + 1);
    expect(bloomHas(records[0].bloom, 'needleword')).toBe(true);
  });

  it('indexes searchable body words beyond the 64 KiB preview without scanning giant attachments', () => {
    const header = 'From long@example.test Thu Jan 01 00:00:00 2026\r\nSubject: Long\r\n\r\n';
    const body = `${'x '.repeat(70_000)}needle-after-preview ${'z'.repeat(WHOLE_MESSAGE_SEARCH_LIMIT)}`;
    const scanner = new MboxStreamIndexer('long');
    scanner.write(encoder.encode(header + body));
    const record = scanner.finishStream();
    expect(record).toBeDefined();
    expect(bloomHas(record?.bloom, 'needle-after-preview')).toBe(true);
  });

  it('scans a deterministic 64 MiB mail fixture above the 20 GiB target rate', () => {
    const mib = 1024 * 1024;
    const records = 64;
    const fixture = new Uint8Array(records * mib);
    const header = encoder.encode('From benchmark@example.test Thu Jan 01 00:00:00 2026\r\nSubject: Throughput fixture\r\nFrom: Benchmark <benchmark@example.test>\r\n\r\n');
    const words = encoder.encode('local archive search token ');
    for (let record = 0; record < records; record++) {
      const offset = record * mib;
      fixture.set(header, offset);
      for (let cursor = offset + header.length; cursor < offset + mib; cursor += words.length) fixture.set(words.subarray(0, Math.min(words.length, offset + mib - cursor)), cursor);
      if (record < records - 1) fixture[offset + mib - 1] = 10;
    }

    const scanner = new MboxStreamIndexer('benchmark');
    const started = performance.now();
    const indexed: number[] = [];
    for (let offset = 0; offset < fixture.length; offset += mib) indexed.push(...scanner.write(fixture.subarray(offset, offset + mib)).map((record) => record.id));
    const last = scanner.finishStream();
    if (last) indexed.push(last.id);
    const mibPerSecond = (fixture.byteLength / mib) / ((performance.now() - started) / 1000);

    expect(indexed).toHaveLength(records);
    // 20 GiB in ten minutes needs 34.14 MiB/s. Leave a small guard band while
    // keeping this a reproducible fixture rather than a hand-run benchmark.
    expect(mibPerSecond).toBeGreaterThan(35);
  }, 30_000);
});
