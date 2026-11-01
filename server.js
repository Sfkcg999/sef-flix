const http=require('http'),fs=require('fs'),path=require('path');
const KEY=process.env.TORBOX_API_KEY,PORT=process.env.PORT||8787,TB='https://api.torbox.app/v1/api';
const CM='https://v3-cinemeta.strem.io';
const cache=new Map();
const crypto=require('crypto');const PASS=(process.env.APP_PASSWORD||fs.readFileSync(path.join(__dirname,'PASSWORD.txt'),'utf8')).trim();
const SECRET=crypto.createHash('sha256').update('fusion:'+PASS).digest('hex');
const sign=v=>v+'.'+crypto.createHmac('sha256',SECRET).update(v).digest('hex');
const authed=req=>{const m=(req.headers.cookie||'').match(/fsess=([^;]+)/);if(!m)return false;const [exp]=m[1].split('.');return sign(exp)===m[1]&&+exp>Date.now();};
const LOGIN=e=>`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="background:#141414;color:#fff;font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><form method=post action=/login style="background:#000a;padding:40px;border-radius:8px;width:280px"><h1 style="color:#e50914">FUSION</h1>${e?'<p style=color:#e87c03>Wrong password</p>':''}<input type=password name=p placeholder=Password autofocus style="width:100%;padding:12px;margin:10px 0;box-sizing:border-box;background:#333;border:0;color:#fff"><button style="width:100%;padding:12px;background:#e50914;color:#fff;border:0;font-weight:bold">Sign In</button></form>`;
async function j(url,opt={},ttl=0){if(ttl&&cache.has(url)&&cache.get(url).t>Date.now())return cache.get(url).v;
 const r=await fetch(url,{redirect:'follow',...opt,signal:AbortSignal.timeout(20000)});const v=await r.json();if(ttl)cache.set(url,{v,t:Date.now()+ttl});return v;}
const auth={headers:{Authorization:'Bearer '+KEY}};
const VID=/\.(mkv|mp4|avi|m4v|webm|mov|ts)$/i;
const qual=s=>(s.match(/2160p|4k|1080p|720p|480p/i)||['?'])[0].toUpperCase().replace('4K','2160P');
async function streams(type,id,s,e){
 let list=[];
 try{const q=s?`?season=${s}&episode=${e}&check_cache=true&check_owned=true`:'?check_cache=true&check_owned=true';
  const r=await j(`https://search-api.torbox.app/torrents/imdb:${id}${q}`,auth);
  list=(r.data?.torrents||[]).map(t=>({hash:t.hash,title:t.raw_title||t.title,size:t.size,seeders:t.last_known_seeders,cached:!!t.cached,source:'TorBox Search'}));
 }catch(err){}
 if(!list.length){const sid=s?`${id}:${s}:${e}`:id;
  const r=await j(`https://torrentio.strem.fun/stream/${type}/${sid}.json`,{},600000);
  list=(r.streams||[]).map(x=>{const lines=x.title.split('\n');const m=x.title.match(/💾 ([\d.]+) (GB|MB)/);const sd=x.title.match(/👤 (\d+)/);
   return{hash:x.infoHash,title:lines[0],file:x.behaviorHints?.filename,size:m?parseFloat(m[1])*(m[2]=='GB'?1e9:1e6):0,seeders:sd?+sd[1]:0,source:'Torrentio→TorBox'}});
  const hashes=[...new Set(list.map(x=>x.hash))].slice(0,100);
  if(hashes.length){const c=await j(`${TB}/torrents/checkcached?format=list&hash=${hashes.join(',')}`,auth);
   const set=new Set((c.data||[]).map(d=>d.hash));list.forEach(x=>x.cached=set.has(x.hash));}
 }
 list.forEach(x=>x.quality=qual(x.title+' '+(x.file||'')));
 list.sort((a,b)=>(b.cached-a.cached)||(b.seeders-a.seeders));
 return list;
}
async function play(hash,s,e,file){
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
 const r=await j(`${TB}/torrents/requestdl?token=${KEY}&torrent_id=${t.id}&file_id=${f.id}&redirect=false`);
 if(!r.success)throw new Error(r.detail);
 return{status:'ok',url:r.data,name:f.short_name,mime:f.mimetype};
}
const send=(res,c,o)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(o));};
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');const q=Object.fromEntries(u.searchParams);
 try{
  if(u.pathname=='/login'&&req.method=='POST'){let b='';for await(const c of req)b+=c;const p=new URLSearchParams(b).get('p')||'';
   const ok=p.length==PASS.length&&crypto.timingSafeEqual(Buffer.from(p),Buffer.from(PASS));
   if(!ok){await new Promise(r=>setTimeout(r,1000));res.writeHead(401,{'content-type':'text/html'});return res.end(LOGIN(1));}
   res.writeHead(302,{'Set-Cookie':`fsess=${sign(String(Date.now()+30*864e5))}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`,Location:'/'});return res.end();}
  if(!authed(req)){if(u.pathname.startsWith('/api/'))return send(res,401,{error:'unauthorized'});res.writeHead(401,{'content-type':'text/html'});return res.end(LOGIN(0));}
  if(u.pathname=='/api/catalog'){const ex=q.genre?`/genre=${encodeURIComponent(q.genre)}`:'';
   return send(res,200,await j(`${CM}/catalog/${q.type}/${q.id||'top'}${ex}.json`,{},3600000));}
  if(u.pathname=='/api/search')return send(res,200,{movie:(await j(`${CM}/catalog/movie/top/search=${encodeURIComponent(q.q)}.json`,{},600000)).metas,series:(await j(`${CM}/catalog/series/top/search=${encodeURIComponent(q.q)}.json`,{},600000)).metas});
  if(u.pathname=='/api/meta')return send(res,200,await j(`${CM}/meta/${q.type}/${q.id}.json`,{},3600000));
  if(u.pathname=='/api/streams')return send(res,200,{streams:await streams(q.type,q.id,q.s,q.e)});
  if(u.pathname=='/api/play')return send(res,200,await play(q.hash,q.s,q.e,q.file));
  if(u.pathname=='/api/library'){const r=await j(`${TB}/torrents/mylist?bypass_cache=true`,auth);
   return send(res,200,{items:(r.data||[]).map(t=>({id:t.id,hash:t.hash,name:t.name,size:t.size,state:t.download_state,ready:t.download_present,files:(t.files||[]).filter(f=>VID.test(f.name)).map(f=>({id:f.id,name:f.short_name,size:f.size}))}))});}
  if(u.pathname=='/api/libplay'){const r=await j(`${TB}/torrents/requestdl?token=${KEY}&torrent_id=${q.tid}&file_id=${q.fid}&redirect=false`);return send(res,200,{status:r.success?'ok':'err',url:r.data,detail:r.detail});}
  const p=path.join(__dirname,'public',u.pathname=='/'?'index.html':path.normalize(u.pathname));
  if(p.startsWith(path.join(__dirname,'public'))&&fs.existsSync(p)){res.writeHead(200,{'content-type':p.endsWith('.html')?'text/html':'text/plain'});return fs.createReadStream(p).pipe(res);}
  res.writeHead(404);res.end();
 }catch(err){send(res,500,{error:String(err.message||err)});}
}).listen(PORT,'0.0.0.0',()=>console.log('Fusion on '+PORT));
