(function(){'use strict';
const script=path=>new URL('运行资源/'+path,document.baseURI).href;
function load(path,verify){return RC4StaticLoader.loadScript(script(path),{verify,timeout:180000});}
function mediaInfo(value){
 const info=window.RC4_MEDIA_INDEX;if(!info)return null;
 if(info[value])return info[value];
 try{const url=new URL(value,document.baseURI);url.search='';url.hash='';return Object.values(info).find(x=>x.url===url.href)||null;}catch{return null;}
}
window.RC4BankLoader={
 content:async id=>{if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('无效正文标识');await Promise.all([load('正文/'+id+'.js',()=>!!window.RC4_BANK?.content?.[id]?.question),load('题图.js',()=>!!window.RC4_MEDIA_INDEX)]);},
 word:async()=>{await load('Word原版格式.js',()=>!!window.RC4_BANK?.wordFormat);return RC4_BANK.wordFormat;},
 mediaInfo,isMediaURL:value=>!!mediaInfo(value),
 fetchMedia:value=>{const info=mediaInfo(value);if(!info)throw Error('无效题图资源');return window.fetch(info.url);},
 decorateImage:image=>{const info=mediaInfo(image.getAttribute('src')||'');if(!info)return;if(!image.hasAttribute('width'))image.width=info.width;if(!image.hasAttribute('height'))image.height=info.height;image.dataset.rc4Image='true';}
};
})();
