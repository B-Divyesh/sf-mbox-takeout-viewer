import { safeFilename } from './parser';

export interface ZipEntry { name: string; data: Uint8Array }

export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const { time, date } = dosDate(new Date());

  for (const entry of entries) {
    const name = encoder.encode(safeFilename(entry.name));
    const crc = crc32(entry.data);
    const local = concat(
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(date),
      u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0), name,
    );
    parts.push(local as BlobPart, entry.data as BlobPart);
    central.push(concat(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date),
      u32(crc), u32(entry.data.length), u32(entry.data.length), u16(name.length), u16(0),
      u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ));
    offset += local.length + entry.data.length;
  }
  const centralBytes = concat(...central);
  parts.push(centralBytes as BlobPart);
  parts.push(concat(
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBytes.length), u32(offset), u16(0),
  ) as BlobPart);
  return new Blob(parts, { type: 'application/zip' });
}

function dosDate(value: Date): { time: number; date: number } {
  const year = Math.max(1980, value.getFullYear());
  return {
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | (value.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
  };
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(arrays.reduce((sum, item) => sum + item.length, 0));
  let position = 0;
  for (const item of arrays) { output.set(item, position); position += item.length; }
  return output;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
