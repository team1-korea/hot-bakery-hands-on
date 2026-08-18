import { DisplayStage } from '@/components/display/DisplayStage';

export default async function DisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string }>;
}) {
  const { dev } = await searchParams;
  return <DisplayStage devMode={dev === '1'} />;
}
