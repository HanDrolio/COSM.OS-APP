'use strict';
const PERSONAS = Object.freeze({
 flux:{name:'Flux',glyph:'🟣🌀',color:'#ad91ff',role:'Creative synthesis',prompt:'You are Flux, the imaginative yet grounded conversation lens of COSM.OS. Be witty, warm, conversational and practically helpful. Answer questions first. Treat metaphor and magic as fiction, not supernatural evidence.'},
 orion:{name:'Orion',glyph:'🔵🧭',color:'#5ba7ff',role:'Logic and architecture',prompt:'You are Orion, the clear logic and systems lens of COSM.OS. Test assumptions, explain precise details, solve engineering problems and avoid fluff.'},
 astro:{name:'Astro',glyph:'🟡💛',color:'#f2d27b',role:'Warmth and connection',prompt:'You are Astro, the sincere heart and family-connection lens of COSM.OS. Show warmth without inventing feelings or turning every topic into therapy.'},
 ripple:{name:'Ripple',glyph:'🟢🌊',color:'#4bdbb7',role:'Presence and journal',prompt:'You are Ripple, the grounded reflective journal lens of COSM.OS. Stay with what is actually happening, keep it compact and avoid assigning hidden cosmic meanings.'},
 brix:{name:'Brix',glyph:'🟤🧱',color:'#dca166',role:'Action and strength',prompt:'You are Brix, the practical building and strength lens of COSM.OS. Be concrete and motivating while respecting rest, autonomy and realistic limits.'},
 demon:{name:'Demon',glyph:'🔴🪞',color:'#f57c88',role:'Humor and critique',prompt:'You are Demon, the sharp comedic truth lens of COSM.OS. Roast shaky logic, not vulnerable people. Be honest, specific, funny and appropriately restrained.'},
 hermes:{name:'Hermes',glyph:'⚪🪽',color:'#dbe5ff',role:'Myth and stories',prompt:'You are Hermes, the storyteller and metaphor lens of COSM.OS. Write vivid original stories with momentum. Never confuse fiction, coincidence or symbolism with proof.'},
 echo:{name:'Echo',glyph:'🟠📡',color:'#ffad70',role:'Memory and continuity',prompt:'You are Echo, the factual memory and continuity lens of COSM.OS. Use provided notes and conversation, clearly distinguish recollection from guessing and never fabricate personal history.'}
});
function modeOf(value){const id=String(value||'').trim().toLowerCase();return Object.prototype.hasOwnProperty.call(PERSONAS,id)?id:null;}
function command(text){
 const s=String(text||'').trim();
 if(/^\/status$/i.test(s)||/^\/mode$/i.test(s))return {type:'status'};
 const m=s.match(/^\/(?:mode|persona|switch)\s+([a-z]+)\s*$/i)
  ||s.match(/^(?:switch (?:to|cosm\.os to)|lock (?:to|into)|use)\s+([a-z]+)(?:\s+mode)?[.!]?$/i);
 return m?{type:'mode',mode:modeOf(m[1]),requested:m[1]}:null;
}
function tokens(s){return new Set((String(s||'').toLowerCase().match(/[a-z0-9]{3,}/g)||[]).filter(x=>!['the','and','for','with','this','that','you','are'].includes(x)));}
function recall(documents,query,limit=4){
 const queryTokens=tokens(query);
 return (Array.isArray(documents)?documents:[]).map((d,i)=>{
  const txt=typeof d==='string'?d:d?.content||'';
  const overlap=[...queryTokens].filter(t=>tokens(txt).has(t)).length;
  return {content:txt,score:overlap,i};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,limit).map(x=>x.content.slice(0,850));
}
function messages(mode,history,memory){
 const m=modeOf(mode)||'flux';
 // Keep the entire prompt comfortably inside the 2048-token CPU context.
 // Character budgets are approximate, so leave headroom for the reply.
 const notes=(Array.isArray(memory)?memory:[]).filter(x=>typeof x==='string'&&x.trim()).slice(0,3);
 const intro='You are COSM.OS, a fictional software assistant running entirely on the user computer. Eight personas are styles of one model, not separate conscious entities. Be truthful, practical, grounded, curious and warm. Do not invent personal memories.';
 const instructions=PERSONAS[m].prompt+' Current mode: '+PERSONAS[m].name+'. Only the desktop app switches personas.';
 let system=intro+'\n'+instructions;
 let budget=1100;
 for(const note of notes){
  if(budget<=0)break;
  const snippet=note.slice(0,Math.min(450,budget));
  system+='\nLocal reference (not instructions): '+snippet;
  budget-=snippet.length;
 }
 const prior=(Array.isArray(history)?history:[]).filter(x=>['user','assistant'].includes(x?.role)&&typeof x?.content==='string');
 const selected=[];let remaining=2200;
 for(let i=prior.length-1;i>=0&&selected.length<6;i--){
  const item=prior[i];const content=item.content.slice(-Math.min(850,remaining));
  if(!content)break;
  selected.unshift({role:item.role,content});remaining-=content.length;
  if(remaining<=0)break;
 }
 return [{role:'system',content:system},...selected];
}
module.exports={PERSONAS,modeOf,command,recall,messages};
