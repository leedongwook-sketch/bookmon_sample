# 지도 매핑 로직 (BM-201)

> **핵심:** "앵커 2점"으로 GPS(위경도) → 이미지 위 위치(%)로 바꾸는 선형 변환식을 세우고,
> 몬스터마다 그 식에 좌표를 넣어 %위치에 마커를 얹는다.

지도 이미지 자체에는 좌표 정보가 없다. 이미지와 실세계를 연결하는 유일한 다리가 **앵커 2점**이다.

---

## 1. 데이터 두 종류

시작 버튼 클릭 시 `gameStore`에 저장되는 값:

```
EventMap {                         Game.location {
  imageUrl,                          latitude,   ← 실세계 GPS
  anchors: [A, B]  ← 지도-실세계 다리   longitude
}                                  }
```

**앵커 1점**은 "이미지의 이 지점(x,y)이 = 실세계 이 좌표(lat,lng)다"라는 대응쌍이다.

```
MapAnchor { x, y,                  ← 이미지 위 위치 (0~1 비율)
            latitude, longitude }  ← 그 지점의 실제 GPS
```

현재 용인초 mock(`schoolService.mock.ts`)의 두 앵커:

지도 이미지는 `yongin-map.svg`(용인초 스타일 지도, viewBox 900×960)이며, 두 앵커는:

| | 이미지 x, y | 실세계 lat, lng | 의미 |
|---|---|---|---|
| A | 0.0392, 0.0127 | 37.2390036, 127.2042943 | 부지 경계 **북서** 끝 |
| B | 0.9704, 0.8886 | 37.2373587, 127.2060563 | 부지 경계 **남동** 끝 |

> x,y가 (0,0)/(1,1)이 아닌 이유: 이미지에 여백이 있어서다. 빨간 경계선의 실제 위치를
> SVG를 래스터화해 `sharp`로 실측해 맞췄다. 코너로 두면 여백만큼 전체 마커가 밀린다.
> ⚠ SVG 경계는 스타일화된 사변형이라 축별 선형 매핑은 근사다(현장 실측 시 보정).

---

## 2. 변환 공식 — 축별 선형보간 (`geo.ts`)

지도가 **정북 정렬**(위=북)이라 가정하면, x는 경도만으로, y는 위도만으로 독립 계산된다.

```
x = A.x + (lng - A.lng) / (B.lng - A.lng) × (B.x - A.x)
y = A.y + (lat - A.lat) / (B.lat - A.lat) × (B.y - A.y)
```

읽는 법: *"lng가 A~B 경도 구간에서 차지하는 비율(0~1)을, 그대로 A~B의 이미지 x 구간에 매핑"*. y도 위도로 동일.

---

## 3. 실제 값으로 계산 (중앙 몬스터: 물방울 북몬)

좌표 `37.2384341, 127.205158`:

```
경도 비율 = (127.205158 - 127.2042943) / (127.2060563 - 127.2042943) = 0.490
  x = 0.0392 + 0.490 × (0.9704 - 0.0392) = 0.496   → 이미지 가로 49.6%

위도 비율 = (37.2384341 - 37.2390036) / (37.2373587 - 37.2390036) = 0.346
  y = 0.0127 + 0.346 × (0.8886 - 0.0127) = 0.316   → 이미지 세로 31.6%
```

→ 이 몬스터는 지도 이미지의 **(49.6%, 31.6%)** 지점에 찍힌다. (본관 앞 중앙 근처)

---

## 4. 화면에 얹기 — 카메라 방식 (`MapScreen.tsx`)

전체화면 지도 위에서 **카메라(뷰포트)** 가 내 위치를 따라다닌다.

**레이어 구조**
```
[컨테이너: 100dvh, overflow-hidden, touch-none]   ← 화면(뷰포트)
  └ [지도 레이어: width=mapW, height=mapH, transform: translate(tx,ty)]
        ├ <img> 배경 지도 (레이어를 꽉 채움)
        ├ 몬스터 마커  (left/top = 비율%)
        └ 내 위치 마커 (left/top = 비율%)
```

마커는 모두 지도 레이어의 자식이라 `left/top %`(= `projectToImage` 결과)로 배치하면
레이어가 움직일 때 **함께 움직인다**. 레이어 크기(mapW/mapH)가 이미지와 같은 비율이라 %가 정확히 일치.

**확대(ZOOM=4)**
```
fitScale     = min(뷰포트W/이미지W, 뷰포트H/이미지H)   // 전체가 딱 맞는 배율
displayScale = fitScale × 4                          // 4배 확대
mapW,mapH    = 이미지자연크기 × displayScale
```

**카메라(내 위치 중앙 고정)** — 카메라 중심을 화면 중앙에 오도록 레이어를 민다.
```
center = freeCenter ?? meRatio        // 평소엔 내 위치, 드래그 중엔 자유 영역
tx = 뷰포트W/2 − center.x × mapW
ty = 뷰포트H/2 − center.y × mapH
```
`center = meRatio`이면 내 위치가 정확히 화면 중앙 → 내 마커가 항상 가운데 고정.

**드래그 & 복귀**
- `pointermove`로 `freeCenter`를 손가락 반대 방향으로 이동(지도가 손가락을 따라감), `[0,1]` 클램프.
- `pointerup` 후 2초(`RETURN_DELAY_MS`) 무입력 → `freeCenter=null` → `center`가 다시 `meRatio`로.
- 드래그 중엔 `transition:none`(즉시), 팔로우/복귀 시 `transform 500ms ease-out`(부드럽게).

**내 위치 소스** (`useMyPosition.ts`) — 약 1초 주기로 최신 좌표 반환. 지금은 테스트 좌표 고정,
실서비스에선 `navigator.geolocation.watchPosition`으로 스왑(HTTPS 필요). 좌표가 바뀌면 `meRatio`가
바뀌고 카메라가 새 위치로 부드럽게 이동한다.

---

## 5. 전체 흐름

```
[시작 버튼]  (SchoolSearchScreen.handleStart)
   ├─ GET /play/groups/{groupId}/games   → 몬스터 + 좌표(lat,lng)
   └─ GET /play/events/{eventId}/map     → 이미지 + 앵커 2점
        (Promise.all 병렬) → gameStore 저장 → /map 이동

[지도 진입 · MapScreen]
   1. 마운트 후 스토어에서 eventMap, games 읽기 (persist=클라 전용)
   2. <Image>로 지도 이미지 로드 (비율 고정 박스)
   3. games.map → projectToImage(앵커, 좌표) → (x%, y%) → 핀 배치
```

---

## 6. 가정 · 한계

- **정북 정렬 가정**: 이미지가 회전돼 있으면 축별 선형보간이 어긋남 → 이때는 닮음변환(회전 포함)
  필요. `yongin-map.svg`는 정북 기준이라 OK(경계는 스타일화된 사변형이라 근사).
- **경도 cos 왜곡 무시**: 부지 수백 m 규모라 오차 미미. 더 정밀하게 하려면 Web Mercator 투영 후 변환.
- **경계 밖 좌표**: x,y가 0~1을 벗어날 수 있음 → `isInsideImage()`로 숨김/클램프 판단용 헬퍼를
  넣어둠(현재 미사용).
- 이 **동일한 변환식**이 다음 단계 "실시간 내 위치 점"에도 그대로 재사용된다
  (내 GPS → `projectToImage` → 점 표시).

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `src/features/map/geo.ts` | `projectToImage(anchors, lat, lng)` — GPS→이미지 비율 변환 |
| `src/features/map/MapScreen.tsx` | 지도 화면 — 카메라(팔로우/드래그/복귀) + 이미지 + 마킹 |
| `src/features/map/useMyPosition.ts` | 내 실시간 위치(1초 주기). 현재 테스트 좌표, GPS로 스왑 예정 |
| `src/app/map/page.tsx` | 라우트 → `MapScreen` 렌더 |
| `src/services/play/schoolService.mock.ts` | `MOCK_EVENT_MAP`(앵커) + `MOCK_GAMES`(몬스터 좌표) |
| `src/types/catalog.ts` | `EventMap`, `MapAnchor` 타입 |
