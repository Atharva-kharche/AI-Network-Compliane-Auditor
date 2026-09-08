import { useState, useEffect } from 'react'
import { FileText, Download, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { listReports, generateReport, getReportDownloadUrl } from '../services/api'

export default function ReportViewer() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState(null)

  const loadReports = async () => {
    try {
      const data = await listReports()
      setReports(data)
    } catch { /* empty */ }
    setLoading(false)
  }

  useEffect(() => { loadReports() }, [])

  const handleGeneratePdf = async (report) => {
    setGeneratingId(report.id)
    try {
      const updated = await generateReport(report.device_id, report.framework)
      toast.success('PDF report generated')
      window.open(getReportDownloadUrl(updated.id), '_blank')
      await loadReports()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Report generation failed')
    }
    setGeneratingId(null)
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading audit reports…</span>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audit Reports</h1>
        <p className="page-subtitle">
          Generated compliance assessment reports available for download
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="panel">
          <div className="empty-state" style={{ padding: '60px 32px' }}>
            <div className="empty-state-title" style={{ marginBottom: 16, fontSize: 13, letterSpacing: '0.5px' }}>NO REPORTS GENERATED</div>
            <div className="empty-state-text">
              Completed compliance assessments will appear here. Run an audit to generate a PDF report.
            </div>
          </div>
        </div>
      ) : (() => {
        const totalReports = reports.length;
        const avgScore = totalReports > 0 ? (reports.reduce((acc, r) => acc + r.compliance_score, 0) / totalReports).toFixed(1) : 0;
        const bestScore = totalReports > 0 ? Math.max(...reports.map(r => r.compliance_score)) : 0;
        const needsAttention = reports.filter(r => r.compliance_score < 80).length;

        return (
          <>
            <div className="panel mb-24" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Total Reports</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{totalReports}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Average Score</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: avgScore >= 80 ? 'var(--color-pass)' : avgScore >= 50 ? 'var(--color-warning)' : 'var(--color-fail)' }}>{avgScore}%</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Best Score</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-pass)' }}>{bestScore}%</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Needs Attention</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: needsAttention > 0 ? 'var(--color-warning)' : 'var(--color-pass)' }}>{needsAttention}</div>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Device</th>
                <th>Framework</th>
                <th>Score</th>
                <th>Results</th>
                <th>Generated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const scoreColor =
                  r.compliance_score >= 80 ? 'var(--color-pass)' :
                  r.compliance_score >= 50 ? 'var(--color-warning)' :
                  'var(--color-fail)'
                const isGenerating = generatingId === r.id

                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>#{r.id}</td>
                    <td>
                      <span style={{ color: 'var(--accent-light)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {r.device_hostname || `Device #${r.device_id}`}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{r.framework}</span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-4">
                        <span style={{ color: scoreColor, fontWeight: 700, fontSize: 15, fontFeatureSettings: "'tnum'" }}>
                          {r.compliance_score}%
                        </span>
                        <span className={`badge ${r.compliance_score >= 80 ? 'badge-pass' : r.compliance_score >= 50 ? 'badge-warning' : 'badge-fail'}`} style={{ width: 'fit-content', fontSize: 9 }}>
                          {r.compliance_score >= 80 ? 'PASS' : r.compliance_score >= 50 ? 'ATTENTION' : 'FAIL'}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--color-pass)' }}>{r.passed}</span>
                      <span style={{ color: 'var(--text-muted)' }}> / </span>
                      <span style={{ color: 'var(--color-fail)' }}>{r.failed}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>
                        of {r.total_rules}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(r.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td>
                      {r.pdf_path ? (
                        <a
                          href={getReportDownloadUrl(r.id)}
                          className="btn btn-primary btn-sm"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download size={12} /> Download
                        </a>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleGeneratePdf(r)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <><div className="spinner" /> Generating…</>
                          ) : (
                            <><FileText size={12} /> Generate PDF</>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
              </table>
            </div>
          </>
        )
      })()}
    </div>
  )
}
