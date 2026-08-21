import * as memory from './store.memory';
import * as postgres from './store.pg';

/**
 * 저장소 창구. 라우트는 여기만 보고 어느 구현으로 도는지 알지 못한다.
 *
 * | 없으면 | 있으면 |
 * |---|---|
 * | `DATABASE_URL` → `store.memory.ts` | `store.pg.ts` |
 *
 * **프론트 담당자는 DATABASE_URL 없이 개발한다**(AGENTS.md「목 서버」). `store.pg.ts`를
 * import하는 것만으로는 연결이 열리지 않는다 — 풀은 `db.ts`에서 첫 쿼리에 만든다.
 */

/**
 * **부를 때마다 고른다.** import 시점에 고르면 테스트가 환경변수를 갈아끼울 수 없다.
 *
 * 반환 타입이 `typeof memory`라, 두 구현의 시그니처가 어긋나면 여기서 컴파일이 깨진다.
 * 계약의 정본은 `store.memory.ts`다.
 */
function backend(): typeof memory {
  return process.env.DATABASE_URL ? postgres : memory;
}

export type { Photo } from './storage';
export type { AttachFailure, AttachResult, NicknameUpdateResult, ResetResult } from './store.shared';
export { ABANDONED_JOIN_MS, STUCK_MS } from './store.shared';

export const register: typeof memory.register = (...args) => backend().register(...args);
export const attachPhoto: typeof memory.attachPhoto = (...args) => backend().attachPhoto(...args);
export const isFull: typeof memory.isFull = (...args) => backend().isFull(...args);

export const findEntryByDid: typeof memory.findEntryByDid = (...args) =>
  backend().findEntryByDid(...args);
export const findEntryById: typeof memory.findEntryById = (...args) =>
  backend().findEntryById(...args);
export const getPhoto: typeof memory.getPhoto = (...args) => backend().getPhoto(...args);
export const getState: typeof memory.getState = (...args) => backend().getState(...args);
export const getAdminState: typeof memory.getAdminState = (...args) =>
  backend().getAdminState(...args);

export const updateShow: typeof memory.updateShow = (...args) => backend().updateShow(...args);
export const setHidden: typeof memory.setHidden = (...args) => backend().setHidden(...args);
export const updateNickname: typeof memory.updateNickname = (...args) => backend().updateNickname(...args);
export const retryEntry: typeof memory.retryEntry = (...args) => backend().retryEntry(...args);

export const sweep: typeof memory.sweep = (...args) => backend().sweep(...args);

/** 테스트 전용. Postgres 구현은 `ALLOW_DB_RESET=1`이 없으면 던진다. */
export const resetStore: typeof memory.resetStore = (...args) => backend().resetStore(...args);
export const resetAdminData: typeof memory.resetAdminData = (...args) =>
  backend().resetAdminData(...args);
