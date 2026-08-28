import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, RefreshCw, Download, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import ScoreGauge from '../components/ScoreGauge'
import { ComplianceTable } from '../components/ComplianceCard'
import {
  getDevice,
  getAuditResults,
  getAuditSummary,
  triggerAudit,
  generateReport,
  getReportDownloadUrl,
} from '../services/api'

const FRAMEWORKS = ['CIS', 'NIST', 'STIG']

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
      toast.success(`${framework} audit complete!`)
      await loadData(framework)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Audit failed')
    }
    setAuditing(false)
  }

  const handleGenerateReport = async () => {
    setGenerating(true)
    try {
      const report = await generateReport(Number(deviceId), framework)
      toast.success('PDF report generated!')
      // Trigger download
      window.open(getReportDownloadUrl(report.id), '_blank')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Report generation failed')
    }
    setGenerating(false)
  }

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /> Loading audit results…</div>
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Audit Results</h1>
            <p className="page-subtitle">
              {device?.hostname} — {device?.vendor} {device?.model}
            </p>
          </div>
          <div className="flex gap-12">
            <button
              className="btn btn-primary"
              onClick={handleRunAudit}
              disabled={auditing}
            >
              {auditing ? <><div className="spinner" /> Running…</> : <><Play size={16} /> Run Audit</>}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleGenerateReport}
              disabled={generating || !results.length}
            >
              {generating ? <><div className="spinner" /> Generating…</> : <><FileText size={16} /> Generate PDF</>}
            </button>
          </div>
        </div>
      </div>

      {/* Device Info Bar */}
      {device && (
        <div className="card mb-24">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
            {[
              ['Hostname', device.hostname],
              ['Vendor', device.vendor],
              ['Model', device.model],
              ['OS', device.os_version],
              ['Type', device.device_type],
              ['Serial', device.serial_number],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
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
      {summary ? (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <ScoreGauge score={summary.compliance_score} size={150} label={`${framework} Score`} />
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {summary.passed} passed · {summary.failed} failed
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {summary.warnings} warnings · {summary.total_rules} total
              </div>
            </div>
          </div>

          <ComplianceTable results={results} vendor={device?.vendor} />
        </div>
      ) : (
        <div className="card">
          <div className="empty-state" style={{ padding: 60 }}>
            <div className="empty-state-icon"><RefreshCw size={32} /></div>
            <div className="empty-state-title">No {framework} Audit Results</div>
            <div className="empty-state-text">
              Click "Run Audit" to perform a {framework} compliance check on this device.
            </div>
            <button className="btn btn-primary" onClick={handleRunAudit} disabled={auditing}>
              <Play size={16} /> Run {framework} Audit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
