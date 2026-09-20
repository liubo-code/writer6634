import type { ManuscriptChapter } from './manuscript';
import { ManuscriptListSchema } from './manuscript';
import { BookSchema, WorkspaceSchema, seedWorkspace, type Book, type Workspace } from './story';

export const isDesktopRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const ROOT_KEY = 'fuxian-local-data-root';
const INDEX_NAME = '伏线书库.json';

type Db = {
  execute: (sql: string, bindValues?: unknown[]) => Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select: <T>(sql: string, bindValues?: unknown[]) => Promise<T>;
};

type LibraryIndex = {
  schemaVersion: 1;
  updatedAt: string;
  books: Array<{ id: string; title: string; folder: string }>;
};

let dbPromise: Promise<Db> | null = null;

const joinPath = (base: string, ...parts: string[]) => {
  const root = base.replace(/[\\/]+$/g, '');
  return [root, ...parts.map(p => p.replace(/^[\\/]+|[\\/]+$/g, ''))].join('/');
};

const safeName = (value: string, fallback = '未命名小说') => {
  let name = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ').replace(/[. ]+$/g, '').trim();
  if (!name) name = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = '_' + name;
  return Array.from(name).slice(0, 80).join('');
};

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

async function readText(path: string) {
  return invoke<string | null>('read_text_file', { path });
}
async function writeText(path: string, content: string) {
  return invoke<void>('write_text_file', { path, content });
}
async function ensureDir(path: string) {
  return invoke<void>('ensure_directory', { path });
}
async function exists(path: string) {
  return invoke<boolean>('local_path_exists', { path });
}
async function renamePath(from: string, to: string) {
  return invoke<void>('rename_local_path', { from, to });
}

export function getDesktopDataRoot() {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(ROOT_KEY) || ''; } catch { return ''; }
}

export async function chooseDesktopDataRoot() {
  if (!isDesktopRuntime()) return '';
  const picked = await invoke<string | null>('choose_data_directory');
  if (!picked) return '';
  try { localStorage.setItem(ROOT_KEY, picked); } catch {}
  await ensureDir(picked);
  return picked;
}

async function loadIndex(root: string): Promise<LibraryIndex> {
  try {
    const raw = await readText(joinPath(root, INDEX_NAME));
    if (raw) {
      const parsed = JSON.parse(raw) as LibraryIndex;
      if (parsed?.schemaVersion === 1 && Array.isArray(parsed.books)) return parsed;
    }
  } catch {}
  return { schemaVersion: 1, updatedAt: new Date().toISOString(), books: [] };
}

async function writeIndex(root: string, index: LibraryIndex) {
  index.updatedAt = new Date().toISOString();
  await writeText(joinPath(root, INDEX_NAME), JSON.stringify(index, null, 2));
}

async function resolveBookFolder(root: string, index: LibraryIndex, book: Book) {
  const desiredBase = safeName(book.title);
  const existing = index.books.find(x => x.id === book.id);
  let desired = desiredBase;
  const occupied = new Set(index.books.filter(x => x.id !== book.id).map(x => x.folder.toLowerCase()));
  if (occupied.has(desired.toLowerCase())) desired = desiredBase + ' (' + book.id.slice(0, 6) + ')';

  if (existing?.folder && existing.folder !== desired) {
    const from = joinPath(root, existing.folder);
    let to = joinPath(root, desired);
    if (await exists(to)) {
      desired = desiredBase + ' (' + book.id.slice(0, 6) + ')';
      to = joinPath(root, desired);
    }
    if (await exists(from) && !(await exists(to))) {
      try { await renamePath(from, to); } catch {}
    }
  }

  const next = { id: book.id, title: book.title, folder: desired };
  const at = index.books.findIndex(x => x.id === book.id);
  if (at >= 0) index.books[at] = next;
  else index.books.push(next);
  return desired;
}

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
}

async function manuscriptRows(bookId: string): Promise<ManuscriptChapter[]> {
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

async function mirrorBook(root: string, index: LibraryIndex, book: Book, manuscripts?: ManuscriptChapter[]) {
  const folder = await resolveBookFolder(root, index, book);
  const base = joinPath(root, folder);
  await ensureDir(base);
  await ensureDir(joinPath(base, '正文'));
  await ensureDir(joinPath(base, '快照'));
  await writeText(joinPath(base, '大纲.json'), JSON.stringify(BookSchema.parse(book), null, 2));
  await writeText(joinPath(base, '书籍信息.json'), JSON.stringify({
    title: book.title,
    id: book.id,
    updatedAt: new Date().toISOString(),
  }, null, 2));

  const rows = manuscripts || await manuscriptRows(book.id);
  const chapters = book.cards.filter(c => !c.deletedAt && c.kind === 'chapter');
  const chapterNo = new Map(chapters.map((c, i) => [c.id, i + 1]));
  const catalog: Array<{ id: string; number: number | null; title: string; json: string; text: string }> = [];

  for (const item of rows) {
    const card = book.cards.find(c => c.id === item.outlineCardId);
    const stem = '章节_' + item.outlineCardId;
    await writeText(joinPath(base, '正文', stem + '.json'), JSON.stringify(item, null, 2));
    const heading = card ? `第 ${chapterNo.get(card.id) || ''} 章 ${card.title || '未命名章节'}`.trim() : '已移除章节';
    const body = heading + '\n\n' + item.content + (item.revisionNotes ? '\n\n---\n修文备忘\n' + item.revisionNotes : '');
    await writeText(joinPath(base, '正文', stem + '.txt'), body);
    catalog.push({
      id: item.outlineCardId,
      number: card ? chapterNo.get(card.id) || null : null,
      title: card?.title || '已移除章节',
      json: stem + '.json',
      text: stem + '.txt',
    });
  }
  await writeText(joinPath(base, '正文', '目录.json'), JSON.stringify(catalog, null, 2));
}

async function mirrorWorkspace(data: Workspace) {
  const root = getDesktopDataRoot();
  if (!root) return;
  await ensureDir(root);
  const index = await loadIndex(root);
  const alive = new Set(data.books.map(b => b.id));
  index.books = index.books.filter(x => alive.has(x.id));
  for (const book of data.books) await mirrorBook(root, index, book);
  await writeIndex(root, index);
}

async function workspaceFromFiles(): Promise<Workspace | null> {
  const root = getDesktopDataRoot();
  if (!root) return null;
  const index = await loadIndex(root);
  const books: Book[] = [];
  for (const entry of index.books) {
    try {
      const raw = await readText(joinPath(root, entry.folder, '大纲.json'));
      if (!raw) continue;
      books.push(BookSchema.parse(JSON.parse(raw)));
    } catch {}
  }
  if (!books.length) return null;
  return WorkspaceSchema.parse({ schemaVersion: 1, books });
}

async function manuscriptsFromFiles(bookId: string): Promise<ManuscriptChapter[]> {
  const root = getDesktopDataRoot();
  if (!root) return [];
  const index = await loadIndex(root);
  const entry = index.books.find(x => x.id === bookId);
  if (!entry) return [];
  try {
    const catalogRaw = await readText(joinPath(root, entry.folder, '正文', '目录.json'));
    if (!catalogRaw) return [];
    const catalog = JSON.parse(catalogRaw) as Array<{ json?: string }>;
    const items: ManuscriptChapter[] = [];
    for (const row of catalog) {
      if (!row.json) continue;
      const raw = await readText(joinPath(root, entry.folder, '正文', row.json));
      if (!raw) continue;
      items.push(ManuscriptListSchema.parse({ items: [JSON.parse(raw)] }).items[0]);
    }
    return items;
  } catch { return []; }
}

export async function loadLocalWorkspace(owner: string): Promise<{ data: Workspace; revision: number }> {
  const conn = await db();
  const rows = await conn.select<Array<{ data: string; revision: number }>>(
    'SELECT data, revision FROM local_workspace WHERE owner = $1 LIMIT 1',
    [owner],
  );
  const row = rows[0];
  if (row) {
    const data = WorkspaceSchema.parse(JSON.parse(row.data));
    await mirrorWorkspace(data);
    return { data, revision: Number(row.revision) || 0 };
  }
  const fromFiles = await workspaceFromFiles();
  const data = fromFiles || seedWorkspace();
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
  await mirrorWorkspace(parsed);
  return revision;
}

export async function loadLocalManuscripts(bookId: string): Promise<ManuscriptChapter[]> {
  const conn = await db();
  let items = await manuscriptRows(bookId);
  if (items.length) return items;
  items = await manuscriptsFromFiles(bookId);
  for (const item of items) {
    await conn.execute(
      `INSERT OR REPLACE INTO local_manuscript_chapters
       (book_id, outline_card_id, content, revision_notes, revision, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bookId, item.outlineCardId, item.content, item.revisionNotes, item.revision, item.updatedAt],
    );
  }
  return items;
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
  const saved = { ...item, revision, updatedAt };
  const workspaceRows = await conn.select<Array<{ data: string }>>('SELECT data FROM local_workspace LIMIT 1');
  if (workspaceRows[0]) {
    try {
      const workspace = WorkspaceSchema.parse(JSON.parse(workspaceRows[0].data));
      const book = workspace.books.find(b => b.id === bookId);
      const root = getDesktopDataRoot();
      if (book && root) {
        const index = await loadIndex(root);
        await mirrorBook(root, index, book, await manuscriptRows(bookId));
        await writeIndex(root, index);
      }
    } catch {}
  }
  return saved;
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

  const root = getDesktopDataRoot();
  if (root) {
    const index = await loadIndex(root);
    const folder = await resolveBookFolder(root, index, parsed);
    const stamp = now.replace(/[:.]/g, '-');
    await writeText(joinPath(root, folder, '快照', stamp + '_' + safeName(parsed.title, '快照') + '.json'), JSON.stringify(parsed, null, 2));
    await writeIndex(root, index);
  }
  return listLocalSnapshots(parsed.id);
}

export async function loadLocalSnapshot(id: string): Promise<Book> {
  const conn = await db();
  const rows = await conn.select<Array<{ data: string }>>('SELECT data FROM local_snapshots WHERE id = $1 LIMIT 1', [id]);
  if (!rows[0]) throw new Error('找不到这份本地快照');
  return BookSchema.parse(JSON.parse(rows[0].data));
}

export async function mirrorCurrentLibrary() {
  const conn = await db();
  const rows = await conn.select<Array<{ data: string }>>('SELECT data FROM local_workspace LIMIT 1');
  if (!rows[0]) return;
  const workspace = WorkspaceSchema.parse(JSON.parse(rows[0].data));
  await mirrorWorkspace(workspace);
}
