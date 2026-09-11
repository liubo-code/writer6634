import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Board from '@/components/board';
import '@/app/globals.css';
import '@/app/mobile.css';
import './sidebar-polish.css';

const SIDEBAR_KEY = 'fuxian-desktop-sidebar-open';

function DesktopApp(){
  const [sidebarOpen,setSidebarOpen]=useState(()=>{
    try{return localStorage.getItem(SIDEBAR_KEY)!=='false';}catch{return true;}
  });

  useEffect(()=>{
    try{localStorage.setItem(SIDEBAR_KEY,String(sidebarOpen));}catch{}
  },[sidebarOpen]);

  return <div className={'desktop-shell '+(sidebarOpen?'':'desktop-sidebar-collapsed')}>
    <Board ownerKey="desktop-local"/>
    <button
      className="desktop-sidebar-toggle"
      type="button"
      aria-label={sidebarOpen?'收起左侧栏':'展开左侧栏'}
      title={sidebarOpen?'收起左侧栏':'展开左侧栏'}
      onClick={()=>setSidebarOpen(v=>!v)}
    >
      {sidebarOpen?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>} 
    </button>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp/>
  </React.StrictMode>,
);