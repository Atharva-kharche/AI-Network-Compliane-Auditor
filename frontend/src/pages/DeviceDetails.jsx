import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, FileText, ArrowLeft, Code, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import { getDevice, triggerAudit } from '../services/api'
import { formatDeviceName } from '../utils'

// Simple JSON tree renderer
function JsonTree({ data, depth = 0 }) {
  if (data === null || data === undefined) return <span className="json-null">null</span>
  if (typeof data === 'boolean') return <span className="json-bool">{data.toString()}</span>
  if (typeof data === 'number') return <span className="json-number">{data}</span>
  if (typeof data === 'string') return <span className="json-string">"{data}"</span>

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="json-null">[]</span>
    return (
      <div style={{ paddingLeft: depth > 0 ? 18 : 0 }}>
        <span style={{ color: 'var(--text-muted)' }}>[</span>
        {data.map((item, i) => (
          <div key={i} style={{ paddingLeft: 18 }}>
            <JsonTree data={item} depth={depth + 1} />
            {i < data.length - 1 && <span style={{ color: 'var(--text-muted)' }}>,</span>}
          </div>
        ))}
        <span style={{ color: 'var(--text-muted)' }}>]</span>
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data)
    return (
      <div style={{ paddingLeft: depth > 0 ? 18 : 0 }}>
        <span style={{ color: 'var(--text-muted)' }}>{'{'}</span>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ paddingLeft: 18 }}>
            <span className="json-key">"{key}"</span>
            <span style={{ color: 'var(--text-muted)' }}>: </span>
            <JsonTree data={val} depth={depth + 1} />
            {i < entries.length - 1 && <span style={{ color: 'var(--text-muted)' }}>,</span>}
          </div>
        ))}
        <span style={{ color: 'var(--text-muted)' }}>{'}'}</span>
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
      toast.loading(`Running ${fw} assessment…`, { id: 'audit' })
      await triggerAudit(Number(deviceId), fw)
      toast.success('Assessment complete', { id: 'audit' })
      navigate(`/audit/${deviceId}`)
    } catch {
      toast.error('Assessment failed', { id: 'audit' })
    }
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading device details…</span>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Device Not Found</div>
        <button className="btn btn-primary" onClick={() => navigate('/upload')}>
          <ArrowLeft size={14} /> Back to Import
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
            <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate(-1)}>
              <ArrowLeft size={13} /> Back
            </button>
            <div className="flex gap-16 items-center">
              <h1 className="page-title" style={{ fontFamily: 'var(--font-mono)' }}>{formatDeviceName(device)}</h1>
            </div>
            <p className="page-subtitle">
              <span style={{ textTransform: 'capitalize' }}>{device.vendor}</span> · {device.model} · <span style={{ fontFamily: 'var(--font-mono)' }}>{device.os_version}</span>
            </p>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-primary" onClick={() => handleRunAudit('CIS')}>
              <Play size={14} /> Run CIS Audit
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/audit/${deviceId}`)}>
              <FileText size={14} /> View Results
            </button>
          </div>
        </div>
      </div>

      {/* Device Info Panel */}
      <div className="panel mb-20">
        <div className="panel-header">
          <span className="panel-title">Device Information</span>
          <span className={`badge ${config?.parse_status === 'parsed' ? 'badge-pass' : config?.parse_status === 'needs_training' ? 'badge-warning' : 'badge-na'}`}>
            {config?.parse_status || 'unknown'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          {[
            ['ID', device.id, true],
            ['Hostname', formatDeviceName(device), true],
            ['Vendor', device.vendor, false],
            ['Model', device.model, false],
            ['OS Version', device.os_version, true],
            ['Serial Number', device.serial_number, true],
            ['Device Type', device.device_type, false],
            ['Imported', new Date(device.uploaded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), true],
            ['Config File', config?.filename, true],
          ].map(([label, value, mono]) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', marginBottom: 3 }}>
                {label}
              </div>
              <div style={{
                fontSize: mono ? 12 : 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                textTransform: label === 'Vendor' || label === 'Device Type' ? 'capitalize' : 'none',
                fontFamily: mono ? 'var(--font-mono)' : 'inherit',
              }}>
                {value || 'Unknown'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config Tabs */}
      <div className="tabs">
        <button className={`tab${viewTab === 'info' ? ' active' : ''}`} onClick={() => setViewTab('info')}>
          <Database size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} /> Normalized Model
        </button>
        <button className={`tab${viewTab === 'raw' ? ' active' : ''}`} onClick={() => setViewTab('raw')}>
          <Code size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} /> Raw Configuration
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
        <div className="panel">
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-title">No Normalized Data</div>
            <div className="empty-state-text">
              This configuration has not been normalized into the security model yet.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
