import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-eventlog',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="page-content">
      <div class="data-table-wrapper">
        <div class="table-header">
          <h3>{{ 'eventlog.title' | translate }}</h3>
          <button class="filter-btn" (click)="clearLog()" [disabled]="!canClearLog()">{{ 'eventlog.clear' | translate }}</button>
        </div>
        <div class="table-scroll" style="max-height:600px">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'eventlog.col_timestamp' | translate }}</th>
                <th>{{ 'eventlog.col_urn' | translate }}</th>
                <th>{{ 'eventlog.col_user' | translate }}</th>
                <th>{{ 'eventlog.col_action' | translate }}</th>
                <th>{{ 'eventlog.col_from' | translate }}</th>
                <th>{{ 'eventlog.col_to' | translate }}</th>
                <th>{{ 'eventlog.col_notes' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="events().length === 0">
                <td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">{{ 'eventlog.empty' | translate }}</td>
              </tr>
              <tr *ngFor="let e of events()">
                <td style="white-space:nowrap;font-size:0.8rem">{{ formatDateTime(e.timestamp) }}</td>
                <td><strong>{{ e.urn }}</strong></td>
                <td style="font-size:0.8rem">{{ e.user }}</td>
                <td style="font-size:0.8rem">{{ e.action }}</td>
                <td><span class="status-badge" [ngClass]="statusClass(e.from)"><span class="dot"></span>{{ e.from }}</span></td>
                <td><span class="status-badge" [ngClass]="statusClass(e.to)"><span class="dot"></span>{{ e.to }}</span></td>
                <td style="font-size:0.8rem;color:var(--text-muted)">{{ e.notes || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span>{{ events().length }} {{ 'eventlog.events' | translate }}</span>
        </div>
      </div>
    </div>
  `
})
export class EventlogComponent implements OnInit {
  private dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);

  private allEvents = signal<any[]>([]);
  private allEventsLoaded = signal(false);

  events = computed(() => this.allEventsLoaded() ? this.allEvents() : this.dataStore.events());
  canClearLog = computed(() => this.dataStore.canAccessAction('reset_data'));

  async ngOnInit(): Promise<void> {
    await this.loadAllEvents();
  }

  formatDateTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  statusClass(status: string): string {
    const map: any = { 'Received': 'received', 'Drafting': 'drafting', 'Checking Underlying': 'checking', 'Released': 'released', 'Breached': 'breached', 'Exception': 'exception', '-': 'received' };
    return map[status] || 'received';
  }

  clearLog() {
    if (!this.canClearLog()) {
      this.showToast('info', 'Forbidden: current role cannot clear logs');
      return;
    }
    localStorage.removeItem('shila_event_log');
    this.showToast('info', this.ts.translate('toast.log_cleared'));
    // Refresh to pick up the cleared state
    this.dataStore.refreshData();
    void this.loadAllEvents();
  }

  private async loadAllEvents(): Promise<void> {
    const events = await this.dataStore.fetchAllEvents();
    this.allEvents.set(events);
    this.allEventsLoaded.set(true);
  }

  private showToast(type: 'success' | 'info', message: string) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-icon">${type === 'success' ? '✓' : 'ℹ'}</div><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('leaving'); setTimeout(() => toast.remove(), 300); }, 3000);
  }
}