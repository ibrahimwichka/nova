import React from 'react';
import './workspace-tabs.css';

export const WORKSPACE_TABS = {
  owner: [['floor', 'Overview'], ['prep', 'Prep'], ['inventory', 'Inventory'], ['staff', 'Team'], ['finance', 'Finances'], ['scenarios', 'Scenarios'], ['delivery', 'Delivery']],
  kitchen: [['floor', 'Kitchen floor'], ['prep', 'Prep'], ['packing', 'Packing & camera'], ['inventory', 'Inventory'], ['staff', 'Team'], ['delivery', 'Delivery']],
};
export const OPERATION_TABS = ['prep', 'inventory', 'staff', 'finance'];
const panelId = (role, id) => `workspace-${role}-${OPERATION_TABS.includes(id) ? 'operations' : id}`;

export function initialWorkspaceTab(role) {
  const requested = new URLSearchParams(location.search).get('tab');
  if (WORKSPACE_TABS[role]?.some(([id]) => id === requested)) return requested;
  if (location.hash === '#ai-operations') return 'inventory';
  if (location.hash === '#delivery-simulator') return 'delivery';
  return 'floor';
}

export function WorkspaceTabs({ role, value, onChange, stockAlerts = 0, tabs = WORKSPACE_TABS[role] }) {
  function navigate(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); event.stopPropagation();
    onChange(tabs[next][0]);
    document.getElementById(`workspace-tab-${role}-${tabs[next][0]}`)?.focus();
  }
  return <div className="workspace-tabs" role="tablist" aria-label={`${role === 'owner' ? 'Owner' : 'Kitchen'} categories`}>
    {tabs.map(([id, label], index) => <button key={id} type="button" role="tab" id={`workspace-tab-${role}-${id}`} aria-selected={value === id} aria-controls={panelId(role, id)} tabIndex={value === id ? 0 : -1} onClick={() => onChange(id)} onKeyDown={event => navigate(event, index)}>
      {label}{id === 'inventory' && stockAlerts > 0 && <span className="workspace-tab-count" aria-label={`${stockAlerts} stock items need attention`}>{stockAlerts}</span>}
    </button>)}
  </div>;
}

export function WorkspacePanel({ role, id, value, children }) {
  const visible = id === 'operations' ? OPERATION_TABS.includes(value) : value === id;
  return <section className="workspace-panel" id={panelId(role, id)} role="tabpanel" aria-labelledby={`workspace-tab-${role}-${id === 'operations' ? value : id}`} hidden={!visible} tabIndex={0}>{children}</section>;
}
