function finderCell(row: number, column: number, top: number, left: number) {
  const y = row - top;
  const x = column - left;
  if (x < 0 || x > 6 || y < 0 || y > 6) return false;
  return x === 0 || x === 6 || y === 0 || y === 6
    || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
}

function isDark(row: number, column: number) {
  if (
    finderCell(row, column, 0, 0)
    || finderCell(row, column, 0, 14)
    || finderCell(row, column, 14, 0)
  ) return true;
  const gap = (row <= 7 && column <= 7)
    || (row <= 7 && column >= 13)
    || (row >= 13 && column <= 7);
  return gap ? false : (row * 3 + column * 5 + row * column) % 7 < 3;
}

export function MockQr() {
  const cells = Array.from({ length: 21 * 21 }, (_, index) => {
    const row = Math.floor(index / 21);
    const column = index % 21;
    return isDark(row, column)
      ? <rect key={index} x={column + 4} y={row + 4} width="1" height="1" />
      : null;
  });
  return (
    <div className="qr-block" aria-label="참가 페이지 QR 코드">
      <svg className="qr-code" viewBox="0 0 29 29" role="img" aria-hidden="true">
        <rect width="29" height="29" fill="var(--paper)" />
        <g fill="var(--ink)">{cells}</g>
      </svg>
      <div className="qr-copy">
        <strong>사진 올리기</strong>
      </div>
    </div>
  );
}
