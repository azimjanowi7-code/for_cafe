import type {FirebaseApp} from 'firebase/app';
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,memoryLocalCache} from 'firebase/firestore';
export function initializeCafeFirestore(app:FirebaseApp,indexedDBAvailable=typeof indexedDB!=='undefined'){return initializeFirestore(app,{localCache:indexedDBAvailable?persistentLocalCache({tabManager:persistentMultipleTabManager()}):memoryLocalCache()})}
