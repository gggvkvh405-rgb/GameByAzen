import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ================= DOM =================
const $=id=>document.getElementById(id);
const canvas=$('game'), hud=$('hud'), objText=$('objective-text'), interactEl=$('interact'), invEl=$('inventory'),
subtitleEl=$('subtitle'), dialogEl=$('dialog'), dialogTitle=$('dialog-title'), dialogText=$('dialog-text'), dialogChoices=$('dialog-choices'),
timestampEl=$('timestamp'), clockEl=$('clock'), sanityFill=$('sanity-fill'), listenEl=$('listen-hint'), fadeEl=$('fade');

// ================= AUDIO (весь звук синтезируется, файлов не нужно) =================
let AC=null, tvNoiseGain=null, humOsc=null;
function initAudio(){ if(AC) return; try{ AC=new (window.AudioContext||window.webkitAudioContext)();
  humOsc=AC.createOscillator(); const hg=AC.createGain(); humOsc.frequency.value=50; hg.gain.value=0.012; humOsc.connect(hg).connect(AC.destination); humOsc.start();
  const len=AC.sampleRate*2, buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0); for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  const src=AC.createBufferSource(); src.buffer=buf; src.loop=true; const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=3000;
  tvNoiseGain=AC.createGain(); tvNoiseGain.gain.value=0; src.connect(f).connect(tvNoiseGain).connect(AC.destination); src.start();
}catch(e){} }
function burst(t0,dur,freq,vol,type='lowpass'){ if(!AC)return; const len=AC.sampleRate*dur,b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0); for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len); const s=AC.createBufferSource(); s.buffer=b; const f=AC.createBiquadFilter(); f.type=type; f.frequency.value=freq; const g=AC.createGain(); g.gain.value=vol; s.connect(f).connect(g).connect(AC.destination); s.start(t0); }
function knock(n=3){ if(!AC)return; for(let i=0;i<n;i++){ burst(AC.currentTime+i*0.45,0.12,300,0.9); burst(AC.currentTime+i*0.45,0.3,120,0.5);} }
function stepSound(vol=0.25){ if(!AC)return; burst(AC.currentTime,0.09,500,vol); }
function ring(){ if(!AC)return; for(let i=0;i<2;i++){ const o=AC.createOscillator(),g=AC.createGain(); o.frequency.value=1050; o.type='sine'; g.gain.setValueAtTime(0.06,AC.currentTime+i*0.35); g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+i*0.35+0.22); o.connect(g).connect(AC.destination); o.start(AC.currentTime+i*0.35); o.stop(AC.currentTime+i*0.35+0.25);} }
function scareSound(){ if(!AC)return; [110,116,440,466].forEach(fr=>{ const o=AC.createOscillator(),g=AC.createGain(); o.type='sawtooth'; o.frequency.value=fr; g.gain.setValueAtTime(0.14,AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+1.1); o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime+1.15);}); knock(2); }
function speak(text){ try{ const u=new SpeechSynthesisUtterance(text); u.lang='ru-RU'; u.rate=0.72; u.pitch=0.35; u.volume=0.55; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch(e){} }
let lastSubtitleTimer=null;
function subtitle(text,ms=4200){ subtitleEl.textContent=text; subtitleEl.classList.remove('hidden'); clearTimeout(lastSubtitleTimer); lastSubtitleTimer=setTimeout(()=>subtitleEl.classList.add('hidden'),ms); }
function showDialog(title,text,choices){ dialogTitle.textContent=title; dialogText.textContent=text; dialogChoices.innerHTML=''; dialogEl.classList.remove('hidden'); document.exitPointerLock?.();
  choices.forEach(c=>{ const b=document.createElement('button'); b.textContent=c.label; if(c.secondary)b.className='secondary'; b.onclick=()=>{ dialogEl.classList.add('hidden'); canvas.requestPointerLock?.(); if(c.fn)c.fn(); }; dialogChoices.appendChild(b); }); }
function showNote(title,text){ $('note-title').textContent=title; $('note-text').textContent=text; $('note-modal').classList.remove('hidden'); document.exitPointerLock?.(); }
$('note-close').onclick=()=>{ $('note-modal').classList.add('hidden'); canvas.requestPointerLock?.(); };

// ================= ТЕКСТУРЫ (canvas, стиль PS1) =================
function makeTex(size,fn,rep=1){ const c=document.createElement('canvas'); c.width=c.height=size; fn(c.getContext('2d'),size); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep,rep); t.magFilter=THREE.NearestFilter; t.colorSpace=THREE.SRGBColorSpace; return t; }
function noise(ctx,s,n=900,a=0.16){ for(let i=0;i<n;i++){ ctx.fillStyle=`rgba(${Math.random()>0.5?255:0},${Math.random()>0.5?255:0},${Math.random()>0.5?230:10},${Math.random()*a})`; ctx.fillRect(Math.random()*s,Math.random()*s,2,2);} }
const texConcrete=makeTex(512,(x,s)=>{ const g=x.createLinearGradient(0,0,0,s); g.addColorStop(0,'#7a7a72'); g.addColorStop(1,'#5d5d57'); x.fillStyle=g; x.fillRect(0,0,s,s); noise(x,s,9000,.14);
  // потёки и пятна сырости
  for(let i=0;i<26;i++){ const px=Math.random()*s; const gr=x.createLinearGradient(px,0,px+14,0); gr.addColorStop(0,'rgba(40,40,36,0)'); gr.addColorStop(.5,`rgba(40,40,36,${.08+Math.random()*.16})`); gr.addColorStop(1,'rgba(40,40,36,0)'); x.fillStyle=gr; x.fillRect(px,Math.random()*s*.3,14,s*(.4+Math.random()*.6)); }
  for(let i=0;i<14;i++){ x.fillStyle=`rgba(30,32,28,${.05+Math.random()*.1})`; x.beginPath(); x.ellipse(Math.random()*s,Math.random()*s,20+Math.random()*60,10+Math.random()*40,Math.random()*3,0,7); x.fill(); }
  // трещины
  x.strokeStyle='rgba(25,25,22,.5)'; x.lineWidth=1.4; for(let i=0;i<7;i++){ x.beginPath(); let px=Math.random()*s,py=Math.random()*s*.5; x.moveTo(px,py); for(let j=0;j<6;j++){ px+=(Math.random()-.5)*36; py+=18+Math.random()*26; x.lineTo(px,py);} x.stroke(); }
  // швы опалубки
  x.fillStyle='rgba(0,0,0,.18)'; x.fillRect(0,s*.48,s,3); x.fillRect(s*.5,0,3,s*.48); },2);
const texPlaster=makeTex(512,(x,s)=>{ x.fillStyle='#8f8a7c'; x.fillRect(0,0,s,s); noise(x,s,8000,.12);
  for(let i=0;i<20;i++){ x.fillStyle=`rgba(96,90,74,${.06+Math.random()*.12})`; x.beginPath(); x.ellipse(Math.random()*s,Math.random()*s,16+Math.random()*70,10+Math.random()*44,Math.random()*3,0,7); x.fill(); }
  for(let i=0;i<10;i++){ const px=Math.random()*s; x.fillStyle=`rgba(70,66,56,${.1+Math.random()*.12})`; x.fillRect(px,0,3+Math.random()*6,s); }
  x.fillStyle='rgba(52,50,44,.35)'; x.fillRect(0,s-16,s,16); },2);
const texGreen=makeTex(512,(x,s)=>{ const g=x.createLinearGradient(0,0,0,s); g.addColorStop(0,'#37543f'); g.addColorStop(.8,'#2c4634'); g.addColorStop(1,'#223829'); x.fillStyle=g; x.fillRect(0,0,s,s);
  // мазки кисти
  for(let i=0;i<380;i++){ x.fillStyle=`rgba(${140+Math.random()*60|0},${170+Math.random()*50|0},140,${Math.random()*.05})`; x.fillRect(Math.random()*s,Math.random()*s,2,14+Math.random()*36); }
  noise(x,s,7000,.16);
  // облупившаяся краска — под ней штукатурка
  for(let i=0;i<34;i++){ const px=Math.random()*s,py=s*.45+Math.random()*s*.55; x.fillStyle='#655e50'; x.beginPath(); x.ellipse(px,py,3+Math.random()*9,2+Math.random()*5,Math.random()*3,0,7); x.fill(); x.fillStyle='rgba(52,50,44,.65)'; x.beginPath(); x.ellipse(px,py,1.5+Math.random()*4,1+Math.random()*3,0,0,7); x.fill(); }
  // царапины и надписи-царапины
  x.strokeStyle='rgba(200,205,190,.28)'; x.lineWidth=1; for(let i=0;i<16;i++){ x.beginPath(); const px=Math.random()*s,py=Math.random()*s; x.moveTo(px,py); x.lineTo(px+20+Math.random()*60,py+(Math.random()-.5)*14); x.stroke(); }
  x.fillStyle='rgba(20,26,20,.5)'; x.fillRect(0,s-22,s,22); },2);
const texWallpaper=makeTex(512,(x,s)=>{ x.fillStyle='#977f66'; x.fillRect(0,0,s,s);
  x.fillStyle='rgba(255,240,210,.06)'; for(let i=0;i<s;i+=64)x.fillRect(i,0,30,s); // полосы
  // цветочный мотив
  for(let i=0;i<s;i+=64)for(let j=0;j<s;j+=64){ const cx=i+32,cy=j+32; x.fillStyle='rgba(148,74,64,.5)';
    for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; x.beginPath(); x.ellipse(cx+Math.cos(a)*9,cy+Math.sin(a)*9,7,4,a,0,7); x.fill(); }
    x.fillStyle='rgba(220,180,90,.55)'; x.beginPath(); x.arc(cx,cy,4,0,7); x.fill();
    x.strokeStyle='rgba(90,100,60,.4)'; x.lineWidth=2; x.beginPath(); x.moveTo(cx,cy+14); x.quadraticCurveTo(cx+4,cy+24,cx,cy+32); x.stroke(); }
  noise(x,s,6000,.1);
  for(let i=0;i<8;i++){ x.fillStyle=`rgba(92,74,50,${.08+Math.random()*.1})`; x.beginPath(); x.ellipse(Math.random()*s,s-8,30+Math.random()*70,10+Math.random()*22,0,0,7); x.fill(); } },2);
const texCarpet=makeTex(512,(x,s)=>{ x.fillStyle='#5d1f1c'; x.fillRect(0,0,s,s); noise(x,s,9000,.14);
  x.strokeStyle='#b08d4f'; x.lineWidth=6; x.strokeRect(18,18,s-36,s-36); x.lineWidth=2; x.strokeRect(38,38,s-76,s-76);
  x.strokeStyle='rgba(200,160,90,.6)';
  const dia=(cx,cy,r)=>{ x.beginPath(); x.moveTo(cx,cy-r); x.lineTo(cx+r,cy); x.lineTo(cx,cy+r); x.lineTo(cx-r,cy); x.closePath(); x.stroke(); };
  dia(s/2,s/2,110); dia(s/2,s/2,70); dia(s/2,s/2,30);
  for(const [cx,cy] of [[92,92],[s-92,92],[92,s-92],[s-92,s-92]]) dia(cx,cy,42);
  x.fillStyle='rgba(216,170,90,.5)'; x.beginPath(); x.arc(s/2,s/2,10,0,7); x.fill(); },2);
const texFloor=makeTex(512,(x,s)=>{ x.fillStyle='#54402a'; x.fillRect(0,0,s,s);
  const rows=6, rh=s/rows;
  for(let r=0;r<rows;r++){ const off=(r%2)*s/2;
    for(let px=-1;px<2;px++){ const x0=px*s/2+off; const tone=8+Math.random()*14; x.fillStyle=`rgb(${86+tone},${62+tone*.7},${38+tone*.5})`; x.fillRect(x0+2,r*rh+2,s/2-4,rh-4);
      x.strokeStyle='rgba(40,26,14,.35)'; x.lineWidth=1; for(let gLine=0;gLine<9;gLine++){ x.beginPath(); const gy=r*rh+6+gLine*(rh-10)/9+Math.random()*3; x.moveTo(x0+4,gy); x.bezierCurveTo(x0+s/6,gy+3,x0+s/3,gy-3,x0+s/2-4,gy+2); x.stroke(); } } }
  x.fillStyle='rgba(20,12,6,.55)'; for(let r=0;r<=rows;r++)x.fillRect(0,r*rh-1,s,2);
  noise(x,s,5000,.1); },3);
const texDoor=makeTex(512,(x,s)=>{ const g=x.createLinearGradient(0,0,s,0); g.addColorStop(0,'#5a3d24'); g.addColorStop(.5,'#6b4a2c'); g.addColorStop(1,'#4e351e'); x.fillStyle=g; x.fillRect(0,0,s,s);
  x.strokeStyle='rgba(30,18,8,.4)'; for(let i=0;i<60;i++){ x.beginPath(); const px=Math.random()*s; x.moveTo(px,0); x.bezierCurveTo(px+6,s*.3,px-6,s*.6,px+3,s); x.stroke(); }
  const panel=(px,py,pw,ph)=>{ x.strokeStyle='rgba(24,14,6,.75)'; x.lineWidth=7; x.strokeRect(px,py,pw,ph); x.strokeStyle='rgba(230,190,140,.16)'; x.lineWidth=2; x.strokeRect(px+5,py+5,pw-10,ph-10); };
  panel(s*.18,s*.08,s*.64,s*.36); panel(s*.18,s*.56,s*.64,s*.36); noise(x,s,5000,.12); });
const texTile=makeTex(512,(x,s)=>{ const n=6,ts=s/n;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){ const alt=(i+j)%2; x.fillStyle=alt?'#b9c4bd':'#a7b5ad'; x.fillRect(i*ts+2,j*ts+2,ts-4,ts-4);
    const gr=x.createLinearGradient(i*ts,j*ts,i*ts+ts,j*ts+ts); gr.addColorStop(0,'rgba(255,255,255,.16)'); gr.addColorStop(1,'rgba(0,0,0,.12)'); x.fillStyle=gr; x.fillRect(i*ts+2,j*ts+2,ts-4,ts-4); }
  x.fillStyle='#5e6660'; for(let i=0;i<=n;i++){ x.fillRect(i*ts-2,0,4,s); x.fillRect(0,i*ts-2,s,4); }
  x.strokeStyle='rgba(60,64,60,.5)'; for(let i=0;i<5;i++){ x.beginPath(); let px=Math.random()*s,py=0; x.moveTo(px,py); while(py<s){ px+=(Math.random()-.5)*20; py+=30; x.lineTo(px,py);} x.stroke(); }
  noise(x,s,6000,.12); },2);
const texCeiling=makeTex(512,(x,s)=>{ x.fillStyle='#a9a498'; x.fillRect(0,0,s,s); noise(x,s,8000,.13);
  for(let i=0;i<7;i++){ x.strokeStyle=`rgba(120,104,70,${.12+Math.random()*.15})`; x.lineWidth=2+Math.random()*3; x.beginPath(); x.arc(Math.random()*s,Math.random()*s,20+Math.random()*60,0,7); x.stroke(); }
  x.fillStyle='rgba(90,86,76,.25)'; x.fillRect(0,0,s,4); x.fillRect(0,0,4,s); },2);
const texFabric=makeTex(256,(x,s)=>{ x.fillStyle='#5d6650'; x.fillRect(0,0,s,s); for(let i=0;i<s;i+=3){ x.fillStyle=`rgba(0,0,0,${.05+ (i%6===0?.06:0)})`; x.fillRect(0,i,s,1); x.fillRect(i,0,1,s);} noise(x,s,5000,.12); },3);
const texMetal=makeTex(256,(x,s)=>{ x.fillStyle='#6a7068'; x.fillRect(0,0,s,s); for(let i=0;i<160;i++){ x.fillStyle=`rgba(255,255,255,${Math.random()*.07})`; x.fillRect(0,Math.random()*s,s,1);} for(let i=0;i<26;i++){ x.fillStyle=`rgba(30,30,28,${.06+Math.random()*.14})`; x.beginPath(); x.ellipse(Math.random()*s,Math.random()*s,4+Math.random()*20,2+Math.random()*8,0,0,7); x.fill(); } noise(x,s,5000,.14); },1);
const texSky=()=>textTex(512,256,(x,w,h)=>{ const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#0a1220'); g.addColorStop(1,'#1a2434'); x.fillStyle=g; x.fillRect(0,0,w,h);
  // дом напротив с горящими окнами
  x.fillStyle='#05070a'; x.fillRect(30,50,452,206);
  for(let r=0;r<6;r++)for(let c=0;c<11;c++){ const lit=Math.random()<.28; x.fillStyle=lit?'rgba(255,186,80,.9)':'rgba(40,52,70,.85)'; x.fillRect(48+c*40,66+r*30,20,16); }
  x.fillStyle='rgba(230,235,255,.9)'; x.beginPath(); x.arc(452,34,13,0,7); x.fill(); x.fillStyle='#0a1220'; x.beginPath(); x.arc(446,30,11,0,7); x.fill(); });

function textTex(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.colorSpace=THREE.SRGBColorSpace; return t; }
function labelPlane(text,w,h,fg='#ddd',bg='rgba(20,20,20,0.85)',font=42){ const t=textTex(256,128,(x)=>{ x.fillStyle=bg; x.fillRect(0,0,256,128); x.fillStyle=fg; x.font=`bold ${font}px Courier New`; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,128,66); }); return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true})); }

// ================= СЦЕНА =================
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x050505); scene.fog=new THREE.FogExp2(0x030303,0.055);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,0.05,90);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setSize(1280,720,false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
const hemi=new THREE.HemisphereLight(0xbfc8b0,0x1a1a14,0.25); scene.add(hemi);
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(1280,720),0.32,0.55,0.78); composer.addPass(bloom);
const film=new FilmPass(0.32,0.42,648,false); composer.addPass(film);
composer.addPass(new OutputPass());
const playerLight=new THREE.PointLight(0xffe9b0,0,7); scene.add(playerLight);
const flash=new THREE.SpotLight(0xfff2cc,0,18,0.52,0.55,1.2); flash.castShadow=true; flash.shadow.mapSize.set(1024,1024); flash.shadow.bias=-0.004; flash.shadow.camera.near=0.1; flash.shadow.camera.far=20; scene.add(flash); scene.add(flash.target);

const std=(map,opt={})=>new THREE.MeshStandardMaterial(Object.assign({map,bumpMap:map,bumpScale:0.12,roughness:0.94,metalness:0.0},opt));
const M={
 concrete:std(texConcrete), plaster:std(texPlaster), green:std(texGreen),
 wallpaper:std(texWallpaper), carpet:std(texCarpet,{bumpScale:0.08}),
 floor:std(texFloor,{roughness:0.7,bumpScale:0.08}), door:std(texDoor,{roughness:0.72,bumpScale:0.08}),
 tile:std(texTile,{roughness:0.35,bumpScale:0.05}), ceiling:std(texCeiling),
 fabric:std(texFabric,{roughness:1,bumpScale:0.1}),
 dark:new THREE.MeshStandardMaterial({color:0x1a1c1f,roughness:0.6,metalness:0.25}), black:new THREE.MeshBasicMaterial({color:0x020202}),
 metal:std(texMetal,{roughness:0.45,metalness:0.65,bumpScale:0.05}), pale:new THREE.MeshStandardMaterial({color:0xcbb99e,roughness:0.65}),
 dress:new THREE.MeshStandardMaterial({color:0x41322f,roughness:0.95}), coat:new THREE.MeshStandardMaterial({color:0x141519,roughness:0.9}),
 paper:new THREE.MeshBasicMaterial({color:0xcfc7a8}), red:new THREE.MeshStandardMaterial({color:0x77231d,roughness:0.55}),
 tv:new THREE.MeshBasicMaterial({color:0x888888}), lampOn:new THREE.MeshBasicMaterial({color:0xffe9a8}), lampOff:new THREE.MeshBasicMaterial({color:0x333322}),
 glass:new THREE.MeshPhysicalMaterial({color:0xdfe8e2,roughness:0.08,metalness:0,transparent:true,opacity:0.32}),
};
const world=new THREE.Group(); scene.add(world);
const surfaces=[], colliders=[], interactables=[], lamps=[];
function addSurface(x1,x2,z1,z2,y){ surfaces.push({x1,x2,z1,z2,y}); }
function groundYAt(x,z,refY){ let best=null,bd=1e9; for(const s of surfaces){ if(x>=s.x1&&x<=s.x2&&z>=s.z1&&z<=s.z2){ const y=typeof s.y==='function'?s.y(x,z):s.y; const d=Math.abs(y-refY); if(d<bd){bd=d;best=y;} } } return bd<2.1?best:null; }
function addCollider(x1,x2,z1,z2,y1,y2){ const c={x1,x2,z1,z2,y1,y2,enabled:true}; colliders.push(c); return c; }
function box(w,h,d,mat,x,y,z,parent=world){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m; }
function wallBox(cx,cy,cz,w,h,d,mat=M.concrete){ const m=box(w,h,d,mat,cx,cy,cz); addCollider(cx-w/2,cx+w/2,cz-d/2,cz+d/2,cy-h/2,cy+h/2); return m; }
function addInteract(obj){ interactables.push(obj); }

// Дверь с петлёй
function makeDoor(x,y,z,ry=0){ const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry; const m=box(0.08,2.05,0.95,M.door,0,1.03,0.475,g); const knob=box(0.07,0.07,0.07,M.metal,0.09,1.0,0.85,g); world.add(g);
  const col=addCollider(x-0.6,x+0.6,z-0.2,z+1.6,y,y+2.1); // проём целиком, пока дверь закрыта
  return {group:g,open:false,col,
    setOpen(v){ this.open=v; this.group.rotation.y=ry+(v?-1.85:0); this.col.enabled=!v; },
    setColliderBox(){ /* позиция двери известна сцене; коллайдер перекрывает проём */ }
  };
}

// ================= ПОСТРОЙКА ДОМА =================
const FLOORS=5, FH=3;
const lampLights=[];
function buildLanding(fi){
  const y=fi*FH;
  // пол и потолок
  box(10,0.2,6,M.concrete,0,y-0.1,0); addSurface(-5,5,-3,3,y);
  box(10,0.2,6,M.ceiling,0,y+3.05,0);
  // нижняя зелёная / верхняя серая — двумя ящиками
  const isTop=fi===4,isGround=fi===0,isBase=fi===-1;
  function wallSeg(cx,cz,w,d){ wallBox(cx,y+0.75,cz,w,1.5,d,M.green); wallBox(cx,y+2.25,cz,w,1.5,d,M.plaster); }
  // северная стена с 4 дверями
  wallSeg(0,-3,10,0.25);
  const nums={ '-1':['Б','Б','Б','Б'],0:[37,38,39,40],1:[41,42,43,44],2:[49,50,51,52],3:[53,54,55,56],4:[45,46,48,'·']}[fi]||[1,2,3,4];
  for(let i=0;i<4;i++){ const dx=-3.75+i*2.5; const d=box(0.9,2.0,0.06,M.door,dx,y+1.0,-2.85); const lp=labelPlane(String(nums[i]),0.42,0.22,'#e8e2c8','rgba(30,25,18,.9)',52); lp.position.set(dx,y+1.65,-2.80); world.add(lp); }
  // южная стена: проём лестницы x -2..2
  wallSeg(-3.5,3,3,0.25); wallSeg(3.5,3,3,0.25);
  // западная и восточная стены (проёмы под особые квартиры)
  const westGap=(fi===4), eastGap=(fi===4||fi===0||fi===-1);
  if(westGap){ wallSeg(-5,-2,0.25,2); wallSeg(-5,2,0.25,2); } else wallSeg(-5,0,0.25,6);
  if(eastGap){ wallSeg(5,-2,0.25,2); wallSeg(5,2,0.25,2); } else wallSeg(5,0,0.25,6);
  // лампа
  const lamp=box(0.18,0.28,0.18,M.lampOn,0,y+2.8,0); lamps.push(lamp);
  const pl=new THREE.PointLight(0xffdf9e, fi===4?7:5,10,1.6); pl.position.set(0,y+2.55,0); scene.add(pl); lampLights.push(pl);
  // почтовые ящики на 1 этаже
  if(fi===0){ for(let r=0;r<3;r++)for(let c=0;c<5;c++){ box(0.55,0.42,0.12,M.metal,-3.4+c*0.62,y+0.75+r*0.48,-2.8); }
    const lp=labelPlane('ЗДЕСЬ БЫЛ ВАСЯ',1.7,0.4,'#222','rgba(0,0,0,0)',40); lp.position.set(4.2,y+1.9,-2.82); lp.rotation.z=-0.06; world.add(lp);
    const info=labelPlane('ИНФОРМАЦИЯ',1.3,0.5,'#332211','rgba(210,200,170,.92)',44); info.position.set(-4.84,y+2.0,-1.2); info.rotation.y=Math.PI/2; world.add(info);
  }
  if(fi===4){ const post=labelPlane('ХЛЕБ\nВСЕМУ ГОЛОВА!',0.9,1.1,'#e8d9a0','rgba(120,40,30,.9)',30); post.position.set(-4.86,y+1.8,1.8); post.rotation.y=Math.PI/2; world.add(post); }
}
// лестничные марши между этажами (fi — верхний этаж марша)
const sixthGate={col:null,mesh:null};
function buildStairs(fi){
  const yTop=fi*FH, yBot=yTop-FH;
  addSurface(-2,0,3,9,(x,z)=> yBot+((z-3)/6)*FH);
  addSurface(0,2,3,11,yTop); addSurface(-2,2,9,11,yTop);
  // ступени
  for(let i=0;i<10;i++){ const z=3.3+i*0.6, y=yBot+(i/10)*FH; box(2,0.16,0.62,M.concrete,-1,y,z); }
  box(2,0.18,2,M.concrete,1,yTop-0.09,7); box(4,0.18,2,M.concrete,0,yTop-0.09,10);
  // ограждения шахты
  wallBox(-2.12,(yBot+yTop)/2,7,0.24,FH+3,8,M.concrete); wallBox(2.12,(yBot+yTop)/2,7,0.24,FH+3,8,M.concrete);
  wallBox(0,(yBot+yTop)/2,11.12,4.5,FH+3,0.24,M.concrete);
  const mid=addCollider(-0.12,0.12,3,9,yBot-0.4,yTop+2.6); // стена между маршами
  box(0.1,1.0,6,M.metal,-0.0,(yBot+yTop)/2+0.8,6); // перила-разделитель (визуально)
  box(0.08,0.9,6,M.metal,-1.92,(yBot+yTop)/2+0.7,6);
  if(fi===5){ // ворота на «чердак/шестой»
    const g=box(1.9,2.2,0.12,M.metal,-1,yBot+1.1,3.15); sixthGate.mesh=g; sixthGate.col=addCollider(-2,0,2.9,3.4,yBot,yBot+2.4);
    const lp=labelPlane('ЧЕРДАК',0.9,0.3,'#ddd','rgba(0,0,0,.8)',44); lp.position.set(-1,yBot+2.45,3.05); world.add(lp);
  }
}
for(let fi=-1;fi<FLOORS;fi++) buildLanding(fi);
for(let fi=0;fi<=5;fi++) buildStairs(fi);
// шестой этаж (скрыт до поры)
const sixthGroup=new THREE.Group(); world.add(sixthGroup);
{
  const y=15; box(10,0.2,6,M.concrete,0,y-0.1,0,sixthGroup); addSurface(-5,5,-3,3,y); box(10,0.2,6,M.concrete,0,y+3.05,0,sixthGroup);
  wallBox(0,y+1.5,-3,10,3,0.25,M.green); wallBox(-5,y+1.5,0,0.25,3,6,M.green); wallBox(5,y+1.5,0,0.25,3,6,M.green); wallBox(-3.5,y+1.5,3,3,3,0.25,M.green); wallBox(3.5,y+1.5,3,3,3,0.25,M.green);
  const d=box(1.1,2.1,0.08,M.door,0,y+1.05,-2.86,sixthGroup); const lp=labelPlane('?',0.5,0.3,'#ffe9a8','rgba(0,0,0,.85)',60); lp.position.set(0,y+1.75,-2.78); sixthGroup.add(lp); sixthGroup.userData.doorNum=lp;
  const pl=new THREE.PointLight(0xffdf9e,6,10,1.6); pl.position.set(0,y+2.5,0); sixthGroup.add(pl); sixthGroup.visible=false;
  // детские вещи 1947
  box(0.5,0.4,0.5,M.red,-3.5,y+0.2,1.5,sixthGroup); box(0.35,0.3,0.35,M.dress,3.6,y+0.15,-1,sixthGroup); box(0.7,0.25,0.4,M.door,-2,y+0.12,-1.8,sixthGroup);
}

// ---------- квартира 47 (5 этаж, восток) ----------
const APT_Y=12;
addSurface(5,19,-7,7,APT_Y);
box(14,0.2,14.5,M.floor,12,APT_Y-0.1,0); box(14,0.2,14.5,M.ceiling,12,APT_Y+3.05,0);
// периметр
wallBox(12,APT_Y+1.5,-7.12,14.5,3,0.25,M.wallpaper); wallBox(12,APT_Y+1.5,7.12,14.5,3,0.25,M.wallpaper); wallBox(19.12,APT_Y+1.5,0,0.25,3,14.5,M.wallpaper);
// перегородки: прихожая x5-9; кухня z<-2; ванная z>2; гостиная/спальня x>10
wallBox(10,APT_Y+1.5,-4.5,0.22,3,5,M.wallpaper); wallBox(5.75,APT_Y+1.5,-2,1.5,3,0.22,M.wallpaper); wallBox(9.25,APT_Y+1.5,-2,1.5,3,0.22,M.wallpaper);
wallBox(10,APT_Y+1.5,4.5,0.22,3,5,M.wallpaper); wallBox(5.75,APT_Y+1.5,2,1.5,3,0.22,M.wallpaper); wallBox(9.25,APT_Y+1.5,2,1.5,3,0.22,M.wallpaper);
wallBox(14.5,APT_Y+1.5,0,9,3,0.22,M.wallpaper);
// проёмы в перегородках перекрываем «невидимыми» проходами: перегородки выше уже цельные — делаем двери-порталы телепортом не нужно: оставим проёмы за счёт укорочения:
// (стены x=10 имеют длину 5 при пролёте 5 — проём у прихожей z -2..2 свободен)
wallBox(5,APT_Y+1.5,-5,0.25,3,4,M.wallpaper); wallBox(5,APT_Y+1.5,5,0.25,3,4,M.wallpaper);
const door47=makeDoor(4.92,APT_Y,-0.5,0);
const door43=makeDoor(-4.92,APT_Y,-0.5,0); door43.col.enabled=true;
const door38=makeDoor(4.92,0,-0.5,0); door38.col.enabled=true;
// мебель 47
box(4.6,0.08,3.2,M.carpet,14.5,APT_Y+0.05,-3.5); box(2.8,0.08,2.2,M.carpet,14.5,APT_Y+0.05,3.8);
const tvMesh=box(1.1,0.85,0.8,M.dark,16.8,APT_Y+0.85,-5.8); const tvScreen=box(0.9,0.62,0.04,M.tv,16.8,APT_Y+0.88,-5.38);
box(1.3,0.45,1.0,M.door,16.8,APT_Y+0.22,-5.8);
box(2.4,0.7,0.9,new THREE.MeshLambertMaterial({color:0x4a3b2c}),12.2,APT_Y+0.35,-5.5); // диван
const phoneMesh=box(0.5,0.35,0.5,M.red,11.2,APT_Y+0.95,-6.4); box(0.8,0.8,0.6,M.door,11.2,APT_Y+0.4,-6.4);
const bedMesh=box(2.3,0.55,1.5,new THREE.MeshLambertMaterial({color:0x707a68}),16.5,APT_Y+0.28,4.6);
box(1.1,2.0,0.6,M.door,18.6,APT_Y+1.0,1.2); // шкаф
box(1.8,0.75,0.9,M.metal,7.2,APT_Y+0.38,-5.2); // кухонный стол/плита
box(0.7,1.4,0.7,M.metal,6.2,APT_Y+0.7,-6.5); // холодильник
box(1.4,0.8,0.7,M.pale,7.4,APT_Y+0.4,5.6); // ванна
const slippers=box(0.55,0.12,0.3,new THREE.MeshLambertMaterial({color:0x8a4a4a}),6.2,APT_Y+0.07,1.4);
const carpetWall=box(3.2,2.0,0.06,M.carpet,14.5,APT_Y+1.7,-6.95);
const windowGlow=box(2.2,1.5,0.05,new THREE.MeshBasicMaterial({color:0x2a3440}),14.5,APT_Y+1.7,7.0);
addCollider(15.3,17.7,3.8,5.4,APT_Y,APT_Y+1); addCollider(11,13.4,-6, -5,APT_Y,APT_Y+1); addCollider(16.1,17.5,-6.3,-5.3,APT_Y,APT_Y+1.4);

// квартира 43 (запад, 5 этаж)
addSurface(-13,-5,-3,3,APT_Y); box(8,0.2,6,M.floor,-9,APT_Y-0.1,0); box(8,0.2,6,M.concrete,-9,APT_Y+3.05,0);
wallBox(-13.12,APT_Y+1.5,0,0.25,3,6,M.wallpaper); wallBox(-9,APT_Y+1.5,-3.12,8.5,3,0.25,M.wallpaper); wallBox(-9,APT_Y+1.5,3.12,8.5,3,0.25,M.wallpaper);
const tv43=box(1.0,0.8,0.7,M.dark,-12,APT_Y+0.8,0); const tv43s=box(0.8,0.55,0.04,M.tv,-11.62,APT_Y+0.82,0);
box(1.8,0.6,0.8,new THREE.MeshLambertMaterial({color:0x4a3b2c}),-8,APT_Y+0.3,2);
// квартира 38 (1 этаж)
addSurface(5,13,-3,3,0); box(8,0.2,6,M.floor,9,-0.1,0); box(8,0.2,6,M.concrete,9,3.05,0);
wallBox(13.12,1.5,0,0.25,3,6,M.wallpaper); wallBox(9,1.5,-3.12,8.5,3,0.25,M.wallpaper); wallBox(9,1.5,3.12,8.5,3,0.25,M.wallpaper);
box(1.6,0.7,0.9,M.door,10,0.35,1.5); const koliaBody=box(0.55,1.1,0.5,M.coat,10,0.75,1.4); koliaBody.rotation.x=0.5;
// подвал-котельная (восток, y=-3)
addSurface(5,15,-4,4,-3); box(10,0.2,8,M.concrete,10,-3.1,0); box(10,0.2,8,M.concrete,10,0.05,0);
wallBox(15.12,-1.5,0,0.25,3,8,M.concrete); wallBox(10,-1.5,-4.12,10.5,3,0.25,M.concrete); wallBox(10,-1.5,4.12,10.5,3,0.25,M.concrete);
wallBox(5,-1.5,-3.55,0.25,3,0.9,M.concrete); wallBox(5,-1.5,3.55,0.25,3,0.9,M.concrete);
const boiler=box(2.2,2.2,1.6,M.metal,13,-1.9,0); const furnaceGlow=box(0.8,0.6,0.06,new THREE.MeshBasicMaterial({color:0xff6a22}),13,-2.2,0.85);
const breakerMesh=box(0.9,1.2,0.25,M.metal,6,-1.6,-3.9);
box(1.4,0.9,0.8,M.door,8,-2.55,3); // архивные ящики

// рисунки Ани и записки на этажах
const drawingPos=[[-3,1.35,-2.82,0],[3,4.35,-2.82,0],[-3,7.35,-2.82,0],[3,10.35,-2.82,0],[8,13.35,2.05,1]];
const drawingMeshes=[];
drawingPos.forEach((p,i)=>{ const t=textTex(128,128,(x)=>{ x.fillStyle='#d8d2b8'; x.fillRect(0,0,128,128); x.strokeStyle='#336'; x.lineWidth=3; const floors=6; for(let f=0;f<floors;f++){ x.strokeRect(34,14+f*16,60,15); x.fillStyle='#d33'; x.fillRect(58,14+f*16+4,10,8);} x.fillStyle='#336'; x.font='11px Courier'; x.fillText('дом',8,124); });
  const m=new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.55),new THREE.MeshBasicMaterial({map:t})); m.position.set(p[0],p[1],p[2]); if(p[3])m.rotation.y=-Math.PI/2; world.add(m); drawingMeshes.push(m); });
const rulesPlane=labelPlane('ПРАВИЛА ДОМА',1.0,0.55,'#2a2a22','rgba(215,208,180,.95)',36); rulesPlane.position.set(4.86,13.8,1.7); rulesPlane.rotation.y=-Math.PI/2; world.add(rulesPlane);


// ================= ДЕТАЛЬНЫЕ МОДЕЛИ (мебель, мелочи, пыль) =================
let dustPoints=null;
function cyl(r1,r2,h,mat,x,y,z,parent=world,seg=14){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m; }
function sph(r,mat,x,y,z,parent=world){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,18,14),mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m; }
function tube(a,b,r,mat,parent=world){ const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b); const d=B.clone().sub(A); const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),10),mat); m.position.copy(A).addScaledVector(d,0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); m.castShadow=true; parent.add(m); return m; }
function chair(x,y,z,ry,parent=world){ const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry; parent.add(g); const wood=M.door;
  for(const [lx,lz] of [[-.19,-.19],[.19,-.19],[-.19,.19],[.19,.19]]) cyl(0.022,0.018,0.45,wood,lx,0.225,lz,g,8);
  box(0.46,0.04,0.46,wood,0,0.46,0,g);
  for(const lx of [-.19,.19]) cyl(0.02,0.02,0.55,wood,lx,0.73,0.21,g,8);
  box(0.44,0.09,0.035,wood,0,0.97,0.21,g); box(0.44,0.07,0.03,wood,0,0.78,0.21,g); return g; }
function radiator(x,y,z,ry=0,parent=world){ const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry; parent.add(g); const wm=new THREE.MeshStandardMaterial({color:0xb9bcb4,roughness:0.5,metalness:0.35});
  for(let i=0;i<9;i++) box(0.09,0.52,0.13,wm,-0.4+i*0.1,0.32,0,g);
  cyl(0.025,0.025,0.9,M.metal,0,0.6,0,g,8).rotation.z=Math.PI/2; tube([0.42,0.1,0],[0.42,-0.05,0.16],0.022,M.metal,g); return g; }
(function buildDetails(){
  const Y=APT_Y;
  // плинтусы в квартире
  const sk=new THREE.MeshStandardMaterial({color:0x2e2620,roughness:0.8});
  box(9,0.1,0.03,sk,14.5,Y+0.05,-6.98); box(9,0.1,0.03,sk,14.5,Y+0.05,6.98); box(0.03,0.1,14,sk,18.98,Y+0.05,0); box(4.8,0.1,0.03,sk,7.5,Y+0.05,1.98);
  // диван: подушки и подлокотники поверх базы
  const sofa=new THREE.Group(); sofa.position.set(12.2,Y,-5.5); world.add(sofa);
  box(1.05,0.18,0.8,M.fabric,0.55,0.78,0,sofa); box(1.05,0.18,0.8,M.fabric,-0.55,0.78,0,sofa);
  const b1=box(1.05,0.5,0.16,M.fabric,0.55,1.05,0.38,sofa); b1.rotation.x=-0.16; const b2=box(1.05,0.5,0.16,M.fabric,-0.55,1.05,0.38,sofa); b2.rotation.x=-0.16;
  box(0.22,0.34,0.9,M.fabric,1.2,0.85,0,sofa); box(0.22,0.34,0.9,M.fabric,-1.2,0.85,0,sofa);
  for(const [lx,lz] of [[-1.05,-.35],[1.05,-.35],[-1.05,.35],[1.05,.35]]) cyl(0.03,0.02,0.12,M.door,lx,0.06,lz,sofa,8);
  // телевизор: антенна и ручки
  tube([16.8,Y+1.3,-5.8],[16.2,Y+2.2,-6.1],0.012,M.metal); tube([16.8,Y+1.3,-5.8],[17.5,Y+2.15,-6.0],0.012,M.metal);
  cyl(0.05,0.05,0.05,M.dark,17.38,Y+1.05,-5.55).rotation.z=Math.PI/2; cyl(0.04,0.04,0.05,M.dark,17.38,Y+0.85,-5.55).rotation.z=Math.PI/2;
  // стул перед телевизором (как на VHS-записях)
  chair(15.4,Y,-3.4,Math.PI);
  // сервант с книгами и хрусталём
  const sv=new THREE.Group(); sv.position.set(18.75,Y,-1.5); sv.rotation.y=-Math.PI/2; world.add(sv);
  box(2.2,2.0,0.42,M.door,0,1.0,0,sv); box(2.0,0.02,0.36,M.floor,0,0.65,0.02,sv); box(2.0,0.02,0.36,M.floor,0,1.3,0.02,sv);
  const bookCols=[0x7a2e22,0x22406e,0x2e5d33,0x77622a,0x4a2440,0x885838,0x33555e];
  for(let sh=0;sh<3;sh++){ let bx=-0.95; while(bx<0.55){ const bw=0.045+Math.random()*0.05,bh=0.24+Math.random()*0.14; const bm=new THREE.MeshStandardMaterial({color:bookCols[Math.floor(Math.random()*bookCols.length)],roughness:0.85}); const bk=box(bw,bh,0.2,bm,bx+bw/2,0.18+sh*0.65+bh/2-0.06,0.03,sv); if(Math.random()<.18)bk.rotation.z=0.12; bx+=bw+0.008; }
    for(let gi=0;gi<3;gi++){ const gl=cyl(0.035,0.05,0.14,M.glass,0.68+gi*0.14,0.25+sh*0.65,0.03,sv,10); } }
  box(0.34,0.5,0.02,M.glass,-0.2,1.62,0.22,sv);
  // окна: рамы, занавески, радиаторы, дом напротив
  windowGlow.material=new THREE.MeshBasicMaterial({map:texSky()}); windowGlow.scale.set(1.25,1.15,1);
  const wf=new THREE.MeshStandardMaterial({color:0x9aa094,roughness:0.6});
  box(2.9,0.08,0.08,wf,14.5,Y+2.62,6.96); box(2.9,0.08,0.08,wf,14.5,Y+0.78,6.96); box(0.08,1.9,0.08,wf,13.05,Y+1.7,6.96); box(0.08,1.9,0.08,wf,15.95,Y+1.7,6.96); box(0.06,1.84,0.06,wf,14.5,Y+1.7,6.96); box(2.84,0.06,0.06,wf,14.5,Y+1.7,6.96);
  box(0.5,1.95,0.06,M.fabric,13.25,Y+1.68,6.9); box(0.5,1.95,0.06,M.fabric,15.75,Y+1.68,6.9); box(3.1,0.07,0.07,M.door,14.5,Y+2.68,6.9);
  radiator(14.5,Y,6.72); radiator(16.5,Y,6.72);
  // спальня: подушка, одеяло, тумбочка с лампой
  const pil=sph(0.32,new THREE.MeshStandardMaterial({color:0xcfc8b4,roughness:1}),17.4,Y+0.62,4.6); pil.scale.set(1.15,0.42,0.75);
  box(1.5,0.14,1.42,new THREE.MeshStandardMaterial({color:0x5e3038,roughness:1}),16.1,Y+0.6,4.6);
  box(0.55,0.5,0.4,M.door,18.3,Y+0.25,3.2); cyl(0.05,0.07,0.1,M.metal,18.3,Y+0.55,3.2,world,10);
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.14,0.16,12,1,true),new THREE.MeshBasicMaterial({color:0xffd9a0})); shade.position.set(18.3,Y+0.72,3.2); world.add(shade);
  // кухня: шкафчики, плита с конфорками и чайником, стол и стулья
  for(let i=0;i<4;i++){ box(1.05,0.85,0.55,M.door,5.65+i*1.12,Y+0.43,-6.62); cyl(0.015,0.015,0.12,M.metal,5.65+i*1.12,Y+0.62,-6.32,world,8); }
  for(let i=0;i<3;i++) box(1.05,0.7,0.4,M.door,5.65+i*1.12,Y+2.15,-6.78);
  for(const [bx,bz,br] of [[6.9,-5.4,.14],[7.5,-5.4,.11],[6.9,-4.95,.11],[7.5,-4.95,.14]]){ const bn=cyl(br,br,0.025,M.dark,bx,Y+0.79,bz,world,16); }
  box(0.7,0.4,0.03,M.dark,7.2,Y+0.35,-4.88);
  const kettle=sph(0.14,M.metal,7.45,Y+0.9,-5.25); kettle.scale.y=0.85; cyl(0.02,0.035,0.1,M.metal,7.58,Y+0.95,-5.25,world,8).rotation.z=-0.7;
  const kt=new THREE.Group(); kt.position.set(8.8,Y,-4.2); world.add(kt); cyl(0.55,0.55,0.04,M.door,0,0.72,0,kt,20); cyl(0.05,0.07,0.72,M.door,0,0.36,0,kt,10);
  chair(8.1,Y,-3.5,Math.PI/2); chair(9.5,Y,-4.9,-Math.PI/2+0.4);
  cyl(0.02,0.02,0.5,M.metal,6.55,Y+0.95,-6.5,world,8);
  // ванная: плитка, раковина, зеркало
  box(4.9,1.7,0.04,M.tile,7.5,Y+0.85,6.96); box(0.04,1.7,4.9,M.tile,9.96,Y+0.85,4.5);
  cyl(0.09,0.12,0.75,new THREE.MeshStandardMaterial({color:0xd8dcd4,roughness:0.3}),6.2,Y+0.38,6.3,world,12);
  cyl(0.3,0.24,0.14,new THREE.MeshStandardMaterial({color:0xe4e8e0,roughness:0.25}),6.2,Y+0.8,6.3,world,16);
  box(0.5,0.65,0.03,M.metal,6.2,Y+1.55,6.92);
  // прихожая: вешалка с пальто и зеркало
  box(1.3,0.5,0.05,M.door,7.6,Y+1.78,1.96);
  for(let i=0;i<4;i++) sph(0.035,M.metal,7.15+i*0.3,Y+1.62,1.9);
  const coatMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.3,0.95,10),M.coat); coatMesh.position.set(7.75,Y+1.05,1.88); coatMesh.castShadow=true; world.add(coatMesh);
  box(0.6,0.9,0.03,M.metal,9.85,Y+1.5,-1.2);
  // дисковый телефон: диск и трубка
  cyl(0.13,0.15,0.04,new THREE.MeshStandardMaterial({color:0xd8cfb8,roughness:0.4}),11.2,Y+1.06,-6.4,world,18).rotation.x=0.5;
  const hs=new THREE.Group(); hs.position.set(11.2,Y+1.22,-6.4); hs.rotation.z=0.1; world.add(hs);
  box(0.42,0.05,0.09,M.red,0,0,0,hs); sph(0.055,M.red,-0.2,0,0,hs); sph(0.055,M.red,0.2,0,0,hs);
  // лестничные клетки: трубы, мусоропровод, плафоны, объявления
  for(let fi=-1;fi<5;fi++){ const y=fi*3;
    cyl(0.06,0.06,3,M.metal,-4.75,y+1.5,2.72,world,10); cyl(0.035,0.035,3,M.metal,-4.58,y+1.5,2.72,world,8);
    box(0.62,0.85,0.06,M.metal,4.55,y+1.15,2.86);
    cyl(0.07,0.09,0.09,M.metal,0,y+2.93,0,world,10); const bulb=sph(0.105,M.lampOn,0,y+2.8,0); bulb.castShadow=false;
    radiator(-3.6,y,-2.78);
    for(let pi=0;pi<3;pi++){ const pp=box(0.24,0.3,0.012,M.paper,-1.4+pi*0.3,y+1.75,-2.86); pp.rotation.z=(Math.random()-.5)*0.16; }
  }
  // почтовые ящики: щели и таблички
  for(let r=0;r<3;r++)for(let c=0;c<5;c++){ box(0.4,0.03,0.02,M.dark,-3.4+c*0.62,0.85+r*0.48,-2.73); }
  // перила лестниц
  for(let fi=0;fi<=5;fi++){ const yT=fi*3,yB=yT-3;
    tube([-1.96,yB+1.02,3.15],[-1.96,yT+1.02,8.85],0.035,M.metal);
    for(let i2=1;i2<7;i2++){ const t=i2/7; tube([-1.96,yB+t*3+0.08,3.15+t*5.7],[-1.96,yB+t*3+0.98,3.15+t*5.7],0.014,M.metal); }
    tube([1.96,yT+1.02,3.15],[1.96,yT+1.02,10.85],0.035,M.metal);
  }
  // подвал: трубы под потолком и вентиль
  const p1=cyl(0.07,0.07,9,M.metal,10,-0.35,-2,world,12); p1.rotation.z=Math.PI/2;
  const p2=cyl(0.05,0.05,9,M.metal,10,-0.55,-1.8,world,10); p2.rotation.z=Math.PI/2;
  const valve=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.03,10,20),M.red); valve.position.set(12.2,-1.7,0.86); world.add(valve);
  cyl(0.09,0.09,0.06,new THREE.MeshStandardMaterial({color:0xe8e4d2,roughness:0.3}),13.6,-1.2,0.86,world,14).rotation.x=Math.PI/2;
  // квартира 43: опрокинутый стул
  const ch=chair(-8,Y,1.2,0.7); ch.rotation.z=1.35; ch.position.y=Y+0.25;
  // пыль в воздухе
  const N=420, pos=new Float32Array(N*3);
  for(let i=0;i<N;i++){ if(i%2){ pos[i*3]=-4+Math.random()*22; pos[i*3+1]=Math.random()*15; pos[i*3+2]=-6+Math.random()*12; } else { pos[i*3]=-4+Math.random()*8; pos[i*3+1]=Math.random()*17; pos[i*3+2]=-2+Math.random()*12; } }
  const dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.BufferAttribute(pos,3));
  dustPoints=new THREE.Points(dg,new THREE.PointsMaterial({color:0xffe6b8,size:0.02,transparent:true,opacity:0.4,depthWrite:false}));
  scene.add(dustPoints);
})();


// сущности
function makeFigure(dress=false,coatColor=null){
  const g=new THREE.Group();
  const coatMat=coatColor!==null?new THREE.MeshStandardMaterial({color:coatColor,roughness:0.88}):M.coat;
  const skin=new THREE.MeshStandardMaterial({color:0xc9b096,roughness:0.6});
  const hairM=new THREE.MeshStandardMaterial({color:dress?0x6e6258:0x191919,roughness:0.95});
  function part(geo,mat,x,y,z,parent=g){ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m; }
  if(dress){
    // платье — силуэт через LatheGeometry
    const pts=[]; [[0.02,0],[0.34,0.02],[0.38,0.18],[0.26,0.6],[0.2,0.95],[0.21,1.15],[0.16,1.32],[0.05,1.38]].forEach(p=>pts.push(new THREE.Vector2(p[0],p[1])));
    part(new THREE.LatheGeometry(pts,18),M.dress,0,0,0);
    part(new THREE.SphereGeometry(0.155,14,10),M.dress,0,1.38,0).scale.set(1.25,0.55,0.9); // плечи
    // длинные руки: плечо+предплечье капсулами, кисти
    for(const side of [-1,1]){ const a=part(new THREE.CapsuleGeometry(0.042,0.34,4,10),skin,side*0.24,1.08,0); a.rotation.z=side*0.1;
      const f=part(new THREE.CapsuleGeometry(0.036,0.32,4,10),skin,side*0.28,0.62,0.01); f.rotation.z=side*0.06;
      const hand=part(new THREE.SphereGeometry(0.05,10,8),skin,side*0.29,0.36,0.02); hand.scale.set(0.75,1.5,0.4);
      for(let fi2=0;fi2<3;fi2++){ const fg=part(new THREE.CapsuleGeometry(0.008,0.06,3,6),skin,side*0.29+(fi2-1)*0.02,0.27,0.03); } }
    part(new THREE.CylinderGeometry(0.05,0.065,0.5,10),skin,-0.1,0.06,0).position.y=-0.1; // ноги под платьем едва видны
    const legL=part(new THREE.CapsuleGeometry(0.045,0.3,4,8),skin,-0.1,0.16,0); const legR=part(new THREE.CapsuleGeometry(0.045,0.3,4,8),skin,0.1,0.16,0);
    part(new THREE.BoxGeometry(0.09,0.04,0.2),M.dark,-0.1,0.02,0.04); part(new THREE.BoxGeometry(0.09,0.04,0.2),M.dark,0.1,0.02,0.04);
  } else {
    // пальто — LatheGeometry: подол шире, талия уже
    const pts=[]; [[0.02,0.55],[0.24,0.56],[0.27,0.8],[0.2,1.15],[0.19,1.4],[0.24,1.52],[0.05,1.56]].forEach(p=>pts.push(new THREE.Vector2(p[0],p[1])));
    part(new THREE.LatheGeometry(pts,18),coatMat,0,0,0);
    part(new THREE.SphereGeometry(0.16,14,10),coatMat,0,1.5,0).scale.set(1.35,0.55,0.95); // плечи
    part(new THREE.CylinderGeometry(0.19,0.21,0.12,14),coatMat,0,1.56,0); // воротник
    for(const side of [-1,1]){ const a=part(new THREE.CapsuleGeometry(0.05,0.36,4,10),coatMat,side*0.27,1.24,0); a.rotation.z=side*0.08;
      const f=part(new THREE.CapsuleGeometry(0.042,0.32,4,10),coatMat,side*0.3,0.82,0.01); f.rotation.z=side*0.05;
      part(new THREE.SphereGeometry(0.048,10,8),skin,side*0.31,0.55,0.02).scale.set(0.8,1.3,0.45); }
    for(const side of [-1,1]){ part(new THREE.CapsuleGeometry(0.062,0.4,4,10),new THREE.MeshStandardMaterial({color:0x101114,roughness:0.9}),side*0.11,0.32,0);
      part(new THREE.BoxGeometry(0.11,0.05,0.24),M.dark,side*0.11,0.025,0.05); }
    // пуговицы
    for(let bi=0;bi<3;bi++) part(new THREE.SphereGeometry(0.016,8,8),M.metal,0,1.32-bi*0.22,0.195);
  }
  // голова на шарнире (для наклона Хозяйки)
  const headPivot=new THREE.Group(); headPivot.position.y=1.56; g.add(headPivot);
  const head=part(new THREE.SphereGeometry(0.145,20,16),skin,0,0.13,0,headPivot); head.scale.set(0.88,1.12,0.95);
  const hair=part(new THREE.SphereGeometry(0.15,20,14,0,Math.PI*2,0,1.65),hairM,0,0.155,-0.012,headPivot); hair.scale.set(0.92,1.05,0.98);
  if(dress){ const bun=part(new THREE.SphereGeometry(0.07,12,10),hairM,0,0.26,-0.1,headPivot); }
  // лицо: впалые глаза, нос, рот
  for(const side of [-1,1]){ const eye=part(new THREE.SphereGeometry(0.02,10,8),new THREE.MeshBasicMaterial({color:0x060606}),side*0.052,0.15,0.125,headPivot); eye.scale.set(1,1.35,0.5); }
  const nose=part(new THREE.ConeGeometry(0.018,0.05,8),skin,0,0.095,0.135,headPivot); nose.rotation.x=Math.PI/2-0.25;
  part(new THREE.BoxGeometry(0.05,0.008,0.01),new THREE.MeshStandardMaterial({color:0x4a3428,roughness:0.8}),0,0.045,0.132,headPivot);
  part(new THREE.CylinderGeometry(0.055,0.065,0.09,12),skin,0,0.0,0,headPivot); // шея
  g.userData.headPivot=headPivot;
  g.visible=false; scene.add(g); return g; }
const standing=makeFigure(false); standing.scale.set(1.15,1.18,1.15);
const hostess=makeFigure(true); hostess.userData.headPivot.rotation.z=0.62; hostess.userData.headPivot.position.x=0.1; // голова набок — сильнее, чем может живой человек
const doppel=makeFigure(false,0x39505f);
const cameraGhost=makeFigure(true); cameraGhost.visible=false;
// тапочки будут двигаться
let slipperStep=0;

// ================= СОСТОЯНИЕ =================
const S={ playing:false, stage:'prologue_book', night:0, sanity:100, battery:100, flashOn:false, tvOn:false, tv43On:false,
  flags:{openedWrong:0,peepholeBad:0,answeredSilent:0,silentOk:0,asked:0,burnChoice:false,signChoice:false,triedBurn:false},
  inv:new Set(), drawings:new Set(), doorKnock:null, survive:null, event:null, cameraMode:false, dead:false, startedAt:Date.now() };
const player={ pos:new THREE.Vector3(8,APT_Y,1.5), yaw:Math.PI, pitch:0, keys:{}, locked:false };
let standingActive=false, standingPos=new THREE.Vector3(0,3,-1), standingStepT=0, flickerBlackout=0, timeAcc=0, gameMinutes=17*60+42, peepholeHold=0, peepholeSessionBad=false, leaveTimer=0, doppelDone=false, globalT=0;

function refreshInv(){ const items=[]; if(S.inv.has('book'))items.push('📖 Домовая книга'); if(S.inv.has('camera'))items.push('📹 VHS-камера [V]'); if(S.inv.has('key43'))items.push('🗝 Ключ от 43'); if(S.inv.has('atticKey'))items.push('🗝 Ключ от чердака'); if(S.inv.has('matches'))items.push('🔥 Спички'); if(S.inv.has('bulb'))items.push('💡 Лампочка'); items.push(`🔦 ${Math.max(0,Math.round(S.battery))}%`); items.push(`✎ Рисунков Ани: ${S.drawings.size}/5`); invEl.innerHTML=items.map(i=>`<span class="inv">${i}</span>`).join(''); }
function setSanity(v){ S.sanity=THREE.MathUtils.clamp(v,0,100); sanityFill.style.width=S.sanity+'%'; sanityFill.style.background=S.sanity>55?'#8aa864':(S.sanity>25?'#c9a227':'#b33'); if(S.sanity<=0&&!S.dead) die('Ты слушал тишину слишком долго. Дом дослушал тебя.'); }
function objectives(t){ objText.textContent=t; }
const OBJECTIVES={
 prologue_book:'Осмотри квартиру бабушки. Найди домовую книгу (гостиная, у телевизора).',
 prologue_phone:'Позвони маме по дисковому телефону в гостиной.',
 prologue_sleep:'День подходит к концу. Ложись спать (кровать в спальне).',
 n1_breaker:'03:33. Во всём доме отключили свет. Спустись в подвал (ниже 1 этажа) и включи щиток в котельной.',
 n1_return:'Свет дали. Возвращайся в квартиру 47. Не смотри на Стоящего — пятись, глядя на него.',
 n1_knock:'Кто-то стучит. Решай сам: E — дверь, Q — глазок. Или молчи.',
 n1_sleep:'Ночь ещё не кончилась, но дом затих. Ложись спать.',
 n2_camera:'Найди старую VHS-камеру дедушки (кухня квартиры 47).',
 n2_mail:'Проверь почтовые ящики на 1 этаже. Кажется, там что-то оставили для тебя.',
 n2_apt43:'Открой квартиру 43 напротив. Она пуста с 1998 года… правда?',
 n2_tv:'В пустой квартире работает телевизор. Посмотри, что он показывает.',
 n2_return:'Возвращайся в 47-ю. И не беги по лестнице. Шум его привлекает.',
 n2_knock:'Три стука. Спокойных, по-соседски. Это тётя Люда. Тётя Люда умерла.',
 n2_sleep:'Ложись спать. Завтра будет хуже.',
 n3_phone:'Телефон звонит сам. Подними трубку.',
 n3_kolia:'Спустись к дяде Коле в 38-ю (1 этаж). Он обещал ключ от чердака.',
 n3_attic:'Поднимись на чердак (лестница выше 5 этажа) и проверь, заперта ли шестая дверь.',
 n3_return:'Возвращайся в квартиру 47.',
 n3_sleep:'Ложись спать.',
 n4_archive:'Подвал. Найди архив дома в котельной — документы 1947 и 1974 годов.',
 n4_choice:'У печи в котельной реши, что делать с домовой книгой.',
 n4_return:'Возвращайся в 47-ю. Трубы сегодня говорят громко.',
 n4_sleep:'Последняя ночь перед… чем-то. Ложись спать.',
 n5_survive:'Продержись с 03:33 до 06:00. Помни правила дома. Телевизор — от шагов сверху. На молчаливый стук — молчи.',
 final_stairs:'Над пятым этажом достроилась лестница. Поднимись.',
 final_door:'Одна дверь. Твой выбор. Без подсказок.',
};
function setStage(st){ S.stage=st; if(OBJECTIVES[st])objectives(OBJECTIVES[st]);
  if(st==='n1_return'||st==='n2_return'||st==='n4_return'){ activateStanding(0.6); }
  if(st==='n5_survive'){ S.survive={t:150,clock:3*60+33,next:8}; }
  if(st==='final_stairs'){ sixthGroup.visible=true; if(sixthGate.col)sixthGate.col.enabled=false; if(sixthGate.mesh)sixthGate.mesh.visible=false; objectives(OBJECTIVES.final_stairs); }
  refreshInv(); saveSilent(); }
function fade(cb){ fadeEl.style.opacity=1; setTimeout(()=>{ cb&&cb(); setTimeout(()=>fadeEl.style.opacity=0,350); },1250); }
function teleport(x,y,z,yaw){ player.pos.set(x,y,z); if(yaw!==undefined)player.yaw=yaw; player.pitch=0; }
function nightStart(nextStage,night,msg){ fade(()=>{ S.night=night; gameMinutes=3*60+33; setDay(false); teleport(15.5,APT_Y,3.2,Math.PI); standingActive=false; standing.visible=false; hostess.visible=false; setSanity(Math.min(100,S.sanity+45)); if(!door47.open)door47.setOpen(false); setStage(nextStage); subtitle(msg,6000); }); }
function setDay(day){ hemi.intensity=day?1.15:0.16; windowGlow.material.color.set(day?0xbfd4e8:0x141c26); lampLights.forEach(l=>l.intensity=day?0:5); if(day)lampLights.forEach(l=>l.intensity=0); timestampEl.style.opacity=day?0.5:0.9; }
function activateStanding(speedMul=1){ standingActive=true; standing.visible=true; standing.userData.speedMul=speedMul;
  // появляется на пролёте ниже/выше игрока, спиной
  standingPos.set(player.pos.x>5?0:player.pos.x, Math.max(-3,player.pos.y-3), player.pos.z>0?-1:1);
  const gy=groundYAt(standingPos.x,standingPos.z,player.pos.y-3); if(gy!==null)standingPos.y=gy; }
function die(reason){ if(S.dead)return; S.dead=true; scareSound(); $('jumpscare-text').textContent=reason; $('jumpscare').classList.remove('hidden'); document.exitPointerLock?.();
  setTimeout(()=>{ $('jumpscare').classList.add('hidden'); fade(()=>{ teleport(15.5,APT_Y,3.2,Math.PI); setSanity(65); standingActive=false; standing.visible=false; hostess.visible=false; S.dead=false; if(S.stage==='n5_survive')setStage('n5_survive'); subtitle('Ты просыпаешься в квартире 47. Руки дрожат. Ночь начинается сначала.',5500); canvas.requestPointerLock?.(); }); },2600); }
function saveSilent(){ try{ localStorage.setItem('fifth-floor-save',JSON.stringify({stage:S.stage,night:S.night,sanity:S.sanity,flags:S.flags,inv:[...S.inv],drawings:[...S.drawings]})); }catch(e){} }
function jumpscareAtDoor(){ scareSound(); hostess.visible=true; hostess.position.set(4.2,APT_Y,0); hostess.lookAt(player.pos.x,APT_Y,player.pos.z); setSanity(S.sanity-22); subtitle('Пустая площадка. Но что-то только что было здесь. И оно успело заглянуть внутрь.',5000); setTimeout(()=>hostess.visible=false,1800); }

// ---------- сохранения: проверка кнопки ----------
if(localStorage.getItem('fifth-floor-save')) $('btn-continue').classList.remove('hidden');

// ================= ВЗАИМОДЕЙСТВИЯ =================
function inApt(){ return player.pos.x>5.2&&player.pos.y>11&&player.pos.y<13.6&&Math.abs(player.pos.z)<7.2; }
function near(x,y,z,r=2.3){ return player.pos.distanceTo(new THREE.Vector3(x,y+1,z))<r; }
const RULES_TEXT=()=>`ПРАВИЛА ДОМА (почерк бабушки Веры)

1. После 23:00 не смотреть в глазок дольше трёх секунд.
2. Если стучат и молчат — это не к тебе. Не спрашивай «кто».
3. Если над тобой ходят после 03:33 — сразу включай телевизор.
4. Тёте Люде дверь не открывать. Тётя Люда умерла.
5. Себе дверь не открывать.
6. Чердак должен быть заперт. Всегда.

${S.night>=2?'— правило 4 зачёркнуто чужим почерком: «ОТКРЫВАТЬ. ЗАМЁРЗЛА.»\n  Это НЕ почерк бабушки.':''}
Найдено рисунков Ани: ${S.drawings.size}/5. Открыто чужих дверей: ${S.flags.openedWrong}. Нарушений глазка: ${S.flags.peepholeBad}.`;
const BOOK_TEXT=`ДОМОВАЯ КНИГА (выдержки)

1974. Дом сдан. Квартир — на одну семью меньше, чем было комнат в бараке.
1983. Умер жилец 12-й. Ночью считали двери. Появилось правило 1.
1991. Умер почтальон. Теперь считает он.
1998. Умерла Люда из 43-й. Появилось правило 4. Не открывать.
2000. Я держу договор, пока могу держать ручку. Обход каждую ночь:
с первого на пятый, считать двери, чердак заперт.
Если я умру — дом начнёт считать сам.
Димочка, если ты это читаешь — прости. И не подписывайся за меня.`;

addInteract({pos:[16.8,APT_Y,-5.2],r:2.6,label:()=>'E — телевизор',when:()=>true,fn:()=>{ S.tvOn=!S.tvOn; tvScreen.material=S.tvOn?new THREE.MeshBasicMaterial({color:0x9aa39a}):M.tv; if(tvNoiseGain)tvNoiseGain.gain.value=S.tvOn?0.035:0; if(S.event&&S.event.type==='footsteps'&&S.tvOn)resolveEvent(true); subtitle(S.tvOn?'Телевизор шипит. За его шумом не слышно, как ходят сверху.':'Тишина. В тишине дом слышит тебя лучше.'); }});
addInteract({pos:[11.2,APT_Y,-6.3],r:2.4,label:()=>'E — телефон',when:()=>inApt(),fn:()=>{
  if(S.stage==='prologue_phone'){ showDialog('ТЕЛЕФОН — МАМА','— Димочка, ты доехал? Не оставайся там надолго, продай эту квартиру и уезжай. И… слушай. Если ночью будут стучать — сначала посмотри, кто. Только недолго смотри, хорошо?',[{label:'— Хорошо, мам. (положить трубку)',fn:()=>{ setStage('prologue_sleep'); subtitle('День за окном гаснет. Дом скрипит, как скрипел в детстве.'); }}]); return; }
  if(S.stage==='n3_phone'||(S.event&&S.event.type==='phone')){ if(S.event&&S.event.type==='phone'){ resolveEvent(false); return; }
    showDialog('ТЕЛЕФОН — МАМА?','— Дима… я тебе вчера не звонила. Я вообще не могу до тебя дозвониться уже три дня. С этим номером что-то не так.\n\nКто тебе звонит от моего имени?',[{label:'( положить трубку )',fn:()=>{ setStage('n3_kolia'); subtitle('В трубке ещё секунду слышно чужое дыхание. Потом — гудки.'); }}]); return; }
  showDialog('ТЕЛЕФОН','Позвонить маме? Игра сохраняется только так — из квартиры 47.',[{label:'Позвонить маме (сохранить игру)',fn:()=>{ saveSilent(); subtitle('— Я скоро уеду, мам. Правда скоро. [Игра сохранена]'); }},{label:'Положить трубку',secondary:true,fn:()=>{}}]);
}});
addInteract({pos:[16.5,APT_Y,4.6],r:2.6,label:()=>'E — кровать',when:()=>true,fn:()=>{
  const sleepMap={prologue_sleep:()=>nightStart('n1_breaker',1,'НОЧЬ 1. «Первый этаж». 03:33. Свет погас во всём доме.'),
    n1_sleep:()=>nightStart('n2_camera',2,'НОЧЬ 2. «Второй и третий этаж». Дом сегодня просит проверить соседей.'),
    n2_sleep:()=>nightStart('n3_phone',3,'НОЧЬ 3. «Четвёртый этаж». Телефон звонит, хотя шнур… шнур на месте?'),
    n3_sleep:()=>nightStart('n4_archive',4,'НОЧЬ 4. «Подвал». Сегодня дом расскажет о себе сам.'),
    n4_sleep:()=>nightStart('n5_survive',5,'НОЧЬ 5. «Пятый этаж». Все придут проситься внутрь. По-человечески.')};
  if(sleepMap[S.stage])sleepMap[S.stage](); else subtitle(S.night===0?'Ещё день. Рано спать.':'Сейчас нельзя спать. Дом не отпустит.'); }});
addInteract({pos:[7.2,APT_Y,-5.2],r:2.2,label:()=>'E — кухня / камера',when:()=>true,fn:()=>{
  if(S.stage==='n2_camera'&&!S.inv.has('camera')){ S.inv.add('camera'); refreshInv(); showNote('VHS-КАМЕРА ДЕДУШКИ','Камера включается. В видоискателе квартира та же — но на стене коридора дверь, которой нет.\n\n[V] — смотреть через камеру. Камера видит то, чего не видит глаз. Батарейки садятся быстро.'); setStage('n2_mail'); }
  else subtitle('Пахнет старым маслом и пылью. На плите — кастрюля 1999 года. Лучше не открывать.'); }});
addInteract({pos:[14.5,APT_Y,-6.6],r:2.0,label:()=>'E — ковёр на стене / домовая книга',when:()=>true,fn:()=>{
  if(!S.inv.has('book')){ S.inv.add('book'); refreshInv(); showNote('ДОМОВАЯ КНИГА',BOOK_TEXT); if(S.stage==='prologue_book')setStage('prologue_phone'); }
  else showNote('ДОМОВАЯ КНИГА',BOOK_TEXT); }});
addInteract({pos:[18.6,APT_Y,1.2],r:2.0,label:()=>'E — шкаф',when:()=>true,fn:()=>{ subtitle('В шкафу пахнет нафталином и бабушкиными платьями. Здесь можно спрятаться. Пока дом не научился открывать шкафы.'); setSanity(S.sanity+4); }});
addInteract({pos:[7.4,APT_Y,5.6],r:2.0,label:()=>'E — ванная (вода)',when:()=>true,fn:()=>{ subtitle('Вода из крана шумит ровно и по-человечески. Тишина отступает.'); setSanity(S.sanity+6); if(S.event&&S.event.type==='crying')resolveEvent(true); }});
// стена с плачем
addInteract({pos:[10.2,APT_Y,3.5],r:1.8,label:()=>'E — слушать стену',when:()=>S.night>=1,fn:()=>{ setSanity(S.sanity-8); subtitle('За стеной плачет ребёнок. Соседей с ребёнком на этаже нет. Плач начинает повторять… твои мысли.',6000); speak(''); }});

// дверь 47
addInteract({pos:[5.1,APT_Y,0],r:2.2,label:()=>door47.open?'E — закрыть дверь 47':'E — дверь квартиры 47',when:()=>true,fn:()=>{
  if(S.doorKnock){ doorChoiceDialog(); return; }
  if(S.event&&(S.event.type==='silentKnock'||S.event.type==='hostessKnock'||S.event.type==='intercom')){ resolveEvent(false); door47.setOpen(true); setTimeout(()=>{ hostess.visible=true; hostess.position.set(5.8,APT_Y,0); },400); setTimeout(()=>hostess.visible=false,2200); return; }
  door47.setOpen(!door47.open); stepSound(0.4); if(door47.open&&inApt()&&S.night>=1)subtitle('Дверь открыта. Подъезд смотрит в квартиру.'); }});
// дверь 43
addInteract({pos:[-5.1,APT_Y,0],r:2.2,label:()=>'E — квартира 43 (тётя Люда)',when:()=>true,fn:()=>{
  if(!S.inv.has('key43')){ subtitle('Заперто. Изнутри квартиры 43 пахнет щами. Там никто не живёт с 1998 года.'); knock(1); return; }
  door43.setOpen(!door43.open); if(door43.open&&S.stage==='n2_apt43')setStage('n2_tv'); }});
// телевизор 43
addInteract({pos:[-11.6,APT_Y,0],r:2.4,label:()=>'E — телевизор в 43-й',when:()=>player.pos.x<-5,fn:()=>{
  S.tv43On=!S.tv43On; tv43s.material=S.tv43On?new THREE.MeshBasicMaterial({color:0xa8b3a0}):M.tv;
  if(S.stage==='n2_tv'&&S.tv43On){ showDialog('ТЕЛЕВИЗОР — ПРОГНОЗ ПОГОДЫ','Ведущая спокойно смотрит в камеру:\n\n«…а завтра в нашем городе ожидается один покойник. В доме на улице Строителей, 13. Хорошего вам вечера».\n\nОна называет завтрашнюю дату. И улыбается — лично тебе.',[{label:'Выключить и уйти',fn:()=>{ setStage('n2_return'); subtitle('За твоей спиной телевизор снова включился. Сам.'); }}]); }
  else subtitle('По экрану идёт прогноз погоды. На вчера. На завтра. На день, которого ещё не было.'); }});
addInteract({pos:[-8,APT_Y,2],r:2,label:()=>'E — лампочка (взять)',when:()=>player.pos.x<-5&&!S.inv.has('bulb'),fn:()=>{ S.inv.add('bulb'); S.battery=Math.min(100,S.battery+60); refreshInv(); subtitle('Ты выкрутил лампочку в 43-й. Теперь там совсем темно. А у тебя — светлее. Так здесь и живут: свет один на всех.'); }});
// дядя Коля 38
addInteract({pos:[5.1,0,0],r:2.2,label:()=>'E — квартира 38 (дядя Коля)',when:()=>player.pos.y<1.5,fn:()=>{
  if(S.stage!=='n3_kolia'&&!S.inv.has('atticKey')){ subtitle('Дверь 38-й. За ней тишина. дядя Коля по домофону говорил, что он дома. По домофону.'); return; }
  door38.setOpen(!door38.open); }});
addInteract({pos:[10,0,1.5],r:2.4,label:()=>'E — осмотреть дядю колю…',when:()=>player.pos.x>5&&player.pos.y<1.5,fn:()=>{
  if(!S.inv.has('atticKey')){ S.inv.add('atticKey'); refreshInv(); showDialog('КВАРТИРА 38','дядя Коля сидит у стола. Судя по календарю, еде и газетам — мёртв уже неделю.\n\nВ его руке — ключ от чердака. Ты забираешь его.\n\nВопрос, на который нет ответа: кто разговаривал с тобой по домофону первые две ночи?',[{label:'Забрать ключ и выйти',fn:()=>{ setStage('n3_attic'); subtitle('На лестнице сверху уже стоит… ты. Не здоровайся. Не смотри в глаза.'); spawnDoppel(); }}]); }
  else subtitle('Он всё ещё сидит. Дом бережёт своих.'); }});
// подвал: щиток, архив, печь
addInteract({pos:[6,-3,-3.6],r:2.4,label:()=>'E — электрический щиток',when:()=>player.pos.y<-2,fn:()=>{
  if(S.stage==='n1_breaker'){ setStage('n1_return'); lampLights.forEach(l=>l.intensity=4); subtitle('Щёлк. Свет вернулся в подъезд. Где-то наверху начали считать двери: «…сорок пятая… сорок шестая…»'); speak('сорок седьмая'); }
  else subtitle('Счётчик крутится. Быстро. Хотя свет в доме почти нигде не горит. Он считает не киловатты.'); }});
addInteract({pos:[8,-3,3],r:2.4,label:()=>'E — архив дома',when:()=>player.pos.y<-2,fn:()=>{
  if(S.stage==='n4_archive'){ S.inv.add('matches'); refreshInv(); showDialog('АРХИВ ДОМА','1947 год. Барак. Одна ночь, закрытая печная заслонка, шесть человек — «как будто спали».\n\n1974 год. На этом месте строят пятиэтажку. Комнат в бараке было шесть. Квартир для той семьи — ни одной.\n\nДом всё это время пытается достроить недостающее. Ему нужен шестой этаж. И жильцы для него.\n\nРядом лежат спички.',[{label:'Взять спички и идти наверх',fn:()=>setStage('n4_choice')}]); }
  else subtitle('Папки, акты, списки жильцов. В списке умерших фамилии дописаны… завтрашним числом.'); }});
addInteract({pos:[13,-3,0],r:2.6,label:()=>'E — печь котельной',when:()=>player.pos.y<-2,fn:()=>{
  if(S.stage==='n4_choice'){ showDialog('ПЕЧЬ','Домовая книга в твоих руках вдруг стала тёплой. Как будто у неё есть температура тела.',[
    {label:'🔥 Сжечь домовую книгу сейчас',fn:()=>{ S.flags.triedBurn=true; subtitle('Книга не горит. Страницы только чернеют по краям и шепчут. Дому мало одного огня — ему нужно, чтобы его забыли. Все.',6500); setStage('n4_return'); }},
    {label:'Не сжигать. Пока рано',secondary:true,fn:()=>{ subtitle('Ты убираешь книгу. Печь разочарованно гудит трубами.'); setStage('n4_return'); }}]); }
  else subtitle('Печь тёплая. В ней что-то стучит. Ритмично. Как сердце. Или как в дверь — три раза.'); }});
// почтовые ящики
addInteract({pos:[-2,0,-2.6],r:2.4,label:()=>'E — почтовые ящики',when:()=>player.pos.y<1.5&&player.pos.x<4,fn:()=>{
  if(S.stage==='n2_mail'&&!S.inv.has('key43')){ S.inv.add('key43'); refreshInv(); showNote('ПОЧТОВЫЙ ЯЩИК 43','В ящике умершей тёти Люды — ключ от её квартиры и записка бабушкиным почерком:\n\n«Дима. Если дом попросит проверить соседей — проверяй. Но дверь 43-й за собой закрывай. Она любит, когда открыто».'); setStage('n2_apt43'); }
  else subtitle('Вскрыты только ящики тех жильцов, которые уже умерли. Твой ящик 47-й… тоже вскрыт. Изнутри.'); }});
// правила и рисунки
addInteract({pos:[4.8,APT_Y,1.7],r:1.8,label:()=>'E — лист на стене: ПРАВИЛА ДОМА',when:()=>player.pos.y>11,fn:()=>showNote('ПРАВИЛА ДОМА',RULES_TEXT())});
drawingPos.forEach((p,i)=>{ addInteract({pos:[p[0],p[1]-1.35,p[2]],r:1.7,label:()=>'E — рисунок Ани (мелом)',when:()=>!S.drawings.has(i),fn:()=>{ S.drawings.add(i); refreshInv(); const txt=['Аня, 7 лет, кв. 51. Дом на рисунке — с шестью этажами. В окнах шестого — люди.','Второй рисунок. Людей в окнах шестого этажа стало больше.','Третий. Аня нарисовала подъезд. На лестнице стоит высокий дядя. Спиной.','Четвёртый. В одном из окон шестого этажа — ты. Она нарисовала тебя точно.','Пятый рисунок — прямо в твоей прихожей. Дверь 47 открыта. За ней — лестница наверх.'][i]; showNote(`РИСУНОК АНИ ${S.drawings.size}/5`,txt+'\n\nАня — единственный человек в доме, который с самого начала всё видит честно.'); }}); });
// ворота чердака и шестая дверь
addInteract({pos:[-1,APT_Y,3.2],r:2.2,label:()=>'E — лестница на чердак',when:()=>player.pos.y>11&&player.pos.z>2,fn:()=>{
  if(S.stage==='final_stairs'||S.stage==='final_door'){ return; }
  if(!S.inv.has('atticKey')){ subtitle('Чердак заперт. Всегда должен быть заперт. Правило 6. За замком кто-то… дышит?'); return; }
  if(sixthGate.col&&sixthGate.col.enabled){ sixthGate.col.enabled=false; sixthGate.mesh.visible=false; sixthGroup.visible=true; subtitle('Замок открывается легко. Слишком легко для замка, который не открывали 40 лет.'); }
}});
addInteract({pos:[0,15,-2.6],r:2.4,label:()=>'E — шестая дверь',when:()=>player.pos.y>14,fn:()=>{
  if(S.stage==='n3_attic'){ showNote('ШЕСТАЯ ДВЕРЬ','За дверью — детские вещи семьи из 1947 года. И сама дверь. Без номера.\n\nТы не открываешь. Ты просто стоишь и слушаешь, как за ней шесть человек спят. Ровно дышат. В такт.\n\nЧердак «заперт недостаточно хорошо». С этой ночи дом знает, что ты его заметил.'); setStage('n3_return'); return; }
  if(S.stage==='final_stairs')setStage('final_door');
  if(S.stage==='final_door'){ finalChoice(); return; }
  subtitle('Дверь без номера. За ней тихо. Слишком тихо даже для тишины.'); }});
function finalChoice(){ const d=S.drawings.size, clean=S.flags.openedWrong===0&&S.flags.peepholeBad===0;
  showDialog('ШЕСТАЯ ДВЕРЬ','За дверью стоит Жилец Шестого Этажа. Его лицо меняется: бабушка… тётя Люда… дядя Коля… ты.\n\n— У нас есть для тебя квартира. Наверху. Бесплатно. Навсегда. Все, кого ты любил, уже там. Надо только… согласиться.\n\nИгра не подскажет, какая кнопка правильная. Как и дом.',[
   {label:'Открыть дверь и согласиться',fn:()=>ending('C')},
   {label:'Подписать домовую книгу — занять место бабушки',fn:()=>{ S.flags.signChoice=true; ending('B'); }},
   {label:S.inv.has('matches')?'Сжечь домовую книгу':'Сжечь домовую книгу (нет спичек)',fn:()=>ending(d>=4&&clean?'D':'A')},
   {label:'Сесть на лестнице и просто ждать утра',secondary:true,fn:()=>ending('A')}]); }
function ending(code){ S.playing=false; document.exitPointerLock?.(); const E={
  A:['A','«УЕХАЛ»','Ты уезжаешь утренним автобусом. Камера остаётся в пустой квартире 47.\n\nТишина.\n\nВ дверь стучат три раза. Спокойно, по-соседски.\n\nК глазку изнутри квартиры подходит… ты. Ты уже внутри. Ты уже жилец дома.\n\nДому не хватило одного человека. Теперь хватает.'],
  B:['B','«СТАРШИЙ ПО ПОДЪЕЗДУ»','Ты подписываешь домовую книгу и принимаешь договор. Живые в безопасности — пока ты жив и делаешь ночной обход.\n\nПроходит 40 лет.\n\nМолодой парень приезжает в квартиру умершего дедушки. Ночь. 03:33. Дверь открывается, и старый Дима выходит считать двери:\n\n«…сорок пятая… сорок шестая… сорок седьмая…»'],
  C:['C','«ШЕСТОЙ ЭТАЖ»','Ты открываешь дверь.\n\nУтро. Дом снаружи — как всегда: пять этажей, двор, бабки у подъезда.\n\nТолько если очень внимательно посчитать окна пятого этажа — их стало на одно больше.\n\nВ новом окне, если долго смотреть, стоишь ты. И смотришь вниз. И ждёшь.'],
  D:['D','«СНОС» — секретная','Ты сжигаешь домовую книгу вместе с ключами от всех пустых квартир. Дом, собранный из памяти умерших, умирает — потому что его больше некому помнить и некому держать его правила.\n\nФинальный звук — обычные шаги обычных живых людей по обычной лестнице. Днём.\n\nВпервые за всю игру это не страшно. И именно от этого — мурашки сильнее всего.']}[code];
  $('ending-letter').textContent='КОНЦОВКА '+E[0]+' ИЗ 4'; $('ending-title').textContent=E[1]; $('ending-text').textContent=E[2];
  $('ending-stats').textContent=`Ночей пережито: ${S.night} · Рисунков Ани: ${S.drawings.size}/5 · Чужих дверей открыто: ${S.flags.openedWrong} · Нарушений правила глазка: ${S.flags.peepholeBad} · Молчаливых стуков пережито молча: ${S.flags.silentOk}\nПосле титров не выключай игру сразу. В главном меню иногда сам включается телевизор…`;
  $('ending').classList.remove('hidden'); hud.classList.add('hidden'); scareSound(); }
$('btn-restart').onclick=()=>location.reload();
function spawnDoppel(){ if(doppelDone)return; doppelDone=true; doppel.visible=true; doppel.position.set(player.pos.x>0?-1:1,Math.max(0,player.pos.y),player.pos.z+4); doppel.lookAt(player.pos.x,doppel.position.y,player.pos.z); setTimeout(()=>{ if(!doppelDone)return; },0); }
// диалоги стука в дверь
function doorChoiceDialog(){ const k=S.doorKnock; if(!k)return;
  const who=k.type==='grandma'?'ГОЛОС ЗА ДВЕРЬЮ':'ТЁТЯ Люда — КВАРТИРА 43';
  showDialog(who,k.text,[{label:'ОТКРЫТЬ ДВЕРЬ',fn:()=>{ door47.setOpen(true); S.flags.openedWrong++; jumpscareAtDoor(); endKnock(); }},
   {label:'Спросить: «Кто там?»',fn:()=>{ S.flags.asked++; subtitle(k.type==='grandma'?'— Димочка, это я, баба Вера. Я ключи забыла. Открой, внучек.':'— Димочка, это тётя Люда. У меня сахар закончился. И свет вырубили. Я в темноте стою, мне страшно.',6000); speak(k.type==='grandma'?'Димочка, открой. Это я.':'Димочка, открой, а?'); leaveTimer=6; }},
   {label:'Молчать и не подходить',secondary:true,fn:()=>{ S.flags.silentOk++; leaveTimer=8; subtitle('Ты не дышишь. За дверью тоже не дышат. Потом — шаги. Медленные. Вниз по лестнице. Она уходит. В этот раз.'); }}]); }
function endKnock(){ S.doorKnock=null; if(S.stage==='n1_knock')setStage('n1_sleep'); if(S.stage==='n2_knock')setStage('n2_sleep'); }
function startKnock(type){ S.doorKnock={type,text:type==='grandma'?'Стук. Три раза. Спокойно, по-соседски.\n\nИ голосом умершей бабушки:\n\n«Димочка, открой. Это я».':'Стук. Три раза.\n\n«Димочка, это тётя Люда, у меня сахар закончился, открой, а?»\n\nТётя Люда умерла в 1998 году. Ты был на её похоронах. Тебе было 9, и ты всё помнишь.'};
  knock(3); speak(type==='grandma'?'Димочка, открой. Это я.':'Димочка, открой, а?'); subtitle(type==='grandma'?'«Димочка, открой. Это я».':'«Димочка, это тётя Люда… открой, а?»',6000);
  hostess.visible=true; hostess.position.set(3.4,APT_Y,0); hostess.lookAt(5,APT_Y,0); }
// события 5-й ночи
function startEvent(){ const types=['footsteps','silentKnock','phone','hostessKnock','crying']; const type=types[Math.floor(Math.random()*types.length)]; S.event={type,t:14};
  if(type==='footsteps'){ S.tvOn=false; tvScreen.material=M.tv; if(tvNoiseGain)tvNoiseGain.gain.value=0; subtitle('Над тобой ходят. Шестого этажа нет. Правило 3: ВКЛЮЧИ ТЕЛЕВИЗОР.',6000); stepSound(0.5); }
  if(type==='silentKnock'){ knock(3); subtitle('Стучат. И молчат. Правило 2: это не к тебе. Не спрашивай. Не открывай. Молчи.',6000); hostess.visible=true; hostess.position.set(3.4,APT_Y,0); }
  if(type==='phone'){ ring(); subtitle('Телефон звонит. Мама сказала: она не может дозвониться уже три дня. Тогда кто это?',6000); }
  if(type==='hostessKnock'){ knock(3); speak('Димочка, открой'); subtitle('«Димочка, у меня свет вырубили, я замёрзла в подъезде…» Правило 4. НЕ ОТКРЫВАТЬ.',6000); hostess.visible=true; hostess.position.set(3.4,APT_Y,0); }
  if(type==='crying'){ subtitle('За стеной плачет ребёнок. Включи воду в ванной — не слушай тишину.',6000); } }
function resolveEvent(ok){ if(!S.event)return; const t=S.event.type; S.event=null; hostess.visible=false;
  if(ok){ setSanity(S.sanity+5); subtitle('…Затихло. Дом отступил. Ненадолго.',3500); if(t==='silentKnock'||t==='hostessKnock')S.flags.silentOk++; }
  else { setSanity(S.sanity-18); scareSound(); subtitle('Ты ошибся. Дом запомнил твою ошибку. Он вообще всё запоминает.',5000); if(t==='phone')subtitle('В трубке — твой собственный голос: «Не верь себе. Следующий раз я позвоню лучше».',5500); }
  if(S.survive)S.survive.next=9; }

// ================= УПРАВЛЕНИЕ =================
addEventListener('keydown',e=>{ player.keys[e.code]=true;
  if(e.code==='Tab'){ e.preventDefault(); if(S.playing)showNote('ДОМОВАЯ КНИГА И ПРАВИЛА',RULES_TEXT()+'\n\n— — —\n'+BOOK_TEXT); }
  if(e.code==='KeyF'&&S.playing){ S.flashOn=!S.flashOn; }
  if(e.code==='KeyV'&&S.playing&&S.inv.has('camera')){ S.cameraMode=!S.cameraMode; camera.fov=S.cameraMode?52:72; camera.updateProjectionMatrix(); subtitle(S.cameraMode?'REC ● Камера видит лишнее. Смотри, пока не начал кашлять.':'Камера выключена.'); }
  if(e.code==='KeyE'&&S.playing&&currentInteract){ currentInteract.fn(); }
});
addEventListener('keyup',e=>player.keys[e.code]=false);
document.addEventListener('mousemove',e=>{ if(!player.locked||!S.playing||!dialogEl.classList.contains('hidden'))return; player.yaw-=e.movementX*0.0022; player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*0.0022,-1.35,1.35); });
document.addEventListener('pointerlockchange',()=>{ player.locked=document.pointerLockElement===canvas; if(!player.locked&&S.playing&&dialogEl.classList.contains('hidden')&&$('note-modal').classList.contains('hidden')&&$('ending').classList.contains('hidden'))$('pause').classList.remove('hidden'); else $('pause').classList.add('hidden'); });
canvas.addEventListener('click',()=>{ if(S.playing&&!player.locked)canvas.requestPointerLock(); });
$('btn-resume').onclick=()=>{ $('pause').classList.add('hidden'); canvas.requestPointerLock(); };
$('btn-quit').onclick=()=>location.reload();
$('btn-how').onclick=()=>$('how').classList.toggle('hidden');
$('btn-start').onclick=()=>{ initAudio(); if(AC&&AC.state==='suspended')AC.resume(); startGame(false); };
$('btn-continue').onclick=()=>{ initAudio(); startGame(true); };
function startGame(load){ $('menu').classList.add('hidden'); hud.classList.remove('hidden'); S.playing=true; setDay(true); canvas.requestPointerLock();
  if(load){ try{ const d=JSON.parse(localStorage.getItem('fifth-floor-save')); if(d){ S.stage=d.stage; S.night=d.night; S.sanity=d.sanity; S.flags=Object.assign(S.flags,d.flags); S.inv=new Set(d.inv); S.drawings=new Set(d.drawings); drawingMeshes.forEach((m,i)=>{ if(S.drawings.has(i))m.visible=false; });
    if(S.night>0){ setDay(false); gameMinutes=3*60+33; } setStage(S.stage); setSanity(S.sanity); if(S.stage==='n1_knock')startKnock('grandma'); if(S.stage==='n2_knock')startKnock('lyuda'); subtitle('Сохранение загружено. Дом тебя ждал. Он умеет ждать.',5000); } }catch(e){} }
  else { setStage('prologue_book'); subtitle('Май 2000 года. Бабушка умерла неделю назад. Квартира 47, пятый этаж. Забери документы, переночуй — и утром уезжай.',8000); }
  refreshInv(); }

// ================= ЦИКЛ =================
let currentInteract=null, last=performance.now(), lampFlickerT=0;
function fmtTime(){ const h=Math.floor(gameMinutes/60)%24,m=Math.floor(gameMinutes%60); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
function animate(){ requestAnimationFrame(animate); const now=performance.now(); let dt=Math.min(0.05,(now-last)/1000); last=now; globalT+=dt;
  if(S.playing&&!S.dead){
    const listening=player.keys['ControlLeft']||player.keys['ControlRight'];
    const dialogOpen=!dialogEl.classList.contains('hidden')||!$('note-modal').classList.contains('hidden');
    // движение
    let speed=listening||dialogOpen?0:(player.keys['ShiftLeft']?3.7:2.15);
    const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)), right=new THREE.Vector3(-fwd.z,0,fwd.x);
    const mv=new THREE.Vector3(); if(!dialogOpen){ if(player.keys['KeyW'])mv.add(fwd); if(player.keys['KeyS'])mv.sub(fwd); if(player.keys['KeyD'])mv.add(right); if(player.keys['KeyA'])mv.sub(right); }
    if(mv.lengthSq()>0){ mv.normalize().multiplyScalar(speed*dt);
      const tryMove=(dx,dz)=>{ const nx=player.pos.x+dx,nz=player.pos.z+dz; let blocked=false;
        for(const c of colliders){ if(!c.enabled)continue; if(player.pos.y+1.6<c.y1||player.pos.y>c.y2)continue; const ex=0.32; if(nx>c.x1-ex&&nx<c.x2+ex&&nz>c.z1-ex&&nz<c.z2+ex){blocked=true;break;} }
        if(!blocked){ const gy=groundYAt(nx,nz,player.pos.y); if(gy!==null||Math.abs(player.pos.y-(groundYAt(player.pos.x,player.pos.z,player.pos.y)??player.pos.y))<0.01){ player.pos.x=nx; player.pos.z=nz; if(gy!==null)player.pos.y+=(gy-player.pos.y)*Math.min(1,dt*10); } } };
      tryMove(mv.x,0); tryMove(0,mv.z);
      if(speed>3&&Math.random()<dt*3)stepSound(0.12);
    }
    // камера: дыхание, дрожь от страха
    const fear=(100-S.sanity)/100, bob=Math.sin(globalT*(mv.lengthSq()>0?7:1.4))*0.02*(mv.lengthSq()>0?1:0.4);
    camera.position.set(player.pos.x,player.pos.y+1.62+bob+Math.sin(globalT*13)*0.004*fear,player.pos.z);
    camera.rotation.order='YXZ'; camera.rotation.y=player.yaw; camera.rotation.x=player.pitch+Math.sin(globalT*9)*0.003*fear; camera.rotation.z=Math.sin(globalT*0.7)*0.002;
    playerLight.position.copy(camera.position); playerLight.intensity=S.night===0?0.4:0.25;
    // фонарь
    if(S.flashOn&&S.battery>0){ S.battery-=dt*0.45; flash.intensity=26; const dir=new THREE.Vector3(); camera.getWorldDirection(dir); flash.position.copy(camera.position); flash.target.position.copy(camera.position).add(dir.multiplyScalar(6)); if(Math.random()<dt*2)refreshInv(); }
    else flash.intensity=0;
    if(S.battery<=0&&S.flashOn){ S.flashOn=false; subtitle('Батарейки фонаря сели. Свет теперь — только лампочки подъезда. Которые кто-то выкручивает.'); refreshInv(); }
    // лампочки мерцают
    lampFlickerT-=dt; if(lampFlickerT<0){ lampFlickerT=0.08+Math.random()*0.3; const base=S.night===0?0:(S.stage==='n1_breaker'?0:4.5); lampLights.forEach((l,i)=>l.intensity=base*(0.82+Math.random()*0.35)); if(Math.random()<0.012)flickerBlackout=0.12; }
    if(flickerBlackout>0){ flickerBlackout-=dt; lampLights.forEach(l=>l.intensity=0); }
    // время
    timeAcc+=dt; if(timeAcc>4){ timeAcc=0; gameMinutes+=S.night===0?1:2; }
    timestampEl.textContent=`${S.night===0?'23':'2'+(2+S.night)}.05.2000  ${fmtTime()}${S.cameraMode?'  ● REC':''}`; clockEl.textContent=fmtTime();
    // глазок
    const peepKey=player.keys['KeyQ']; const nearDoor=inApt()&&near(5.1,APT_Y,0,1.6);
    if(peepKey&&nearDoor){ $('peephole').classList.remove('hidden'); peepholeHold+=dt;
      const ent=$('peephole-entity'), txt=$('peephole-text');
      if(S.doorKnock||(S.event&&S.event.hostessKnock)){ ent.textContent='👁'; ent.style.opacity=0.95; ent.style.fontSize='240px'; txt.textContent='Она смотрит в глазок в ответ. Она знает, что ты смотришь.'; }
      else if(hostess.visible){ ent.textContent='🧍‍♀️'; ent.style.opacity=0.8; ent.style.fontSize='150px'; txt.textContent='На площадке стоит тётя Люда. Голова наклонена сильнее, чем может живой человек.'; }
      else { ent.style.opacity=0; txt.textContent='Пустая площадка. Зелёная краска. Тишина. Только слышно дыхание. Прямо за дверью.'; }
      if(peepholeHold>3&&!peepholeSessionBad){ peepholeSessionBad=true; S.flags.peepholeBad++; setSanity(S.sanity-12); scareSound(); subtitle('Ты смотрел дольше трёх секунд. Теперь дом знает, как ты выглядишь изнутри глазка. (нарушений: '+S.flags.peepholeBad+')',5500); refreshInv(); }
    } else { $('peephole').classList.add('hidden'); if(!peepKey){ peepholeHold=0; peepholeSessionBad=false; } }
    // слушать (Ctrl)
    if(listening&&S.playing){ let hint='Тишина… Слышно: гул труб, далёкое радио за стеной, своё сердце.';
      if(standingActive)hint=`Ты слышишь шаги. Стоящий сейчас примерно на высоте ${Math.round(standingPos.y/3)+1}-го этажа. ${speed>3?'':''}Он ближе, когда ты не смотришь.`;
      if(S.doorKnock||hostess.visible&&player.pos.y>11)hint='За дверью кто-то стоит. Не дышит. Ждёт, пока ты спросишь «кто там». Не спрашивай.';
      if(S.event&&S.event.type==='footsteps')hint='Шаги — прямо над тобой. Этажом выше. Которого нет.';
      listenEl.textContent=hint; listenEl.classList.remove('hidden'); } else listenEl.classList.add('hidden');
    // Стоящий
    if(standingActive&&standing.visible){ standing.position.copy(standingPos); standing.position.y=standingPos.y;
      // стоит спиной к игроку
      standing.lookAt(player.pos.x,standingPos.y,player.pos.z); standing.rotateY(Math.PI);
      const toS=standingPos.clone().sub(player.pos); const dist=toS.length();
      const lookDir=new THREE.Vector3(); camera.getWorldDirection(lookDir); const looking=dist<24&&lookDir.dot(toS.clone().normalize())>0.82;
      const inDark=flickerBlackout>0;
      if(!looking||inDark){ const sp=(0.55*(standing.userData.speedMul||1))*(flickerBlackout>0?2.2:1); const dir=toS.multiplyScalar(-1).normalize();
        // не входит в квартиру
        const nx=standingPos.x+dir.x*sp*dt, nz=standingPos.z+dir.z*sp*dt;
        if(!(nx>4.6&&standingPos.y>11)){ standingPos.x=nx; standingPos.z=nz; const gy=groundYAt(nx,nz,standingPos.y); if(gy!==null)standingPos.y+=(gy-standingPos.y)*Math.min(1,dt*6); }
        standingStepT-=dt; if(standingStepT<0){ standingStepT=0.55; if(dist<14)stepSound(0.1+ (14-dist)*0.02); } }
      if(dist<1.15)die('Ты моргнул. Он стоял за спиной. Стоящий не бежит — он просто однажды оказывается рядом.');
      if(dist<6)setSanity(S.sanity-dt*(looking?1.2:3.2)); }
    // Двойник
    if(doppel.visible){ const d=doppel.position.distanceTo(player.pos); doppel.lookAt(player.pos.x,doppel.position.y,player.pos.z);
      if(d<2.6){ doppel.visible=false; setSanity(S.sanity-10); subtitle('Вы молча разошлись. Он не улыбнулся. Значит, сегодня в 47-ю возвращаться… можно. Наверное.',6000); if(S.stage==='n3_kolia')setStage('n3_attic'); } }
    // призрак через камеру
    cameraGhost.visible=S.cameraMode&&S.night>=2&&inApt(); if(cameraGhost.visible){ cameraGhost.position.set(13,APT_Y,-1); cameraGhost.lookAt(player.pos.x,APT_Y,player.pos.z); if(Math.random()<dt*0.5)setSanity(S.sanity-2); }
    // тишина в квартире вредит ночью, телевизор лечит
    if(S.night>=1&&inApt()&&!S.tvOn)setSanity(S.sanity-dt*0.55); if(S.tvOn&&inApt())setSanity(S.sanity+dt*0.8);
    // триггеры этажей/квартиры
    if(S.stage==='n1_breaker'&&player.pos.y<6&&!standingActive){ activateStanding(0.7); subtitle('На пролёте между этажами кто-то стоит. Спиной. Не двигается, пока ты смотришь.'); }
    if((S.stage==='n1_return'||S.stage==='n2_return'||S.stage==='n4_return')&&inApt()){ standingActive=false; standing.visible=false; door47.setOpen(false);
      if(S.stage==='n1_return')setStage('n1_knock'),startKnock('grandma'); else if(S.stage==='n2_return')setStage('n2_knock'),startKnock('lyuda'); else setStage('n4_sleep'); }
    if(leaveTimer>0){ leaveTimer-=dt; if(leaveTimer<=0){ hostess.visible=false; endKnock(); } }
    // 5 ночь
    if(S.stage==='n5_survive'&&S.survive){ S.survive.t-=dt; gameMinutes=3*60+33+(150-S.survive.t)*(147/150);
      // тапочки ползут
      slipperStep+=dt; if(slipperStep>25){ slipperStep=0; slippers.position.x-=0.35; }
      if(!S.event){ S.survive.next-=dt; if(S.survive.next<=0)startEvent(); }
      else { S.event.t-=dt; if(S.event.t<=0){ const passive=(S.event.type==='silentKnock'||S.event.type==='hostessKnock'||S.event.type==='phone'); resolveEvent(passive); } }
      objectives(`Продержись до 06:00. Сейчас ${fmtTime()}. ${S.event?'Что-то происходит… помни правила.':'Пока тихо. Слишком тихо.'}`);
      if(S.survive.t<=0){ S.event=null; hostess.visible=false; setStage('final_stairs'); fade(()=>{ subtitle('06:00. Рассвет не наступил. Но над пятым этажом… достроился пролёт. Лестница, которой нет на плане дома.',7000); }); } }
    if(S.stage==='final_stairs'&&player.pos.y>14.4)setStage('final_door');
    // подсказка взаимодействия
    currentInteract=null; let best=1e9;
    for(const it of interactables){ if(it.when&&!it.when())continue; const p=new THREE.Vector3(it.pos[0],it.pos[1]+1,it.pos[2]); const d=p.distanceTo(player.pos); if(d<it.r&&d<best){ const look=new THREE.Vector3(); camera.getWorldDirection(look); if(look.dot(p.clone().sub(camera.position).normalize())>0.25||d<1.2){ best=d; currentInteract=it; } } }
    if(currentInteract&&!dialogOpen){ interactEl.textContent=typeof currentInteract.label==='function'?currentInteract.label():currentInteract.label; interactEl.classList.remove('hidden'); } else interactEl.classList.add('hidden');
  }
  if(dustPoints){ dustPoints.rotation.y+=dt*0.004; }
  composer.render();
}
// отладочный доступ (для автоскриншотов/демо)
window.__fifth={ S, player, scene, camera, setStage, setDay, activateStanding, startKnock, teleport, standingPos, standing, hostess, doppel, sixthGroup, setSanity, door47, nightStart, subtitle };
animate();
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); });
