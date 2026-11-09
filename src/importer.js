'use strict';
const fs=require('node:fs'),path=require('node:path');
const extensions=new Set(['.txt','.md','.json']);
function extract(value){
 if(typeof value==='string')return [value];
 if(Array.isArray(value))return value.flatMap(extract);
 if(value&&typeof value==='object'){
  if(value.role&&typeof value.content==='string')return [String(value.role)+': '+value.content];
  if(typeof value.prompt==='string'&&typeof value.completion==='string')return ['User: '+value.prompt+'\nAssistant: '+value.completion];
  return Object.entries(value).flatMap(([key,v])=>['['+key+']',...extract(v)]);
 }
 return [];
}
function chunks(text,maxWords=400){
 const words=String(text).replace(/\r/g,'').split(/\s+/).filter(Boolean),out=[];
 for(let i=0;i<words.length;i+=maxWords){const content=words.slice(i,i+maxWords).join(' ');if(content.length>=12)out.push(content);}
 return out;
}
function importFile(filename){
 const ext=path.extname(filename).toLowerCase();
 if(!extensions.has(ext))throw new Error('Supported formats: TXT, MD, JSON.');
 if(fs.statSync(filename).size>16*1024*1024)throw new Error('File exceeds 16 MB: '+path.basename(filename));
 let text=fs.readFileSync(filename,'utf8');
 if(ext==='.json')text=extract(JSON.parse(text)).join('\n');
 return chunks(text).map((content,i)=>({source:path.basename(filename)+' #'+(i+1),content}));
}
module.exports={extract,chunks,importFile};
