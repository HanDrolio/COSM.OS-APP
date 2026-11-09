'use strict';
const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const {spawn}=require('node:child_process');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {PERSONAS,modeOf,command,messages,recall}=require('./core');
const {load,save,applySeed}=require('./store');
const {importFile}=require('./importer');
const seed=require('./seed-memory.json');
const MODEL_FILE='SmolLM2-1.7B-Instruct-Q4_K_M.gguf';
const MODEL_URL='https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/'+MODEL_FILE+'?download=true';
const MODEL_SHA='77665ea4815999596525c636fbeb56ba8b080b46ae85efef4f0d986a139834d7';
let win,engine,enginePort,state,storeFile,busy=false,downloadBusy=false,abortStream=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function report(type,payload){if(win&&!win.isDestroyed())win.webContents.send(type,payload);}
function modelPath(){return state.modelPath||path.join(app.getPath('userData'),'models',MODEL_FILE);}
function getRuntime(){const root=app.isPackaged?path.join(process.resourcesPath,'runtime'):path.join(__dirname,'..','vendor','llama');return path.join(root,'llama-server.exe');}
function status(){return {mode:state.mode,history:state.history.slice(-150),noteCount:state.notes.length,modelInstalled:fs.existsSync(modelPath()),runtimeInstalled:fs.existsSync(getRuntime()),modelFile:path.basename(modelPath()),busy};}
function persist(){save(storeFile,state);}
async function getPort(){return new Promise((res,rej)=>{const server=net.createServer();server.unref();server.on('error',rej);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>res(port));});});}
async function startEngine(){
 if(engine&&!engine.killed&&enginePort)return enginePort;
 if(!fs.existsSync(getRuntime()))throw Error('Bundled llama.cpp runtime missing. Run scripts/prepare-runtime.ps1 before npm start, or use the Windows installer.');
 if(!fs.existsSync(modelPath()))throw Error('Model not installed. Click Download model or Choose GGUF.');
 enginePort=await getPort();
 engine=spawn(getRuntime(),['--model',modelPath(),'--host','127.0.0.1','--port',String(enginePort),'--ctx-size','2048','--threads','4','--parallel','1','--n-gpu-layers','0'],{windowsHide:true,stdio:'ignore'});
 engine.on('exit',()=>{engine=null;enginePort=null;report('engine:status','Model process stopped.');});
 engine.on('error',error=>report('engine:status','Runtime error: '+error.message));
 report('engine:status','Loading local model into CPU memory...');
 const port=enginePort;
 for(let i=0;i<120;i++){
  if(!engine||enginePort!==port)throw Error('Model process exited before becoming ready.');
  try{const res=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(1000)});if(res.ok){report('engine:status','Ready. Offline inference active.');return port;}}catch{}
  await sleep(1000);
 }
 stopEngine();throw Error('Local model did not start within 120 seconds.');
}
function stopEngine(){if(abortStream)abortStream.abort();if(engine){engine.kill();engine=null;}enginePort=null;}
async function download(){
 if(downloadBusy)throw Error('A model download is already running.');
 if(fs.existsSync(modelPath()))return {ok:true,already:true};
 downloadBusy=true;
 const target=path.join(app.getPath('userData'),'models',MODEL_FILE);
 const part=target+'.part';fs.mkdirSync(path.dirname(target),{recursive:true});
 try{
  report('engine:status','Downloading about 1.06 GB. This is a one-time setup.');
  const res=await fetch(MODEL_URL,{signal:AbortSignal.timeout(900000)});
  if(!res.ok||!res.body)throw Error('Download failed with HTTP '+res.status);
  const total=Number(res.headers.get('content-length'))||0;
  let bytes=0;const hash=crypto.createHash('sha256');
  const source=Readable.fromWeb(res.body);
  source.on('data',chunk=>{bytes+=chunk.length;hash.update(chunk);if(bytes%(16*1024*1024)<chunk.length)report('model:download',{bytes,total});});
  await pipeline(source,fs.createWriteStream(part));
  if(hash.digest('hex')!==MODEL_SHA)throw Error('Downloaded model failed SHA-256 verification.');
  fs.renameSync(part,target);state.modelPath=target;persist();report('engine:status','Verified model downloaded. Ready to start.');
  return {ok:true};
 }catch(e){try{fs.unlinkSync(part);}catch{}throw e;}finally{downloadBusy=false;}
}
function currentMemory(prompt){
 const matches=recall(state.notes,prompt,4);
 const defaultLore=state.notes.filter(n=>n.source==='COSM.OS seed').slice(0,2).map(n=>n.content);
 return [...new Set([...defaultLore,...matches])].slice(0,5);
}
async function generate(text){
 if(busy)throw Error('Already generating. Try again when the current reply finishes.');
 const trimmed=String(text||'').trim();if(!trimmed)return {status:'empty'};
 const cmd=command(trimmed);
 if(cmd){
  if(cmd.type==='mode'){
   if(!cmd.mode)throw Error('Unknown mode: '+cmd.requested);
   state.mode=cmd.mode;persist();report('app:state',status());return {status:'switched',mode:state.mode};
  }
  return {status:'info',mode:state.mode};
 }
 busy=true;report('app:state',status());
 try{
  const port=await startEngine();
  const history=[...state.history,{role:'user',content:trimmed}];
  const payload={model:'local',stream:true,messages:messages(state.mode,history,currentMemory(trimmed)),
   temperature:0.7,top_p:0.9,max_tokens:340};
  abortStream=new AbortController();
  const response=await fetch('http://127.0.0.1:'+port+'/v1/chat/completions',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(payload),signal:abortStream.signal});
  if(!response.ok)throw Error('Local engine HTTP '+response.status+': '+(await response.text()).slice(0,300));
  if(!response.body)throw Error('No streaming output from model.');
  const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='',answer='',done=false;
  while(!done){
   const step=await reader.read();done=step.done;
   buffer+=decoder.decode(step.value||new Uint8Array(),{stream:!done});
   const lines=buffer.split('\n');buffer=lines.pop()||'';
   for(const line of lines){
    if(!line.startsWith('data: '))continue;
    const data=line.slice(6).trim();if(data==='[DONE]')continue;
    let obj;try{obj=JSON.parse(data);}catch{continue;}
    const delta=obj.choices?.[0]?.delta?.content||'';
    if(delta){answer+=delta;report('chat:delta',{delta});}
   }
  }
  if(!answer.trim())throw Error('The model returned an empty response.');
  state.history.push({role:'user',content:trimmed},{role:'assistant',content:answer.trim()});
  state.history=state.history.slice(-500);persist();return {status:'ok',answer:answer.trim()};
 }finally{busy=false;abortStream=null;report('app:state',status());}
}
function installHandlers(){
 ipcMain.handle('app:status',()=>status());
 ipcMain.handle('app:personas',()=>PERSONAS);
 ipcMain.handle('app:send',(_e,text)=>generate(text));
 ipcMain.handle('app:switch',(_e,id)=>{const mode=modeOf(id);if(!mode)throw Error('Unknown persona');state.mode=mode;persist();report('app:state',status());return status();});
 ipcMain.handle('app:download',()=>download());
 ipcMain.handle('app:start',()=>startEngine().then(()=>status()));
 ipcMain.handle('app:stop',()=>{stopEngine();return status();});
 ipcMain.handle('app:choose-model',async()=>{
  const pick=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'GGUF model',extensions:['gguf']}]});
  if(pick.canceled||!pick.filePaths?.length)return status();
  stopEngine();state.modelPath=pick.filePaths[0];persist();report('app:state',status());return status();
 });
 ipcMain.handle('app:import',async()=>{
  const pick=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'Text / Markdown / JSON',extensions:['txt','md','json']}]});
  if(pick.canceled)return {added:0};
  let added=0;for(const filename of pick.filePaths){const chunks=importFile(filename);for(const c of chunks){state.notes.push(c);added++;}}
  state.notes=state.notes.slice(-2500);persist();report('app:state',status());return {added};
 });
 ipcMain.handle('app:clear',()=>{state.history=[];persist();report('app:state',status());return status();});
 ipcMain.handle('app:cancel',()=>{abortStream?.abort();return true;});
}
app.whenReady().then(()=>{
 storeFile=path.join(app.getPath('userData'),'cosmos-local.json');state=applySeed(load(storeFile),seed);persist();installHandlers();
 win=new BrowserWindow({width:1150,height:800,minWidth:760,minHeight:530,backgroundColor:'#090e1c',
  webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.loadFile(path.join(__dirname,'..','ui','index.html'));
 win.on('closed',()=>{win=null;stopEngine();});
});
app.on('window-all-closed',()=>{stopEngine();if(process.platform!=='darwin')app.quit();});
app.on('before-quit',stopEngine);
