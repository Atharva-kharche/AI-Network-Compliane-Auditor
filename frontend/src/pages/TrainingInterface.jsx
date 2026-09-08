import { useState, useEffect } from 'react'
import {
  Brain, Check, X, ChevronRight, Trash2, RefreshCw,
  ShieldCheck, ArrowRight, Zap, CheckCircle2, Play
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
      toast.success(res.message || 'Demo unknown configuration loaded')
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
      toast.success('Mapping learned and saved')
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
      toast.success(res.message || 'Device re-audited successfully')
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
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading intelligence data…</span>
      </div>
    )
  }

  const verifiedMappings = mappings.filter(m => m.is_verified)
  const currentPresets = formData.category ? (SCHEMA_KEY_PRESETS[formData.category] || []) : []

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">AI Training Interface</h1>
            <p className="page-subtitle">
              Map unrecognized vendor CLI commands to normalized security controls
            </p>
          </div>
          <div className="flex gap-12 items-center">
            {pending.length > 0 ? (
              <span className="badge badge-warning" style={{ padding: '4px 10px' }}>
                {pending.length} Pending Commands
              </span>
            ) : (
              <span className="badge badge-pass" style={{ padding: '4px 10px' }}>
                All Commands Mapped
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Workflow Explainer & Demo Trigger */}
      <div className="panel mb-24" style={{ borderLeft: '3px solid var(--accent)' }}>
        <div className="flex items-center justify-between flex-wrap gap-16">
          <div>
            <div className="flex items-center gap-8 mb-6">
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                Workflow Test
              </span>
              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                Unknown Command Resolution
              </strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 750 }}>
              The AI engine automatically detects unknown vendor syntax during parsing. Use this queue to manually map unrecognized commands to standard schemas, teaching the engine for future audits.
            </div>
          </div>
          <button
            className="btn btn-secondary flex items-center gap-6"
            disabled={demoLoading}
            onClick={handleLoadDemoConfig}
          >
            {demoLoading ? <div className="spinner" /> : <Play size={12} />}
            Load Synthetic Unknown Config
          </button>
        </div>
      </div>

      {/* Re-audit Result Banner */}
      {auditResultNotification && (
        <div className="panel mb-24" style={{ borderColor: 'var(--color-pass-border)' }}>
          <div className="flex items-start justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div className="flex items-start gap-12">
              <ShieldCheck size={20} color="var(--color-pass)" style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                  Re-Audit Complete for {auditResultNotification.hostname}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Successfully applied <strong>{auditResultNotification.appliedMappingsCount} verified mappings</strong> during normalization.
                </div>

                <div className="flex items-center gap-16 mt-12 flex-wrap">
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Score</span>
                    <div className="flex items-center gap-8 mt-2">
                      {auditResultNotification.previousScore !== undefined && auditResultNotification.previousScore !== auditResultNotification.score && (
                        <>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'line-through', fontFeatureSettings: "'tnum'" }}>
                            {auditResultNotification.previousScore}
                          </span>
                          <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                        </>
                      )}
                      <span style={{ color: 'var(--color-pass)', fontWeight: 700, fontSize: 18, fontFeatureSettings: "'tnum'" }}>
                        {auditResultNotification.score}
                      </span>
                      {auditResultNotification.scoreImprovement > 0 && (
                        <span className="badge badge-pass" style={{ fontSize: 10 }}>
                          +{auditResultNotification.scoreImprovement}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Rule Status</span>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginTop: 6, fontFeatureSettings: "'tnum'" }}>
                      <span style={{ color: 'var(--color-pass)' }}>{auditResultNotification.passed}</span> / <span style={{ color: 'var(--color-fail)' }}>{auditResultNotification.failed}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>({auditResultNotification.total} total)</span>
                    </div>
                  </div>
                </div>

                {auditResultNotification.passedRules?.length > 0 && (
                  <div className="mt-16">
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>
                      Newly Recognized Rules
                    </div>
                    <div className="flex flex-wrap gap-6">
                      {auditResultNotification.passedRules.slice(0, 5).map(r => (
                        <span key={r.rule_id} className="badge badge-neutral" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                          <Check size={10} style={{ color: 'var(--color-pass)' }} /> {r.rule_id}
                        </span>
                      ))}
                      {auditResultNotification.passedRules.length > 5 && (
                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>
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
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs mb-20">
        <button className={`tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
          Pending Queue ({pending.length})
        </button>
        <button className={`tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          Verified Mappings ({verifiedMappings.length})
        </button>
      </div>

      {/* Pending Queue */}
      {tab === 'pending' && (
        pending.length === 0 ? (
          <div className="panel">
            <div className="empty-state" style={{ padding: '60px 32px' }}>
              <div className="empty-state-title" style={{ marginBottom: 24, fontSize: 13, letterSpacing: '0.5px' }}>NO UNKNOWN COMMANDS</div>
              <div className="empty-state-text" style={{ marginBottom: 40 }}>
                All currently imported configuration syntax is recognized.
              </div>
              
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 24, maxWidth: 500, margin: '0 auto', textAlign: 'left', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center', letterSpacing: '0.5px' }}>
                  How Unknown Command Training Works
                </div>
                <div className="flex flex-col gap-12 text-mono" style={{ color: 'var(--text-secondary)' }}>
                  <div className="flex items-center gap-12"><span style={{ color: 'var(--color-warning)' }}>●</span> UNKNOWN COMMAND</div>
                  <div style={{ paddingLeft: 4, marginLeft: 2, borderLeft: '1px dashed var(--border-primary)', height: 12 }}></div>
                  <div className="flex items-center gap-12"><span style={{ color: 'var(--accent-light)' }}>●</span> AI INTERPRETATION</div>
                  <div style={{ paddingLeft: 4, marginLeft: 2, borderLeft: '1px dashed var(--border-primary)', height: 12 }}></div>
                  <div className="flex items-center gap-12"><span style={{ color: 'var(--text-primary)' }}>●</span> ADMIN VERIFICATION</div>
                  <div style={{ paddingLeft: 4, marginLeft: 2, borderLeft: '1px dashed var(--border-primary)', height: 12 }}></div>
                  <div className="flex items-center gap-12"><span style={{ color: 'var(--color-pass)' }}>●</span> NORMALIZED CONTROL</div>
                  <div style={{ paddingLeft: 4, marginLeft: 2, borderLeft: '1px dashed var(--border-primary)', height: 12 }}></div>
                  <div className="flex items-center gap-12"><span style={{ color: 'var(--text-primary)' }}>●</span> FUTURE AUDITS</div>
                </div>
              </div>
              
              <button className="btn btn-primary mt-24" disabled={demoLoading} onClick={handleLoadDemoConfig}>
                {demoLoading ? <div className="spinner" /> : <Play size={12} />} Load Unknown Vendor Demo
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-col gap-16">
            <div className="flex items-center justify-between mb-8">
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Review and map unknown CLI commands below.
              </span>
              <button
                className="btn btn-ghost btn-sm flex items-center gap-6"
                onClick={loadData}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {pending.map((item) => {
              let suggestion = {}
              try {
                suggestion = JSON.parse(item.ai_suggestion || '{}')
              } catch { /* empty */ }

              return (
                <div key={item.id} className="panel" style={{ borderLeft: '3px solid var(--color-warning)' }}>
                  <div className="flex items-center justify-between mb-16">
                    <div className="flex items-center gap-8">
                      <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                        {item.vendor}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        Queue #{item.id}
                      </span>
                    </div>
                    {editingId !== item.id && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAcceptSuggestion(item)}
                      >
                        Map Command
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-8">
                    <div className="text-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>↓ Unknown Command</div>
                    <div className="code-block" style={{ color: 'var(--color-warning)' }}>
                      {item.raw_command}
                    </div>
                  </div>

                  {item.context_lines && (
                    <div className="mt-8">
                      <div className="text-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Context Context:</div>
                      <div className="code-block mt-4" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', fontSize: 11 }}>
                        {item.context_lines}
                      </div>
                    </div>
                  )}

                  {suggestion.best_guess_key && editingId !== item.id && (
                    <div className="mt-16 flex flex-col gap-8">
                      <div className="text-mono" style={{ fontSize: 11, color: 'var(--accent-light)', textTransform: 'uppercase' }}>↓ AI Interpretation</div>
                      <div style={{
                        padding: '12px 16px',
                        background: 'var(--accent-muted)',
                        border: '1px solid var(--accent-border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 16,
                      }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Category</div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{suggestion.category || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Schema Key</div>
                          <div className="text-mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{suggestion.best_guess_key}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Value</div>
                          <div className="text-mono" style={{ fontSize: 12, color: 'var(--color-pass)' }}>{String(suggestion.best_guess_value)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Confidence</div>
                          <div style={{ fontSize: 13, color: 'var(--color-pass)' }}>94%</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {editingId === item.id && (
                    <div style={{
                      padding: 16,
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-primary)',
                      marginTop: 16,
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Category</label>
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
                          <label className="form-label">Schema Key</label>
                          {currentPresets.length > 0 ? (
                            <select
                              className="form-select"
                              value={formData.key}
                              onChange={(e) => handlePresetSelect(e.target.value)}
                            >
                              <option value="">Select Key…</option>
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
                            placeholder="Value"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex gap-8 mt-16" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                        <button className="btn btn-success btn-sm" onClick={() => handleSubmitMapping(item.id)}>
                          <Check size={12} /> Save Mapping
                        </button>
                      </div>
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
          <div className="panel">
            <div className="panel-header" style={{ marginBottom: 12 }}>
              <span className="panel-title">Apply Mappings to Devices</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Trigger a re-audit to apply newly learned mappings to existing devices.
            </div>

            <div className="flex flex-wrap gap-8">
              {devices.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No devices imported.</div>
              ) : (
                devices.map(device => (
                  <button
                    key={device.id}
                    className="btn btn-secondary btn-sm"
                    disabled={reAuditing[device.id]}
                    onClick={() => handleReAudit(device)}
                  >
                    {reAuditing[device.id] ? <div className="spinner" /> : <RefreshCw size={12} />}
                    Re-Audit <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 4 }}>{device.hostname}</span>
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
                  <th>Target Schema Key</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mappings.length === 0 ? (
                  <tr><td colSpan={6} className="text-center" style={{ padding: 40, color: 'var(--text-tertiary)' }}>No verified mappings.</td></tr>
                ) : (
                  mappings.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                          {m.vendor}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {m.raw_command}
                        </code>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                          {m.security_category || '—'}
                        </span>
                      </td>
                      <td>
                        {m.normalized_key ? (
                          <div className="flex items-center gap-6" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            <span style={{ color: 'var(--text-primary)' }}>{m.normalized_key}</span>
                            <span style={{ color: 'var(--text-muted)' }}>=</span>
                            <span style={{ color: 'var(--color-pass)' }}>{m.normalized_value}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${m.is_verified ? 'badge-pass' : 'badge-warning'}`}>
                          {m.is_verified ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteMapping(m.id)}>
                          <Trash2 size={12} />
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
