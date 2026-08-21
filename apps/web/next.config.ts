import type { NextConfig } from 'next';
import path from 'node:path';

const repositoryRoot = path.join(__dirname, '../..');

const nextConfig: NextConfig = {
  // ABI와 Fuji 배포 정보는 저장소 루트의 contracts/가 정본이다. apps/web만
  // Turbopack 루트로 잡히면 이 서버 모듈들을 production build가 읽지 못한다.
  turbopack: { root: repositoryRoot },
  outputFileTracingRoot: repositoryRoot,
};

export default nextConfig;
