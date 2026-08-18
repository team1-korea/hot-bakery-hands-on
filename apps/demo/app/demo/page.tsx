import { Suspense } from 'react';

import { DemoExperience } from '@/components/demo/DemoExperience';

export default function DemoPage() {
  return (
    <Suspense fallback={<main className="simulation-viewport" />}>
      <DemoExperience />
    </Suspense>
  );
}
