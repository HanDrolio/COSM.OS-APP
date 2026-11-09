const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cosmos',{
 status:()=>ipcRenderer.invoke('app:status'),personas:()=>ipcRenderer.invoke('app:personas'),
 send:text=>ipcRenderer.invoke('app:send',text),switch:id=>ipcRenderer.invoke('app:switch',id),
 download:()=>ipcRenderer.invoke('app:download'),start:()=>ipcRenderer.invoke('app:start'),
 stop:()=>ipcRenderer.invoke('app:stop'),chooseModel:()=>ipcRenderer.invoke('app:choose-model'),
 import:()=>ipcRenderer.invoke('app:import'),clear:()=>ipcRenderer.invoke('app:clear'),
 cancel:()=>ipcRenderer.invoke('app:cancel'),trainer:()=>ipcRenderer.invoke('app:trainer'),
 on:(channel,handler)=>{
  if(!['app:state','engine:status','model:download','chat:delta'].includes(channel))throw Error('Unsupported event');
  const cb=(_event,value)=>handler(value);ipcRenderer.on(channel,cb);return ()=>ipcRenderer.removeListener(channel,cb);
 }
});
