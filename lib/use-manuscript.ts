'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type ManuscriptChapter } from './manuscript';
import type { Card } from './story';
import { loadLocalManuscripts, saveLocalManuscript } from './desktop-store';

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
          const stored = await saveLocalManuscript(bookId, { ...current, revision: revisions.current[outlineCardId] || 0 });
          revisions.current[outlineCardId] = stored.revision;
          saved.current[outlineCardId] = sent;
          const latest = drafts.current[outlineCardId];
          if (latest) {
            const next = { ...latest, revision: stored.revision, updatedAt: stored.updatedAt };
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
      const localItems = await loadLocalManuscripts(bookId);
      if (mountedBook.current !== bookId) return;
      const map: ChapterMap = {};
      const storedIds = new Set<string>();
      for (const x of localItems) {
        map[x.outlineCardId] = x;
        drafts.current[x.outlineCardId] = x;
        saved.current[x.outlineCardId] = signature(x);
        revisions.current[x.outlineCardId] = x.revision;
        storedIds.add(x.outlineCardId);
      }

      const legacyToSave: string[] = [];
      for (const c of chapters) {
        if (storedIds.has(c.id) || (!c.body && !c.revisionNotes)) continue;
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

      try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null') as { items?: ManuscriptChapter[]; revisions?: Record<string, number> } | null;
        if (cached?.items?.length) {
          for (const x of cached.items) {
            if (!chapters.some(c => c.id === x.outlineCardId)) continue;
            const localRevision = cached.revisions?.[x.outlineCardId];
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
        setTimeout(() => dirty.forEach(id => void flushOne(id)), 60);
      } else setStatus('saved');
      if (legacyToSave.length) setTimeout(() => legacyToSave.forEach(id => void flushOne(id)), 80);
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
    timers.current[card.id] = setTimeout(() => void flushOne(card.id), 250);
  }, [cache, flushOne, get]);

  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      const dirty = Object.keys(drafts.current).some(id => signature(drafts.current[id]) !== saved.current[id]);
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    const hidden = () => { if (document.hidden) void flushAll(); };
    window.addEventListener('beforeunload', leave);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('beforeunload', leave);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [flushAll]);

  return { items, status, error, get, update, flushAll, load, desktop: true };
}
