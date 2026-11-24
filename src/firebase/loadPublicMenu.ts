import {cafeFromMenuPath} from '../publicMenuUrl';
import {firebaseDatabase} from './client';
import {readPublicMenu} from './publicMenu';
import {loadMenuWithCache} from './publicMenuCache';
export async function loadPublicMenu(){const cafeId=cafeFromMenuPath(location.pathname,import.meta.env.VITE_FIREBASE_CAFE_ID);return loadMenuWithCache({cafeId,read:()=>readPublicMenu(firebaseDatabase(),cafeId),online:()=>navigator.onLine,cache:typeof caches==='undefined'?undefined:caches,storage:localStorage})}
