/**
 * ScoreGauge — clean numeric score with meter bar.
 * No gradient ring — uses large number + horizontal posture meter.
 */
export default function ScoreGauge({ score = 0, size = 160, label = 'Compliance Score' }) {
  const color =
    score >= 80 ? 'var(--color-pass)' :
    score >= 50 ? 'var(--color-warning)' :
    'var(--color-fail)'

  const statusLabel =
    score >= 80 ? 'Compliant' :
    score >= 50 ? 'Needs Attention' :
    'Critical'

  return (
    <div className="score-display">
      <div
        className="score-number"
        style={{ color, fontSize: size * 0.32 }}
      >
        {Math.round(score)}
        <span style={{ fontSize: size * 0.14, fontWeight: 600, opacity: 0.7 }}>%</span>
      </div>
      <div className="score-label" style={{ color }}>
        {statusLabel}
      </div>
      <div className="score-meter" style={{ maxWidth: size * 0.9 }}>
        <div
          className="score-meter-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
        {label}
      </div>
    </div>
  )
}
