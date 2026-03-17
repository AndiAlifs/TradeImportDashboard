const STORAGE_KEY = 'shila_lc_data';
const SLA_KEY = 'shila_sla_config';
const EVENT_LOG_KEY = 'shila_event_log';
const ASSIGNEE_KEY = 'shila_assignee_master';
const OFFICER_KEY = 'shila_officer_master';

const DEFAULT_SLA = { slaMinMinutes: 90, slaMaxMinutes: 120 };
const API_BASE = (window as any).SHILA_API_BASE || 'http://localhost:8080/api';

let lcCache: any[] = [];
let slaCache: any = { ...DEFAULT_SLA };
let eventCache: any[] = [];
let assigneeCache: any[] = [];
let officerCache: any[] = [];
let backendOnline = false;

async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const err = await response.json();
      if (err && err.error) {
        message = err.error;
      }
    } catch (_ignored) {
      // Keep default message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function loadLocalFallback(): void {
  try {
    lcCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (_ignored) {
    lcCache = [];
  }

  try {
    slaCache = JSON.parse(localStorage.getItem(SLA_KEY) || JSON.stringify(DEFAULT_SLA));
  } catch (_ignored) {
    slaCache = { ...DEFAULT_SLA };
  }

  try {
    eventCache = JSON.parse(localStorage.getItem(EVENT_LOG_KEY) || '[]');
  } catch (_ignored) {
    eventCache = [];
  }

  try {
    assigneeCache = JSON.parse(localStorage.getItem(ASSIGNEE_KEY) || '[]');
  } catch (_ignored) {
    assigneeCache = [];
  }

  try {
    officerCache = JSON.parse(localStorage.getItem(OFFICER_KEY) || '[]');
  } catch (_ignored) {
    officerCache = [];
  }
}

function persistLocalCache(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lcCache));
  localStorage.setItem(SLA_KEY, JSON.stringify(slaCache));
  localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(eventCache));
  localStorage.setItem(ASSIGNEE_KEY, JSON.stringify(assigneeCache));
  localStorage.setItem(OFFICER_KEY, JSON.stringify(officerCache));
}

export async function refreshData(): Promise<void> {
  const [lcResp, slaResp, eventResp, assigneeResp, officerResp] = await Promise.all([
    apiRequest('/lc?limit=500&offset=0'),
    apiRequest('/sla'),
    apiRequest('/events?limit=500&offset=0'),
    apiRequest('/assignees'),
    apiRequest('/officers'),
  ]);

  lcCache = Array.isArray(lcResp?.data) ? lcResp.data : [];
  slaCache = slaResp || { ...DEFAULT_SLA };
  eventCache = Array.isArray(eventResp?.data) ? eventResp.data : [];
  assigneeCache = Array.isArray(assigneeResp?.data) ? assigneeResp.data : [];
  officerCache = Array.isArray(officerResp?.data) ? officerResp.data : [];
  backendOnline = true;
  persistLocalCache();
}

export async function initDataStore(): Promise<void> {
  try {
    await refreshData();
  } catch (_err) {
    backendOnline = false;
    loadLocalFallback();
  }
}

export function isBackendOnline(): boolean {
  return backendOnline;
}

export function getData(): any[] {
  return lcCache;
}

export function getSlaConfig(): any {
  return slaCache;
}

export async function saveSlaConfig(config: any): Promise<any> {
  const updated = await apiRequest('/sla', {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
  slaCache = updated || { ...config };
  persistLocalCache();
  return slaCache;
}

export function getEventLog(): any[] {
  return eventCache;
}

export function getAssignees(): any[] {
  return assigneeCache;
}

export async function createAssignee(payload: any): Promise<any> {
  const created = await apiRequest('/assignees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await refreshData();
  return created;
}

export function getOfficers(): any[] {
  return officerCache;
}

export async function createOfficer(payload: any): Promise<any> {
  const created = await apiRequest('/officers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await refreshData();
  return created;
}

export async function createLCOrder(payload: any): Promise<any> {
  const created = await apiRequest('/lc', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await refreshData();
  return created;
}

export async function updateLCStatus(id: number, payload: any): Promise<any> {
  const updated = await apiRequest(`/lc/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  await refreshData();
  return updated;
}

export async function resetAllData(): Promise<void> {
  throw new Error('Reset API is not implemented yet.');
}
