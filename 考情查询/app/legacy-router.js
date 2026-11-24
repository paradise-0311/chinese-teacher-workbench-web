(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KQLegacyRouter=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const pages=new Set(['papers','types','texts','stages','schools','topics']);
const topics=new Set(['essays','poetry','classical-material','modern','implicit','textbook']);
function normalize(value){let s=String(value||'').trim();try{s=decodeURIComponent(s);}catch{return null;}s=s.replace(/\\/g,'/');const id=s.match(/chart_[a-f0-9]{16}/i);if(id)return id[0].toLowerCase();const n=s.indexOf('02_图件/');if(n>=0)s=s.slice(n);return s.split(/[?#]/)[0];}
function resolve(compat,value){const key=normalize(value);return compat?.entries.find(r=>r.id===key||r.path===key)||null;}
function questionEntries(compat,qids){const indices=[...new Set(qids.flatMap(id=>compat.question_links[id]||[]))];return indices.map(i=>compat.entries[i]).filter(Boolean);}
function target(entry){const t=entry?.target;if(!t||!pages.has(t.page)||t.page==='topics'&&!topics.has(t.topic))throw new Error('历史入口未配置可用的动态查询');return JSON.parse(JSON.stringify(t));}
function lookupFromURL(value){const u=new URL(value,'file:///');for(const k of ['legacy','chart','chart_id','chartId','path'])if(u.searchParams.get(k))return u.searchParams.get(k);return u.hash.includes('chart_')?u.hash:null;}
return {resolve,questionEntries,target,lookupFromURL};
});
