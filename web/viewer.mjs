import * as THREE from 'three';
import {sampleHumanoid,modelSpaceGaze} from './humanoid.mjs';

const $ = id => document.getElementById(id);
const catalog = await fetch('/catalog.json').then(r=>r.json());
const exportSettings = await fetch('/app/export-settings.json').then(r=>r.json());
const core = ['idle','running-right','running-left','waving','jumping','failed','waiting','running','review'];
const labels = {idle:'待机', 'running-right':'向右跑','running-left':'向左跑',waving:'招呼',jumping:'庆祝',failed:'失落',waiting:'等待',running:'思考',review:'完成',walk:'散步',dance:'跳舞',clap:'鼓掌',nod:'点头','shake-head':'摇头',doze:'打瞌睡',yawn:'哈欠',peace:'比耶',laugh:'笑',surprise:'惊讶',angry:'生气'};
const canvas=$('preview');
const renderer = new THREE.WebGLRenderer({canvas, alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(384,416,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-.6,.6,.7,-.7,.01,50);
const group = new THREE.Group();scene.add(group);
const chairData=await fetch('/props/chair.json').then(r=>r.json());
const chairGeometry=new THREE.BufferGeometry();
chairGeometry.setAttribute('position',new THREE.Float32BufferAttribute(chairData.positions.flat(),3));
chairGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(chairData.uv.flat(),2));
chairGeometry.setIndex(chairData.indices);
const chairTexture=await new THREE.TextureLoader().loadAsync('/props/'+chairData.texture);
chairTexture.colorSpace=THREE.SRGBColorSpace;
const chair=new THREE.Mesh(chairGeometry,new THREE.MeshBasicMaterial({map:chairTexture,side:THREE.DoubleSide}));
const chairAnchor=new THREE.Vector3(...chairData.characterAnchor),upAxis=new THREE.Vector3(0,1,0);
chair.visible=false;scene.add(chair);
Object.assign(labels,{'sit-down':'坐下','seated-sleep':'坐椅休息','stand-up':'起身'});
let current, data, nodes=[], meshes=[], byHash=new Map(), animations=new Map(), state='idle', elapsed=0, busy=false, pointer=null;
let last=performance.now();
const textureLoader = new THREE.TextureLoader();
const eyeByName = new Map(catalog.eyePatterns.map(p=>[p.PatternName,p]));
const mouthByName = new Map(catalog.mouthPatterns.map(p=>[p.Name,p]));
for(const c of catalog.characters){const o=document.createElement('option');o.value=c.id;o.textContent=c.displayName;$('character').append(o)}
$('count').textContent=`26 人 · ${catalog.characters.length} 个版本`;

function disposeModel(){group.clear();for(const m of meshes){m.geometry.dispose();for(const mat of m.material){mat.map.dispose();mat.dispose()}}meshes=[]}
async function loadCharacter(id){
  $('status').textContent='正在加载角色…';
  current=catalog.characters.find(c=>c.id===id);$('character').value=id;
  data=await fetch('/'+current.scene).then(r=>r.json());
  disposeModel();
  nodes=data.nodes.map(n=>{const b=new THREE.Bone();b.name=n.name;b.position.fromArray(n.position);b.quaternion.fromArray(n.rotation);b.scale.fromArray(n.scale);return b});
  byHash=new Map(data.nodes.map((n,i)=>[n.hash,nodes[i]]));
  data.nodes.forEach((n,i)=>(n.parent>=0?nodes[n.parent]:group).add(nodes[i]));
  const base='/'+current.scene.slice(0,current.scene.lastIndexOf('/')+1);
  for(const m of data.meshes){
    const geo=new THREE.BufferGeometry();
    for(const [target,key,size,Type]of [['position','positions',3,Float32Array],['normal','normals',3,Float32Array],['uv','uv',2,Float32Array],['skinIndex','joints',4,Uint16Array],['skinWeight','weights',4,Float32Array]])geo.setAttribute(target,new THREE.BufferAttribute(new Type(m[key].flat()),size));
    geo.setIndex(m.submeshes.flat());let offset=0;m.submeshes.forEach((a,i)=>{geo.addGroup(offset,a.length,i);offset+=a.length});
    const materials=await Promise.all(m.materials.map(async mat=>{
      const map=await textureLoader.loadAsync(base+mat.texture);map.colorSpace=THREE.SRGBColorSpace;
      map.wrapS=map.wrapT=THREE.RepeatWrapping;
      const result=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});result.userData.face=mat.face;return result;
    }));
    const mesh=new THREE.SkinnedMesh(geo,materials);
    const skeleton=new THREE.Skeleton(m.bones.map(i=>nodes[i]),m.inverseBindMatrices.map(a=>new THREE.Matrix4().fromArray(a)));
    group.updateMatrixWorld(true);mesh.bind(skeleton,new THREE.Matrix4());mesh.frustumCulled=false;group.add(mesh);meshes.push(mesh);
  }
  for(const name of new Set(Object.values(current.states).flatMap(s=>s.sequence??[s.clip])))if(!animations.has(name))animations.set(name,await fetch('/animations/'+name+'.json').then(r=>r.json()));
  state='idle';elapsed=0;pose(state,0);group.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(group);const height=box.max.y-box.min.y;
  // MMJ Miku's long, animated twin tails need additional lateral clearance.
  const viewHeight=height*(current.unitId===28?1.80:1.48), cy=box.min.y+height*1.48*.45;
  camera.left=-viewHeight*192/208/2;camera.right=-camera.left;camera.top=viewHeight/2;camera.bottom=-camera.top;
  camera.position.set(0,cy+height*.08,height*4);camera.lookAt(0,cy,0);camera.updateProjectionMatrix();
  $('name').textContent=current.displayName;$('detail').textContent=`${current.model} · ${Object.keys(current.states).length} 种动作 · JP 7.0.0.15`;
  buildButtons();$('status').textContent='选择动作检查原生动画；3D 视线仅供素材预览。';renderer.render(scene,camera);
}
const qa=new THREE.Quaternion(),qb=new THREE.Quaternion();
function pose(key,time,gazeAngle=null,frame=null){
  const spec=current.states[key], sequence=spec.sequence??[spec.clip];
  let t=time%stateDuration(key), a=animations.get(sequence.at(-1));
  for(const name of sequence){a=animations.get(name);if(t<a.duration)break;t-=a.duration}
  data.nodes.forEach((n,i)=>{nodes[i].position.fromArray(n.position);nodes[i].quaternion.fromArray(n.rotation);nodes[i].scale.fromArray(n.scale)});
  const sample=Math.max(0,t)/a.duration*(a.samples-1), lhs=Math.floor(sample),rhs=Math.min(lhs+1,a.samples-1),mix=sample-lhs;
  if(data.humanoid && a.humanoid)sampleHumanoid(data.humanoid,a.humanoid,nodes,data.nodes,lhs,rhs,mix);
  for(const track of a.tracks){const bone=byHash.get(track.path);if(!bone)continue;const l=track.values[lhs],r=track.values[rhs];
    if(track.attribute===2){qa.fromArray(l);qb.fromArray(r);bone.quaternion.slerpQuaternions(qa,qb,mix)}
    else {const target=track.attribute===1?bone.position:bone.scale;target.set(...l.map((v,i)=>v+(r[i]-v)*mix))}
  }
  group.rotation.y=spec.yaw??(+($('angle').value)*Math.PI/180);
  if(spec.prop==='chair')group.rotation.y+=Math.PI;
  group.position.set(0,0,0);
  if(spec.prop==='chair')group.position.copy(chairAnchor).applyAxisAngle(upAxis,group.rotation.y);
  chair.visible=spec.prop==='chair';chair.rotation.y=group.rotation.y;
  let eye=eyeByName.get(spec.eye??'normal')??eyeByName.get('normal');
  const mouth=mouthByName.get(spec.mouth??'smile01')??mouthByName.get('smile01');
  if(gazeAngle!==null){
    const yaw=Math.sin(gazeAngle)*.48,pitch=-Math.cos(gazeAngle)*.30;
    modelSpaceGaze(nodes[data.spine],pitch*.1,yaw*.15);
    modelSpaceGaze(nodes[data.head],pitch,yaw);
    eye=eyeByName.get(Math.sin(gazeAngle)>.3?'normal_r':Math.sin(gazeAngle)<-.3?'normal_l':'normal');
  }
  const blink=gazeAngle===null&&eye.BlinkEnabled&&(frame!==null?key==='idle'&&frame===4:time%3.8>3.55);
  const eyeIndex=blink?eye.CloseEyeIndex:eye.OpenEyeIndex;
  const mouthIndex=mouth.CloseLipSyncIndex;
  for(const mesh of meshes)for(const mat of mesh.material){
    const type=mat.userData.face;if(!type)continue;
    const i=(type==='eye'?eyeIndex:mouthIndex)-1;
    mat.map.offset.set((i%4)*.25,-Math.floor(i/4)*(type==='eye'?.125:.25));
  }
  group.updateMatrixWorld(true);
}
function stateDuration(key){return (current.states[key].sequence??[current.states[key].clip]).reduce((sum,n)=>sum+animations.get(n).duration,0)}
function buildButtons(){
  $('states').replaceChildren();$('extras').replaceChildren();
  for(const key of Object.keys(current.states)){const b=document.createElement('button');b.disabled=busy;b.textContent=labels[key]??key.replace('special-','专属 · ');b.dataset.state=key;b.setAttribute('aria-pressed',key===state?'true':'false');b.onclick=()=>{state=key;elapsed=0;pointer=null;document.querySelectorAll('[data-state]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.state===state?'true':'false'))};(core.includes(key)?$('states'):$('extras')).append(b)}
}
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!busy&&current&&animations.has(current.states[state].clip)){
  if(!$('pause').checked)elapsed+=dt;
  let angle=null;if($('gaze').checked&&state==='idle'&&pointer)angle=Math.atan2(pointer.x,-pointer.y);
  pose(state,elapsed,angle);renderer.render(scene,camera);
}requestAnimationFrame(frame)}
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer={x:e.clientX-r.x-r.width/2,y:e.clientY-r.y-r.height*.32}});
canvas.addEventListener('pointerleave',()=>pointer=null);
$('character').onchange=async()=>{busy=true;document.querySelectorAll('button,select').forEach(el=>el.disabled=true);try{await loadCharacter($('character').value)}finally{busy=false;document.querySelectorAll('button,select').forEach(el=>el.disabled=false)}};

async function save(canvas,name){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Canvas capture failed');const r=await fetch(`/api/capture/${current.id}/${name}.png`,{method:'POST',body:blob});if(!r.ok)throw Error('Capture failed: '+r.status)}
async function captureEnhanced(keys=Object.keys(current.states)){
  $('angle').value='0';pointer=null;
  const {fps,width,height,supersample,columns,framesPerPage,revision}=exportSettings;
  renderer.setSize(width*supersample,height*supersample,false);
  for(const key of keys){
    const duration=key==='idle'?4:stateDuration(key),count=Math.max(2,Math.ceil(duration*fps));
    const meta={revision,fps,width,height,columns,framesPerPage,count,duration,pages:Math.ceil(count/framesPerPage)};
    const endpoint=`/api/capture/${current.id}/actions-hd/${key}.json`;
    const previous=await fetch(endpoint,{cache:'no-store'});
    if(previous.ok && JSON.stringify(await previous.json())===JSON.stringify(meta))continue;
    for(let page=0;page<meta.pages;page++){
      const start=page*framesPerPage,n=Math.min(framesPerPage,count-start);
      const sheet=document.createElement('canvas');sheet.width=columns*width;sheet.height=Math.ceil(n/columns)*height;
      const context=sheet.getContext('2d');context.imageSmoothingQuality='high';
      for(let j=0;j<n;j++){
        pose(key,duration*(start+j)/count);renderer.render(scene,camera);
        context.drawImage(renderer.domElement,j%columns*width,Math.floor(j/columns)*height,width,height);
      }
      $('status').textContent=`${current.displayName} · ${key} · ${page+1}/${meta.pages} · ${width}×${height} / ${fps} fps`;
      await save(sheet,`actions-hd/${key}-${String(page).padStart(3,'0')}`);
      sheet.width=sheet.height=1;
    }
    const saved=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(meta)});
    if(!saved.ok)throw Error('Capture metadata failed: '+saved.status);
  }
  renderer.setSize(384,416,false);
}
async function captureAction(all){
  busy=true;document.querySelectorAll('button,select').forEach(el=>el.disabled=true);
  try{const list=all?catalog.characters:[current];for(let i=0;i<list.length;i++){
    if(current.id!==list[i].id)await loadCharacter(list[i].id);
    await captureEnhanced();
  }
  $('status').textContent=`已导出 ${list.length} 个模型的 384×416 / 60 fps 动作。`;
  }catch(e){$('status').textContent=e.message;console.error(e)}finally{busy=false;document.querySelectorAll('button,select').forEach(el=>el.disabled=false)}
}
$('capture-enhanced').onclick=()=>captureAction(true);
$('capture-enhanced-current').onclick=()=>captureAction(false);
await loadCharacter(catalog.characters[0].id);requestAnimationFrame(frame);
