(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KQStageCharts=api;})(typeof window==='undefined'?globalThis:window,function(){'use strict';
const uniq=a=>[...new Set(a.filter(v=>v!==null&&v!==undefined&&v!==''))];
// Presentation only: unify outer book-title brackets for already confirmed classroom identities. Preserve authors, part numbers and all other characters.
const inclassTitle=title=>{const label=String(title||'').trim().replace(/[•・‧]/g,'·');return label.startsWith('《')?label:'《'+label+'》';};
const dimensions=[
 {id:'basic-points',block:0,title:'重点考点',unit:'涉及试卷数'},
 {id:'basic-forms',block:0,title:'主要任务形式',unit:'涉及试卷数'},
 {id:'poetry-structure',block:1,title:'命题组织方式',unit:'涉及试卷数'},
 {id:'poetry-inclass',block:1,title:'教材篇目直接阅读频率',unit:'涉及试卷数'},
 {id:'poetry-types',block:1,title:'鉴赏题型',unit:'涉及试卷数'},
 {id:'classical-structure',block:2,title:'阅读组合方式',unit:'涉及试卷数'},
 {id:'classical-inclass',block:2,title:'教材篇目直接阅读频率',unit:'涉及试卷数'},
 {id:'classical-types',block:2,title:'文言题型',unit:'涉及试卷数'},
 {id:'modern-themes',block:3,title:'文学类 · 阅读主主题',unit:'阅读材料数'},
 {id:'modern-literary-types',block:3,title:'文学类 · 阅读题型',unit:'涉及试卷数'},
 {id:'modern-nonliterary-types',block:3,title:'非文学类 · 阅读题型',unit:'涉及试卷数'},
 {id:'novel-works',block:4,title:'作品覆盖',unit:'涉及试卷数'},
 {id:'novel-types',block:4,title:'名著题型',unit:'涉及试卷数'},
 {id:'essay-forms',block:5,title:'命题形式',unit:'涉及试卷数'}
];
class ChartEngine{
 constructor(stage,evidence){this.stage=stage;this.e=stage.e;this.v=stage.v;this.ev=evidence;this.itemMap=new Map(this.e.data.exam_items.map(i=>[i.id,i]));}
 aggregate(filters={},options={}){
  const base=this.stage.aggregate(filters,options),e=this.e,v=this.v,pids=new Set(base.paper_ids),units=e.units.filter(u=>pids.has(u.paper_id)),unitById=new Map(units.map(u=>[u.id,u])),charts=dimensions.map(d=>({...d,rows:[],scope_paper_count:base.paper_count})),byId=new Map(charts.map(c=>[c.id,c])),buckets=new Map();
  const paperKey=id=>{const p=e.papers.get(id);return p?.independent_id||id;};
  const independentIds=ids=>[...new Map(ids.map(id=>[paperKey(id),id])).values()];
  const scopePaperIds=independentIds(base.paper_ids);
  const add=(dimension,label,info={})=>{if(!label)return;const c=byId.get(dimension),key=JSON.stringify(['chart',dimension,label]);if(!buckets.has(key))buckets.set(key,{key,block:c.block,dimension,dimension_title:c.title,label,paper_ids:[],unit_ids:[],occurrence_ids:[],essay_ids:[],materials:[],sources:[]});const r=buckets.get(key);for(const k of ['paper_ids','unit_ids','occurrence_ids','essay_ids','materials','sources'])r[k].push(...(info[k]||[]));};
  const info=u=>({paper_ids:[u.paper_id],unit_ids:[u.id]});
  const addOld=(dim,r)=>add(dim,r.label,{paper_ids:r.paper_ids,unit_ids:r.unit_ids,occurrence_ids:r.occurrence_ids,essay_ids:r.essay_ids,sources:r.sources});
  const basicDictionary=new Set(this.ev.basic_dictionary.map(x=>x.label)),basicPrimary=new Set(this.ev.basic_primary_labels.map(x=>x.label)),broadBasic=new Set(['字词基础','综合性学习','基础知识','基础知识积累应用','综合性学习与语言应用']);
  for(const r of base.blocks[0].rows.filter(r=>r.kind==='primary'&&!broadBasic.has(r.label)))addOld('basic-points',r);
  for(const u of units)for(const d of v.paths(u)){if(d.block!=='基础积累与语言运用'||!d.secondary||!broadBasic.has(d.primary))continue;const prefix=d.secondary.split('｜')[0];if(basicDictionary.has(prefix))add('basic-points',prefix,{...info(u),sources:[d.basis]});else if(prefix==='综合性学习'&&d.secondary.includes('｜'))add('basic-points',d.secondary,{...info(u),sources:[d.basis]});}
  const basicLabel=(primary,secondary,task)=>{for(const rule of this.ev.basic_hierarchy)if(rule.primary.includes(primary)&&rule.children.includes(secondary))return rule.parent;const exact=this.ev.basic_hierarchy.filter(rule=>[rule.parent,...rule.children].includes(task));if(exact.length===1)return exact[0].parent;const prefix=String(task||'').split('｜')[0];return basicDictionary.has(prefix)?prefix:basicDictionary.has(secondary)?secondary:basicDictionary.has(primary)?primary:basicPrimary.has(primary)&&!broadBasic.has(primary)?primary:null;};
  for(const r of this.stage.ev.source_rows){if(!pids.has(r.paper_id))continue;const ids=uniq(r.item_ids.map(id=>this.stage.itemUnits.get(id))).filter(id=>unitById.has(id));if(!ids.length)continue;
   const basic=r.item_ids.some(id=>['基础积累与语言运用','句子运用','名句默写','工具性知识','语文常识','综合阅读'].includes(this.itemMap.get(id)?.block))||['基础知识','字词基础','词语运用','句子运用','语言运用','古诗文积累','语文常识','工具性知识','综合性学习'].includes(r.primary)||basicDictionary.has(r.primary)||/默写/.test([r.secondary,r.task].join(' '));if(!basic)continue;
   const label=basicLabel(r.primary,r.secondary,r.task);
   if(label)add('basic-points',label,{paper_ids:[r.paper_id],unit_ids:ids,sources:[r.source]});
   if(r.form&&!['—','未知','未登记'].includes(r.form))add('basic-forms',r.form,{paper_ids:[r.paper_id],unit_ids:ids,sources:[r.source]});
  }
  for(const u of units)for(const iid of u.item_ids){const r=this.itemMap.get(iid);if(!r||e.papers.get(r.paper_id).batch==='baseline'||r.type_eligible===false||r.block!=='基础积累与语言运用')continue;const label=basicLabel(r.raw_primary_label||r.ability,r.raw_secondary_label||r.type,r.type);if(label)add('basic-points',label,{...info(u),sources:[r.source]});}
  for(const r of base.blocks[0].rows.filter(r=>r.kind==='task'&&r.label==='古诗文默写'))addOld('basic-points',r);
  for(const r of this.ev.inclass_reading_records||[]){if(!pids.has(r.paper_id)||!e.isEffectiveReading(e.o.get(r.occurrence_id)))continue;const ids=r.unit_ids.filter(id=>unitById.has(id));if(ids.length)add(r.block===1?'poetry-inclass':'classical-inclass',inclassTitle(r.title),{paper_ids:[r.paper_id],unit_ids:ids,occurrence_ids:[r.occurrence_id],sources:[{method:r.method,proof:r.proof,material_source:r.material_source}]});}
  const registeredInclass=new Set((this.ev.inclass_reading_records||[]).map(r=>r.occurrence_id));
  for(const o of e.data.occurrences){if(registeredInclass.has(o.id)||!pids.has(o.paper_id)||!e.isEffectiveReading(o))continue;const ic=e.readingInClass(o);if(!['课内','课内诵读'].includes(ic))continue;const poem=o.genres.some(g=>['古诗词','古诗阅读','七言律诗','七言绝句','元曲小令'].includes(g)),classical=o.genres.some(g=>['文言文','课内文言','课外文言'].includes(g)),block=poem&&!classical?1:classical&&!poem?2:o.blocks.includes('古诗词')&&!o.blocks.includes('文言文')?1:o.blocks.includes('文言文')&&!o.blocks.includes('古诗词')?2:null;if(block===null)continue;const ids=e.unitsForOccurrence(o).map(u=>u.id).filter(id=>unitById.has(id)).filter(id=>{const u=unitById.get(id);return !u.item_ids.length||!u.item_ids.every(iid=>/默写/.test(this.itemMap.get(iid)?.task||''));});if(ids.length)add(block===1?'poetry-inclass':'classical-inclass',inclassTitle(this.stage.registry.get(o.work_id)?.canonical_title||o.title),{paper_ids:[o.paper_id],unit_ids:ids,occurrence_ids:[o.id],sources:[{path:o.source_path,anchor:o.source_anchor,inclass:ic,basis:'本卷正式阅读身份及已核课内归属；默写排除'}]});}
  for(const r of this.ev.basic_audited_relations||[]){if(!pids.has(r.paper_id))continue;const ids=r.unit_ids.filter(id=>unitById.has(id));if(ids.length)add('basic-points',r.label,{paper_ids:[r.paper_id],unit_ids:ids,sources:[r.source]});}
  for(const r of this.ev.basic_form_records||[]){if(unitById.get(r.unit_id)?.paper_id===r.paper_id)add('basic-forms',r.label,{paper_ids:[r.paper_id],unit_ids:[r.unit_id],sources:[r.source]});}
  for(const r of base.blocks[1].rows.filter(r=>r.kind==='organization'&&['单篇鉴赏','双篇比较','多篇比较'].includes(r.label)))addOld('poetry-structure',r);
  for(const r of this.ev.poetry_organization_records||[])if(unitById.get(r.unit_id)?.paper_id===r.paper_id)add('poetry-structure',r.label,{paper_ids:[r.paper_id],unit_ids:[r.unit_id],occurrence_ids:r.occurrence_ids,sources:[r.source]});
  for(const [block,dim]of [[1,'poetry-types'],[2,'classical-types'],[4,'novel-types']])for(const r of base.blocks[block].rows.filter(r=>r.kind==='primary'))addOld(dim,r);
  // Existing explicit group classifications take priority; individual registered sides fill only other papers.
  const declared=base.blocks[2].rows.filter(r=>r.kind==='organization'),covered=new Set(declared.flatMap(r=>r.paper_ids));
  for(const r of declared)addOld('classical-structure',r);
  const structures={'课内外比较阅读':'课内与课外比较','纯课外比较阅读':'纯课外','课外单篇阅读':'纯课外','课内比较阅读':'课内阅读','课内单篇阅读':'课内阅读'};
  for(const r of base.blocks[2].rows.filter(r=>r.kind==='structure'&&structures[r.label])){const ps=r.paper_ids.filter(id=>!covered.has(id));if(ps.length)add('classical-structure',structures[r.label],{paper_ids:ps,unit_ids:r.unit_ids.filter(id=>ps.includes(unitById.get(id)?.paper_id)),occurrence_ids:r.occurrence_ids.filter(id=>ps.includes(e.o.get(id)?.paper_id)),sources:r.sources});}
  const litIds=new Set(),nonlitIds=new Set(),themeLabels=new Set(this.ev.literary_theme_dictionary.labels),themeMaterials=new Map(),registeredThemeOccurrences=new Set();
  for(const o of e.data.occurrences){if(!pids.has(o.paper_id)||!e.isEffectiveReading(o)||!o.blocks.includes('现代文阅读'))continue;const kind=globalThis.KQStages.modernKind(o),target=kind==='非文学类'?nonlitIds:kind==='文学类'?litIds:null;if(target)for(const u of e.unitsForOccurrence(o))if(unitById.has(u.id))target.add(u.id);}
  for(const r of this.ev.literary_theme_records){if(!pids.has(r.paper_id))continue;const ids=r.unit_ids.filter(id=>unitById.has(id));if(!ids.length)continue;const m={identity:r.identity,title:r.title,paper_id:r.paper_id,occurrence_ids:r.occurrence_ids,unit_ids:ids,main_theme:r.main_theme,source:r.source};themeMaterials.set(m.identity,m);r.occurrence_ids.forEach(id=>registeredThemeOccurrences.add(id));ids.forEach(id=>litIds.add(id));add('modern-themes',r.main_theme,{paper_ids:[r.paper_id],unit_ids:ids,occurrence_ids:r.occurrence_ids,materials:[m],sources:[r.source]});}
  for(const o of e.data.occurrences){if(registeredThemeOccurrences.has(o.id)||!pids.has(o.paper_id)||!e.isEffectiveReading(o)||!o.blocks.includes('现代文阅读'))continue;const identity=o.paper_id+'|'+o.work_id;if(themeMaterials.has(identity))continue;
   const qs=o.question_ids.map(id=>e.q.get(id)).filter(Boolean),ids=e.unitsForOccurrence(o).map(u=>u.id).filter(id=>unitById.has(id)),literary=ids.some(id=>litIds.has(id));if(!literary)continue;
   const labels=uniq(qs.filter(q=>q.theme_eligible===true).flatMap(q=>q.themes).filter(x=>themeLabels.has(x)));const m={identity,title:o.title,paper_id:o.paper_id,occurrence_ids:[o.id],unit_ids:ids,source:{path:o.source_path,anchor:o.source_anchor}};themeMaterials.set(identity,m);
   if(labels.length===1)add('modern-themes',labels[0],{paper_ids:[o.paper_id],unit_ids:ids,occurrence_ids:[o.id],materials:[{...m,main_theme:labels[0]}],sources:[m.source]});
  }
  for(const u of units)if(litIds.has(u.id)){
   for(const d of v.paths(u).filter(d=>d.block==='现代文阅读'&&d.secondary))add('modern-literary-types',d.secondary,{...info(u),sources:[d.basis]});
   if(!nonlitIds.has(u.id))for(const c of this.stage.verified.unit_categories?.[u.id]||[])if(c.block===3)add('modern-literary-types',c.label,{...info(u),sources:[c.source]});
  }
  for(const u of units)if(nonlitIds.has(u.id)){for(const d of v.paths(u).filter(d=>d.block==='现代文阅读'&&d.secondary))add('modern-nonliterary-types',d.secondary,{...info(u),sources:[d.basis]});for(const c of this.stage.verified.unit_categories?.[u.id]||[])if(c.block===3)add('modern-nonliterary-types',c.label,{...info(u),sources:[c.source]});}
  for(const r of base.blocks[4].rows.filter(r=>r.kind==='novel'))addOld('novel-works',r);
  const scopedEssay=new Set(e.essayResults({mainOnly:true}).filter(r=>pids.has(r.paper_id)).map(r=>r.id)),formAliases=new Map(this.ev.essay_form_aliases.map(r=>[r.from,r.to])),forms=new Set(['命题','半命题','话题','材料']);
  for(const task of v.evidence.essay_tasks){const raw=e.data.essays.filter(r=>task.member_ids.includes(r.id)&&scopedEssay.has(r.id));if(!raw.length)continue;const r=raw.find(r=>r.id===task.representative_id)||raw[0];if(r.eligible===false)continue;const ps=uniq(raw.map(r=>r.paper_id)),ids=units.filter(u=>raw.some(r=>r.paper_id===u.paper_id&&u.number_key===String(r.number).replace(/（/g,'(').replace(/）/g,')'))).map(u=>u.id),data={paper_ids:ps,unit_ids:ids,essay_ids:[r.id],sources:raw.map(r=>r.source)};
   const form=formAliases.get(r.form)||r.form;if(forms.has(form))add('essay-forms',form,data);
  }
  for(const r of this.ev.essay_form_records||[])if(scopedEssay.has(r.essay_id)&&unitById.get(r.unit_id)?.paper_id===r.paper_id&&forms.has(r.form))add('essay-forms',r.form,{paper_ids:[r.paper_id],unit_ids:[r.unit_id],essay_ids:[r.essay_id],sources:[r.source]});
  for(const raw of buckets.values()){
   const r={...raw};for(const k of ['paper_ids','unit_ids','occurrence_ids','essay_ids'])r[k]=uniq(r[k]);r.materials=[...new Map(r.materials.map(m=>[m.identity,m])).values()];
   const c=byId.get(r.dimension);r.paper_count=e.independentCount(r.paper_ids.map(id=>e.papers.get(id)));r.count=c.unit==='阅读材料数'?r.materials.length:r.paper_count;r.unit=c.unit;r.question_count=r.unit_ids.length;r.curriculum_scopes=r.dimension.endsWith('-inclass')?uniq(r.occurrence_ids.map(id=>e.curriculumScope(e.o.get(id))?.label)):[];r.curriculum_notes=r.dimension.endsWith('-inclass')?uniq([...r.curriculum_scopes,...(this.ev.inclass_reading_records||[]).filter(x=>r.occurrence_ids.includes(x.occurrence_id)).map(x=>x.curriculum_note)]):[];r.legacy_formal_occurrence_ids=r.occurrence_ids.filter(id=>e.o.get(id)?.formal_reading);r.supplemental_occurrence_ids=r.occurrence_ids.filter(id=>e.readingInfo(e.o.get(id)).supplemental);if(r.count&&r.unit_ids.length)c.rows.push(r);
  }
  const blockNames=[['基础积累与语言运用','句子运用','名句默写','工具性知识','语文常识','综合阅读'],['古诗词','古诗阅读'],['文言文'],['现代文阅读','文学类阅读','非文学类阅读'],['名著','名著阅读'],['作文','作文命题']];
  const unitsForBlock=b=>units.filter(u=>u.blocks.some(name=>blockNames[b].includes(name)));
  const knownNoExam=new Map((this.ev.absent_assessment_records||[]).map(r=>[r.paper_id+'|'+r.block,r]));
  const integratedPoetry=new Set((this.ev.poetry_organization_records||[]).filter(r=>r.label==='诗文合读').map(r=>r.paper_id));
  for(const c of charts){
   c.rows.sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'zh-CN'));
   const coverage=new Set(c.rows.flatMap(r=>r.paper_ids.map(paperKey)));
   c.covered_paper_ids=scopePaperIds.filter(id=>coverage.has(paperKey(id)));
   c.uncovered_paper_ids=scopePaperIds.filter(id=>!coverage.has(paperKey(id)));
   c.covered_papers=c.covered_paper_ids.length;
   const materialUnit=c.unit==='阅读材料数';
   c.denominator=materialUnit?themeMaterials.size:base.paper_count;
   if(materialUnit){
    const identities=new Set(c.rows.flatMap(r=>r.materials.map(m=>m.identity)));
    c.registered_materials=identities.size;
    c.unregistered_materials=[...themeMaterials.values()].filter(m=>!identities.has(m.identity));
   }
   const candidates=c.id==='modern-nonliterary-types'?[...nonlitIds].map(id=>unitById.get(id)):
    c.id==='modern-literary-types'?[...litIds].map(id=>unitById.get(id)):
    materialUnit?[...themeMaterials.values()]:unitsForBlock(c.block);
   const relevant=new Set([...candidates.map(u=>paperKey(u.paper_id)),...base.blocks[c.block].rows.filter(r=>r.kind==='work'||r.kind==='essay').flatMap(r=>r.paper_ids.map(paperKey))]);
   const typedCandidates=new Set(candidates.map(u=>paperKey(u.paper_id)));
   const typedSpecific=materialUnit||c.id==='modern-nonliterary-types'||c.id==='modern-literary-types';
   c.coverage_details=c.uncovered_paper_ids.map(id=>{
    const absent=knownNoExam.get(id+'|'+c.block);
    const status=absent?'confirmed_absent':c.id==='poetry-types'&&integratedPoetry.has(id)?'integrated_poetry':(typedSpecific?typedCandidates:relevant).has(paperKey(id))?'unclassified':
     typedSpecific&&relevant.has(paperKey(id))?'other_in_block':'no_record';
    return {paper_id:id,status,note:absent?.basis||''};
   });
   if(c.id.endsWith('-inclass')){
    const readingsByPaper=new Map();
    for(const id of uniq(base.blocks[c.block].rows.filter(r=>r.kind==='work').flatMap(r=>r.occurrence_ids))){
     const o=e.o.get(id);
     if(!e.unitsForOccurrence(o).some(u=>unitById.has(u.id)&&(!u.item_ids.length||!u.item_ids.every(iid=>/默写/.test(this.itemMap.get(iid)?.task||'')))))continue;
     const key=paperKey(o.paper_id);
     if(!readingsByPaper.has(key))readingsByPaper.set(key,[]);
     readingsByPaper.get(key).push(e.readingInClass(o));
    }
    c.only_outside_paper_ids=c.uncovered_paper_ids.filter(id=>{const tags=readingsByPaper.get(paperKey(id));return tags?.length&&tags.every(t=>t==='课外');});
    const outside=new Set(c.only_outside_paper_ids);
    for(const d of c.coverage_details)if(outside.has(d.paper_id))d.status='only_outside';
   }
   for(const r of c.rows){r.denominator=c.denominator;r.ratio=c.denominator?r.count/c.denominator:0;r.covered_papers=c.covered_papers;r.uncovered_papers=c.uncovered_paper_ids.length;r.registered_materials=c.registered_materials;}
  }
  return {...base,scope_paper_ids:scopePaperIds,chart_blocks:base.blocks.map(b=>({id:b.id,title:b.title,charts:charts.filter(c=>c.block===b.id)})),chart_metrics:charts.flatMap(c=>c.rows)};
 }
}
return {ChartEngine,dimensions,inclassTitle};});
