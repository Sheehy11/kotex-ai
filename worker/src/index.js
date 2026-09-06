const enc = new TextEncoder();

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (origin === 'null' && env.ALLOW_LOCAL_FILE === 'true') return 'null';
  return allowed.includes(origin) ? origin : '';
}
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8', ...cors(origin)}});
}
function b64url(bytes) {
  let s=''; for (const b of bytes) s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(s) {
  const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function hmac(value, secret) {
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value)));
}
async function makeToken(env) {
  const payload=b64url(enc.encode(JSON.stringify({exp:Date.now()+8*60*60*1000,nonce:crypto.randomUUID()})));
  return `${payload}.${b64url(await hmac(payload,env.SESSION_SECRET))}`;
}
async function validToken(request, env) {
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const [payload,sig]=token.split('.'); if(!payload||!sig)return false;
  const expected=await hmac(payload,env.SESSION_SECRET),actual=fromB64url(sig);
  if(actual.length!==expected.length)return false;
  let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];if(diff)return false;
  try{return JSON.parse(new TextDecoder().decode(fromB64url(payload))).exp>Date.now();}catch{return false;}
}
function sameSecret(a,b) {
  a=enc.encode(String(a||''));b=enc.encode(String(b||''));let diff=a.length^b.length;
  const n=Math.max(a.length,b.length);for(let i=0;i<n;i++)diff|=(a[i]||0)^(b[i]||0);return diff===0;
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url),origin=allowedOrigin(request,env);
    if(!origin)return new Response('Origin not allowed',{status:403});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
    if(url.pathname==='/api/health'&&request.method==='GET')return json({ok:true,model:env.A3_MODEL||'gpt-5.6-terra'},200,origin);
    if(url.pathname==='/api/session'&&request.method==='POST'){
      const body=await request.json().catch(()=>({}));
      if(!sameSecret(body.password,env.ACCESS_PASSWORD))return json({error:'密码错误'},401,origin);
      return json({token:await makeToken(env),expiresIn:28800},200,origin);
    }
    if(url.pathname!=='/api/chat'||request.method!=='POST')return json({error:'Not found'},404,origin);
    if(!await validToken(request,env))return json({error:'登录已过期'},401,origin);
    const declared=Number(request.headers.get('Content-Length')||0);if(declared>180000)return json({error:'请求内容过大'},413,origin);
    const raw=await request.text();if(raw.length>180000)return json({error:'请求内容过大'},413,origin);
    const input=JSON.parse(raw||'{}');
    const messages=[];
    if(typeof input.system==='string'&&input.system.trim())messages.push({role:'system',content:input.system.slice(0,120000)});
    for(const m of Array.isArray(input.messages)?input.messages:[]){if(['user','assistant'].includes(m?.role)&&typeof m.content==='string')messages.push({role:m.role,content:m.content.slice(0,60000)});}
    if(!messages.some(m=>m.role==='user'))return json({error:'缺少用户内容'},400,origin);
    const upstream=await fetch(env.A3_API_URL||'https://new-api.a3database.cn/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.A3_API_KEY}`},
      // A3 的部分兼容模型会保持 SSE 连接但不发送结束帧。共享服务与本地验收
      // 统一使用非流式完整响应，避免内容已经生成、页面却一直等待直至超时。
      body:JSON.stringify({model:env.A3_MODEL||'gpt-5.6-terra',messages,stream:false,max_tokens:4096})
    });
    if(!upstream.ok)return json({error:'内容服务请求失败',status:upstream.status},502,origin);
    const headers=new Headers(upstream.headers);Object.entries(cors(origin)).forEach(([k,v])=>headers.set(k,v));headers.set('Cache-Control','no-store');
    return new Response(upstream.body,{status:upstream.status,headers});
  }
};
