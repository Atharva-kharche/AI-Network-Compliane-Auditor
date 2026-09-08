import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Server, ShieldCheck, ShieldAlert, AlertTriangle,
  Upload, TrendingUp, CheckCircle2, Activity, ArrowRight,
  Shield,
} from 'lucide-react'
import { getDashboardStats, getRiskDistribution } from '../services/api'
import { formatDeviceName, isUnassessed } from '../utils'

function DashboardSkeleton() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Security Overview</h1>
        <p className="page-subtitle">Connecting to audit engine…</p>
      </div>
      <div className="stats-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stat-card">
            <div className="skeleton" style={{ width: 32, height: 32, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: 60, height: 26, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 100, height: 14 }} />
          </div>
        ))}
      </div>
      <div className="charts-grid">
        <div className="chart-card">
          <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: '100%', height: 220 }} />
        </div>
        <div className="chart-card">
          <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: '100%', height: 220 }} />
        </div>
      </div>
    </div>
  )
}

function ScoreDisplay({ score, devicesAudited }) {
  const color = score >= 80 ? 'pass' : score >= 50 ? 'warning' : 'fail'
  const label = score >= 80 ? 'Compliant' : score >= 50 ? 'Needs Attention' : 'Critical'
  const fillColor = score >= 80 ? 'var(--color-pass)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-fail)'

  return (
    <div className="score-display">
      <div className={`score-number ${color}`}>{Math.round(score)}</div>
      <div className={`score-label`} style={{ color: fillColor }}>{label}</div>
      <div className="score-meter">
        <div className="score-meter-fill" style={{ width: `${score}%`, background: fillColor }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
        Based on {devicesAudited} audited device{devicesAudited !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 5,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{data.displayName}</div>
      {data.unassessed ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          UNASSESSED
        </div>
      ) : (
        payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontSize: 11 }}>
            {p.name}: {p.value}%
          </div>
        ))
      )}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [risk, setRisk] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const [s, r] = await Promise.all([getDashboardStats(), getRiskDistribution()])
        setStats(s)
        setRisk(r)
        setError(null)
      } catch (err) {
        setError('Could not reach the audit engine. The backend may be starting up.')
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Security Overview</h1>
        </div>
        <div className="panel">
          <div className="empty-state" style={{ padding: 60 }}>
            <div className="empty-state-icon"><AlertTriangle size={24} /></div>
            <div className="empty-state-title">Audit Engine Unavailable</div>
            <div className="empty-state-text">{error}</div>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hasData = stats && (stats.total_devices > 0 || stats.total_audits > 0)
  const recentAudits = stats?.recent_audits?.map(r => {
    const unassessed = isUnassessed(r.score, r.vendor, r.passed, r.failed)
    return {
      ...r,
      displayName: formatDeviceName({ hostname: r.hostname, id: r.device_id }),
      unassessed: unassessed,
      displayScore: unassessed ? 0 : r.score,
    }
  }) || []
  const totalFindings = risk ? (risk.critical + risk.high + risk.medium + risk.low + risk.info) : 0

  // Severity distribution data
  const severities = risk ? [
    { label: 'Critical', count: risk.critical, color: 'var(--color-critical)' },
    { label: 'High', count: risk.high, color: 'var(--color-high)' },
    { label: 'Medium', count: risk.medium, color: 'var(--color-medium)' },
    { label: 'Low', count: risk.low, color: 'var(--color-low)' },
    { label: 'Info', count: risk.info, color: 'var(--text-muted)' },
  ] : []
  const maxSeverity = Math.max(...severities.map(s => s.count), 1)

  if (!hasData) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Security Overview</h1>
          <p className="page-subtitle">Network security compliance posture</p>
        </div>
        <div className="panel">
          <div className="empty-state" style={{ padding: 80 }}>
            <div className="empty-state-icon"><Shield size={28} /></div>
            <div className="empty-state-title">NO AUDITS YET</div>
            <div className="empty-state-text">
              Import a network configuration to begin your first compliance assessment.
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/upload')}>
              <Upload size={15} /> Import Configuration
            </button>
            <div style={{ marginTop: 32, display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Import', 'Detect', 'Normalize', 'Audit', 'Remediate', 'Report'].map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', border: '1.5px solid var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{step}</span>
                  {i < 5 && <ArrowRight size={12} style={{ color: 'var(--text-muted)', marginLeft: 4 }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Security Overview</h1>
            <p className="page-subtitle">Current compliance posture across audited network devices</p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/upload')}>
            <Upload size={14} /> Import Configuration
          </button>
        </div>
      </div>

      {/* Primary metrics */}
      <div className="panel mb-24" style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <div style={{ flex: '1 1 300px', borderRight: '1px solid var(--border-primary)', paddingRight: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
            Compliance Posture
          </div>
          <div className="flex items-end gap-16 mb-8">
            <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, fontFeatureSettings: "'tnum'", color: stats.average_compliance_score >= 80 ? 'var(--color-pass)' : stats.average_compliance_score >= 50 ? 'var(--color-warning)' : 'var(--color-fail)' }}>
              {Math.round(stats.average_compliance_score)}%
            </span>
            <div className={`badge ${stats.average_compliance_score >= 80 ? 'badge-pass' : stats.average_compliance_score >= 50 ? 'badge-warning' : 'badge-fail'}`} style={{ marginBottom: 8, fontSize: 12, padding: '4px 10px' }}>
              {stats.average_compliance_score >= 80 ? 'PASSING' : stats.average_compliance_score >= 50 ? 'NEEDS ATTENTION' : 'CRITICAL'}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Security posture across {stats.total_devices} monitored device{stats.total_devices !== 1 ? 's' : ''}
          </div>
          
          <div className="score-meter" style={{ maxWidth: '100%', marginTop: 24, height: 6 }}>
            <div className="score-meter-fill" style={{ width: `${stats.average_compliance_score}%`, background: stats.average_compliance_score >= 80 ? 'var(--color-pass)' : stats.average_compliance_score >= 50 ? 'var(--color-warning)' : 'var(--color-fail)' }} />
          </div>
        </div>
        
        <div style={{ flex: '2 1 400px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16, alignContent: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Devices</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_devices}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Audits</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total_audits}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-critical)', textTransform: 'uppercase', marginBottom: 8 }}>Critical</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-critical)' }}>{stats.critical_findings}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-high)', textTransform: 'uppercase', marginBottom: 8 }}>High</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-high)' }}>{stats.high_findings}</div>
          </div>
        </div>
      </div>

      {/* Compliance Score + Finding Distribution */}
      <div className="charts-grid mb-24">
        <div className="chart-card">
          <div className="flex items-center justify-between mb-12">
            <div className="chart-card-title" style={{ margin: 0 }}>Recent Audit Scores</div>
            {recentAudits.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {recentAudits.length} assessment{recentAudits.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {recentAudits.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={recentAudits.slice(0, 8)} barCategoryGap="20%">
                <XAxis
                  dataKey="displayName"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(148,163,184,0.08)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="displayScore"
                  name="Compliance"
                  fill="var(--accent)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                  label={{ position: 'top', fill: 'var(--text-primary)', fontSize: 11, fontWeight: 600, formatter: (val, name, props) => props.payload.unassessed ? 'UNASSESSED' : `${val}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-text" style={{ margin: 0 }}>
                No audit data available. Run a compliance assessment to see scores.
              </div>
            </div>
          )}
        </div>

        {/* Finding Severity Distribution */}
        <div className="chart-card">
          <div className="flex items-center justify-between mb-12">
            <div className="chart-card-title" style={{ margin: 0 }}>Finding Distribution</div>
            {totalFindings > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {totalFindings} total
              </span>
            )}
          </div>
          {totalFindings > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
              {severities.map(s => (
                <div key={s.label} style={{ marginBottom: 14 }}>
                  <div className="flex justify-between items-center mb-6">
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.count > 0 ? s.color : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFeatureSettings: "'tnum'", color: s.count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.count}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${(s.count / maxSeverity) * 100}%`,
                        background: s.color,
                        height: '100%',
                        borderRadius: 2,
                        transition: 'width 0.6s ease'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <CheckCircle2 size={20} color="var(--color-pass)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                No failed findings detected
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Recent Activity</span>
        </div>
        {stats?.recent_activity?.length > 0 ? (
          <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Event</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_activity.map((a, i) => (
                  <tr key={i}>
                    <td style={{ width: 100 }}>
                      <span className={`badge ${a.type === 'upload' ? 'badge-accent' : 'badge-pass'}`} style={{ textTransform: 'uppercase' }}>
                        {a.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {a.description.replace(/\bunknown\b/gi, formatDeviceName({ hostname: 'unknown', id: a.device_id }))}
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      {new Date(a.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/devices/${a.device_id}`)}
                      >
                        View Device
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon"><Activity size={20} /></div>
            <div className="empty-state-title">NO RECENT ACTIVITY</div>
            <div className="empty-state-text">Import a network configuration to begin your first compliance assessment.</div>
            <button className="btn btn-primary" onClick={() => navigate('/upload')}>
              <Upload size={14} /> Import Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
