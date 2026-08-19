import { fail } from '@/lib/server/http';
import { getPhoto } from '@/lib/server/store';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = getPhoto(id);
  if (!photo) return fail('NOT_FOUND', '사진을 찾을 수 없어요.');

  return new Response(photo.bytes as BodyInit, {
    headers: {
      'content-type': photo.contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
