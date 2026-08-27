import { getAddress, isAddress, isHash, type Address } from 'viem';

import fujiDeployment from '@contracts/deployments/43113.json';
import recordedMainnetDeployment from '@contracts/deployments/43114.json';

import { resolveCChain } from '../explorer';

type ChainEnvironment = Partial<Record<
  | 'NEXT_PUBLIC_CHAIN_ID'
  | 'CERTIFICATE_ADDRESS'
  | 'CERTIFICATE_DEPLOYMENT_BLOCK'
  | 'AVALANCHE_RPC_URL',
  string | undefined
>>;

export type ServerChainConfig = {
  chainId: 43113 | 43114;
  contractAddress: Address;
  deploymentBlock: bigint;
  minterAddress: Address | null;
  rpcUrl: string | undefined;
};

type MainnetDeployment = {
  network?: unknown;
  chainId?: unknown;
  status?: unknown;
  address?: unknown;
  deploymentTransaction?: unknown;
  deploymentBlock?: unknown;
  admin?: unknown;
  minter?: unknown;
};

/**
 * 서버가 사용할 체인 설정의 단일 interface.
 *
 * Fuji는 커밋된 배포 정보만 사용한다. 그래서 메인넷 주소와 블록을 Vercel에 미리 등록해
 * 두어도 테스트 중에는 Fuji 컨트랙트가 바뀌지 않는다. 메인넷을 선택했을 때는 온체인 검증을
 * 마친 커밋 기록과 환경변수가 일치해야 하므로 실제 전환은 NEXT_PUBLIC_CHAIN_ID로 활성화하되,
 * 주소·블록 또는 민터가 엇갈린 배포는 시작하지 않는다.
 */
export function resolveServerChainConfig(
  environment: ChainEnvironment = {
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    CERTIFICATE_ADDRESS: process.env.CERTIFICATE_ADDRESS,
    CERTIFICATE_DEPLOYMENT_BLOCK: process.env.CERTIFICATE_DEPLOYMENT_BLOCK,
    AVALANCHE_RPC_URL: process.env.AVALANCHE_RPC_URL,
  },
  mainnetDeployment: MainnetDeployment = recordedMainnetDeployment,
): ServerChainConfig {
  const network = resolveCChain(environment.NEXT_PUBLIC_CHAIN_ID);
  const rpcUrl = environment.AVALANCHE_RPC_URL?.trim() || undefined;

  if (network.id === '43113') {
    return {
      chainId: 43113,
      contractAddress: fujiDeployment.address as Address,
      deploymentBlock: BigInt(fujiDeployment.deploymentBlock),
      minterAddress: null,
      rpcUrl,
    };
  }

  if (rpcUrl) {
    throw new Error('메인넷에서는 AVALANCHE_RPC_URL을 설정하지 않고 공식 공개 RPC를 사용합니다.');
  }

  if (
    mainnetDeployment.network !== 'avalanche'
    || mainnetDeployment.chainId !== 43114
    || mainnetDeployment.status !== 'deployed'
    || typeof mainnetDeployment.address !== 'string'
    || !isAddress(mainnetDeployment.address)
    || typeof mainnetDeployment.deploymentTransaction !== 'string'
    || !isHash(mainnetDeployment.deploymentTransaction)
    || !Number.isSafeInteger(mainnetDeployment.deploymentBlock)
    || Number(mainnetDeployment.deploymentBlock) <= 0
    || typeof mainnetDeployment.admin !== 'string'
    || !isAddress(mainnetDeployment.admin)
    || typeof mainnetDeployment.minter !== 'string'
    || !isAddress(mainnetDeployment.minter)
  ) {
    throw new Error('메인넷 컨트랙트 배포와 검증이 아직 완료되지 않았습니다.');
  }

  const rawAddress = environment.CERTIFICATE_ADDRESS?.trim();
  const rawBlock = environment.CERTIFICATE_DEPLOYMENT_BLOCK?.trim();
  if (!rawAddress || !isAddress(rawAddress) || !rawBlock || !/^[1-9]\d*$/.test(rawBlock)) {
    throw new Error(
      '메인넷에는 올바른 CERTIFICATE_ADDRESS와 CERTIFICATE_DEPLOYMENT_BLOCK이 필요합니다.',
    );
  }

  const contractAddress = getAddress(mainnetDeployment.address);
  const deploymentBlock = BigInt(Number(mainnetDeployment.deploymentBlock));
  if (getAddress(rawAddress) !== contractAddress || BigInt(rawBlock) !== deploymentBlock) {
    throw new Error('Vercel의 메인넷 주소·배포 블록이 커밋된 배포 기록과 다릅니다.');
  }

  return {
    chainId: 43114,
    contractAddress,
    deploymentBlock,
    minterAddress: getAddress(mainnetDeployment.minter),
    rpcUrl,
  };
}
