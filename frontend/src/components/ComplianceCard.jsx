import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { StatusBadge, SeverityBadge } from './StatusBadge'

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
    <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy} title="Copy">
      {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
    </button>
  )
}

export default function ComplianceCard({ result, vendor }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <tr
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <td style={{ width: 28 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, transition: 'transform 0.15s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
        </td>
        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{result.rule_id}</td>
        <td>{result.rule_name}</td>
        <td><StatusBadge status={result.status} /></td>
        <td><SeverityBadge severity={result.severity} /></td>
        <td><span className="badge badge-neutral">{result.category}</span></td>
      </tr>

      {expanded && (
        <tr className="expandable-row-detail">
          <td colSpan={6} style={{ padding: 0 }}>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Expected Value</label>
                <code>{result.expected_value || 'N/A'}</code>
              </div>
              <div className="detail-item">
                <label>Actual Value</label>
                <code>{result.actual_value || 'not configured'}</code>
              </div>
              {result.remediation && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <label>Remediation</label>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <code style={{ flex: 1 }}>{result.remediation}</code>
                    <CopyButton text={result.remediation} />
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </div>
  )
}

/**
 * ComplianceTable — renders a full table of compliance results with expandable rows.
 */
export function ComplianceTable({ results, vendor }) {
  const [expandedRow, setExpandedRow] = useState(null)

  if (!results?.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No Results</div>
        <div className="empty-state-text">
          Run a compliance assessment to see results here.
        </div>
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
            <>
              <tr
                key={r.rule_id + '-' + i}
                onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, transition: 'transform 0.15s', display: 'inline-block', transform: expandedRow === i ? 'rotate(90deg)' : 'none' }}>▶</span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.rule_id}</td>
                <td>{r.rule_name}</td>
                <td><StatusBadge status={r.status} /></td>
                <td><SeverityBadge severity={r.severity} /></td>
                <td><span className="badge badge-neutral">{r.category}</span></td>
              </tr>
              {expandedRow === i && (
                <tr key={r.rule_id + '-detail-' + i} className="expandable-row-detail">
                  <td colSpan={6} style={{ padding: 0 }}>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <label>Expected Value</label>
                        <code>{r.expected_value || 'N/A'}</code>
                      </div>
                      <div className="detail-item">
                        <label>Actual Value</label>
                        <code>{r.actual_value || 'not configured'}</code>
                      </div>
                      {r.remediation && (
                        <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
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
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
