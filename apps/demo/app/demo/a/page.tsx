import { Suspense } from 'react';

import { DemoExperience } from '@/components/demo/DemoExperience';

export default function DemoAPage() {
  return (
    <Suspense fallback={<main className="simulation-viewport" />}>
      <DemoExperience initialVariant="a" />
    </Suspense>
  );
}
