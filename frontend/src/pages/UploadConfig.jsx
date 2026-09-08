import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Trash2, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import FileUploader from '../components/FileUploader'
import { listDevices, deleteDevice, triggerAudit } from '../services/api'

export default function UploadConfig() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadDevices = async () => {
    try {
      const data = await listDevices()
      setDevices(data)
    } catch { /* empty */ }
    setLoading(false)
  }

  useEffect(() => { loadDevices() }, [])

  const handleUploadSuccess = () => {
    loadDevices()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this device and all associated data?')) return
    try {
      await deleteDevice(id)
      toast.success('Device deleted')
      loadDevices()
    } catch {
      toast.error('Failed to delete device')
    }
  }

  const handleQuickAudit = async (deviceId) => {
    try {
      toast.loading('Running CIS assessment…', { id: 'audit' })
      await triggerAudit(deviceId, 'CIS')
      toast.success('Assessment complete', { id: 'audit' })
      navigate(`/audit/${deviceId}`)
    } catch {
      toast.error('Assessment failed', { id: 'audit' })
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Import Configuration</h1>
        <p className="page-subtitle">
          Analyze vendor configuration files against security compliance frameworks
        </p>
      </div>

      <FileUploader onUploadSuccess={handleUploadSuccess} />

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          {['01 IMPORT', '02 IDENTIFY', '03 NORMALIZE', '04 AUDIT', '05 REPORT'].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? 'var(--accent-light)' : 'var(--text-tertiary)', letterSpacing: '0.5px' }}>
                {step}
              </span>
              {i < 4 && <span style={{ color: 'var(--border-primary)' }}>→</span>}
            </div>
          ))}
        </div>
        
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
          NetAudit AI detects vendor syntax, converts configuration into a vendor-neutral security model, and evaluates it against compliance controls.
        </p>
      </div>

      {/* Uploaded Devices */}
      <div className="panel mt-24">
        <div className="panel-header">
          <span className="panel-title">Imported Devices</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {devices.length} device{devices.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="loading-overlay" style={{ padding: 40 }}>
            <div className="spinner" />
            <span>Loading devices…</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="empty-state" style={{ padding: 60 }}>
            <div className="empty-state-title" style={{ marginBottom: 16, fontSize: 13, letterSpacing: '0.5px' }}>NO DEVICES IMPORTED</div>
            <div className="empty-state-text">Upload a configuration file above to begin analysis.</div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Vendor</th>
                  <th>Type</th>
                  <th>OS Version</th>
                  <th>Imported</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span
                        style={{ color: 'var(--accent-light)', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                        onClick={() => navigate(`/devices/${d.id}`)}
                        role="link"
                        tabIndex={0}
                      >
                        {d.hostname}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                        {d.vendor}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{d.device_type}</td>
                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{d.os_version}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(d.uploaded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td>
                      <div className="flex gap-6">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleQuickAudit(d.id)}
                          title="Run CIS Assessment"
                        >
                          <Play size={11} /> Audit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(`/devices/${d.id}`)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => handleDelete(d.id)}
                          title="Delete device"
                          aria-label="Delete device"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
