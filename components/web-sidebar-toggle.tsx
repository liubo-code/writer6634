'use client';

import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const KEY = 'fuxian-web-sidebar-open';

export default function WebSidebarToggle(){
  const [open,setOpen]=useState(true);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    let next=true;
    try{next=localStorage.getItem(KEY)!=='false';}catch{}
    setOpen(next);
    document.documentElement.classList.toggle('fuxian-sidebar-collapsed',!next);
    setReady(true);
    return()=>document.documentElement.classList.remove('fuxian-sidebar-collapsed');
  },[]);

  const toggle=()=>{
    const next=!open;
    setOpen(next);
    document.documentElement.classList.toggle('fuxian-sidebar-collapsed',!next);
    try{localStorage.setItem(KEY,String(next));}catch{}
  };

  if(!ready)return null;
  return <button
    type="button"
    className="web-sidebar-toggle"
    aria-label={open?'收起左侧栏':'展开左侧栏'}
    title={open?'收起左侧栏':'展开左侧栏'}
    onClick={toggle}
  >
    {open?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>} 
  </button>;
}
