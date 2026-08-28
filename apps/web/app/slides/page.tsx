import type { Metadata } from 'next';

import { SlidesReview } from './SlidesReview';

import '../display/display.css';

export const metadata: Metadata = {
  title: '교육 슬라이드 검수 · Avalanche Bakery',
  robots: { index: false, follow: false },
};

export default function SlidesPage() {
  return <SlidesReview />;
}
