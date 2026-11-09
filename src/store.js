'use strict';
const fs=require('node:fs'),path=require('node:path');
const {modeOf}=require('./core');
function empty(){return {version:1,mode:'flux',history:[],notes:[],seedVersion:0};}
function load(file){
 try{const v=JSON.parse(fs.readFileSync(file,'utf8'));return {...empty(),...v,mode:modeOf(v.mode)||'flux',history:Array.isArray(v.history)?v.history.slice(-500):[],notes:Array.isArray(v.notes)?v.notes.slice(0,2500):[]};}catch{return empty();}
}
function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file);}
function applySeed(data,seed){
 if((data.seedVersion||0)>=seed.version)return data;
 const existing=new Set(data.notes.map(x=>typeof x==='string'?x:x.content));
 for(const line of seed.notes){if(!existing.has(line))data.notes.push({source:'COSM.OS seed',content:line});}
 data.seedVersion=seed.version;return data;
}
module.exports={empty,load,save,applySeed};
