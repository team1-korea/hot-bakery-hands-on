import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const SCRIPT = path.resolve('scripts/switch-chain.mjs');
const MAINNET_ADDRESS = '0x1111111111111111111111111111111111111111';

function run(...args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

describe('Production 체인 전환 명령', () => {
  test('메인넷 준비는 주소와 블록만 등록하고 활성 체인을 건드리지 않는다', () => {
    const result = run(
      'prepare-mainnet',
      '--address', MAINNET_ADDRESS,
      '--block', '70000000',
    );

    expect(result.status).toBe(0);
    const address = result.stdout.indexOf('CERTIFICATE_ADDRESS=');
    const block = result.stdout.indexOf('CERTIFICATE_DEPLOYMENT_BLOCK=');
    expect(address).toBeGreaterThan(-1);
    expect(block).toBeGreaterThan(address);
    expect(result.stdout).not.toContain('변경         NEXT_PUBLIC_CHAIN_ID=');
    expect(result.stdout).toContain('Production은 Fuji를 유지합니다');
    expect(result.stdout).toContain('DRY RUN');
    expect(result.stdout).toContain(`--address ${MAINNET_ADDRESS} --block 70000000 --apply --confirm PREPARE`);
  });

  test('메인넷 전환은 준비된 배포값을 다시 받지 않고 체인 ID만 바꾼다', () => {
    const result = run('mainnet');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NEXT_PUBLIC_CHAIN_ID=43114');
    expect(result.stdout).not.toContain('CERTIFICATE_ADDRESS=');
    expect(result.stdout).not.toContain('CERTIFICATE_DEPLOYMENT_BLOCK=');
    expect(result.stdout).toContain('chain:switch -- mainnet --apply --confirm 43114');
  });

  test('실제 반영 확인값이 작업과 다르면 Vercel을 호출하기 전에 거절한다', () => {
    const result = run(
      'prepare-mainnet',
      '--address', MAINNET_ADDRESS,
      '--block', '70000000',
      '--apply',
      '--confirm', '43113',
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--confirm PREPARE가 필요합니다');
    expect(result.stderr).not.toContain('Vercel CLI');
  });

  test('체인 전환에는 메인넷 배포값을 받지 않는다', () => {
    const result = run('fuji', '--address', MAINNET_ADDRESS);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('먼저 prepare-mainnet을 실행하세요');
  });
});
