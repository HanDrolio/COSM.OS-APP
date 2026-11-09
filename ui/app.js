'use strict';
const api=window.cosmos;const el=id=>document.getElementById(id);
let personas={},state={mode:'flux',history:[],busy:false},isSending=false,draft=null;
function add(role,text){const div=document.createElement('div');div.className='msg '+role;div.textContent=text;el('messages').appendChild(div);el('messages').scrollTop=el('messages').scrollHeight;return div;}
function drawMessages(){el('messages').replaceChildren();if(!state.history.length){const p=document.createElement('div');p.className='welcome';p.innerHTML='<strong>🟦🌌🟨 SIGNAL ONLINE</strong>A fresh COSM.OS, built for your own computer.<br>The eight voices are here. The operator holds the switch.';el('messages').appendChild(p);}for(const msg of state.history)add(msg.role,msg.content);}
function render(){
 const persona=personas[state.mode]||personas.flux;
 el('mode-title').textContent=(persona?.glyph||'🟣🌀')+' '+(persona?.name||'Flux')+' 🔒';
 el('role').textContent=(persona?.role||'Creative synthesis')+' • locked';
 el('connection').textContent=state.runtimeInstalled?(state.modelInstalled?'LOCAL MODEL READY':'MODEL NOT DOWNLOADED'):'RUNTIME NOT INSTALLED';
 el('personas').replaceChildren();
 for(const [id,p] of Object.entries(personas)){const b=document.createElement('button');b.className='persona'+(state.mode===id?' active':'');b.style.setProperty('--accent',p.color);b.textContent=p.glyph+' '+p.name;const small=document.createElement('small');small.textContent=p.role;b.appendChild(small);b.onclick=()=>action(async()=>{state=await api.switch(id);render();});el('personas').appendChild(b);}
 el('send').disabled=state.busy||isSending;
}
function note(text){el('status').textContent=text;}
async function action(fn){try{await fn();}catch(e){note('Error: '+e.message);}}
async function send(){
 if(isSending)return;const text=el('prompt').value.trim();if(!text)return;
 isSending=true;el('send').disabled=true;el('prompt').value='';
 add('user',text);draft=add('assistant','…');
 try{
  const result=await api.send(text);
  if(result.status==='switched')draft.textContent='Mode locked: '+result.mode+'.';
  else if(result.status==='info')draft.textContent='Current mode: '+result.mode+'.';
  else if(result.status==='ok')draft.textContent=result.answer;
 }catch(e){draft.textContent='Local engine error: '+e.message;}finally{
  isSending=false;draft=null;state=await api.status();drawMessages();render();el('prompt').focus();
 }
}
async function boot(){
 personas=await api.personas();state=await api.status();render();drawMessages();
 api.on('app:state',next=>{state=next;render();});
 api.on('engine:status',msg=>note(msg));
 api.on('model:download',({bytes,total})=>note('Downloading model: '+(bytes/1048576).toFixed(0)+' MB'+(total?' / '+(total/1048576).toFixed(0)+' MB':'')));
 api.on('chat:delta',({delta})=>{if(draft){if(draft.textContent==='…')draft.textContent='';draft.textContent+=delta;el('messages').scrollTop=el('messages').scrollHeight;}});
 el('send').onclick=send;el('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
 el('download').onclick=()=>action(async()=>{await api.download();state=await api.status();render();note('Model downloaded and verified. Click Start engine.');});
 el('model').onclick=()=>action(async()=>{state=await api.chooseModel();render();note('Selected local GGUF.');});
 el('start').onclick=()=>action(async()=>{await api.start();note('Engine ready. Chat locally.');});
 el('import').onclick=()=>action(async()=>{const result=await api.import();note('Imported '+result.added+' local memory chunks. Nothing uploaded.');});
 el('trainer').onclick=()=>action(async()=>{await api.trainer();note('Opening separate COSM.OS Model Trainer window.');});
 el('clear').onclick=()=>action(async()=>{state=await api.clear();drawMessages();render();note('Local chat cleared.');});
}
boot().catch(e=>note('Startup error: '+e.message));
