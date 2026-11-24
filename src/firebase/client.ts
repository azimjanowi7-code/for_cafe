import {initializeCafeFirestore} from './localCache';
import {getApps,initializeApp,type FirebaseOptions} from 'firebase/app';
import {connectAuthEmulator,getAuth,type Auth} from 'firebase/auth';
import {connectFirestoreEmulator,type Firestore} from 'firebase/firestore';
import {connectFunctionsEmulator,getFunctions,type Functions} from 'firebase/functions';
const databases=new WeakMap<object,Firestore>();
const connectedDb=new WeakSet<Firestore>(),connectedAuth=new WeakSet<Auth>(),connectedFunctions=new WeakSet<Functions>();
function firebaseApp(){
 const stage=import.meta.env.VITE_FIREBASE_ENV;
 if(!['dev','staging','production'].includes(stage))throw Error('FIREBASE_ENV_REQUIRED');
 const local=stage==='dev',projectId=import.meta.env.VITE_FIREBASE_PROJECT_ID;
 if(!projectId||projectId.includes('['))throw Error('FIREBASE_PROJECT_REQUIRED');
 if(local&&(projectId!=='demo-for-cafe'||!['localhost','127.0.0.1','[::1]'].includes(location.hostname)))throw Error('EMULATOR_ONLY_LOOPBACK');
 const required=(key:string)=>{const value=import.meta.env[key];if(!value||value.includes('['))throw Error(`FIREBASE_CONFIG_REQUIRED:${key}`);return value};
 const options:FirebaseOptions=local?{projectId,apiKey:'emulator-only-not-a-cloud-key',authDomain:'localhost'}:{projectId,apiKey:required('VITE_FIREBASE_API_KEY'),authDomain:required('VITE_FIREBASE_AUTH_DOMAIN'),appId:required('VITE_FIREBASE_APP_ID')};
 const name=`cafe-${stage}`,app=getApps().find(app=>app.name===name)||initializeApp(options,name);
 return {app,local,stage};
}
export function firebaseDatabase(){const {app,local}=firebaseApp();let db=databases.get(app);if(!db){db=initializeCafeFirestore(app);databases.set(app,db);}if(local&&!connectedDb.has(db)){connectFirestoreEmulator(db,'127.0.0.1',8080);connectedDb.add(db)}return db}
// Auth/Functions initialization is separate so the public QR entry doesn't download staff SDKs.
export function firebaseClients(){
 const {app,local,stage}=firebaseApp();if(!local)throw Error('AUTH_EMULATOR_ONLY');const db=firebaseDatabase(),auth=getAuth(app),functions=getFunctions(app,'asia-south2');
 if(local&&!connectedAuth.has(auth)){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectedAuth.add(auth)}
 if(local&&!connectedFunctions.has(functions)){connectFunctionsEmulator(functions,'127.0.0.1',5001);connectedFunctions.add(functions)}
 return {app,auth,db,functions,stage};
}
