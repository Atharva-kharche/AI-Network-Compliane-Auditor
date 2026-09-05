import { useState, useEffect } from 'react'
import {
  Brain, Check, X, ChevronRight, Sparkles, Trash2, RefreshCw, ShieldCheck, ArrowRight, Zap, CheckCircle2, Play, Info, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getPendingTraining, submitMapping, getAllMappings, deleteMapping, reAuditDevice, listDevices, loadDemoUnknownConfig
} from '../services/api'

const CATEGORIES = [
  'authentication', 'remote_access', 'encryption', 'logging',
  'services', 'access_control', 'ntp', 'snmp', 'banners',
]

const SCHEMA_KEY_PRESETS = {
  remote_access: [
    { key: 'remote_access.ssh_version', label: 'SSH Version (e.g. 2)', defaultVal: '2' },
    { key: 'remote_access.telnet_enabled', label: 'Telnet Enabled (true/false)', defaultVal: 'false' },
    { key: 'remote_access.ssh_timeout', label: 'SSH Timeout in seconds', defaultVal: '900' },
    { key: 'remote_access.vty_acl_applied', label: 'Management ACL Applied (true/false)', defaultVal: 'true' },
  ],
  authentication: [
    { key: 'authentication.password_min_length', label: 'Min Password Length', defaultVal: '14' },
    { key: 'authentication.login_attempts_limit', label: 'Login Attempt Limit', defaultVal: '3' },
    { key: 'authentication.aaa_enabled', label: 'AAA Enabled (true/false)', defaultVal: 'true' },
    { key: 'authentication.enable_secret_encrypted', label: 'Secret Encrypted (true/false)', defaultVal: 'true' },
  ],
  encryption: [
    { key: 'encryption.password_encryption_service', label: 'Password Encryption Service (true/false)', defaultVal: 'true' },
    { key: 'encryption.tls_version', label: 'TLS Version (e.g. 1.2 or 1.3)', defaultVal: '1.2' },
  ],
  logging: [
    { key: 'logging.logging_enabled', label: 'Syslog Logging Enabled (true/false)', defaultVal: 'true' },
    { key: 'logging.log_destination', label: 'Syslog Destination IP', defaultVal: '192.168.10.50' },
    { key: 'logging.log_severity_level', label: 'Severity Level (e.g. informational)', defaultVal: 'informational' },
    { key: 'logging.log_timestamps', label: 'Log Timestamps (true/false)', defaultVal: 'true' },
  ],
  services: [
    { key: 'services.cdp_enabled', label: 'CDP Enabled (true/false)', defaultVal: 'false' },
    { key: 'services.http_server_enabled', label: 'HTTP Server Enabled (true/false)', defaultVal: 'false' },
    { key: 'services.source_routing_disabled', label: 'Source Routing Disabled (true/false)', defaultVal: 'true' },
    { key: 'services.finger_service_disabled', label: 'Finger Service Disabled (true/false)', defaultVal: 'true' },
  ],
  access_control: [
    { key: 'access_control.unused_ports_shutdown', label: 'Unused Ports Shutdown (true/false)', defaultVal: 'true' },
  ],
  ntp: [
    { key: 'ntp.ntp_authentication', label: 'NTP Authentication (true/false)', defaultVal: 'true' },
    { key: 'ntp.ntp_servers', label: 'NTP Servers (comma separated)', defaultVal: '192.168.10.100' },
  ],
  snmp: [
    { key: 'snmp.snmp_version', label: 'SNMP Version (e.g. 3)', defaultVal: '3' },
    { key: 'snmp.community_string_default', label: 'Default Community String Used (true/false)', defaultVal: 'false' },
  ],
  banners: [
    { key: 'banners.login_banner_set', label: 'Login Banner Set (true/false)', defaultVal: 'true' },
    { key: 'banners.motd_banner_set', label: 'MOTD Banner Set (true/false)', defaultVal: 'true' },
  ],
}

export default function TrainingInterface() {
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [mappings, setMappings] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [demoLoading, setDemoLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ category: '', key: '', value: '' })
  const [reAuditing, setReAuditing] = useState({})
  const [auditResultNotification, setAuditResultNotification] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [p, m, d] = await Promise.all([
        getPendingTraining(),
        getAllMappings(),
        listDevices(),
      ])
      setPending(p)
      setMappings(m)
      setDevices(d)
    } catch { /* empty */ }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleLoadDemoConfig = async () => {
    setDemoLoading(true)
    try {
      const res = await loadDemoUnknownConfig()
      toast.success(res.message || 'Demo unknown configuration loaded successfully!')
      await loadData()
      setTab('pending')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load demo configuration')
    } finally {
      setDemoLoading(false)
    }
  }

  const handleAcceptSuggestion = (item) => {
    let suggestion = {}
    try {
      suggestion = JSON.parse(item.ai_suggestion || '{}')
    } catch { /* empty */ }

    const key = suggestion.best_guess_key || item.normalized_key || ''
    const cat = suggestion.category || item.security_category || key.split('.')[0] || 'remote_access'
    const val = suggestion.best_guess_value !== undefined ? String(suggestion.best_guess_value) : (item.normalized_value || '')

    setEditingId(item.id)
    setFormData({
      category: cat,
      key: key,
      value: val,
    })
  }

  const handleCategoryChange = (cat) => {
    const presets = SCHEMA_KEY_PRESETS[cat]
    const defaultPreset = presets && presets.length > 0 ? presets[0] : null
    setFormData({
      ...formData,
      category: cat,
      key: defaultPreset ? defaultPreset.key : (cat ? `${cat}.` : ''),
      value: defaultPreset ? defaultPreset.defaultVal : formData.value,
    })
  }

  const handlePresetSelect = (presetKey) => {
    const presets = SCHEMA_KEY_PRESETS[formData.category] || []
    const match = presets.find(p => p.key === presetKey)
    setFormData({
      ...formData,
      key: presetKey,
      value: match ? match.defaultVal : formData.value,
    })
  }

  const handleSubmitMapping = async (mappingId) => {
    if (!formData.category || !formData.key || !formData.value) {
      toast.error('All fields are required')
      return
    }
    try {
      await submitMapping(mappingId, formData.category, formData.key, formData.value)
      toast.success('Mapping learned and saved as Verified!')
      setEditingId(null)
      setFormData({ category: '', key: '', value: '' })
      await loadData()
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

  const handleReAudit = async (device) => {
    setReAuditing(prev => ({ ...prev, [device.id]: true }))
    try {
      const res = await reAuditDevice(device.id, 'CIS')
      toast.success(res.message || 'Device re-audited successfully!')
      setAuditResultNotification({
        hostname: device.hostname,
        vendor: device.vendor,
        score: res.compliance_score,
        previousScore: res.previous_score,
        scoreImprovement: res.score_improvement,
        passed: res.passed,
        failed: res.failed,
        total: res.total_rules,
        passedRules: res.passed_rules || [],
        failedRules: res.failed_rules || [],
        appliedMappingsCount: res.applied_mappings_count || 0,
      })
      await loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Re-audit failed')
    } finally {
      setReAuditing(prev => ({ ...prev, [device.id]: false }))
    }
  }

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /> Loading training data…</div>
  }

  const verifiedMappings = mappings.filter(m => m.is_verified)
  const currentPresets = formData.category ? (SCHEMA_KEY_PRESETS[formData.category] || []) : []

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">AI Training & Knowledge Base</h1>
            <p className="page-subtitle">
              Teach the AI engine new vendor CLI commands through human-in-the-loop verification
            </p>
          </div>
          <div className="flex gap-12 items-center">
            {pending.length > 0 ? (
              <span className="badge badge-warning flex items-center gap-6" style={{ padding: '6px 12px', fontSize: 13 }}>
                <Brain size={15} /> {pending.length} Unrecognized Commands
              </span>
            ) : (
              <span className="badge badge-pass flex items-center gap-6" style={{ padding: '6px 12px', fontSize: 13 }}>
                <CheckCircle2 size={15} /> All Commands Normalized
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Workflow Explainer & Demo Trigger */}
      <div className="card mb-20" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))',
        borderColor: 'rgba(99, 102, 241, 0.25)',
      }}>
        <div className="flex items-center justify-between flex-wrap gap-16">
          <div>
            <div className="flex items-center gap-8 mb-6">
              <span className="badge badge-accent" style={{ fontSize: 12, padding: '3px 8px' }}>
                <Zap size={13} style={{ display: 'inline', marginRight: 4 }} />
                End-to-End Workflow Demo
              </span>
              <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                Human-in-the-Loop AI Training
              </strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 750 }}>
              Unknown Vendor/Command ➔ AI detects unknown syntax ➔ Queues in Training Queue ➔ Admin maps command ➔ System remembers verified mapping ➔ Re-audit recognizes command.
            </div>
          </div>
          <button
            className="btn btn-primary flex items-center gap-8"
            disabled={demoLoading}
            onClick={handleLoadDemoConfig}
          >
            {demoLoading ? <RefreshCw size={15} className="spinner" /> : <Play size={15} />}
            <span>Load Demo Unknown Config (QuantumGuard OS)</span>
          </button>
        </div>
      </div>

      {/* Re-audit Result Banner & Before/After Comparison */}
      {auditResultNotification && (
        <div className="card mb-20" style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(59, 130, 246, 0.12))',
          borderColor: 'rgba(16, 185, 129, 0.4)',
        }}>
          <div className="flex items-start justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div className="flex items-start gap-16">
              <div style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-pass)',
                marginTop: 2,
                flexShrink: 0,
              }}>
                <ShieldCheck size={28} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
                  Re-Audit Complete for {auditResultNotification.hostname} ({auditResultNotification.vendor})
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Applied <strong>{auditResultNotification.appliedMappingsCount} verified training mappings</strong> during normalization!
                </div>

                <div className="flex items-center gap-16 mt-12 flex-wrap">
                  <div style={{
                    padding: '8px 14px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block' }}>Compliance Score</span>
                    <div className="flex items-center gap-8 mt-2">
                      {auditResultNotification.previousScore !== undefined && auditResultNotification.previousScore !== auditResultNotification.score ? (
                        <>
                          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
                            {auditResultNotification.previousScore}%
                          </span>
                          <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                        </>
                      ) : null}
                      <span style={{ color: 'var(--color-pass)', fontWeight: 700, fontSize: 18 }}>
                        {auditResultNotification.score}%
                      </span>
                      {auditResultNotification.scoreImprovement > 0 && (
                        <span className="badge badge-pass" style={{ fontSize: 11, padding: '2px 6px' }}>
                          +{auditResultNotification.scoreImprovement}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{
                    padding: '8px 14px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block' }}>Rule Verification</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                      {auditResultNotification.passed} passed / {auditResultNotification.failed} failed ({auditResultNotification.total} total)
                    </span>
                  </div>
                </div>

                {auditResultNotification.passedRules && auditResultNotification.passedRules.length > 0 && (
                  <div className="mt-12">
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Successfully Recognized & Passed Rules:
                    </div>
                    <div className="flex flex-wrap gap-8">
                      {auditResultNotification.passedRules.slice(0, 5).map(r => (
                        <span key={r.rule_id} className="badge badge-pass flex items-center gap-4" style={{ fontSize: 11, padding: '3px 8px' }}>
                          <Check size={11} /> {r.rule_id}: {r.rule_name}
                        </span>
                      ))}
                      {auditResultNotification.passedRules.length > 5 && (
                        <span className="badge badge-neutral" style={{ fontSize: 11, padding: '3px 8px' }}>
                          +{auditResultNotification.passedRules.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => setAuditResultNotification(null)}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs mb-20">
        <button className={`tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
          Pending Training Queue ({pending.length})
        </button>
        <button className={`tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          Verified Learned Mappings ({verifiedMappings.length})
        </button>
      </div>

      {/* Pending Queue */}
      {tab === 'pending' && (
        pending.length === 0 ? (
          <div className="card">
            <div className="empty-state" style={{ padding: 60 }}>
              <div className="empty-state-icon"><Brain size={36} /></div>
              <div className="empty-state-title">Training Queue Empty</div>
              <div className="empty-state-text" style={{ maxWidth: 520, margin: '8px auto' }}>
                All config commands from uploaded devices have been successfully recognized and normalized.
                Click below to load an intentionally unknown demo configuration to test the AI training workflow.
              </div>
              <button
                className="btn btn-primary mt-16 flex items-center gap-8"
                style={{ margin: '16px auto 0' }}
                disabled={demoLoading}
                onClick={handleLoadDemoConfig}
              >
                {demoLoading ? <RefreshCw size={15} className="spinner" /> : <Play size={15} />}
                <span>Load Demo Unknown Config</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-col gap-16">
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Review and map unknown CLI commands below. Once saved, they will be applied across future audits.
              </span>
              <button
                className="btn btn-ghost btn-sm flex items-center gap-6"
                onClick={loadData}
              >
                <RefreshCw size={13} /> Refresh Queue
              </button>
            </div>

            {pending.map((item) => {
              let suggestion = {}
              try {
                suggestion = JSON.parse(item.ai_suggestion || '{}')
              } catch { /* empty */ }

              return (
                <div key={item.id} className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                  <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-12">
                      <span className="badge badge-accent" style={{ textTransform: 'capitalize', fontSize: 13, padding: '4px 10px' }}>
                        {item.vendor}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Queue Item #{item.id}
                      </span>
                    </div>
                    <button
                      className="btn btn-sm btn-secondary flex items-center gap-6"
                      onClick={() => handleAcceptSuggestion(item)}
                    >
                      <Sparkles size={14} /> Accept AI Suggestion
                    </button>
                  </div>

                  {/* Raw command */}
                  <div className="mb-16">
                    <label className="form-label" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Raw Device Command
                    </label>
                    <code style={{
                      display: 'block',
                      padding: '12px 16px',
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 13,
                      color: 'var(--color-warning)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      border: '1px solid var(--border-color)',
                    }}>
                      {item.raw_command}
                    </code>
                  </div>

                  {/* Context preview if available */}
                  {item.context_lines && (
                    <div className="mb-16">
                      <label className="form-label" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Surrounding Context</label>
                      <pre style={{
                        padding: '8px 12px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                        margin: 0,
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxWidth: '100%',
                      }}>
                        {item.context_lines}
                      </pre>
                    </div>
                  )}

                  {/* AI Suggestion preview */}
                  {suggestion.best_guess_key && (
                    <div className="mb-16" style={{
                      padding: '10px 14px',
                      background: 'var(--accent-bg)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: 'var(--accent-light)',
                    }}>
                      <Sparkles size={15} />
                      <span>
                        AI suggests mapping to <strong>{suggestion.best_guess_key}</strong> = <code>{String(suggestion.best_guess_value)}</code> (confidence: {Math.round((suggestion.confidence || 0.9) * 100)}%)
                      </span>
                    </div>
                  )}

                  {/* Mapping form */}
                  {editingId === item.id && (
                    <div style={{
                      padding: 20,
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-accent)',
                      marginTop: 12,
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Compliance Category</label>
                          <select
                            className="form-select"
                            value={formData.category}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                          >
                            <option value="">Select Category…</option>
                            {CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Normalized Schema Key</label>
                          {currentPresets.length > 0 ? (
                            <select
                              className="form-select"
                              value={formData.key}
                              onChange={(e) => handlePresetSelect(e.target.value)}
                            >
                              <option value="">Select Normalized Key…</option>
                              {currentPresets.map(p => (
                                <option key={p.key} value={p.key}>{p.label} ({p.key})</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="form-input"
                              placeholder="e.g. remote_access.ssh_version"
                              value={formData.key}
                              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                            />
                          )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Normalized Value</label>
                          <input
                            className="form-input"
                            placeholder="e.g. 2, true, false, 900"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex gap-12 mt-16" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                          <X size={14} /> Cancel
                        </button>
                        <button className="btn btn-success btn-sm flex items-center gap-6" onClick={() => handleSubmitMapping(item.id)}>
                          <Check size={14} /> Save & Verify Mapping
                        </button>
                      </div>
                    </div>
                  )}

                  {editingId !== item.id && (
                    <div className="flex gap-12 items-center mt-8">
                      <button
                        className="btn btn-primary btn-sm flex items-center gap-6"
                        onClick={() => {
                          setEditingId(item.id)
                          handleAcceptSuggestion(item)
                        }}
                      >
                        <ChevronRight size={14} /> Configure Mapping
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* History & Active Learned Mappings Tab */}
      {tab === 'history' && (
        <div className="flex-col gap-24">
          {/* Action Header with devices to re-audit */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  Re-Audit Devices with Learned Mappings
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Trigger an immediate compliance re-audit on any device to evaluate it against the newly learned CLI mappings.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-12 mt-16">
              {devices.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No devices ingested yet.</div>
              ) : (
                devices.map(device => (
                  <button
                    key={device.id}
                    className="btn btn-secondary btn-sm flex items-center gap-8"
                    disabled={reAuditing[device.id]}
                    onClick={() => handleReAudit(device)}
                  >
                    <RefreshCw size={14} className={reAuditing[device.id] ? 'spinner' : ''} />
                    <span>Re-Audit <strong>{device.hostname}</strong> ({device.vendor})</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Raw Command</th>
                  <th>Category</th>
                  <th>Normalized Key → Value</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.length === 0 ? (
                  <tr><td colSpan={6} className="text-center" style={{ padding: 40, color: 'var(--text-tertiary)' }}>No mappings learned yet</td></tr>
                ) : (
                  mappings.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                          {m.vendor}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                        {m.raw_command}
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                          {m.security_category || '—'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 0, maxWidth: 260, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                        {m.normalized_key ? (
                          <div className="flex items-center gap-6">
                            <span style={{ color: 'var(--accent-light)' }}>{m.normalized_key}</span>
                            <ArrowRight size={12} style={{ color: 'var(--text-tertiary)' }} />
                            <strong style={{ color: 'var(--color-pass)' }}>{m.normalized_value}</strong>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${m.is_verified ? 'badge-pass' : 'badge-warning'} flex items-center gap-4`}>
                          {m.is_verified ? <Check size={12} /> : null}
                          {m.is_verified ? 'Verified & Active' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm btn-icon" title="Delete mapping" onClick={() => handleDeleteMapping(m.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
