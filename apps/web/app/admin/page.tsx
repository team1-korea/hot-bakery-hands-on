import type { Metadata } from 'next';

import { AdminBoard } from './AdminBoard';
import { OperatorGate } from './OperatorGate';
import './admin.css';

/** 운영자만 쓰는 화면이다. 색인되면 존재를 알릴 뿐 얻는 것이 없다. */
export const metadata: Metadata = {
  title: '운영자 화면 · Avalanche Bakery',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <OperatorGate>
      <AdminBoard />
    </OperatorGate>
  );
}
