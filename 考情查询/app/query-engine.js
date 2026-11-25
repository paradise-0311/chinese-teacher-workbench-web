(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KQQuery=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const uniq=a=>[...new Set(a.filter(v=>v!==null&&v!==undefined&&v!==''))];
const norm=v=>String(v??'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
const number=v=>String(v??'').replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10)).replace(/（/g,'(').replace(/）/g,')').replace(/\s+/g,'').toLowerCase();
const choices=v=>Array.isArray(v)?v:v?[v]:[];
const matches=(actual,selected)=>!choices(selected).length||choices(selected).some(v=>choices(actual).map(norm).includes(norm(v)));
const textMatch=(text,term)=>!term||String(term).trim().split(/\s+/).every(w=>norm(text).includes(norm(w)));
const titleSearch=v=>String(v??'').replace(/[《》〈〉＜＞<>·•・]/g,'');
const groupBy=(rows,get)=>{const m=new Map();for(const r of rows){const k=get(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
class Engine{
 constructor(data,research){
  this.data=data;this.research=research;this.papers=new Map(data.papers.map(x=>[x.id,x]));this.q=new Map(data.questions.map(x=>[x.id,x]));this.a=new Map(data.answers.map(x=>[x.id,x]));this.o=new Map(data.occurrences.map(x=>[x.id,x]));this.m=new Map(data.materials.map(x=>[x.id,x]));
  this.qByKey=groupBy(data.questions,q=>q.paper_id+'|'+number(q.number_key||q.number));this.itemsByKey=groupBy(data.exam_items,r=>r.paper_id+'|'+number(r.number_key||r.number));
  this.units=[];const keys=uniq([...this.itemsByKey.keys(),...this.qByKey.keys()]);
  for(const key of keys){
   const items=this.itemsByKey.get(key)||[],qs=this.qByKey.get(key)||[],first=items[0]||qs[0];const qualified=qs.filter(q=>q.type_eligible!==false);
   const types=uniq(qualified.flatMap(q=>q.types||[]));if(!types.length)types.push(...uniq(items.filter(i=>i.type_eligible!==false).map(i=>i.type)));
   const themes=uniq(qs.filter(q=>q.theme_eligible!==false).flatMap(q=>q.themes||[]));if(!themes.length)themes.push(...uniq(items.filter(i=>i.theme_eligible!==false).map(i=>i.theme)));
   const row={id:'unit:'+key,paper_id:first.paper_id,number:first.number,number_key:number(first.number_key||first.number),question_ids:qs.map(q=>q.id),item_ids:items.map(i=>i.id),types,themes,
    blocks:uniq([...qs.flatMap(q=>q.blocks||[]),...items.map(i=>i.block)]),genres:uniq([...qs.flatMap(q=>q.genres||[]),...items.map(i=>i.genre)]),abilities:uniq([...qs.filter(q=>q.ability_eligible!==false).flatMap(q=>q.abilities||[]),...items.filter(i=>i.ability_eligible!==false).map(i=>i.ability)]),
    text:qs.map(q=>q.text||q.reviewed_excerpt||'').join('\n')||items.map(i=>i.question_text||i.task||'').join('\n'),source:items[0]?.source||qs[0]?.source,
    label_status:uniq(qs.map(q=>q.label_status).concat(items.map(i=>i.status))).join('；')};
   row.search=[row.number,row.text,...qs.flatMap(q=>[q.work_title,q.primary_label,q.secondary_label,...(q.auxiliary_detection_points||[])]),...row.types,...row.themes,...row.blocks,...row.genres,...row.abilities,this.paperText(this.papers.get(row.paper_id))].join(' ');this.units.push(row);
  }
  this.unitMap=new Map(this.units.map(u=>[u.id,u]));this.paperSearch=new Map();for(const p of data.papers)this.paperSearch.set(p.id,[this.paperText(p),p.full_text,...this.units.filter(u=>u.paper_id===p.id).map(u=>u.search),...data.occurrences.filter(o=>o.paper_id===p.id&&o.formal_reading).flatMap(o=>[o.title,o.text,...o.themes,...o.genres])].join(' '));
  this.configureReadingPolicy(globalThis.KQ_VERIFIED_UPDATES||{},globalThis.KQ_STAGE_CHART_EVIDENCE||{},globalThis.KQ_STAGE_EVIDENCE||{},globalThis.KQ_READING_POLICY||{});
 }
 configureReadingPolicy(verified={},chart={},stage={},extra={}){
  this.readingSupplements=new Map((verified.stage_reading||[]).map(r=>[r.occurrence_id,r]));
  this.readingExclusions=new Map([...(chart.reading_exclusions||[]),...(extra.exclusions||[])].map(r=>[r.occurrence_id,r]));
  this.readingUnitLinks=new Map((stage.occurrence_unit_links||[]).map(r=>[r.occurrence_id,r.numbers||[]]));
  this.curriculumRecords=new Map((chart.inclass_reading_records||[]).map(r=>[r.occurrence_id,r]));
  this.curriculumScopes=extra.curriculum_scopes||{};this.readingInclass={...Object.fromEntries(Object.entries(verified.inclass||{}).map(([id,r])=>[id,r.value])),...Object.fromEntries(Object.entries(chart.inclass_overrides||{}).map(([id,r])=>[id,r.value])),...(extra.inclass||{})};
  this.readingWorkGroups=new Map();
  // Only the already audited classroom identities may share an outer-bracket display group.
  for(const r of chart.inclass_reading_records||[]){const o=this.o.get(r.occurrence_id);if(o)this.readingWorkGroups.set(o.work_id,'curriculum:'+this.curriculumTitle(r.title));}
  for(const p of this.data.papers)this.paperSearch.set(p.id,[this.paperText(p),p.full_text,...this.units.filter(u=>u.paper_id===p.id).map(u=>u.search),...this.data.occurrences.filter(o=>o.paper_id===p.id&&this.isEffectiveReading(o)).flatMap(o=>[o.title,o.text,...o.themes,...o.genres])].join(' '));
 }
 curriculumTitle(title){const label=String(title||'').trim().replace(/[•・‧]/g,'·');return label.startsWith('《')?label:'《'+label+'》';}
 readingInfo(o){const supplemental=this.readingSupplements?.get(o.id),exclusion=this.readingExclusions?.get(o.id);return {legacy_formal:!!o.formal_reading,supplemental:!!supplemental,effective:!!(o.formal_reading||supplemental)&&!exclusion,registration:supplemental?'补充确认阅读关系':o.formal_reading?'既有正式材料登记':'其他材料关系',supplement: supplemental||null,exclusion:exclusion||null};}
 isEffectiveReading(o){return this.readingInfo(o).effective;}
 readingInClass(o){return this.readingInclass?.[o.id]||this.curriculumRecords?.get(o.id)?.inclass||this.teacherInclass?.[o.id]||o.in_class;}
 curriculumScope(o){return this.curriculumScopes?.[o.id]||null;}
 readingBlocks(o){const poem=o.genres.some(g=>['古诗词','古诗阅读','七言律诗','七言绝句','元曲小令'].includes(g)),classical=o.genres.some(g=>['文言文','课内文言','课外文言'].includes(g));return poem&&!classical?['古诗词']:classical&&!poem?['文言文']:o.blocks;}
 unitsForOccurrence(o){const qids=new Set(o.question_ids||[]),numbers=new Set([...(o.formal_question_numbers||[]),...(this.readingUnitLinks?.get(o.id)||[])].map(number));return this.units.filter(u=>u.paper_id===o.paper_id&&(u.question_ids.some(id=>qids.has(id))||numbers.has(u.number_key)));}
 readingWorkKey(o){return o.reading_group_id||this.readingWorkGroups?.get(o.work_id)||o.work_id;}
 workMatches(o,id){return o.work_id===id||(o.reading_group_id&&this.data.occurrences.some(x=>x.work_id===id&&x.reading_group_id===o.reading_group_id))||this.readingWorkKey(o)===(this.readingWorkGroups?.get(id)||id);}
 groupOccurrences(os){return [...groupBy(os,o=>this.readingWorkKey(o))].map(([key,rows])=>({work_id:rows[0].work_id,work_ids:uniq(rows.map(o=>o.work_id)),display_key:key,title:rows[0].reading_group_title||(key.startsWith('curriculum:')?key.slice(11):rows[0].title),titles:uniq(rows.map(o=>o.title)),count:rows.length,occurrence_ids:rows.map(o=>o.id),paper_ids:uniq(rows.map(o=>o.paper_id)),paper_count:this.independentCount(uniq(rows.map(o=>o.paper_id)).map(id=>this.papers.get(id))),legacy_formal_count:rows.filter(o=>o.formal_reading).length,supplemental_count:rows.filter(o=>this.readingInfo(o).supplemental).length})).sort((a,b)=>b.paper_count-a.paper_count||a.title.localeCompare(b.title,'zh-CN'));}
 paperText(p){return p?[p.title,p.id,p.code,p.year,p.semester,p.stage,p.school,...p.schools,p.source_type,p.source_group].join(' '):'';}
 scopedPapers(f={}){
  return this.data.papers.filter(p=>matches(p.year,f.year)&&matches(p.semester,f.semester)&&matches(p.stage,f.stage)&&matches(p.schools,f.school)&&matches(p.source_type,f.sourceType)&&matches(p.source_group,f.sourceGroup)&&matches(p.answer_status,f.answerStatus)&&matches(this.originalStatus(p),f.originalStatus)&&matches(p.batch,f.batch)&&(!f.mainOnly||p.main_sample));
 }
 originalStatus(p){return !p.source_files.length?'未挂接原卷':p.source_files.some(f=>String(f.path).startsWith('assets/'))?'主包内原卷':'扩展包原卷';}
 paperResults(f={}){return this.scopedPapers(f).filter(p=>textMatch(this.paperSearch.get(p.id)||this.paperText(p),f.keyword));}
 unitResults(f={}){
  const ids=new Set(this.scopedPapers(f).map(p=>p.id));
  return this.units.filter(u=>ids.has(u.paper_id)&&matches(u.blocks,f.block)&&matches(u.abilities,f.ability)&&matches(u.types,f.type)&&matches(u.themes,f.theme)&&matches(u.genres,f.genre)&&textMatch(u.search,f.keyword));
 }
 occurrenceResults(f={}){
  const ids=new Set(this.scopedPapers(f).map(p=>p.id));
  const registry=new Map((this.data.work_registry||[]).map(w=>[w.id,w]));
  return this.data.occurrences.filter(o=>ids.has(o.paper_id)&&(f.allMaterials||(f.readingMode==='legacy_formal'?o.formal_reading:this.isEffectiveReading(o)))&&(!f.workId||this.workMatches(o,f.workId))&&matches(f.readingMode==='legacy_formal'?o.blocks:this.readingBlocks(o),f.block)&&matches(o.genres,f.genre)&&matches(o.themes,f.theme)&&(!f.inClass||matches(this.readingInClass(o),f.inClass))&&textMatch(titleSearch([o.title,o.reading_group_title,o.text,...(registry.get(o.work_id)?.aliases||[]),o.author_source,...o.themes,...o.genres,...o.exam_modes,this.paperText(this.papers.get(o.paper_id))].join(' ')),titleSearch(f.keyword)));
 }
 workRecurrences(f={}){return this.groupOccurrences(this.occurrenceResults(f));}
 essayResults(f={}){const ids=new Set(this.scopedPapers(f).map(p=>p.id));return this.data.essays.filter(e=>ids.has(e.paper_id)&&matches(e.form,f.essayForm||f.type)&&matches(e.theme,f.theme)&&textMatch([e.title,e.prompt,e.form,e.theme,this.paperText(this.papers.get(e.paper_id))].join(' '),f.keyword));}
 essayStats(f={}){const es=this.essayResults(f).filter(e=>e.eligible!==false);const formLabel=x=>({'半命题':'半命题作文','命题':'命题作文','材料':'材料作文','话题':'话题作文'}[x]||x);const collect=(key,normalize)=>{const groups=new Map();for(const e of es){const label=normalize?normalize(e[key]):e[key];if(!label)continue;if(!groups.has(label))groups.set(label,[]);groups.get(label).push(e.id);}return [...groups].map(([label,ids])=>({label,essay_ids:ids,count:ids.length,denominator:es.length,unit:'作文题目记录'})).sort((a,b)=>b.count-a.count);};return {forms:collect('form',formLabel),themes:collect('theme'),total:es.length};}
 independentCount(papers){return new Set(papers.map(p=>p.independent_id||p.id)).size;}
 distributions(units,field,denominator){
  const groups=new Map();
  for(const u of units)for(const label of uniq(u[field]||[])){if(!groups.has(label))groups.set(label,{label,unit_ids:[],paper_ids:[]});const g=groups.get(label);g.unit_ids.push(u.id);g.paper_ids.push(u.paper_id);}
  return [...groups.values()].map(g=>({...g,count:g.unit_ids.length,paper_count:this.independentCount(uniq(g.paper_ids).map(id=>this.papers.get(id))),denominator,unit:'原题定位（试卷×原题号）',paper_ids:uniq(g.paper_ids)})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'zh-CN'));
 }
 scoreDistribution(papers,units){
  const allowed=new Set(units.map(u=>u.paper_id+'|'+u.number_key)),scores=new Map(),coverage=[];let incomplete=0,assignedGroups=0;
  const add=(label,score,pid)=>{if(!label||!Number.isFinite(score))return;if(!scores.has(label))scores.set(label,{label,score:0,groups:0,paper_ids:new Set()});const g=scores.get(label);g.score+=score;g.groups++;g.paper_ids.add(pid);};
  for(const p of papers){
   const allUnits=this.units.filter(u=>u.paper_id===p.id),items=this.data.exam_items.filter(i=>i.paper_id===p.id);
   const dedup=[...groupBy(items,i=>number(i.number_key||i.number))].map(([key,rs])=>({key,rows:rs,groupKeys:uniq(rs.map(i=>i.score_group_key)),score:uniq(rs.map(i=>i.score).filter(Number.isFinite)),totals:uniq(rs.map(i=>i.group_score).filter(Number.isFinite)),blocks:uniq(rs.map(i=>i.block))}));
   const groups=groupBy(dedup,i=>i.groupKeys.length===1?i.groupKeys[0]:i.key.match(/^\d+/)?.[0]||i.key);let known=0,missingGroups=0;const issues=[];
   for(const [main,group] of groups){
    const totals=uniq(group.flatMap(i=>i.totals)),blocks=uniq(group.flatMap(i=>i.blocks)),direct=group.every(i=>i.score.length===1&&i.blocks.length===1&&i.score[0]>=0);
    let allocations=[],complete=false;
    if(direct){allocations=group.map(i=>({key:i.key,block:i.blocks[0],score:i.score[0]}));const sum=allocations.reduce((s,i)=>s+i.score,0);complete=totals.length<=1&&(!totals.length||Math.abs(sum-totals[0])<1e-6);if(!complete)issues.push('第'+main+'题小问合计与父题分值不一致');}
    else if(totals.length===1&&blocks.length===1&&totals[0]>=0){allocations=[{keys:group.map(i=>i.key),block:blocks[0],score:totals[0]}];complete=true;}
    else{allocations=group.filter(i=>i.score.length===1&&i.blocks.length===1&&i.score[0]>=0).map(i=>({key:i.key,block:i.blocks[0],score:i.score[0]}));issues.push('第'+main+'题分值缺失、冲突或跨板块不能拆分');}
    known+=allocations.reduce((s,i)=>s+i.score,0);if(!complete)missingGroups++;
    const selected=group.filter(i=>allowed.has(p.id+'|'+i.key));
    if(selected.length){if(!complete)incomplete++;else assignedGroups++;for(const a of allocations){if(a.keys?a.keys.every(k=>allowed.has(p.id+'|'+k)):allowed.has(p.id+'|'+a.key))add(a.block,a.score,p.id);}}
   }
   const mapped=new Set(dedup.map(i=>i.key)),unmapped=allUnits.filter(u=>!mapped.has(u.number_key));if(unmapped.length){missingGroups+=unmapped.length;issues.push(unmapped.length+'个题目定位无分值登记');incomplete+=unmapped.filter(u=>allowed.has(p.id+'|'+u.number_key)).length;}
   const declared=Number.isFinite(p.total_score)?p.total_score:null,evidence=!!(p.score_verification?.source_path&&p.score_verification?.basis);
   if(declared===null)issues.push('原登记没有可核验整卷满分');else if(!evidence)issues.push('整卷满分来源尚未核验');
   if(declared!==null&&Math.abs(known-declared)>1e-6)issues.push('已确认板块分值与整卷满分未核平');
   const selectionComplete=allUnits.length>0&&allUnits.every(u=>allowed.has(p.id+'|'+u.number_key));
   const complete=declared!==null&&evidence&&groups.size>0&&missingGroups===0&&Math.abs(known-declared)<1e-6;
   coverage.push({paper_id:p.id,declared_total:declared,confirmed_score:known,missing_points:declared!==null?Math.max(0,declared-known):null,overrun_points:declared!==null?Math.max(0,known-declared):null,incomplete_groups:missingGroups,complete,selection_complete:selectionComplete,issues,verification_source:p.score_verification||null});
  }
  const comparable=coverage.length>0&&coverage.every(p=>p.complete&&p.selection_complete),total=[...scores.values()].reduce((s,g)=>s+g.score,0),wholeTotal=comparable?coverage.reduce((s,p)=>s+p.declared_total,0):null;
  return {total,assigned_groups:assignedGroups,incomplete_groups:incomplete,comparable,whole_total:wholeTotal,coverage,complete_papers:coverage.filter(p=>p.complete).length,scope_papers:coverage.length,missing_paper_ids:coverage.filter(p=>!p.complete).map(p=>p.paper_id),partial_selection:coverage.some(p=>!p.selection_complete),status:comparable?'整卷分值完整且核平，可比较':'分值结构或统计范围不完整，暂不显示整卷占比',rows:[...scores.values()].map(g=>({...g,paper_ids:[...g.paper_ids],paper_count:g.paper_ids.size,ratio:comparable&&wholeTotal?g.score/wholeTotal:null})).sort((a,b)=>b.score-a.score)};
 }
 stats(f={}){
  const papers=this.scopedPapers({...f,mainOnly:true}),ids=new Set(papers.map(p=>p.id));const units=this.unitResults(f).filter(u=>ids.has(u.paper_id));const denominator=this.independentCount(papers);
  const os=this.occurrenceResults({...f,readingMode:'legacy_formal'}).filter(o=>ids.has(o.paper_id)),effective=this.occurrenceResults(f).filter(o=>ids.has(o.paper_id));const unitKeys=new Set(units.map(u=>u.paper_id+'|'+u.number_key));
  return {papers:papers.length,independent_papers:denominator,units:units.length,extracted_questions:this.data.questions.filter(q=>ids.has(q.paper_id)).length,
   detection_points:this.data.detection_points.filter(x=>ids.has(x.paper_id)&&unitKeys.has(x.paper_id+'|'+number(x.number_key||x.number))).length,
   formal_occurrences:os.length,distinct_works:new Set(os.map(o=>o.work_id).filter(Boolean)).size,effective_reading_relations:effective.length,supplemental_reading_relations:effective.filter(o=>this.readingInfo(o).supplemental).length,
   blocks:this.distributions(units,'blocks',units.length),abilities:this.distributions(units,'abilities',units.length),types:this.distributions(units,'types',units.length),themes:this.distributions(units,'themes',units.length),genres:this.distributions(units,'genres',units.length),scores:this.scoreDistribution(papers,units),
   unlabeled_type_units:units.filter(u=>!u.types.length).length,primary_only_valid:this.data.questions.filter(q=>ids.has(q.paper_id)&&unitKeys.has(q.paper_id+'|'+number(q.number_key||q.number))&&q.classification_status==='一级有效，无需二级').length,pending_nonempty_secondary:this.data.questions.filter(q=>ids.has(q.paper_id)&&unitKeys.has(q.paper_id+'|'+number(q.number_key||q.number))&&q.classification_status==='非空二级标签待ChatGPT审核').length,unit_ids:units.map(u=>u.id)};
 }
 schoolResults(f={}){
  const papers=this.scopedPapers({...f,mainOnly:true});const names=uniq(papers.flatMap(p=>p.schools));
  return names.map(name=>{const ps=papers.filter(p=>p.schools.includes(name));const pids=new Set(ps.map(p=>p.id));return {name,paper_ids:ps.map(p=>p.id),count:this.independentCount(ps),years:uniq(ps.map(p=>p.year)),source_groups:uniq(ps.map(p=>p.source_group)),units:this.unitResults(f).filter(u=>pids.has(u.paper_id)).length};}).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
 }
 classicalResults(f={}){
  return this.research.classical.works.map(w=>{const all=[...w.five_term_links,...w.direct_links,...w.other_historical_links];const matched=all.filter(l=>matches(l.source_type,f.relationSource)&&matches(l.year,f.relationYear)&&(!f.relationKind||f.relationKind==='five'&&w.five_term_links.includes(l)||f.relationKind==='direct'&&w.direct_links.includes(l)));return {...w,matching_links:matched};}).filter(w=>matches(w.current_textbook?.册次||w.historical_semester,f.textbookSemester)&&textMatch(w.title,f.textbookTitle)&&(!f.term||w.knowledge.some(k=>textMatch(k.term,f.term))||w.direct_links.some(l=>textMatch(l.term,f.term)))&&(!(f.relationSource||f.relationYear||f.relationKind)||w.matching_links.length>0));
 }
 annualResults(f={}){return this.research.implicit2026.records.filter(r=>matches(r.semester,f.semester)&&matches(r.stage,f.stage)&&textMatch([r.title,r.label,r.old_label,r.evidence,r.type,r.verdict].join(' '),f.keyword));}
}
return {Engine,uniq,norm,number,matches,textMatch,groupBy};
});
