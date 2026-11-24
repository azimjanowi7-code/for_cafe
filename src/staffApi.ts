export type Staff={uid:string;name:string;role:'Waiter'|'Cook';active:boolean};
// The real Firebase auth integration supplies a short-lived ID token in memory.
// No password or token is persisted by this adapter.
export type StaffConnection={endpoint:string;cafeId:string;getIdToken:()=>Promise<string>};
let connection:StaffConnection|null=null;
export function configureStaffConnection(value:StaffConnection){connection=value}
export function staffConnected(){return connection!==null}
export async function staffRequest(action:'list'|'create'|'reset'|'deactivate',data:Record<string,unknown>={}):Promise<Staff[]>{
 if(!connection)throw new Error('not-connected');
 const response=await fetch(connection.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await connection.getIdToken()}`},body:JSON.stringify({data:{...data,action,cafeId:connection.cafeId}})});
 const result=await response.json();if(!response.ok||result.error)throw new Error(result.error?.status||'request-failed');return result.result.staff;
}
