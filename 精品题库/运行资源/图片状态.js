(function(){'use strict';
const root=document.getElementById('app'),states=new WeakMap();
function register(image){
 if(!RC4BankLoader.mediaInfo(image.getAttribute('src')||''))return null;
 RC4BankLoader.decorateImage(image);
 if(!states.has(image))states.set(image,{attempt:1,error:null});
 const state=states.get(image);
 if(image.complete&&image.naturalWidth)loaded(image);else{image.dataset.rc4ImageState='loading';image.setAttribute('aria-busy','true');}
 return state;
}
function loaded(image){image.dataset.rc4ImageState='ready';image.removeAttribute('aria-busy');const s=states.get(image);if(s?.error){s.error.remove();s.error=null;}}
function request(image,state){if(!image.isConnected)return;const info=RC4BankLoader.mediaInfo(image.getAttribute('src'));if(!info)return;image.dataset.rc4ImageState='loading';image.setAttribute('aria-busy','true');const url=new URL(info.url);url.searchParams.set('rc4retry',String(Date.now())+'-'+state.attempt);image.src=url.href;}
function failed(image){
 const state=states.get(image)||register(image);if(!state)return;
 if(state.attempt<3){state.attempt++;setTimeout(()=>request(image,state),state.attempt*250);return;}
 image.dataset.rc4ImageState='error';image.removeAttribute('aria-busy');if(state.error)return;
 const box=document.createElement('span');box.className='callout rc4-image-error';box.setAttribute('role','alert');box.textContent='题图未能载入（已尝试3次）。';
 const button=document.createElement('button');button.type='button';button.textContent='重试题图';button.onclick=event=>{event.preventDefault();event.stopPropagation();box.remove();state.error=null;state.attempt=1;request(image,state);};box.appendChild(button);image.insertAdjacentElement('afterend',box);state.error=box;
}
root.addEventListener('load',event=>{if(event.target.tagName==='IMG'&&RC4BankLoader.mediaInfo(event.target.getAttribute('src')||''))loaded(event.target);},true);
root.addEventListener('error',event=>{if(event.target.tagName==='IMG'&&RC4BankLoader.mediaInfo(event.target.getAttribute('src')||''))failed(event.target);},true);
new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes){if(node.nodeType!==1)continue;if(node.tagName==='IMG')register(node);node.querySelectorAll('img').forEach(register);}}).observe(root,{childList:true,subtree:true});
})();
