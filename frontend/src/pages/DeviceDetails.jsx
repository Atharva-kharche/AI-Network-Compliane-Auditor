import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, FileText, ArrowLeft, Code, Database, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { getDevice, triggerAudit } from '../services/api'

// Simple JSON tree renderer
function JsonTree({ data, depth = 0 }) {
  if (data === null || data === undefined) return <span className="json-null">null</span>
  if (typeof data === 'boolean') return <span className="json-bool">{data.toString()}</span>
  if (typeof data === 'number') return <span className="json-number">{data}</span>
  if (typeof data === 'string') return <span className="json-string">"{data}"</span>

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="json-null">[]</span>
    return (
      <div style={{ paddingLeft: depth > 0 ? 20 : 0 }}>
        <span style={{ color: 'var(--text-tertiary)' }}>[</span>
        {data.map((item, i) => (
          <div key={i} style={{ paddingLeft: 20 }}>
            <JsonTree data={item} depth={depth + 1} />
            {i < data.length - 1 && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
          </div>
        ))}
        <span style={{ color: 'var(--text-tertiary)' }}>]</span>
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data)
    return (
      <div style={{ paddingLeft: depth > 0 ? 20 : 0 }}>
        <span style={{ color: 'var(--text-tertiary)' }}>{'{'}</span>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ paddingLeft: 20 }}>
            <span className="json-key">"{key}"</span>
            <span style={{ color: 'var(--text-tertiary)' }}>: </span>
            <JsonTree data={val} depth={depth + 1} />
            {i < entries.length - 1 && <span style={{ color: 'var(--text-tertiary)' }}>,</span>}
          </div>
        ))}
        <span style={{ color: 'var(--text-tertiary)' }}>{'}'}</span>
      </div>
    )
  }

  return <span>{String(data)}</span>
}

export default function DeviceDetails() {
  const { deviceId } = useParams()
  const navigate = useNavigate()
  const [device, setDevice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewTab, setViewTab] = useState('info')

  useEffect(() => {
    async function load() {
      try {
        const data = await getDevice(deviceId)
        setDevice(data)
      } catch {
        toast.error('Failed to load device')
      }
      setLoading(false)
    }
    load()
  }, [deviceId])

  const handleRunAudit = async (fw = 'CIS') => {
    try {
      toast.loading(`Running ${fw} audit…`, { id: 'audit' })
      await triggerAudit(Number(deviceId), fw)
      toast.success('Audit complete!', { id: 'audit' })
      navigate(`/audit/${deviceId}`)
    } catch {
      toast.error('Audit failed', { id: 'audit' })
    }
  }

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /> Loading device…</div>
  }

  if (!device) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Device Not Found</div>
        <button className="btn btn-primary" onClick={() => navigate('/upload')}>
          <ArrowLeft size={16} /> Back to Devices
        </button>
      </div>
    )
  }

  const config = device.config_files?.[0]
  let normalizedConfig = null
  try { normalizedConfig = config?.normalized_config ? JSON.parse(config.normalized_config) : null } catch { /* empty */ }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <button className="btn btn-ghost btn-sm mb-8" onClick={() => navigate(-1)}>
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="page-title">{device.hostname}</h1>
            <p className="page-subtitle">
              <span style={{ textTransform: 'capitalize' }}>{device.vendor}</span> · {device.model} · {device.os_version}
            </p>
          </div>
          <div className="flex gap-12">
            <button className="btn btn-primary" onClick={() => handleRunAudit('CIS')}>
              <Play size={16} /> Run CIS Audit
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/audit/${deviceId}`)}>
              <FileText size={16} /> View Results
            </button>
          </div>
        </div>
      </div>

      {/* Device Info */}
      <div className="card mb-24">
        <div className="card-header">
          <span className="card-title">Device Information</span>
          <span className={`badge ${config?.parse_status === 'parsed' ? 'badge-pass' : config?.parse_status === 'needs_training' ? 'badge-warning' : 'badge-na'}`}>
            {config?.parse_status || 'unknown'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
          {[
            ['Hostname', device.hostname],
            ['Vendor', device.vendor],
            ['Model', device.model],
            ['OS Version', device.os_version],
            ['Serial Number', device.serial_number],
            ['Device Type', device.device_type],
            ['Uploaded', new Date(device.uploaded_at).toLocaleString()],
            ['Config File', config?.filename],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: label === 'Vendor' || label === 'Device Type' ? 'capitalize' : 'none' }}>
                {value || 'Unknown'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config Tabs */}
      <div className="tabs">
        <button className={`tab${viewTab === 'info' ? ' active' : ''}`} onClick={() => setViewTab('info')}>
          <Database size={14} style={{ marginRight: 6 }} /> Normalized
        </button>
        <button className={`tab${viewTab === 'raw' ? ' active' : ''}`} onClick={() => setViewTab('raw')}>
          <Code size={14} style={{ marginRight: 6 }} /> Raw Config
        </button>
      </div>

      {viewTab === 'raw' && config && (
        <div className="config-viewer">
          {config.raw_content}
        </div>
      )}

      {viewTab === 'info' && normalizedConfig && (
        <div className="json-tree">
          <JsonTree data={normalizedConfig} />
        </div>
      )}

      {viewTab === 'info' && !normalizedConfig && (
        <div className="card">
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-title">No Normalized Config</div>
            <div className="empty-state-text">
              This config file hasn't been normalized yet.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
