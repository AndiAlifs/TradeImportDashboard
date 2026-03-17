import { Injectable, signal } from '@angular/core';

export interface SlaConfig {
  slaMinMinutes: number;
  slaMaxMinutes: number;
}

const STORAGE_KEY = 'shila_lc_data';
const SLA_KEY = 'shila_sla_config';
const EVENT_LOG_KEY = 'shila_event_log';
const ASSIGNEE_KEY = 'shila_assignee_master';
const OFFICER_KEY = 'shila_officer_master';

const DEFAULT_SLA: SlaConfig = { slaMinMinutes: 90, slaMaxMinutes: 120 };

@Injectable({
  providedIn: 'root'
})
export class DataStoreService {
  private apiBase = (window as any).SHILA_API_BASE || 'http://localhost:8080/api';

  lcs = signal<any[]>([]);
  slaConfig = signal<SlaConfig>({ ...DEFAULT_SLA });
  events = signal<any[]>([]);
  assignees = signal<any[]>([]);
  officers = signal<any[]>([]);
  isBackendOnline = signal<boolean>(false);

  constructor() {
    this.loadLocalFallback();
  }

  private async apiRequest(path: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.apiBase}${path}`, {
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
      } catch (_ignored) {}
      throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  private loadLocalFallback(): void {
    try { this.lcs.set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { this.lcs.set([]); }
    try { this.slaConfig.set(JSON.parse(localStorage.getItem(SLA_KEY) || JSON.stringify(DEFAULT_SLA))); } catch { this.slaConfig.set({ ...DEFAULT_SLA }); }
    try { this.events.set(JSON.parse(localStorage.getItem(EVENT_LOG_KEY) || '[]')); } catch { this.events.set([]); }
    try { this.assignees.set(JSON.parse(localStorage.getItem(ASSIGNEE_KEY) || '[]')); } catch { this.assignees.set([]); }
    try { this.officers.set(JSON.parse(localStorage.getItem(OFFICER_KEY) || '[]')); } catch { this.officers.set([]); }
  }

  private persistLocalCache(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lcs()));
    localStorage.setItem(SLA_KEY, JSON.stringify(this.slaConfig()));
    localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(this.events()));
    localStorage.setItem(ASSIGNEE_KEY, JSON.stringify(this.assignees()));
    localStorage.setItem(OFFICER_KEY, JSON.stringify(this.officers()));
  }

  async refreshData(): Promise<void> {
    try {
      const [lcResp, slaResp, eventResp, assigneeResp, officerResp] = await Promise.all([
        this.apiRequest('/lc?limit=500&offset=0'),
        this.apiRequest('/sla'),
        this.apiRequest('/events?limit=500&offset=0'),
        this.apiRequest('/assignees'),
        this.apiRequest('/officers'),
      ]);

      this.lcs.set(Array.isArray(lcResp?.data) ? lcResp.data : []);
      this.slaConfig.set(slaResp || { ...DEFAULT_SLA });
      this.events.set(Array.isArray(eventResp?.data) ? eventResp.data : []);
      this.assignees.set(Array.isArray(assigneeResp?.data) ? assigneeResp.data : []);
      this.officers.set(Array.isArray(officerResp?.data) ? officerResp.data : []);
      this.isBackendOnline.set(true);
      
      this.persistLocalCache();
    } catch (e) {
      console.warn("Backend might be offline. Using local cache.");
      this.isBackendOnline.set(false);
    }
  }

  async createLCOrder(data: any): Promise<void> {
    await this.apiRequest('/lc', { method: 'POST', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async updateLCStatus(id: number, data: any): Promise<void> {
    await this.apiRequest(`/lc/${id}/status`, { method: 'POST', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async saveSlaConfig(config: SlaConfig): Promise<void> {
    await this.apiRequest('/sla', { method: 'POST', body: JSON.stringify(config) });
    await this.refreshData();
  }

  async createAssignee(data: { name: string }): Promise<void> {
    await this.apiRequest('/assignees', { method: 'POST', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async createOfficer(data: { name: string }): Promise<void> {
    await this.apiRequest('/officers', { method: 'POST', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async resetAllData(): Promise<void> {
    await this.apiRequest('/reset', { method: 'POST' });
    await this.refreshData();
  }
}