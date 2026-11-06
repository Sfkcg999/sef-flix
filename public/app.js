'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=u=>fetch(u,{credentials:'same-origin'}).then(r=>{if(r.status==401){location.reload();throw new Error('Signed out')}return r.json()});
const gb=b=>!b?'':b>=1e9?(b/1e9).toFixed(1)+' GB':Math.round(b/1e6)+' MB';
const h=html=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild};
const IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&'ontouchend' in document);
const STANDALONE=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
const APPLE=IOS||/Safari/.test(navigator.userAgent)&&!/Chrome|Chromium|Android/.test(navigator.userAgent);
const I={
 play:'<svg class=fill viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>',
 info:'<svg viewBox="0 0 24 24"><circle cx=12 cy=12 r=9 /><path d="M12 16v-5M12 8h.01"/></svg>',
 x:'<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
 down:'<svg viewBox="0 0 24 24"><path d="M12 4v12M6 11l6 6 6-6M5 20h14"/></svg>',
 cone:'<svg viewBox="0 0 24 24"><path d="M9.5 4h5l5 15H4.5l5-15Z"/><path d="M8 11h8M3 20h18"/></svg>',
 compass:'<svg viewBox="0 0 24 24"><circle cx=12 cy=12 r=9 /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></svg>',
 chev:'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
 plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
 folder:'<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>',
};
const ROWS=[['Trending Movies','movie','top'],['Trending Shows','series','top'],['Popular Movies','movie','imdbRating'],['Top Rated Shows','series','imdbRating'],
 ['Action','movie','top','Action'],['Comedy','movie','top','Comedy'],['Horror','movie','top','Horror'],['Sci-Fi','movie','top','Sci-Fi'],['Drama Series','series','top','Drama'],['Animation','movie','top','Animation'],['Crime Series','series','top','Crime']];

/* ---------- storage (per browser) ---------- */
const store={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const hist={
 all(){return store.get('sefhist',[]).sort((a,b)=>b.t-a.t)},
 add(e){const l=hist.all().filter(x=>x.key!=e.key);l.unshift({...e,t:Date.now()});store.set('sefhist',l.slice(0,30))},
 rm(key){store.set('sefhist',hist.all().filter(x=>x.key!=key))},
};
function getCfg(){const c=store.get('sefcfg',null);return c&&c.src?{addons:[],...c}:{src:['tbsearch','torrentio','torrentsdb','peerflix'],addons:[]}}
const saveCfg=c=>store.set('sefcfg',c);

/* ---------- ui helpers ---------- */
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),3200)}
const nav=$('#nav');const onScroll=()=>nav.classList.toggle('solid',scrollY>30||$('#searchbar').classList.contains('on'));addEventListener('scroll',onScroll,{passive:true});
function row(title,cls){const r=h(`<section class=row><h2>${esc(title)}</h2><div class="sc ${cls||''}"></div></section>`);$('#rows').append(r);return r}
function skel(r,n,wide){const sc=r.querySelector('.sc');for(let i=0;i<n;i++)sc.append(h(`<div class="${wide?'wide':'card'} sk"></div>`))}
function card(m){const c=h(`<div class=card role=button tabindex=0 aria-label="${esc(m.name)}"><div class=nm>${esc(m.name)}</div></div>`);
 c.style.backgroundImage=`url("${encodeURI(m.poster)}")`;c.onclick=()=>openT(m.type,m.imdb_id||m.id);return c}
const ago=t=>{const s=(Date.now()-t)/1e3;return s<3600?'Just now':s<86400?Math.floor(s/3600)+'h ago':s<86400*30?Math.floor(s/86400)+'d ago':new Date(t).toLocaleDateString()};

/* ---------- home ---------- */
let homeGen=0;
async function home(){const gen=++homeGen;closeSearch();$('#hero').hidden=false;$('#rows').className='';$('#rows').innerHTML='';scrollTo(0,0);
 drawContinue();
 const lib=row('My TorBox Library');skel(lib,4,true);
 api('/api/library').then(d=>{if(gen!=homeGen)return;const sc=lib.querySelector('.sc');sc.innerHTML='';
  if(!d.items?.length)return lib.remove();d.items.slice(0,20).forEach(t=>sc.append(libTile(t)))}).catch(()=>lib.remove());
 const rows=ROWS.map(([t,ty,id,g])=>{const r=row(t);skel(r,8);return{r,p:api(`/api/catalog?type=${ty}&id=${id}${g?'&genre='+encodeURIComponent(g):''}`)}});
 rows.forEach(({r,p},i)=>p.then(d=>{if(gen!=homeGen)return;const ms=(d.metas||[]).filter(m=>m.poster);const sc=r.querySelector('.sc');sc.innerHTML='';
  if(!ms.length)return r.remove();ms.forEach(m=>sc.append(card(m)));if(i==0)setHero(ms[Math.floor(Math.random()*Math.min(5,ms.length))])}).catch(()=>r.remove()));}
function drawContinue(){const items=hist.all();let r=$('#cw');
 if(!items.length){r?.remove();return}
 if(!r){r=row('Continue Watching');r.id='cw';$('#rows').prepend(r)}
 const sc=r.querySelector('.sc');sc.innerHTML='';
 items.forEach(x=>{const sub=[x.s?`S${x.s} · E${x.e}${x.epName?' · '+x.epName:''}`:'',ago(x.t)].filter(Boolean).join(' — ');
  const c=h(`<div class="wide${x.lib?' lib':''}" role=button tabindex=0>${x.lib?`<span class=ic>${I.folder}</span>`:''}<span class=pl>${I.play}</span><div class=wi><div class=wt>${esc(x.name)}</div><div class=ws>${esc(sub)}</div></div><div class=bar></div><button class=rm aria-label="Remove">${I.x}</button></div>`);
  if(x.img)c.style.backgroundImage=`url("${encodeURI(x.img)}")`;
  c.onclick=e=>{if(e.target.closest('.rm')){e.stopPropagation();hist.rm(x.key);drawContinue();return}
   x.lib?libOpenById(x.tid):openT(x.type,x.id,x.s?{s:x.s,e:x.e}:null)};
  sc.append(c)})}
function libTile(t){const c=h(`<div class="wide lib" role=button tabindex=0><span class=ic>${I.folder}</span><div class=wi><div class=wt>${esc(t.name)}</div><div class=ws>${esc([gb(t.size),t.files.length+' video'+(t.files.length==1?'':'s'),t.ready?'Ready':t.state].join(' · '))}</div></div></div>`);
 c.onclick=()=>libOpen(t);return c}
function setHero(m){if(!m)return;const H=$('#hero');H.style.backgroundImage=`url("${encodeURI(m.background||m.poster)}")`;
 const g=(m.genres||m.genre||[]).slice(0,3);
 H.innerHTML=`<div class=in>${m.logo?`<img class=tlogo alt="${esc(m.name)}" src="${esc(m.logo)}">`:''}<h1 ${m.logo?'hidden':''}>${esc(m.name)}</h1>
  <div class=mline>${m.imdbRating?`<span class=rt>★ ${esc(m.imdbRating)}</span>`:''}${m.releaseInfo?`<span>${esc(m.releaseInfo)}</span>`:''}${g.length?`<span class=dot>${esc(g.join(' · '))}</span>`:''}</div>
  <p>${esc(m.description)}</p><div class=acts><button class="btn w" id=hp>${I.play} Play</button><button class=btn id=hi>${I.info} More Info</button></div></div>`;
 const lg=H.querySelector('.tlogo');if(lg)lg.onerror=()=>{lg.remove();H.querySelector('h1').hidden=false};
 $('#hp').onclick=$('#hi').onclick=()=>openT(m.type,m.imdb_id||m.id)}

/* ---------- library page ---------- */
async function libPage(){++homeGen;closeSearch();$('#hero').hidden=true;$('#rows').className='flat';$('#rows').innerHTML='';scrollTo(0,0);
 const r=row('My TorBox Library');r.querySelector('.sc').className='grid';r.querySelector('.grid').style.gridTemplateColumns='repeat(auto-fill,minmax(min(100%,260px),1fr))';
 r.querySelector('.grid').innerHTML='<div class=loading><span class=spin></span>Loading…</div>';
 const d=await api('/api/library');const g=r.querySelector('.grid');g.innerHTML='';
 if(!d.items?.length)return g.innerHTML='<p class=empty>Nothing in your TorBox yet.</p>';
 d.items.forEach(t=>{const c=libTile(t);c.style.flex='none';g.append(c)})}

/* ---------- search ---------- */
const sb=$('#searchbar'),q=$('#q');let sT,sGen=0;
function openSearch(){sb.classList.add('on');onScroll();setTimeout(()=>q.focus(),50)}
function closeSearch(){sb.classList.remove('on');q.blur();onScroll()}
q.addEventListener('input',()=>{clearTimeout(sT);const v=q.value.trim();if(v.length<2)return;sT=setTimeout(()=>search(v),350)});
q.addEventListener('keydown',e=>{if(e.key=='Enter'){clearTimeout(sT);q.blur();search(q.value.trim())}if(e.key=='Escape')closeSearch()});
async function search(v){if(!v)return;const gen=++sGen;++homeGen;$('#hero').hidden=true;$('#rows').className='flat';
 $('#rows').innerHTML='<div class=loading style="padding:0 var(--gut)"><span class=spin></span>Searching…</div>';
 const d=await api('/api/search?q='+encodeURIComponent(v));if(gen!=sGen)return;$('#rows').innerHTML='';
 const all=[...(d.movie||[]),...(d.series||[])].filter(m=>m.poster);
 if(!all.length)return $('#rows').innerHTML=`<p class=empty>No results for “${esc(v)}”.</p>`;
 for(const[t,l]of[['Movies',d.movie],['Shows',d.series]]){const ms=(l||[]).filter(m=>m.poster);if(!ms.length)continue;
  const r=row(t);const g=r.querySelector('.sc');g.className='grid';ms.forEach(m=>g.append(card(m)))}}

/* ---------- sheet ---------- */
const sheet=$('#sheet'),sbox=$('#sbox');let sheetGen=0;
function openSheet(html){sheetGen++;sbox.innerHTML=`<div class=panel>${html}</div>`;sbox.scrollTop=0;sheet.classList.add('on');sheet.setAttribute('aria-hidden','false');document.documentElement.classList.add('lock');
 sbox.querySelectorAll('.x').forEach(b=>b.onclick=closeSheet);return sheetGen}
function closeSheet(){sheetGen++;sheet.classList.remove('on');sheet.setAttribute('aria-hidden','true');document.documentElement.classList.remove('lock');
 sbox.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load()});hlsInst?.destroy();hlsInst=null;setTimeout(()=>{if(!sheet.classList.contains('on'))sbox.innerHTML=''},300)}
addEventListener('keydown',e=>{if(e.key=='Escape'&&sheet.classList.contains('on'))closeSheet()});
const X=`<button class=x aria-label=Close>${I.x}</button>`;

/* ---------- title ---------- */
let cur;
async function openT(type,id,resume){const gen=openSheet(`${X}<div class=ct style="padding-top:80px"><div class=loading><span class=spin></span>Loading…</div></div>`);
 let m;try{m=(await api(`/api/meta?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`)).meta}catch{}
 if(gen!=sheetGen)return;if(!m){sbox.querySelector('.ct').innerHTML='<p class=empty>Couldn’t load this title.</p>';return}
 cur={...m,type};const g=(m.genres||m.genre||[]).slice(0,4);
 sbox.querySelector('.panel').innerHTML=`<div class=bd style="background-image:url(&quot;${esc(encodeURI(m.background||m.poster||''))}&quot;)">${X}${m.logo?`<img class=tlogo alt="" src="${esc(m.logo)}" onerror="this.remove()">`:''}</div>
 <div class=ct><h1>${esc(m.name)}</h1>
  <div class=mline>${m.imdbRating?`<span class=rt>★ ${esc(m.imdbRating)}</span>`:''}${m.releaseInfo||m.year?`<span>${esc(m.releaseInfo||m.year)}</span>`:''}${m.runtime?`<span>${esc(m.runtime)}</span>`:''}${g.length?`<span class=dot>${esc(g.join(' · '))}</span>`:''}</div>
  <p class=desc>${esc(m.description)}</p>${m.cast?.length?`<p class=cast><b>Cast:</b> ${esc(m.cast.slice(0,6).join(', '))}</p>`:''}
  <div id=player></div><div id=epwrap></div><h2 id=sh>Sources</h2><div id=srv></div></div>`;
 sbox.querySelectorAll('.x').forEach(b=>b.onclick=closeSheet);
 if(type=='series'){const ss=[...new Set((m.videos||[]).map(v=>v.season))].filter(s=>s>0).sort((a,b)=>a-b);
  if(!ss.length){$('#srv').innerHTML='<p class=empty>No episodes listed.</p>';return}
  const s0=resume&&ss.includes(+resume.s)?+resume.s:ss[0];
  $('#epwrap').innerHTML=`<h2>Episodes <select class=sel id=season aria-label=Season>${ss.map(s=>`<option value=${s} ${s==s0?'selected':''}>Season ${s}</option>`).join('')}</select></h2><div class=eps id=eplist></div>`;
  $('#season').onchange=()=>showEps();showEps(resume?.e);$('#sh').hidden=true;
  if(resume){const el=document.querySelector(`.ep[data-e="${+resume.e}"]`);el?.click();setTimeout(()=>el?.scrollIntoView({block:'center',behavior:'smooth'}),350)}}
 else loadSrv('movie',m.id||id)}
function park(){const w=$('#epwrap');if(w)w.after($('#player'),$('#sh'),$('#srv'))}
function showEps(){const s=+$('#season').value;const now=Date.now();const eps=cur.videos.filter(v=>v.season==s).sort((a,b)=>a.episode-b.episode);
 const L=$('#eplist');park();L.innerHTML='';
 eps.forEach(v=>{const fut=v.released&&Date.parse(v.released)>now;
  const e=h(`<div class="ep${fut?' fut':''}" data-e=${+v.episode} role=button tabindex=0><div class=n>${+v.episode}</div><div class=th></div><div><div class=t>${+v.episode}. ${esc(v.name||v.title||'Episode '+v.episode)}</div><div class=o>${fut?`<i>Airs ${esc(new Date(v.released).toLocaleDateString())}</i>`:esc(v.overview||v.description||'')}</div></div></div>`);
  if(v.thumbnail)e.querySelector('.th').style.backgroundImage=`url("${encodeURI(v.thumbnail)}")`;
  e.onclick=()=>{L.querySelectorAll('.ep').forEach(x=>x.classList.remove('on'));e.classList.add('on');$('#player').innerHTML='';
   cur.ep={s,e:+v.episode,name:v.name||v.title||''};
   const sh=$('#sh'),srv=$('#srv');sh.hidden=false;e.after($('#player'));$('#player').after(sh);sh.after(srv);
   loadSrv('series',cur.id,s,+v.episode)};
  L.append(e)});
 $('#sh').hidden=true;$('#srv').innerHTML='';}

/* ---------- sources ---------- */
let srvGen=0;
async function loadSrv(type,id,s,e){const gen=++srvGen;const S=$('#srv');$('#sh').innerHTML=`Sources ${s?`<small>S${s} · E${e}</small>`:''}`;
 S.innerHTML='<div class=loading><span class=spin></span>Finding sources on TorBox…</div>';
 const cfg=getCfg();let d;
 try{d=await api(`/api/streams?type=${type}&id=${encodeURIComponent(id)}${s?`&s=${s}&e=${e}`:''}&src=${cfg.src.join(',')}&addons=${encodeURIComponent(JSON.stringify(cfg.addons))}`)}catch(err){d={error:err.message}}
 if(gen!=srvGen||!S.isConnected)return;
 if(d.error)return S.innerHTML=`<p class=warn>${esc(d.error)}</p>`;
 const st=Object.entries(d.status||{}).map(([k,v])=>`${k} ${typeof v=='number'?v:'⚠'}`).join(' · ');
 S.innerHTML=`<div class=srcst>${esc(st)}</div>`;
 if(!d.streams.length)return S.insertAdjacentHTML('beforeend','<p class=empty style="padding:0">No sources found. Try enabling more in Settings.</p>');
 const list=d.streams.slice(0,60);const best=list[0];
 S.append(srcRow(best,s,e,best.cached));
 if(list.length>1){const more=h(`<details class=more><summary>More sources (${list.length-1}) ${I.chev}</summary></details>`);list.slice(1).forEach(x=>more.append(srcRow(x,s,e)));S.append(more)}}
function srcRow(x,s,e,isBest){
 const r=h(`<div class="src${isBest?' best':''}"><div class=si><div class=tags>${isBest?'<span class="tag bm">Best match</span>':''}<span class="tag q">${esc(x.quality=='?'?'SD':x.quality)}</span>${x.cached?'<span class="tag c">⚡ Cached</span>':'<span class=tag>Not cached</span>'}${x.safari?'<span class="tag s">Safari ✓</span>':''}${x.size?`<span class=tag>${gb(x.size)}</span>`:''}${x.seeders?`<span class=tag>👤 ${+x.seeders}</span>`:''}<span class=tag>${esc(x.source)}</span></div><div class=stt>${esc(x.title)}</div></div></div>`);
 const b=h(`<button class="btn ${x.cached?'r':''} sm">${x.cached?I.play+' Play':I.plus+' Add to TorBox'}</button>`);
 b.onclick=()=>play(x,s,e,b);r.append(b);return r}
async function play(x,s,e,b){const old=b.innerHTML;b.disabled=true;b.innerHTML='<span class=spin style="width:16px;height:16px"></span>';const gen=sheetGen;
 let d;try{d=await api(`/api/play?hash=${x.hash}${s?`&s=${s}&e=${e}`:''}${x.file?'&file='+encodeURIComponent(x.file):''}`)}catch(err){d={error:err.message}}
 b.disabled=false;b.innerHTML=old;if(gen!=sheetGen)return;
 if(d.status!='ok')return toast(d.detail||d.error||'Couldn’t start this source');
 const c=cur;hist.add(c.type=='series'?{key:'series:'+c.id,type:'series',id:c.id,name:c.name,img:c.background||c.poster,s,e,epName:c.ep?.name}:{key:'movie:'+c.id,type:'movie',id:c.id,name:c.name,img:c.background||c.poster});
 showPlayer(d)}

/* ---------- player: VLC / Safari / Download ---------- */
let hlsInst;
const canDirect=n=>!/\.(mkv|avi|ts)$/i.test(n)&&!/hevc|x265|h\.?265|\bDV\b|dovi|dolby.?vision/i.test(n);
function showPlayer(d){const P=$('#player');hlsInst?.destroy();hlsInst=null;
 const easy=canDirect(d.name);
 P.innerHTML=`<div class=now><div class=lb>Ready to play</div><div class=fn>${esc(d.name)}</div>
  <div class=acts><a class="btn r" href="vlc://${esc(d.stream)}">${I.cone} Play in VLC</a><button class="btn w" id=web>${I.compass} Play in ${APPLE?'Safari':'browser'}</button><a class=btn id=dl href="${esc(d.download)}" download="${esc(d.name)}">${I.down} Download</a></div>
  <p class=hint>${easy?'This file should play right in the browser.':'MKV/HEVC file — VLC is the most reliable option.'}${IOS?(STANDALONE?' Download opens Safari to save to Files.':' Download saves to Files › Downloads.'):''}</p><div id=pv></div></div>`;
 $('#web').onclick=()=>webPlay(d);$('#dl').onclick=e=>{e.preventDefault();download(d)};
 P.scrollIntoView({behavior:'smooth',block:'start'})}
async function download(d){const b=$('#dl');if(b.dataset.busy)return;b.dataset.busy=1;const old=b.innerHTML;b.innerHTML='<span class=spin style="width:16px;height:16px"></span> Checking…';
 let st=0;try{st=(await fetch(d.download,{method:'HEAD',credentials:'same-origin'})).status}catch{}
 b.innerHTML=old;delete b.dataset.busy;
 if(st==410)return toast('Download link expired — tap Play on the source again');
 if(!st||st>=500)return toast('TorBox couldn’t prepare the download — try again');
 if(IOS&&STANDALONE){location.href='x-safari-'+d.download;toast('Opening Safari to download… tap Download there, then find it in Files › Downloads');return}
 location.href=d.download;toast(IOS?'Download started — Safari’s ↓ button shows progress; it saves to Files › Downloads':'Download started')}
function loadHls(){return window.Hls?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';s.onload=ok;s.onerror=no;document.head.append(s)})}
async function webPlay(d){const pv=$('#pv'),btn=$('#web');
 const fail=why=>{pv.innerHTML=`<div class=msg>${esc(why)} Use <b>Play in VLC</b>, or pick a source tagged <b>Safari ✓</b>.</div>`};
 const vid=()=>{pv.innerHTML='<video controls playsinline autoplay></video>';const v=pv.querySelector('video');v.onerror=()=>fail('Safari can’t decode this file.');return v};
 if(canDirect(d.name)){const v=vid();v.src=d.url;v.play().catch(()=>{});return}
 btn.disabled=true;pv.innerHTML='<div class=loading><span class=spin></span>MKV/HEVC needs conversion — asking TorBox for a web stream…</div>';
 let r;try{r=await api(`/api/hls?tid=${d.tid}&fid=${d.fid}`)}catch(e){r={ok:false,detail:e.message}}btn.disabled=false;
 if(!r.ok)return fail('This file is MKV/HEVC and TorBox web streaming isn’t available on your plan.');
 const v=vid();
 if(v.canPlayType('application/vnd.apple.mpegurl'))v.src=r.hls;
 else{try{await loadHls()}catch{return fail('Couldn’t load the web player.')}if(!Hls.isSupported())return fail('This browser can’t play the stream.');
  hlsInst=new Hls();hlsInst.loadSource(r.hls);hlsInst.attachMedia(v);hlsInst.on(Hls.Events.ERROR,(e,x)=>{if(x.fatal)fail('Stream error.')})}
 v.play().catch(()=>{})}

/* ---------- library item ---------- */
function libOpen(t){openSheet(`<div class=ct style="padding-top:28px">${X}<h1 style="padding-right:48px;word-break:break-word">${esc(t.name)}</h1><div class=mline><span>${gb(t.size)}</span><span class=dot>${t.files.length} video file${t.files.length==1?'':'s'}</span></div><div id=player></div><h2>Files</h2><div id=srv></div></div>`);
 if(!t.files.length)return $('#srv').innerHTML='<p class=empty style="padding:0">No video files yet — TorBox may still be downloading.</p>';
 t.files.forEach(f=>{const r=h(`<div class=src><div class=si><div class=t style="font-weight:600;word-break:break-word">${esc(f.name)}</div><div class=stt>${gb(f.size)}</div></div></div>`);
  const b=h(`<button class="btn r sm">${I.play} Play</button>`);
  b.onclick=async()=>{b.disabled=true;let d;try{d=await api(`/api/libplay?tid=${t.id}&fid=${f.id}&name=${encodeURIComponent(f.name)}`)}catch(e){d={detail:e.message}}b.disabled=false;
   if(d.status!='ok')return toast(d.detail||'TorBox error');
   hist.add({key:'lib:'+t.id,lib:true,tid:t.id,name:t.name});showPlayer({...d,name:f.name})};
  r.append(b);$('#srv').append(r)})}
async function libOpenById(tid){const d=await api('/api/library');const t=(d.items||[]).find(x=>x.id==tid);if(!t){hist.rm('lib:'+tid);drawContinue();return toast('That item is no longer in your TorBox')}libOpen(t)}

/* ---------- settings ---------- */
async function settings(){openSheet(`<div class=ct style="padding-top:28px">${X}<h1>Settings</h1><h2>Stream sources</h2><div id=srcs><div class=loading><span class=spin></span></div></div>
 <h2>Custom Stremio addons</h2><div id=adl></div><div class=field><input id=adurl type=url placeholder="https://…/manifest.json" autocapitalize=off><button class="btn r sm" id=adadd>Add</button></div><p id=aderr class=warn></p>
 <h2>Watch history</h2><button class="btn sm" id=clrh>Clear Continue Watching</button>
 <p class=note style="margin-top:24px">Settings and history are saved in this browser only.</p></div>`);
 const c=getCfg(),b=await api('/api/sources');
 $('#srcs').innerHTML=b.builtin.map(s=>`<label class=opt>${esc(s.name)}<input class=sw type=checkbox data-s="${esc(s.id)}" ${c.src.includes(s.id)?'checked':''}></label>`).join('');
 document.querySelectorAll('[data-s]').forEach(i=>i.onchange=()=>{const c=getCfg();c.src=[...document.querySelectorAll('[data-s]:checked')].map(x=>x.dataset.s);saveCfg(c)});
 $('#adadd').onclick=addAddon;$('#adurl').onkeydown=e=>{if(e.key=='Enter')addAddon()};
 $('#clrh').onclick=()=>{store.set('sefhist',[]);drawContinue();toast('Watch history cleared')};drawAddons()}
function drawAddons(){const c=getCfg(),L=$('#adl');L.innerHTML=c.addons.length?'':'<p class=note style="margin:0 0 8px">None added.</p>';
 c.addons.forEach((a,i)=>{const r=h(`<div class=opt><div style="min-width:0"><div>${esc(a.label)}</div><div class=note style="word-break:break-all">${esc(a.url)}</div></div></div>`);
  const b=h('<button class="btn sm">Remove</button>');b.onclick=()=>{c.addons.splice(i,1);saveCfg(c);drawAddons()};r.append(b);L.append(r)})}
async function addAddon(){const u=$('#adurl').value.trim();if(!u)return;$('#aderr').textContent='Checking…';const d=await api('/api/validate-addon?url='+encodeURIComponent(u));
 if(!d.ok)return $('#aderr').textContent=d.error;const c=getCfg();if(!c.addons.some(a=>a.url==d.base))c.addons.push({url:d.base,label:d.name});saveCfg(c);$('#adurl').value='';
 $('#aderr').textContent=d.stream?'':'Added (warning: this addon doesn’t list a stream resource)';drawAddons()}

/* ---------- boot ---------- */
window.go={home,list:libPage,settings,close:closeSheet,toggleSearch:()=>sb.classList.contains('on')?closeSearch():openSearch()};
home();
