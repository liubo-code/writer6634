import { z } from 'zod';
import { getCloudflareUser } from '@/app/cloudflare-auth';
import { storage } from '@/db/storage';
import { WorkspaceSchema } from '@/lib/story';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const id = z.string().min(1).max(100);
const SaveSchema = z.object({
  bookId: id,
  outlineCardId: id,
  content: z.string().max(1500000),
  revisionNotes: z.string().max(200000).default(''),
  revision: z.number().int().min(0),
});

async function ownerHasChapter(owner: string, bookId: string, outlineCardId?: string) {
  const row = await storage().prepare('SELECT data FROM story_workspaces WHERE owner=?').bind(owner).first<{ data: string }>();
  if (!row) return false;
  try {
    const workspace = WorkspaceSchema.parse(JSON.parse(row.data));
    const book = workspace.books.find(b => b.id === bookId);
    if (!book) return false;
    if (!outlineCardId) return true;
    return book.cards.some(c => c.id === outlineCardId && c.kind === 'chapter');
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const user = await getCloudflareUser();
  if (!user) return json({ error: '访问验证已失效，请重新通过 Cloudflare Access 登录' }, 401);
  const bookId = new URL(req.url).searchParams.get('bookId') || '';
  if (!id.safeParse(bookId).success) return json({ error: '小说编号无效' }, 400);
  try {
    if (!await ownerHasChapter(user.userId, bookId)) return json({ error: '小说不存在' }, 404);
    const rows = await storage().prepare(
      'SELECT outline_card_id,content,revision_notes,revision,updated_at FROM story_manuscript_chapters WHERE owner=? AND book_id=?'
    ).bind(user.userId, bookId).all<{ outline_card_id: string; content: string; revision_notes: string; revision: number; updated_at: string }>();
    return json({ items: rows.results.map(r => ({
      outlineCardId: r.outline_card_id,
      content: r.content,
      revisionNotes: r.revision_notes,
      revision: r.revision,
      updatedAt: r.updated_at,
    })) });
  } catch (e) {
    console.error('manuscript load', e);
    return json({ error: '正文暂时无法读取，请稍后重试' }, 503);
  }
}

export async function PUT(req: Request) {
  const user = await getCloudflareUser();
  if (!user) return json({ error: '访问验证已失效，请重新通过 Cloudflare Access 登录后保存' }, 401);
  if (req.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '请求来源无效' }, 403);
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).length > 1750000) return json({ error: '单章正文过大，请拆分章节后再保存' }, 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { return json({ error: '无效格式' }, 400); }
    const parsed = SaveSchema.safeParse(body);
    if (!parsed.success) return json({ error: '正文格式无效' }, 400);
    const v = parsed.data;
    if (!await ownerHasChapter(user.userId, v.bookId, v.outlineCardId)) return json({ error: '对应的大纲章节不存在' }, 404);
    const db = storage();
    const existing = await db.prepare(
      'SELECT revision FROM story_manuscript_chapters WHERE owner=? AND book_id=? AND outline_card_id=?'
    ).bind(user.userId, v.bookId, v.outlineCardId).first<{ revision: number }>();
    const now = new Date().toISOString();
    if (!existing) {
      if (v.revision !== 0) return json({ error: '正文已在别处更新，请刷新后合并' }, 409);
      await db.prepare(
        'INSERT INTO story_manuscript_chapters(owner,book_id,outline_card_id,content,revision_notes,revision,updated_at) VALUES(?,?,?,?,?,1,?)'
      ).bind(user.userId, v.bookId, v.outlineCardId, v.content, v.revisionNotes, now).run();
      return json({ revision: 1, updatedAt: now });
    }
    if (existing.revision !== v.revision) return json({ error: '另一个页面已保存这章正文。当前输入还留在本页，请刷新前先复制或导出。' }, 409);
    const row = await db.prepare(
      'UPDATE story_manuscript_chapters SET content=?,revision_notes=?,revision=revision+1,updated_at=? WHERE owner=? AND book_id=? AND outline_card_id=? AND revision=? RETURNING revision'
    ).bind(v.content, v.revisionNotes, now, user.userId, v.bookId, v.outlineCardId, v.revision).first<{ revision: number }>();
    if (!row) return json({ error: '正文保存冲突，请刷新后合并' }, 409);
    return json({ revision: row.revision, updatedAt: now });
  } catch (e) {
    console.error('manuscript save', e);
    return json({ error: '正文保存未完成，输入仍留在当前页面' }, 503);
  }
}

export async function DELETE(req: Request) {
  const user = await getCloudflareUser();
  if (!user) return json({ error: '访问验证已失效，请重新通过 Cloudflare Access 登录' }, 401);
  if (req.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '请求来源无效' }, 403);
  const bookId = new URL(req.url).searchParams.get('bookId') || '';
  if (!id.safeParse(bookId).success) return json({ error: '小说编号无效' }, 400);
  try {
    await storage().prepare('DELETE FROM story_manuscript_chapters WHERE owner=? AND book_id=?').bind(user.userId, bookId).run();
    return json({ ok: true });
  } catch (e) {
    console.error('manuscript delete', e);
    return json({ error: '正文清理失败' }, 503);
  }
}
