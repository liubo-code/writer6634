import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { FolderCog, FolderOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Board from '@/components/board';
import { chooseDesktopDataRoot, getDesktopDataRoot, mirrorCurrentLibrary } from '@/lib/desktop-store';
import '@/app/globals.css';
import '@/app/mobile.css';
import './sidebar-polish.css';

const SIDEBAR_KEY = 'fuxian-desktop-sidebar-open';

function DesktopApp(){
  const [sidebarOpen,setSidebarOpen]=useState(()=>{
    try{return localStorage.getItem(SIDEBAR_KEY)!=='false';}catch{return true;}
  });
  const [root,setRoot]=useState(()=>getDesktopDataRoot());
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    try{localStorage.setItem(SIDEBAR_KEY,String(sidebarOpen));}catch{}
  },[sidebarOpen]);

  const chooseRoot=async()=>{
    setBusy(true);
    try{
      const picked=await chooseDesktopDataRoot();
      if(!picked)return;
      setRoot(picked);
      await mirrorCurrentLibrary();
    }finally{setBusy(false);}
  };

  if(!root){
    return <main className="desktop-storage-setup">
      <div className="desktop-storage-card">
        <span className="desktop-storage-icon"><FolderOpen size={28}/></span>
        <h1>先选一个保存位置</h1>
        <p>伏线只把内容保存在你自己的电脑里。每本小说会按书名单独建立文件夹，之后也可以随时换位置。</p>
        <button type="button" onClick={()=>void chooseRoot()} disabled={busy}>{busy?'正在打开…':'选择文件夹'}</button>
        <small>不会上传云端，也不需要账号。</small>
      </div>
    </main>;
  }

  return <div className={'desktop-shell '+(sidebarOpen?'':'desktop-sidebar-collapsed')}>
    <Board ownerKey="local-user"/>
    <div className="desktop-shell-tools">
      <button
        className="desktop-sidebar-toggle"
        type="button"
        aria-label={sidebarOpen?'收起左侧栏':'展开左侧栏'}
        title={sidebarOpen?'收起左侧栏':'展开左侧栏'}
        onClick={()=>setSidebarOpen(v=>!v)}
      >
        {sidebarOpen?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>}
      </button>
      <button
        className="desktop-folder-button"
        type="button"
        aria-label="更改本地保存位置"
        title={'本地保存位置：'+root}
        onClick={()=>void chooseRoot()}
        disabled={busy}
      >
        <FolderCog size={18}/>
      </button>
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp/>
  </React.StrictMode>,
);
