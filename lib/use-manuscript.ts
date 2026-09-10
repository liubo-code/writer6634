'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ManuscriptListSchema, type ManuscriptChapter } from './manuscript';
import type { Card } from './story';

type Status = 'loading' | 'saved' | 'pending' | 'saving' | 'error';
type ChapterMap = Record<string, ManuscriptChapter>;

const signature = (x: ManuscriptChapter) => JSON.stringify([x.content, x.revisionNotes]);

export function useManuscript(owner: string, bookId: string, chapters: Card[]) {
  const [items, setItems] = useState<ChapterMap>({});
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const drafts = useRef<ChapterMap>({});
  const saved = useRef<Record<string, string>>({});
  const revisions = useRef<Record<string, number>>({});
  const inflight = useRef<Record<string, Promise<boolean> | undefined>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const mountedBook = useRef(bookId);
  const key = `fuxian-manuscript-unsaved-${owner}-${bookId}`;

  const cache = useCallback(() => {
    try {
      const dirty = Object.values(drafts.current).filter(x => signature(x) !== saved.current[x.outlineCardId]);
      if (!dirty.length) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify({ items: dirty, revisions: revisions.current }));
    } catch {}
  }, [key]);

  const flushOne = useCallback(async (outlineCardId: string): Promise<boolean> => {
    if (mountedBook.current !== bookId) return false;
    if (inflight.current[outlineCardId]) return inflight.current[outlineCardId]!;
    const job = (async () => {
      try {
        while (true) {
          if (mountedBook.current !== bookId) return false;
          const current = drafts.current[outlineCardId];
          if (!current || signature(current) === saved.current[outlineCardId]) break;
          setStatus('saving');
          const sent = signature(current);
          const r = await fetch('/api/manuscript', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookId,
              outlineCardId,
              content: current.content,
              revisionNotes: current.revisionNotes,
              revision: revisions.current[outlineCardId] || 0,
            }),
          });
          const v = await r.json() as { error?: string; revision?: number; updatedAt?: string };
          if (!r.ok) throw new Error(v.error || '正文保存未完成');
          revisions.current[outlineCardId] = v.revision || revisions.current[outlineCardId] || 1;
          saved.current[outlineCardId] = sent;
          const latest = drafts.current[outlineCardId];
          if (latest) {
            const next = { ...latest, revision: revisions.current[outlineCardId], updatedAt: v.updatedAt || new Date().toISOString() };
            drafts.current[outlineCardId] = next;
            setItems(all => ({ ...all, [outlineCardId]: next }));
          }
        }
        setError('');
        const stillDirty = Object.keys(drafts.current).some(id => signature(drafts.current[id]) !== saved.current[id]);
        setStatus(stillDirty ? 'pending' : 'saved');
        cache();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : '正文保存未完成');
        setStatus('error');
        cache();
        return false;
      }
    })();
    inflight.current[outlineCardId] = job;
    void job.finally(() => { delete inflight.current[outlineCardId]; });
    return job;
  }, [bookId, cache]);

  const flushAll = useCallback(async () => {
    const ids = Object.keys(drafts.current).filter(id => signature(drafts.current[id]) !== saved.current[id]);
    if (!ids.length) return true;
    const ok = await Promise.all(ids.map(id => flushOne(id)));
    return ok.every(Boolean);
  }, [flushOne]);

  const load = useCallback(async () => {
    mountedBook.current = bookId;
    setStatus('loading');
    setError('');
    try {
      const r = await fetch('/api/manuscript?bookId=' + encodeURIComponent(bookId), { cache: 'no-store' });
      const raw = await r.json() as unknown;
      if (!r.ok) throw new Error((raw as { error?: string }).error || '无法读取正文');
      const parsed = ManuscriptListSchema.parse(raw);
      if (mountedBook.current !== bookId) return;
      const map: ChapterMap = {};
      const serverIds = new Set<string>();
      for (const x of parsed.items) {
        map[x.outlineCardId] = x;
        drafts.current[x.outlineCardId] = x;
        saved.current[x.outlineCardId] = signature(x);
        revisions.current[x.outlineCardId] = x.revision;
        serverIds.add(x.outlineCardId);
      }

      // 自动迁移旧版章节卡里的正文。迁移只在服务器还没有独立正文时发生。
      const legacyToSave: string[] = [];
      for (const c of chapters) {
        if (serverIds.has(c.id) || (!c.body && !c.revisionNotes)) continue;
        const legacy: ManuscriptChapter = {
          outlineCardId: c.id,
          content: c.body || '',
          revisionNotes: c.revisionNotes || '',
          revision: 0,
          updatedAt: c.updatedAt || new Date().toISOString(),
        };
        map[c.id] = legacy;
        drafts.current[c.id] = legacy;
        saved.current[c.id] = '';
        revisions.current[c.id] = 0;
        legacyToSave.push(c.id);
      }

      // 恢复浏览器里未成功同步的正文。
      try {
        const local = JSON.parse(localStorage.getItem(key) || 'null') as { items?: ManuscriptChapter[]; revisions?: Record<string, number> } | null;
        if (local?.items?.length) {
          for (const x of local.items) {
            if (!chapters.some(c => c.id === x.outlineCardId)) continue;
            const localRevision = local.revisions?.[x.outlineCardId];
            if (Number.isInteger(localRevision) && (localRevision as number) >= 0) revisions.current[x.outlineCardId] = localRevision as number;
            const recovered = { ...x, revision: revisions.current[x.outlineCardId] ?? x.revision ?? 0 };
            map[x.outlineCardId] = recovered;
            drafts.current[x.outlineCardId] = recovered;
          }
        }
      } catch {}

      setItems(map);
      const dirty = Object.keys(drafts.current).filter(id => signature(drafts.current[id]) !== saved.current[id]);
      if (dirty.length) {
        setStatus('pending');
        setTimeout(() => dirty.forEach(id => void flushOne(id)), 120);
      } else setStatus('saved');
      if (legacyToSave.length) setTimeout(() => legacyToSave.forEach(id => void flushOne(id)), 160);
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法读取正文');
      setStatus('error');
    }
  }, [bookId, chapters, flushOne, key]);

  useEffect(() => {
    drafts.current = {};
    saved.current = {};
    revisions.current = {};
    Object.values(timers.current).forEach(t => t && clearTimeout(t));
    timers.current = {};
    void load();
    return () => { mountedBook.current = ''; };
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const get = useCallback((card: Card): ManuscriptChapter => {
    return drafts.current[card.id] || {
      outlineCardId: card.id,
      content: card.body || '',
      revisionNotes: card.revisionNotes || '',
      revision: revisions.current[card.id] || 0,
      updatedAt: card.updatedAt || new Date().toISOString(),
    };
  }, []);

  const update = useCallback((card: Card, patch: Partial<Pick<ManuscriptChapter, 'content' | 'revisionNotes'>>) => {
    const base = get(card);
    const next: ManuscriptChapter = { ...base, ...patch, updatedAt: new Date().toISOString() };
    drafts.current[card.id] = next;
    setItems(all => ({ ...all, [card.id]: next }));
    setStatus('pending');
    setError('');
    cache();
    if (timers.current[card.id]) clearTimeout(timers.current[card.id]);
    timers.current[card.id] = setTimeout(() => void flushOne(card.id), 850);
  }, [cache, flushOne, get]);

  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      const dirty = Object.keys(drafts.current).some(id => signature(drafts.current[id]) !== saved.current[id]);
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    const hidden = () => { if (document.hidden) void flushAll(); };
    const online = () => void flushAll();
    window.addEventListener('beforeunload', leave);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('beforeunload', leave);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [flushAll]);

  return { items, status, error, get, update, flushAll, load };
}
