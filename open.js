"use strict";
(() => {
  const slot='finance-review-session-key-v1';
  const form=document.querySelector('#unlock-form');
  const status=document.querySelector('#unlock-state');
  const text=new TextEncoder();
  const plain=new TextDecoder('utf-8',{fatal:true});
  const base64decode=value=>Uint8Array.from(atob(value), x=>x.charCodeAt(0));
  function base64encode(buf) {
    let binary='';
    for(let i=0;i<buf.length;i+=8192) binary+=String.fromCharCode(...buf.subarray(i,i+8192));
    return btoa(binary);
  }
  const settings=new URLSearchParams(location.hash.slice(1));
  const requested=settings.get('unlock');
  const target=settings.get('view')==='settings'?'#settings':'#overview';

  function secretFromSession() {
    try { return sessionStorage.getItem(slot); }
    catch { return null; }
  }
  function permit(key) {
    try { sessionStorage.setItem(slot,key); }
    catch { /* The open link still works in this tab. */ }
  }

  async function unlock(code) {
    if(!/^[A-Za-z0-9_-]{43}$/.test(code || '')) throw new Error('请打开原专属链接，或输入 43 位访问码。');
    if(!crypto.subtle) throw new Error('请使用支持加密的 Safari、Chrome 或 Edge 打开 HTTPS 链接。');
    const bytes=base64decode(code.replace(/-/g,'+').replace(/_/g,'/')+'=');
    const key=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
    function decrypt(buffer, purpose) {
      return crypto.subtle.decrypt({name:'AES-GCM',iv:buffer.subarray(0,12),additionalData:text.encode(purpose)},key,buffer.subarray(12));
    }
    async function seal(value,purpose) {
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:text.encode(purpose)},key,text.encode(value)));
      const buffer=new Uint8Array(iv.length+cipher.length);
      buffer.set(iv);
      buffer.set(cipher,iv.length);
      return base64encode(buffer);
    }
    const response=await fetch('study-v8.bin',{referrerPolicy:'no-referrer'});
    if(!response.ok) throw new Error('复习资料暂不可用，请稍后重试。');
    let markup;
    try { markup=plain.decode(await decrypt(new Uint8Array(await response.arrayBuffer()),'study-v1')); }
    catch { throw new Error('访问码与复习资料不匹配，请使用原专属链接。'); }
    const source=new DOMParser().parseFromString(markup,'text/html');
    const sourceStyle=source.head.querySelector('style');
    const sourceApp=source.body.querySelector('script:not([id])');
    if(!sourceStyle || !sourceApp || !source.querySelector('#data')) throw new Error('复习资料格式有误。');
    permit(code);
    const pageUrl=location.origin+location.pathname;
    window.FinanceAccess=Object.freeze({
      image:async id=>{
        if(!/^(?:F[123]|W|[0-9]{1,2})-[1-9][0-9]?$/.test(id)) throw new Error('页码无效');
        const reply=await fetch('screens/v1/'+id+'.bin',{referrerPolicy:'no-referrer'});
        if(!reply.ok) throw new Error('原页不可用');
        const buffer=await decrypt(new Uint8Array(await reply.arrayBuffer()),'source-image-v1:'+id);
        return URL.createObjectURL(new Blob([buffer],{type:'image/webp'}));
      },
      seal, open:async (sealed,purpose)=>plain.decode(await decrypt(base64decode(sealed),purpose)),
      link:()=>pageUrl+'#unlock='+code
    });
    if(requested || !location.hash) history.replaceState(null,'',pageUrl+target);
    document.head.append(document.importNode(sourceStyle,true));
    document.body.replaceChildren(...Array.from(source.body.children).filter(node=>node!==sourceApp).map(node=>document.importNode(node,true)));
    const script=document.createElement('script');
    script.textContent=sourceApp.textContent;
    document.body.append(script);
  }
  async function open(code) {
    status.textContent='正在打开复习资料…';
    form.hidden=true;
    try { await unlock(code); }
    catch(err) {
      status.textContent=err.name==='TypeError'?'暂时无法加载资料，请检查网络再试。':err.message;
      form.hidden=false;
    }
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    open(document.querySelector('#unlock-key').value.trim());
  });
  open(requested || secretFromSession());
})();
