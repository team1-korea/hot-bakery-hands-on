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
          <p>먼저 OpenSea에서 참가증서를 확인해 보세요. Core Wallet은 <strong>원하는 분만 나중에</strong> 연결해도 됩니다.</p>
        </section>

        <section className="wallet-opensea-primary" aria-labelledby="opensea-heading">
          <div>
            <h2 id="opensea-heading">OpenSea에서 참가증서 확인</h2>
            <p>지갑을 연결하거나 개인키를 입력하지 않아도 됩니다. 행사 때 받은 토큰 번호로 내 증서를 찾아보세요. 닉네임도 함께 표시됩니다.</p>
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
          <h2 id="core-wallet-heading">Core Wallet에서 직접 관리하고 싶다면</h2>
          <p>NFT를 다른 지갑으로 보내는 과정이 아닙니다. 행사 때 만든 <strong>같은 지갑을 Core 모바일에서도 열어 보는 과정</strong>입니다.</p>
          <div className="wallet-core-choice">
            <strong>지금 참가증서만 확인하려는 경우</strong>
            <span>여기서 멈춰도 됩니다. 위의 OpenSea 확인에는 개인키가 필요하지 않습니다.</span>
          </div>
          <div className="wallet-guide-readonly">
            <strong>아래 내용은 Core 연결 과정을 미리 설명하는 안내입니다.</strong>
            <span>이 공개 페이지에서는 Google 로그인을 받거나 개인키를 보여 주지 않습니다. 따라서 이 페이지 안에서 Core 연결을 바로 완료할 수는 없습니다.</span>
          </div>
        </section>

        <div className="wallet-guide-steps">
          <section className="wallet-guide-step" aria-labelledby="prepare-heading">
            <StepHeading number={1} id="prepare-heading">Core 앱 먼저 준비하기</StepHeading>
            <p>Core 연결을 원한다면 본인 휴대폰에 Core 앱을 설치하고, 앱의 기본 지갑 설정을 먼저 마칩니다.</p>
            <a className="wallet-guide-link" href="https://core.app/download" target="_blank" rel="noreferrer">Core 모바일 설치</a>
          </section>

          <section className="wallet-guide-step" aria-labelledby="export-heading">
            <StepHeading number={2} id="export-heading">Privy 지갑 내보내기</StepHeading>
            <p>Core에 같은 지갑을 추가하려면 참가증서가 발행된 Privy 지갑의 개인키가 필요합니다. 개인키는 공개 안내 페이지가 아니라, <strong>행사 때 사용한 Google 계정으로 본인 확인을 마친 Privy 공식 보안 창</strong>에서만 확인해야 합니다.</p>
            <p className="wallet-guide-key-format">현재 이 페이지에는 해당 내보내기 창을 여는 기능이 없습니다. 별도의 본인 확인된 내보내기 화면을 안내받기 전에는 다음 단계를 진행하지 않아도 됩니다.</p>
            <div className="wallet-security-strip">
              <WarningMark />
              <div>
                <strong>개인키를 아는 사람은 이 지갑을 사용할 수 있습니다.</strong>
                <span>개인키가 보이면 다른 사람에게 보내거나 별도 문서에 옮기지 말고, 본인 휴대폰의 Core 앱에만 직접 입력하세요.</span>
              </div>
            </div>
            <aside className="wallet-copy-help" aria-labelledby="wallet-copy-help-title">
              <h3 id="wallet-copy-help-title">Privy 창에서 헷갈리기 쉬운 두 항목</h3>
              <dl>
                <div>
                  <dt><code>Your wallet</code></dt>
                  <dd>참가증서의 소유자를 확인할 때 쓰는 지갑 주소입니다. 거래 기록도 함께 공개되므로 불필요하게 공유하지 마세요. 이 값만으로는 Core에 지갑을 가져올 수 없습니다.</dd>
                </div>
                <div>
                  <dt><code>Private key</code></dt>
                  <dd>Core가 같은 지갑을 열 때 필요한 비밀 정보입니다. 주소와 달리 누구에게도 보여 주면 안 됩니다.</dd>
                </div>
              </dl>
            </aside>
          </section>

          <section className="wallet-guide-step" aria-labelledby="import-heading">
            <StepHeading number={3} id="import-heading">같은 지갑을 Core로 가져오기</StepHeading>
            <p>별도의 본인 확인된 Privy 내보내기 화면을 받은 뒤, 아래 순서대로 진행합니다.</p>
            <ol className="wallet-guide-instructions">
              <li>Core 앱 왼쪽 위의 <strong>현재 계정 이름</strong>을 누릅니다.</li>
              <li>오른쪽 위의 <strong>+</strong>를 누르고 <strong>Import a private key</strong>를 선택합니다.</li>
              <li>Privy 공식 보안 창의 <strong>Private key</strong> 값을 Core에 직접 입력하고 <strong>Import</strong>를 누릅니다.</li>
              <li>Privy의 <strong>Your wallet</strong> 주소와 Core에 추가된 <strong>EVM 지갑 주소가 같은지</strong> 확인합니다.</li>
            </ol>
            <p className="wallet-guide-key-format">두 주소가 다르면 참가증서가 보이지 않습니다. 개인키를 다시 입력하기 전에 선택한 Privy 지갑과 Core 계정을 먼저 확인하세요.</p>
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
              <p>먼저 Privy와 Core의 EVM 지갑 주소가 같은지 확인하세요. 주소가 같고 이미지만 보이지 않는다면 <strong>Refresh</strong>를 눌러 주세요. Core에 반영되기까지 최대 24시간이 걸릴 수 있습니다.</p>
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
            <a href="https://docs.privy.io/wallets/wallets/export" target="_blank" rel="noreferrer">Privy 지갑 내보내기 설명</a>
            <a href="https://support.core.app/en/articles/11716428-core-mobile-how-do-i-import-an-account" target="_blank" rel="noreferrer">Core 공식 안내</a>
            <a href="https://support.core.app/en/articles/11469838-core-mobile-how-do-i-refresh-nft-metadata" target="_blank" rel="noreferrer">Core NFT 확인 안내</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
