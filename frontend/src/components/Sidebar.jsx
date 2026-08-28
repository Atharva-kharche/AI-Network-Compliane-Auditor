import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  ShieldCheck,
  Brain,
  FileText,
  Server,
  Shield,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload Config', icon: Upload },
  { to: '/reports', label: 'Reports', icon: FileText },
]

const aiItems = [
  { to: '/training', label: 'AI Training', icon: Brain },
]

export default function Sidebar({ pendingCount = 0 }) {
  const location = useLocation()

  const linkClass = (path) => {
    const isActive =
      path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
    return `sidebar-link${isActive ? ' active' : ''}`
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Shield size={22} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">NetAudit AI</span>
          <span className="sidebar-brand-sub">Compliance Auditor</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass(to)} end={to === '/'}>
            <Icon className="sidebar-link-icon" size={20} />
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="sidebar-section-label">AI Engine</div>
        {aiItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass(to)}>
            <Icon className="sidebar-link-icon" size={20} />
            <span>{label}</span>
            {to === '/training' && pendingCount > 0 && (
              <span className="sidebar-badge">{pendingCount}</span>
            )}
          </NavLink>
        ))}

        <div className="sidebar-section-label">Devices</div>
        <NavLink to="/devices" className={linkClass('/devices')} end>
          <Server className="sidebar-link-icon" size={20} />
          <span>All Devices</span>
        </NavLink>
      </nav>
    </aside>
  )
}
