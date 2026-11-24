import {initializeAppCheck,CustomProvider,getToken,type AppCheck} from 'firebase/app-check';
import {browserSessionPersistence,getIdTokenResult,onIdTokenChanged,setPersistence,signInWithEmailAndPassword,signOut,type User} from 'firebase/auth';
import {doc,getDoc} from 'firebase/firestore';
import {httpsCallable} from 'firebase/functions';
import {firebaseClients} from './client';
import {claimHome,syntheticEmail,normalizeCafeCode,type ClaimRole} from '../../functions/src/identity';
import {offlineAuthError,readOfflineSession,storeOfflineSession} from './offlineSession';
import {StaffAuthError} from './authErrors';
export type StaffSession={uid:string;cafeId:string;role:ClaimRole;name:string;home:'admin'|'waiter'|'cook'};
let appCheck:AppCheck|undefined,persistence:Promise<void>|undefined,expectedLoginCafe:string|undefined;
function clients(){if(import.meta.env.VITE_FIREBASE_ENV!=='dev'||import.meta.env.VITE_FIREBASE_PROJECT_ID!=='demo-for-cafe')throw new StaffAuthError('connection');const result=firebaseClients();if(!appCheck)appCheck=initializeAppCheck(result.app,{provider:new CustomProvider({getToken:async()=>({token:'f2-emulator-only-app-check',expireTimeMillis:Date.now()+60000})}),isTokenAutoRefreshEnabled:false});persistence??=setPersistence(result.auth,browserSessionPersistence);return result}
export async function lookupCafe(code:string){let normalized:string;try{normalized=normalizeCafeCode(code)}catch{throw new StaffAuthError('unknown-code')}const {functions}=clients();await getToken(appCheck!);const result=await httpsCallable<{code:string},{cafeId:string}>(functions,'lookupCafeCode')({code:normalized});if(!result.data||typeof result.data.cafeId!=='string')throw new StaffAuthError('unknown-code');return result.data.cafeId}
export async function validateStaff(user:User,expectedCafe?:string,forceRefresh=false):Promise<StaffSession>{const {db}=clients(),token=await getIdTokenResult(user,forceRefresh),home=claimHome(token.claims,expectedCafe),cafeId=String(token.claims.cafeId),profile=await getDoc(doc(db,'cafes',cafeId,'staff',user.uid));if(!profile.exists())throw new StaffAuthError('invalid-session');const staff=profile.data();if(staff.active!==true)throw new StaffAuthError('inactive-user');if(staff.role!==token.claims.role||typeof staff.name!=='string')throw new StaffAuthError('invalid-session');const session={uid:user.uid,cafeId,role:token.claims.role as ClaimRole,name:staff.name,home};storeOfflineSession(localStorage,session);return session}
export async function loginStaff(cafeId:string,name:string,password:string){const {auth}=clients();await persistence;const email=await syntheticEmail(name,cafeId);expectedLoginCafe=cafeId;try{const credential=await signInWithEmailAndPassword(auth,email,password);return await validateStaff(credential.user,cafeId,true)}catch(error){expectedLoginCafe=undefined;await signOut(auth);throw error}}
export async function logoutStaff(){expectedLoginCafe=undefined;const {auth}=clients();if(auth.currentUser)localStorage.removeItem(`cafe-auth-session:${auth.currentUser.uid}`);await signOut(auth)}
export function observeStaffSession(onSession:(session:StaffSession|null)=>void,onError:(error:unknown)=>void){
 const {auth}=clients();let generation=0,closed=false;
 const validate=async(user:User|null)=>{const current=++generation;if(!user){onSession(null);return}
  const cached=readOfflineSession(localStorage,user.uid,expectedLoginCafe);
  if(!navigator.onLine&&cached){onSession(cached);return}
  try{const session=await validateStaff(user,expectedLoginCafe);if(!closed&&generation===current)onSession(session)}catch(error){if(closed||generation!==current)return;if(offlineAuthError(error)&&cached){onSession(cached);return}localStorage.removeItem(`cafe-auth-session:${user.uid}`);await signOut(auth);onError(error);onSession(null)}
 };
 const stop=onIdTokenChanged(auth,user=>void validate(user));
 const refresh=()=>{const user=auth.currentUser;if(!user||!navigator.onLine)return;void getIdTokenResult(user,true).then(()=>validate(user)).catch(async error=>{if(closed||offlineAuthError(error))return;localStorage.removeItem(`cafe-auth-session:${user.uid}`);await signOut(auth);onError(error);onSession(null)})};
 const timer=setInterval(refresh,60000);window.addEventListener('online',refresh);
 return()=>{closed=true;generation++;clearInterval(timer);window.removeEventListener('online',refresh);stop()};
}
