(function(root){'use strict';if(root.RC4BankResources)return;
const pending=new Map(),done=new Map(),events=[];let listener=()=>{};
function emit(data){const event={at:performance.now(),...data};events.push(event);if(events.length>2000)events.shift();listener(event);document.dispatchEvent(new CustomEvent('rc4-bank-resource',{detail:event}));}
function error(kind,message,detail){return Object.assign(new Error(message),{name:kind,stage:/Integrity|Size|Version/.test(kind)?'content-verification':/Parse/.test(kind)?'parse':/Verification/.test(kind)?'object-verification':'download',...detail});}
async function digest(bytes){const value=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(value),v=>v.toString(16).padStart(2,'0')).join('');}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,meta,version){
 const key=version+'|'+url+'|'+meta.sha256;if(done.has(key))return done.get(key);if(pending.has(key))return pending.get(key);
 const task=(async()=>{let last;let cache=null;try{cache=await caches.open('rc4-bank-3d-'+version);}catch{}
  const verify=async bytes=>{if(bytes.byteLength!==meta.bytes)throw error('SizeError','文件长度与版本清单不一致',{url});if(await digest(bytes)!==meta.sha256)throw error('IntegrityError','文件内容与版本清单不一致',{url});let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch(e){throw error('JSONParseError','JSON内容无法解析',{url,stage:'parse'});}if(value.version!==version)throw error('VersionError','题库数据版本不匹配',{url});return value;};
  if(cache)try{const hit=await cache.match(url);if(hit){const value=await verify(await hit.arrayBuffer());done.set(key,value);emit({url,stage:'cache',kind:meta.kind,cached:true});return value;}}catch{try{await cache.delete(url);}catch{}}
  for(let attempt=1;attempt<=3;attempt++){
   const abort=new AbortController();let timer,totalTimer;const start=performance.now();let loaded=0;
   const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>abort.abort(),30000);};
   emit({url,stage:'download',attempt,attempts:3,kind:meta.kind,loaded:0,total:meta.bytes});
   try{totalTimer=setTimeout(()=>abort.abort('total'),90000);arm();const response=await fetch(url,{signal:abort.signal,cache:attempt===1?'default':'reload'});if(!response.ok)throw error('HTTPError','HTTP '+response.status,{url,status:response.status});if(!/json/.test(response.headers.get('content-type')||''))throw error('MIMEError','JSON资源响应类型不正确',{url});
    let bytes;if(response.body?.getReader){const reader=response.body.getReader(),parts=[];for(;;){const {value,done:ended}=await reader.read();if(ended)break;loaded+=value.byteLength;if(loaded>meta.bytes)throw error('SizeError','响应超过版本清单长度',{url});parts.push(value);arm();emit({url,stage:'download',attempt,kind:meta.kind,loaded,total:meta.bytes});}bytes=new Uint8Array(loaded);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}}
    else bytes=new Uint8Array(await response.arrayBuffer());
    clearTimeout(timer);clearTimeout(totalTimer);emit({url,stage:'verify',attempt,kind:meta.kind,loaded:bytes.byteLength,total:meta.bytes});const value=await verify(bytes);done.set(key,value);if(cache)try{await cache.put(url,new Response(bytes,{headers:{'Content-Type':'application/json'}}));}catch{}
    emit({url,stage:'ready',attempt,kind:meta.kind,elapsedMs:performance.now()-start,loaded:bytes.byteLength,total:meta.bytes});return value;
   }catch(e){clearTimeout(timer);clearTimeout(totalTimer);last=abort.signal.aborted?error(abort.signal.reason==='total'?'DownloadTimeout':'StallTimeout',abort.signal.reason==='total'?'分片下载超过90秒有限上限':'连续30秒未收到数据',{url,stage:'download',attempt,loaded,total:meta.bytes}):Object.assign(e,{url,attempt,loaded,total:meta.bytes,stage:e.stage||'download'});emit({url,stage:'failure',attempt,kind:meta.kind,errorType:last.name,message:last.message,loaded,total:meta.bytes});if(attempt<3)await wait(attempt*300);}
  }throw last;
 })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
function script(url,meta,verify,options={}){
 url=new URL(url,document.baseURI).href;
 const key=url+'|'+(meta?.sha256||'');if(done.has(key)){if(!verify||verify())return Promise.resolve();done.delete(key);}if(pending.has(key))return pending.get(key);
 const task=(async()=>{let last;for(let attempt=1;attempt<=3;attempt++){
  emit({url,stage:'script-download',attempt,attempts:3,kind:options.kind||'script'});
  try{await new Promise((resolve,reject)=>{const element=document.createElement('script');let settled=false,executionError=null,policyError=false;
   const onError=e=>{if(e.filename===url||e.error?.fileName===url)executionError=e.error||error('ScriptError',e.message,{url});};
   const onPolicy=e=>{if(e.blockedURI===url&&e.violatedDirective?.includes('script-src'))policyError=true;};
   const finish=err=>{if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener('error',onError);document.removeEventListener('securitypolicyviolation',onPolicy);if(err){element.remove();reject(err);}else resolve();};
   const timer=setTimeout(()=>finish(error('ScriptTimeout','脚本等待超过有限上限',{url,attempt,stage:'script-download'})),options.timeout||60000);
   window.addEventListener('error',onError);document.addEventListener('securitypolicyviolation',onPolicy);element.async=true;element.src=url;
   if(meta?.sha256){element.integrity='sha256-'+btoa(String.fromCharCode(...new Uint8Array(meta.sha256.match(/../g).map(x=>parseInt(x,16)))));}
   element.onload=()=>{if(executionError)return finish(executionError);try{if(verify&&!verify())return finish(error('VerificationError','脚本未建立所需业务对象',{url,attempt,stage:'object-verification'}));finish();}catch(e){finish(e);}};
   element.onerror=()=>finish(error(policyError?'CSPError':'ScriptNetworkOrIntegrityError',policyError?'CSP阻止资源执行':'脚本网络或完整性校验失败（浏览器未提供HTTP状态）',{url,attempt,stage:'script-download'}));document.head.appendChild(element);
  });done.set(key,true);emit({url,stage:'ready',attempt,kind:options.kind||'script'});return;
  }catch(e){last=Object.assign(e,{url,attempt,stage:e.stage||(/SyntaxError|ScriptError/.test(e.name)?'script-execution':'script-download')});emit({url,stage:'failure',attempt,kind:options.kind||'script',errorType:e.name,message:e.message});if(attempt<3)await wait(attempt*300);}
 }throw last;})();pending.set(key,task);return task.finally(()=>pending.delete(key));
}
root.RC4BankResources={json,script,digest,observe:fn=>{listener=fn;},state:()=>({pending:[...pending.keys()],loaded:[...done.keys()],events})};
})(window);
