import {useEffect,useState} from 'react';
import {BookOpen,Users,QrCode,BarChart3,Settings2,ChevronRight,Menu} from 'lucide-react';
import type {Text} from './i18n';
import * as C from './components';
export default function AdminNavigation({t,active,onChange}:{t:Text;active:string;onChange:(id:string)=>void}){
 const[open,setOpen]=useState(false);
 useEffect(()=>{const query=matchMedia('(min-width:1024px)'),resize=()=>{if(query.matches)setOpen(false)};query.addEventListener('change',resize);return()=>query.removeEventListener('change',resize)},[]);
 const links=(close?:()=>void)=><nav className="admin-nav" aria-label={t.admin}>{[{id:'menu',label:t.menu,icon:BookOpen},{id:'staff',label:t.staff,icon:Users},{id:'tables',label:t.qr,icon:QrCode},{id:'reports',label:t.reports,icon:BarChart3},{id:'settings',label:t.settings,icon:Settings2}].map(n=><button key={n.id} aria-current={active===n.id?'page':undefined} className={active===n.id?'active':''} onClick={()=>{onChange(n.id);close?.()}}><n.icon size={20}/><span>{n.label}</span><ChevronRight size={16}/></button>)}</nav>;
 return <><aside className="admin-sidebar"><span className="eyebrow">{t.admin}</span>{links()}</aside><div className="admin-mobile-toolbar"><C.Button variant="secondary" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><Menu/>{t.admin}</C.Button></div>{open&&<C.Modal className="admin-drawer" title={t.admin} onClose={()=>setOpen(false)}>{finish=>links(()=>finish(()=>setOpen(false)))}</C.Modal>}</>
}
