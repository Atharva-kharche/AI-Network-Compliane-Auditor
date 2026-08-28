import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { StatusBadge, SeverityBadge } from './StatusBadge'

export default function ComplianceCard({ result, vendor }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <tr
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <td style={{ width: 28 }}>
          {expanded
            ? <ChevronDown size={14} color="var(--text-tertiary)" />
            : <ChevronRight size={14} color="var(--text-tertiary)" />
          }
        </td>
        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{result.rule_id}</td>
        <td>{result.rule_name}</td>
        <td><StatusBadge status={result.status} /></td>
        <td><SeverityBadge severity={result.severity} /></td>
        <td><span className="badge badge-accent">{result.category}</span></td>
      </tr>

      {expanded && (
        <tr className="expandable-row-detail">
          <td colSpan={6} style={{ padding: 0 }}>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Actual Value</label>
                <code>{result.actual_value || 'not configured'}</code>
              </div>
              <div className="detail-item">
                <label>Expected Value</label>
                <code>{result.expected_value || 'N/A'}</code>
              </div>
              {result.remediation && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <label>Remediation</label>
                  <code>{result.remediation}</code>
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
        <div className="empty-state-title">No Results Yet</div>
        <div className="empty-state-text">
          Run a compliance audit to see results here.
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
            <th>Rule Name</th>
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
                  {expandedRow === i
                    ? <ChevronDown size={14} color="var(--text-tertiary)" />
                    : <ChevronRight size={14} color="var(--text-tertiary)" />
                  }
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.rule_id}</td>
                <td>{r.rule_name}</td>
                <td><StatusBadge status={r.status} /></td>
                <td><SeverityBadge severity={r.severity} /></td>
                <td><span className="badge badge-accent">{r.category}</span></td>
              </tr>
              {expandedRow === i && (
                <tr key={r.rule_id + '-detail-' + i} className="expandable-row-detail">
                  <td colSpan={6} style={{ padding: 0 }}>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <label>Actual Value</label>
                        <code>{r.actual_value || 'not configured'}</code>
                      </div>
                      <div className="detail-item">
                        <label>Expected Value</label>
                        <code>{r.expected_value || 'N/A'}</code>
                      </div>
                      {r.remediation && (
                        <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                          <label>Remediation</label>
                          <code>{r.remediation}</code>
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
