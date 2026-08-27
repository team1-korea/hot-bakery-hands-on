# Avalanche Bakery Certificate 연동 가이드

Next.js 프론트엔드와 백엔드에서 `AvalancheBakeryCertificate`를 조회하고 호출하기 위한 문서입니다.

## 1. 연동에 필요한 값

| 항목 | 용도 | 공개 가능 여부 |
|---|---|---|
| 컨트랙트 ABI | 함수와 이벤트 인코딩·디코딩 | 공개 가능 |
| 배포된 컨트랙트 주소 | 호출 대상 식별 | 공개 가능 |
| Chain ID | Fuji/Mainnet 구분 | 공개 가능 |
| RPC URL | 블록체인 읽기 및 트랜잭션 전송 | 브라우저용 키만 공개 |
| 민터 개인키 | `mint`, `batchMint` 서명 | 서버에서만 사용 |
| 관리자 지갑 | `adminBurn`, `reissue`, 역할 관리 | 지갑에서 직접 서명 |

네트워크 정보:

| 네트워크 | Chain ID | 용도 |
|---|---:|---|
| Avalanche Fuji | `43113` | 테스트 |
| Avalanche C-Chain Mainnet | `43114` | 실제 운영 |

ABI는 컨트랙트 빌드 후 다음 명령으로 추출할 수 있습니다.

```bash
./scripts/export-abi.sh
```

저장소에 커밋된 정식 ABI는 `abi/AvalancheBakeryCertificate.json`, Fuji 배포 정보는
`deployments/43113.json`입니다. 프론트엔드와 백엔드는 이 파일을 공통 원본으로 사용합니다. 컨트랙트가
변경되면 컨트랙트 담당자가 ABI를 다시 생성해 같은 pull request에 포함합니다.

`apps/web/tsconfig.json`에서 다음 alias를 추가하면 Next.js 코드가 공용 ABI를 직접 import할 수 있습니다.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@contracts/*": ["../../contracts/*"]
    }
  }
}
```

현재 앱은 브라우저에서 컨트랙트를 직접 호출하지 않습니다. 브라우저는 Explorer와 교육 화면에
`NEXT_PUBLIC_CHAIN_ID`만 사용하고, 컨트랙트 읽기·민팅·이벤트 복구는 서버의 `chain.ts`가 담당합니다.
서버 민터 개인키를 프론트엔드 저장소나 `NEXT_PUBLIC_*` 환경변수에 넣으면 안 됩니다.

```dotenv
# 브라우저에서 읽을 수 있는 값
NEXT_PUBLIC_CHAIN_ID=43113 # 43113=Fuji(기본), 43114=메인넷

# 서버 전용 값
CERTIFICATE_ADDRESS=              # 메인넷은 필수. Fuji에서는 설정돼 있어도 무시
CERTIFICATE_DEPLOYMENT_BLOCK=     # 메인넷은 필수. Fuji에서는 설정돼 있어도 무시
AVALANCHE_RPC_URL=                # 비우면 선택한 체인의 공개 RPC
MINTER_PRIVATE_KEY=0x...
```

메인넷 주소와 배포 블록은 Fuji 리허설 중에 미리 저장해도 됩니다. Fuji 서버는 커밋된
`deployments/43113.json`만 사용하고 두 값을 무시합니다. 메인넷 배포 직후 `apps/web`의
`chain:prepare-mainnet`으로 두 값을 사전 등록하고, 행사 전환 때 `chain:switch`로 체인 ID 하나만
바꾼 뒤 최신 `main`을 재배포합니다. 이번 행사에서는 `AVALANCHE_RPC_URL`을 비워 Avalanche 공개
RPC를 사용합니다.

## 2. 누가 어떤 함수를 호출하는가

| 호출 주체 | 주요 함수 | 사용 시점 |
|---|---|---|
| 누구나 | 모든 읽기 함수 | 증서 상태와 Metadata 표시 |
| 서버 민터 지갑 | `mint`, `batchMint` | 참가자 증서 최초 발급 |
| 관리자 지갑 | `adminBurn`, `reissue` | 오발급 취소와 지갑 복구 |
| 관리자 지갑 | `grantRole`, `revokeRole` | 운영 지갑 교체 |

`mint`와 `batchMint`를 관리자 브라우저에서 호출할 필요는 없습니다. 서버 민터가 백엔드에서 자동 호출하는
구조가 기본입니다. `adminBurn`과 `reissue`는 관리자 화면에서 관리자 지갑 서명을 받아 호출하면 됩니다.

## 3. 읽기 함수

읽기 함수는 지갑 연결과 가스비 없이 RPC만으로 호출할 수 있습니다.

### 프론트에서 주로 사용할 함수

| 함수 | 반환값 | 언제 사용하는가 |
|---|---|---|
| `name()` | `string` | 컬렉션 이름 표시 |
| `symbol()` | `string` | 심볼 표시 |
| `balanceOf(address)` | `uint256` | 해당 주소의 현재 증서 보유 여부 확인 |
| `ownerOf(tokenId)` | `address` | 특정 Token ID의 현재 소유자 확인 |
| `tokenURI(tokenId)` | `string` | 이미지·속성 Metadata 주소 조회 |
| `locked(tokenId)` | `bool` | EIP-5192 잠금 상태 확인. 존재하는 토큰은 항상 `true` |
| `hasBeenIssued(address)` | `bool` | 해당 주소가 과거에 일반 발급된 적 있는지 확인 |
| `reissueAvailable(tokenId)` | `bool` | 소각된 Token ID로 재발급 가능한지 확인 |
| `nextTokenId()` | `uint256` | 다음 정상 발급에 사용할 예정인 ID 확인 |
| `MAX_BATCH_SIZE()` | `uint256` | 최대 배치 크기 확인. 현재 `50` |
| `hasRole(role, address)` | `bool` | 특정 운영 지갑의 권한 확인 |

표준 호환 또는 운영 점검에 사용하는 나머지 읽기 함수:

| 함수 | 용도 |
|---|---|
| `DEFAULT_ADMIN_ROLE()` | 역할 관리 권한 값 조회 |
| `MINTER_ROLE()` | 민팅 권한 값 조회 |
| `RECOVERY_ROLE()` | 소각·재발급 권한 값 조회 |
| `getRoleAdmin(role)` | 해당 역할을 부여·회수할 수 있는 관리자 역할 조회 |
| `getApproved(tokenId)` | ERC-721 호환 조회. 승인이 차단되어 정상 상태에서는 0 주소 |
| `isApprovedForAll(owner, operator)` | ERC-721 호환 조회. 승인이 차단되어 정상 상태에서는 `false` |
| `supportsInterface(interfaceId)` | ERC-721, Metadata, AccessControl, EIP-5192 지원 여부 확인 |

### 읽기에서 주의할 점

- `hasBeenIssued(address)`는 **현재 보유 여부가 아닙니다.** 소각 후에도 계속 `true`입니다. 현재 보유 여부는
  `balanceOf(address) > 0`으로 확인합니다.
- `ownerOf`, `tokenURI`, `locked`는 존재하지 않거나 소각된 Token ID에 호출하면 실패합니다.
- `nextTokenId()`는 화면 참고용입니다. 여러 트랜잭션이 동시에 처리될 수 있으므로 실제 발급 ID는 확정된
  트랜잭션의 이벤트에서 가져옵니다.
- 이 컨트랙트에는 `totalSupply`, `tokenOfOwnerByIndex`, `tokensOfOwner`가 없습니다. 주소만으로 Token ID를
  직접 역조회할 수 없으므로 발급 이벤트를 백엔드 DB에 저장하거나 이벤트 로그를 조회해야 합니다.
- JavaScript에서 `uint256`은 `bigint`로 반환됩니다. JSON 응답에 넣을 때는 `tokenId.toString()`으로
  변환합니다.

### 서버 읽기 예시

```ts
import { createPublicClient, http, type Address } from 'viem'
import { avalanche, avalancheFuji } from 'viem/chains'
import certificateAbi from '@contracts/abi/AvalancheBakeryCertificate.json'
import fujiDeployment from '@contracts/deployments/43113.json'

const chain = process.env.NEXT_PUBLIC_CHAIN_ID === '43114'
  ? avalanche
  : avalancheFuji
const contractAddress = (
  process.env.CERTIFICATE_ADDRESS
  ?? (chain.id === avalancheFuji.id ? fujiDeployment.address : undefined)
) as Address | undefined

if (!contractAddress) {
  throw new Error('메인넷에서는 CERTIFICATE_ADDRESS가 필요합니다.')
}

export const publicClient = createPublicClient({
  chain,
  transport: http(process.env.AVALANCHE_RPC_URL),
})

export async function getCertificateStatus(
  walletAddress: Address,
  tokenId?: bigint,
) {
  const [balance, issued] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: certificateAbi,
      functionName: 'balanceOf',
      args: [walletAddress],
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: certificateAbi,
      functionName: 'hasBeenIssued',
      args: [walletAddress],
    }),
  ])

  if (tokenId === undefined) {
    return { balance, issued }
  }

  const [owner, metadataURI, isLocked] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: certificateAbi,
      functionName: 'ownerOf',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: certificateAbi,
      functionName: 'tokenURI',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: certificateAbi,
      functionName: 'locked',
      args: [tokenId],
    }),
  ])

  return { balance, issued, owner, metadataURI, isLocked }
}
```

## 4. 쓰기 함수

쓰기 함수는 권한이 있는 지갑의 서명과 AVAX 가스비가 필요합니다. 전송 전에 `simulateContract`로 실패
가능성을 검사하고, 전송 후 트랜잭션 영수증의 `status`가 `success`인지 확인하는 방식을 권장합니다.
`writeContract`의 반환값은 컨트랙트 함수의 반환값이 아니라 트랜잭션 해시입니다. 확정 Token ID는 성공
영수증의 이벤트에서 읽습니다.

### `mint(recipient, metadataURI)`

참가자 한 명에게 최초 증서를 발급할 때 사용합니다.

```solidity
mint(address recipient, string metadataURI) returns (uint256 tokenId)
```

- 호출자: `MINTER_ROLE`을 가진 서버 지갑
- 사용 시점: 참가자 한 명의 Metadata 준비가 끝난 직후
- `recipient`: 참가자 지갑 주소
- `metadataURI`: 완성된 Metadata JSON 주소. 빈 문자열 불가
- 성공 이벤트: `Locked`, `CertificateIssued`

호출 전 확인:

1. `recipient`가 0 주소가 아닌지 확인합니다.
2. `metadataURI`가 비어 있지 않은지 확인합니다.
3. `hasBeenIssued(recipient) == false`인지 확인합니다.
4. 컨트랙트 지갑이라면 `onERC721Received` 지원 여부를 확인합니다. 최종 확인은 민팅 시뮬레이션 결과를
   기준으로 합니다.

한 번 일반 발급된 주소는 소각 후에도 `mint`를 다시 호출할 수 없습니다. 복구에는 `reissue`를 사용합니다.

### `batchMint(recipients, metadataUris)`

여러 참가자에게 한 트랜잭션으로 최초 증서를 발급할 때 사용합니다.

```solidity
batchMint(
  address[] recipients,
  string[] metadataUris
) returns (uint256[] tokenIds)
```

- 호출자: `MINTER_ROLE`을 가진 서버 지갑
- 사용 시점: 여러 참가자의 Metadata가 모두 준비된 경우
- 최대 크기: 50명
- 성공 이벤트: 참가자마다 `Locked`, `CertificateIssued`

호출 전 확인:

1. 두 배열 길이가 같은지 확인합니다.
2. 배열 길이가 `1~50`인지 확인합니다.
3. 배치 내부에 중복 주소가 없는지 확인합니다.
4. 모든 주소의 `hasBeenIssued`가 `false`인지 확인합니다.
5. 모든 Metadata URI가 비어 있지 않은지 확인합니다.
6. 컨트랙트 지갑의 ERC-721 수신 가능 여부를 확인합니다. 최종 확인은 배치 전체 시뮬레이션 결과를
   기준으로 합니다.

배치는 원자적입니다. 한 항목이라도 잘못되면 앞에서 처리된 항목까지 **전체 발급이 취소**됩니다.

### `adminBurn(tokenId)`

오발급 또는 지갑 복구 요청이 들어왔을 때 기존 증서를 소각합니다.

```solidity
adminBurn(uint256 tokenId)
```

- 호출자: `RECOVERY_ROLE`을 가진 관리자 지갑
- 사용 시점: 오발급 취소 또는 `reissue` 전 단계
- 성공 이벤트: `CertificateRevoked`

성공 후 상태:

- 기존 Token ID의 `ownerOf`, `tokenURI`, `locked` 조회는 실패합니다.
- `reissueAvailable(tokenId)`가 `true`가 됩니다.
- 기존 수령자의 `hasBeenIssued`는 계속 `true`입니다.

### `reissue(burnedTokenId, recipient, metadataURI)`

소각된 증서를 같은 지갑 또는 새 지갑으로 복구 발급할 때 사용합니다.

```solidity
reissue(
  uint256 burnedTokenId,
  address recipient,
  string metadataURI
) returns (uint256 newTokenId)
```

- 호출자: `RECOVERY_ROLE`을 가진 관리자 지갑
- 사용 시점: `adminBurn` 트랜잭션이 성공한 이후
- 성공 이벤트: `Locked`, `CertificateReissued`

호출 전 확인:

1. `reissueAvailable(burnedTokenId) == true`인지 확인합니다.
2. 새 수령 주소가 0 주소가 아닌지 확인합니다.
3. `balanceOf(recipient) == 0`인지 확인합니다.
4. Metadata URI가 비어 있지 않은지 확인합니다.

`hasBeenIssued(recipient)`가 이미 `true`여도 재발급할 수 있습니다. 기존 Token ID는 재사용하지 않으며 항상
새로운 Token ID가 생성됩니다. 하나의 소각 Token ID는 한 번만 재발급에 사용할 수 있습니다.

## 5. 권장 호출 흐름

### 일반 단건 발급

```text
Metadata JSON 준비
→ hasBeenIssued(recipient) 확인
→ mint(recipient, metadataURI) 시뮬레이션
→ 트랜잭션 전송 및 영수증 성공 확인
→ CertificateIssued 이벤트에서 tokenId 저장
```

### 배치 발급

```text
최대 50명 구성
→ 배열 길이·중복·발급 이력·빈 URI·컨트랙트 지갑 검사
→ batchMint(recipients, metadataUris) 시뮬레이션
→ 트랜잭션 전송 및 영수증 성공 확인
→ 모든 CertificateIssued 이벤트를 DB에 저장
```

### 오발급 취소 및 지갑 복구

```text
기존 tokenId와 owner 확인
→ 관리자 지갑으로 adminBurn(oldTokenId)
→ 영수증 성공 및 reissueAvailable(oldTokenId) 확인
→ 새 수령 주소의 balanceOf가 0인지 확인
→ 관리자 지갑으로 reissue(oldTokenId, newRecipient, newMetadataURI)
→ CertificateReissued 이벤트에서 newTokenId 저장
```

`adminBurn`과 `reissue`는 반드시 두 개의 별도 트랜잭션으로 처리합니다.

## 6. Viem 쓰기 예시

백엔드에서 민터 개인키로 호출하는 예시입니다.

```ts
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { avalanche, avalancheFuji } from 'viem/chains'
import certificateAbi from '@contracts/abi/AvalancheBakeryCertificate.json'
import fujiDeployment from '@contracts/deployments/43113.json'

const chain = process.env.NEXT_PUBLIC_CHAIN_ID === '43114'
  ? avalanche
  : avalancheFuji
const address = (
  process.env.CERTIFICATE_ADDRESS
  ?? (chain.id === avalancheFuji.id ? fujiDeployment.address : undefined)
) as Address | undefined

if (!address) {
  throw new Error('메인넷에서는 CERTIFICATE_ADDRESS가 필요합니다.')
}

const account = privateKeyToAccount(process.env.MINTER_PRIVATE_KEY as Hex)

const publicClient = createPublicClient({
  chain,
  transport: http(process.env.AVALANCHE_RPC_URL),
})

const walletClient = createWalletClient({
  account,
  chain,
  transport: http(process.env.AVALANCHE_RPC_URL),
})

export async function mintCertificate(
  recipient: Address,
  metadataURI: string,
) {
  const { request } = await publicClient.simulateContract({
    account,
    address,
    abi: certificateAbi,
    functionName: 'mint',
    args: [recipient, metadataURI],
  })

  const hash = await walletClient.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  if (receipt.status !== 'success') {
    throw new Error(`mint failed: ${hash}`)
  }

  const [issued] = parseEventLogs({
    abi: certificateAbi,
    eventName: 'CertificateIssued',
    logs: receipt.logs,
  })

  return {
    hash,
    // uint256은 bigint로 온다. JSON에 그대로 넣으면 직렬화에서 터진다.
    tokenId: issued.args.tokenId.toString(),
    recipient: issued.args.recipient,
    tokenURI: issued.args.tokenURI,
  }
}
```

> ⚠️ **`tokenId`는 반드시 `.toString()`으로 내보내세요.** 이 예제를 복사해 쓰는 자리가
> 곧 JSON 응답이라, bigint를 그대로 반환하면 `JSON.stringify`가 던집니다.
> 아래 체크리스트에도 같은 항목이 있습니다.

> **JSON ABI를 그대로 쓰면 타입이 붙지 않습니다.** `import ... from '*.json'`은 `as const`가
> 아니라서 `issued.args.tokenId`가 bigint로 좁혀지지 않고, `getLogs`의 indexed 인자 필터도
> 걸리지 않습니다. 이벤트 하나만 필요하다면 `parseAbiItem`으로 시그니처를 직접 쓰는 편이
> 간단합니다.
>
> ```ts
> const certificateIssued = parseAbiItem(
>   'event CertificateIssued(uint256 indexed tokenId, address indexed recipient, string tokenURI)',
> )
> ```

배치 민팅은 같은 패턴에서 함수명과 인자만 변경합니다.

```ts
const { request } = await publicClient.simulateContract({
  account,
  address,
  abi: certificateAbi,
  functionName: 'batchMint',
  args: [recipients, metadataUris],
})

const hash = await walletClient.writeContract(request)
const receipt = await publicClient.waitForTransactionReceipt({ hash })

const issuedEvents = parseEventLogs({
  abi: certificateAbi,
  eventName: 'CertificateIssued',
  logs: receipt.logs,
})
```

관리자 화면의 `adminBurn`과 `reissue`도 동일한 `simulateContract → writeContract → 영수증 확인` 순서를
사용하되, 서버 민터가 아니라 연결된 관리자 지갑의 Wallet Client로 서명해야 합니다.

```ts
// adminWalletClient는 연결된 관리자 지갑으로 만든 Wallet Client입니다.
const { request: burnRequest } = await publicClient.simulateContract({
  account: adminAddress,
  address,
  abi: certificateAbi,
  functionName: 'adminBurn',
  args: [tokenId],
})
const burnHash = await adminWalletClient.writeContract(burnRequest)
await publicClient.waitForTransactionReceipt({ hash: burnHash })

const { request: reissueRequest } = await publicClient.simulateContract({
  account: adminAddress,
  address,
  abi: certificateAbi,
  functionName: 'reissue',
  args: [burnedTokenId, newRecipient, metadataURI],
})
const reissueHash = await adminWalletClient.writeContract(reissueRequest)
await publicClient.waitForTransactionReceipt({ hash: reissueHash })
```

## 7. 이벤트

프론트 화면 갱신과 백엔드 DB 저장은 트랜잭션 반환값보다 확정된 이벤트를 기준으로 처리합니다.

| 이벤트 | 발생 시점 | 저장할 값 |
|---|---|---|
| `CertificateIssued` | `mint`, `batchMint` 성공 | `tokenId`, `recipient`, `tokenURI` |
| `CertificateRevoked` | `adminBurn` 성공 | `tokenId`, 기존 `holder` |
| `CertificateReissued` | `reissue` 성공 | `burnedTokenId`, `newTokenId`, `recipient`, `tokenURI` |
| `Locked` | 최초 발급 및 재발급 | 잠긴 Token ID |
| `Transfer` | 발급과 소각 | ERC-721 호환 인덱싱 |

트랜잭션이 제출됐다는 사실만으로 UI를 성공 상태로 바꾸지 않습니다. 영수증 성공을 확인하고 이벤트를
파싱한 후 DB와 화면 상태를 갱신합니다.

## 8. 주요 오류 처리

| 오류 | 의미 | 사용자 메시지 예시 |
|---|---|---|
| `InvalidRecipient` | 수령 주소가 0 주소 | 올바른 지갑 주소를 입력해 주세요. |
| `EmptyTokenURI` | Metadata URI가 비어 있음 | Metadata 준비 후 다시 시도해 주세요. |
| `AlreadyIssued(address)` | 일반 발급 이력이 이미 존재 | 이미 발급된 참가자입니다. 복구는 재발급을 사용하세요. |
| `BatchLengthMismatch` | 두 배치 배열 길이가 다름 | 수령자와 Metadata 개수를 확인해 주세요. |
| `EmptyBatch` | 빈 배치 | 한 명 이상 선택해 주세요. |
| `BatchTooLarge` | 50명 초과 | 배치를 50명 이하로 나눠 주세요. |
| `ReissueNotAvailable` | 소각하지 않았거나 이미 재발급함 | 소각 상태 또는 재발급 이력을 확인해 주세요. |
| `RecipientAlreadyHoldsCertificate` | 재발급 대상이 이미 증서를 보유 | 증서를 보유하지 않은 지갑을 입력해 주세요. |
| `AccessControlUnauthorizedAccount` | 호출 지갑에 역할이 없음 | 올바른 운영 지갑을 연결해 주세요. |
| `ERC721InvalidReceiver` | 컨트랙트 지갑이 NFT 수신 미지원 | 다른 지갑을 사용하거나 단건 확인이 필요합니다. |
| `ERC721NonexistentToken` | 존재하지 않거나 소각된 Token ID | Token ID와 소각 여부를 확인해 주세요. |

## 9. 호출하면 안 되는 함수

다음 함수는 ABI 호환을 위해 존재하지만 이 SBT에서는 항상 실패합니다.

- `transferFrom`
- `safeTransferFrom`
- `approve`
- `setApprovalForAll`

참가자는 직접 전송하거나 소각할 수 없습니다. Metadata를 변경하는 함수도 없습니다.

## 10. 역할 관리

역할 값은 하드코딩하지 말고 컨트랙트에서 읽는 것이 안전합니다.

```ts
const minterRole = await publicClient.readContract({
  address,
  abi: certificateAbi,
  functionName: 'MINTER_ROLE',
})

const recoveryRole = await publicClient.readContract({
  address,
  abi: certificateAbi,
  functionName: 'RECOVERY_ROLE',
})
```

- 서버 민터 교체: `grantRole(MINTER_ROLE, newMinter)` 확인 후 `revokeRole(MINTER_ROLE, oldMinter)`
- 관리자 교체: 신규 주소에 `DEFAULT_ADMIN_ROLE`, `RECOVERY_ROLE`을 모두 부여하고 확인한 뒤 기존 역할 회수
- 마지막 `DEFAULT_ADMIN_ROLE` 보유자는 `renounceRole`을 호출하면 안 됩니다. 이후 역할 관리가 영구적으로
  불가능해집니다.

역할 관련 쓰기 함수:

| 함수 | 호출자 | 용도 |
|---|---|---|
| `grantRole(role, account)` | `DEFAULT_ADMIN_ROLE` | 운영 지갑에 역할 부여 |
| `revokeRole(role, account)` | `DEFAULT_ADMIN_ROLE` | 운영 지갑의 역할 회수 |
| `renounceRole(role, callerConfirmation)` | 해당 계정 본인 | 자기 역할 포기. 기본 관리자 역할에는 사용 금지 |

## 11. 구현 체크리스트

- [ ] 개발·리허설은 Fuji, 행사 운영은 메인넷 체인 ID를 사용한다.
- [ ] 메인넷의 컨트랙트 주소와 실제 배포 블록을 함께 설정했다.
- [ ] 이번 행사 배포에서 커스텀 RPC를 비우고 선택 체인의 공개 RPC를 사용한다.
- [ ] ABI를 최신 배포 버전과 맞췄다.
- [ ] 민터 개인키는 서버 전용 환경변수에만 저장했다.
- [ ] 모든 쓰기 호출 전에 시뮬레이션한다.
- [ ] 트랜잭션 영수증 성공 후 이벤트를 DB에 저장한다.
- [ ] `hasBeenIssued`를 현재 보유 여부로 오해하지 않는다.
- [ ] Token ID 조회를 위해 발급·재발급·소각 이벤트를 저장한다.
- [ ] 배치 발급 전에 중복, 발급 이력, 빈 URI, 컨트랙트 지갑을 검사한다.
- [ ] Token ID를 JSON에 넣을 때 `bigint`를 문자열로 변환한다.

Viem 참고 문서:

- [Reading Contracts](https://viem.sh/docs/contract/readContract)
- [Writing Contracts](https://viem.sh/docs/contract/writeContract)
- [Simulating Contract Calls](https://viem.sh/docs/contract/simulateContract)
