# 짤 뽑기 머신 (Flask)

버튼을 누르면 등록해둔 스트리머 짤/gif 중 하나가 랜덤으로 뽑히고,
카톡/인스타로 바로 공유하거나 다운로드할 수 있는 웹앱입니다.

## 1. 로컬에서 먼저 테스트해보기

```bash
cd streamer-gif-app
python3 -m venv venv
source venv/bin/activate      # 윈도우는 venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

브라우저에서 http://localhost:5000 접속 → `/admin` 에서 짤 추가.

## 2. GitHub에 올리기

```bash
git init
git add .
git commit -m "짤 뽑기 머신 초기 버전"
```

GitHub에서 새 저장소(Repository)를 만든 뒤:

```bash
git remote add origin https://github.com/내계정/저장소이름.git
git branch -M main
git push -u origin main
```

## 3. Railway로 배포하기

1. https://railway.app 접속 → GitHub 계정으로 로그인
2. **New Project → Deploy from GitHub repo** 선택 → 방금 올린 저장소 선택
3. Railway가 `requirements.txt`와 `Procfile`을 자동으로 인식해서 빌드/배포합니다
4. 배포가 끝나면 **Settings → Networking → Generate Domain** 눌러서
   `https://xxxx.up.railway.app` 같은 주소를 받으세요 (이 https 주소가 있어야
   카톡/인스타 공유 버튼이 휴대폰에서 정상 작동해요)
5. **Variables** 탭에서 `ADMIN_PASSWORD` 환경변수를 추가하세요.
   (설정하지 않으면 `/admin` 에서 짤을 추가/삭제할 수 없도록 막아둔 상태입니다.)

## 4. 짤 추가하는 법

배포된 주소 뒤에 `/admin` 을 붙여서 접속 (예: `https://xxxx.up.railway.app/admin`)
→ 관리 비밀번호(Railway에 설정한 `ADMIN_PASSWORD`) 입력 → 이름/이미지 주소 입력 후 추가.

## 참고 사항

- `data/media.json`에 짤 목록이 저장됩니다. Railway 서버가 재배포되면
  이 파일 내용이 초기화될 수 있으니(컨테이너가 새로 뜨기 때문), 짤 목록을
  오래 유지하고 싶다면 가끔 `/admin`에서 등록한 목록을 확인해서
  `data/media.json`을 직접 GitHub에 커밋해두는 걸 추천해요.
- 이미지 주소는 CORS(다른 사이트에서 직접 가져오기를 막는 정책)를 지원하지
  않는 사이트일 경우 "공유하기/다운로드"가 실패할 수 있어요. 그럴 땐 이미지를
  직접 저장한 뒤 imgur 등에 업로드해서 그 주소를 쓰는 걸 추천합니다.
- `/admin`은 비밀번호로만 보호되어 있어서 완전히 안전하진 않아요. 친구들끼리만
  아는 용도로 쓰는 걸 권장합니다.
