import type { MessageRecord } from './parser';

export interface ArchiveRecord {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  gzip: boolean;
  count: number;
  indexedAt: string;
  handle?: FileSystemFileHandle;
}

const DB_NAME = 'paper-trail-index';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('archives')) db.createObjectStore('archives', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'pk' });
        store.createIndex('archiveId', 'archiveId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveArchive(archive: ArchiveRecord): Promise<void> {
  const db = await openDb();
  await transactionDone(db.transaction('archives', 'readwrite'), (store) => store.put(archive));
  db.close();
}

export async function getArchives(): Promise<ArchiveRecord[]> {
  const db = await openDb();
  const records = await requestResult<ArchiveRecord[]>(db.transaction('archives').objectStore('archives').getAll());
  db.close();
  return records.sort((a, b) => b.indexedAt.localeCompare(a.indexedAt));
}

export async function saveMessages(records: MessageRecord[]): Promise<void> {
  if (!records.length) return;
  const db = await openDb();
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  for (const record of records) store.put({ ...record, pk: `${record.archiveId}:${record.id}` });
  await txComplete(tx);
  db.close();
}

export async function getMessages(archiveId: string): Promise<MessageRecord[]> {
  const db = await openDb();
  const index = db.transaction('messages').objectStore('messages').index('archiveId');
  const records = await requestResult<(MessageRecord & { pk: string })[]>(index.getAll(archiveId));
  db.close();
  return records.sort((a, b) => a.id - b.id).map(({ pk: _pk, ...rest }) => rest);
}

export async function deleteArchive(archiveId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['archives', 'messages'], 'readwrite');
  tx.objectStore('archives').delete(archiveId);
  const index = tx.objectStore('messages').index('archiveId');
  await new Promise<void>((resolve, reject) => {
    const request = index.openKeyCursor(IDBKeyRange.only(archiveId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      tx.objectStore('messages').delete(cursor.primaryKey);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
  await txComplete(tx);
  db.close();
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function transactionDone(tx: IDBTransaction, action: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  action(tx.objectStore('archives'));
  return txComplete(tx);
}
