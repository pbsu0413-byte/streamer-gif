const stage = document.getElementById('stage');
const emptyState = document.getElementById('emptyState');
const nameTag = document.getElementById('nameTag');
const drawBtn = document.getElementById('drawBtn');
const actions = document.getElementById('actions');
const counterEl = document.getElementById('counter');
const toastEl = document.getElementById('toast');

let MEDIA_ITEMS = [];
let currentIndex = null;
let drawCount = 0;
let imgEl = null;

async function loadMedia(){
  try{
    const res = await fetch('/api/media');
    MEDIA_ITEMS = await res.json();
  } catch(e){
    MEDIA_ITEMS = [];
  }
}

function ensureImgEl(){
  if (!imgEl){
    if (emptyState) emptyState.remove();
    imgEl = document.createElement('img');
    stage.appendChild(imgEl);
  }
  return imgEl;
}

function showImage(idx, flicker){
  const item = MEDIA_ITEMS[idx];
  const el = ensureImgEl();
  el.src = item.url;
  el.alt = item.name || '';
  el.classList.remove('settle');
  if (flicker){
    el.classList.add('flicker');
    nameTag.textContent = '';
  } else {
    el.classList.remove('flicker');
    void el.offsetWidth;
    el.classList.add('settle');
    nameTag.innerHTML = item.name ? `<b>${item.name}</b>` : '';
  }
}

function updateCounter(){
  counterEl.textContent = `뽑기 ${drawCount}회`;
}

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

async function draw(){
  if (MEDIA_ITEMS.length === 0){
    await loadMedia();
  }
  if (MEDIA_ITEMS.length === 0){
    toast('먼저 짤을 추가해주세요! (관리 페이지)');
    return;
  }
  drawBtn.disabled = true;
  actions.classList.remove('show');
  let ticks = 0;
  const maxTicks = 12;
  const interval = setInterval(() => {
    const idx = Math.floor(Math.random() * MEDIA_ITEMS.length);
    showImage(idx, true);
    ticks++;
    if (ticks >= maxTicks){
      clearInterval(interval);
      const finalIdx = Math.floor(Math.random() * MEDIA_ITEMS.length);
      showImage(finalIdx, false);
      currentIndex = finalIdx;
      drawCount++;
      updateCounter();
      actions.classList.add('show');
      drawBtn.disabled = false;
    }
  }, 70);
}

async function shareCurrent(){
  if (currentIndex === null) return;
  const item = MEDIA_ITEMS[currentIndex];
  try {
    const res = await fetch(item.url, { mode: 'cors' });
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'gif').split('+')[0];
    const file = new File([blob], `${(item.name || 'clip').replace(/\s+/g,'_')}.${ext}`, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })){
      await navigator.share({ files: [file], title: item.name || '스트리머 짤' });
      return;
    }
    throw new Error('file share unsupported');
  } catch (e){
    if (navigator.share){
      try {
        await navigator.share({ title: item.name || '스트리머 짤', url: item.url });
        return;
      } catch (_){ /* cancelled or failed */ }
    }
    copyCurrentLink();
    toast('이 브라우저는 공유 기능이 제한적이에요. 링크를 복사했어요!');
  }
}

async function downloadCurrent(){
  if (currentIndex === null) return;
  const item = MEDIA_ITEMS[currentIndex];
  try {
    const res = await fetch(item.url, { mode: 'cors' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(item.name || 'clip').replace(/\s+/g,'_')}.gif`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e){
    window.open(item.url, '_blank');
  }
}

function copyCurrentLink(){
  if (currentIndex === null) return;
  const item = MEDIA_ITEMS[currentIndex];
  navigator.clipboard.writeText(item.url)
    .then(() => toast('링크를 복사했어요!'))
    .catch(() => toast('복사에 실패했어요.'));
}

drawBtn.addEventListener('click', draw);
document.getElementById('shareBtn').addEventListener('click', shareCurrent);
document.getElementById('downloadBtn').addEventListener('click', downloadCurrent);
document.getElementById('copyBtn').addEventListener('click', copyCurrentLink);

loadMedia();
