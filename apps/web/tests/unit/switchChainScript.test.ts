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
  test('메인넷 배포가 pending이면 준비와 전환을 모두 거절한다', () => {
    const prepare = run('prepare-mainnet');
    const activate = run('mainnet');

    expect(prepare.status).toBe(1);
    expect(activate.status).toBe(1);
    expect(prepare.stderr).toContain('메인넷 배포 기록에는');
    expect(activate.stderr).toContain('메인넷 배포 기록에는');
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

  test('메인넷 배포 기록은 현재 Production 민터가 아니면 체인 조회 전에 거절한다', () => {
    const result = record(
      '--address', '0x1111111111111111111111111111111111111111',
      '--tx', `0x${'a'.repeat(64)}`,
      '--block', '70000000',
      '--admin', '0x2222222222222222222222222222222222222222',
      '--minter', '0x3333333333333333333333333333333333333333',
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('현재 Production 서버 민터 주소');
  });
});
