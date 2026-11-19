// Reading controls only: no access to game state, storage, or progression.
const dialog=document.createElement('dialog');
dialog.className='image-reader';dialog.setAttribute('aria-label','任务书图片放大');
const header=document.createElement('header'),size=document.createElement('button'),close=document.createElement('button'),view=document.createElement('div'),picture=document.createElement('img');
size.type=close.type='button';size.textContent='按原图查看细节';close.textContent='返回刚才这一页';view.className='image-reader-view';view.tabIndex=0;view.setAttribute('aria-label','原图滚动查看');view.append(picture);header.append(size,close);dialog.append(header,view);document.body.append(dialog);
let origin;
function reset(){dialog.dataset.original='false';size.textContent='按原图查看细节';view.scrollTo(0,0);}
close.addEventListener('click',()=>dialog.close());
size.addEventListener('click',()=>{const original=dialog.dataset.original!=='true';dialog.dataset.original=String(original);size.textContent=original?'适应窗口':'按原图查看细节';view.scrollTo(0,0);});
dialog.addEventListener('close',()=>origin?.focus({preventScroll:true}));
for(const anchor of document.querySelectorAll('.page a[href]')){
  const img=anchor.querySelector('img'),page=anchor.closest('.page');
  if(!/\.(png|jpe?g|webp)$/i.test(new URL(anchor.href).pathname))continue;
  const label=img?.alt||`${page?.getAttribute('aria-label')??'任务书'}的操作截图`;
  anchor.setAttribute('aria-label',`放大${label}`);if(img&&!img.alt)img.alt=label;
  anchor.addEventListener('click',event=>{event.preventDefault();origin=anchor;reset();picture.src=anchor.href;picture.alt=label;dialog.showModal();close.focus();});
}
