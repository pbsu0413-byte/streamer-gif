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

function checkInAppBrowser(){
  const ua = navigator.userAgent || '';
  const isKakao = /KAKAOTALK/i.test(ua);
  const isOtherInApp = /Instagram|FBAN|FBAV|Line\//i.test(ua);
  const banner = document.getElementById('inappBanner');
  const openBtn = document.getElementById('openExternalBtn');

  if ((isKakao || isOtherInApp) && banner){
    banner.style.display = 'block';
  }

  if (isKakao && openBtn){
    // 카카오톡 인앱 브라우저는 강제로 외부 브라우저(사파리/크롬)를 열 수 있는 방법이 있다.
    openBtn.addEventListener('click', () => {
      const isAndroid = /Android/i.test(ua);
      if (isAndroid){
        const bare = location.href.replace(/^https?:\/\//i, '');
        location.href = `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`;
      } else {
        location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
      }
    });
  } else if (openBtn){
    // 인스타그램 등은 이런 강제 이동 트릭이 통하지 않아 버튼을 숨기고 안내 문구만 남긴다.
    openBtn.style.display = 'none';
    if (banner){
      banner.innerHTML += '<br>오른쪽 아래(또는 "⋯") 메뉴에서 <b>"다른 브라우저에서 열기"</b>를 찾아주세요.';
    }
  }
}
checkInAppBrowser();

// 1. [공유하기] 버튼 기능 (유튜브 공유 창처럼 모바일 순정 공유 UI 띄우기)
async function shareGif(gifUrl, gifTitle) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: gifTitle || '스트리머 짤',
        text: '이 짤 한번 봐봐!',
        url: gifUrl
      });
      console.log('공유 성공!');
    } catch (err) {
      console.log('공유 취소 또는 에러:', err);
    }
  } else {
    navigator.clipboard.writeText(gifUrl);
    alert('GIF 링크가 클립보드에 복사되었습니다!');
  }
}

// 2. [링크 복사] 버튼 기능 (현재 웹사이트 주소 복사)
function copyWebsiteUrl() {
  const currentSiteUrl = window.location.href;

  navigator.clipboard.writeText(currentSiteUrl)
    .then(() => {
      alert('웹사이트 주소가 복사되었습니다!');
    })
    .catch(err => {
      console.error('복사 실패:', err);
    });
}

async function shareCurrent(){
  if (currentIndex === null) return;
  const item = MEDIA_ITEMS[currentIndex];
  await shareGif(toShareableUrl(item.url), item.name);
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
  copyWebsiteUrl();
}

drawBtn.addEventListener('click', draw);
document.getElementById('shareBtn').addEventListener('click', shareCurrent);
document.getElementById('downloadBtn').addEventListener('click', downloadCurrent);
document.getElementById('copyBtn').addEventListener('click', copyCurrentLink);

loadCategories();
loadMedia();
