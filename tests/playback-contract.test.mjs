import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function animation(file){
  const b=fs.readFileSync(file);assert.equal(b.toString('ascii',0,4),'RIFF');
  assert.equal(b.toString('ascii',8,12),'WEBP');
  let loop,width,height,duration=0,frames=0,intervals=[];
  for(let p=12;p+8<=b.length;){
    const tag=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4);
    assert.ok(p+8+size<=b.length,'Truncated WebP');
    if(tag==='ANIM')loop=b.readUInt16LE(p+12);
    if(tag==='VP8X'){width=1+b.readUIntLE(p+12,3);height=1+b.readUIntLE(p+15,3)}
    if(tag==='ANMF'){const ms=b.readUIntLE(p+20,3);duration+=ms;intervals.push(ms);frames++}
    p+=8+size+(size&1);
  }
  return {loop,duration,frames,width,height,intervals};
}

test('all 31 JP forms retain distinct IDs and all 26 identities',()=>{
  const folder=path.join(root,'dist/mysekai-clawd/themes');
  const c=fs.readdirSync(folder).map(id=>({id,...JSON.parse(fs.readFileSync(path.join(folder,id,'source.json'),'utf8'))}));
  assert.equal(c.length,31);assert.equal(new Set(c.map(x=>x.characterId)).size,26);
  assert.equal(new Set(c.map(x=>x.id)).size,31);assert.equal(new Set(c.map(x=>x.model)).size,31);
  assert.deepEqual(c.filter(x=>x.characterId===21).map(x=>x.unitId).sort((a,b)=>a-b),[21,27,28,29,30,31]);
});

test('all shipped action binaries use HD frames and a 60 fps time grid',()=>{
  const folder=path.join(root,'dist/mysekai-clawd/themes');
  const pack=JSON.parse(fs.readFileSync(path.join(root,'dist/mysekai-clawd/pack.json')));
  for(const c of pack.characters){
    const dir=path.join(folder,c.id),manifest=JSON.parse(fs.readFileSync(path.join(dir,'theme.json')));
    assert.equal(manifest.rasterGaze,undefined);
    assert.equal(manifest.eyeTracking.enabled,false);
    for(const action of c.actions){
      const a=animation(path.join(dir,'assets',action.file));
      assert.equal(a.width,384);assert.equal(a.height,416);
      assert.equal(a.duration,action.durationMs);
      assert.ok(a.frames>action.frames*.95,'Unexpected loss of motion samples: '+c.id+' '+action.state);
      assert.ok(a.intervals.filter(ms=>ms>=16&&ms<=17).length>=a.frames*.95,'Frame intervals are not approximately 60 fps');
    }
  }
});

test('shipped binaries play completion/error once, avoid duplicate action files, and implement seated deep sleep',()=>{
  const folder=path.join(root,'dist/mysekai-clawd/themes');
  for(const id of fs.readdirSync(folder)){
    const dir=path.join(folder,id),t=JSON.parse(fs.readFileSync(path.join(dir,'theme.json')));
    for(const [state,key] of [['error','failed'],['attention','review']]){
      const a=animation(path.join(dir,'assets',t.states[state][0]));
      assert.equal(a.loop,1,id+' '+state);assert.ok(a.frames>1);
      assert.equal(a.duration,t.timings.autoReturn[state],id+' timer must match encoded duration');
      assert.equal(a.duration,t.timings.minDisplay[state]);
      assert.equal(fs.existsSync(path.join(dir,'assets',key+'.webp')),false,'No redundant looping copy');
    }
    for(const [state,timing] of [['collapsing','collapseDuration'],['waking','wakeDuration']]){
      const a=animation(path.join(dir,'assets',t.states[state][0]));
      assert.equal(a.loop,1);assert.equal(a.duration,t.timings[timing]);
    }
    assert.deepEqual(t.states.sleeping,['seated-sleep.webp']);
    assert.deepEqual(t.states.dozing,['doze.webp']);
    assert.equal(animation(path.join(dir,'assets','seated-sleep.webp')).loop,0);
    assert.ok(t.timings.deepSleepTimeout>t.timings.mouseSleepTimeout);
  }
});
