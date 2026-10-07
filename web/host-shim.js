// Development-only IPC fixture. Production uses Clawd's unchanged Electron preload.
const hostHandlers = new Map();
window.electronAPI = new Proxy({}, {get(_target,key){
  if(String(key).startsWith('on'))return cb=>hostHandlers.set(key,cb);
  return ()=>{};
}});
addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  const {kind,args}=event.data||{};
  const allowed={state:'onStateChange',gaze:'onEyeMove',reaction:'onReact'};
  if(allowed[kind])hostHandlers.get(allowed[kind])?.(...args);
});
addEventListener('error',event=>parent.postMessage({error:event.message},location.origin));
