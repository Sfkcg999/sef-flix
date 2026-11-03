const http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||8787,TB='https://api.torbox.app/v1/api';
const CM='https://v3-cinemeta.strem.io';
const cache=new Map();
const crypto=require('crypto');
// Each visitor signs in with their own TorBox API key; env TORBOX_API_KEY/APP_PASSWORD are intentionally ignored.
const SECRET=process.env.SESSION_SECRET?crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest():crypto.randomBytes(32);
const seal=o=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',SECRET,iv);const d=Buffer.concat([c.update(JSON.stringify(o)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),d]).toString('base64url');};
const unseal=t=>{try{const b=Buffer.from(t,'base64url'),c=crypto.createDecipheriv('aes-256-gcm',SECRET,b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([c.update(b.subarray(28)),c.final()]));}catch{return null}};
const session=req=>{const m=(req.headers.cookie||'').match(/sfsess=([^;]+)/);const v=m&&unseal(m[1]);return v&&v.exp>Date.now()&&v.k?v:null;};
const LOGIN=e=>`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>SEF-FLIX – Sign in</title><body style="background:#141414;color:#fff;font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><form method=post action=/login style="background:#000a;padding:40px;border-radius:8px;width:300px"><h1 style="color:#e50914">SEF-FLIX</h1><p style="color:#aaa;font-size:13px">Sign in with your own TorBox API key (TorBox → Settings → API).</p>${e?`<p style=color:#e87c03>${e}</p>`:''}<input type=password name=k placeholder="TorBox API key" autocomplete=off required autofocus style="width:100%;padding:12px;margin:10px 0;box-sizing:border-box;background:#333;border:0;color:#fff"><label style="font-size:13px;color:#ccc"><input type=checkbox name=r checked> Remember me (30 days)</label><button style="width:100%;margin-top:14px;padding:12px;background:#e50914;color:#fff;border:0;font-weight:bold">Sign In</button></form>`;
const COOKIE=(v,age)=>`sfsess=${v}; ${age!=null?`Max-Age=${age}; `:''}Path=/; HttpOnly; Secure; SameSite=Lax`;
async function j(url,opt={},ttl=0){if(ttl&&cache.has(url)&&cache.get(url).t>Date.now())return cache.get(url).v;
 const r=await fetch(url,{redirect:'follow',...opt,signal:AbortSignal.timeout(20000)});const v=await r.json();if(ttl)cache.set(url,{v,t:Date.now()+ttl});return v;}
const H=k=>({headers:{Authorization:'Bearer '+k}});
const VID=/\.(mkv|mp4|avi|m4v|webm|mov|ts)$/i;
const qual=s=>(s.match(/2160p|4k|1080p|720p|480p/i)||['?'])[0].toUpperCase().replace('4K','2160P');
const BUILTIN={torrentio:{name:'Torrentio',url:'https://torrentio.strem.fun'},torrentsdb:{name:'TorrentsDB',url:'https://torrentsdb.com'},peerflix:{name:'Peerflix',url:'https://peerflix.mov'},mediafusion:{name:'MediaFusion',url:'https://mediafusion.elfhosted.com'}};
const DEFAULT_SRC=['tbsearch','torrentio','torrentsdb','peerflix'];
const dns=require('dns').promises,net=require('net');
const privIP=ip=>{if(net.isIPv6(ip)){ip=ip.toLowerCase();if(ip.startsWith('::ffff:'))ip=ip.slice(7);else return ip=='::1'||ip=='::'||/^f[cd]|^fe[89ab]/.test(ip);}
 const [a,b]=ip.split('.').map(Number);return a==10||a==127||a==0||(a==169&&b==254)||(a==172&&b>=16&&b<=31)||(a==192&&b==168)||(a==100&&b>=64&&b<=127)||a>=224;};
async function safeBase(raw){let u;try{u=new URL(String(raw).trim())}catch{throw new Error('Invalid URL')}
 if(u.protocol!=='https:')throw new Error('Only https:// addon URLs are allowed');if(u.username||u.password)throw new Error('No credentials in URL');
 const addrs=await dns.lookup(u.hostname,{all:true});if(!addrs.length||addrs.some(x=>privIP(x.address)))throw new Error('Address not allowed');
 return (u.origin+u.pathname).replace(/\/manifest\.json$/,'').replace(/\/+$/,'');}
async function addonStreams(base,label,type,sid){
 const r=await fetch(`${base}/stream/${type}/${sid}.json`,{redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();
 return(d.streams||[]).filter(x=>/^[a-f0-9]{40}$/i.test(x.infoHash||'')).map(x=>{const t=(x.title||x.description||'');const lines=t.split('\n');
  const m=t.match(/💾 ?([\d.]+) ?(GB|MB|TB)/i);const sd=t.match(/👤 ?(\d+)/);const bh=x.behaviorHints||{};
  return{hash:x.infoHash.toLowerCase(),title:lines[0]||x.name,file:bh.filename,size:bh.videoSize||(m?parseFloat(m[1])*({tb:1e12,gb:1e9,mb:1e6}[m[2].toLowerCase()]):0),seeders:sd?+sd[1]:0,sources:[label],cached:false,qhint:x.name||''}});}
async function streams(K,type,id,s,e,srcs,custom){const auth=H(K);srcs=srcs||DEFAULT_SRC;const sid=s?`${id}:${s}:${e}`:id;
 const jobs=[],status={};
 if(srcs.includes('tbsearch'))jobs.push(['TorBox Search',(async()=>{const q=s?`?season=${s}&episode=${e}&check_cache=true`:'?check_cache=true';
  const r=await fetch(`https://search-api.torbox.app/torrents/imdb:${id}${q}`,{...auth,signal:AbortSignal.timeout(8000)}).then(r=>r.json());
  return(r.data?.torrents||[]).map(t=>({hash:String(t.hash).toLowerCase(),title:t.raw_title||t.title,size:t.size||0,seeders:t.last_known_seeders||0,cached:!!t.cached,sources:['TorBox Search']}));})()]);
 for(const k of srcs)if(BUILTIN[k])jobs.push([BUILTIN[k].name,addonStreams(BUILTIN[k].url,BUILTIN[k].name,type,sid)]);
 for(const c of (custom||[]).slice(0,10))jobs.push([c.label,safeBase(c.url).then(b=>addonStreams(b,c.label,type,sid))]);
 const res=await Promise.allSettled(jobs.map(x=>x[1]));const map=new Map();
 res.forEach((r,i)=>{const n=jobs[i][0];status[n]=r.status=='fulfilled'?r.value.length:'error: '+String(r.reason?.message||r.reason).slice(0,80);
  if(r.status=='fulfilled')for(const x of r.value){const o=map.get(x.hash);if(o){o.sources=[...new Set([...o.sources,...x.sources])];o.seeders=Math.max(o.seeders,x.seeders);o.size=o.size||x.size;o.file=o.file||x.file;o.cached=o.cached||x.cached}else map.set(x.hash,x)}});
 const list=[...map.values()];const hashes=list.map(x=>x.hash);
 for(let i=0;i<hashes.length;i+=100){try{const c=await j(`${TB}/torrents/checkcached?format=list&hash=${hashes.slice(i,i+100).join(',')}`,auth);
  const set=new Set((c.data||[]).map(d=>String(d.hash).toLowerCase()));list.forEach(x=>{if(set.has(x.hash))x.cached=true})}catch{}}
 list.forEach(x=>{x.quality=qual(x.title+' '+(x.file||'')+' '+(x.qhint||''));delete x.qhint;x.source=x.sources.join(', ')});
 list.sort((a,b)=>(b.cached-a.cached)||(b.seeders-a.seeders));
 return{streams:list,status};
}
async function play(K,hash,s,e,file,ip){const auth=H(K);
 const my=await j(`${TB}/torrents/mylist?bypass_cache=true`,auth);
 let t=(my.data||[]).find(x=>x.hash==hash);
 if(!t){const fd=new FormData();fd.append('magnet',`magnet:?xt=urn:btih:${hash}`);fd.append('add_only_if_cached','false');
  const c=await j(`${TB}/torrents/createtorrent`,{method:'POST',body:fd,...auth});
  if(!c.success)throw new Error(c.detail||c.error);
  const id=c.data.torrent_id;for(let i=0;i<8&&!(t?.files?.length);i++){await new Promise(r=>setTimeout(r,1500));
   t=(await j(`${TB}/torrents/mylist?id=${id}&bypass_cache=true`,auth)).data;}
  if(!t?.files?.length)return{status:'queued',detail:'Added to TorBox; not cached yet — downloading. Try again later.'};}
 let files=(t.files||[]).filter(f=>VID.test(f.name)&&!/sample/i.test(f.name));
 if(file){const f=files.find(f=>f.short_name==file);if(f)files=[f];}
 if(s){const p=new RegExp(`s0?${s}[ ._-]?e0?${e}(?!\\d)|${s}x0?${e}(?!\\d)`,'i');const m=files.filter(f=>p.test(f.name));if(m.length)files=m;}
 files.sort((a,b)=>b.size-a.size);const f=files[0];if(!f)return{status:'nofile',detail:'No video file found yet'};
 const r=await j(`${TB}/torrents/requestdl?token=${encodeURIComponent(K)}&torrent_id=${t.id}&file_id=${f.id}&redirect=false&append_name=true${ip?'&user_ip='+encodeURIComponent(ip):''}`);
 if(!r.success)throw new Error(r.detail);
 return{status:'ok',url:r.data,name:f.short_name,mime:f.mimetype,tid:t.id,fid:f.id};
}
const send=(res,c,o)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(o));};
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');const q=Object.fromEntries(u.searchParams);
 try{
  if(u.pathname=='/logout'){res.writeHead(302,{'Set-Cookie':COOKIE('',0),Location:'/'});return res.end();}
  if(u.pathname=='/login'&&req.method=='POST'){let b='';for await(const c of req){b+=c;if(b.length>4096)break}const f=new URLSearchParams(b);const k=(f.get('k')||'').trim();
   let ok=false;if(/^[A-Za-z0-9-]{20,80}$/.test(k)){try{const r=await j(`${TB}/user/me`,H(k));ok=!!r.success;}catch{}}
   if(!ok){await new Promise(r=>setTimeout(r,1000));res.writeHead(401,{'content-type':'text/html'});return res.end(LOGIN('That TorBox API key was rejected.'));}
   res.writeHead(302,{'Set-Cookie':COOKIE(seal({k,exp:Date.now()+30*864e5}),f.get('r')?2592000:null),Location:'/'});return res.end();}
  const IP=(String(req.headers['x-forwarded-for']||'').split(',')[0].trim())||'';const S=session(req);const K=S&&S.k;
  if(!S){if(u.pathname.startsWith('/api/'))return send(res,401,{error:'unauthorized'});res.writeHead(401,{'content-type':'text/html'});return res.end(LOGIN(0));}
  if(u.pathname=='/api/catalog'){const ex=q.genre?`/genre=${encodeURIComponent(q.genre)}`:'';
   return send(res,200,await j(`${CM}/catalog/${q.type}/${q.id||'top'}${ex}.json`,{},3600000));}
  if(u.pathname=='/api/search')return send(res,200,{movie:(await j(`${CM}/catalog/movie/top/search=${encodeURIComponent(q.q)}.json`,{},600000)).metas,series:(await j(`${CM}/catalog/series/top/search=${encodeURIComponent(q.q)}.json`,{},600000)).metas});
  if(u.pathname=='/api/meta')return send(res,200,await j(`${CM}/meta/${q.type}/${q.id}.json`,{},3600000));
  if(u.pathname=='/api/streams'){const srcs=q.src!=null?q.src.split(',').filter(Boolean):null;let custom=[];try{custom=JSON.parse(q.addons||'[]').filter(c=>c&&typeof c.url=='string').map((c,i)=>({url:c.url,label:String(c.label||'Custom '+(i+1)).slice(0,40)}))}catch{}
   return send(res,200,await streams(K,q.type,q.id,q.s,q.e,srcs,custom));}
  if(u.pathname=='/api/sources')return send(res,200,{builtin:[{id:'tbsearch',name:'TorBox Search'},...Object.entries(BUILTIN).map(([id,v])=>({id,name:v.name}))],defaults:DEFAULT_SRC});
  if(u.pathname=='/api/validate-addon'){try{const b=await safeBase(q.url);const m=await fetch(b+'/manifest.json',{redirect:'error',signal:AbortSignal.timeout(8000)}).then(r=>r.json());
   return send(res,200,{ok:true,base:b,name:m.name||new URL(b).hostname,stream:(m.resources||[]).some(r=>r=='stream'||r?.name=='stream')});}catch(e){return send(res,200,{ok:false,error:String(e.message||e)})}}
  if(u.pathname=='/api/play')return send(res,200,await play(K,q.hash,q.s,q.e,q.file,IP));
  if(u.pathname=='/api/library'){const r=await j(`${TB}/torrents/mylist?bypass_cache=true`,H(K));
   return send(res,200,{items:(r.data||[]).map(t=>({id:t.id,hash:t.hash,name:t.name,size:t.size,state:t.download_state,ready:t.download_present,files:(t.files||[]).filter(f=>VID.test(f.name)).map(f=>({id:f.id,name:f.short_name,size:f.size}))}))});}
  if(u.pathname=='/api/libplay'){const r=await j(`${TB}/torrents/requestdl?token=${encodeURIComponent(K)}&torrent_id=${q.tid}&file_id=${q.fid}&redirect=false&append_name=true${IP?'&user_ip='+encodeURIComponent(IP):''}`);return send(res,200,{status:r.success?'ok':'err',url:r.data,detail:r.detail,tid:q.tid,fid:q.fid});}
  if(u.pathname=='/api/hls'){const r=await j(`${TB}/stream/createstream?id=${encodeURIComponent(q.tid)}&file_id=${encodeURIComponent(q.fid)}&type=torrent&chosen_audio_index=0&chosen_resolution_index=0`,H(K));
   return send(res,200,r.success&&r.data?.hls_url?{ok:true,hls:r.data.hls_url}:{ok:false,detail:r.detail||r.error||'Streaming unavailable'});}
  const p=path.join(__dirname,'public',u.pathname=='/'?'index.html':path.normalize(u.pathname));
  if(p.startsWith(path.join(__dirname,'public'))&&fs.existsSync(p)){res.writeHead(200,{'content-type':p.endsWith('.html')?'text/html':'text/plain'});return fs.createReadStream(p).pipe(res);}
  res.writeHead(404);res.end();
 }catch(err){send(res,500,{error:String(err.message||err)});}
}).listen(PORT,'0.0.0.0',()=>console.log('SEF-FLIX on '+PORT));
