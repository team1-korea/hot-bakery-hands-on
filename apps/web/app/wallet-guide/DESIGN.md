---
name: "Avalanche Bakery Certificate Guide"
description: "참가증서 확인을 먼저 끝내고 Core 지갑 이전은 실행 없이 설명하는 모바일 우선 읽기 화면"
colors:
  avalanche-red: "#e84142"
  ember-red: "#b32b2c"
  warm-paper: "#f7f1e8"
  carbon-ink: "#17110f"
  focus-gold: "#d9a441"
typography:
  display:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "clamp(38px, 10.5vw, 68px)"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "clamp(27px, 7.3vw, 40px)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "clamp(24px, 6.4vw, 34px)"
    fontWeight: 900
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  subheading:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "21px"
    fontWeight: 900
    lineHeight: 1.35
  note:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "19px"
    fontWeight: 900
    lineHeight: 1.4
  lead:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "18px"
    fontWeight: 900
    lineHeight: 1.4
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
  label:
    fontFamily: "Archivo Black, Gothic A1, sans-serif"
    fontSize: "14px"
    fontWeight: 900
    lineHeight: 1.4
  mono:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "clamp(20px, 6vw, 29px)"
    fontWeight: 900
    lineHeight: 1.2
rounded:
  square: "0px"
  action: "8px"
---

# Design System: Avalanche Bakery Certificate Guide

## Creative North Star

**먼저 확인하고, 필요한 사람만 지갑을 연다.**

이 페이지의 첫 번째 성공은 참가자가 개인키 없이 OpenSea에서 자신의 증서를 확인하는 것이다. Core Wallet 가져오기는 기본 절차가 아니라 직접 지갑을 관리하려는 사람만 선택하는 고급 절차다. 공개 안내 페이지는 이 과정을 설명하되 로그인, 개인키 내보내기, 입력을 실행하지 않는다.

기존 행사 화면의 살구색 종이, Avalanche red, 검정 활자를 유지한다. 카드나 아코디언으로 화면을 전환하지 않고 위에서 아래로 읽는 한 장의 안내문으로 구성한다.

## Information Architecture

1. 참가증서와 지갑 안내 소개
2. 개인키가 필요 없는 OpenSea 확인
3. Core 이용이 선택 사항이라는 설명
4. Core 모바일 설치
5. Privy 내보내기 과정과 개인키 위험 설명
6. Core 가져오기 과정 설명
7. 같은 EVM 주소와 Collectibles 확인

OpenSea 확인과 Core 가져오기를 같은 무게로 두지 않는다. 전자는 기본 경로, 후자는 명시적인 선택 경로다.

## Visual Language

- Warm Paper는 전체 페이지의 연속된 바탕이다.
- Avalanche Red는 브랜드 띠, 지금 해야 할 첫 행동, 개인키 위험에만 쓴다.
- Carbon Ink는 본문과 Core 절차의 구조선, 버튼에 쓴다.
- 그림자, 그라디언트, 유리 효과, 바코드, 티켓 번호, 절취선은 사용하지 않는다.
- 버튼만 8px 곡률을 사용하고 나머지 구조는 직각과 2–4px 규칙선으로 만든다.

## Typography

- 첫 제목은 휴대폰에서도 두 줄로 읽히며 최대 `68px`, 자간은 `-0.04em`보다 좁히지 않는다.
- 본문은 최소 `16px`, 핵심 설명은 `17px`을 사용한다.
- 지갑 주소만 모노스페이스로 표시한다.
- 모든 한글 설명은 단어 중간에서 부자연스럽게 끊기지 않게 한다.

## Layout

모바일 우선 단일 열이며 콘텐츠 최대 너비는 `760px`이다. 데스크톱에서도 단계들을 여러 열로 나누지 않는다. OpenSea 기본 행동은 첫 화면 안에서 찾을 수 있어야 하고, Core 안내는 넉넉한 간격과 굵은 구분선 뒤에 시작한다.

Core 단계는 순서가 실제 작업에 필요하므로 `1–4` 번호를 사용한다. 각 단계는 별도 카드가 아니라 하나의 문서 안에서 규칙선으로 이어진다. 모든 터치 대상은 최소 `48px`, 주요 버튼은 최소 `58px` 높이다.

## Components

### OpenSea Primary Action

- Avalanche Red 면에 제목, 짧은 설명, 밝은 행동 버튼을 둔다.
- 지갑 연결과 개인키가 필요 없음을 버튼보다 먼저 알린다.
- 잠긴 NFT라는 사실을 같은 패널 하단에서 짧게 설명한다.

### Core Optional Introduction

- Core가 선택 사항임을 제목과 첫 문장에서 분명히 한다.
- “NFT를 옮기는 것”이 아니라 “같은 지갑을 다시 여는 것”이라고 설명한다.
- 증서 확인만 필요하면 OpenSea로 충분하다는 탈출 경로를 제공한다.

### Read-only Security Guidance

- 개인키를 가진 사람이 지갑을 사용할 수 있다는 결과를 설명한다.
- 이메일, 메신저, 메모장에 보내거나 저장하지 말라고 행동 가까이에서 알린다.
- 공개 페이지에는 로그인, Privy 내보내기 버튼, 개인키 입력란, 일부 값, QR 코드, 가짜 개인키 예시를 만들지 않는다.
- 실제 이전은 별도로 전달되는 안내에 따라 진행한다고 분명히 말한다.

### Core Screenshots

- 프로젝트 소유자가 실제 Core 모바일에서 촬영한 `core-collectibles.png`와 `core-certificate-detail.png`를 사용한다.
- 개인키 입력 화면은 캡처하지 않는다.
- 상세 화면의 정사각형 크롭은 Core 미리보기이며 원본 증서는 바뀌지 않는다고 설명한다.

## Interaction and Accessibility

- 페이지 내 절차는 접거나 다른 화면으로 이동시키지 않는다.
- 주요 외부 링크에는 뚜렷한 포커스 링을 제공한다.
- 모션 감소 설정에서는 첫 행동의 등장 효과를 사용하지 않는다.
- 외부 링크는 새 탭에서 열리고 링크 텍스트가 목적지를 직접 말한다.

## Do / Don’t

### Do

- 개인키 없는 확인 경로를 가장 먼저 보여 준다.
- 실제 참가자 지갑 주소와 Core 계정 주소를 비교하게 한다.
- 실패 문구는 문제와 다음 행동을 함께 말한다.
- 공식 Privy와 Core 안내 링크를 제공한다.

### Don’t

- Core 가져오기를 모든 참가자의 필수 절차처럼 표현하지 않는다.
- 개인키를 페이지, 로그, 분석 도구, 이메일에 수집하거나 저장하지 않는다.
- NFT 전송, 거래, 가격 상승을 암시하지 않는다.
- 아코디언, 단계 전환, 장식용 진행 막대로 내용을 숨기지 않는다.
