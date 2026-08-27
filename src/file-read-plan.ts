/**
 * Keep cold-disk Blob reads coarse enough that browser dispatch overhead does
 * not become the throughput bottleneck, while retaining a fixed memory bound
 * and a short cancellation boundary for multi-gigabyte archives.
 */
export const FILE_READ_CHUNK_BYTES = 32 * 1024 * 1024;

export interface FileReadRange {
  start: number;
  end: number;
}

export function fileReadRanges(size: number): FileReadRange[] {
  const ranges: FileReadRange[] = [];
  for (let start = 0; start < size; start += FILE_READ_CHUNK_BYTES) {
    ranges.push({ start, end: Math.min(size, start + FILE_READ_CHUNK_BYTES) });
  }
  return ranges;
}
