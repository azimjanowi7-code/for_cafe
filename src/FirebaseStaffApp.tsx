import {useEffect,useState} from 'react';
import {ArrowRight,Coffee} from 'lucide-react';
import App from './App';
import {useFirebaseWorkspace} from './firebase/useFirebaseWorkspace';
function AuthenticatedWorkspace({identity,onLogout}:{identity:StaffSession;onLogout:()=>void}){const workspace=useFirebaseWorkspace(identity);return <App identity={identity} reporting={reporting} workspace={workspace} onLogout={onLogout}/>}
import {FirebaseReports,FirebaseWaiterStats,FirebaseKitchenStats} from './FirebaseReports';
const reporting={Reports:FirebaseReports,WaiterStats:FirebaseWaiterStats,KitchenStats:FirebaseKitchenStats};
import * as C from './components';
import type {Language} from './model';
import {translations} from './i18n';
import {authErrorText,authIssue,type AuthIssue} from './firebase/authErrors';
import type {StaffSession} from './firebase/staffAuth';
export default function FirebaseStaffApp(){
 const[language,setLanguage]=useState<Language>(()=>{try{return JSON.parse(localStorage.getItem('cafe-language')||'"ru"')==='ky'?'ky':'ru'}catch{return 'ru'}}),[session,setSession]=useState<StaffSession|null>(null),[restoring,setRestoring]=useState(true),[step,setStep]=useState(0),[code,setCode]=useState(''),[cafeId,setCafeId]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<AuthIssue|null>(null);
 const t=translations[language];
 useEffect(()=>{document.documentElement.lang=language;document.title=`${t.product} · ${t.login}`;localStorage.setItem('cafe-language',JSON.stringify(language))},[language]);
 useEffect(()=>{let active=true,stop:(()=>void)|undefined;import('./firebase/staffAuth').then(api=>{if(!active)return;stop=api.observeStaffSession(value=>{if(!active)return;setSession(value);setRestoring(false);if(!value)history.replaceState(null,'','/login')},reason=>{if(active){setError(authIssue(reason));setRestoring(false)}})}).catch(reason=>{if(active){setError(authIssue(reason));setRestoring(false)}});return()=>{active=false;stop?.()}},[]);
 useEffect(()=>{if(!restoring&&!session)document.querySelector<HTMLInputElement>('.login-card input')?.focus()},[step,restoring,session]);
 async function submit(){if(busy)return;setBusy(true);setError(null);try{const api=await import('./firebase/staffAuth');if(step===0){setCafeId(await api.lookupCafe(code));setStep(1)}else{const identity=await api.loginStaff(cafeId,name,password);setPassword('');setSession(identity);history.replaceState(null,'',`/${identity.home}`)}}catch(reason){setError(authIssue(reason));if(step===1)setPassword('')}finally{setBusy(false)}}
 async function logout(){const api=await import('./firebase/staffAuth');await api.logoutStaff();setPassword('');setName('');setStep(0);setCafeId('');setError(null);setSession(null);history.replaceState(null,'','/login')}
 if(session)return <AuthenticatedWorkspace key={session.uid} identity={session} onLogout={()=>void logout()}/>;
 return <div className="app" data-theme="light"><header className="topbar"><span className="brand"><span className="brand-symbol"><Coffee aria-hidden="true"/></span><strong>{t.product}</strong></span><div className="topbar-actions"><C.LanguageSwitch language={language} onChange={setLanguage}/></div></header><main id="main-content" className="login-main"><div className="login-card surface"><span className="eyebrow">{t.product} · 0{step+1} / 02</span><h1>{step===0?t.code:t.login}</h1><p className="muted">{step===0?t.codeHelp:(language==='ru'?'Вход сотрудников кафе':'Кафе кызматкерлеринин кирүүсү')}</p>{restoring?<C.Skeleton/>:<form onSubmit={event=>{event.preventDefault();void submit()}}>{step===0?<C.Input label={t.code} autoComplete="organization" value={code} onChange={e=>{setCode(e.target.value);setError(null)}} required error={error?authErrorText(error,language):undefined}/>:<><C.Input label={t.name} value={name} autoComplete="username" onChange={e=>{setName(e.target.value);setError(null)}} required maxLength={80}/><C.PasswordInput language={language} label={t.password} value={password} onChange={value=>{setPassword(value);setError(null)}} error={error?authErrorText(error,language):undefined}/></>}{busy&&<C.Skeleton/>}<C.Button type="submit" size="lg" className="full" loading={busy}>{step===0?t.continue:t.login}<ArrowRight aria-hidden="true"/></C.Button>{step===1&&<C.Button type="button" variant="ghost" onClick={()=>{setStep(0);setPassword('');setError(null)}}>{t.back}</C.Button>}</form>}</div></main></div>
}
