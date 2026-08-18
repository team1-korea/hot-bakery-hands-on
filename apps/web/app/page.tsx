import { redirect } from 'next/navigation';

/** QR은 사이트 루트를 가리킨다. 참가 흐름은 /join 한 곳에서만 산다. */
export default function RootPage() {
  redirect('/join');
}
