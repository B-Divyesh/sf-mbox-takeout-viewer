import { describe, expect, it } from 'vitest';
import { FILE_READ_CHUNK_BYTES, fileReadRanges } from './file-read-plan';

describe('cold-file read plan', () => {
  it('uses four bounded Blob reads for the 128 MiB throughput regression fixture', () => {
    const mib = 1024 * 1024;
    const ranges = fileReadRanges(128 * mib);

    expect(FILE_READ_CHUNK_BYTES).toBe(32 * mib);
    expect(ranges).toEqual([
      { start: 0, end: 32 * mib },
      { start: 32 * mib, end: 64 * mib },
      { start: 64 * mib, end: 96 * mib },
      { start: 96 * mib, end: 128 * mib },
    ]);
  });

  it('never allocates a read range larger than the fixed 32 MiB working bound', () => {
    const ranges = fileReadRanges(20 * 1024 * 1024 * 1024 + 17);

    expect(ranges[0]).toEqual({ start: 0, end: FILE_READ_CHUNK_BYTES });
    expect(ranges.at(-1)).toEqual({ start: 20 * 1024 * 1024 * 1024, end: 20 * 1024 * 1024 * 1024 + 17 });
    expect(ranges.every((range) => range.end - range.start <= FILE_READ_CHUNK_BYTES)).toBe(true);
  });
});
