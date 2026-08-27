import { getAddress, isAddress, type Address } from 'viem';

import fujiDeployment from '@contracts/deployments/43113.json';

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
  rpcUrl: string | undefined;
};

/**
 * 서버가 사용할 체인 설정의 단일 interface.
 *
 * Fuji는 커밋된 배포 정보만 사용한다. 그래서 메인넷 주소와 블록을 Vercel에 미리 등록해
 * 두어도 테스트 중에는 Fuji 컨트랙트가 바뀌지 않는다. 메인넷을 선택했을 때만 두 값을
 * 필수로 읽으므로 실제 전환은 NEXT_PUBLIC_CHAIN_ID 하나로 활성화할 수 있다.
 */
export function resolveServerChainConfig(
  environment: ChainEnvironment = {
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    CERTIFICATE_ADDRESS: process.env.CERTIFICATE_ADDRESS,
    CERTIFICATE_DEPLOYMENT_BLOCK: process.env.CERTIFICATE_DEPLOYMENT_BLOCK,
    AVALANCHE_RPC_URL: process.env.AVALANCHE_RPC_URL,
  },
): ServerChainConfig {
  const network = resolveCChain(environment.NEXT_PUBLIC_CHAIN_ID);
  const rpcUrl = environment.AVALANCHE_RPC_URL?.trim() || undefined;

  if (network.id === '43113') {
    return {
      chainId: 43113,
      contractAddress: fujiDeployment.address as Address,
      deploymentBlock: BigInt(fujiDeployment.deploymentBlock),
      rpcUrl,
    };
  }

  const rawAddress = environment.CERTIFICATE_ADDRESS?.trim();
  const rawBlock = environment.CERTIFICATE_DEPLOYMENT_BLOCK?.trim();
  if (!rawAddress || !isAddress(rawAddress) || !rawBlock || !/^[1-9]\d*$/.test(rawBlock)) {
    throw new Error(
      '메인넷에는 올바른 CERTIFICATE_ADDRESS와 CERTIFICATE_DEPLOYMENT_BLOCK이 필요합니다.',
    );
  }

  return {
    chainId: 43114,
    contractAddress: getAddress(rawAddress),
    deploymentBlock: BigInt(rawBlock),
    rpcUrl,
  };
}
