/**
 * ScoreGauge — circular SVG gauge for compliance score visualization.
 */
export default function ScoreGauge({ score = 0, size = 160, strokeWidth = 10, label = 'Compliance Score' }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  // Color based on score
  const color =
    score >= 80 ? '#10b981' :
    score >= 50 ? '#f59e0b' :
    '#ef4444'

  const glowColor =
    score >= 80 ? 'rgba(16, 185, 129, 0.3)' :
    score >= 50 ? 'rgba(245, 158, 11, 0.3)' :
    'rgba(239, 68, 68, 0.3)'

  return (
    <div className="score-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Score ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.5s ease',
            filter: 'url(#glow)',
          }}
        />
        {/* Score text */}
        <text
          x={size / 2}
          y={size / 2 - 8}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={size * 0.22}
          fontWeight="800"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {Math.round(score)}%
        </text>
        <text
          x={size / 2}
          y={size / 2 + 18}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#64748b"
          fontSize={10}
          fontWeight="500"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {label}
        </text>
      </svg>
    </div>
  )
}
