import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Trash2, Play, Eye, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { listDevices, deleteDevice, triggerAudit } from '../services/api'
import { formatDeviceName } from '../utils'

export default function DeviceList() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterVendor, setFilterVendor] = useState('all')
  const [filterType, setFilterType] = useState('all')
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
      toast.success('Device removed')
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

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <span>Loading device inventory…</span>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Device Inventory</h1>
            <p className="page-subtitle">
              {devices.length} device{devices.length !== 1 ? 's' : ''} registered
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>
            <Upload size={14} /> Import Configuration
          </button>
        </div>
      </div>

      {devices.length > 0 && (
        <div className="panel mb-24" style={{ padding: '12px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter</div>
          
          <select 
            className="form-select" 
            style={{ width: 180, padding: '4px 10px', fontSize: 12 }}
            value={filterVendor}
            onChange={e => setFilterVendor(e.target.value)}
          >
            <option value="all">All Vendors</option>
            {[...new Set(devices.map(d => d.vendor))].filter(Boolean).map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <select 
            className="form-select" 
            style={{ width: 180, padding: '4px 10px', fontSize: 12 }}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            {[...new Set(devices.map(d => d.device_type))].filter(Boolean).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="panel">
          <div className="empty-state" style={{ padding: '60px 32px' }}>
            <div className="empty-state-title" style={{ marginBottom: 16, fontSize: 13, letterSpacing: '0.5px' }}>NO DEVICES REGISTERED</div>
            <div className="empty-state-text">
              Import a network device configuration file to populate the device inventory.
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/upload')}>
              <Upload size={14} /> Import Configuration
            </button>
          </div>
        </div>
      ) : (() => {
        const filteredDevices = devices.filter(d => {
          if (filterVendor !== 'all' && d.vendor !== filterVendor) return false
          if (filterType !== 'all' && d.device_type !== filterType) return false
          return true
        })

        if (filteredDevices.length === 0) {
          return (
            <div className="panel">
              <div className="empty-state" style={{ padding: '40px 32px' }}>
                <div className="empty-state-title">NO MATCHING DEVICES</div>
                <div className="empty-state-text">Adjust your filters to see results.</div>
                <button className="btn btn-ghost btn-sm mt-8" onClick={() => { setFilterVendor('all'); setFilterType('all'); }}>Clear Filters</button>
              </div>
            </div>
          )
        }

        return (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Vendor</th>
                <th>Model</th>
                <th>Type</th>
                <th>OS Version</th>
                <th>Imported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span
                      style={{
                        color: 'var(--accent-light)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                      }}
                      onClick={() => navigate(`/devices/${d.id}`)}
                      role="link"
                      tabIndex={0}
                    >
                      {formatDeviceName(d)}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                      {d.vendor}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{d.model}</td>
                  <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{d.device_type}</td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{d.os_version}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(d.uploaded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td>
                    <div className="flex gap-6">
                      <button className="btn btn-primary btn-sm" onClick={() => handleQuickAudit(d.id)} title="Run CIS Assessment">
                        <Play size={11} /> Audit
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/devices/${d.id}`)} title="View Details">
                        <Eye size={12} />
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(d.id)} title="Delete" aria-label="Delete device">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )
      })()}
    </div>
  )
}
