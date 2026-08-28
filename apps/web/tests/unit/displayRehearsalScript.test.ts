import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const SCRIPT = path.resolve('scripts/rehearse-display.mjs');

function run(...args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

describe('배포 화면 동시 발행 리허설 명령', () => {
  test('도움말은 실제 자원을 쓰지 않고 기본 시나리오를 설명한다', () => {
    const result = run('--help');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('npm run rehearse:display -- --confirm fuji');
    expect(result.stdout).toContain('6건 동시 제출');
    expect(result.stdout).toContain('display-load-certificate.jpg');
  });

  test('명시적인 Fuji 확인 없이는 Vercel 환경을 읽기 전에 중단한다', () => {
    const result = run('--count', '6');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--confirm fuji');
    expect(result.stdout).not.toContain('Vercel Production');
  });

  test('한 번에 6건보다 많이 만들려 하면 즉시 거절한다', () => {
    const result = run('--confirm', 'fuji', '--count', '7');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--count는 1~6');
  });

  test('알 수 없는 정리 방식은 외부 요청 전에 거절한다', () => {
    const result = run('--confirm', 'fuji', '--cleanup', 'all');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--cleanup은 ask, delete, keep');
  });
});
