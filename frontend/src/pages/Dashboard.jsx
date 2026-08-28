import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Server, ShieldCheck, ShieldAlert, AlertTriangle,
  Upload, Play, FileText, TrendingUp,
} from 'lucide-react'
import { getDashboardStats, getRiskDistribution } from '../services/api'

const RISK_COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#2563eb', '#6b7280']
const RISK_LABELS = ['Critical', 'High', 'Medium', 'Low', 'Info']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1a2236',
      border: '1px solid rgba(148,163,184,0.15)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontSize: 11 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [risk, setRisk] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const [s, r] = await Promise.all([getDashboardStats(), getRiskDistribution()])
        setStats(s)
        setRisk(r)
      } catch { /* empty state */ }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /> Loading dashboard…</div>
  }

  const riskData = risk ? [
    { name: 'Critical', value: risk.critical },
    { name: 'High', value: risk.high },
    { name: 'Medium', value: risk.medium },
    { name: 'Low', value: risk.low },
    { name: 'Info', value: risk.info },
  ].filter(d => d.value > 0) : []

  // Build bar chart data from recent activity
  const recentAudits = stats?.recent_activity?.filter(a => a.type === 'audit') || []

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Network security compliance overview</p>
          </div>
          <div className="flex gap-12">
            <button className="btn btn-secondary" onClick={() => navigate('/upload')}>
              <Upload size={16} /> Upload Config
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon accent">
            <Server size={22} />
          </div>
          <div className="stat-card-value">{stats?.total_devices || 0}</div>
          <div className="stat-card-label">Total Devices</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon success">
            <TrendingUp size={22} />
          </div>
          <div className="stat-card-value">{stats?.average_compliance_score || 0}%</div>
          <div className="stat-card-label">Avg Compliance</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon danger">
            <ShieldAlert size={22} />
          </div>
          <div className="stat-card-value">{stats?.critical_findings || 0}</div>
          <div className="stat-card-label">Critical Findings</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon warning">
            <AlertTriangle size={22} />
          </div>
          <div className="stat-card-value">{stats?.high_findings || 0}</div>
          <div className="stat-card-label">High Findings</div>
        </div>
      </div>

      {/* Charts Row */}
      {(recentAudits.length > 0 || riskData.length > 0) && (
        <div className="charts-grid">
          {/* Recent Audit Scores */}
          <div className="chart-card">
            <div className="chart-card-title">Recent Audit Scores</div>
            {recentAudits.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={recentAudits.map(a => {
                  const match = a.description?.match(/Audited (.+?) — (\w+) \(([\d.]+)%\)/)
                  return {
                    name: match?.[1] || 'Device',
                    score: parseFloat(match?.[3] || 0),
                    framework: match?.[2] || 'CIS',
                  }
                })}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="score" name="Score" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-text">Run audits to see scores here</div>
              </div>
            )}
          </div>

          {/* Risk Distribution */}
          <div className="chart-card">
            <div className="chart-card-title">Risk Distribution</div>
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {riskData.map((entry, idx) => {
                      const colorIdx = RISK_LABELS.indexOf(entry.name)
                      return <Cell key={idx} fill={RISK_COLORS[colorIdx >= 0 ? colorIdx : 4]} />
                    })}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(val) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-text">No risk data yet</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Activity</span>
        </div>
        {stats?.recent_activity?.length > 0 ? (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_activity.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge ${a.type === 'upload' ? 'badge-accent' : 'badge-pass'}`}>
                        {a.type === 'upload' ? <Upload size={10} /> : <ShieldCheck size={10} />}
                        {a.type}
                      </span>
                    </td>
                    <td>{a.description}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/devices/${a.device_id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon"><Server size={32} /></div>
            <div className="empty-state-title">No Activity Yet</div>
            <div className="empty-state-text">Upload a config file to get started</div>
            <button className="btn btn-primary" onClick={() => navigate('/upload')}>
              <Upload size={16} /> Upload Config
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
