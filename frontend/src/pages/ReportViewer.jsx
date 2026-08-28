import { useState, useEffect } from 'react'
import { FileText, Download, Server } from 'lucide-react'
import { listReports, getReportDownloadUrl } from '../services/api'

export default function ReportViewer() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await listReports()
        setReports(data)
      } catch { /* empty */ }
      setLoading(false)
    }
    load()
  }, [])

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

                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>#{r.id}</td>
                    <td>
                      <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
                        Device #{r.device_id}
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
                      {new Date(r.generated_at).toLocaleString()}
                    </td>
                    <td>
                      {r.pdf_path ? (
                        <a
                          href={getReportDownloadUrl(r.id)}
                          className="btn btn-primary btn-sm"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download size={14} /> Download
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No PDF</span>
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
