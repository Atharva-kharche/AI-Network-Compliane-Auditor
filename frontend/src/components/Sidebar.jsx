import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Upload,
  ShieldCheck,
  Brain,
  FileText,
  Server,
  Shield,
  AlertTriangle,
  Search,
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Audit',
    items: [
      { to: '/upload', label: 'Import Configuration', icon: Upload },
      { to: '/reports', label: 'Audit Reports', icon: FileText },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/devices', label: 'Devices', icon: Server },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/training', label: 'AI Training', icon: Brain, hasBadge: true },
    ],
  },
]

export default function Sidebar({ pendingCount = 0, apiStatus = 'online' }) {
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Shield size={18} strokeWidth={2.5} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">NetAudit AI</span>
          <span className="sidebar-brand-sub">Security Compliance</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="sidebar-section-label">{group.label}</div>
            {group.items.map(({ to, label, icon: Icon, hasBadge }) => (
              <NavLink
                key={to}
                to={to}
                className={`sidebar-link${isActive(to) ? ' active' : ''}`}
                end={to === '/'}
                aria-current={isActive(to) ? 'page' : undefined}
              >
                <Icon className="sidebar-link-icon" size={17} />
                <span>{label}</span>
                {hasBadge && pendingCount > 0 && (
                  <span className="sidebar-badge" aria-label={`${pendingCount} pending`}>
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer — system status */}
      <div className="sidebar-footer">
        <span
          className={`sidebar-status-dot${apiStatus === 'offline' ? ' offline' : apiStatus === 'connecting' ? ' connecting' : ''}`}
          aria-hidden="true"
        />
        <span>
          {apiStatus === 'online' ? 'API Online' : apiStatus === 'connecting' ? 'Connecting…' : 'API Offline'}
        </span>
      </div>
    </aside>
  )
}
