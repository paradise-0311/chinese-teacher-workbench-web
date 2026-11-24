(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KQBrowseFlow=api;})(typeof window==='undefined'?globalThis:window,function(){'use strict';
const has=v=>Array.isArray(v)?v.length>0:!!String(v??'').trim();
const any=(f,keys)=>keys.some(k=>has(f[k]));
function mode(page,f={},executed=false,topic='essays'){
 if(page==='stages')return 'overview';
 if(page==='types')return executed||any(f,['keyword','typePrimary','typeSecondary','type','ability'])?'results':has(f.block)?'categories':'entry';
 if(page==='papers')return executed||any(f,['keyword','school','sourceGroup'])?'results':'entry';
 if(page==='texts')return executed||any(f,['keyword','genre','theme','inClass'])?'results':has(f.block)?'categories':'entry';
 if(topic==='textbook')return executed||any(f,['textbookTitle','term','textbookSemester','relationYear','relationSource','relationKind'])?'results':'categories';
 if(topic==='implicit')return executed||any(f,['keyword','category'])?'results':'categories';
 return executed||any(f,['keyword','essayForm','theme'])?'results':'entry';
}
const preview=(text,limit=120)=>{const s=String(text||'').replace(/\s+/g,' ').trim();return s.length>limit?s.slice(0,limit)+'…':s;};
const typeDimensions=new Set(['basic-points','poetry-types','classical-types','modern-literary-types','modern-nonliterary-types','novel-types']);
function createArticleContext(engine,stage,chartEvidence){
 const byUnit=new Map(),add=(id,title,proof)=>{if(!title)return;if(!byUnit.has(id))byUnit.set(id,[]);const rows=byUnit.get(id),label=engine.curriculumTitle(title);if(!rows.some(r=>r.title===label))rows.push({title:label,proof});};
 for(const o of engine.data.occurrences){if(!engine.isEffectiveReading(o))continue;for(const u of engine.unitsForOccurrence(o))if(u.paper_id===o.paper_id)add(u.id,o.title,{kind:'confirmed_reading',occurrence_id:o.id,paper_id:o.paper_id});}
 for(const r of chartEvidence.literary_theme_records||[])for(const id of r.unit_ids||[])if(engine.unitMap.get(id)?.paper_id===r.paper_id)add(id,r.title,{kind:'reviewed_literary_record',paper_id:r.paper_id,source:r.source});
 for(const r of stage.ev.novel_relations||[]){const ids=[...(r.item_ids||[]).map(id=>stage.itemUnits.get(id)),...(r.question_ids||[]).map(id=>stage.qUnits.get(id))];for(const id of ids)if(engine.unitMap.get(id)?.paper_id===r.paper_id)add(id,r.title,{kind:'confirmed_novel_task',paper_id:r.paper_id,source:r.source});}
 return u=>{const revisions=u.question_ids.map(id=>engine.q.get(id)).filter(q=>q?.revision_document);if(revisions.length)return revisions.filter(q=>q.work_title).map(q=>({title:engine.curriculumTitle(q.work_title),proof:{kind:'user_confirmed_revision',question_id:q.id,paper_id:q.paper_id}}));return byUnit.get(u.id)||[];};
}
return {mode,preview,createArticleContext,isTypeDimension:id=>typeDimensions.has(id)};
});
