const stage = document.getElementById('stage');
const emptyState = document.getElementById('emptyState');
const nameTag = document.getElementById('nameTag');
const drawBtn = document.getElementById('drawBtn');
const actions = document.getElementById('actions');
const counterEl = document.getElementById('counter');
const toastEl = document.getElementById('toast');
const tabsEl = document.getElementById('tabs');

let MEDIA_ITEMS = [];
let currentIndex = null;
let currentCategory = '';
let drawCount = 0;
let imgEl = null;

function toShareableUrl(url){
  try {
    // 상대경로(/static/gifs/...)를 전체 주소로 바꾸고, 한글/공백 등을 안전한 형태로 변환
    return encodeURI(new URL(url, window.location.origin).href);
  } catch (e){
    return url;
  }
}

async function checkLive(category, btn){
  try {
    const res = await fetch(`/api/live-status/${encodeURIComponent(category)}`);
    const data = await res.json();
    if (data.live){
      const dot = document.createElement('span');
      dot.className = 'live-dot';
      dot.title = data.title ? `LIVE: ${data.title}` : '방송 중';
      btn.appendChild(dot);
    }
  } catch (e){ /* 확인 실패는 조용히 무시 */ }
}

async function loadMedia(){
  try{
    const url = currentCategory ? `/api/media?category=${encodeURIComponent(currentCategory)}` : '/api/media';
    const res = await fetch(url);
    MEDIA_ITEMS = await res.json();
  } catch(e){
    MEDIA_ITEMS = [];
  }
}

async function loadCategories(){
  let categories = [];
  try {
    const res = await fetch('/api/categories');
    categories = await res.json();
  } catch(e){ /* ignore */ }

  if (!tabsEl) return;
  tabsEl.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'tab-btn active';
  allBtn.textContent = '전체';
  allBtn.dataset.category = '';
  tabsEl.appendChild(allBtn);

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.textContent = cat;
    btn.dataset.category = cat;
    tabsEl.appendChild(btn);
    checkLive(cat, btn);
  });

  tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      await loadMedia();
      resetStage();
    });
  });
}

function resetStage(){
  currentIndex = null;
  actions.classList.remove('show');
  nameTag.textContent = '';
  if (imgEl){
    imgEl.remove();
    imgEl = null;
    if (!document.getElementById('emptyState')){
      const div = document.createElement('div');
      div.className = 'empty';
      div.id = 'emptyState';
      div.innerHTML = '뽑기 버튼을 눌러보세요!';
      stage.appendChild(div);
    }
  }
}

function ensureImgEl(){
  if (!imgEl){
    const empty = document.getElementById('emptyState');
    if (empty) empty.remove();
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

function isMobileDevice(){
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

async function shareCurrent(){
  if (currentIndex === null) return;
  const item = MEDIA_ITEMS[currentIndex];
  const shareUrl = toShareableUrl(item.url);
  // 파일 자체를 공유하는 방식은 기기/브라우저마다 지원이 들쭉날쭉해서,
  // 훨씬 안정적으로 잘 뜨는 "링크 공유" 방식(카톡/왓츠앱/문자 등 아이콘이 쭉 나오는 기본 공유창)을 우선 사용한다.
  if (navigator.share){
    try {
      await navigator.share({ title: item.name || '스트리머 짤', url: shareUrl });
      return;
    } catch (e){
      if (e && e.name === 'AbortError') return; // 사용자가 공유창에서 취소한 경우
    }
  }
  // 공유 기능 자체가 없는 브라우저(주로 PC)는 링크만 복사
  copyCurrentLink();
  toast('이 브라우저는 공유 시트를 지원하지 않아 링크를 복사했어요!');
}

async function downloadCurrent(){
  if (currentIndex === null) return;
  const item = MEDIA_ITEMS[currentIndex];
  const shareUrl = toShareableUrl(item.url);
  if (isMobileDevice()){
    // 모바일은 강제 다운로드가 잘 안 먹히는 경우가 많아서,
    // 새 창으로 이미지를 열어 길게 눌러 저장하도록 안내한다.
    window.open(shareUrl, '_blank');
    toast('새 창에서 이미지를 길게 눌러 "저장"을 눌러주세요!');
    return;
  }
  try {
    const res = await fetch(item.url, { mode: 'cors' });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${(item.name || 'clip').replace(/\s+/g,'_')}.gif`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (e){
    window.open(shareUrl, '_blank');
  }
}

function copyCurrentLink(){
  if (currentIndex === null) return;
  const item = MEDIA_ITEMS[currentIndex];
  navigator.clipboard.writeText(toShareableUrl(item.url))
    .then(() => toast('링크를 복사했어요!'))
    .catch(() => toast('복사에 실패했어요.'));
}

drawBtn.addEventListener('click', draw);
document.getElementById('shareBtn').addEventListener('click', shareCurrent);
document.getElementById('downloadBtn').addEventListener('click', downloadCurrent);
document.getElementById('copyBtn').addEventListener('click', copyCurrentLink);

loadCategories();
loadMedia();
