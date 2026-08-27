#!/usr/bin/env node

import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getAddress, isAddress } from 'viem';

import {
  validateMainnetDeployment,
  verifyMainnetDeployment,
} from './mainnet-deployment.mjs';

const options = parseArguments(process.argv.slice(2));
const missing = ['address', 'tx', 'block', 'admin', 'minter']
  .filter((name) => !options[name]);
if (missing.length > 0) usage(`필수 옵션이 없습니다: ${missing.map((name) => `--${name}`).join(', ')}`);

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const destination = path.join(repositoryRoot, 'contracts/deployments/43114.json');
const planned = JSON.parse(await readFile(destination, 'utf8'));
if (planned.status !== 'pending') {
  throw new Error('메인넷 배포 기록이 이미 존재합니다. 기존 기록을 자동으로 덮어쓰지 않습니다.');
}
if (
  !isAddress(planned.minter)
  || !isAddress(options.minter)
  || getAddress(options.minter) !== getAddress(planned.minter)
) {
  throw new Error('메인넷 민터는 현재 Production 서버 민터 주소를 그대로 사용해야 합니다.');
}

const deployment = validateMainnetDeployment({
  network: 'avalanche',
  chainId: 43114,
  status: 'deployed',
  address: options.address,
  deploymentTransaction: options.tx,
  deploymentBlock: Number(options.block),
  admin: options.admin,
  minter: options.minter,
});
await verifyMainnetDeployment(deployment, {
  abiFile: path.join(repositoryRoot, 'contracts/abi/AvalancheBakeryCertificate.json'),
});

console.log('검증         메인넷 코드·배포 트랜잭션·민터/관리자 권한 일치');
console.log(`컨트랙트     ${deployment.address}`);
console.log(`배포 블록    ${deployment.deploymentBlock}`);
console.log(`관리자       ${deployment.admin}`);
console.log(`민터         ${deployment.minter}`);

if (!options.apply) {
  console.log('');
  console.log('DRY RUN      실제 기록에는 --apply --confirm RECORD가 필요합니다.');
  process.exit(0);
}
if (options.confirm !== 'RECORD') usage('실제 기록에는 --confirm RECORD가 필요합니다.');

const current = JSON.parse(await readFile(destination, 'utf8'));
if (current.status !== 'pending') {
  throw new Error('메인넷 배포 기록이 이미 존재합니다. 기존 기록을 자동으로 덮어쓰지 않습니다.');
}
const temporary = `${destination}.tmp`;
await writeFile(temporary, `${JSON.stringify(deployment, null, 2)}\n`, { flag: 'wx' });
await rename(temporary, destination);
console.log(`완료         ${destination}`);

function parseArguments(argv) {
  const parsed = {
    address: undefined,
    tx: undefined,
    block: undefined,
    admin: undefined,
    minter: undefined,
    apply: false,
    confirm: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--apply') {
      parsed.apply = true;
      continue;
    }
    if (['--address', '--tx', '--block', '--admin', '--minter', '--confirm'].includes(token)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) usage(`${token} 값이 없습니다.`);
      parsed[token.slice(2)] = value;
      index += 1;
      continue;
    }
    usage(`알 수 없는 옵션입니다: ${token}`);
  }
  return parsed;
}

function usage(message) {
  console.error(message);
  console.error('');
  console.error('npm run chain:record-mainnet -- --address 0x... --tx 0x... --block 12345678 \\');
  console.error('  --admin 0x... --minter 0x...');
  process.exit(1);
}
