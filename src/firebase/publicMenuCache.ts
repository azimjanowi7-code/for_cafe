import type {PublicMenuData} from './publicMenu';
export const PUBLIC_MENU_CACHE='cafe-public-menu-v1';
export const publicMenuCachePath=(cafeId:string)=>`/__public-menu/${encodeURIComponent(cafeId)}.json`;
type Snapshot={version:1;cafeId:string;menu:PublicMenuData};
export async function loadMenuWithCache(options:{cafeId:string;read:()=>Promise<PublicMenuData>;online:()=>boolean;cache?:Pick<CacheStorage,'open'|'match'>;storage?:Pick<Storage,'getItem'|'setItem'>;timeoutMs?:number}):Promise<PublicMenuData>{
 const {cafeId}=options,key=publicMenuCachePath(cafeId),storageKey=`cafe-public-menu:v1:${cafeId}`;
 const saved=async()=>{let value:Snapshot|null=null;try{const response=await options.cache?.match(key);if(response)value=await response.json()}catch{}if(!value)try{value=JSON.parse(options.storage?.getItem(storageKey)||'null')}catch{}if(value?.version!==1||value.cafeId!==cafeId||!Array.isArray(value.menu?.dishes)||!Array.isArray(value.menu?.categories))throw Error('NO_CACHED_PUBLIC_MENU');return {...value.menu,outdated:true}};
 if(!options.online())return saved();let timer:ReturnType<typeof setTimeout>|undefined;
 try{const menu=await Promise.race([options.read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('PUBLIC_MENU_TIMEOUT')),options.timeoutMs??8000)})]),snapshot:Snapshot={version:1,cafeId,menu};try{const cache=await options.cache?.open(PUBLIC_MENU_CACHE);await cache?.put(key,new Response(JSON.stringify(snapshot),{headers:{'Content-Type':'application/json'}}))}catch{}try{options.storage?.setItem(storageKey,JSON.stringify(snapshot))}catch{}return {...menu,outdated:false}}catch{return saved()}finally{clearTimeout(timer)}
}
