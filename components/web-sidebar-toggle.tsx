'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpCircle, History, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Trash2 } from 'lucide-react';

const KEY = 'fuxian-web-sidebar-open';

export default function WebSidebarToggle(){
  const [open,setOpen]=useState(true);
  const [ready,setReady]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const rootRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    let next=true;
    try{next=localStorage.getItem(KEY)!=='false';}catch{}
    setOpen(next);
    document.documentElement.classList.toggle('fuxian-sidebar-collapsed',!next);
    setReady(true);
    return()=>document.documentElement.classList.remove('fuxian-sidebar-collapsed');
  },[]);

  useEffect(()=>{
    if(!menuOpen)return;
    const close=(event:MouseEvent)=>{
      if(rootRef.current&&!rootRef.current.contains(event.target as Node))setMenuOpen(false);
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenuOpen(false);};
    document.addEventListener('mousedown',close);
    window.addEventListener('keydown',escape);
    return()=>{
      document.removeEventListener('mousedown',close);
      window.removeEventListener('keydown',escape);
    };
  },[menuOpen]);

  const toggle=()=>{
    const next=!open;
    setOpen(next);
    document.documentElement.classList.toggle('fuxian-sidebar-collapsed',!next);
    try{localStorage.setItem(KEY,String(next));}catch{}
  };

  const openSidebarAction=(label:string)=>{
    const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.app-sidebar [data-slot="sidebar-menu-button"]'));
    const target=buttons.find(button=>button.textContent?.replace(/\s+/g,'').includes(label));
    if(target)target.click();
    setMenuOpen(false);
  };

  if(!ready)return null;
  return <div className="web-sidebar-tools" ref={rootRef}>
    <button
      type="button"
      className="web-sidebar-toggle"
      aria-label={open?'收起左侧栏':'展开左侧栏'}
      title={open?'收起左侧栏':'展开左侧栏'}
      onClick={toggle}
    >
      {open?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>} 
    </button>
    <button
      type="button"
      className={'web-sidebar-more '+(menuOpen?'active':'')}
      aria-label="更多大纲工具"
      aria-expanded={menuOpen}
      title="回收站、快照与帮助"
      onClick={()=>setMenuOpen(v=>!v)}
    >
      <MoreHorizontal size={19}/>
    </button>
    {menuOpen&&<div className="web-sidebar-utility-menu" role="menu">
      <button role="menuitem" onClick={()=>openSidebarAction('回收站')}><Trash2 size={16}/><span>回收站</span></button>
      <button role="menuitem" onClick={()=>openSidebarAction('大纲快照')}><History size={16}/><span>大纲快照</span></button>
      <button role="menuitem" onClick={()=>openSidebarAction('使用说明')}><HelpCircle size={16}/><span>使用说明</span></button>
    </div>}
  </div>;
}
