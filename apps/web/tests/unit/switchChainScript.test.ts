import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const SCRIPT = path.resolve('scripts/switch-chain.mjs');
const RECORD_SCRIPT = path.resolve('scripts/record-mainnet-deployment.mjs');

function run(...args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function record(...args: string[]) {
  return spawnSync(process.execPath, [RECORD_SCRIPT, ...args], { encoding: 'utf8' });
}

describe('Production 체인 전환 명령', () => {
  test('검증된 메인넷 배포 기록으로 준비와 전환 dry-run을 만든다', () => {
    const prepare = run('prepare-mainnet');
    const activate = run('mainnet');

    expect(prepare.status).toBe(0);
    expect(activate.status).toBe(0);
    expect(prepare.stdout).toContain('메인넷 코드·배포 트랜잭션·민터/관리자 권한 일치');
    expect(prepare.stdout).toContain('NEXT_PUBLIC_CHAIN_ID를 건드리지 않으므로 Production은 Fuji');
    expect(activate.stdout).toContain('CERTIFICATE_ADDRESS=0x787D2971Ec3eaA6b63d51BB52834aB41d2cd18A9');
    expect(activate.stdout).toContain('CERTIFICATE_DEPLOYMENT_BLOCK=93905564');
    expect(activate.stdout).toContain('NEXT_PUBLIC_CHAIN_ID=43114');
  });

  test('Fuji 복귀에는 메인넷 배포 기록이 필요하지 않다', () => {
    const result = run('fuji');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NEXT_PUBLIC_CHAIN_ID=43113');
  });

  test('실제 반영에는 대상 체인과 같은 확인값이 필요하다', () => {
    const result = run('fuji', '--apply', '--confirm', '43114');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--confirm 43113 확인값이 필요합니다');
  });

  test('배포 기록 경로를 바꾸는 테스트용 옵션을 운영 명령에서 받지 않는다', () => {
    const result = run('mainnet', '--artifact', 'tests/fixtures/mainnet-deployment.json');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('알 수 없는 옵션입니다: --artifact');
  });

  test('검증을 마친 메인넷 배포 기록은 자동으로 덮어쓰지 않는다', () => {
    const result = record(
      '--address', '0x1111111111111111111111111111111111111111',
      '--tx', `0x${'a'.repeat(64)}`,
      '--block', '70000000',
      '--admin', '0x2222222222222222222222222222222222222222',
      '--minter', '0x3333333333333333333333333333333333333333',
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('메인넷 배포 기록이 이미 존재합니다');
  });
});
