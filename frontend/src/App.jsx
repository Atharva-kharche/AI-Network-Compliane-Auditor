import { Routes, Route, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import UploadConfig from './pages/UploadConfig'
import AuditResults from './pages/AuditResults'
import TrainingInterface from './pages/TrainingInterface'
import ReportViewer from './pages/ReportViewer'
import DeviceDetails from './pages/DeviceDetails'
import DeviceList from './pages/DeviceList'
import { getPendingTraining } from './services/api'
import api from './services/api'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/upload': 'Import Configuration',
  '/training': 'AI Training',
  '/reports': 'Audit Reports',
  '/devices': 'Device Inventory',
}

function TopBar({ title, apiStatus }) {
  return (
    <header className="topbar" role="banner">
      <span className="topbar-title">{title}</span>
      <div className="topbar-right">
        <div className="topbar-status" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <span
            className={`topbar-status-dot${apiStatus !== 'online' ? ' offline' : ''}`}
            aria-hidden="true"
          />
          <span style={{ fontWeight: 600 }}>{apiStatus === 'online' ? 'Engine Online' : apiStatus === 'connecting' ? 'Connecting…' : 'Engine Offline'}</span>
          {apiStatus === 'online' && (
            <>
              <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>/</span>
              <span style={{ color: 'var(--color-pass)' }}>API HEALTHY</span>
            </>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          v1.0.0
        </span>
      </div>
    </header>
  )
}

export default function App() {
  const location = useLocation()
  const [pendingCount, setPendingCount] = useState(0)
  const [apiStatus, setApiStatus] = useState('connecting')

  let pageTitle = PAGE_TITLES[location.pathname] || ''
  if (location.pathname.startsWith('/audit/')) pageTitle = 'Audit Results'
  if (location.pathname.startsWith('/devices/') && location.pathname !== '/devices') pageTitle = 'Device Details'

  const checkApiHealth = useCallback(async () => {
    try {
      await api.get('/health')
      setApiStatus('online')
    } catch {
      setApiStatus('offline')
    }
  }, [])

  useEffect(() => {
    checkApiHealth()
  }, [checkApiHealth])

  // Load pending training count for sidebar badge
  useEffect(() => {
    async function loadPending() {
      try {
        const pending = await getPendingTraining()
        setPendingCount(pending.length)
        // If we got here, API is reachable
        setApiStatus('online')
      } catch {
        /* Keep current status */
      }
    }
    loadPending()
  }, [location.pathname])

  return (
    <div className="app-layout">
      <Sidebar pendingCount={pendingCount} apiStatus={apiStatus} />
      <div className="app-main">
        <TopBar title={pageTitle} apiStatus={apiStatus} />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadConfig />} />
            <Route path="/audit/:deviceId" element={<AuditResults />} />
            <Route path="/training" element={<TrainingInterface />} />
            <Route path="/reports" element={<ReportViewer />} />
            <Route path="/devices" element={<DeviceList />} />
            <Route path="/devices/:deviceId" element={<DeviceDetails />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
