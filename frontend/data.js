// ============================================================
// Shila Dashboard - data.js
// API-backed data store with local cache fallback
// ============================================================

const STORAGE_KEY = 'shila_lc_data';
const SLA_KEY = 'shila_sla_config';
const EVENT_LOG_KEY = 'shila_event_log';
const DEFAULT_SLA = { slaMinMinutes: 90, slaMaxMinutes: 120 };
const API_BASE = window.SHILA_API_BASE || 'http://localhost:8080/api';

let lcCache = [];
let slaCache = { ...DEFAULT_SLA };
let eventCache = [];
let backendOnline = false;

async function apiRequest(path, options = {}) {
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
      // Ignore JSON parse errors and keep default message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function loadLocalFallback() {
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
}

function persistLocalCache() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lcCache));
  localStorage.setItem(SLA_KEY, JSON.stringify(slaCache));
  localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(eventCache));
}

async function refreshData() {
  const [lcResp, slaResp, eventResp] = await Promise.all([
    apiRequest('/lc?limit=500&offset=0'),
    apiRequest('/sla'),
    apiRequest('/events?limit=500&offset=0'),
  ]);

  lcCache = Array.isArray(lcResp?.data) ? lcResp.data : [];
  slaCache = slaResp || { ...DEFAULT_SLA };
  eventCache = Array.isArray(eventResp?.data) ? eventResp.data : [];
  backendOnline = true;
  persistLocalCache();
}

async function initDataStore() {
  try {
    await refreshData();
  } catch (_err) {
    backendOnline = false;
    loadLocalFallback();
  }
}

function isBackendOnline() {
  return backendOnline;
}

function getData() {
  return lcCache;
}

function saveData(data) {
  lcCache = Array.isArray(data) ? data : [];
  persistLocalCache();
}

function getSlaConfig() {
  return slaCache;
}

async function saveSlaConfig(config) {
  const updated = await apiRequest('/sla', {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
  slaCache = updated || { ...config };
  persistLocalCache();
  return slaCache;
}

function getEventLog() {
  return eventCache;
}

function addEventLog(entry) {
  eventCache.unshift({
    timestamp: new Date().toISOString(),
    ...entry,
  });
  persistLocalCache();
}

async function createLCOrder(payload) {
  const created = await apiRequest('/lc', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await refreshData();
  return created;
}

async function updateLCStatus(id, payload) {
  const updated = await apiRequest(`/lc/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  await refreshData();
  return updated;
}

async function resetAllData() {
  throw new Error('Reset API is not implemented yet.');
}

function clearEventLogLocalOnly() {
  eventCache = [];
  persistLocalCache();
}
