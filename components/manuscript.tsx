'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, BookOpen, Check, ChevronLeft, ChevronRight, Download, FileText, Focus, Loader2, Network, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster, toast } from 'sonner';
import { useManuscript } from '@/lib/use-manuscript';
import { fieldNames, wordCount, type Book, type Card } from '@/lib/story';

function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Props = {
  ownerKey: string;
  book: Book;
  books: Book[];
  chapters: Card[];
  numbers: Map<string, number>;
  onChooseBook: (id: string) => void;
  onBackOutline: (cardId?: string) => void;
  onAddChapter: () => string;
  onUpdateCard: (id: string, patch: Partial<Card>) => void;
  onReorder: (id: string, delta: number) => void;
  onDeleteChapter: (id: string) => void;
  onNewBook: () => void;
};

export default function ManuscriptWorkspace({
  ownerKey, book, books, chapters, numbers,
  onChooseBook, onBackOutline, onAddChapter, onUpdateCard, onReorder, onDeleteChapter, onNewBook,
}: Props) {
  const ms = useManuscript(ownerKey, book.id, chapters);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [focus, setFocus] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const remembered = localStorage.getItem('fuxian-manuscript-chapter-' + book.id) || '';
      if (chapters.some(c => c.id === remembered)) setSelectedId(remembered);
      else setSelectedId(chapters[0]?.id || '');
      const savedFont = Number(localStorage.getItem('fuxian-manuscript-font-size'));
      if (savedFont >= 15 && savedFont <= 24) setFontSize(savedFont);
    } catch { setSelectedId(chapters[0]?.id || ''); }
  }, [book.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedId && !chapters.some(c => c.id === selectedId)) setSelectedId(chapters[0]?.id || '');
    if (!selectedId && chapters[0]) setSelectedId(chapters[0].id);
  }, [chapters, selectedId]);

  useEffect(() => {
    if (ms.status !== 'saved') return;
    for (const c of chapters) {
      if (!c.body && !c.revisionNotes) continue;
      const migrated = ms.items[c.id];
      if (!migrated) continue;
      if (migrated.content === (c.body || '') && migrated.revisionNotes === (c.revisionNotes || '')) {
        onUpdateCard(c.id, { body: '', revisionNotes: '' });
      }
    }
  }, [ms.status, ms.items]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectChapter = (id: string) => {
    setSelectedId(id);
    setMatchIndex(0);
    try { localStorage.setItem('fuxian-manuscript-chapter-' + book.id, id); } catch {}
  };

  const chapter = chapters.find(c => c.id === selectedId) || chapters[0];
  const current = chapter ? ms.get(chapter) : null;
  const filtered = useMemo(() => chapters.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const m = ms.get(c);
    return [c.title, c.text, m.content, ...Object.values(c.fields)].join(' ').toLowerCase().includes(q);
  }), [chapters, search, ms.items]); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    if (!findText || !current?.content) return [] as number[];
    const source = matchCase ? current.content : current.content.toLocaleLowerCase();
    const needle = matchCase ? findText : findText.toLocaleLowerCase();
    const result: number[] = [];
    let from = 0;
    while (from <= source.length - needle.length) {
      const at = source.indexOf(needle, from);
      if (at < 0) break;
      result.push(at);
      from = at + Math.max(needle.length, 1);
    }
    return result;
  }, [current?.content, findText, matchCase]);

  useEffect(() => {
    setMatchIndex(i => matches.length ? Math.min(i, matches.length - 1) : 0);
  }, [matches.length, findText, matchCase, selectedId]);

  const totalWords = useMemo(() => chapters.reduce((n, c) => n + wordCount(ms.get(c).content), 0), [chapters, ms.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentIndex = chapter ? chapters.findIndex(c => c.id === chapter.id) : -1;
  const chars = chapter ? chapter.characterIds.map(id => book.cards.find(c => c.id === id && !c.deletedAt)).filter((x): x is Card => !!x) : [];
  const stage = chapter ? book.stages.find(s => s.id === chapter.stageId) : undefined;
  const manuscriptStatus = ({ loading: '正在读取正文', saved: '正文已保存', pending: '等待保存', saving: '正在保存正文', error: '正文保存未完成' } as Record<string, string>)[ms.status];

  const openFind = () => {
    setFindOpen(true);
    setTimeout(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    }, 0);
  };

  const closeFind = () => {
    setFindOpen(false);
    setTimeout(() => bodyRef.current?.focus(), 0);
  };

  const selectMatch = (index: number) => {
    if (!matches.length || !findText) return;
    const safe = (index + matches.length) % matches.length;
    setMatchIndex(safe);
    const start = matches[safe];
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, start + findText.length);
    });
  };

  const replaceCurrent = () => {
    if (!chapter || !current || !matches.length || !findText) return;
    const start = matches[matchIndex] ?? matches[0];
    const nextContent = current.content.slice(0, start) + replaceText + current.content.slice(start + findText.length);
    ms.update(chapter, { content: nextContent });
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, start + replaceText.length);
    });
  };

  const replaceAll = () => {
    if (!chapter || !current || !matches.length || !findText) return;
    let output = '';
    let last = 0;
    for (const start of matches) {
      output += current.content.slice(last, start) + replaceText;
      last = start + findText.length;
    }
    output += current.content.slice(last);
    const count = matches.length;
    ms.update(chapter, { content: output });
    setMatchIndex(0);
    toast.success(`本章已替换 ${count} 处`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openFind();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        openFind();
        return;
      }
      if (e.key === 'Escape' && findOpen) {
        e.preventDefault();
        closeFind();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [findOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportText = async () => {
    const ok = await ms.flushAll();
    if (!ok) { toast.error('还有正文没有成功同步，先保留当前页面。'); return; }
    const text = chapters.map((c, i) => `第 ${i + 1} 章 ${c.title || '未命名'}\n\n${ms.get(c).content}`).join('\n\n\n');
    download(book.title + '-正文.txt', text);
  };

  const addChapter = () => {
    const id = onAddChapter();
    if (id) {
      selectChapter(id);
      setTimeout(() => bodyRef.current?.focus(), 80);
    }
  };

  const deleteChapter = () => {
    if (!chapter) return;
    const next = chapters[currentIndex + 1] || chapters[currentIndex - 1];
    if (!confirm(`把「${chapter.title || `第 ${numbers.get(chapter.id)} 章` }」移入大纲回收站？正文会保留，恢复章节后仍可继续写。`)) return;
    onDeleteChapter(chapter.id);
    setSelectedId(next?.id || '');
  };

  return <div className={'manuscript-app ' + (focus ? 'manuscript-focus' : '')}>
    <Toaster richColors position="bottom-right"/>
    {!focus && <aside className="manuscript-sidebar">
      <div className="manuscript-brand"><span><Network size={20}/></span><div><strong>伏线</strong><small>小说工作台</small></div></div>
      <div className="manuscript-book-picker">
        <select aria-label="切换小说" value={book.id} onChange={e => onChooseBook(e.target.value)}>{books.map(b => <option key={b.id} value={b.id}>{b.demo ? '示例 · ' : ''}{b.title}</option>)}</select>
        <Button variant="ghost" size="icon" aria-label="新建小说" onClick={onNewBook}><Plus/></Button>
      </div>
      <div className="manuscript-section-tabs"><button onClick={() => onBackOutline()}><BookOpen size={15}/>大纲</button><button className="active"><FileText size={15}/>正文</button></div>
      <div className="manuscript-search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索章节 / 正文"/></div>
      <div className="manuscript-chapter-list">
        {filtered.map(c => {
          const n = numbers.get(c.id) || chapters.indexOf(c) + 1;
          const count = wordCount(ms.get(c).content);
          return <button key={c.id} className={c.id === chapter?.id ? 'active' : ''} onClick={() => selectChapter(c.id)}>
            <span className="manuscript-chapter-no">{String(n).padStart(2, '0')}</span>
            <span className="manuscript-chapter-name"><strong>{c.title || '未命名章节'}</strong><small>{count.toLocaleString()} 字 · {c.status}</small></span>
          </button>;
        })}
        {!filtered.length && <p className="manuscript-empty-list">没有匹配的章节。</p>}
      </div>
      <div className="manuscript-sidebar-footer"><Button variant="outline" onClick={addChapter}><Plus size={15}/>新建章节</Button><span>{chapters.length} 章 · {totalWords.toLocaleString()} 字</span></div>
    </aside>}

    <main className="manuscript-workspace">
      <header className="manuscript-topbar">
        <div className="manuscript-heading">
          {focus && <Button variant="ghost" size="icon" aria-label="退出专注" onClick={() => setFocus(false)}><ArrowLeft/></Button>}
          <div><span>{book.title}</span><strong>{chapter ? `第 ${numbers.get(chapter.id)} 章` : '正文'}</strong></div>
        </div>
        <div className="manuscript-actions">
          <span className={'save-state ' + (ms.status === 'error' ? 'save-error' : '')}>{ms.status === 'saved' ? <Check size={14}/> : ms.status === 'saving' ? <Loader2 size={14} className="spin"/> : null}{manuscriptStatus}</span>
          <label className="manuscript-font"><span>Aa</span><select value={fontSize} onChange={e => { const n = Number(e.target.value); setFontSize(n); try { localStorage.setItem('fuxian-manuscript-font-size', String(n)); } catch {} }}><option value="16">16</option><option value="18">18</option><option value="20">20</option><option value="22">22</option></select></label>
          <Button variant="ghost" size="icon" aria-label="查找替换" title="查找 / 替换（Ctrl+F / Ctrl+H）" onClick={openFind}><Search/></Button>
          <Button variant="ghost" size="icon" aria-label={focus ? '退出专注模式' : '专注模式'} onClick={() => setFocus(v => !v)}><Focus/></Button>
          <Button variant="outline" onClick={() => void exportText()}><Download size={15}/><span className="desktop-text">导出正文</span></Button>
        </div>
      </header>

      {findOpen && <div className="flex flex-wrap items-center gap-2 border-b border-[#dce4ee] bg-white px-4 py-2 text-sm shadow-sm">
        <span className="mr-1 whitespace-nowrap font-medium text-[#51647a]">本章查找</span>
        <div className="flex h-9 min-w-[220px] flex-1 items-center rounded-md border border-[#d5dee8] bg-white px-2.5 focus-within:border-[#7ea3c5]">
          <Search size={15} className="mr-2 shrink-0 text-[#8a99ac]"/>
          <input ref={findInputRef} className="min-w-0 flex-1 border-0 bg-transparent outline-none" value={findText} placeholder="查找内容" onChange={e => { setFindText(e.target.value); setMatchIndex(0); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); selectMatch(matchIndex + (e.shiftKey ? -1 : 1)); } }}/>
        </div>
        <span className="min-w-[58px] text-center text-xs text-[#7b8999]">{findText ? (matches.length ? `${matchIndex + 1} / ${matches.length}` : '0 / 0') : '—'}</span>
        <Button variant="outline" size="sm" disabled={!matches.length} onClick={() => selectMatch(matchIndex - 1)}>上一个</Button>
        <Button variant="outline" size="sm" disabled={!matches.length} onClick={() => selectMatch(matchIndex + 1)}>下一个</Button>
        <button type="button" title="区分大小写" aria-pressed={matchCase} onClick={() => setMatchCase(v => !v)} className={'h-9 rounded-md border px-3 text-xs font-semibold ' + (matchCase ? 'border-[#6f94b6] bg-[#eaf2f8] text-[#345d85]' : 'border-[#d5dee8] bg-white text-[#6d7c8d]')}>Aa</button>
        <div className="flex h-9 min-w-[190px] flex-1 items-center rounded-md border border-[#d5dee8] bg-white px-2.5 focus-within:border-[#7ea3c5]">
          <input className="min-w-0 flex-1 border-0 bg-transparent outline-none" value={replaceText} placeholder="替换为" onChange={e => setReplaceText(e.target.value)}/>
        </div>
        <Button variant="outline" size="sm" disabled={!matches.length} onClick={replaceCurrent}>替换</Button>
        <Button variant="outline" size="sm" disabled={!matches.length} onClick={replaceAll}>本章全部替换</Button>
        <Button variant="ghost" size="icon" aria-label="关闭查找替换" onClick={closeFind}><X size={17}/></Button>
      </div>}

      {ms.error && <div className="notice error"><span>{ms.error}</span><Button size="sm" variant="outline" onClick={() => void ms.flushAll()}>重试保存</Button></div>}

      {!chapter ? <div className="manuscript-empty"><FileText size={34}/><h2>这本书还没有章节</h2><p>先建第一章，正文和大纲会共用同一个章节编号。</p><Button onClick={addChapter}><Plus/>新建第一章</Button></div> : <div className={"manuscript-editor-shell "+(!outlineOpen?"outline-collapsed":"")}>
        {!focus && <div className="manuscript-edge-nav"><Button variant="ghost" size="sm" disabled={currentIndex <= 0} onClick={() => selectChapter(chapters[currentIndex - 1].id)}><ChevronLeft/>上一章</Button><Button variant="ghost" size="sm" disabled={currentIndex < 0 || currentIndex >= chapters.length - 1} onClick={() => selectChapter(chapters[currentIndex + 1].id)}>下一章<ChevronRight/></Button></div>}
        <section className="manuscript-paper">
          <div className="manuscript-paper-head"><span>第 {numbers.get(chapter.id)} 章</span><input aria-label="章节标题" value={chapter.title} placeholder="章节标题" onChange={e => onUpdateCard(chapter.id, { title: e.target.value })}/><div><span>{wordCount(current?.content || '').toLocaleString()} 字</span><span>{stage?.title || '未分阶段'}</span></div></div>
          <textarea ref={bodyRef} className="manuscript-body" style={{ fontSize }} aria-label="正文编辑器" spellCheck={false} value={current?.content || ''} placeholder="从眼前这一句开始。" onChange={e => ms.update(chapter, { content: e.target.value })}/>
          {!focus && <div className="manuscript-paper-foot"><div><Button variant="ghost" size="icon" aria-label="章节上移" onClick={() => onReorder(chapter.id, -1)}><ArrowUp/></Button><Button variant="ghost" size="icon" aria-label="章节下移" onClick={() => onReorder(chapter.id, 1)}><ArrowDown/></Button></div><Button variant="ghost" size="sm" onClick={deleteChapter}><Trash2 size={14}/>移入回收站</Button></div>}
        </section>

        {!focus && <aside className={'outline-reference ' + (!outlineOpen ? 'collapsed' : '')}>
          <div className="outline-reference-head"><div><span>本章大纲</span><strong>{chapter.title || `第 ${numbers.get(chapter.id)} 章`}</strong></div><Button variant="ghost" size="sm" onClick={() => setOutlineOpen(v => !v)}>{outlineOpen ? '收起' : '展开'}</Button></div>
          {outlineOpen && <div className="outline-reference-scroll">
            <Button variant="outline" className="outline-open-card" onClick={() => onBackOutline(chapter.id)}><Settings2 size={14}/>打开大纲卡编辑</Button>
            {chapter.text && <Reference label="核心事件" value={chapter.text}/>} 
            {['goal','choice','event','result','pov','emotion','relation','detail','hook'].map(k => chapter.fields[k] ? <Reference key={k} label={fieldNames[k] || k} value={chapter.fields[k]}/> : null)}
            <div className="outline-reference-block"><span>出场人物</span>{chars.length ? <div className="outline-character-tags">{chars.map(c => <button key={c.id} onClick={() => onBackOutline(c.id)}>{c.title || '未命名人物'}</button>)}</div> : <p>还没绑定人物。</p>}</div>
            {!!chapter.tags.length && <div className="outline-reference-block"><span>标签</span><div className="outline-tags">{chapter.tags.map(t => <i key={t}>{t}</i>)}</div></div>}
            <label className="outline-notes"><span>修文备忘</span><textarea value={current?.revisionNotes || ''} placeholder="这里记修文问题，不打断正文。" onChange={e => ms.update(chapter, { revisionNotes: e.target.value })}/></label>
          </div>}
        </aside>}
      </div>}
    </main>
  </div>;
}

function Reference({ label, value }: { label: string; value: string }) {
  return <div className="outline-reference-block"><span>{label}</span><p>{value}</p></div>;
}
