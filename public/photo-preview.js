/** Private, single-image preview. No prefetch, persistence, embeds or Drive navigation. */
window.RentalPhotoPreview=(()=>{
  let active=null;
  function create(){
    let generation=0,dialog=null,origin=null;
    function close(){
      generation++;
      if(dialog){dialog.querySelector('img')?.removeAttribute('src');dialog.remove();dialog=null;}
      if(active===close)active=null;
      if(origin?.isConnected)origin.focus();origin=null;
    }
    async function open(title,read){
      active?.();close();active=close;
      const ticket=generation,property=window.RentalPropertyContext?.id;
      origin=document.activeElement;
      dialog=document.createElement('dialog');dialog.className='rental-photo-dialog';dialog.setAttribute('aria-label',title);
      const header=document.createElement('header'),heading=document.createElement('h2'),button=document.createElement('button'),message=document.createElement('p');
      heading.textContent=title;button.type='button';button.textContent='關閉';button.setAttribute('aria-label','關閉圖片預覽');button.addEventListener('click',close);
      message.textContent='圖片載入中……';message.setAttribute('role','status');header.append(heading,button);dialog.append(header,message);
      dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
      dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
      dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
      document.body.append(dialog);
      if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
      button.focus();
      try{
        const data=await read();
        if(ticket!==generation||!dialog)return;
        if(property!==window.RentalPropertyContext?.id){close();return;}
        if(typeof data!=='string'||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('圖片回應格式不正確。');
        const image=document.createElement('img');image.alt=title;
        image.addEventListener('error',()=>{if(ticket===generation&&dialog){image.removeAttribute('src');image.remove();message.textContent='圖片無法顯示，請關閉後再點選連結重試。';}});
        image.src=data;message.textContent='';dialog.append(image);
      }catch(error){if(ticket===generation&&dialog)message.textContent='無法預覽：'+error.message;}
    }
    return {open,close};
  }
  const close=()=>active?.();window.addEventListener('pagehide',close);
  document.addEventListener('submit',event=>{if(event.target.action?.includes('/auth/logout'))close();},true);
  return {create,close};
})();
