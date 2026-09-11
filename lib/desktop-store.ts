import type { ManuscriptChapter } from './manuscript';
import { ManuscriptListSchema } from './manuscript';
import { BookSchema, WorkspaceSchema, seedWorkspace, type Book, type Workspace } from './story';

export const isDesktopRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type Db = {
  execute: (sql: string, bindValues?: unknown[]) => Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select: <T>(sql: string, bindValues?: unknown[]) => Promise<T>;
};

let dbPromise: Promise<Db> | null = null;

async function db(): Promise<Db> {
  if (!isDesktopRuntime()) throw new Error('本地数据库只在伏线桌面版中可用');
  if (!dbPromise) {
    dbPromise = (async () => {
      const { default: Database } = await import('@tauri-apps/plugin-sql');
      const conn = await Database.load('sqlite:fuxian.db') as unknown as Db;
      await ensureSchema(conn);
      return conn;
    })();
  }
  return dbPromise;
}

async function ensureSchema(conn: Db) {
  await conn.execute(`CREATE TABLE IF NOT EXISTS local_workspace (
    owner TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`);
  await conn.execute(`CREATE TABLE IF NOT EXISTS local_manuscript_chapters (
    book_id TEXT NOT NULL,
    outline_card_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    revision_notes TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (book_id, outline_card_id)
  )`);
  await conn.execute(`CREATE TABLE IF NOT EXISTS local_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    book_id TEXT NOT NULL,
    title TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await conn.execute(`CREATE INDEX IF NOT EXISTS idx_local_snapshots_book_created ON local_snapshots (book_id, created_at DESC)`);
  await conn.execute(`CREATE TABLE IF NOT EXISTS local_sync_state (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
}

export async function loadLocalWorkspace(owner: string): Promise<{ data: Workspace; revision: number }> {
  const conn = await db();
  const rows = await conn.select<Array<{ data: string; revision: number }>>(
    'SELECT data, revision FROM local_workspace WHERE owner = $1 LIMIT 1',
    [owner],
  );
  const row = rows[0];
  if (row) return { data: WorkspaceSchema.parse(JSON.parse(row.data)), revision: Number(row.revision) || 0 };
  const data = seedWorkspace();
  await saveLocalWorkspace(owner, data, 1);
  return { data, revision: 1 };
}

export async function saveLocalWorkspace(owner: string, data: Workspace, revision: number) {
  const parsed = WorkspaceSchema.parse(data);
  const conn = await db();
  await conn.execute(
    `INSERT INTO local_workspace (owner, data, revision, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(owner) DO UPDATE SET data=excluded.data, revision=excluded.revision, updated_at=excluded.updated_at`,
    [owner, JSON.stringify(parsed), revision, new Date().toISOString()],
  );
  return revision;
}

export async function loadLocalManuscripts(bookId: string): Promise<ManuscriptChapter[]> {
  const conn = await db();
  const rows = await conn.select<Array<{ outline_card_id: string; content: string; revision_notes: string; revision: number; updated_at: string }>>(
    `SELECT outline_card_id, content, revision_notes, revision, updated_at
     FROM local_manuscript_chapters WHERE book_id = $1`,
    [bookId],
  );
  return ManuscriptListSchema.parse({ items: rows.map(row => ({
    outlineCardId: row.outline_card_id,
    content: row.content,
    revisionNotes: row.revision_notes,
    revision: Number(row.revision) || 0,
    updatedAt: row.updated_at,
  })) }).items;
}

export async function saveLocalManuscript(bookId: string, item: ManuscriptChapter): Promise<ManuscriptChapter> {
  const conn = await db();
  const revision = (item.revision || 0) + 1;
  const updatedAt = new Date().toISOString();
  await conn.execute(
    `INSERT INTO local_manuscript_chapters (book_id, outline_card_id, content, revision_notes, revision, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(book_id, outline_card_id) DO UPDATE SET
       content=excluded.content,
       revision_notes=excluded.revision_notes,
       revision=excluded.revision,
       updated_at=excluded.updated_at`,
    [bookId, item.outlineCardId, item.content, item.revisionNotes, revision, updatedAt],
  );
  return { ...item, revision, updatedAt };
}

export async function deleteLocalBookManuscripts(bookId: string) {
  const conn = await db();
  await conn.execute('DELETE FROM local_manuscript_chapters WHERE book_id = $1', [bookId]);
}

export type LocalSnapshot = { id: string; title: string; created_at: string };

export async function listLocalSnapshots(bookId: string): Promise<LocalSnapshot[]> {
  const conn = await db();
  return conn.select<LocalSnapshot[]>(
    'SELECT id, title, created_at FROM local_snapshots WHERE book_id = $1 ORDER BY created_at DESC LIMIT 12',
    [bookId],
  );
}

export async function saveLocalSnapshot(book: Book): Promise<LocalSnapshot[]> {
  const conn = await db();
  const parsed = BookSchema.parse(book);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await conn.execute(
    'INSERT INTO local_snapshots (id, book_id, title, data, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, parsed.id, parsed.title, JSON.stringify(parsed), now],
  );
  const stale = await conn.select<Array<{ id: string }>>(
    'SELECT id FROM local_snapshots WHERE book_id = $1 ORDER BY created_at DESC LIMIT -1 OFFSET 12',
    [parsed.id],
  );
  for (const row of stale) await conn.execute('DELETE FROM local_snapshots WHERE id = $1', [row.id]);
  return listLocalSnapshots(parsed.id);
}

export async function loadLocalSnapshot(id: string): Promise<Book> {
  const conn = await db();
  const rows = await conn.select<Array<{ data: string }>>('SELECT data FROM local_snapshots WHERE id = $1 LIMIT 1', [id]);
  if (!rows[0]) throw new Error('找不到这份本地快照');
  return BookSchema.parse(JSON.parse(rows[0].data));
}

export async function setLocalSyncState(key: string, value: unknown) {
  const conn = await db();
  await conn.execute(
    `INSERT INTO local_sync_state (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    [key, JSON.stringify(value), new Date().toISOString()],
  );
}

export async function getLocalSyncState<T>(key: string): Promise<T | null> {
  const conn = await db();
  const rows = await conn.select<Array<{ value: string }>>('SELECT value FROM local_sync_state WHERE key = $1 LIMIT 1', [key]);
  if (!rows[0]) return null;
  try { return JSON.parse(rows[0].value) as T; } catch { return null; }
}
