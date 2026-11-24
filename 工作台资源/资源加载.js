(function(){'use strict';
const pending=new Map();
function loadScript(path,options={}){
 const url=new URL(path,document.baseURI).href,verify=options.verify||(()=>true);
 if(options.verify&&verify())return Promise.resolve();if(pending.has(url))return pending.get(url);
 const promise=new Promise((resolve,reject)=>{let attempt=0,settled=false;
  function run(){
   const script=document.createElement('script');script.src=url;script.async=false;attempt++;
   const timer=setTimeout(()=>{if(settled)return;settled=true;reject(Error('资源加载超时，请检查网络后重新打开：'+path));},options.timeout||120000);
   script.onload=()=>{clearTimeout(timer);if(settled)return;if(!verify()){failed();return;}settled=true;resolve();};script.onerror=()=>{clearTimeout(timer);failed();};
   function failed(){script.remove();if(settled)return;if(attempt<(options.attempts||3)){document.dispatchEvent(new CustomEvent('rc4-resource-retry',{detail:{path,attempt}}));setTimeout(run,attempt*250);}else{settled=true;reject(Error('资源加载失败（已尝试'+attempt+'次），请检查网络后重试：'+path));}}
   document.head.appendChild(script);
  }run();});
 pending.set(url,promise);promise.catch(()=>pending.delete(url));return promise;
}
window.RC4StaticLoader={loadScript};
})();
