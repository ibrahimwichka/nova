import React from 'react';
import { RoleIcon } from './ShiftLaunch.jsx';
import './presentation.css';

const VIEW_DESCRIPTIONS = {
  owner: 'Run the shift',
  kitchen: 'Cook and pack',
  customer: 'Order and track',
  display: 'Follow live orders',
  split: 'Customer + Owner',
};

export default function AppHeader({ roles, view, onViewChange, connected, version }) {
  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">N</span>
            <div>
              <b>Zindabad Dash</b>
              <small>Live restaurant simulator</small>
            </div>
          </div>
          <div className="app-sync">
            <span className="app-sync-label">Shared restaurant</span>
            <span className={`connection ${connected ? 'online' : ''}`} role="status">
              {connected ? 'Synced' : 'Disconnected'}
            </span>
            <span className="app-sync-version" aria-label={`Restaurant version ${version}`}>v{version}</span>
          </div>
        </div>
      </header>
      <nav className="role-switcher" aria-label="Role views">
        <div className="role-switcher-inner">
          {Object.entries(roles).map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-current={view === key ? 'page' : undefined}
              onClick={() => onViewChange(key)}
            >
              <span className="role-icon"><RoleIcon role={key}/></span>
              <span className="role-label">
                <b>{label}</b>
                <small>{VIEW_DESCRIPTIONS[key]}</small>
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
