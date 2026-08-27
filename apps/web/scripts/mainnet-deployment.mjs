import { readFile } from 'node:fs/promises';

import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHash,
} from 'viem';
import { avalanche } from 'viem/chains';

const EXPECTED_NAME = 'Avalanche Bakery Certificate';
const EXPECTED_SYMBOL = 'ABAKE';

export async function readMainnetDeployment(file) {
  let raw;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        `메인넷 배포 기록이 없습니다: ${file}\n`
        + '컨트랙트를 배포하고 contracts/deployments/43114.json을 먼저 기록하세요.',
      );
    }
    throw new Error(`메인넷 배포 기록을 읽지 못했습니다: ${file}`, { cause: error });
  }

  return validateMainnetDeployment(raw);
}

export function validateMainnetDeployment(raw) {
  const valid = raw
    && raw.network === 'avalanche'
    && raw.chainId === avalanche.id
    && raw.status === 'deployed'
    && isAddress(raw.address)
    && isHash(raw.deploymentTransaction)
    && Number.isSafeInteger(raw.deploymentBlock)
    && raw.deploymentBlock > 0
    && isAddress(raw.admin)
    && isAddress(raw.minter);

  if (!valid) {
    throw new Error(
      '메인넷 배포 기록에는 network, chainId, address, deploymentTransaction, '
      + 'deploymentBlock, admin, minter가 올바르게 들어 있어야 합니다.',
    );
  }

  return {
    network: 'avalanche',
    chainId: avalanche.id,
    status: 'deployed',
    address: getAddress(raw.address),
    deploymentTransaction: raw.deploymentTransaction,
    deploymentBlock: raw.deploymentBlock,
    admin: getAddress(raw.admin),
    minter: getAddress(raw.minter),
  };
}

export async function verifyMainnetDeployment(deployment, { abiFile }) {
  const abi = JSON.parse(await readFile(abiFile, 'utf8'));
  const client = createPublicClient({
    chain: avalanche,
    transport: http(undefined, { retryCount: 1, timeout: 10_000 }),
  });

  const receipt = await client.getTransactionReceipt({
    hash: deployment.deploymentTransaction,
  });
  if (
    receipt.status !== 'success'
    || receipt.contractAddress === null
    || getAddress(receipt.contractAddress) !== deployment.address
    || receipt.blockNumber !== BigInt(deployment.deploymentBlock)
  ) {
    throw new Error('배포 트랜잭션의 컨트랙트 주소 또는 블록이 배포 기록과 다릅니다.');
  }

  const code = await client.getCode({ address: deployment.address });
  if (!code || code === '0x') {
    throw new Error('메인넷 배포 주소에 컨트랙트 코드가 없습니다.');
  }

  const read = (functionName, args = undefined) => client.readContract({
    address: deployment.address,
    abi,
    functionName,
    args,
  });
  const [name, symbol, minterRole, recoveryRole, adminRole] = await Promise.all([
    read('name'),
    read('symbol'),
    read('MINTER_ROLE'),
    read('RECOVERY_ROLE'),
    read('DEFAULT_ADMIN_ROLE'),
  ]);
  const [minterCanMint, adminCanRecover, adminCanManage] = await Promise.all([
    read('hasRole', [minterRole, deployment.minter]),
    read('hasRole', [recoveryRole, deployment.admin]),
    read('hasRole', [adminRole, deployment.admin]),
  ]);

  if (name !== EXPECTED_NAME || symbol !== EXPECTED_SYMBOL) {
    throw new Error(`예상한 증서 컨트랙트가 아닙니다: ${String(name)} (${String(symbol)})`);
  }
  if (!minterCanMint || !adminCanRecover || !adminCanManage) {
    throw new Error('메인넷 컨트랙트의 민터 또는 관리자 권한이 배포 기록과 다릅니다.');
  }

  return { name, symbol, minterCanMint, adminCanRecover, adminCanManage };
}
