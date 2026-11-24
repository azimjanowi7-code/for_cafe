import {claimHome} from '../../functions/src/identity';
import type {StaffSession} from './staffAuth';
export const offlineAuthError=(error:unknown)=>['auth/network-request-failed','unavailable','auth/timeout'].includes(String((error as {code?:string})?.code));
export function storeOfflineSession(storage:Pick<Storage,'setItem'>,session:StaffSession){try{storage.setItem(`cafe-auth-session:${session.uid}`,JSON.stringify(session))}catch{}}
export function readOfflineSession(storage:Pick<Storage,'getItem'>,uid:string,expectedCafe?:string):StaffSession|null{try{const value=JSON.parse(storage.getItem(`cafe-auth-session:${uid}`)||'null');if(value?.uid!==uid||typeof value?.name!=='string'||typeof value?.cafeId!=='string'||!['admin','waiter','cook'].includes(value?.role))return null;const home=claimHome(value,expectedCafe);return {...value,home}}catch{return null}}
