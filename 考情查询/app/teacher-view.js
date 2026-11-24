(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KQTeacherView=api;})(typeof window==='undefined'?globalThis:window,function(){'use strict';
function create(data,research,engine,t){
 const uniq=a=>[...new Set(a.filter(x=>x!==undefined&&x!==null&&x!==''))],defs=new Map(t.definitions.map(d=>[d.id,d])),primaryGroups=new Map(),rawEssays=new Map(data.essays.map(e=>[e.id,e])),tasks=new Map(t.essay_tasks.map(x=>[x.task_id,x])),byRaw=new Map();
 for(const d of defs.values()){const id='primary:'+JSON.stringify([d.block,d.primary]);if(!primaryGroups.has(id))primaryGroups.set(id,{id,block:d.block,label:d.primary});}
 for(const task of tasks.values())for(const id of task.member_ids)byRaw.set(id,task.task_id);
 const paths=u=>(t.unit_paths[u.id]||[]).map(id=>defs.get(id)).filter(Boolean);
 const primaryOptions=f=>[...primaryGroups.values()].filter(g=>!f.block||[].concat(f.block).includes(g.block));
 const secondaryOptions=f=>{const p=primaryGroups.get(f.typePrimary);return [...defs.values()].filter(d=>d.secondary&&(!f.block||[].concat(f.block).includes(d.block))&&(!p||d.block===p.block&&d.primary===p.label));};
 const units=f=>engine.unitResults(f).filter(u=>{const p=primaryGroups.get(f.typePrimary);return !p&&!f.typeSecondary||paths(u).some(d=>(!p||d.block===p.block&&d.primary===p.label)&&(!f.typeSecondary||d.id===f.typeSecondary));});
 function tree(us){const groups=new Map();for(const u of us)for(const d of paths(u)){const key=JSON.stringify([d.block,d.primary]);if(!groups.has(key))groups.set(key,{block:d.block,label:d.primary,ids:new Set()});groups.get(key).ids.add(u.id);}return [...groups.values()].map(g=>({block:g.block,label:g.label,count:g.ids.size,unit_ids:[...g.ids]}));}
 engine.teacherInclass=t.inclass;
 function occurrenceRows(f){const raw={...f};delete raw.inClass;let os=engine.occurrenceResults(raw);if(f.inClass)os=os.filter(o=>[].concat(f.inClass).some(v=>v===engine.readingInClass(o)));if(f.typePrimary||f.typeSecondary||f.type||f.ability){const ids=new Set(units(f).map(u=>u.id));os=os.filter(o=>engine.unitsForOccurrence(o).some(u=>ids.has(u.id)));}return os;}
 function workRecurrences(f){return engine.groupOccurrences(occurrenceRows(f));}
 function essayById(id){const task=tasks.get(id)||tasks.get(byRaw.get(id));return task?{...rawEssays.get(task.representative_id),task_id:task.task_id}:null;}
 function essayRows(f){return uniq(engine.essayResults(f).map(e=>byRaw.get(e.id))).map(essayById).filter(Boolean);}
 function annualRows(f){return t.annual.filter(r=>KQMatch(r.semester,f.semester)&&KQMatch(r.stage,f.stage)&&KQMatch(r.category,f.category)&&text([r.title,r.label,r.category,r.evidence,r.prompt_excerpt].join(' '),f.keyword));}
 function KQMatch(a,b){return !b||[].concat(b).some(x=>String(x)===String(a));}
 function text(s,word){return !word||word.trim().split(/\s+/).every(w=>s.normalize('NFKC').toLowerCase().includes(w.normalize('NFKC').toLowerCase()));}
 function answersForUnit(id){const a=t.answer_supplements[id];if(a)return [a];return (engine.unitMap.get(id)?.question_ids||[]).flatMap(qid=>{const a=engine.a.get(engine.q.get(qid)?.answer_id);return a?.text?[a]:[];});}
 function termLinks(w,term){const seen=new Set();return [...w.direct_links,...t.term_links.filter(l=>l.work_id===w.id)].filter(l=>l.term===term).filter(l=>{const k=JSON.stringify([l.legacy_question_id,l.term,l.level,l.evidence]);if(seen.has(k))return false;seen.add(k);return true;});}
 function comparableSchools(groups){if(groups.length<2)return {comparable:false,groups:[],strata:[]};const key=p=>p.year&&p.semester&&p.stage?JSON.stringify([p.year,p.semester,p.stage]):null,sets=groups.map(g=>new Set(g.papers.map(key).filter(Boolean))),common=[...sets[0]].filter(k=>sets.every(s=>s.has(k)));if(!common.length)return {comparable:false,groups:[],strata:[]};return {comparable:true,strata:common.map(JSON.parse),groups:groups.map(g=>{const papers=g.papers.filter(p=>common.includes(key(p))),ids=new Set(papers.map(p=>p.id)),us=g.units.filter(u=>ids.has(u.paper_id));return {...g,papers,units:us,count:engine.independentCount(papers),tree:tree(us)};})};}
 return {defs,primaryGroups,paths,primaryOptions,secondaryOptions,units,tree,occurrenceRows,workRecurrences,essayRows,essayById,annualRows,answersForUnit,termLinks,comparableSchools,evidence:t};
}return {create};});
