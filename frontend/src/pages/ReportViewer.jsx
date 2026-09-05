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
      toast.success('PDF report generated!')
      // Trigger download
      window.open(getReportDownloadUrl(updated.id), '_blank')
      // Refresh reports list to update pdf_path
      await loadReports()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Report generation failed')
    }
    setGeneratingId(null)
  }

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /> Loading reports…</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">
          View and download generated compliance audit reports
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 80 }}>
            <div className="empty-state-icon"><FileText size={32} /></div>
            <div className="empty-state-title">No Reports Yet</div>
            <div className="empty-state-text">
              Run a compliance audit and generate a PDF report to see it here.
            </div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Device</th>
                <th>Framework</th>
                <th>Score</th>
                <th>Passed / Failed</th>
                <th>Generated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const scoreColor =
                  r.compliance_score >= 80 ? 'var(--color-success)' :
                  r.compliance_score >= 50 ? 'var(--color-warning)' :
                  'var(--color-danger)'
                const isGenerating = generatingId === r.id

                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>#{r.id}</td>
                    <td>
                      <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
                        {r.device_hostname || `Device #${r.device_id}`}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-accent">{r.framework}</span>
                    </td>
                    <td>
                      <span style={{ color: scoreColor, fontWeight: 700, fontSize: 16 }}>
                        {r.compliance_score}%
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--color-success)' }}>{r.passed}</span>
                      {' / '}
                      <span style={{ color: 'var(--color-danger)' }}>{r.failed}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}> ({r.total_rules} total)</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
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
                          <Download size={14} /> Download PDF
                        </a>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleGeneratePdf(r)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <><RefreshCw size={14} className="spin" /> Generating…</>
                          ) : (
                            <><FileText size={14} /> Generate PDF</>
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
      )}
    </div>
  )
}
