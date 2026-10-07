const $=id=>document.getElementById(id),frame=$('host');
const catalog=await fetch('/catalog.json').then(r=>r.json());
const labels={idle:'待机','running-right':'向右跑','running-left':'向左跑',waving:'招呼',jumping:'庆祝',failed:'失落',waiting:'等待',running:'思考',review:'完成',walk:'散步',dance:'跳舞',clap:'鼓掌',nod:'点头','shake-head':'摇头',doze:'打瞌睡',yawn:'哈欠',peace:'比耶',laugh:'笑',surprise:'惊讶',angry:'生气'};
Object.assign(labels,{'sit-down':'坐下','seated-sleep':'坐椅休息','stand-up':'起身'});
let timer,returnTimer,generation=0;let current=catalog.characters[0],theme;
const send=(kind,...args)=>frame.contentWindow.postMessage({kind,args},location.origin);
const cancel=()=>{clearInterval(timer);clearTimeout(returnTimer);generation++};
const visual=(state,file)=>{cancel();send('state',state,file+(['failed','review','sit-down','stand-up'].includes(file)?'-once':'')+'.webp')};
async function workState(state){
  cancel();const token=generation;
  const manifest=theme||await fetch('/clawd-themes/'+current.id+'/theme.json').then(r=>r.json());
  if(token!==generation)return;
  theme=manifest;
  const actual=state==='sleeping'?'collapsing':state;
  send('state',actual,theme.states[actual][0]);
  const duration=state==='sleeping'?theme.timings.collapseDuration:
    state==='waking'?theme.timings.wakeDuration:theme.timings.autoReturn[state];
  if(duration)returnTimer=setTimeout(()=>{
    if(token!==generation)return;
    const next=state==='sleeping'?'sleeping':'idle';
    send('state',next,theme.states[next][0]);
  },duration);
}
for(const c of catalog.characters){const o=document.createElement('option');o.value=c.id;o.textContent=c.displayName;$('who').append(o)}
$('who').onchange=()=>{cancel();theme=null;current=catalog.characters.find(c=>c.id===$('who').value);frame.src='/host/index.html?character='+current.id;buttons()};
for(const [name,state] of [['待机','idle'],['思考','thinking'],['工作','working'],['等待输入','notification'],['出错','error'],['完成','attention'],['浅睡','dozing'],['深睡 · 坐椅','sleeping'],['唤醒 · 起身','waking']]){const b=document.createElement('button');b.textContent=name;b.onclick=()=>workState(state);$('work').append(b)}
function buttons(){ $('actions').replaceChildren();for(const key of Object.keys(current.states)){const b=document.createElement('button');b.textContent=labels[key]||'专属 '+key.replace('special-','');b.onclick=()=>visual('working',key);$('actions').append(b)}}buttons();
addEventListener('message',event=>{if(event.source===frame.contentWindow&&event.data.error)$('report').textContent='渲染错误：'+event.data.error});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
$('verify-host').onclick=async()=>{
  const checks=[];const img=()=>frame.contentDocument.querySelector('#clawd');
  function check(name,ok){checks.push(`${ok?'通过':'失败'}：${name}`);$('report').textContent=checks.join('\n');if(!ok)throw Error(name)}
  try{
    visual('idle','idle');await sleep(300);
    check('原生渲染器加载 384×416 高清 WebP',img()?.tagName==='IMG'&&img().naturalWidth===384&&img().naturalHeight===416);
    for(let i=0;i<16;i++){send('gaze',Math.sin(i*Math.PI/8)*20,-Math.cos(i*Math.PI/8)*20);await sleep(25)}
    check('鼠标方向不会再切换静态姿势',img().src.includes('idle.webp'));
    send('gaze',20,0);await sleep(50);visual('working','dance');await sleep(250);
    send('gaze',-20,0);await sleep(80);check('工作动作优先于视线',img().src.includes('dance.webp'));
    visual('idle','idle');await sleep(200);check('工作结束回到待机',img().src.includes('idle.webp'));
    for(const [state,key] of [['error','failed'],['attention','review']]){
      await workState(state);await sleep(150);check(`${state} 使用单次动画`,img().src.includes(key+'-once.webp'));
      await sleep(theme.timings.autoReturn[state]+100);check(`${state} 播放后回到待机`,img().src.includes('idle.webp'));
    }
    await workState('sleeping');await sleep(150);check('深睡先坐下',img().src.includes('sit-down-once.webp'));
    await sleep(theme.timings.collapseDuration+100);check('深睡保持坐椅休息',img().src.includes('seated-sleep.webp'));
    await workState('waking');await sleep(theme.timings.wakeDuration+200);check('起身后回到待机',img().src.includes('idle.webp'));
    await workState('attention');visual('working','dance');await sleep(theme.timings.autoReturn.attention+150);
    check('旧完成计时器不会打断新工作',img().src.includes('dance.webp'));visual('idle','idle');
  }catch(error){console.error(error)}
};
