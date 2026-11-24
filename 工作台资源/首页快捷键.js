(function(){'use strict';
const $=id=>document.getElementById(id),dialog=$('homeKeyboardHelp');let previous=null;
function help(){if(dialog.open)return;previous=document.activeElement;$('homeKeysContent').innerHTML=KQKeyboard.helpHTML();dialog.showModal();}
function close(){dialog.close();if(previous?.isConnected)previous.focus({preventScroll:true});}
$('homeKeys').onclick=help;$('homeKeysClose').onclick=close;
dialog.addEventListener('cancel',e=>{e.preventDefault();if(!KQKeyboard.composing())close();});
KQKeyboard.install({back:()=>{if(dialog.open){close();return true;}const active=document.activeElement;if(active?.matches('select'))return false;if(KQKeyboard.editing(active)){active.blur();return true;}if(!$('homeResults').hidden){$('homeResults').hidden=true;$('homeKeyword').focus({preventScroll:true});return true;}return false;},search:()=>{if(dialog.open)return false;$('homeKeyword').focus();$('homeKeyword').select();return true;},help});
})();
