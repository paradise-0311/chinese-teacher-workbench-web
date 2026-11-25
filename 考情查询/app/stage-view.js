(function(root){'use strict';
root.KQStageView={create:function({stageEngine,engine,view,h,btn,show,meta,evidenceReader,onType}){
 const chartEngine=new KQStageCharts.ChartEngine(stageEngine,KQ_STAGE_CHART_EVIDENCE);let snapshot=null,visibleRows=[],visibleCharts=[];
 const shortUnit=unit=>unit==='阅读材料数'?'篇':'份';
 function bar(r){const unit=shortUnit(r.unit),fraction=r.count+'/'+r.denominator+unit;return '<li class="stage-bar-row" data-chart-value="'+r.count+'" data-denominator="'+r.denominator+'"><button class="stage-bar" data-action="stage-row" data-id="'+h(r.key)+'" aria-label="'+h(r.label+'，'+fraction+'，'+(r.ratio*100).toFixed(1)+'%，查看涉及试卷')+'"><span class="stage-bar-label">'+h(r.label)+((r.curriculum_notes||[]).length?'<small class="stage-curriculum-note">'+h(r.curriculum_notes.join('；'))+'</small>':'')+'</span><span class="stage-bar-value">'+r.count+'/'+r.denominator+'<small>'+unit+'</small></span><span class="stage-bar-track" aria-hidden="true"><span class="stage-bar-fill" style="width:'+(100*r.ratio).toFixed(3)+'%"></span></span></button></li>';}
 function chart(c){
  const material=c.unit==='阅读材料数',links=[];
  if(c.uncovered_paper_ids.length)links.push(btn('查看未计入的 '+c.uncovered_paper_ids.length+' 份','stage-row','coverage:'+c.id));
  if(c.unregistered_materials?.length)links.push(btn('查看主主题待核的 '+c.unregistered_materials.length+' 篇','stage-row','materials:'+c.id));
  return '<section class="stage-chart '+(material?'stage-chart-theme':'')+'" data-chart="'+c.id+'" data-unit="'+c.unit+'" data-denominator="'+c.denominator+'"><header><h3>'+h(c.title)+'</h3></header>'+
    (c.rows.length?'<ol class="stage-bar-list">'+c.rows.slice(0,5).map(bar).join('')+'</ol>':'<p class="stage-no-data">当前范围暂无可计入此图的记录。</p>')+
    (c.rows.length>5?'<details class="stage-chart-more"><summary>查看其余 '+(c.rows.length-5)+' 个类别</summary><ol class="stage-bar-list" start="6">'+c.rows.slice(5).map(bar).join('')+'</ol></details>':'')+
    (links.length?'<p class="stage-chart-coverage">'+links.join(' · ')+'</p>':'')+'</section>';
 }
 function block(b){return '<section class="stage-chart-block" data-stage-block="'+b.id+'"><header class="stage-block-heading"><h2>'+btn(b.title,'stage-block',b.id,'text-button')+'</h2></header><div class="stage-chart-grid">'+b.charts.map(chart).join('')+'</div><p class="stage-block-evidence">'+btn(b.id===5?'查阅作文原题':'查阅本板块原题','stage-content',b.id)+'</p></section>';}
 function scopeLabel(f){
  const norm=v=>String(v).replace(/(\d{4})\s*[-—–－]\s*(\d{4})/g,'$1—$2');
  const years=[...new Set(snapshot.scope_paper_ids.map(id=>engine.papers.get(id)?.year).filter(Boolean).map(norm))].sort();
  const parts=[f.semester||'全部学期',f.stage==='第一次月考'?'月考':f.stage||'全部阶段',
    f.year?norm(f.year)+'学年':years.length?'全部学年（'+years.join('、')+'）':'全部学年'];
  if(f.school?.length){const names=[...new Set(snapshot.scope_paper_ids.map(id=>engine.papers.get(id)?.school).filter(Boolean))];if(names.length)parts.push(names.join('、'));}
  if(f.sourceGroup)parts.push('来源：'+f.sourceGroup);
  if(f.keyword)parts.push('关键词：'+f.keyword);
  return parts.join(' · ');
 }
 function render(f){snapshot=chartEngine.aggregate(f);visibleRows=[];visibleCharts=[];if(!snapshot.paper_ids.length)return '<div class="empty"><h2>当前范围没有匹配试卷</h2><p>可以更换关键词或其他查询条件。</p>'+btn('重置筛选','reset','','secondary')+'</div>';
  const chosen=f.stageBlock!==''&&f.stageBlock!==undefined?Number(f.stageBlock):null,blocks=chosen===null?snapshot.chart_blocks:snapshot.chart_blocks.filter(b=>b.id===chosen);visibleCharts=blocks.flatMap(b=>b.charts);visibleRows=visibleCharts.flatMap(c=>c.rows);
  return '<nav class="stage-switch" aria-label="选择考情板块">'+btn('六板块总览','stage-block','','stage-tab'+(chosen===null?' selected':''))+KQStages.names.map((name,id)=>'<button class="stage-tab'+(chosen===id?' selected':'')+'" data-action="stage-block" data-id="'+id+'" aria-current="'+(chosen===id?'true':'false')+'">'+h(name)+'</button>').join('')+'</nav><div class="stage-chart-overview">'+blocks.map(block).join('')+'</div>';
 }
 function row(key){if(key.startsWith('content:')){const b=snapshot?.blocks[Number(key.slice(8))];if(!b)return;return {key,block:b.id,label:b.title,unit_ids:[...new Set(b.rows.flatMap(r=>r.unit_ids))],paper_ids:b.paper_ids,occurrence_ids:[...new Set(b.rows.flatMap(r=>r.occurrence_ids))],essay_ids:[...new Set(b.rows.flatMap(r=>r.essay_ids))],materials:snapshot.chart_metrics.filter(r=>r.block===b.id).flatMap(r=>r.materials)};}return snapshot?.chart_metrics.find(r=>r.key===key);}
 function records(key){
  if(key.startsWith('materials:')){const c=visibleCharts.find(c=>c.id===key.slice(10));return (c?.unregistered_materials||[]).map(m=>evidenceReader.model.forMaterial(m));}
  const r=row(key);return r?evidenceReader.model.forRow(r):[];
 }
 function grouped(r){return evidenceReader.list(evidenceReader.model.forRow(r),'stage-record',rec=>JSON.stringify([r.key,rec.id]));}
 function open(key){
  if(key.startsWith('coverage:'))return openCoverage(key.slice(9));
  if(key.startsWith('materials:')){const rs=records(key);if(!rs.length)return false;show('<h2>主主题待核的文学材料（'+rs.length+' 篇）</h2>'+evidenceReader.list(rs,'stage-record',rec=>JSON.stringify([key,rec.id])),'材料清单');return true;}
  const r=row(key);if(!r)return false;if(onType&&KQBrowseFlow.isTypeDimension(r.dimension)){onType(r);return true;}show('<h2>'+ (r.block===5?'作文题目与出处':r.block===0||r.block===4?'题目与出处':'篇目与出处')+'</h2>'+grouped(r),'选择考试记录');return true;
 }
 function openRecord(value){const [key,id]=JSON.parse(value);return evidenceReader.open(records(key).find(r=>r.id===id));}
 // Retain the old handler as a direct-reading compatibility route; the regular UI no longer emits it.
 function openPaper(value){const [key,pid]=JSON.parse(value),rs=records(key).filter(r=>r.paper_id===pid);if(!rs.length)return false;show(rs.map(evidenceReader.render).join(''),'原文、题目与答案');return true;}
 function content(id){return open('content:'+id);}
 function paperLinks(ids,notes=new Map()){
  const list=ids.map(id=>engine.papers.get(id)).filter(Boolean).sort((a,b)=>String(a.year||'').localeCompare(String(b.year||''))||String(a.school||'').localeCompare(String(b.school||''),'zh-CN')||a.id.localeCompare(b.id));
  return '<ul class="stage-content-list">'+list.map(p=>'<li>'+btn(meta(p),'paper',p.id)+(p.title?'<small>'+h(p.title)+'</small>':'')+(notes.get(p.id)?'<small>'+h(notes.get(p.id))+'</small>':'')+'</li>').join('')+'</ul>';
 }
 function openCoverage(id){
  const c=snapshot?.chart_blocks.flatMap(b=>b.charts).find(c=>c.id===id);
  if(!c?.uncovered_paper_ids.length)return false;
  const labels={
   only_outside:'已确认直接阅读材料均为课外',confirmed_absent:'已确认未考该板块',integrated_poetry:'诗文合读，相关题目见文言题型',
   unclassified:id.endsWith('-inclass')?'有阅读记录，暂无确认可计入的教材篇目':c.unit==='阅读材料数'?'有文学材料，主主题待核':'有相关考查，分类或标签待核',
   other_in_block:'有现代文考查，暂无本图对应材料记录',no_record:'暂无相关考查记录'
  };
  const groups=Object.entries(labels).map(([status,label])=>{
   const rs=c.coverage_details.filter(r=>r.status===status);
   return rs.length?'<h3>'+h(label+'（'+rs.length+' 份）')+'</h3>'+paperLinks(rs.map(r=>r.paper_id),new Map(rs.map(r=>[r.paper_id,r.note]))):'';
  }).join('');
  const explanation=id.endsWith('-inclass')?'只统计有原题对应、直接阅读教材正文的试卷。默写、仅提到教材篇目或仅作迁移的不计入。':
    c.unit==='阅读材料数'?'以下试卷没有材料计入已确认主主题。图中的分母是材料篇数，这里列的是试卷。':'这些试卷没有任何一项计入本图。可能没有对应考查，也可能尚未登记或核实。';
  show('<h2>'+h(c.title)+'：未计入的 '+c.uncovered_paper_ids.length+' 份</h2><p>'+h(explanation)+'</p>'+groups,'统计范围核对');
  return true;
 }
 function papers(){show('<h2>筛中的 '+snapshot.paper_count+' 份试卷</h2><p>'+h(scopeLabel(snapshot.filters))+'</p>'+paperLinks(snapshot.scope_paper_ids),'试卷目录');}
 return {render,open,openRecord,openPaper,content,papers,records,snapshot:()=>snapshot,metrics:()=>visibleRows,charts:()=>visibleCharts};
}};})(window);
