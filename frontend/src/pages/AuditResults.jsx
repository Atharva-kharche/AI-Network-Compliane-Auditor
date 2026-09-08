import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, RefreshCw, Play, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import ScoreGauge from '../components/ScoreGauge'
import { StatusBadge, SeverityBadge } from '../components/StatusBadge'
import {
  getDevice,
  getAuditResults,
  getAuditSummary,
  triggerAudit,
  generateReport,
  getReportDownloadUrl,
} from '../services/api'
import { formatDeviceName, isUnassessed } from '../utils'

const FRAMEWORKS = ['CIS', 'NIST', 'STIG']

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* empty */ }
  }
  return (
    <button
      className={`copy-btn${copied ? ' copied' : ''}`}
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
    </button>
  )
}

function FindingsTable({ results }) {
  const [expandedRow, setExpandedRow] = useState(null)

  if (!results?.length) {
    return (
      <div className="empty-state" style={{ padding: 48 }}>
        <div className="empty-state-title">NO SECURITY FINDINGS</div>
        <div className="empty-state-text">Run a compliance assessment to evaluate against the framework.</div>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 28 }}></th>
            <th>Rule ID</th>
            <th>Control</th>
            <th>Status</th>
            <th>Severity</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={r.rule_id + '-' + i} style={{ cursor: 'pointer' }}>
              <td
                colSpan={6}
                style={{ padding: 0, border: 'none' }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr
                      onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                      style={{ cursor: 'pointer' }}
                      className={expandedRow === i ? '' : ''}
                    >
                      <td style={{ width: 28, padding: '10px 14px', borderBottom: expandedRow === i ? 'none' : '1px solid var(--border-secondary)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 10, transition: 'transform 0.15s', display: 'inline-block', transform: expandedRow === i ? 'rotate(90deg)' : 'none' }}>▶</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '10px 14px', borderBottom: expandedRow === i ? 'none' : '1px solid var(--border-secondary)' }}>{r.rule_id}</td>
                      <td style={{ padding: '10px 14px', borderBottom: expandedRow === i ? 'none' : '1px solid var(--border-secondary)', fontSize: 13 }}>{r.rule_name}</td>
                      <td style={{ padding: '10px 14px', borderBottom: expandedRow === i ? 'none' : '1px solid var(--border-secondary)' }}><StatusBadge status={r.status} /></td>
                      <td style={{ padding: '10px 14px', borderBottom: expandedRow === i ? 'none' : '1px solid var(--border-secondary)' }}><SeverityBadge severity={r.severity} /></td>
                      <td style={{ padding: '10px 14px', borderBottom: expandedRow === i ? 'none' : '1px solid var(--border-secondary)' }}><span className="badge badge-neutral">{r.category}</span></td>
                    </tr>
                    {expandedRow === i && (
                      <tr className="expandable-row-detail">
                        <td colSpan={6} style={{ padding: 0, borderBottom: '1px solid var(--border-secondary)' }}>
                          <div className="detail-grid" style={{ gridTemplateColumns: r.remediation ? '1fr 1fr 1fr' : '1fr 1fr' }}>
                            <div className="detail-item">
                              <label>Expected Value</label>
                              <code>{r.expected_value || 'N/A'}</code>
                            </div>
                            <div className="detail-item">
                              <label>Actual Value</label>
                              <code>{r.actual_value || 'not configured'}</code>
                            </div>
                            {r.remediation && (
                              <div className="detail-item">
                                <label>Remediation</label>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                  <code style={{ flex: 1 }}>{r.remediation}</code>
                                  <CopyButton text={r.remediation} />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AuditResults() {
  const { deviceId } = useParams()
  const navigate = useNavigate()
  const [device, setDevice] = useState(null)
  const [results, setResults] = useState([])
  const [summary, setSummary] = useState(null)
  const [framework, setFramework] = useState('CIS')
  const [loading, setLoading] = useState(true)
  const [auditing, setAuditing] = useState(false)
  const [generating, setGenerating] = useState(false)

  const loadData = async (fw) => {
    setLoading(true)
    try {
      const dev = await getDevice(deviceId)
      setDevice(dev)
      try {
        const [res, sum] = await Promise.all([
          getAuditResults(deviceId, fw),
          getAuditSummary(deviceId, fw),
        ])
        setResults(res)
        setSummary(sum)
      } catch {
        setResults([])
        setSummary(null)
      }
    } catch {
      toast.error('Failed to load device data')
    }
    setLoading(false)
  }

  useEffect(() => { loadData(framework) }, [deviceId, framework])

  const handleRunAudit = async () => {
    setAuditing(true)
    try {
      await triggerAudit(Number(deviceId), framework)
      toast.success(`${framework} assessment complete`)
      await loadData(framework)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Assessment failed')
    }
    setAuditing(false)
  }

  const handleGenerateReport = async () => {
    setGenerating(true)
    try {
      const report = await generateReport(Number(deviceId), framework)
      toast.success('PDF report generated')
      window.open(getReportDownloadUrl(report.id), '_blank')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Report generation failed')
    }
    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading assessment results…</span>
        <span className="loading-message">Retrieving compliance data from audit engine</span>
      </div>
    )
  }

  // Count findings by status
  const failCount = results.filter(r => r.status === 'fail').length
  const passCount = results.filter(r => r.status === 'pass').length
  const warnCount = results.filter(r => r.status === 'warning').length
  const naCount = results.filter(r => r.status === 'not_applicable').length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Compliance Assessment</h1>
            <p className="page-subtitle">
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatDeviceName(device)}</span>
              {' — '}
              <span style={{ textTransform: 'capitalize' }}>{device?.vendor}</span>
              {' '}{device?.model}
            </p>
          </div>
          <div className="flex gap-8">
            <button
              className="btn btn-primary"
              onClick={handleRunAudit}
              disabled={auditing}
            >
              {auditing ? <><div className="spinner" /> Running…</> : <><Play size={14} /> Run Audit</>}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleGenerateReport}
              disabled={generating || !results.length}
            >
              {generating ? <><div className="spinner" /> Generating…</> : <><FileText size={14} /> Generate PDF</>}
            </button>
          </div>
        </div>
      </div>

      {/* Device summary bar */}
      {device && (
        <div className="panel mb-20">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
            {[
              ['Hostname', formatDeviceName(device), true],
              ['Vendor', device.vendor, false],
              ['Model', device.model, false],
              ['OS', device.os_version, true],
              ['Type', device.device_type, false],
              ['Serial', device.serial_number, true],
            ].map(([label, val, mono]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                  textTransform: label === 'Vendor' || label === 'Type' ? 'capitalize' : 'none',
                  fontFamily: mono ? 'var(--font-mono)' : 'inherit',
                  fontSize: mono ? 12 : 13,
                }}>
                  {val || 'Unknown'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Framework Tabs */}
      <div className="tabs">
        {FRAMEWORKS.map((fw) => (
          <button
            key={fw}
            className={`tab${framework === fw ? ' active' : ''}`}
            onClick={() => setFramework(fw)}
          >
            {fw}
          </button>
        ))}
      </div>

      {/* Score + Results */}
      {summary ? (() => {
        const unassessed = isUnassessed(summary.compliance_score, device.vendor, passCount, failCount)
        return (
        <>
          {/* Score overview strip */}
          <div className="panel mb-20" style={{ borderTop: `4px solid ${unassessed ? 'var(--color-warning)' : summary.compliance_score >= 80 ? 'var(--color-pass)' : summary.compliance_score >= 50 ? 'var(--color-warning)' : 'var(--color-fail)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 }}>
              
              <div style={{ flex: '1 1 auto' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                  AUDIT COMPLETE
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {formatDeviceName(device)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ textTransform: 'capitalize' }}>{device.vendor}</span> {device.os_version} · {framework} Framework
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 32, paddingLeft: 32, borderLeft: '1px solid var(--border-primary)' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                    {unassessed ? 'ASSESSMENT STATUS' : 'COMPLIANCE SCORE'}
                  </div>
                  <div style={{ fontSize: unassessed ? 28 : 36, fontWeight: 800, lineHeight: 1, fontFeatureSettings: "'tnum'", color: unassessed ? 'var(--text-muted)' : summary.compliance_score >= 80 ? 'var(--color-pass)' : summary.compliance_score >= 50 ? 'var(--color-warning)' : 'var(--color-fail)' }}>
                    {unassessed ? 'UNASSESSED' : `${summary.compliance_score}%`}
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    {unassessed ? 'ACTION REQUIRED' : 'STATUS'}
                  </div>
                  <div className={`badge ${unassessed ? 'badge-warning' : summary.compliance_score >= 80 ? 'badge-pass' : summary.compliance_score >= 50 ? 'badge-warning' : 'badge-fail'}`} style={{ fontSize: 12, padding: '4px 10px', cursor: unassessed ? 'pointer' : 'default' }} onClick={() => unassessed && navigate('/training')}>
                    {unassessed ? 'AI TRAINING REQUIRED' : summary.compliance_score >= 80 ? 'PASSED' : summary.compliance_score >= 50 ? 'NEEDS ATTENTION' : 'FAILED'}
                  </div>
                  {unassessed && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 500 }}>(Numeric Score: 0%)</div>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingLeft: 32, borderLeft: '1px solid var(--border-primary)', opacity: unassessed ? 0.5 : 1 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 8 }}>
                    {summary.total_rules} CONTROLS
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-pass)' }}>
                      <span>{passCount}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>PASS</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-fail)' }}>
                      <span>{failCount}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>FAIL</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, marginTop: 32 }}>
            Security Findings
          </div>

          {/* Findings table */}
          <FindingsTable results={results} />
        </>
        )
      })() : (
        <div className="panel">
          <div className="empty-state" style={{ padding: 60 }}>
            <div className="empty-state-icon"><RefreshCw size={20} /></div>
            <div className="empty-state-title">No {framework} Assessment Data</div>
            <div className="empty-state-text">
              Run a {framework} compliance assessment to evaluate this device against security controls.
            </div>
            <button className="btn btn-primary" onClick={handleRunAudit} disabled={auditing}>
              <Play size={14} /> Run {framework} Assessment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
