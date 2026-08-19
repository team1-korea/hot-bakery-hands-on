import Link from 'next/link';

/** 참가자가 QR을 잘못 찍거나 주소를 잘못 옮겨 적었을 때 도착하는 곳이다. */
export default function NotFound() {
  return (
    <main className="oops">
      <p className="oops-mark">AVALANCHE BAKERY</p>
      <h1>없는 주소예요</h1>
      <p className="oops-note">QR을 다시 찍어 주세요.</p>
      <Link className="oops-button" href="/join">
        참가 화면으로
      </Link>
    </main>
  );
}
