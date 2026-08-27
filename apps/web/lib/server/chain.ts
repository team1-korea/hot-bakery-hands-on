import {
  BaseError,
  ContractFunctionRevertedError,
  NonceTooHighError,
  NonceTooLowError,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  parseEventLogs,
  type Abi,
  type Account,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { avalanche, avalancheFuji } from 'viem/chains';

import certificateAbi from '@contracts/abi/AvalancheBakeryCertificate.json';
import deployment from '@contracts/deployments/43113.json';

/**
 * 증서 컨트랙트 호출. 파이프라인 3·4단계(민팅·영수증)가 보는 유일한 체인 창구다.
 *
 * 호출 규약의 정본은 `contracts/INTEGRATION_GUIDE.md`이고, 여기에는 파이프라인이 실제로
 * 쓰는 것만 꺼내 둔다 — 단건 `mint`와, 이미 발행된 건을 되찾는 이벤트 조회.
 * `batchMint`는 쓰지 않는다(PIPELINE.md「`batchMint`를 쓰지 않는 이유」).
 *
 * **import 시점에는 아무 일도 하지 않는다.** 민터 개인키 없이도 읽기 경로가 돌아야
 * 하기 때문이다. 키는 쓰기 함수가 실제로 불릴 때만 요구한다.
 */

const abi = certificateAbi as Abi;

/**
 * 어느 체인에 쓰는지. 브라우저의 Explorer 링크(`lib/explorer.ts`)와 같은 값을 본다.
 * 하나로 묶어야 링크는 Fuji를 가리키는데 민팅은 메인넷으로 나가는 어긋남이 없다.
 *
 * `Number(...) ||`인 이유는 아래 `MINT_GAS_LIMIT`과 같다. 빈 값이 0으로 새는 것을 막는다.
 */
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || avalancheFuji.id;
const chain = chainId === avalanche.id ? avalanche : avalancheFuji;

/**
 * 주소와 배포 블록의 정본은 Fuji에서는 `contracts/deployments/43113.json`이다.
 * 다른 체인이면 배포 파일이 없으므로 둘 다 환경변수로 받는다. **주소만 바꾸면 안 된다.**
 * 조회 시작 블록이 남으면 `findIssuedMint`가 엉뚱한 구간을 훑어 이미 발행된 건을 놓친다.
 */
function resolveDeployment(): { address: Address; block: bigint } {
  const address = process.env.CERTIFICATE_ADDRESS as Address | undefined;
  const block = Number(process.env.CERTIFICATE_DEPLOYMENT_BLOCK) || 0;

  if (chainId === avalancheFuji.id) {
    return {
      address: address ?? (deployment.address as Address),
      block: BigInt(block || deployment.deploymentBlock),
    };
  }

  // 메인넷에서 Fuji 기본값으로 조용히 넘어가면 진짜 돈을 없는 컨트랙트에 태운다.
  if (!address || !block) {
    throw new Error(
      `체인 ${chainId}에는 CERTIFICATE_ADDRESS와 CERTIFICATE_DEPLOYMENT_BLOCK을 함께 설정해야 합니다.`,
    );
  }
  return { address, block: BigInt(block) };
}

const { address: contractAddress, block: deploymentBlock } = resolveDeployment();

/**
 * 영수증 파싱과 로그 조회가 함께 쓰는 이벤트.
 *
 * JSON ABI를 그대로 쓰면 타입이 리터럴이 아니라 `getLogs`가 indexed 인자(`recipient`)로
 * 거를 수 없다. 그래서 이 이벤트 하나만 서명을 다시 적는다. 컨트랙트가 바뀌면 여기도 같이 봐야 한다.
 */
const certificateIssuedEvent = parseAbiItem(
  'event CertificateIssued(uint256 indexed tokenId, address indexed recipient, string tokenURI)',
);

/** RPC를 안 주면 viem이 그 체인의 공개 RPC를 쓴다. 읽기 전용 호출은 환경변수 없이도 돈다. */
const publicClient = createPublicClient({
  chain,
  transport: http(process.env.AVALANCHE_RPC_URL),
});

/** 관리자 명단이 잔액 RPC 장애를 기다리지 않도록 잔액 조회만 짧게 끊는다. */
const BALANCE_RPC_TIMEOUT_MS = 750;
const balanceClient = createPublicClient({
  chain,
  transport: http(process.env.AVALANCHE_RPC_URL, {
    retryCount: 0,
    timeout: BALANCE_RPC_TIMEOUT_MS,
  }),
});

/**
 * `mint`가 `AlreadyIssued`로 리버트한 상태.
 *
 * **실패가 아니다.** 트랜잭션은 이미 성공했고 그 뒤의 DB 갱신만 유실된 것이다. 이걸 `FAILED`로
 * 내리면 이미 체인에 박힌 참가자의 증서를 잃어버린다. 잡으면 `findIssuedTokenId()`로 tokenId를
 * 건져 `MINTED`로 마무리한다(PIPELINE.md「이미 발행된 건의 복구」).
 */
export class AlreadyIssuedError extends Error {
  readonly recipient: Address;

  constructor(recipient: Address) {
    super(`이미 증서가 발행된 주소입니다: ${recipient}`);
    this.name = 'AlreadyIssuedError';
    this.recipient = recipient;
  }
}

/** 리버트 사유가 `AlreadyIssued`일 때만 골라낸다. 나머지 리버트는 그대로 올려보내 `FAILED`로 떨어뜨린다. */
function toAlreadyIssuedError(error: unknown, recipient: Address): AlreadyIssuedError | null {
  if (!(error instanceof BaseError)) return null;

  const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
  if (!(reverted instanceof ContractFunctionRevertedError)) return null;
  if (reverted.data?.errorName !== 'AlreadyIssued') return null;

  return new AlreadyIssuedError(recipient);
}

/** 개인키는 쓰기 경로에서만 필요하다. 모듈을 만들 때가 아니라 여기서 확인한다. */
function requireMinterAccount(): PrivateKeyAccount {
  const key = process.env.MINTER_PRIVATE_KEY;
  if (!key) throw new Error('MINTER_PRIVATE_KEY가 없습니다. 민팅은 서버 민터 지갑으로만 합니다.');
  return privateKeyToAccount(key as Hex);
}

/**
 * 민터 지갑의 잔액. 운영자 화면이 가스가 마르기 전에 알아채라고 있는 값이다.
 *
 * 운영자 명단은 1초마다 폴링하므로 그대로 부르면 매초 RPC를 두드린다. 30초만 캐시한다 —
 * 잔액은 민팅 한 번에 아주 조금씩만 줄어서 이 정도 지연은 판단을 바꾸지 않는다.
 * 키가 없거나 RPC가 죽으면 null이다. 명단 자체는 계속 떠야 하므로 던지지 않는다.
 */
let balanceCache: { at: number; value: MinterBalance } | null = null;
let balanceRequest: Promise<MinterBalance> | null = null;
const BALANCE_TTL_MS = 30_000;

export type MinterBalance = { address: Address; wei: string } | null;

export async function minterBalance(): Promise<MinterBalance> {
  if (balanceCache && Date.now() - balanceCache.at < BALANCE_TTL_MS) return balanceCache.value;
  if (balanceRequest) return balanceRequest;

  balanceRequest = (async () => {
    let value: MinterBalance = null;
    try {
      const { address } = requireMinterAccount();
      value = { address, wei: (await balanceClient.getBalance({ address })).toString() };
    } catch {
      value = null;
    }
    balanceCache = { at: Date.now(), value };
    return value;
  })().finally(() => {
    balanceRequest = null;
  });

  return balanceRequest;
}

/**
 * 과거에 일반 발급된 적이 있는지.
 *
 * **현재 보유 여부가 아니다.** 소각한 뒤에도 계속 `true`다(INTEGRATION_GUIDE.md 3절).
 * 민팅 전 사전 확인용이고, 이 값이 `true`면 `mint`는 반드시 리버트한다.
 */
export async function hasBeenIssued(recipient: Address): Promise<boolean> {
  return (await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: 'hasBeenIssued',
    args: [recipient],
  })) as boolean;
}

/**
 * 보내기 전에 리버트를 먼저 확인한다. 가스도 서명도 쓰지 않는다.
 *
 * `sender`를 따로 받는 이유: 시뮬레이션에는 서명이 필요 없고 **주소만** 있으면 된다.
 * 개인키 없는 환경에서 민터 계정 기준으로 확인해 볼 수 있게 열어 둔다. 기본값은 서버 민터다.
 */
export async function simulateMint(
  recipient: Address,
  metadataUri: string,
  sender: Account | Address = requireMinterAccount(),
) {
  try {
    return await publicClient.simulateContract({
      account: sender,
      address: contractAddress,
      abi,
      functionName: 'mint',
      args: [recipient, metadataUri],
    });
  } catch (error) {
    throw toAlreadyIssuedError(error, recipient) ?? error;
  }
}

/**
 * 시뮬레이션에 성공한 요청만 전송한다. 돌려주는 것은 **트랜잭션 해시뿐**이다 —
 * tokenId는 영수증이 확정돼야 알 수 있으므로 `waitForMint()`에서 읽는다.
 *
 * Wallet Client를 호출 때마다 만드는 것은 모듈 평가 시점에 개인키를 요구하지 않기 위해서다.
 */
/**
 * 가스 한도를 직접 준다. **자동 추정에 맡기지 않는다.**
 *
 * Fuji 공개 RPC의 추정기가 이따금 `exceeds block gas limit`을 돌려준다. 컨트랙트 문제가
 * 아니라 RPC 버그이고(contracts/FUJI_SMOKE_TEST.md에 같은 증상이 기록돼 있다), 시뮬레이션은
 * 통과한 뒤 전송에서만 터지기 때문에 미리 걸러낼 수도 없다.
 *
 * 실측: 한 건에 150,000 가스. 기본값은 그 두 배다.
 *
 * **무작정 크게 잡으면 안 된다.** 남는 가스는 돌려받지만, 전송하려면 `한도 x 가스가`만큼
 * 잔액이 있어야 한다. 실제로 쓸 금액이 아니라 한도로 계산한다. 한도를 1000만으로 두면
 * 25 gwei에서 0.25 AVAX가 잠기고, 지갑에 0.2 AVAX뿐이면 **잔액 부족으로 전송 자체가
 * 안 된다.** 값을 올릴 때는 민터 잔액도 같이 올려야 한다.
 *
 * 네트워크를 바꿔도 이 값은 그대로 쓸 수 있다. 가스 **사용량**은 같은 바이트코드면 같고,
 * 바뀌는 것은 가스 **가격**이다. 다만 메인넷은 진짜 돈이고 기본 수수료가 튀므로,
 * 코드 수정 없이 조절할 수 있게 환경변수로 뺀다.
 *
 * `??`가 아니라 `Number(...) || `인 이유: `.env`에 `MINT_GAS_LIMIT=`처럼 빈 값이 있으면
 * `??`는 그것을 통과시키고 `BigInt('')`가 **0**이 된다. 가스 한도 0으로 전송하면 RPC가
 * 'Missing or invalid parameters'로 거절하는데, 원인이 전혀 드러나지 않는다.
 */
const MINT_GAS_LIMIT = BigInt(Number(process.env.MINT_GAS_LIMIT) || 300_000);

/**
 * nonce가 어긋났을 때 다시 보내는 횟수.
 *
 * nonce는 이 지갑이 지금까지 보낸 트랜잭션 수이고, 다음 건은 반드시 그 다음 번호여야 한다.
 * 번호는 우리가 세지 않고 보낼 때마다 RPC에 묻는데, 공개 엔드포인트는 노드가 여러 대이고
 * 노드마다 mempool이 달라서 **방금 나간 트랜잭션을 못 본 노드가 뒤처진 번호를 준다.**
 * 실측에서 같은 주소의 pending nonce가 `23 → 24 → 23`으로 되돌아갔고, 그대로 보내면
 * 이미 쓴 번호라 거절당한다. 20명 규모에서 민팅의 30%가 이 이유로 실패했다.
 *
 * **쉬지 않고 곧바로 다시 보낸다.** 요청마다 다른 노드가 받으므로 즉시 다시 물어도 사실상
 * 새로 뽑는 것과 같다(위 `23 → 24 → 23`이 그 증거다). 여기서 기다리면 민팅 락을 쥔 채로
 * 기다리는 셈이라 뒤에 선 참가자가 전부 밀리고, 그쪽이 `maxDuration = 60`에 훨씬 위험하다.
 *
 * 재시도가 안전한 이유는 두 가지다. 거절당했다는 것은 트랜잭션이 **받아들여지지 않았다는**
 * 뜻이라 중복 전송이 아니고, 설령 중복으로 나가도 컨트랙트가 주소당 한 장만 허용해
 * `AlreadyIssued`로 되돌아온다 — 그 복구 경로는 이미 아래에 있다.
 */
const MINT_SEND_ATTEMPTS = 3;

/** 보내려던 번호가 어긋났을 뿐 트랜잭션은 나가지 않은 상태. 다시 보내면 된다. */
function isStaleNonce(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  return Boolean(error.walk((cause) => (
    cause instanceof NonceTooLowError || cause instanceof NonceTooHighError
  )));
}

export async function mint(recipient: Address, metadataUri: string): Promise<Hex> {
  const account = requireMinterAccount();
  // 시뮬레이션은 한 번만 한다. 인자가 그대로라 결과도 같고, 락을 쥔 시간만 늘어난다.
  const { request } = await simulateMint(recipient, metadataUri, account);

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(process.env.AVALANCHE_RPC_URL),
  });

  for (let attempt = 1; ; attempt += 1) {
    try {
      // nonce를 넘기지 않으므로 viem이 매번 새로 조회한다. 그래서 재시도에 의미가 있다.
      return await walletClient.writeContract({
        ...request,
        gas: MINT_GAS_LIMIT,
      } as Parameters<typeof walletClient.writeContract>[0]);
    } catch (error) {
      if (attempt >= MINT_SEND_ATTEMPTS || !isStaleNonce(error)) throw error;
    }
  }
}

/**
 * 영수증을 기다려 발급을 확정한다.
 *
 * - **전송 성공만으로 `MINTED`를 쓰면 안 된다.** 영수증 `status`까지 봐야 한다.
 * - **tokenId는 이벤트에서 읽는다.** 컨트랙트에 주소→토큰 역조회가 없고 `nextTokenId()`는
 *   동시 처리 때문에 믿을 수 없다(INTEGRATION_GUIDE.md 3절).
 * - **tokenId는 문자열로 돌려준다.** `uint256`은 `bigint`라 그대로 JSON에 넣을 수 없다.
 */
/**
 * 영수증을 기다리는 상한. **viem 기본값은 180초로, 라우트 수명(`maxDuration = 60`)의 3배다.**
 *
 * 그래서 영수증이 오지 않는 트랜잭션을 만나면 viem이 스스로 포기하는 일은 없고 **항상 Vercel이
 * 먼저 인보케이션을 죽인다.** 죽으면 행이 `MINTING`으로 남는데, 그 상태는 운영자 화면에서
 * 정상적으로 굽는 카드와 구별되지 않는다 — 「실패」 카운터에도 안 잡히고 재시도 버튼도 안 뜬다.
 * 스위퍼로 풀 수는 있지만 90초를 더 기다려야 하고 운영자가 그럴 이유를 알아채기 어렵다.
 *
 * 정상 민팅은 몇 초면 영수증이 나온다(C-Chain 블록 약 2초). 이보다 오래 걸리는 건 nonce 경합에서
 * 밀려나 사라진 트랜잭션이므로, 먼저 포기해 `FAILED`로 내리는 편이 낫다 — **실패는 화면에 뜨고
 * 버튼이 생기지만 멈춤은 그렇지 않다.**
 */
const MINT_RECEIPT_TIMEOUT_MS = 20_000;

export async function waitForMint(txHash: Hex): Promise<{ tokenId: string; txHash: Hex }> {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: MINT_RECEIPT_TIMEOUT_MS,
  });
  if (receipt.status !== 'success') {
    throw new Error(`민팅 트랜잭션이 실패했습니다: ${txHash}`);
  }

  const [issued] = parseEventLogs({ abi: [certificateIssuedEvent], logs: receipt.logs });
  if (!issued) {
    throw new Error(`CertificateIssued 이벤트를 찾지 못했습니다: ${txHash}`);
  }

  return { tokenId: issued.args.tokenId.toString(), txHash };
}

/**
 * 그 해시가 체인에도 mempool에도 없는지.
 *
 * nonce 경합에서 밀려난 트랜잭션은 해시만 남기고 사라진다. 영수증도 없고 앞으로도 안 생기는데,
 * DB에 해시가 남아 있으면 `retryEntry`가 상태를 `MINTING`으로 되돌리고 `mintEntry`는
 * `txHash`가 있다는 이유로 새로 보내지 않고 그 죽은 해시를 계속 기다린다. 운영자가 「재시도」를
 * 몇 번 눌러도 같은 자리를 돈다 — 실측에서 60명 중 3명이 이렇게 갇혔다.
 *
 * **찾지 못한 것과 조회에 실패한 것을 구분한다.** RPC가 잠시 죽은 것을 "사라졌다"로 읽으면
 * 아직 살아 있는 트랜잭션의 해시를 버려 같은 발급을 두 번 보내게 된다.
 */
export async function transactionDisappeared(txHash: Hex): Promise<boolean> {
  try {
    await publicClient.getTransaction({ hash: txHash });
    return false;
  } catch (error) {
    if (error instanceof TransactionNotFoundError) return true;
    throw error;
  }
}

export type MintReceipt =
  | { status: 'success'; tokenId: string; txHash: Hex }
  | { status: 'reverted'; txHash: Hex };

/**
 * 스위퍼가 오래된 MINTING을 복구할 때 쓰는 즉시 조회다.
 * `waitForTransactionReceipt`처럼 폴링하지 않아 cron 인보케이션이 하나의 pending
 * 트랜잭션에 매달리지 않는다. 영수증이 아직 없으면 null이다.
 */
export async function readMintReceipt(txHash: Hex): Promise<MintReceipt | null> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') return { status: 'reverted', txHash };

    const [issued] = parseEventLogs({ abi: [certificateIssuedEvent], logs: receipt.logs });
    if (!issued) throw new Error(`CertificateIssued 이벤트를 찾지 못했습니다: ${txHash}`);
    return { status: 'success', tokenId: issued.args.tokenId.toString(), txHash };
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return null;
    throw error;
  }
}

/**
 * 주소로 이미 발행된 tokenId를 되찾는다. `AlreadyIssuedError`를 잡았을 때 쓰는 복구 경로다.
 *
 * 컨트랙트가 주소당 일반 발급을 한 번만 허용하므로 결과는 0개 아니면 1개다.
 * 소각·재발급된 증서는 `CertificateReissued`로 나가므로 여기에 잡히지 않는다 — 이 함수가
 * 돌려주는 것은 **최초 발급 tokenId**이고, 그것이 파이프라인이 잃어버린 그 건이다.
 */
export async function findIssuedTokenId(recipient: Address): Promise<string | null> {
  return (await findIssuedMint(recipient))?.tokenId ?? null;
}

/** DB 갱신을 잃은 발급의 tokenId와 txHash를 이벤트에서 같이 되찾는다. */
export async function findIssuedMint(
  recipient: Address,
): Promise<{ tokenId: string; txHash: Hex } | null> {
  const logs = await publicClient.getLogs({
    address: contractAddress,
    event: certificateIssuedEvent,
    args: { recipient },
    fromBlock: deploymentBlock,
    toBlock: 'latest',
  });

  const issued = logs[0];
  const tokenId = issued?.args.tokenId;
  if (tokenId === undefined || !issued.transactionHash) return null;
  return { tokenId: tokenId.toString(), txHash: issued.transactionHash };
}
