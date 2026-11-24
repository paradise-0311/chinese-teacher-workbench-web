(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KQEvidenceReader=api;})(typeof window==='undefined'?globalThis:window,function(){'use strict';
const uniq=a=>[...new Set(a.filter(x=>x!==null&&x!==undefined&&x!==''))];
const numeric=new Intl.Collator('zh-CN',{numeric:true});
const mainNumber=u=>String(u.number_key||u.number).match(/^\d+/)?.[0]||u.number_key||u.number;

// This is a display projection of existing relations. It never writes a fact or a statistic.
function createModel(engine,view,stage){
 const e=engine,items=new Map(e.data.exam_items.map(i=>[i.id,i])),unitsByPaper=new Map(),groupCache=new Map();
 for(const u of e.units){if(!unitsByPaper.has(u.paper_id))unitsByPaper.set(u.paper_id,[]);unitsByPaper.get(u.paper_id).push(u);}
 const sortUnits=ids=>uniq(ids).map(id=>e.unitMap.get(id)).filter(Boolean).sort((a,b)=>numeric.compare(a.number_key,b.number_key)||a.id.localeCompare(b.id));
 const paperUnits=pid=>unitsByPaper.get(pid)||[];
 const occurrenceUnits=o=>e.unitsForOccurrence(o);
 const readingBlock=o=>e.readingBlocks(o).includes('古诗词')?1:e.readingBlocks(o).includes('文言文')?2:e.readingBlocks(o).includes('现代文阅读')?3:null;
 const title=o=>stage.registry.get(o.work_id)?.canonical_title||o.title||'未题名阅读材料';
 function groups(pid,block){
  const key=JSON.stringify([pid,block]);if(groupCache.has(key))return groupCache.get(key);
  const os=e.data.occurrences.filter(o=>o.paper_id===pid&&e.isEffectiveReading(o)&&readingBlock(o)===block),byId=new Map(os.map(o=>[o.id,o])),edges=new Map(os.map(o=>[o.id,new Set()])),link=(a,b)=>{if(a!==b&&byId.has(a)&&byId.has(b)){edges.get(a).add(b);edges.get(b).add(a);}};
  for(const o of os)for(const id of o.paired_ids||[])link(o.id,id);
  for(const g of stage.ev.comparison_groups||[]){const ids=g.occurrence_ids.filter(id=>byId.has(id));for(const a of ids)for(const b of ids)link(a,b);}
  // A shared original question/material is an explicit source relation, not a title match.
  const originals=new Map();for(const o of os)for(const qid of o.question_ids||[]){const q=e.q.get(qid);if(q?.paper_id!==pid)continue;for(const ref of ['q:'+qid,...(q.material_id?['m:'+q.material_id]:[])]){if(!originals.has(ref))originals.set(ref,[]);originals.get(ref).push(o.id);}}
  for(const ids of originals.values())for(const a of ids)for(const b of ids)link(a,b);
  const seen=new Set(),out=[];for(const o of os){if(seen.has(o.id))continue;const queue=[o.id],ids=[];while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);ids.push(id);queue.push(...edges.get(id));}out.push(ids.map(id=>byId.get(id)));}
  groupCache.set(key,out);return out;
 }
 function record(kind,pid,ids,os=[],extra={}){const us=sortUnits(ids).filter(u=>u.paper_id===pid),occurrence_ids=uniq(os.map(o=>o.id));return {id:JSON.stringify([kind,pid,extra.task_id||occurrence_ids,us.map(u=>u.id)]),kind,paper_id:pid,unit_ids:us.map(u=>u.id),occurrence_ids,title:extra.title||uniq(os.map(title)).join(' ＋ ')||us.map(u=>'第'+u.number+'题').join('、'),...extra};}
 function taskRecords(pid,ids,block){
  const grouped=new Map();for(const u of sortUnits(ids)){const key=mainNumber(u);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(u);}
  return [...grouped].map(([number,us])=>{let names=[];if(block===4){for(const r of stage.ev.novel_relations.filter(r=>r.paper_id===pid)){const linked=uniq([...(r.item_ids||[]).map(id=>stage.itemUnits.get(id)),...(r.question_ids||[]).map(id=>stage.qUnits.get(id))]);if(us.some(u=>linked.includes(u.id))){names.push(r.title);if(r.chapter_display&&r.chapter)names.push(r.chapter);}}names.push(...us.flatMap(u=>u.question_ids.map(id=>e.q.get(id)?.work_title)).map(t=>t==='朝花夕拾'?'《朝花夕拾》':t));}
   return record(block===4?'novel':'task',pid,us.map(u=>u.id),[],{title:[...uniq(names),'第'+number+'题'].join(' · ')});
  });
 }
 function forRow(row){
  const out=[];for(const pid of row.paper_ids){const selected=sortUnits(row.unit_ids).filter(u=>u.paper_id===pid),ids=new Set(selected.map(u=>u.id)),used=new Set();
   if(row.block===5){const taskSeen=new Set();for(const eid of row.essay_ids||[]){const essay=view.essayById(eid);if(!essay||essay.paper_id!==pid||taskSeen.has(essay.task_id))continue;taskSeen.add(essay.task_id);const task=view.evidence.essay_tasks.find(t=>t.task_id===essay.task_id),members=e.data.essays.filter(x=>task.member_ids.includes(x.id)&&x.paper_id===pid),numbers=new Set(members.map(x=>String(x.number).replace(/（/g,'(').replace(/）/g,')'))),uis=selected.filter(u=>numbers.has(u.number_key)).map(u=>u.id);uis.forEach(id=>used.add(id));out.push(record('essay',pid,uis,[],{title:view.evidence.essay_titles[essay.id]?.title||essay.title||'材料作文 · 第'+essay.number+'题',task_id:essay.task_id,essay_id:essay.id,member_ids:task.member_ids}));}}
   else if([1,2,3].includes(row.block)){
    for(const os of groups(pid,row.block)){const linked=uniq(os.flatMap(o=>occurrenceUnits(o).map(u=>u.id))).filter(id=>ids.has(id));if(!linked.length)continue;linked.forEach(id=>used.add(id));out.push(record('reading',pid,linked,os));}
    // Reviewed modern-text records can exist before their material body is attached.
    for(const m of row.materials||[]){if(m.paper_id!==pid)continue;const linked=(m.unit_ids||[]).filter(id=>ids.has(id)&&!used.has(id));if(!linked.length)continue;linked.forEach(id=>used.add(id));out.push(record('reading',pid,linked,[],{title:m.title,material_identity:m.identity}));}
   }
   const remaining=selected.filter(u=>!used.has(u.id));if(remaining.length)out.push(...taskRecords(pid,remaining.map(u=>u.id),row.block));
  }
  return out.sort((a,b)=>row.paper_ids.indexOf(a.paper_id)-row.paper_ids.indexOf(b.paper_id)||numeric.compare(sortUnits(a.unit_ids)[0]?.number_key||'',sortUnits(b.unit_ids)[0]?.number_key||''));
 }
 function forOccurrence(o){
  const block=readingBlock(o),os=groups(o.paper_id,block).find(g=>g.some(x=>x.id===o.id))||[o];
  return record('reading',o.paper_id,occurrenceUnits(o).map(u=>u.id),os,{title:uniq(os.map(title)).join(' ＋ ')});
 }
 function forWork(id,filters){
  const os=view.occurrenceRows({...filters,workId:id}),out=[],seen=new Set();for(const o of os){const r=forOccurrence(o);const matching=os.filter(x=>r.occurrence_ids.includes(x.id)),ids=uniq(matching.flatMap(x=>occurrenceUnits(x).map(u=>u.id)));r.unit_ids=sortUnits(ids).map(u=>u.id);r.id=JSON.stringify(['work',id,r.paper_id,r.occurrence_ids,r.unit_ids]);if(!seen.has(r.id)){seen.add(r.id);out.push(r);}}
  return out;
 }
 function forUnit(id){const u=e.unitMap.get(id);if(!u)return null;const revised=u.question_ids.some(id=>e.q.get(id)?.revision_document),os=revised?[]:e.data.occurrences.filter(o=>o.paper_id===u.paper_id&&e.isEffectiveReading(o)&&occurrenceUnits(o).some(x=>x.id===id));return record('unit',u.paper_id,[id],os,{title:'第'+u.number+'题'});}
 function forEssay(id){const essay=view.essayById(id);if(!essay)return null;return record('essay',essay.paper_id,[],[],{title:view.evidence.essay_titles[essay.id]?.title||essay.title||'材料作文 · 第'+essay.number+'题',task_id:essay.task_id,essay_id:essay.id});}
 function materialBodies(r){
  const us=sortUnits(r.unit_ids),qs=us.flatMap(u=>u.question_ids.map(id=>e.q.get(id))).filter(q=>q?.paper_id===r.paper_id&&!q.revision_document),ms=uniq(qs.map(q=>q.material_id)).map(id=>e.m.get(id)).filter(m=>m?.paper_id===r.paper_id),os=r.occurrence_ids.map(id=>e.o.get(id)).filter(o=>o?.paper_id===r.paper_id),pieces=[...ms.filter(m=>m.text).map(m=>({text:m.text,html:m.rich_html,material_ids:[m.id],occurrence_ids:[],source:{path:m.source_path,anchor:m.source_anchor},warnings:m.warnings||[]})),...os.filter(o=>o.text).map(o=>({text:o.text,html:o.rich_html,material_ids:[],occurrence_ids:[o.id],source:{path:o.source_path,anchor:o.source_anchor},warnings:o.warnings||[]}))];
  const bodies=[];for(const piece of pieces){const exact=bodies.find(x=>x.text===piece.text);if(exact){exact.material_ids.push(...piece.material_ids);exact.occurrence_ids.push(...piece.occurrence_ids);}else bodies.push({...piece});}
  // Remove only an exact substring already present in another displayed original. Never rewrite text.
  return bodies.filter((x,i)=>!bodies.some((y,j)=>i!==j&&y.text.length>x.text.length&&y.text.includes(x.text)));
 }
 function unitContent(u){
  const qs=u.question_ids.map(id=>e.q.get(id)).filter(q=>q?.paper_id===u.paper_id),supplement=view.evidence.answer_supplements[u.id],raw=uniq(u.item_ids.map(id=>items.get(id)?.answer).filter(Boolean)),questions=qs.length?qs.map(q=>({id:q.id,text:q.text||q.reviewed_excerpt||'',html:q.rich_html,source:{path:q.source_path,anchor:q.source_anchor}})):[{id:null,text:u.text||'',source:u.source,excerpt:true}],answers=[];
  if(supplement?.text)answers.push({id:null,text:supplement.text,kind:supplement.kind,source:supplement.source,unit_id:u.id});
  else for(const q of qs){const a=e.a.get(q.answer_id);if(a?.text&&(!a.question_id||a.question_id===q.id))answers.push({id:a.id,question_id:q.id,text:a.text,html:a.rich_html,kind:a.status,limitations:a.limitations,source:{path:a.source_path,anchor:a.source_anchor}});}
  if(!answers.length)for(const text of raw)answers.push({id:null,text,kind:'本题原表参考答案',source:u.source});
  return {unit:u,questions,answers,missing_answer_question_ids:!supplement?.text&&!raw.length?qs.filter(q=>!answers.some(a=>a.question_id===q.id)).map(q=>q.id):[],revision:qs.find(q=>q.revision_document)||null};
 }
 function forMaterial(m){return record('reading',m.paper_id,m.unit_ids,m.occurrence_ids.map(id=>e.o.get(id)).filter(Boolean),{title:m.title,task_id:m.identity});}
 return {forRow,forWork,forOccurrence,forUnit,forEssay,forMaterial,materialBodies,unitContent,sortUnits,groups,paperUnits};
}

function create({engine,view,stageEngine,h,show,meta,originalLinks,versionNote}){
 const model=createModel(engine,view,stageEngine),e=engine;
 const source=r=>meta(e.papers.get(r.paper_id))||e.papers.get(r.paper_id)?.title||'考试出处尚未登记';
 function list(records,action,encode){return '<ul class="evidence-record-list">'+records.map(r=>'<li><button type="button" class="evidence-record" data-action="'+action+'" data-id="'+h(encode(r))+'"><span class="evidence-record-title">'+h(r.title)+'</span><span class="evidence-record-source">'+h(source(r))+'</span></button></li>').join('')+'</ul>';}
 function render(r){
  const p=e.papers.get(r.paper_id);let html='<div class="evidence-reading" data-reading-record="'+h(r.id)+'" data-paper-id="'+h(r.paper_id)+'"><h2>'+h(r.title)+'</h2><p class="reading-source">'+h(source(r))+'</p>';
  if(r.kind==='essay'){const essay=view.essayById(r.essay_id);return html+'<section class="reading-section" data-essay-task="'+h(r.task_id)+'"><h3>作文原题与写作要求</h3><pre>'+h(essay?.prompt||'本页尚未收录作文原题，请查阅原卷。')+'</pre></section>'+origin(p)+'</div>';}
  const bodies=model.materialBodies(r),isReading=r.kind==='reading'||bodies.length>0;
  if(isReading){html+='<section class="reading-section"><h3>阅读材料</h3>'+(bodies.length?bodies.map(b=>b.html?'<div class="source-rich" data-original-material="'+h(JSON.stringify(b.material_ids))+'">'+b.html+'</div>':'<pre data-original-material="'+h(JSON.stringify(b.material_ids))+'">'+h(b.text)+'</pre>').join(''):'<p class="reading-missing">本页尚未收录材料原文，请查阅原卷。题目和答案仍按本卷登记显示。</p>')+(bodies.some(b=>(b.warnings||[]).some(w=>/图片|图形/.test(w)))?'<p class="reading-missing">原材料含图片或图形，图内内容请查阅原卷。</p>':'')+'</section>';}
  const parts=model.sortUnits(r.unit_ids).map(model.unitContent);
  for(const part of parts){const u=part.unit;html+='<section class="reading-question" data-reader-unit="'+h(u.id)+'"><h3>第'+h(u.number)+'题</h3><h4>题干</h4>'+part.questions.map(q=>(q.html?'<div class="source-rich" data-reader-question="'+h(q.id)+'">'+q.html+'</div>':'<pre'+(q.id?' data-reader-question="'+h(q.id)+'"':'')+'>'+h(q.text||'本页尚未收录完整题干，请查阅原卷。')+'</pre>')+(q.excerpt?'<p class="reading-missing">仅有原表登记内容，完整题面请查阅原卷。</p>':'')).join('')+'<h4>参考答案</h4>'+(part.answers.length?part.answers.map(a=>(a.html?'<div class="source-rich" data-reader-answer="'+h(a.id)+'">'+a.html+'</div>':'<pre'+(a.id?' data-reader-answer="'+h(a.id)+'"':'')+'>'+h(a.text)+'</pre>')+(a.limitations?'<p class="reading-missing">'+h(a.limitations)+'</p>':'')).join('')+(part.missing_answer_question_ids.length?'<p class="reading-missing">本题部分参考答案尚未收录，请查阅原卷或解析。</p>':''):'<p class="reading-missing">本页暂未提供本题参考答案，请查阅原卷或解析。</p>')+'</section>';}
  const revisions=parts.filter(p=>p.revision);if(revisions.length)html+=revisions.map(p=>versionNote(p.revision)).join('');
  const notes=[];for(const id of r.occurrence_ids){const o=e.o.get(id);if(!o)continue;const ri=e.readingInfo(o),cs=e.curriculumScope(o);if(ri.supplement)notes.push(ri.registration+'：'+ri.supplement.reason);if(ri.exclusion)notes.push(ri.exclusion.reason);if(cs)notes.push(cs.label);}
  notes.push(...parts.flatMap(p=>p.answers.map(a=>a.kind)).filter(x=>x&&x!=='confirmed'));
  html+=(notes.length?'<details class="reading-provenance"><summary>来源与核验信息</summary>'+uniq(notes).map(n=>'<p>'+h(n)+'</p>').join('')+'</details>':'')+origin(p)+'</div>';return html;
 }
 function origin(p){return '<footer class="reading-origin"><h3>原卷出处</h3><p>'+h(p?.title||'原卷出处尚未登记')+'</p>'+(p?.source_files?.length?originalLinks(p):'<p class="reading-missing">原卷文件尚未挂接。</p>')+'</footer>';}
 function open(record){if(!record)return false;show(render(record),record.kind==='essay'?'作文原题与写作要求':'原文、题目与答案');return true;}
 return {model,list,render,open,source};
}
return {createModel,create};
});
