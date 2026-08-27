import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  mainnetEnvironmentUpdates,
  readMainnetDeployment,
  verifyMainnetDeployment,
} from '../../scripts/mainnet-deployment.mjs';

const ARTIFACT = path.resolve('tests/fixtures/mainnet-deployment.json');
const ABI = path.resolve('../../contracts/abi/AvalancheBakeryCertificate.json');
const MINTER_ROLE = `0x${'1'.repeat(64)}`;
const RECOVERY_ROLE = `0x${'2'.repeat(64)}`;
const ADMIN_ROLE = `0x${'0'.repeat(64)}`;

function verifierClient(deployment, { denyRole = undefined } = {}) {
  return {
    async getTransactionReceipt() {
      return {
        status: 'success',
        contractAddress: deployment.address,
        blockNumber: BigInt(deployment.deploymentBlock),
      };
    },
    async getCode() {
      return '0x6000';
    },
    async readContract({ functionName, args }) {
      if (functionName === 'name') return 'Avalanche Bakery Certificate';
      if (functionName === 'symbol') return 'ABAKE';
      if (functionName === 'MINTER_ROLE') return MINTER_ROLE;
      if (functionName === 'RECOVERY_ROLE') return RECOVERY_ROLE;
      if (functionName === 'DEFAULT_ADMIN_ROLE') return ADMIN_ROLE;
      if (functionName === 'hasRole') return args[0] !== denyRole;
      throw new Error(`unexpected function: ${functionName}`);
    },
  };
}

describe('메인넷 배포 안전장치', () => {
  test('활성화할 때 주소·블록을 먼저 쓰고 체인 ID를 마지막에 쓴다', async () => {
    const deployment = await readMainnetDeployment(ARTIFACT);

    expect(mainnetEnvironmentUpdates(deployment, { activate: false })).toEqual([
      ['CERTIFICATE_ADDRESS', deployment.address],
      ['CERTIFICATE_DEPLOYMENT_BLOCK', String(deployment.deploymentBlock)],
    ]);
    expect(mainnetEnvironmentUpdates(deployment, { activate: true })).toEqual([
      ['CERTIFICATE_ADDRESS', deployment.address],
      ['CERTIFICATE_DEPLOYMENT_BLOCK', String(deployment.deploymentBlock)],
      ['NEXT_PUBLIC_CHAIN_ID', '43114'],
    ]);
  });

  test('배포 트랜잭션·코드·컬렉션·세 역할이 모두 맞아야 통과한다', async () => {
    const deployment = await readMainnetDeployment(ARTIFACT);

    await expect(verifyMainnetDeployment(deployment, {
      abiFile: ABI,
      client: verifierClient(deployment),
    })).resolves.toMatchObject({
      name: 'Avalanche Bakery Certificate',
      symbol: 'ABAKE',
      minterCanMint: true,
      adminCanRecover: true,
      adminCanManage: true,
    });
  });

  test('민터 또는 관리자 역할이 하나라도 다르면 거절한다', async () => {
    const deployment = await readMainnetDeployment(ARTIFACT);

    await expect(verifyMainnetDeployment(deployment, {
      abiFile: ABI,
      client: verifierClient(deployment, { denyRole: MINTER_ROLE }),
    })).rejects.toThrow(/민터 또는 관리자 권한/);
  });
});
