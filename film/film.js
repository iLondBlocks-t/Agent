// ZOMBIES REELS — "ماذا لو اختفى البشر وأصبحوا زومبي؟"
// 60s vertical (1080x1920) 3D stickman film. One street world + one cafe world with fixed positions;
// every shot is only a camera on those worlds. All art drawn from code. SFX-only mix (audio_mix.py).
import * as T from 'three';
import {clamp,lerp,ease,seg,kf,mesh,mat,Person,makeRenderer,makePost,HERO,WOMAN,STRANGER,ANK} from './lib3d.js';
import {makeCafe,makeStreet,table3,chair3,cup3,blob,walk3} from './world3d.js';

const FPS=30,DUR_=60,W_=1080,H_=1920;
const CUTS=[0,135,225,330,390,495,615,720,840,945,1050,1155,1245,1365,1485,1590,1695,1800];

const R=makeRenderer(),post=makePost(R);
const scA=new T.Scene(),street=makeStreet(scA);   // street world
const scB=new T.Scene(),cafe=makeCafe(scB);       // cafe world

// dark ground outside the cafe door so figures out there have footing against the painted street
{
  const g=new T.Mesh(new T.PlaneGeometry(26,7),mat('#2C2346',{form:0}));
  g.rotation.x=-Math.PI/2;g.position.set(0,0,-6.5);scB.add(g);
}

// ---- characters ------------------------------------------------------------
const heroS=new Person(scA,HERO),heroC=new Person(scB,HERO);
const wman=new Person(scA,WOMAN),str=new Person(scA,STRANGER);
const ZA={skin:'#CFC8D8',cloth:'#4A4266',hood:'#3A3450',face:'#17141F',leg:'#2E2A44',shoe:'#17141F',coat:true};
const ZB={skin:'#C2C9D2',cloth:'#39565C',hood:'#2A4146',face:'#17141F',leg:'#262238',shoe:'#0f0d15',coat:true};
const ZC={skin:'#D6CCD2',cloth:'#5A4A66',hood:'#453A52',face:'#17141F',leg:'#2C2A49',shoe:'#17141F'};
const zom=[ZA,ZB,ZC,ZA,ZB,ZC,ZB].map(c=>new Person(scA,c));
const zdoor=new Person(scB,ZB),zwin=new Person(scB,ZA);

// ---- blob shadows ----------------------------------------------------------
const mkBlob=sc=>blob(sc,1.15,.55);
const bHS=mkBlob(scA),bW=mkBlob(scA),bST=mkBlob(scA),bZ=zom.map(()=>mkBlob(scA));
const bHC=mkBlob(scB),bZD=mkBlob(scB),bZW=mkBlob(scB);

// ---- props -----------------------------------------------------------------
const cupFall=cup3(scA,.1,1.0,-3.4);                 // dropped where the woman vanished
table3(scB,-1.0,1.4,.5,.76);chair3(scB,-1.78,1.55,Math.PI/2);cup3(scB,-.95,.785,1.32);
// warm sheen across the door glass (the pane itself is a real hole in the leaf)
const sheen=new T.Mesh(new T.PlaneGeometry(.95,.9),new T.MeshBasicMaterial({color:'#FFD6A0',transparent:true,opacity:.13,depthWrite:false}));
sheen.position.set(-.63,1.51,.032);cafe.door.add(sheen);
// lever handle that turns during the rattle insert
const lever=mesh(new T.CylinderGeometry(.017,.017,.17,10),mat('#E9B872'));
lever.position.set(-1.09,1.02,.05);cafe.door.add(lever);

// ---- walks (one world, fixed positions, distance-locked feet) --------------
const wHero=walk3({pts:[[-3.2,-2.8],[1.0,-2.8]],t0:.2,t1:5.4,stride:.62});
const wW=walk3({pts:[[4.6,-3.4],[.1,-3.4]],t0:0,t1:7.45,stride:.58});
const wS=walk3({pts:[[.4,-4.8],[.4,-2.1]],t0:.5,t1:7.45,stride:.6});
const wRun=walk3({pts:[[1.0,-2.8],[2.4,-2.8],[3.6,-1.8],[5.6,1.4]],t0:20.8,t1:25.0,stride:.95});
const wEnter=walk3({pts:[[3.866,-4.8],[3.866,-3.2],[3.2,-2.3],[2.75,-1.75]],t0:23.8,t1:27.4,stride:.72});
const wHide=walk3({pts:[[2.6,-1.6],[1.8,-1.0],[1.5,-.5],[1.2,-.2]],t0:35.2,t1:36.9,stride:.7});
const wRun2=walk3({pts:[[-4.6,.5],[-2.4,.5],[-.4,.6],[1.6,.7],[3.4,.9],[4.4,.6],[4.8,-.2]],t0:45.55,t1:52.8,stride:.95});
const zPts=[
 [[-2.8,-5.2],[-2.5,-3.7],[-2.2,-2.3],[-2.0,-1.3]],
 [[-.9,-5.4],[-.7,-3.9],[-.5,-2.5],[-.4,-1.6]],
 [[1.5,-5.0],[1.4,-3.7],[1.3,-2.5],[1.3,-1.7]],
 [[-4.8,-3.8],[-4.5,-2.9],[-4.2,-2.0],[-4.0,-1.3]],
 [[.6,-4.9],[.7,-3.7],[.8,-2.7],[.9,-2.0]],
 [[2.7,-4.4],[2.8,-3.3],[2.9,-2.4],[2.9,-1.8]],
 [[-1.6,-5.6],[-1.4,-4.5],[-1.2,-3.6],[-1.0,-2.9]]
];
const zT0=[8,10,9,15,17,12,19];
const zW=zPts.map((p,i)=>walk3({pts:p,t0:zT0[i],t1:34,stride:.5}));
const wZwin=walk3({pts:[[2.0,-4.6],[-.6,-4.6]],t0:35.4,t1:38.4,stride:.6});
const wZapp=walk3({pts:[[3.72,-6.5],[3.72,-5.0],[3.72,-3.5]],t0:29,t1:31.6,stride:.42});
const wZdoor=walk3({pts:[[3.72,-3.5],[3.72,-3.0],[3.5,-2.75]],t0:40.6,t1:42.6,stride:.42});

// ---- helpers ---------------------------------------------------------------
const bl=(t,l)=>{for(const b of l)if(t>b&&t<b+.16)return Math.sin((t-b)/.16*Math.PI);return 0};
let REP=null;
function rep(P,name,p,walking){
  const o=P.pose(p);
  if(REP){const x=p.pos[0],z=p.pos[2];
    REP.people[name]={x:x*100,y:z*100,s:100,face:p.face||1,walk:!!walking,
      hand:{l:[o.l.hand.x-x,o.l.hand.z-z],r:[o.r.hand.x-x,o.r.hand.z-z]},world:null}}
  return o;
}
// zombie shamble: reaching arms, pale angry face, constant sway so a stopped walker still lives
function zpose(P,name,w,t,ph){
  const yaw=w.yaw,Fx=Math.sin(yaw),Fz=Math.cos(yaw),Sx=Math.cos(yaw),Sz=-Math.sin(yaw);
  const sw=Math.sin(t*1.35+ph);
  return rep(P,name,{pos:w.pos,yaw,lean:.13+sw*.035,breath:t*1.5+ph,feet:w.feet,
    hands:{l:[w.x+Fx*.46+Sx*.24,1.10+sw*.035,w.z+Fz*.46+Sz*.24],
           r:[w.x+Fx*.44-Sx*.24,1.06-sw*.035,w.z+Fz*.44-Sz*.24]},
    pole:{l:[w.x-Fx*.16+Sx*.14,.74,w.z-Fz*.16+Sz*.14],
          r:[w.x-Fx*.16-Sx*.14,.72,w.z-Fz*.16-Sz*.14]},
    hand:{l:'fist',r:'fist'},
    hy:Math.sin(t*.7+ph)*.12,hp:.07,hr:.06+sw*.02,
    face:{mouth:-.48-.12*sw,brow:-.26,sad:.5,look:.1,blink:0}},w.walking);
}
// door angle over time (rattle, crack, hold)
function doorAng(t){
  if(t<25.1)return 0;
  if(t<25.6)return ease(seg(t,25.1,25.6))*1.9;
  if(t<26.8)return 1.9;
  if(t<27.4)return lerp(1.9,0,ease(seg(t,26.8,27.4)));
  if(t<38.7)return 0;
  if(t<39.35)return Math.sin((t-38.7)*22)*.035*(1-seg(t,38.7,39.35));
  if(t<40.3)return 0;
  if(t<40.95)return Math.sin((t-40.3)*22)*.035*(1-seg(t,40.3,40.95));
  if(t<42.0)return 0;
  if(t<43.0)return ease(seg(t,42.0,43.0))*.5;
  if(t<43.7)return .5;
  if(t<44.7)return lerp(.5,.62,ease(seg(t,43.7,44.7)));
  return .62;
}
function leverAng(t){
  if(t>38.72&&t<39.6)return ease(seg(t,38.72,38.95))*.95-ease(seg(t,39.15,39.6))*.95;
  if(t>40.32&&t<41.2)return ease(seg(t,40.32,40.55))*.95-ease(seg(t,40.75,41.2))*.95;
  return 0;
}

// ---- street hero -----------------------------------------------------------
function heroStreet(t){
  const spin=kf(t,[[7.55,0],[8.15,1]]),turn2=kf(t,[[20.4,0],[20.9,1]]);
  let w,yaw;
  if(t<20.8){w=wHero.at(t);yaw=lerp(Math.PI/2,4.13,spin)}
  else if(t<24.5){w=wRun.at(t);yaw=lerp(lerp(Math.PI/2,4.13,spin),Math.PI/2,turn2)}
  else{w=wRun2.at(t);yaw=w.yaw}
  const p={pos:w.pos,yaw,lean:.04+Math.sin(t*1.7)*.012,breath:t*2.1,feet:w.feet,hands:w.hands,
    pole:{l:[w.x-.2,.8,w.z+.15],r:[w.x+.2,.8,w.z+.15]},
    hy:kf(t,[[7.3,0],[7.5,.35],[8.15,-.1],[16.6,-.1],[19.5,.25],[20.4,.1]]),
    hp:kf(t,[[11.4,0],[12.0,.22],[13.0,.1],[13.4,.05]]),
    face:{mouth:kf(t,[[0,.45],[12.8,.45],[13.5,-.1],[14.4,-.25],[16.4,-.2],[20.4,-.35]]),
      brow:kf(t,[[0,.1],[13.2,.1],[14.3,.5],[20.4,.65]]),
      sad:kf(t,[[0,0],[13.4,0],[14.6,-.45],[20.4,-.5]]),
      look:kf(t,[[0,.2],[7.3,.2],[8.2,-.35],[11.4,-.3],[12.2,-.1],[13.4,-.2],[16.5,-.1],[20.4,.2]]),
      lookY:kf(t,[[11.4,0],[12.1,-.35],[13.0,-.2],[13.4,0]]),
      blink:bl(t,[1.7,4.6,9.8,12.4,15.1,18.6])}};
  return rep(heroS,'hero',p,w.walking);
}
// ---- cafe hero -------------------------------------------------------------
function heroCafe(t){
  const w=t<35.2?wEnter.at(t):wHide.at(t);
  const pivot=kf(t,[[27.5,0],[28.7,1]]),turn3=kf(t,[[36.9,0],[37.7,1]]);
  const yaw=t<35.2?lerp(Math.atan2(-.45,.55),2.416,pivot):lerp(-.785,2.38,turn3);
  const crouch=t<36.9?.72:lerp(.72,.48,ease(seg(t,36.9,37.5)));
  const kd=ease(seg(t,37.0,37.7)),hs=w.hands,hands={};
  for(const k of ['l','r']){
    const knee=[w.x+(k=='l'?.17:-.17),.56,w.z+.3];
    hands[k]=[lerp(hs[k][0],knee[0],kd),lerp(hs[k][1],knee[1],kd),lerp(hs[k][2],knee[2],kd)];
  }
  const p={pos:[w.pos[0],crouch,w.pos[2]],yaw,lean:(t<36.9?.05:lerp(.05,.16,kd))+Math.sin(t*2.2)*.012,
    breath:t*(t<36.9?2.4:3.2),feet:w.feet,hands,
    pole:{l:[w.x-.22,.8,w.z+.1],r:[w.x+.22,.8,w.z+.1]},
    hy:kf(t,[[28.7,0],[29.1,.12],[29.6,-.06],[31.6,0],[32.1,.5],[33.4,.42],[35.2,.2]]),
    hp:kf(t,[[28.7,0],[29.1,-.06],[31.5,0],[32.2,-.04],[35.2,0],[36.9,0],[37.6,.14]]),
    face:{mouth:kf(t,[[24,.3],[27.4,.1],[29.3,.3],[30.2,.1],[31.6,.15],[32.4,-.1],[35.2,-.15],[37.6,-.3]]),
      brow:kf(t,[[24,.2],[27.5,.35],[29.3,.6],[30.3,.4],[31.6,.7],[32.4,.85],[35.2,.8],[37.6,.9]]),
      sad:kf(t,[[24,0],[28.7,-.15],[32.4,-.4],[37.6,-.5]]),
      look:kf(t,[[24,0],[29.3,.1],[31.8,.25],[33.2,.2],[35.2,.1],[37.7,.3]]),
      blink:bl(t,[25.4,28.9,30.7,33.8,35.9,38.1])}};
  return rep(heroC,'hero',p,w.walking);
}
// ---- the face at the glass, then the hand at the door ----------------------
function zdoorState(t){
  let w,y;
  if(t<29){w={pos:[3.72,.18,-6.5],yaw:0,x:3.72,z:-6.5,walking:false,
      feet:{l:[3.85,ANK,-6.5],r:[3.59,ANK,-6.5]}};y=.18}
  else if(t<31.7){w=wZapp.at(t);y=.18}
  else if(t<40.6){w={pos:[3.72,.18,-3.5],yaw:0,x:3.72,z:-3.5,walking:false,
      feet:{l:[3.85,ANK,-3.5],r:[3.59,ANK,-3.5]}};
    y=lerp(.18,.72,ease(seg(t,31.7,32.8)))}
  else{w=wZdoor.at(t);y=.72}
  const grip=ease(seg(t,43.0,43.55));
  const ang=doorAng(t),ex=4.496-1.26*Math.cos(ang),ez=-2.98+1.26*Math.sin(ang);
  const yaw=w.yaw,Fx=Math.sin(yaw),Fz=Math.cos(yaw),Sx=Math.cos(yaw),Sz=-Math.sin(yaw);
  const reach=[w.x+Fx*.44-Sx*.24,1.06,w.z+Fz*.44-Sz*.24];
  const rh=[lerp(reach[0],ex,grip),lerp(1.06,1.0,grip),lerp(reach[2],ez,grip)];
  const p={pos:[w.pos[0],y,w.pos[2]],yaw,lean:.14+Math.sin(t*1.2)*.03,breath:t*1.6,feet:w.feet,
    hands:{l:[w.x+Fx*.40+Sx*.25,1.12,w.z+Fz*.40+Sz*.25],r:rh},
    pole:{l:[w.x-Fx*.15+Sx*.13,.75,w.z-Fz*.15+Sz*.13],
          r:[w.x-Fx*.15-Sx*.14,.72,w.z-Fz*.15-Sz*.14]},
    hand:{l:'fist',r:'fist'},
    hy:Math.sin(t*.8)*.08,hp:t<32.9?lerp(.42,.06,ease(seg(t,31.7,32.9))):.06,hr:.05,
    face:{mouth:t<33?lerp(-.1,-.5,ease(seg(t,31.9,33))):-.5,brow:-.28,sad:.6,look:.05,blink:0}};
  const o=rep(zdoor,'zdoor',p,w.walking);
  if(grip>.9&&REP)REP.contacts.push(['zd-hand',[rh[0]*100,rh[2]*100],[ex*100,ez*100]]);
  return o;
}

// ---- cameras (portrait: close, centered, safe band y 230..1536) -----------
function camOf(s,u,t){
  switch(s){
  case 0:{const hx=wHero.at(t).x;return{p:[hx-1.0,1.45,2.9],l:[hx+.55,1.0,-2.7],fov:38,focus:5.6,ap:.10}}
  case 1:return{p:[2.9,1.5,1.45],l:[.7,.75,-2.9],fov:33,focus:4.6,ap:.30};
  case 2:return{p:[lerp(-.5,-.1,u),1.6,lerp(4.8,3.9,ease(u))],l:[lerp(.75,.45,u),1.0,-2.8],fov:42,focus:6.8,ap:.14};
  case 3:return{p:[lerp(1.4,1.05,ease(u)),lerp(.82,.66,ease(u)),lerp(-1.3,-1.78,ease(u))],l:[.15,.14,-3.3],fov:30,focus:2.0,ap:.45};
  case 4:return{p:[lerp(-1.9,-1.65,ease(u)),1.5,lerp(-4.65,-4.3,ease(u))],l:[1.0,1.48,-2.78],fov:27,focus:3.0,ap:.50};
  case 5:return{p:[-.6,1.5,lerp(2.6,2.1,ease(u))],l:[-.7,1.02,-4.6],fov:36,focus:lerp(7.4,6.4,u),ap:.18};
  case 6:return{p:[3.0,1.6,4.3],l:[lerp(1.6,3.4,ease(u)),.83,-1.4],fov:36,focus:5.4,ap:.20};
  case 7:return{p:[-.7,1.6,lerp(3.7,3.3,ease(u))],l:[3.35,1.12,-2.5],fov:40,focus:5.8,ap:.16};
  case 8:return{p:[-.9,1.5,lerp(2.75,2.4,ease(u))],l:[3.3,1.15,-2.5],fov:37,focus:5.4,ap:.18};
  case 9:return{p:[1.9,1.62,lerp(.45,.12,ease(u))],l:[3.5,1.18,-2.7],fov:31,focus:lerp(7.5,6.4,u),ap:.45};
  case 10:return{p:[.5,1.5,4.6],l:[.45,1.02,-1.2],fov:40,focus:4.6,ap:.28};
  case 11:return{p:[2.9,1.25,-.75],l:[3.45,1.27,-2.9],fov:29,focus:2.4,ap:.50};
  case 12:return{p:[1.5,1.55,1.7],l:[3.5,.85,-2.6],fov:34,focus:4.4,ap:.22};
  case 13:{const hx=wRun2.at(t).x;return{p:[hx-2.6,2.1,4.6],l:[hx+.7,.20,-1.0],fov:37,focus:5.4,ap:.18}}
  case 14:return{p:[-.4,lerp(3.3,3.05,ease(u)),lerp(5.4,4.9,ease(u))],l:[-.2,.50,-2.6],fov:42,focus:8,ap:.12};
  case 15:return{p:[6.3,1.7,1.5],l:[1.8,1.0,-2.5],fov:33,focus:5.5,ap:.45};
  default:return{p:[.1,lerp(2.0,1.9,ease(u)),lerp(7.4,6.5,ease(u))],l:[0,1.12,-3],fov:47,focus:9,ap:.12};
  }
}

// ---- the frame -------------------------------------------------------------
window.renderAt=t=>{
  t=clamp(t,0,DUR_-1/60);const f=Math.round(t*FPS);
  let s=0;for(let i=0;i<CUTS.length-1;i++)if(f>=CUTS[i])s=i;
  const u=(f-CUTS[s])/(CUTS[s+1]-CUTS[s]);
  const inStreet=s<7||s>=13;
  REP={t,f,sh:s,people:{},contacts:[],sym:0};
  let sc;

  if(inStreet){
    sc=scA;street.rain(t);
    wman.g.visible=str.g.visible=bW.visible=bST.visible=t<7.45;
    if(t<7.45){
      const qw=wW.at(t),qs=wS.at(t);
      rep(wman,'wman',{pos:qw.pos,yaw:qw.yaw,lean:.03,breath:t*2,feet:qw.feet,hands:qw.hands,
        face:{mouth:.4,brow:.1,sad:0,look:.1,blink:bl(t,[2.2,5.1])}},qw.walking);
      rep(str,'str',{pos:qs.pos,yaw:qs.yaw,lean:.05,breath:t*2.2+1,feet:qs.feet,hands:qs.hands,
        face:{mouth:-.1,brow:-.3,sad:.2,look:-.15,blink:bl(t,[3.4,6.2])}},qs.walking);
      bW.position.set(qw.x,0,qw.z);bST.position.set(qs.x,0,qs.z);
    }
    heroStreet(t);
    zom.forEach((P,i)=>{
      P.g.visible=bZ[i].visible=t>=16.4;
      if(P.g.visible){const ws=zW[i].at(t);zpose(P,'z'+i,ws,t,i*1.7);bZ[i].position.set(ws.x,0,ws.z)}
    });
    const hw=t<20.8?wHero.at(t):(t<24.5?wRun.at(t):wRun2.at(t));
    bHS.position.set(hw.x,0,hw.z);
    // the dropped cup: hidden until it falls right after the cut, then lies in the rain
    cupFall.visible=t>=7.52;
    if(cupFall.visible){
      const fall=seg(t,7.52,7.94);
      cupFall.position.y=fall<1?lerp(1.0,.045,fall*fall):.045+.09*Math.sin(Math.PI*seg(t,7.94,8.30));
      cupFall.position.x=lerp(.1,.24,ease(seg(t,7.6,8.6)));
      cupFall.rotation.z=lerp(0,1.47,ease(seg(t,7.6,8.3)));
      cupFall.rotation.y=lerp(0,.6,ease(seg(t,7.6,8.6)));
    }
  }else{
    sc=scB;cafe.rain(t);
    heroCafe(t);
    zdoor.g.visible=bZD.visible=t>=27.5;
    if(zdoor.g.visible)zdoorState(t);
    zwin.g.visible=bZW.visible=t>=35.3&&t<=38.9;
    if(zwin.g.visible){const qw=wZwin.at(t);zpose(zwin,'zwin',qw,t,3.3);bZW.position.set(qw.x,0,qw.z)}
    cafe.pendants.forEach((G,i)=>{
      let a=Math.sin(t*1.05+i*1.7)*.05;
      if(t>31.62)a+=.10*Math.sin((t-31.62)*7)*Math.exp(-(t-31.62)*2.2);
      G.rotation.z=a;
    });
    cafe.door.rotation.y=doorAng(t);
    lever.rotation.z=leverAng(t);
    const hw=t<35.2?wEnter.at(t):wHide.at(t);
    bHC.position.set(hw.x,0,hw.z);
    const zw=t<29?{x:3.72,z:-6.5}:(t<40.6?wZapp.at(t):wZdoor.at(t));
    bZD.position.set(zw.x,0,zw.z);
  }

  // camera + post
  const C=camOf(s,u,t);
  cam.fov=C.fov;cam.position.set(...C.p);cam.lookAt(...C.l);cam.updateProjectionMatrix();
  post.P.focus.value=C.focus;post.P.ap.value=C.ap;post.P.time.value=f*.137%17;
  post.P.fade.value=Math.max(1-seg(t,0,.5),seg(t,DUR_-.6,DUR_-.03));
  post.render(sc,cam);
  const st=REP;REP=null;return st;
};
const cam=new T.PerspectiveCamera(40,W_/H_,.05,60);

// ---- sound timeline (same clock as the picture) ----------------------------
say(7.45,'vanish');
say(7.94,'drop');say(8.28,'drop2');
say(13.4,'groan',{pan:-.45});say(15.9,'groan',{pan:.4});say(19.4,'groan',{pan:-.2});say(20.15,'groan',{pan:.3});
say(25.05,'latch');say(25.12,'doorburst');say(25.62,'doorstop');say(26.8,'doorclose');say(27.42,'latch');
say(29.3,'cloth1');say(30.4,'cloth2');
say(31.62,'knock');say(32.2,'moanNear');say(35.6,'scratch');
say(38.72,'rattle');say(40.32,'rattle');
say(41.9,'creak');say(43.7,'pull');say(44.6,'moanGap');
say(49.9,'groan',{pan:-.3});say(53.6,'groan',{pan:.5});say(56.7,'chorus');

window.CUTF=CUTS;window.DUR=DUR_;
window.PLANTS={
  hero:[...wHero.plants(),...wRun.plants(),...wRun2.plants()],
  heroC:[...wEnter.plants(),...wHide.plants()],
  wman:wW.plants().filter(x=>x<7.45),
  str:wS.plants().filter(x=>x<7.45),
  zA:zW[0].plants().filter(x=>x>16.4&&x<46),
  zB:zW[1].plants().filter(x=>x>16.4&&x<46),
  zC:zW[2].plants().filter(x=>x>16.4&&x<46),
  zapp:wZapp.plants()
};
window.EVENTS=EVENTS;window.READY=true;
