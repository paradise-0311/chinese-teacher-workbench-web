(function () {
  'use strict';
  var expected = '806c1dee090f3fe07a4a', release = 'v1.2.0-web-perf-3c';
  var report = {schema:'phase3c-phone-diagnostic-1', release:release, expectedDataVersion:expected, userAgent:navigator.userAgent, page:location.href, startedAt:new Date().toISOString(), checks:[], errors:[], current:null};
  var frame = document.getElementById('app'), running = false, timer = null, lastSignature = '', key = 'kq-phase3c-last-state';
  function el(id) { return document.getElementById(id); }
  function snapshot() { return JSON.stringify(report, null, 2); }
  function display() { el('json').value = snapshot(); }
  function error(kind, e) { var row = {at:new Date().toISOString(), kind:kind, name:e.name || 'Error', message:e.message || String(e), stack:e.stack || null}; report.errors.push(row); display(); return row; }
  function request(path, done) {
    var x = new XMLHttpRequest(), start = Date.now(), settled = false;
    function finish(problem, value) { if(settled)return; settled=true; done(problem, value, {url:x.responseURL || path, status:x.status, mime:x.getResponseHeader('Content-Type'), elapsedMs:Date.now()-start, responseChars:(x.responseText || '').length}); }
    x.open('GET', path + (path.indexOf('?') < 0 ? '?' : '&') + 'release=' + release, true); x.timeout = 20000;
    x.onload = function () { if(x.status < 200 || x.status >= 300) { finish(new Error('HTTP ' + x.status)); return; } try { finish(null, JSON.parse(x.responseText)); } catch(e) { finish(e); } };
    x.onerror = function () { finish(new Error('NetworkError')); };
    x.ontimeout = function () { finish(new Error('DiagnosticTimeout: 20000ms')); };
    x.onabort = function () { finish(new Error('AbortError')); }; x.send();
  }
  el('version').textContent = '基础诊断代码已运行；尚未发起网络请求。';
  try { var previous = JSON.parse(localStorage.getItem(key) || 'null'); if(previous)el('checkpoint').textContent = '此前保存的最后状态：' + JSON.stringify(previous) + '。这不代表之后曾完成，也不能据此判断是否为系统回收。'; } catch(e) { el('checkpoint').textContent = '无法读取本地检查点：' + e.message; }
  el('check').onclick = function () {
    el('version').textContent = '正在读取发布信息…';
    request('release-info.json', function (problem, info, timing) {
      report.checks.push({name:'release-info', timing:timing, success:!problem});
      if(problem) { error('release-info', problem); el('version').textContent = problem.message; return; }
      report.releaseInfo = info;
      if(info.dataVersion !== expected) { error('version', new Error('发布信息与当前诊断版本不一致，请刷新入口。')); el('version').textContent = '版本不一致：' + info.dataVersion; return; }
      request(info.manifest, function (failure, m, network) {
        var count = m && m.resources ? Object.keys(m.resources).length : 0;
        var valid = !failure && m.schema === 'kq-layered-1' && m.version === expected && count === 614;
        report.checks.push({name:'manifest', success:valid, dataVersion:m && m.version, resourceCount:count, timing:network});
        if(failure)error('manifest', failure);
        else if(!valid)error('manifest', new Error('manifest版本、schema或614资源数量不一致'));
        el('version').textContent = valid ? release + '\n实际数据版本：' + m.version + '\n资源：' + count + '片；正式试卷：' + m.mainPapers + '；有效阶段：' + m.stages.length + '\n清单已读取，未下载全部分片。' : '清单检查未通过，请复制诊断JSON。'; display();
      });
    });
  };
  function collect() {
    if(!running)return;
    try {
      var w = frame.contentWindow, d = w.KQDataLoader, ui = w.KQ_V02_UI;
      if(!d) { el('status').textContent = '真实入口已发起；基础程序尚未建立数据加载器。'; return; }
      var s = JSON.parse(JSON.stringify(d.state)), failed = [], name, item, last = s.events.length ? s.events[s.events.length-1] : null;
      for(name in s.resources)if(Object.prototype.hasOwnProperty.call(s.resources,name)) { item=s.resources[name]; if(item.status==='failed')failed.push({id:name,detail:item}); }
      var ready = w.document.body && w.document.body.getAttribute('data-phase3c') === 'ready';
      report.current = {observedAt:new Date().toISOString(), url:w.location.href, dataVersion:s.version, versionMatches:s.version===expected, appReady:ready, lastEvent:last, failedResources:failed, state:s, filters:ui ? ui.filters() : null, summary:w.document.getElementById('summary') ? w.document.getElementById('summary').textContent : null, statusText:w.document.getElementById('phase3cLoadState') ? w.document.getElementById('phase3cLoadState').textContent : null};
      el('status').textContent = s.version && s.version !== expected ? '检测到不同数据版本，请停止并保存报告。' : failed.length ? '发现失败分片；下方保留实际错误，可在考情页重试。' : ready ? '当前入口已完成首次筛选和渲染；可继续真实业务操作。' : '当前版本正在加载；仅记录实际完成的阶段。';
      var completed = 0; for(name in s.resources)if(Object.prototype.hasOwnProperty.call(s.resources,name) && s.resources[name].status==='ready')completed++;
      el('last').textContent = '实际数据版本：' + s.version + '\n已完成资源：' + completed + '\n核心试卷已载入：' + s.loadedPaperIds.length + '\n正在请求：' + s.active + '\n最后事件：' + JSON.stringify(last) + '\n失败资源：' + JSON.stringify(failed);
      var sig = s.version + '|' + s.events.length + '|' + ready + '|' + failed.length;
      if(sig !== lastSignature) { lastSignature=sig; display(); try { localStorage.setItem(key,JSON.stringify({at:new Date().toISOString(), version:s.version, appReady:ready, completedResources:completed, loadedPapers:s.loadedPaperIds.length, active:s.active, lastEvent:last, failed:failed})); } catch(e) {} }
    } catch(e) { error('observe-app',e); }
  }
  frame.onload = function () {
    if(!running)return;
    try {
      var w = frame.contentWindow;
      w.addEventListener('error',function (e) { report.errors.push({kind:'app-error',name:e.error && e.error.name || 'Error',message:e.message,file:e.filename,line:e.lineno,column:e.colno,stack:e.error && e.error.stack || null}); display(); },false);
      w.addEventListener('unhandledrejection',function (e) { error('app-unhandledrejection',e.reason || new Error('Unknown rejection')); },false);
    } catch(e) { error('attach-app-errors',e); }
    collect();
  };
  el('start').onclick = function () {
    if(timer)clearInterval(timer);
    var route = el('route').value.replace(/^\s+|\s+$/g,'');
    if(route && route.charAt(0) !== '#') { error('route',new Error('仅填写以 # 开始的本站历史路由。')); return; }
    running=true; lastSignature=''; report.current=null;
    frame.hidden=false; frame.src='考情查询/打开考情查询.html?release='+release+'&phone='+Date.now()+(route || '#stages');
    report.appStartedAt=new Date().toISOString(); el('status').textContent='正在打开真实的第三阶段C考情入口…'; timer=setInterval(collect,500); display();
  };
  el('copy').onclick = function () { collect(); display(); el('json').focus(); el('json').select(); try { if(!document.execCommand('copy'))throw new Error('请长按文本框手动复制'); } catch(e) { el('status').textContent='请长按诊断JSON文本框手动复制。'; } };
  el('download').onclick = function () { collect(); display(); try { var b=new Blob([snapshot()],{type:'application/json;charset=utf-8'}),u=(window.URL || window.webkitURL),url=u.createObjectURL(b),a=document.createElement('a'); a.href=url; a.download='phase3c-phone-diagnostic-'+Date.now()+'.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function(){u.revokeObjectURL(url);},30000); } catch(e) { error('download',e); el('status').textContent='下载未能触发，请手动复制诊断JSON。'; } };
  window.addEventListener('error',function(e){error('diagnostic-page',e.error || new Error(e.message));},false);
  window.addEventListener('unhandledrejection',function(e){error('diagnostic-rejection',e.reason || new Error('Unknown rejection'));},false);
  display();
})();
