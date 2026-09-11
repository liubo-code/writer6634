'use client';
import { useEffect,useRef,useState } from 'react';
import { GripHorizontal,Pin,Plus,Minus,Maximize,Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty,EmptyHeader,EmptyTitle,EmptyDescription } from '@/components/ui/empty';
import { cardFieldLabel,type Book,type Card,type Link,labels } from '@/lib/story';

export function CardFace({card,book,number,onOpen}:{card:Card;book:Book;number?:number;onOpen:(id:string)=>void}){
  const stage=book.stages.find(s=>s.id===card.stageId);
  const highlighted=card.highlightFields
    .filter(k=>!card.hiddenFields.includes(k))
    .map(k=>({key:k,label:cardFieldLabel(card,k),value:k==='__text'?card.text:(card.fields[k]||'')}))
    .filter(x=>x.value.trim())
    .slice(0,2);
  const showBody=!card.hiddenFields.includes('__text')&&!card.highlightFields.includes('__text');
  const tags=[...card.tags,...(card.kind==='chapter'?(stage?.tags||[]):[])].filter((x,i,a)=>a.indexOf(x)===i).slice(0,4);
  return <>
    <button className="paper-content" onClick={()=>onOpen(card.id)}>
      <span className="paper-number">{card.kind==='chapter'?`CHAPTER ${String(number||'—').padStart(2,'0')}`:labels[card.kind]}</span>
      <h3>{card.title||'未命名'+labels[card.kind]}</h3>
      {showBody&&<p>{card.text||'留一点空间给还没想好的故事。'}</p>}
      {!!highlighted.length&&<div className="paper-highlights">{highlighted.map(x=><span key={x.key}><b>{x.label}</b>{x.value}</span>)}</div>}
      {!!tags.length&&<div className="paper-tags">{tags.map(t=><i key={t}>#{t}</i>)}</div>}
    </button>
    {card.kind==='chapter'&&<div className="name-tags">{card.characterIds.map(id=>book.cards.find(c=>c.id===id&&!c.deletedAt)).filter((c):c is Card=>!!c).slice(0,4).map(c=><button key={c.id} onClick={()=>onOpen(c.id)}>{c.title||'未命名人物'}</button>)}</div>}
    <footer><span>{card.status}</span><span>{stage?.title||labels[card.kind]}</span></footer>
  </>;
}

export default function Corkboard({book,cards,numbers,onOpen,onMove,onAddLink,onLink,onAdd}:{book:Book;cards:Card[];numbers:Map<string,number>;onOpen:(id:string)=>void;onMove:(id:string,x:number,y:number)=>void;onAddLink:(a:string,b:string)=>void;onLink:(id:string)=>void;onAdd:()=>void}){
  const viewport=useRef<HTMLDivElement>(null);
  const [camera,setCamera]=useState({x:30,y:30,z:.85}),[moving,setMoving]=useState<{id:string;x:number;y:number}|null>(null),[connecting,setConnecting]=useState(false),[source,setSource]=useState('');
  const drag=useRef<{id:string;sx:number;sy:number;x:number;y:number;moved:boolean}|null>(null),pan=useRef<{sx:number;sy:number;x:number;y:number}|null>(null),cam=useRef(camera);cam.current=camera;
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('fuxian-camera-'+book.id)||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&saved.z>=.25&&saved.z<=1.8)setCamera(saved);else setCamera({x:30,y:30,z:.85});}catch{}setSource('');setConnecting(false);},[book.id]);
  useEffect(()=>{const t=setTimeout(()=>{try{localStorage.setItem('fuxian-camera-'+book.id,JSON.stringify(camera));}catch{}},300);return()=>clearTimeout(t);},[camera,book.id]);
  useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();const c=cam.current;if(e.ctrlKey||e.metaKey){const rect=el.getBoundingClientRect(),px=e.clientX-rect.left,py=e.clientY-rect.top,z=Math.max(.25,Math.min(1.8,c.z*Math.exp(-e.deltaY*.006)));setCamera({z,x:px-(px-c.x)*z/c.z,y:py-(py-c.y)*z/c.z});}else setCamera({...c,x:c.x-e.deltaX,y:c.y-e.deltaY});};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
  function click(id:string){if(!connecting){onOpen(id);return;}if(!source){setSource(id);return;}if(source!==id){onAddLink(source,id);setSource('');}else setSource('');}
  function start(e:React.PointerEvent,id:string){if(e.button!==0)return;e.stopPropagation();const c=book.cards.find(c=>c.id===id)!;drag.current={id,sx:e.clientX,sy:e.clientY,x:c.x,y:c.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}
  function move(e:React.PointerEvent){const d=drag.current;if(!d)return;const c=book.cards.find(c=>c.id===d.id);if(c?.pinned)return;const dx=(e.clientX-d.sx)/camera.z,dy=(e.clientY-d.sy)/camera.z;if(Math.abs(dx)+Math.abs(dy)>5)d.moved=true;if(d.moved)setMoving({id:d.id,x:Math.max(-48000,Math.min(48000,d.x+dx)),y:Math.max(-48000,Math.min(48000,d.y+dy))});}
  function end(e:React.PointerEvent,cancel=false){const d=drag.current;if(!d)return;drag.current=null;if(d.moved&&moving&&!cancel)onMove(d.id,moving.x,moving.y);else if(!cancel&&!d.moved)click(d.id);setMoving(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
  function fit(){const el=viewport.current;if(!el||!cards.length)return;const minX=Math.min(...cards.map(c=>c.x)),minY=Math.min(...cards.map(c=>c.y)),maxX=Math.max(...cards.map(c=>c.x+286)),maxY=Math.max(...cards.map(c=>c.y+258));const z=Math.max(.25,Math.min(1,(el.clientWidth-80)/(maxX-minX),(el.clientHeight-100)/(maxY-minY)));setCamera({z,x:(el.clientWidth-(maxX-minX)*z)/2-minX*z,y:(el.clientHeight-(maxY-minY)*z)/2-minY*z});}
  const position=(c:Card)=>moving?.id===c.id?moving:c;
  const zoom=(factor:number)=>{const el=viewport.current;if(!el)return;const c=camera,z=Math.max(.25,Math.min(1.8,c.z*factor)),x=el.clientWidth/2,y=el.clientHeight/2;setCamera({z,x:x-(x-c.x)*z/c.z,y:y-(y-c.y)*z/c.z});};
  return <div className={'corkboard '+(connecting?'connecting':'')} ref={viewport} onPointerDown={e=>{if(e.button!==0||((e.target as Element).closest('button,[data-paper],[data-edge]')))return;e.currentTarget.setPointerCapture(e.pointerId);pan.current={sx:e.clientX,sy:e.clientY,x:camera.x,y:camera.y};}} onPointerMove={e=>{const p=pan.current;if(p)setCamera(c=>({...c,x:p.x+e.clientX-p.sx,y:p.y+e.clientY-p.sy}));}} onPointerUp={()=>pan.current=null} onPointerCancel={()=>pan.current=null}>
    <div className="canvas-hint">{connecting?(source?'再点一张卡片，建立关联':'点两张卡片建立关联，也可以继续拖动'):'拖动卡片顶部自由摆放 · 拖空白处移动画布'}</div>
    <div className="canvas-world" style={{transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.z})`}}>
      <svg className="connections" width="1" height="1" aria-label="卡片关联">{book.links.map(l=>{const ac=cards.find(c=>c.id===l.from),bc=cards.find(c=>c.id===l.to);if(!ac||!bc)return null;const a=position(ac),b=position(bc),right=b.x>=a.x;const x1=a.x+(right?294:-8),x2=b.x+(right?-13:299),y1=a.y+105,y2=b.y+105,delta=Math.max(65,Math.abs(x2-x1)*.45),sign=right?1:-1;const path=l.style==='straight'?`M${x1},${y1} L${x2},${y2}`:l.style==='elbow'?`M${x1},${y1} H${(x1+x2)/2} V${y2} H${x2}`:`M${x1},${y1} C${x1+delta*sign},${y1} ${x2-delta*sign},${y2} ${x2},${y2}`;const marker='arrow-'+l.id;return <g key={l.id} data-edge="true" className="edge" role="button" tabIndex={0} aria-label={'编辑关联 '+l.label} onClick={()=>onLink(l.id)} onKeyDown={e=>{if(e.key==='Enter')onLink(l.id);}}><defs><marker id={marker} markerUnits="userSpaceOnUse" markerWidth={l.size+2} markerHeight={l.size+2} viewBox="0 0 20 20" refX="18" refY="10" orient="auto"><path d={l.arrow==='open'?'M3 3 L18 10 L3 17':'M2 2 L18 10 L2 18 Z'} stroke={l.color} strokeWidth="2" fill={l.arrow==='filled'?l.color:'none'}/></marker></defs><path d={path} fill="none" stroke="transparent" strokeWidth="18"/><path d={path} fill="none" stroke={l.color} strokeWidth={l.width} strokeDasharray={l.dash==='dash'?'9 6':l.dash==='dot'?'2 6':undefined} markerEnd={l.arrow==='none'?undefined:`url(#${marker})`}/>{l.label&&<text x={(x1+x2)/2} y={(y1+y2)/2-11} textAnchor="middle" fill={l.color} stroke="#edf2f7" strokeWidth="5" paintOrder="stroke">{l.label}</text>}</g>;})}</svg>
      {cards.map(c=>{const p=position(c);return <article key={c.id} data-paper="true" className={'paper '+(source===c.id?'selected-source':'')+(moving?.id===c.id?' moving':'')} style={{left:p.x,top:p.y,'--paper-accent':c.color} as React.CSSProperties}><div className="paper-grip" role="button" tabIndex={0} aria-label={`拖动或打开 ${c.title||labels[c.kind]}`} onPointerDown={e=>start(e,c.id)} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();click(c.id);}if(!c.pinned&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();onMove(c.id,c.x+(e.key==='ArrowRight'?20:e.key==='ArrowLeft'?-20:0),c.y+(e.key==='ArrowDown'?20:e.key==='ArrowUp'?-20:0));}}}><span>{labels[c.kind]}</span><GripHorizontal size={18}/>{c.pinned&&<Pin size={13}/>}</div><CardFace card={c} book={book} number={numbers.get(c.id)} onOpen={id=>id===c.id?click(id):onOpen(id)}/></article>;})}
    </div>
    {!cards.length&&<Empty className="canvas-empty"><EmptyHeader><EmptyTitle>故事从一张卡片开始</EmptyTitle><EmptyDescription>先写下这一章发生什么，细节可以慢慢补。</EmptyDescription></EmptyHeader><Button onClick={onAdd}><Plus/> 新建章节</Button></Empty>}
    <div className="canvas-bottom"><Button variant={connecting?'default':'outline'} onClick={()=>{setConnecting(!connecting);setSource('');}}><Link2 size={16}/>{connecting?'结束连线':'连接卡片'}</Button><div className="zoom-bar"><Button variant="ghost" size="icon" aria-label="缩小" onClick={()=>zoom(.8)}><Minus/></Button><span>{Math.round(camera.z*100)}%</span><Button variant="ghost" size="icon" aria-label="放大" onClick={()=>zoom(1.25)}><Plus/></Button><Button variant="ghost" size="icon" aria-label="显示全部卡片" onClick={fit}><Maximize/></Button></div></div>
  </div>;
}
