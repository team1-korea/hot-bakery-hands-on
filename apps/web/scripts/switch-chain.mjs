#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { isAddress } from 'viem';

const CHAIN_IDS = { fuji: '43113', mainnet: '43114' };
const options = parseArguments(process.argv.slice(2));
const preparingMainnet = options.target === 'prepare-mainnet';
const chainId = CHAIN_IDS[options.target];
if (!preparingMainnet && !chainId) {
  usage(`대상은 prepare-mainnet, fuji 또는 mainnet이어야 합니다: ${options.target ?? '(없음)'}`);
}

if (preparingMainnet) {
  if (!options.address || !isAddress(options.address)) {
    usage('메인넷 사전 준비에는 올바른 --address가 필요합니다.');
  }
  if (!options.block || !/^[1-9]\d*$/.test(options.block)) {
    usage('메인넷 사전 준비에는 양의 정수 --block이 필요합니다.');
  }
} else if (options.address || options.block) {
  usage('체인 전환에는 --address와 --block을 사용하지 않습니다. 먼저 prepare-mainnet을 실행하세요.');
}

const updates = preparingMainnet
  ? [
      ['CERTIFICATE_ADDRESS', options.address],
      ['CERTIFICATE_DEPLOYMENT_BLOCK', options.block],
    ]
  : [['NEXT_PUBLIC_CHAIN_ID', chainId]];
const confirmation = preparingMainnet ? 'PREPARE' : chainId;

console.log(`작업         ${preparingMainnet ? '메인넷 배포 정보 사전 등록' : `${options.target} 활성화 (${chainId})`}`);
for (const [name, value] of updates) console.log(`변경         ${name}=${value}`);
if (preparingMainnet) {
  console.log('현재 체인    NEXT_PUBLIC_CHAIN_ID를 건드리지 않으므로 Production은 Fuji를 유지합니다.');
} else {
  console.log('재배포       환경변수 변경 뒤 Vercel에서 최신 main을 Production으로 재배포해야 합니다.');
}

if (!options.apply) {
  console.log('');
  console.log(`DRY RUN      실제 반영: ${exampleCommand(options, confirmation)}`);
  process.exit(0);
}

if (options.confirm !== confirmation) {
  usage(`실제 반영에는 --confirm ${confirmation}가 필요합니다.`);
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
for (const [name, value] of updates) updateVercelEnvironment(repositoryRoot, name, value);

console.log('');
if (preparingMainnet) {
  console.log('완료         메인넷 주소와 배포 블록을 등록했습니다. Production은 아직 Fuji입니다.');
} else {
  console.log('완료         활성 체인을 바꿨습니다. 최신 main을 Production으로 재배포하세요.');
}

function updateVercelEnvironment(cwd, name, value) {
  const result = spawnSync(
    'npx',
    [
      '--yes',
      'vercel@latest',
      'env',
      'add',
      name,
      'production',
      '--force',
      '--no-sensitive',
      '--value',
      value,
      '--yes',
      '--cwd',
      cwd,
    ],
    { cwd, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function parseArguments(argv) {
  const [target, ...rest] = argv;
  const parsed = { target, apply: false, address: undefined, block: undefined, confirm: undefined };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === '--apply') {
      parsed.apply = true;
      continue;
    }
    if (token === '--address' || token === '--block' || token === '--confirm') {
      const value = rest[index + 1];
      if (!value || value.startsWith('--')) usage(`${token} 값이 없습니다.`);
      parsed[token.slice(2)] = value;
      index += 1;
      continue;
    }
    usage(`알 수 없는 옵션입니다: ${token}`);
  }
  return parsed;
}

function exampleCommand(currentOptions, confirmation) {
  if (!preparingMainnet) {
    return `npm run chain:switch -- ${currentOptions.target} --apply --confirm ${confirmation}`;
  }
  return `npm run chain:prepare-mainnet -- --address ${currentOptions.address} --block ${currentOptions.block} `
    + `--apply --confirm ${confirmation}`;
}

function usage(message) {
  console.error(message);
  console.error('');
  console.error('npm run chain:prepare-mainnet -- --address 0x... --block 12345678');
  console.error('npm run chain:switch -- fuji');
  console.error('npm run chain:switch -- mainnet');
  process.exit(1);
}
