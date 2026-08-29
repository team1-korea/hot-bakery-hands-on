---
name: "Avalanche Bakery Wallet Guide"
description: "같은 지갑을 안전하게 다시 여는 과정을 네 장의 작업 티켓으로 안내하는 모바일 우선 디자인 시스템"
colors:
  avalanche-red: "#e84142"
  ember-red: "#b32b2c"
  warm-paper: "#f7f1e8"
  carbon-ink: "#17110f"
  focus-gold: "#d9a441"
typography:
  display:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "clamp(34px, 9.2vw, 62px)"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "clamp(23px, 6.2vw, 34px)"
    fontWeight: 900
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "clamp(21px, 5.6vw, 28px)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.65
  action:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "17px"
    fontWeight: 900
    lineHeight: 1.2
  caption:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.5
  mono:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "clamp(20px, 6vw, 29px)"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.03em"
rounded:
  square: "0px"
  action: "8px"
spacing:
  ticket-gap: "8px"
  compact: "14px"
  control-inline: "18px"
  page-inline: "20px"
  ticket-body-inline: "22px"
  section: "30px"
  page-top: "38px"
  footer-top: "44px"
components:
  ticket-header-closed:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.carbon-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.square}"
    padding: "0"
    height: "80px"
  ticket-header-open:
    backgroundColor: "{colors.avalanche-red}"
    textColor: "{colors.warm-paper}"
    typography: "{typography.title}"
    rounded: "{rounded.square}"
    padding: "0"
    height: "80px"
  action-primary:
    backgroundColor: "{colors.carbon-ink}"
    textColor: "{colors.warm-paper}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "14px 18px"
    height: "58px"
    width: "100%"
  security-strip:
    backgroundColor: "{colors.avalanche-red}"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.square}"
    padding: "13px 18px"
    height: "62px"
    width: "100%"
  proof-panel:
    backgroundColor: "color-mix(in srgb, #e84142 7%, #f7f1e8)"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.square}"
    padding: "18px"
    width: "100%"
  screenshot-placeholder:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.carbon-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.square}"
    padding: "18px"
    width: "100%"
  dark-note:
    backgroundColor: "{colors.carbon-ink}"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.square}"
    padding: "20px"
    width: "100%"
---

# Design System: Avalanche Bakery Wallet Guide

## Overview

**Creative North Star: "펼치는 작업 티켓"**

이 화면은 복잡하고 불안하게 느껴질 수 있는 지갑 가져오기를 베이커리 작업대의 네 장짜리 영수증으로 바꾼다. 한 번에 한 티켓만 펼쳐 다음 행동을 분명히 보여 주며, 따뜻한 종이 위에 굵은 잉크와 Avalanche red를 얹어 디지털 설정 화면보다 손에 잡히는 작업 지시서처럼 느끼게 한다.

시각적 위계는 장식보다 안전과 순서에 봉사한다. 빨간 면은 현재 단계와 개인키 경고에만 집중되고, 절취선·규칙선·두 자리 번호가 긴 설명을 빠르게 훑게 한다. 둥근 SaaS 카드, 그라디언트, 장식용 암호화폐 이미지 대신 평평한 종이와 각진 편집 디자인을 유지한다.

**Key Characteristics:**

- 따뜻한 종이 위의 Avalanche red와 carbon ink
- `01–04` 번호, 점선 절취선, 굵은 규칙선으로 만든 작업 티켓
- 휴대폰에서 정확히 두 줄로 읽히는 무거운 영웅 제목
- 한 번에 한 행동만 펼치는 단일 열 아코디언
- 그림자 없이 색면과 선 굵기로 만드는 명확한 상태

## Colors

빨강·종이·잉크의 제한된 팔레트가 브랜드, 안전, 읽기 위계를 동시에 담당한다.

### Primary

- **Avalanche Red**: 브랜드 띠, 활성 티켓 머리, 진행 상태, 보안 경고처럼 즉시 알아야 하는 면에만 쓴다.
- **Ember Red**: 도움말과 오류 문구 등 기본 빨강보다 낮은 면적의 상태 텍스트에 쓴다.

### Secondary

- **Focus Gold**: 키보드 포커스 링에만 드물게 사용해 빨간 상태 면과 혼동하지 않게 한다.

### Neutral

- **Warm Paper**: 페이지와 티켓의 연속된 바탕이며 빨간 머리 위의 역상 텍스트에도 쓴다.
- **Carbon Ink**: 본문, 규칙선, 기본 아이콘, 주요 행동 버튼, 고대비 안내 상자의 기준색이다.

### Named Rules

**The Red Means Now Rule.** Avalanche red는 현재 펼쳐진 단계, 현재 진행 칸, 개인키 보안 경고처럼 지금 주목해야 하는 곳에만 사용한다.

**The Paper Stays Warm Rule.** 중립 배경을 순백색이나 차가운 회색으로 바꾸지 않는다. 한 화면 안의 모든 티켓은 같은 종이 세계에 있어야 한다.

## Typography

**Display Font:** Archivo Black, Gothic A1, sans-serif
**Body Font:** Archivo Black, Gothic A1, sans-serif
**Label/Mono Font:** SFMono-Regular, Consolas, Liberation Mono, monospace (지갑 주소에만 사용)

**Character:** 라틴 문자는 Archivo Black의 간판 같은 압축감으로, 한글은 Gothic A1의 단단한 획으로 보인다. 본문도 가볍게 흘리지 않고 굵게 유지해 행사 현장의 휴대폰에서 안전 문구와 행동 순서를 놓치지 않게 한다.

### Hierarchy

- **Display** (900, `clamp(34px, 9.2vw, 62px)`, 0.98): 첫 화면의 두 줄 제목에만 사용한다.
- **Headline** (900, `clamp(23px, 6.2vw, 34px)`, 1.12): 펼친 티켓의 행동 문장에 사용한다.
- **Title** (900, `clamp(21px, 5.6vw, 28px)`, 1.1): 티켓 머리의 단계 이름에 사용한다.
- **Body** (700, 16px, 1.65): 설명과 안전 안내에 사용하며 본문 폭은 최대 52ch로 제한한다.
- **Action** (900, 17px, 1.2): 기본 행동 버튼과 링크 버튼에 사용한다.
- **Caption** (700, 15px, 1.5): 스크린샷 자리표시자와 보조 설명에 사용한다.
- **Mono** (900, `clamp(20px, 6vw, 29px)`, 1.2): 축약된 EVM 지갑 주소에만 사용한다.

### Named Rules

**The Two-Line Hero Rule.** 휴대폰 영웅 제목은 `내 참가증서를 / Core에서 확인해요`의 두 줄 리듬을 유지하고 `Core에서 확인해요`를 한 덩어리로 묶는다.

**The No Fine Print Rule.** 본문은 16px 아래로 내리지 않고, 중요한 행동과 경고는 더 굵고 크게 쓴다.

## Layout

전체 화면은 휴대폰을 기준으로 한 단일 열이다. 콘텐츠 종이는 화면 너비를 채우되 최대 760px에서 멈추고 가운데 정렬되며, 좌우 여백은 20px이다. 데스크톱에서도 다단으로 재배치하지 않고 한 장의 길쭉한 영수증을 읽는 흐름을 유지한다.

빨간 브랜드 띠에는 4칸 진행선을 두고, 현재 펼친 티켓과 같은 순번의 칸만 종이색으로 밝힌다. 영웅 영역은 위 38px 여백 뒤에 제목과 최대 39ch의 한 문단을 놓고, 30px 뒤부터 티켓 묶음을 시작한다. 티켓은 8px의 종이 간격으로 이어지고, 펼친 본문은 좌우 22px로 들여쓴다. 하단 안전 고지는 44px 간격과 4px 상단 규칙선으로 본문에서 분리한다.

별도의 화면폭 분기 대신 `clamp()`와 `min()`으로 크기를 유동 조절한다. 360–430px 휴대폰에서 첫 티켓의 행동이 바로 보이고 다음 티켓 머리가 이어져야 하며, 모든 터치 대상은 최소 48px 높이를 지킨다. 상·하단 패딩은 기기의 safe area를 포함한다.

## Elevation & Depth

그림자는 사용하지 않는다. 깊이는 Avalanche red 활성 면, carbon ink 고대비 면, 얇은 테두리, 굵은 구분선, 점선 절취선의 순서로만 만든다. 티켓은 공중에 뜬 카드가 아니라 한 장의 종이에 인쇄되고 뜯기는 평면 구조다.

### Named Rules

**The Flat Receipt Rule.** 휴식·활성·경고 상태 어디에도 그림자나 광택을 추가하지 않는다. 상태 변화는 색면과 선의 변화로만 보여 준다.

## Shapes

기본 형태는 직각이다. 페이지, 티켓, 경고 띠, 증명 패널, 메모, 스크린샷 자리표시자는 모두 모서리 반경 0px를 유지한다. 단계 번호와 제목 사이, 티켓 머리와 본문 사이는 점선으로 나눠 절취 가능한 영수증의 인상을 만든다.

주요 행동 버튼과 링크 버튼만 누를 수 있는 물체임을 알리기 위해 8px의 작은 곡률을 가진다. 구조선은 2px, 강한 구획과 키보드 포커스는 4px를 기준으로 하며, 화살표와 경고 아이콘도 둥근 장식 대신 각진 획을 사용한다.

## Components

### Progress Rail

- **Character:** 브랜드 띠 아래에서 네 단계의 현재 위치만 짧게 보여 주는 인쇄 눈금이다.
- **Structure:** 같은 너비의 네 칸과 8px 간격으로 구성하며 각 칸은 높이 4px다.
- **State:** 기본 칸은 Ember Red, 현재 칸은 Warm Paper다.

### Accordion Tickets

- **Shape:** 2px 외곽선과 직각 모서리, 번호 열 뒤의 1px 점선 절취선으로 구성한다.
- **Header:** 최소 높이 80px이며 번호 열 78px, 제목 열, 화살표 열 52px의 세 칸 구조다.
- **Open State:** 머리 전체를 Avalanche Red로 채우고 글자와 화살표를 Warm Paper로 뒤집는다. 본문은 1px 점선 아래에 좌우 22px로 펼친다.
- **Closed State:** Warm Paper 바탕과 Carbon Ink 텍스트를 유지한다. 2단계 보안 띠는 티켓이 닫혀 있어도 계속 노출한다.
- **Focus:** 전역 4px Focus Gold 외곽선과 2px 간격을 그대로 사용한다.

### Primary Actions

- **Shape:** 작은 곡률(8px)과 최소 높이 58px의 전체 너비 버튼이다.
- **Primary:** Carbon Ink 면 위에 Warm Paper 글자를 사용하고 안쪽 여백은 14px 18px다.
- **Active / Focus:** 누르는 동안 2px 아래로 이동한다. 키보드 포커스는 4px Focus Gold 외곽선으로 보인다.
- **Disabled:** 같은 형태를 유지하되 불투명도를 42%로 낮추고 금지 커서를 쓴다.

### Security Strip

- **Character:** 개인키 위험을 다른 도움말과 혼동하지 않게 하는 영구 노출 띠다.
- **Style:** 높이 62px의 Avalanche Red 면, Warm Paper 경고 삼각형과 굵은 문장, 13px 18px의 내부 여백을 사용한다.
- **Behavior:** 2단계 티켓의 열림 여부와 관계없이 항상 보이며 장식 아이콘이나 추가 색을 붙이지 않는다.

### Proof Panels

- **Character:** 로그인 계정과 지갑 주소가 확인되었다는 사실을 영수증의 검수 도장처럼 보여 준다.
- **Style:** Avalanche Red가 7% 섞인 종이 면, 위 4px 빨간 규칙선, 18px 내부 여백, 8px 수직 간격을 사용한다.
- **Content:** 계정은 줄바꿈 가능한 굵은 텍스트로, 주소는 축약한 모노스페이스 문자열로 표시한다.

### Screenshot Placeholders

- **Character:** 실제 캡처가 들어올 자리와 안전한 촬영 범위를 동시에 설명하는 제작 메모다.
- **Style:** 2px 점선 테두리 안에 9:16 비율의 작은 선형 화면과 15px 설명을 나란히 둔다.
- **Content:** `SCREENSHOT` 표시는 자리표시자에서만 사용한다. 개인키 입력·표시 화면은 예시로 그리지 않는다.

### Instruction Lists & Dark Notes

- **Instruction List:** 각 행 왼쪽에 Avalanche Red `01–04` 카운터를 고정하고 1px 중립 구분선으로 순서를 나눈다. 행은 최소 높이 66px다.
- **Dark Note:** 지연이나 확인 실패처럼 놓치기 쉬운 안내는 Carbon Ink 면과 Warm Paper 텍스트, 20px 내부 여백으로 강조한다.

## Do's and Don'ts

### Do:

- **Do** 한 번에 하나의 티켓만 펼쳐 사용자의 다음 행동을 한 문장으로 보여 준다.
- **Do** 현재 티켓과 4칸 진행선을 같은 순번으로 동기화한다.
- **Do** 2단계 개인키 경고를 티켓의 열림 여부와 무관하게 계속 노출한다.
- **Do** 지갑 주소는 앞 8자와 뒤 6자만 남겨 축약하고 Core에서 같은 주소인지 확인하는 맥락으로만 보여 준다.
- **Do** 휴대폰에서 16px 이상 본문과 48px 이상 터치 대상을 유지한다.

### Don't:

- **Don't** 그라디언트, 그림자, 유리 효과, 둥근 SaaS 카드 그리드를 추가하지 않는다.
- **Don't** 개인키 전체나 일부, QR 코드, 가짜 앱 스크린샷을 렌더링하지 않는다.
- **Don't** Avalanche Red를 일반 장식 면으로 확장해 활성 상태와 보안 경고의 의미를 약화하지 않는다.
- **Don't** 데스크톱에서 티켓을 여러 열로 나눠 영수증의 순차 읽기 흐름을 깨지 않는다.
- **Don't** NFT 전송, 토큰 가격, 수익을 암시하는 이미지나 문구를 넣지 않는다.
