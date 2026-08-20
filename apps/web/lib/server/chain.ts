import {
  BaseError,
  ContractFunctionRevertedError,
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
import { avalancheFuji } from 'viem/chains';

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
 * 주소와 배포 블록의 정본은 `contracts/deployments/43113.json`이다.
 * 환경변수는 다른 배포를 가리킬 때만 쓰고, 그때는 아래 조회 시작 블록도 같이 어긋나므로
 * 배포 파일을 함께 갱신해야 한다.
 */
const contractAddress = (process.env.CERTIFICATE_ADDRESS ?? deployment.address) as Address;

/** `findIssuedTokenId`가 로그를 훑기 시작하는 지점. 이보다 앞에는 컨트랙트가 없다. */
const deploymentBlock = BigInt(deployment.deploymentBlock);

/**
 * 영수증 파싱과 로그 조회가 함께 쓰는 이벤트.
 *
 * JSON ABI를 그대로 쓰면 타입이 리터럴이 아니라 `getLogs`가 indexed 인자(`recipient`)로
 * 거를 수 없다. 그래서 이 이벤트 하나만 서명을 다시 적는다. 컨트랙트가 바뀌면 여기도 같이 봐야 한다.
 */
const certificateIssuedEvent = parseAbiItem(
  'event CertificateIssued(uint256 indexed tokenId, address indexed recipient, string tokenURI)',
);

/** RPC를 안 주면 viem이 Fuji 공개 RPC를 쓴다. 읽기 전용 호출은 환경변수 없이도 돈다. */
const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http(process.env.AVALANCHE_RPC_URL),
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
export async function mint(recipient: Address, metadataUri: string): Promise<Hex> {
  const account = requireMinterAccount();
  const { request } = await simulateMint(recipient, metadataUri, account);

  const walletClient = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(process.env.AVALANCHE_RPC_URL),
  });

  return walletClient.writeContract(request as Parameters<typeof walletClient.writeContract>[0]);
}

/**
 * 영수증을 기다려 발급을 확정한다.
 *
 * - **전송 성공만으로 `MINTED`를 쓰면 안 된다.** 영수증 `status`까지 봐야 한다.
 * - **tokenId는 이벤트에서 읽는다.** 컨트랙트에 주소→토큰 역조회가 없고 `nextTokenId()`는
 *   동시 처리 때문에 믿을 수 없다(INTEGRATION_GUIDE.md 3절).
 * - **tokenId는 문자열로 돌려준다.** `uint256`은 `bigint`라 그대로 JSON에 넣을 수 없다.
 */
export async function waitForMint(txHash: Hex): Promise<{ tokenId: string; txHash: Hex }> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
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
 * 주소로 이미 발행된 tokenId를 되찾는다. `AlreadyIssuedError`를 잡았을 때 쓰는 복구 경로다.
 *
 * 컨트랙트가 주소당 일반 발급을 한 번만 허용하므로 결과는 0개 아니면 1개다.
 * 소각·재발급된 증서는 `CertificateReissued`로 나가므로 여기에 잡히지 않는다 — 이 함수가
 * 돌려주는 것은 **최초 발급 tokenId**이고, 그것이 파이프라인이 잃어버린 그 건이다.
 */
export async function findIssuedTokenId(recipient: Address): Promise<string | null> {
  const logs = await publicClient.getLogs({
    address: contractAddress,
    event: certificateIssuedEvent,
    args: { recipient },
    fromBlock: deploymentBlock,
    toBlock: 'latest',
  });

  const tokenId = logs[0]?.args.tokenId;
  return tokenId === undefined ? null : tokenId.toString();
}
