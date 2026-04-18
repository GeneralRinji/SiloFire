export function HomeSplashArt() {
  const width = 1600;
  const height = 1000;
  const gridLines: JSX.Element[] = [];
  const wavePaths: JSX.Element[] = [];
  const cx = width / 2;
  const cy = height * 0.44;

  for (let y = 0; y <= height; y += 52) {
    const drift = Math.sin(y * 0.02) * 20;
    gridLines.push(
      <line
        key={`h-${y}`}
        x1={-80 + drift}
        y1={y}
        x2={width + 80 + drift}
        y2={y}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }

  for (let x = 0; x <= width; x += 56) {
    const bend = Math.cos(x * 0.015) * 22;
    gridLines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={-80 + bend}
        x2={x}
        y2={height + 80 + bend}
        strokeWidth={0.9}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }

  for (let row = 0; row < 12; row += 1) {
    const baseY = 130 + row * 58;
    let d = `M 0 ${baseY}`;

    for (let x = 0; x <= width; x += 28) {
      const y = baseY + Math.sin(x * 0.018 + row * 0.8) * 12 + Math.cos(x * 0.006 + row * 0.18) * 7;
      d += ` L ${x} ${y.toFixed(2)}`;
    }

    wavePaths.push(
      <path
        key={`wave-${row}`}
        d={d}
        fill="none"
        strokeWidth={1.15}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }

  return (
    <svg className="home-splash-art" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g className="home-splash-art__grid">{gridLines}</g>
      <g className="home-splash-art__waves">{wavePaths}</g>
      <circle className="home-splash-art__core" cx={cx} cy={cy} r="72" />
      <circle className="home-splash-art__ring" cx={cx} cy={cy} r="156" />
    </svg>
  );
}