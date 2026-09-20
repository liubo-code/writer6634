'use client';
import { useEffect,useRef,useState,useCallback } from 'react';
import { WorkspaceSchema, type Workspace } from './story';
import { loadLocalWorkspace, saveLocalWorkspace } from './desktop-store';

export function useWorkspace(owner:string){
  const [data,setData]=useState<Workspace|null>(null),[status,setStatus]=useState('loading'),[error,setError]=useState(''),[recovery,setRecovery]=useState<Workspace|null>(null),[tick,setTick]=useState(0);
  const current=useRef<Workspace|null>(null),rev=useRef(0),saved=useRef(''),inflight=useRef<Promise<boolean>|null>(null),blocked=useRef(false),undoStack=useRef<Workspace[]>([]),redoStack=useRef<Workspace[]>([]);
  const key='fuxian-unsaved-'+owner;

  const cache=useCallback((d:Workspace)=>{
    try{localStorage.setItem(key,JSON.stringify({data:d,revision:rev.current}));}catch{}
  },[key]);

  const load=useCallback(async()=>{
    setStatus('loading');
    try{
      const local=await loadLocalWorkspace(owner);
      const d=WorkspaceSchema.parse(local.data);
      rev.current=local.revision;
      current.current=d;
      saved.current=JSON.stringify(d);
      blocked.current=false;
      setData(d);
      setStatus('saved');
      setError('');
      try{
        const raw=localStorage.getItem(key);
        if(raw){const cached=WorkspaceSchema.safeParse(JSON.parse(raw).data);if(cached.success&&JSON.stringify(cached.data)!==saved.current)setRecovery(cached.data);}
      }catch{}
    }catch(e){setError(e instanceof Error?e.message:'无法读取本地数据');setStatus('error');}
  },[key,owner]);

  useEffect(()=>{void load();},[load]);

  const flush=useCallback(()=>{
    if(inflight.current)return inflight.current;
    if(blocked.current||!current.current)return Promise.resolve(false);
    const job=(async()=>{
      try{
        while(current.current&&JSON.stringify(current.current)!==saved.current){
          setStatus('saving');
          const text=JSON.stringify(current.current);
          const nextRevision=rev.current+1;
          await saveLocalWorkspace(owner,JSON.parse(text) as Workspace,nextRevision);
          rev.current=nextRevision;
          saved.current=text;
          if(current.current&&JSON.stringify(current.current)===text){try{localStorage.removeItem(key);}catch{}}
          else if(current.current)cache(current.current);
        }
        setStatus('saved');setError('');return true;
      }catch(e){setStatus('error');setError(e instanceof Error?e.message:'本地保存未完成');return false;}
    })();
    inflight.current=job;
    void job.finally(()=>{inflight.current=null;});
    return job;
  },[cache,key,owner]);

  const commit=useCallback((fn:(draft:Workspace)=>void)=>{
    if(!current.current)return;
    const next=structuredClone(current.current);fn(next);
    const parsed=WorkspaceSchema.safeParse(next);
    if(!parsed.success){setError('内容超过限制或包含无效关联，请导出后检查。');return;}
    if(JSON.stringify(parsed.data)===JSON.stringify(current.current))return;
    undoStack.current.push(current.current);if(undoStack.current.length>35)undoStack.current.shift();redoStack.current=[];
    current.current=parsed.data;setData(parsed.data);cache(parsed.data);setStatus('pending');setTick(t=>t+1);
  },[cache]);

  const history=useCallback((redo=false)=>{
    const from=redo?redoStack.current:undoStack.current,to=redo?undoStack.current:redoStack.current,next=from.pop();
    if(!next||!current.current)return;
    to.push(current.current);current.current=next;setData(next);cache(next);setStatus('pending');setTick(t=>t+1);
  },[cache]);

  useEffect(()=>{if(!tick)return;const timer=setTimeout(()=>void flush(),250);return()=>clearTimeout(timer);},[tick,flush]);
  useEffect(()=>{
    const leave=(e:BeforeUnloadEvent)=>{if(current.current&&JSON.stringify(current.current)!==saved.current){e.preventDefault();e.returnValue='';}};
    const hidden=()=>{if(document.hidden)void flush();};
    window.addEventListener('beforeunload',leave);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('beforeunload',leave);document.removeEventListener('visibilitychange',hidden);};
  },[flush]);

  return{data,status,error,recovery,setRecovery,commit,flush,load,history,canUndo:undoStack.current.length>0,canRedo:redoStack.current.length>0,blocked:blocked.current,desktop:true};
}
