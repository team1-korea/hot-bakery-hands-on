import { Suspense } from 'react';

import { DemoExperience } from '@/components/demo/DemoExperience';

export default function DemoBPage() {
  return (
    <Suspense fallback={<main className="simulation-viewport" />}>
      <DemoExperience initialVariant="b" />
    </Suspense>
  );
}
