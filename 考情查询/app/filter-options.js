(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KQFilterOptions=api;})(typeof window==='undefined'?globalThis:window,function(){'use strict';
const uniq=a=>[...new Set(a.filter(x=>x!==null&&x!==undefined&&x!==''))],array=x=>x?[].concat(x):[],sort=a=>uniq(a).sort((a,b)=>String(a).localeCompare(String(b),'zh-CN'));
function chineseNumber(t){if(/^\d+$/.test(t))return Number(t);const d={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(t.includes('十')){const [a,b]=t.split('十');return (a?d[a]:1)*10+(b?d[b]:0);}return d[t];}
function schoolIdentity(raw){const clean=raw.replace(/^石家庄市?/,'')||raw;if(/集团|联考|部分校/.test(raw))return {key:'group:'+clean,label:clean,kind:'来源'};if(/省$|市$|区$/.test(raw))return {key:'region:'+clean,label:clean,kind:'来源'};if(raw.includes('外国语学校'))return {key:'school:43',label:'43中（石外）',kind:'学校'};const m=raw.match(/(?:第)?([零〇一二两三四五六七八九十\d]+)中(?:学)?/)||raw.match(/^(\d+)$/),n=m&&chineseNumber(m[1]);return {key:n?'school:'+n:'school:'+clean,label:n?n+'中':clean,kind:'学校'};}
const confirmedSource=s=>!!s&&!/待核|未核|未知|未确认/.test(s);
class Options{
 constructor(engine,view,stage){this.e=engine;this.v=view;this.stage=stage;const groups=new Map();for(const name of uniq(engine.data.papers.flatMap(p=>p.schools))){const id=schoolIdentity(name);if(!groups.has(id.key))groups.set(id.key,{...id,aliases:[]});groups.get(id.key).aliases.push(name);}this.entities=[...groups.values()].sort((a,b)=>a.label.localeCompare(b.label,'zh-CN'));this.schools=this.entities.filter(g=>g.kind==='学校');}
 paperScope(f,page='papers'){return (page==='stages'?this.stage.scopedPapers(f):this.e.paperResults({...f,mainOnly:true}));}
 scope(f,key){const n={...f,mainOnly:true};delete n[key];const content=['block','typePrimary','typeSecondary','genre','theme','inClass','essayForm','category','type','ability'];if(key==='semester')for(const k of ['stage','year','school','sourceGroup',...content])delete n[k];if(key==='stage')for(const k of ['year','school','sourceGroup',...content])delete n[k];if(key==='year')for(const k of ['school','sourceGroup',...content])delete n[k];if(key==='block')for(const k of ['typePrimary','typeSecondary'])delete n[k];if(key==='typePrimary')delete n.typeSecondary;return n;}
 records(f,page,topic){if(page==='types'){const all=this.v.units(f);return f.keyword?all:all.filter(u=>this.v.paths(u).length);}if(page==='texts')return this.v.occurrenceRows(f);if(page==='topics'&&topic==='implicit')return this.v.annualRows(f);if(page==='topics'&&topic==='textbook')return this.e.classicalResults(f);if(page==='topics')return this.v.essayRows(f);return this.paperScope(f,page);}
 candidates(key,f={},page='papers',topic='essays'){
  const n=this.scope(f,key),e=this.e,v=this.v;
  if(page==='topics'&&topic==='textbook'){
   const ws=this.e.classicalResults(n),links=ws.flatMap(w=>w.matching_links),match=(l,k)=>!n[k]||array(n[k]).includes(l[k==='relationYear'?'year':'source_type']);
   if(key==='textbookSemester')return sort(ws.map(w=>w.current_textbook?.册次||w.historical_semester));
   if(key==='relationYear')return sort(links.map(l=>l.year));if(key==='relationSource')return sort(links.map(l=>l.source_type).filter(confirmedSource));
   if(key==='relationKind')return ['five','direct'].filter(kind=>ws.some(w=>(kind==='five'?w.five_term_links:w.direct_links).some(l=>match(l,'relationYear')&&match(l,'relationSource'))));return [];
  }
  if(page==='topics'&&topic==='implicit'){const rows=this.v.annualRows(n);return sort(rows.map(r=>r[key]));}
  const rows=this.records(n,page,topic),ids=new Set(rows.map(r=>page==='papers'||page==='stages'?r.id:r.paper_id)),papers=(page==='papers'||page==='stages'?rows:e.scopedPapers(n).filter(p=>ids.has(p.id)));
  if(['semester','stage','year'].includes(key))return sort(papers.map(p=>p[key]));
  if(key==='school'){const aliases=new Set(papers.flatMap(p=>p.schools));return this.schools.filter(g=>g.aliases.some(a=>aliases.has(a)));}
  if(key==='sourceGroup')return sort(papers.map(p=>p.source_group).filter(confirmedSource));
  if(page==='types'){
   const paths=rows.flatMap(u=>v.paths(u));if(key==='block')return sort(paths.map(d=>d.block));if(key==='typePrimary')return sort(paths.map(d=>'primary:'+JSON.stringify([d.block,d.primary])));if(key==='typeSecondary')return sort(paths.filter(d=>d.secondary).map(d=>d.id));
  }
  if(page==='texts'){if(key==='block')return sort(rows.flatMap(o=>e.readingBlocks(o)));if(key==='genre')return sort(rows.flatMap(o=>o.genres));if(key==='theme')return sort(rows.flatMap(o=>o.themes));if(key==='inClass')return sort(rows.map(o=>e.readingInClass(o)).filter(x=>['课内','课外','课内诵读'].includes(x)));}
  if(key==='essayForm')return sort(rows.map(r=>r.form));return [];
 }
 normalize(input,page,topic,keys,changed=[]){
  const f={...input,mainOnly:true},removed=[];for(const k of Object.keys(f))if(k!=='mainOnly'&&(!f[k]||Array.isArray(f[k])&&!f[k].length))delete f[k];
  const check=k=>{if(!f[k]||k==='term')return;const values=this.candidates(k,{...f,keyword:undefined,textbookTitle:undefined},page,topic);if(k==='school'){const allowed=new Map(values.map(g=>[g.key,g])),selected=uniq(array(f.school).map(a=>schoolIdentity(a).key)),valid=selected.filter(k=>allowed.has(k));if(valid.length!==selected.length)removed.push('学校');if(valid.length)f.school=uniq(valid.flatMap(k=>allowed.get(k).aliases));else delete f.school;return;}
   const good=array(f[k]).filter(x=>values.includes(x));if(good.length!==array(f[k]).length){removed.push(k);if(good.length)f[k]=Array.isArray(f[k])?good:good[0];else delete f[k];}
  };
  if(changed.includes('school')){const source=f.sourceGroup;delete f.sourceGroup;check('school');if(source)f.sourceGroup=source;check('sourceGroup');}
  if(changed.includes('sourceGroup')){const school=f.school;delete f.school;check('sourceGroup');if(school)f.school=school;check('school');}
  if(page==='stages'){
   check('semester');if(!f.semester){const semesters=this.candidates('semester',f,page);f.semester=semesters.includes('七上')?'七上':semesters[0];removed.push('阶段默认');}
   check('stage');
   if(!f.stage){const stages=this.candidates('stage',f,page);f.stage=stages.includes('期中')?'期中':stages[0];removed.push('阶段默认');}
  }
  for(const k of ['semester','stage','year',...changed,...keys.filter(k=>!['sourceGroup','school'].includes(k)),...(changed.includes('sourceGroup')?['sourceGroup','school']:['school','sourceGroup'])])if(keys.includes(k))check(k);
  return {filters:f,removed:uniq(removed)};
 }
}
return {Options,schoolIdentity,confirmedSource};});
