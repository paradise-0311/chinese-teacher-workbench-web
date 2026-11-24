(function(){'use strict';
let composing=false,installed=false;
const editing=el=>!!el?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
function helpHTML(){return '<section class="keyboard-help"><h2>快捷键</h2><dl><div><dt><kbd>Esc</kbd></dt><dd>返回上一层详情，再返回查询列表。学校选择和更多筛选展开时，先收起面板。</dd></div><div><dt><kbd>Ctrl</kbd> + <kbd>K</kbd><br>或 <kbd>/</kbd></dt><dd>在查询页面定位搜索框。</dd></div><div><dt><kbd>Enter</kbd></dt><dd>在搜索框中执行查询。</dd></div><div><dt><kbd>?</kbd></dt><dd>查看这份快捷键说明。</dd></div></dl><p>正在输入时，Esc 先退出输入并保留文字；中文输入法选词时不触发返回。在当前入口没有上一层时，Esc 保持当前页面。</p><p>返回原题列表时保留筛选、页码与阅读前的位置。浏览器原有的刷新、查找和前进后退快捷键继续可用。</p></section>';}
function install(actions){
 if(installed)return;installed=true;
 document.addEventListener('compositionstart',()=>{composing=true;},true);
 document.addEventListener('compositionend',()=>{composing=false;},true);
 window.addEventListener('blur',()=>{composing=false;});
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||e.keyCode===229||composing)return;
  const plain=!e.ctrlKey&&!e.altKey&&!e.metaKey;
  if(e.key==='Escape'&&plain&&!e.shiftKey){if(e.repeat){e.preventDefault();return;}if(actions.back())e.preventDefault();return;}
  if(e.repeat)return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='k'){if(actions.search())e.preventDefault();return;}
  if(!plain||editing(e.target))return;
  if(e.key==='/'&&!e.shiftKey){if(actions.search())e.preventDefault();}
  else if(e.key==='?'){e.preventDefault();actions.help();}
 },true);
}
window.KQKeyboard={install,editing,helpHTML,composing:()=>composing};
})();
