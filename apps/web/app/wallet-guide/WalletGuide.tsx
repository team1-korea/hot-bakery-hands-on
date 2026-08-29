'use client';

import {
  useExportWallet,
  useLogin,
  useLogout,
  usePrivy,
} from '@privy-io/react-auth';
import { useMemo, useState, type ReactNode } from 'react';

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

function ScreenshotSlot({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="wallet-screenshot-slot">
      <div className="wallet-screenshot-screen" aria-hidden="true">
        <span>SCREENSHOT</span>
        <i />
        <i />
        <i />
      </div>
      <figcaption>
        <strong>{title}</strong>
        {children}
      </figcaption>
    </figure>
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
      <b>{String(step).padStart(2, '0')}</b>
      <span>{STEP_LABELS[step - 1]}</span>
      <Chevron open={open} />
    </button>
  );
}

export function WalletGuideContent({ state, actions = EMPTY_ACTIONS }: {
  state: GuideState;
  actions?: GuideActions;
}) {
  const [openStep, setOpenStep] = useState(state.authenticated ? 2 : 1);
  const safeAddress = compactAddress(state.walletAddress);

  const open = (step: number) => setOpenStep((current) => current === step ? 0 : step);
  const moveToStep = (step: number) => {
    setOpenStep(step);
    window.setTimeout(() => document.getElementById(`wallet-guide-step-button-${step}`)?.focus(), 0);
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
            <li key={label} data-active={openStep === index + 1}>
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
            <StepButton step={1} open={openStep === 1} onClick={() => open(1)} />
            {openStep === 1 ? (
              <div className="wallet-ticket-body" id="wallet-guide-step-1">
                <h2>행사 때 쓴 Google 계정으로 로그인</h2>
                <p>참가증서를 받을 때 선택한 Google 계정과 같아야 정확한 지갑을 찾을 수 있습니다.</p>
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
            <StepButton step={2} open={openStep === 2} onClick={() => open(2)} />
            <div className="wallet-security-strip">
              <WarningMark />
              <strong>개인키는 누구에게도 보내지 마세요</strong>
            </div>
            {openStep === 2 ? (
              <div className="wallet-ticket-body" id="wallet-guide-step-2">
                <h2>내 Privy 지갑 내보내기</h2>
                <p>아래 버튼을 누르면 Privy의 보안 창이 열립니다. 개인키는 그 창에서 본인만 확인하며, 이 사이트는 내용을 읽거나 저장할 수 없습니다.</p>
                {safeAddress ? (
                  <div className="wallet-address-proof">
                    <span>행사 때 만든 EVM 지갑</span>
                    <code>{safeAddress}</code>
                    <small>Core로 가져온 뒤에도 이 주소가 같아야 합니다.</small>
                  </div>
                ) : null}
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
                <ScreenshotSlot title="Privy 지갑 내보내기 화면">
                  <p>개인키가 표시된 화면은 캡처하지 않습니다. 안내에는 보안 창을 여는 단계까지만 보여 줄 예정입니다.</p>
                </ScreenshotSlot>
              </div>
            ) : null}
          </section>

          <section className="wallet-ticket" data-step="3">
            <StepButton step={3} open={openStep === 3} onClick={() => open(3)} />
            {openStep === 3 ? (
              <div className="wallet-ticket-body" id="wallet-guide-step-3">
                <h2>Core 모바일로 같은 지갑 가져오기</h2>
                <ol className="wallet-guide-instructions">
                  <li>Core 앱 왼쪽 위의 <strong>계정 이름</strong>을 누릅니다.</li>
                  <li>오른쪽 위의 <strong>+</strong> 버튼을 누릅니다.</li>
                  <li><strong>Import a private key</strong>를 선택합니다.</li>
                  <li>본인이 복사한 개인키를 붙여 넣고 <strong>Import</strong>를 누릅니다.</li>
                </ol>
                <a className="wallet-guide-link" href="https://core.app/download" target="_blank" rel="noreferrer">Core 모바일 설치 페이지 열기</a>
                <ScreenshotSlot title="Core 계정 추가 화면">
                  <p>계정 이름, + 버튼, ‘Import a private key’가 함께 보이도록 촬영합니다. 개인키 입력 화면은 찍지 않습니다.</p>
                </ScreenshotSlot>
                <button className="wallet-guide-action" type="button" onClick={() => moveToStep(4)}>가져오기를 마쳤어요</button>
              </div>
            ) : null}
          </section>

          <section className="wallet-ticket" data-step="4">
            <StepButton step={4} open={openStep === 4} onClick={() => open(4)} />
            {openStep === 4 ? (
              <div className="wallet-ticket-body" id="wallet-guide-step-4">
                <h2>Collectibles에서 참가증서 확인</h2>
                <ol className="wallet-guide-instructions">
                  <li>Core 아래 메뉴에서 <strong>Collectibles</strong>를 엽니다.</li>
                  <li><strong>Avalanche Bakery Certificate</strong>를 선택합니다.</li>
                  <li>바로 보이지 않으면 NFT 상세를 위로 밀고 <strong>Refresh</strong>를 누릅니다.</li>
                </ol>
                <div className="wallet-guide-note">
                  <strong>참가증서가 바로 보이지 않나요?</strong>
                  <p>Core 안내에 따르면 메타데이터 새로고침에는 최대 24시간이 걸릴 수 있습니다.</p>
                </div>
                <ScreenshotSlot title="Core Collectibles 화면">
                  <p>참가증서 카드와 NFT 상세의 Refresh 위치를 실제 화면으로 교체합니다.</p>
                </ScreenshotSlot>
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
