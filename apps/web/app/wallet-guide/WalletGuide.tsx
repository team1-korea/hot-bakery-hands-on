import Image from 'next/image';

import { BrandMark } from '@/components/BrandMark';

const OPENSEA_COLLECTION_URL = 'https://opensea.io/collection/0x787d2971ec3eaa6b63d51bb52834ab41d2cd18a9';

function WarningMark() {
  return (
    <svg className="wallet-warning-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 30 28H2L16 3Z" />
      <path d="M16 11v8M16 23v1" />
    </svg>
  );
}

function StepHeading({ number, id, children }: {
  number: number;
  id: string;
  children: string;
}) {
  return (
    <header className="wallet-step-heading">
      <span aria-hidden="true">{number}</span>
      <h2 id={id}>{children}</h2>
    </header>
  );
}

export function WalletGuide() {
  return (
    <main className="wallet-guide">
      <header className="wallet-guide-header">
        <div className="wallet-guide-brand">
          <BrandMark />
          <strong>AVALANCHE BAKERY</strong>
        </div>
      </header>

      <div className="wallet-guide-paper">
        <section className="wallet-guide-intro">
          <h1>참가증서 확인과<br /><span>지갑 이용 안내</span></h1>
          <p>먼저 참가증서를 확인해 보세요. Core Wallet에서 직접 관리하는 과정은 <strong>원하는 경우에만</strong> 진행하면 됩니다.</p>
        </section>

        <section className="wallet-opensea-primary" aria-labelledby="opensea-heading">
          <div>
            <h2 id="opensea-heading">OpenSea에서 참가증서 확인</h2>
            <p>지갑을 연결하지 않아도 전체 증서와 소유 주소를 볼 수 있습니다. 행사 때 확인한 토큰 번호나 닉네임으로 내 증서를 찾아보세요.</p>
          </div>
          <a
            className="wallet-guide-action"
            href={OPENSEA_COLLECTION_URL}
            target="_blank"
            rel="noreferrer"
          >
            OpenSea에서 확인하기
          </a>
          <p className="wallet-guide-locked">이 참가증서는 다른 지갑으로 보낼 수 없도록 잠긴 NFT입니다.</p>
        </section>

        <section className="wallet-core-intro" id="core-wallet" aria-labelledby="core-wallet-heading">
          <h2 id="core-wallet-heading">Core Wallet에서도 확인하고 싶다면</h2>
          <p>NFT를 다른 지갑으로 보내는 것이 아니라, 행사 때 만든 <strong>같은 지갑을 Core 모바일에서 다시 여는 과정</strong>입니다.</p>
          <div className="wallet-core-choice">
            <strong>참가증서를 보는 것만 필요하다면</strong>
            <span>위의 OpenSea 확인만으로 충분하며 개인키가 필요하지 않습니다.</span>
          </div>
          <div className="wallet-guide-readonly">
            <strong>이 페이지는 방법만 안내합니다.</strong>
            <span>Google 로그인이나 개인키 내보내기 기능이 없으며, 개인키를 입력하거나 저장하지 않습니다.</span>
          </div>
        </section>

        <div className="wallet-guide-steps">
          <section className="wallet-guide-step" aria-labelledby="prepare-heading">
            <StepHeading number={1} id="prepare-heading">Core 모바일 준비</StepHeading>
            <p>Core로 가져오기로 결정했다면 본인 휴대폰에 Core 앱을 먼저 설치합니다.</p>
            <a className="wallet-guide-link" href="https://core.app/download" target="_blank" rel="noreferrer">Core 모바일 설치</a>
          </section>

          <section className="wallet-guide-step" aria-labelledby="export-heading">
            <StepHeading number={2} id="export-heading">Privy 지갑 내보내기</StepHeading>
            <p>행사 때 사용한 Google 계정으로 로그인한 뒤, Privy 공식 내보내기 창에서 참가증서가 발행된 지갑의 개인키를 확인합니다.</p>
            <div className="wallet-security-strip">
              <WarningMark />
              <div>
                <strong>개인키를 아는 사람은 이 지갑을 사용할 수 있습니다.</strong>
                <span>이메일이나 메신저로 보내지 말고, 별도 문서나 메모장에 저장하지 마세요.</span>
              </div>
            </div>
            <aside className="wallet-copy-help" aria-labelledby="wallet-copy-help-title">
              <h3 id="wallet-copy-help-title">실제로 진행할 때 구분할 항목</h3>
              <dl>
                <div>
                  <dt><code>Your wallet</code></dt>
                  <dd>공개해도 되는 지갑 주소입니다. 이 값만으로는 Core에 가져올 수 없습니다.</dd>
                </div>
                <div>
                  <dt><code>Private key</code></dt>
                  <dd>지갑을 사용할 수 있는 비밀 정보입니다. 가져오기를 진행할 때만 취급해야 합니다.</dd>
                </div>
              </dl>
            </aside>
          </section>

          <section className="wallet-guide-step" aria-labelledby="import-heading">
            <StepHeading number={3} id="import-heading">같은 지갑을 Core로 가져오기</StepHeading>
            <ol className="wallet-guide-instructions">
              <li>Core 앱 왼쪽 위의 <strong>현재 계정 이름</strong>을 누릅니다.</li>
              <li>오른쪽 위의 <strong>+</strong>를 누르고 <strong>Import a private key</strong>를 선택합니다.</li>
              <li>Privy에서 확인한 개인키를 입력하고 <strong>Import</strong>를 누릅니다.</li>
              <li>가져오기 전후의 <strong>EVM 지갑 주소가 같은지</strong> 확인합니다.</li>
            </ol>
            <p className="wallet-guide-key-format">이 페이지에서는 위 절차를 실행하거나 개인키를 복사할 수 없습니다. 실제로 가져오려면 별도로 전달되는 안내에 따라 진행해 주세요.</p>
          </section>

          <section className="wallet-guide-step" aria-labelledby="collectibles-heading">
            <StepHeading number={4} id="collectibles-heading">Collectibles에서 참가증서 확인</StepHeading>
            <ol className="wallet-guide-instructions">
              <li>Core 왼쪽 위의 <strong>계정 이름</strong>을 누르고 방금 가져온 계정을 선택합니다.</li>
              <li><strong>Collectibles</strong>에서 <strong>Avalanche Bakery Certificate</strong>를 선택합니다.</li>
              <li>이미지가 바로 보이지 않으면 NFT 상세를 위로 밀고 <strong>Refresh</strong>를 누릅니다.</li>
            </ol>
            <div className="wallet-guide-note">
              <strong>참가증서가 바로 보이지 않나요?</strong>
              <p>먼저 가져오기 전후의 계정 주소가 같은지 확인하세요. 이미지만 갱신되지 않았다면 <strong>Refresh</strong>를 누르세요. 반영에는 시간이 걸릴 수 있습니다.</p>
            </div>
            <div className="wallet-core-gallery" aria-label="Core에서 참가증서를 확인한 실제 화면">
              <figure>
                <Image
                  src="/wallet-guide/core-collectibles.png"
                  alt="Core 모바일 Collectibles 탭에 세로형 Avalanche Bakery 참가증서가 표시된 화면"
                  width={945}
                  height={2048}
                  sizes="(max-width: 760px) calc(100vw - 84px), 290px"
                />
                <figcaption><strong>Collectibles 목록</strong><span>가져온 계정에서 참가증서를 확인합니다.</span></figcaption>
              </figure>
              <figure>
                <Image
                  src="/wallet-guide/core-certificate-detail.png"
                  alt="Core 모바일 참가증서 상세 화면에서 세로형 증서의 위아래 일부가 정사각형으로 잘려 보이는 화면"
                  width={945}
                  height={2048}
                  sizes="(max-width: 760px) calc(100vw - 84px), 290px"
                />
                <figcaption><strong>NFT 상세 화면</strong><span>Core 미리보기만 정사각형으로 보이며 원본 증서는 바뀌지 않습니다.</span></figcaption>
              </figure>
            </div>
          </section>
        </div>

        <footer className="wallet-guide-footer">
          <div>
            <a href="https://docs.privy.io/wallets/wallets/export" target="_blank" rel="noreferrer">Privy 공식 안내</a>
            <a href="https://support.core.app/en/articles/11716428-core-mobile-how-do-i-import-an-account" target="_blank" rel="noreferrer">Core 공식 안내</a>
            <a href="https://support.core.app/en/articles/11469838-core-mobile-how-do-i-refresh-nft-metadata" target="_blank" rel="noreferrer">Core NFT 확인 안내</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
