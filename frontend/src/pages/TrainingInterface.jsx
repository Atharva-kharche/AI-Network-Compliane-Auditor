import { useState, useEffect } from 'react'
import {
  Brain, Check, X, ChevronRight, Sparkles, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getPendingTraining, submitMapping, getAllMappings, deleteMapping,
} from '../services/api'

const CATEGORIES = [
  'authentication', 'remote_access', 'encryption', 'logging',
  'services', 'access_control', 'ntp', 'snmp', 'banners',
]

export default function TrainingInterface() {
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ category: '', key: '', value: '' })

  const loadData = async () => {
    setLoading(true)
    try {
      const [p, m] = await Promise.all([getPendingTraining(), getAllMappings()])
      setPending(p)
      setMappings(m)
    } catch { /* empty */ }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleAcceptSuggestion = (item) => {
    let suggestion = {}
    try { suggestion = JSON.parse(item.ai_suggestion || '{}') } catch { /* empty */ }
    setEditingId(item.id)
    setFormData({
      category: suggestion.best_guess_key?.split('.')[0] || 'authentication',
      key: suggestion.best_guess_key || '',
      value: suggestion.best_guess_value || '',
    })
  }

  const handleSubmitMapping = async (mappingId) => {
    if (!formData.category || !formData.key || !formData.value) {
      toast.error('All fields are required')
      return
    }
    try {
      await submitMapping(mappingId, formData.category, formData.key, formData.value)
      toast.success('Mapping saved!')
      setEditingId(null)
      setFormData({ category: '', key: '', value: '' })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save mapping')
    }
  }

  const handleDeleteMapping = async (id) => {
    try {
      await deleteMapping(id)
      toast.success('Mapping deleted')
      loadData()
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /> Loading training data…</div>
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">AI Training Interface</h1>
            <p className="page-subtitle">
              Map unrecognized config commands to help the AI learn new vendor patterns
            </p>
          </div>
          <div className="flex gap-12 items-center">
            {pending.length > 0 && (
              <span className="badge badge-warning">
                {pending.length} pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
          Pending Queue ({pending.length})
        </button>
        <button className={`tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          Verified Mappings ({mappings.filter(m => m.is_verified).length})
        </button>
      </div>

      {/* Pending Queue */}
      {tab === 'pending' && (
        pending.length === 0 ? (
          <div className="card">
            <div className="empty-state" style={{ padding: 60 }}>
              <div className="empty-state-icon"><Brain size={32} /></div>
              <div className="empty-state-title">All Caught Up!</div>
              <div className="empty-state-text">
                No unrecognized config commands to review. Upload configs from unknown vendors to see items here.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-col gap-16">
            {pending.map((item) => (
              <div key={item.id} className="card">
                <div className="flex items-center justify-between mb-16">
                  <div className="flex items-center gap-12">
                    <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                      {item.vendor}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      ID #{item.id}
                    </span>
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleAcceptSuggestion(item)}
                  >
                    <Sparkles size={14} /> Accept AI Suggestion
                  </button>
                </div>

                {/* Raw command */}
                <div className="mb-16">
                  <label className="form-label">Raw Config Command</label>
                  <code style={{
                    display: 'block',
                    padding: '12px 16px',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    color: 'var(--color-warning)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {item.raw_command}
                  </code>
                </div>

                {/* AI Suggestion preview */}
                {item.ai_suggestion && (
                  <div className="mb-16">
                    <label className="form-label">AI Suggestion</label>
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--accent-bg)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      color: 'var(--accent-light)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {item.ai_suggestion}
                    </div>
                  </div>
                )}

                {/* Mapping form */}
                {editingId === item.id && (
                  <div style={{
                    padding: 20,
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-accent)',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Security Category</label>
                        <select
                          className="form-select"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
                          <option value="">Select…</option>
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Normalized Key</label>
                        <input
                          className="form-input"
                          placeholder="e.g. remote_access.ssh_version"
                          value={formData.key}
                          onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Value</label>
                        <input
                          className="form-input"
                          placeholder="e.g. 2"
                          value={formData.value}
                          onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-12 mt-16" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                        <X size={14} /> Cancel
                      </button>
                      <button className="btn btn-success btn-sm" onClick={() => handleSubmitMapping(item.id)}>
                        <Check size={14} /> Save Mapping
                      </button>
                    </div>
                  </div>
                )}

                {editingId !== item.id && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditingId(item.id)
                      setFormData({ category: '', key: '', value: '' })
                    }}
                  >
                    <ChevronRight size={14} /> Map Manually
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Raw Command</th>
                <th>Category</th>
                <th>Key → Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr><td colSpan={6} className="text-center" style={{ padding: 40, color: 'var(--text-tertiary)' }}>No mappings yet</td></tr>
              ) : (
                mappings.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                        {m.vendor}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, maxWidth: 300 }} className="truncate">
                      {m.raw_command}
                    </td>
                    <td>{m.security_category || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {m.normalized_key ? `${m.normalized_key} = ${m.normalized_value}` : '—'}
                    </td>
                    <td>
                      <span className={`badge ${m.is_verified ? 'badge-pass' : 'badge-warning'}`}>
                        {m.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteMapping(m.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
