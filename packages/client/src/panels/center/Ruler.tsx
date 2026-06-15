/** A pixel ruler (top or left) whose ticks align with the zoomed canvas frame. */
export function Ruler({
  axis,
  length,
  zoom,
  offset,
  size
}: {
  axis: 'x' | 'y'
  length: number
  zoom: number
  offset: number
  size: number
}) {
  // Choose a tick step so labels land ~50px apart on screen.
  const raw = 50 / zoom
  const steps = [5, 10, 25, 50, 100, 200, 250, 500, 1000]
  const step = steps.find((s) => s >= raw) ?? 1000
  const ticks: number[] = []
  for (let v = 0; v <= length + 0.5; v += step) ticks.push(v)

  if (axis === 'x') {
    return (
      <svg className="ruler-svg" width="100%" height={size}>
        {ticks.map((v) => {
          const x = offset + v * zoom
          return (
            <g key={v}>
              <line x1={x} y1={size - 6} x2={x} y2={size} stroke="#94a3b8" />
              <text x={x + 2} y={size - 8} className="ruler-text">
                {v}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }
  return (
    <svg className="ruler-svg" width={size} height="100%">
      {ticks.map((v) => {
        const y = offset + v * zoom
        return (
          <g key={v}>
            <line x1={size - 6} y1={y} x2={size} y2={y} stroke="#94a3b8" />
            <text x={2} y={y + 9} className="ruler-text">
              {v}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
