export function SlidesShell({ slideIndex }: { slideIndex: number }) {
  return (
    <section className="slides-shell">
      <header className="top-bar slides-top-bar">
        <div className="brand-lockup">
          <span className="brand-mark">AB</span>
          <strong>AVALANCHE BAKERY</strong>
        </div>
        <span className="micro-label">BAKERY CLASS · EDUCATION</span>
      </header>
      <div className="slide-canvas">
        <span className="micro-label">
          SLIDE {String(slideIndex + 1).padStart(2, '0')}
        </span>
      </div>
    </section>
  );
}
