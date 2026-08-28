import { Routes, Route, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import UploadConfig from './pages/UploadConfig'
import AuditResults from './pages/AuditResults'
import TrainingInterface from './pages/TrainingInterface'
import ReportViewer from './pages/ReportViewer'
import DeviceDetails from './pages/DeviceDetails'
import DeviceList from './pages/DeviceList'
import { getPendingTraining } from './services/api'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/upload': 'Upload Configuration',
  '/training': 'AI Training',
  '/reports': 'Reports',
  '/devices': 'All Devices',
}

function Navbar({ title }) {
  return (
    <header className="navbar">
      <span className="navbar-title">{title}</span>
      <div className="navbar-actions">
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          v1.0.0
        </span>
      </div>
    </header>
  )
}

export default function App() {
  const location = useLocation()
  const [pendingCount, setPendingCount] = useState(0)

  // Get the current page title
  let pageTitle = PAGE_TITLES[location.pathname] || ''
  if (location.pathname.startsWith('/audit/')) pageTitle = 'Audit Results'
  if (location.pathname.startsWith('/devices/') && location.pathname !== '/devices') pageTitle = 'Device Details'

  // Load pending training count for sidebar badge
  useEffect(() => {
    async function loadPending() {
      try {
        const pending = await getPendingTraining()
        setPendingCount(pending.length)
      } catch { /* empty */ }
    }
    loadPending()
  }, [location.pathname]) // Re-check when navigating

  return (
    <div className="app-layout">
      <Sidebar pendingCount={pendingCount} />
      <div className="app-main">
        <Navbar title={pageTitle} />
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
