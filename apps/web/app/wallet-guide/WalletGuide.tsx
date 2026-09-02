'use client';

import {
  useExportWallet,
  useLogin,
  useLogout,
  usePrivy,
} from '@privy-io/react-auth';
import Image from 'next/image';
import { useMemo, useState } from 'react';

import { PRIVY_ENABLED } from '@/app/join/PrivyClientProvider';
import { BrandMark } from '@/components/BrandMark';

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const OPENSEA_COLLECTION_URL = 'https://opensea.io/collection/0x787d2971ec3eaa6b63d51bb52834ab41d2cd18a9';

type ClientLinkedAccount = {
  type: string;
  walletClientType?: string;
  chainType?: string;
  address?: string;
  walletIndex?: number | null;
};

type GuideState = {
  ready: boolean;
  authenticated: boolean;
  email: string | null;
  walletAddress: string | null;
  authError: string | null;
  exportError: string | null;
  exporting: boolean;
};

type GuideActions = {
  login: () => void;
  useAnotherAccount: () => Promise<void>;
  exportWallet: () => Promise<boolean>;
};

const EMPTY_ACTIONS: GuideActions = {
  login: () => undefined,
  useAnotherAccount: async () => undefined,
  exportWallet: async () => false,
};

function compactAddress(address: string | null) {
  if (!address) return null;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

/** 백엔드와 같이 가장 낮은 wallet index의 Privy embedded EVM 지갑을 고른다. */
export function selectEmbeddedEthereumWallet(accounts: readonly ClientLinkedAccount[]) {
  return accounts
    .filter((account) => (
      account.type === 'wallet'
      && account.walletClientType === 'privy'
      && account.chainType === 'ethereum'
      && typeof account.address === 'string'
      && EVM_ADDRESS.test(account.address)
    ))
    .sort((left, right) => (
      (left.walletIndex ?? Number.MAX_SAFE_INTEGER)
      - (right.walletIndex ?? Number.MAX_SAFE_INTEGER)
    ))[0]?.address ?? null;
}

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

export function WalletGuideContent({ state, actions = EMPTY_ACTIONS }: {
  state: GuideState;
  actions?: GuideActions;
}) {
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const safeAddress = compactAddress(state.walletAddress);

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
          <h2 id="core-wallet-heading">Core Wallet에서도 관리하고 싶다면</h2>
          <p>아래 과정은 선택 사항입니다. NFT를 다른 지갑으로 보내는 것이 아니라, 행사 때 만든 <strong>같은 지갑을 Core 모바일에서 다시 여는 과정</strong>입니다.</p>
          <div className="wallet-core-choice">
            <strong>참가증서를 보는 것만 필요하다면</strong>
            <span>위의 OpenSea 확인만으로 충분하며 개인키가 필요하지 않습니다.</span>
          </div>
        </section>

        <div className="wallet-guide-steps">
          <section className="wallet-guide-step" aria-labelledby="prepare-heading">
            <StepHeading number={1} id="prepare-heading">Core 모바일 먼저 준비하기</StepHeading>
            <p>개인키를 복사한 뒤 바로 가져올 수 있도록 본인 휴대폰에 Core 앱을 먼저 설치해 주세요.</p>
            <a className="wallet-guide-link" href="https://core.app/download" target="_blank" rel="noreferrer">Core 모바일 설치</a>
          </section>

          <section className="wallet-guide-step" aria-labelledby="login-heading">
            <StepHeading number={2} id="login-heading">행사 때 쓴 Google 계정으로 로그인</StepHeading>
            <p>참가증서를 받을 때 선택한 Google 계정으로 로그인해 주세요.</p>
            {!state.ready ? (
              <button className="wallet-guide-action" type="button" disabled>로그인 준비 중…</button>
            ) : state.authenticated ? (
              <div className="wallet-account-proof" role="status">
                <span>로그인 확인</span>
                <strong>{state.email ?? 'Google 계정으로 로그인됨'}</strong>
                <button type="button" onClick={() => void actions.useAnotherAccount()}>다른 계정 사용하기</button>
              </div>
            ) : (
              <button className="wallet-guide-action" type="button" onClick={actions.login}>Google로 로그인</button>
            )}
            {state.authError ? <p className="wallet-guide-error" role="alert">{state.authError}</p> : null}
          </section>

          <section className="wallet-guide-step" aria-labelledby="export-heading">
            <StepHeading number={3} id="export-heading">Privy 지갑을 Core로 가져오기</StepHeading>
            <p>버튼을 누르면 Privy의 공식 보안 창이 열립니다. 이 페이지는 개인키를 보거나 저장하지 않습니다.</p>
            <div className="wallet-security-strip">
              <WarningMark />
              <div>
                <strong>개인키를 아는 사람은 이 지갑을 사용할 수 있습니다.</strong>
                <span>이메일, 메신저, 메모장에 보내거나 저장하지 마세요.</span>
              </div>
            </div>
            {safeAddress ? (
              <div className="wallet-address-proof">
                <span>행사 때 만든 EVM 지갑</span>
                <code>{safeAddress}</code>
                <small>Core로 가져온 뒤에도 이 주소가 같아야 합니다.</small>
              </div>
            ) : null}
            <aside className="wallet-copy-help" aria-labelledby="wallet-copy-help-title">
              <h3 id="wallet-copy-help-title">Privy 창이 열리면</h3>
              <ol>
                <li><code>Loading...</code>이 사라질 때까지 기다립니다.</li>
                <li><strong><code>Private key</code></strong> 항목의 <strong>Copy</strong>를 누릅니다.</li>
              </ol>
              <p><strong><code>Your wallet</code> 옆 Copy는 지갑 주소만 복사하므로 Core로 가져올 수 없습니다.</strong></p>
            </aside>
            <div className="wallet-import-next">
              <h3>복사한 뒤 Core에서 바로 이어서</h3>
              <ol className="wallet-guide-instructions">
                <li>Core 앱 왼쪽 위의 <strong>현재 계정 이름</strong>을 누릅니다.</li>
                <li>오른쪽 위의 <strong>+</strong>를 누르고 <strong>Import a private key</strong>를 선택합니다.</li>
                <li>복사한 <strong>Private key</strong>를 바로 붙여 넣고 <strong>Import</strong>를 누릅니다.</li>
              </ol>
              <p className="wallet-guide-key-format"><code>0x</code>로 시작하는 66자 전체를 사용합니다. 별도 문서나 메시지에 저장하지 마세요.</p>
            </div>
            <label className="wallet-risk-confirmation">
              <input
                type="checkbox"
                checked={riskAcknowledged}
                onChange={(event) => setRiskAcknowledged(event.target.checked)}
              />
              <span>개인키가 지갑을 사용할 수 있는 비밀 정보이며, 누구에게도 보내지 않아야 한다는 점을 확인했습니다.</span>
            </label>
            <button
              className="wallet-guide-action"
              type="button"
              disabled={!state.ready || !state.authenticated || !state.walletAddress || !riskAcknowledged || state.exporting}
              onClick={() => void actions.exportWallet()}
            >
              {state.exporting ? 'Privy 보안 창 여는 중…' : '확인하고 Privy 보안 창 열기'}
            </button>
            {!state.authenticated ? <p className="wallet-guide-help">먼저 2단계에서 Google 로그인을 완료해 주세요.</p> : null}
            {state.authenticated && !state.walletAddress ? <p className="wallet-guide-error" role="alert">이 계정에서 행사 때 만든 지갑을 찾지 못했습니다. Google 계정이 맞는지 확인해 주세요.</p> : null}
            {state.exportError ? <p className="wallet-guide-error" role="alert">{state.exportError}</p> : null}
          </section>

          <section className="wallet-guide-step" aria-labelledby="collectibles-heading">
            <StepHeading number={4} id="collectibles-heading">Collectibles에서 참가증서 확인</StepHeading>
            {safeAddress ? (
              <div className="wallet-address-proof">
                <span>Core에서 선택할 EVM 계정</span>
                <code>{safeAddress}</code>
                <small>왼쪽 위 계정 이름을 누른 뒤, 이 주소와 같은 계정을 선택하세요.</small>
              </div>
            ) : null}
            <ol className="wallet-guide-instructions">
              <li>Core 왼쪽 위의 <strong>계정 이름</strong>을 누르고, 방금 가져온 계정을 선택합니다.</li>
              <li><strong>Collectibles</strong>에서 <strong>Avalanche Bakery Certificate</strong>를 선택합니다.</li>
              <li>이미지가 바로 보이지 않으면 NFT 상세를 위로 밀고 <strong>Refresh</strong>를 누릅니다.</li>
            </ol>
            <div className="wallet-guide-note">
              <strong>참가증서가 바로 보이지 않나요?</strong>
              <p>먼저 계정 주소가 같은지 확인하세요. 이미지만 갱신되지 않았다면 <strong>Refresh</strong>를 누르세요. 반영에는 시간이 걸릴 수 있습니다.</p>
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

function PrivyWalletGuide() {
  const { ready, authenticated, user } = usePrivy();
  const [authError, setAuthError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { login } = useLogin({
    onComplete: () => setAuthError(null),
    onError: () => setAuthError('로그인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.'),
  });
  const { logout } = useLogout();
  const { exportWallet } = useExportWallet();

  const googleEmail = useMemo(() => {
    const account = user?.linkedAccounts.find((linked) => linked.type === 'google_oauth');
    return account && 'email' in account && typeof account.email === 'string' ? account.email : null;
  }, [user]);

  const walletAddress = useMemo(() => {
    return selectEmbeddedEthereumWallet(user?.linkedAccounts ?? []);
  }, [user]);

  const handleExport = async () => {
    if (!walletAddress) return false;
    setExporting(true);
    setExportError(null);
    try {
      await exportWallet({ address: walletAddress });
      return true;
    } catch {
      setExportError('지갑 내보내기 창을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return false;
    } finally {
      setExporting(false);
    }
  };

  const actions: GuideActions = {
    login: () => {
      setAuthError(null);
      login();
    },
    useAnotherAccount: async () => {
      await logout();
    },
    exportWallet: handleExport,
  };

  return (
    <WalletGuideContent
      state={{
        ready,
        authenticated,
        email: googleEmail,
        walletAddress,
        authError,
        exportError,
        exporting,
      }}
      actions={actions}
    />
  );
}

export function WalletGuide() {
  if (PRIVY_ENABLED) return <PrivyWalletGuide />;
  return (
    <WalletGuideContent
      state={{
        ready: true,
        authenticated: false,
        email: null,
        walletAddress: null,
        authError: null,
        exportError: null,
        exporting: false,
      }}
    />
  );
}
