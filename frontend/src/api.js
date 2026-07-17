export const API=(import.meta.env.VITE_API_URL||'http://localhost:3001/api').replace(/\/$/,'');
export const asset=p=>!p?'':p.startsWith('http')?p:API.replace(/\/api$/,'')+p;
export async function request(path,options={}){const res=await fetch(API+path,{credentials:'include',headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers},...options});const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.error||'Request failed');return json.data}
