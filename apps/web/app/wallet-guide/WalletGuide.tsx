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

const STEP_LABELS = ['로그인', '지갑 내보내기', 'Core로 가져오기', '참가증서 확인'] as const;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className="wallet-ticket-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d={open ? 'M5 15 12 8l7 7' : 'm5 9 7 7 7-7'} />
    </svg>
  );
}

function WarningMark() {
  return (
    <svg className="wallet-warning-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 30 28H2L16 3Z" />
      <path d="M16 11v8M16 23v1" />
    </svg>
  );
}

function StepButton({
  step,
  open,
  onClick,
}: {
  step: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="wallet-ticket-head"
      data-open={open}
      type="button"
      aria-expanded={open}
      aria-controls={`wallet-guide-step-${step}`}
      onClick={onClick}
      id={`wallet-guide-step-button-${step}`}
    >
      <span className="wallet-ticket-title">{STEP_LABELS[step - 1]}</span>
      <span className="wallet-ticket-control" aria-hidden="true">
        <Chevron open={open} />
      </span>
    </button>
  );
}

export function WalletGuideContent({ state, actions = EMPTY_ACTIONS }: {
  state: GuideState;
  actions?: GuideActions;
}) {
  const initialStep = state.authenticated ? 2 : 1;
  const [activeStep, setActiveStep] = useState(initialStep);
  const [openSteps, setOpenSteps] = useState(() => new Set([initialStep]));
  const safeAddress = compactAddress(state.walletAddress);

  const open = (step: number) => {
    setActiveStep(step);
    setOpenSteps((current) => {
      const next = new Set(current);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };
  const moveToStep = (step: number) => {
    setActiveStep(step);
    setOpenSteps((current) => new Set(current).add(step));
    window.setTimeout(() => {
      const button = document.getElementById(`wallet-guide-step-button-${step}`);
      button?.focus({ preventScroll: true });
      button?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  };

  const handleExport = async () => {
    const exported = await actions.exportWallet();
    if (exported) moveToStep(3);
  };

  return (
    <main className="wallet-guide">
      <header className="wallet-guide-header">
        <div className="wallet-guide-brand">
          <BrandMark />
          <strong>AVALANCHE BAKERY</strong>
        </div>
        <ol className="wallet-guide-progress" aria-label="Core 지갑 안내 4단계">
          {STEP_LABELS.map((label, index) => (
            <li key={label} data-active={activeStep === index + 1}>
              <span className="sr-only">{index + 1}. {label}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="wallet-guide-paper">
        <section className="wallet-guide-intro">
          <h1>내 참가증서를<br /><span><em>Core</em>에서 확인해요</span></h1>
          <p>NFT를 옮기는 것이 아니라, 행사 때 만든 <strong>같은 지갑을 Core 모바일에서 여는 과정</strong>입니다.</p>
        </section>

        <div className="wallet-ticket-stack">
          <section className="wallet-ticket" data-step="1">
            <StepButton step={1} open={openSteps.has(1)} onClick={() => open(1)} />
            {openSteps.has(1) ? (
              <div className="wallet-ticket-body" id="wallet-guide-step-1">
                <h2>행사 때 쓴 Google 계정으로 로그인</h2>
                <p>참가증서를 받을 때 선택한 Google 계정으로 로그인해 주세요.</p>
                {!state.ready ? (
                  <button className="wallet-guide-action" type="button" disabled>로그인 준비 중…</button>
                ) : state.authenticated ? (
                  <>
                    <div className="wallet-account-proof" role="status">
                      <span>로그인 확인</span>
                      <strong>{state.email ?? 'Google 계정으로 로그인됨'}</strong>
                      <button type="button" onClick={() => void actions.useAnotherAccount()}>다른 계정 사용하기</button>
                    </div>
                    <button className="wallet-guide-action" type="button" onClick={() => moveToStep(2)}>다음: 지갑 내보내기</button>
                  </>
                ) : (
                  <button className="wallet-guide-action" type="button" onClick={actions.login}>Google로 로그인</button>
                )}
                {state.authError ? <p className="wallet-guide-error" role="alert">{state.authError}</p> : null}
              </div>
            ) : null}
          </section>

          <section className="wallet-ticket" data-step="2">
            <StepButton step={2} open={openSteps.has(2)} onClick={() => open(2)} />
            <div className="wallet-security-strip">
              <WarningMark />
              <strong>개인키는 누구에게도 보내지 마세요</strong>
            </div>
            {openSteps.has(2) ? (
              <div className="wallet-ticket-body" id="wallet-guide-step-2">
                <h2>내 Privy 지갑 내보내기</h2>
                <p>Privy 보안 창에서 개인키를 복사합니다. 이 사이트는 개인키를 보거나 저장할 수 없습니다.</p>
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
                    <li>아래쪽 <strong><code>Private key</code></strong> 항목의 <strong>Copy</strong>를 누릅니다.</li>
                  </ol>
                  <p><strong><code>Your wallet</code> 옆 Copy는 누르지 마세요.</strong> 지갑 주소만 복사됩니다.</p>
                </aside>
                <button
                  className="wallet-guide-action"
                  type="button"
                  disabled={!state.ready || !state.authenticated || !state.walletAddress || state.exporting}
                  onClick={() => void handleExport()}
                >
                  {state.exporting ? 'Privy 보안 창 여는 중…' : '내 지갑 내보내기'}
                </button>
                {!state.authenticated ? <p className="wallet-guide-help">먼저 1단계에서 Google 로그인을 완료해 주세요.</p> : null}
                {state.authenticated && !state.walletAddress ? <p className="wallet-guide-error" role="alert">이 계정에서 행사 때 만든 지갑을 찾지 못했습니다. Google 계정이 맞는지 확인해 주세요.</p> : null}
                {state.exportError ? <p className="wallet-guide-error" role="alert">{state.exportError}</p> : null}
              </div>
            ) : null}
          </section>

          <section className="wallet-ticket" data-step="3">
            <StepButton step={3} open={openSteps.has(3)} onClick={() => open(3)} />
            {openSteps.has(3) ? (
              <div className="wallet-ticket-body" id="wallet-guide-step-3">
                <h2>Core 모바일로 같은 지갑 가져오기</h2>
                <ol className="wallet-guide-instructions">
                  <li>Core 앱 왼쪽 위의 <strong>현재 계정 이름</strong>을 누릅니다.</li>
                  <li>계정 목록 오른쪽 위의 <strong>+</strong>를 누르고 <strong>Import a private key</strong>를 선택합니다.</li>
                  <li>Privy에서 복사한 <strong>Private key</strong>를 붙여 넣고 <strong>Import</strong>를 누릅니다.</li>
                </ol>
                <p className="wallet-guide-key-format"><code>0x</code>로 시작하는 66자 전체를 그대로 붙여 넣으세요.</p>
                <a className="wallet-guide-link" href="https://core.app/download" target="_blank" rel="noreferrer">Core 모바일 설치</a>
              </div>
            ) : null}
          </section>

          <section className="wallet-ticket" data-step="4">
            <StepButton step={4} open={openSteps.has(4)} onClick={() => open(4)} />
            {openSteps.has(4) ? (
              <div className="wallet-ticket-body" id="wallet-guide-step-4">
                <h2>가져온 계정의 Collectibles에서 확인</h2>
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
                  <p>증서가 없으면 계정 주소를 확인하세요. 이미지만 최신이 아니라면 <strong>Refresh</strong>를 누르세요. 갱신에는 최대 24시간이 걸릴 수 있습니다.</p>
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
                    <figcaption><strong>1. Collectibles 목록</strong><span>여기서는 참가증서 전체가 보입니다.</span></figcaption>
                  </figure>
                  <figure>
                    <Image
                      src="/wallet-guide/core-certificate-detail.png"
                      alt="Core 모바일 참가증서 상세 화면에서 세로형 증서의 위아래 일부가 정사각형으로 잘려 보이는 화면"
                      width={945}
                      height={2048}
                      sizes="(max-width: 760px) calc(100vw - 84px), 290px"
                    />
                    <figcaption><strong>2. NFT 상세 화면</strong><span>Core 미리보기만 정사각형으로 보이며, IPFS 원본은 그대로입니다.</span></figcaption>
                  </figure>
                </div>
                <p className="wallet-guide-locked">이 참가증서는 전송이 잠긴 NFT입니다. Core에서 확인하고 같은 지갑을 관리할 수 있지만 다른 지갑으로 보낼 수는 없습니다.</p>
              </div>
            ) : null}
          </section>
        </div>

        <footer className="wallet-guide-footer">
          <strong>꼭 기억해 주세요</strong>
          <p>운영진, Privy, Core 또는 Ava Labs 관계자는 개인키를 묻지 않습니다. 이 안내 페이지에도 개인키를 입력하지 마세요.</p>
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
