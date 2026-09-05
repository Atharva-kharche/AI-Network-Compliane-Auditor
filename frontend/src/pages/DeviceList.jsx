import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Trash2, Play, ShieldCheck, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { listDevices, deleteDevice, triggerAudit } from '../services/api'

export default function DeviceList() {
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
      toast.loading('Running CIS audit…', { id: 'audit' })
      await triggerAudit(deviceId, 'CIS')
      toast.success('Audit complete!', { id: 'audit' })
      navigate(`/audit/${deviceId}`)
    } catch {
      toast.error('Audit failed', { id: 'audit' })
    }
  }

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /> Loading devices…</div>
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">All Devices</h1>
            <p className="page-subtitle">{devices.length} device{devices.length !== 1 ? 's' : ''} ingested</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>
            Upload Config
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 80 }}>
            <div className="empty-state-icon"><Server size={32} /></div>
            <div className="empty-state-title">No Devices</div>
            <div className="empty-state-text">Upload a network device configuration to get started.</div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hostname</th>
                <th>Vendor</th>
                <th>Model</th>
                <th>Type</th>
                <th>OS Version</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span
                      style={{ color: 'var(--accent-light)', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => navigate(`/devices/${d.id}`)}
                    >
                      {d.hostname}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                      {d.vendor}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{d.model}</td>
                  <td style={{ textTransform: 'capitalize' }}>{d.device_type}</td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{d.os_version}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {new Date(d.uploaded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-primary btn-sm" onClick={() => handleQuickAudit(d.id)} title="Run CIS Audit">
                        <Play size={12} /> Audit
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/devices/${d.id}`)} title="View Details">
                        <Eye size={12} />
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(d.id)} title="Delete">
                        <Trash2 size={14} />
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
  )
}
