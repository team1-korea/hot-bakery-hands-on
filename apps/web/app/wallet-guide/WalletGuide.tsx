'use client';

import {
  getAccessToken,
  useExportWallet,
  useLogin,
  useLogout,
  usePrivy,
} from '@privy-io/react-auth';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { PRIVY_ENABLED } from '@/app/join/PrivyClientProvider';
import { BrandMark } from '@/components/BrandMark';
import { getWalletGuideEligibility, setAuthTokenGetter } from '@/lib/api/client';

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
  certificateStatus: 'idle' | 'checking' | 'verified' | 'not-found' | 'error';
  authError: string | null;
  exportError: string | null;
  exporting: boolean;
};

type GuideActions = {
  login: () => void;
  useAnotherAccount: () => Promise<void>;
  exportWallet: () => Promise<boolean>;
  retryCertificateCheck: () => void;
};

type CertificateCheck = {
  key: string;
  status: 'verified' | 'not-found' | 'error';
};

const EMPTY_ACTIONS: GuideActions = {
  login: () => undefined,
  useAnotherAccount: async () => undefined,
  exportWallet: async () => false,
  retryCertificateCheck: () => undefined,
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
  const certificateVerified = state.certificateStatus === 'verified';
  const safeAddress = certificateVerified ? compactAddress(state.walletAddress) : null;

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
          <p>먼저 OpenSea에서 참가증서를 확인해 보세요. Core Wallet은 <strong>원하는 분만</strong> 연결하면 됩니다.</p>
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
          <p>NFT를 다른 지갑으로 보내는 과정이 아닙니다. 행사 때 만든 <strong>같은 지갑을 Core 모바일에서도 여는 과정</strong>입니다.</p>
          <div className="wallet-guide-readonly">
            <strong>개인키는 참가자 본인에게만 보입니다.</strong>
            <span>아래 버튼은 Privy 공식 보안 창을 열어 줄 뿐입니다. 이 안내 페이지와 서버는 개인키 값을 읽거나 저장하지 않습니다.</span>
          </div>
        </section>

        <div className="wallet-guide-steps">
          <section className="wallet-guide-step" aria-labelledby="prepare-heading">
            <StepHeading number={1} id="prepare-heading">Core 앱 먼저 준비하기</StepHeading>
            <p>본인 휴대폰에 Core 앱을 설치하고 기본 지갑 설정을 마칩니다. 개인키를 확인한 뒤 바로 Core로 옮겨 적을 수 있도록 먼저 준비해 주세요.</p>
            <a className="wallet-guide-link" href="https://core.app/download" target="_blank" rel="noreferrer">Core 모바일 설치</a>
          </section>

          <section className="wallet-guide-step" aria-labelledby="login-heading">
            <StepHeading number={2} id="login-heading">안내 메일을 받은 Google 계정으로 로그인</StepHeading>
            <p>이 안내 메일은 참가증서가 발급된 Google 계정으로 보냈습니다. 다른 계정으로 로그인하면 참가증서가 없는 Privy 지갑이 열릴 수 있습니다.</p>
            {!state.ready ? (
              <button className="wallet-guide-action" type="button" disabled>로그인 준비 중…</button>
            ) : state.authenticated ? (
              <div className="wallet-account-proof" role="status">
                <span>로그인한 Google 계정</span>
                <strong>{state.email ?? 'Google 계정으로 로그인됨'}</strong>
                <button type="button" onClick={() => void actions.useAnotherAccount()}>다른 계정으로 다시 로그인</button>
              </div>
            ) : (
              <button className="wallet-guide-action" type="button" onClick={actions.login}>Google로 로그인</button>
            )}
            {state.authError ? <p className="wallet-guide-error" role="alert">{state.authError}</p> : null}
            {state.certificateStatus === 'checking' ? (
              <p className="wallet-guide-help" role="status">이 계정의 참가증서 발급 기록을 확인하고 있습니다…</p>
            ) : null}
            {state.certificateStatus === 'not-found' ? (
              <p className="wallet-guide-error" role="alert">이 계정의 발급 완료 기록과 현재 지갑이 일치하지 않습니다. 안내 메일을 받은 Google 계정인지 확인해 주세요.</p>
            ) : null}
            {state.certificateStatus === 'error' ? (
              <>
                <p className="wallet-guide-error" role="alert">참가증서 발급 기록을 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.</p>
                <button className="wallet-guide-action" type="button" onClick={actions.retryCertificateCheck}>발급 기록 다시 확인</button>
              </>
            ) : null}
          </section>

          <section className="wallet-guide-step" aria-labelledby="export-heading">
            <StepHeading number={3} id="export-heading">Privy 보안 창에서 지갑 확인</StepHeading>
            <p>아래 버튼을 누르면 Privy의 공식 보안 창이 열립니다. 개인키는 그 창 안에서만 표시되며, 참가자가 직접 확인합니다.</p>
            <div className="wallet-security-strip">
              <WarningMark />
              <div>
                <strong>개인키를 아는 사람은 이 지갑을 사용할 수 있습니다.</strong>
                <span>다른 사람에게 보내거나 별도 문서에 저장하지 말고, 본인 휴대폰의 Core 앱에만 직접 입력하세요.</span>
              </div>
            </div>
            {safeAddress ? (
              <div className="wallet-address-proof">
                <span>행사 때 만든 EVM 지갑</span>
                <code>{safeAddress}</code>
                <small>Core에 가져온 뒤에도 이 주소가 같아야 합니다.</small>
              </div>
            ) : null}
            <aside className="wallet-copy-help" aria-labelledby="wallet-copy-help-title">
              <h3 id="wallet-copy-help-title">Privy 창에서 확인할 항목</h3>
              <dl>
                <div>
                  <dt><code>Your wallet</code></dt>
                  <dd>참가증서가 발행된 지갑 주소입니다. 나중에 Core 주소와 같은지 비교할 때 사용합니다.</dd>
                </div>
                <div>
                  <dt><code>Private key</code></dt>
                  <dd>Core에서 같은 지갑을 열 때 필요한 비밀 정보입니다. 참가자가 직접 Core에 입력합니다.</dd>
                </div>
              </dl>
            </aside>
            <label className="wallet-risk-confirmation">
              <input
                type="checkbox"
                checked={riskAcknowledged}
                onChange={(event) => setRiskAcknowledged(event.target.checked)}
              />
              <span>개인키를 다른 사람에게 보내지 않고, 본인의 Core 앱에만 직접 입력하겠습니다.</span>
            </label>
            <button
              className="wallet-guide-action"
              type="button"
              disabled={!state.ready || !state.authenticated || !certificateVerified || !state.walletAddress || !riskAcknowledged || state.exporting}
              onClick={() => void actions.exportWallet()}
            >
              {state.exporting ? 'Privy 보안 창 여는 중…' : 'Privy 보안 창 열기'}
            </button>
            {!state.authenticated ? <p className="wallet-guide-help">먼저 2단계에서 Google 로그인을 완료해 주세요.</p> : null}
            {state.authenticated && certificateVerified && !state.walletAddress ? <p className="wallet-guide-error" role="alert">이 계정에서 행사 때 만든 지갑을 찾지 못했습니다. Google 계정이 맞는지 확인해 주세요.</p> : null}
            {state.exportError ? <p className="wallet-guide-error" role="alert">{state.exportError}</p> : null}
          </section>

          <section className="wallet-guide-step" aria-labelledby="import-heading">
            <StepHeading number={4} id="import-heading">같은 지갑을 Core로 가져오기</StepHeading>
            <ol className="wallet-guide-instructions">
              <li>Core 앱 왼쪽 위의 <strong>현재 계정 이름</strong>을 누릅니다.</li>
              <li>오른쪽 위의 <strong>+</strong>를 누르고 <strong>Import a private key</strong>를 선택합니다.</li>
              <li>Privy 보안 창에서 확인한 <strong>Private key</strong>를 Core에 직접 입력하고 <strong>Import</strong>를 누릅니다.</li>
              <li>Privy의 <strong>Your wallet</strong> 주소와 Core에 추가된 <strong>EVM 지갑 주소가 같은지</strong> 확인합니다.</li>
            </ol>
            <p className="wallet-guide-key-format"><code>0x</code>로 시작하는 66자 전체를 입력합니다. 두 주소가 다르면 참가증서가 보이지 않으니 계정을 먼저 확인해 주세요.</p>
          </section>

          <section className="wallet-guide-step" aria-labelledby="collectibles-heading">
            <StepHeading number={5} id="collectibles-heading">Collectibles에서 참가증서 확인</StepHeading>
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

function PrivyWalletGuide() {
  const { ready, authenticated, user } = usePrivy();
  const [authError, setAuthError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [certificateCheck, setCertificateCheck] = useState<CertificateCheck | null>(null);
  const [certificateCheckAttempt, setCertificateCheckAttempt] = useState(0);

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

  const walletAddress = useMemo(() => (
    selectEmbeddedEthereumWallet(user?.linkedAccounts ?? [])
  ), [user]);

  const certificateCheckKey = `${user?.id ?? 'anonymous'}:${certificateCheckAttempt}`;
  const certificateStatus: GuideState['certificateStatus'] = !authenticated
    ? 'idle'
    : certificateCheck?.key === certificateCheckKey
      ? certificateCheck.status
      : 'checking';

  useEffect(() => {
    if (!ready) return;

    setAuthTokenGetter(() => getAccessToken());
    let cancelled = false;

    if (authenticated) {
      void getWalletGuideEligibility()
        .then(({ eligible }) => {
          if (!cancelled) {
            setCertificateCheck({
              key: certificateCheckKey,
              status: eligible ? 'verified' : 'not-found',
            });
          }
        })
        .catch(() => {
          if (!cancelled) setCertificateCheck({ key: certificateCheckKey, status: 'error' });
        });
    }

    return () => {
      cancelled = true;
      setAuthTokenGetter(null);
    };
  }, [authenticated, certificateCheckKey, ready]);

  const handleExport = async () => {
    if (!walletAddress || certificateStatus !== 'verified') return false;
    setExporting(true);
    setExportError(null);
    try {
      await exportWallet({ address: walletAddress });
      return true;
    } catch {
      setExportError('Privy 보안 창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return false;
    } finally {
      setExporting(false);
    }
  };

  return (
    <WalletGuideContent
      state={{
        ready,
        authenticated,
        email: googleEmail,
        walletAddress,
        certificateStatus,
        authError,
        exportError,
        exporting,
      }}
      actions={{
        login: () => {
          setAuthError(null);
          login();
        },
        useAnotherAccount: async () => {
          await logout();
        },
        exportWallet: handleExport,
        retryCertificateCheck: () => setCertificateCheckAttempt((attempt) => attempt + 1),
      }}
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
        certificateStatus: 'idle',
        authError: null,
        exportError: null,
        exporting: false,
      }}
    />
  );
}
