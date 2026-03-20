import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="page-content">
      <div class="data-table-wrapper">
        <div class="table-header">
          <h3>{{ 'queue.title' | translate }}</h3>
          <div class="table-filters">
            <input type="text" class="search-input" [placeholder]="'queue.search' | translate"
              [(ngModel)]="searchTerm" (input)="onSearch()" />
            <button class="filter-btn" *ngFor="let f of filters"
              [class.active]="currentFilter() === f.value"
              (click)="setFilter(f.value)">{{ f.label }}</button>
          </div>
        </div>
        <div class="table-scroll" style="max-height:600px">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'queue.col_num' | translate }}</th>
                <th>{{ 'queue.col_urn' | translate }}</th>
                <th>Type</th>
                <th>{{ 'queue.col_sender' | translate }}</th>
                <th>{{ 'queue.col_subject' | translate }}</th>
                <th>{{ 'queue.col_assigned' | translate }}</th>
                <th>{{ 'queue.col_status' | translate }}</th>
                <th>{{ 'queue.col_received' | translate }}</th>
                <th>{{ 'queue.col_elapsed' | translate }}</th>
                <th>{{ 'queue.col_sla' | translate }}</th>
                <th>{{ 'queue.col_action' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="filteredRecords().length === 0">
                <td colspan="11" style="text-align:center;color:var(--text-muted);padding:2rem">{{ 'queue.no_records' | translate }}</td>
              </tr>
              <tr *ngFor="let r of filteredRecords(); let i = index">
                <td style="color:var(--text-muted)">{{ i + 1 }}</td>
                <td><a class="urn-link" (click)="showLcDetails(r)"><strong>{{ r.urn }}</strong></a></td>
                <td><span class="type-badge" [ngClass]="r.transactionType === 'Import' ? 'import' : 'export'">{{ r.transactionType }}</span></td>
                <td style="font-size:0.8rem">{{ r.senderEmail }}</td>
                <td style="font-size:0.8rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" [title]="r.subject">{{ r.subject }}</td>
                <td style="font-size:0.8rem">{{ r.assignedTo }}</td>
                <td><span class="status-badge" [ngClass]="statusClass(r.status)"><span class="dot"></span>{{ r.status }}</span></td>
                <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">{{ formatTime(r.receivedAt) }}</td>
                <td class="elapsed-time">{{ formatElapsed(r) }}</td>
                <td [innerHTML]="slaIndicatorHtml(r)"></td>
                <td>
                  <ng-container [ngSwitch]="r.status">
                    <ng-container *ngSwitchCase="'Received'">
                      <button class="action-btn primary" (click)="handleAction(r, 'start-drafting')">{{ 'action.start_drafting' | translate }}</button>
                      <button class="action-btn" style="background:var(--bg-secondary,#f1f5f9);color:var(--text-secondary);margin-top:4px" (click)="promptMarkException(r)">{{ 'action.mark_exception' | translate }}</button>
                    </ng-container>
                    <ng-container *ngSwitchCase="'Drafting'">
                      <button class="action-btn warning" (click)="handleAction(r, 'start-checking')">{{ 'action.start_checking' | translate }}</button>
                      <button class="action-btn" style="background:var(--bg-secondary,#f1f5f9);color:var(--text-secondary);margin-top:4px" (click)="promptMarkException(r)">{{ 'action.mark_exception' | translate }}</button>
                    </ng-container>
                    <ng-container *ngSwitchCase="'Checking Underlying'">
                      <button class="action-btn success" (click)="handleAction(r, 'release')">{{ 'action.release' | translate }}</button>
                      <button class="action-btn" style="background:var(--bg-secondary,#f1f5f9);color:var(--text-secondary);margin-top:4px" (click)="promptMarkException(r)">{{ 'action.mark_exception' | translate }}</button>
                    </ng-container>
                    <span *ngSwitchCase="'Released'" class="action-btn completed">{{ 'action.completed' | translate }}</span>
                    <ng-container *ngSwitchCase="'Breached'">
                      <button class="action-btn primary" (click)="handleAction(r, 'start-drafting')">{{ 'action.resume' | translate }}</button>
                    </ng-container>
                    <ng-container *ngSwitchCase="'Exception'">
                      <button class="action-btn dark" (click)="promptResolveException(r)">{{ 'action.resolve_exception' | translate }}</button>
                    </ng-container>
                  </ng-container>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span>{{ 'queue.showing' | translate }} {{ filteredRecords().length }} {{ 'queue.of' | translate }} {{ dataStore.lcs().length }} {{ 'queue.records' | translate }}</span>
        </div>
      </div>

      <!-- LC Detail Modal -->
      <div class="modal-overlay" [class.active]="!!selectedLc" (click)="selectedLc = null">
        <div class="modal-container" *ngIf="selectedLc" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ selectedLc.urn }}</h3>
              <div style="font-size:0.75rem;color:var(--text-secondary)">[{{ selectedLc.transactionType }}] {{ selectedLc.subject }}</div>
            </div>
            <button class="modal-close" (click)="selectedLc = null">×</button>
          </div>
          <div class="modal-body">
            <div class="timeline">
              <div *ngIf="selectedLc.receivedAt" class="timeline-item completed">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.received' | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.receivedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.received' | translate }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.draftingStartedAt" class="timeline-item" [ngClass]="selectedLc.status === 'Drafting' ? 'active' : 'completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.drafting' | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.draftingStartedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.drafting' | translate }}{{ selectedLc.assignedTo ? ' by ' + selectedLc.assignedTo : '' }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.checkingStartedAt" class="timeline-item" [ngClass]="selectedLc.status === 'Checking Underlying' ? 'active' : 'completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.checking' | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.checkingStartedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.checking' | translate }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.exceptionStartedAt || selectedLc.exceptionTotalMinutes > 0" class="timeline-item" [ngClass]="selectedLc.status === 'Exception' ? 'exception active' : 'exception completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.exception' | translate }}</div>
                  <div class="timeline-time">{{ selectedLc.exceptionStartedAt ? formatDateTime(selectedLc.exceptionStartedAt) : '—' }}</div>
                  <div class="timeline-desc">{{ selectedLc.status === 'Exception' ? (selectedLc.exceptionReason || ('timeline.desc.exception_active' | translate)) : ('timeline.desc.exception_resolved' | translate) }}{{ selectedLc.status !== 'Exception' && selectedLc.exceptionTotalMinutes ? ' (' + selectedLc.exceptionTotalMinutes + ' min total)' : '' }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.releasedAt" class="timeline-item completed">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.released' | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.releasedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.released' | translate }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class QueueComponent {
  dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);

  searchTerm = '';
  currentFilter = signal('all');
  selectedLc: any = null;

  filters = [
    { label: 'All', value: 'all' },
    { label: 'Received', value: 'Received' },
    { label: 'Drafting', value: 'Drafting' },
    { label: 'Checking', value: 'Checking Underlying' },
    { label: 'Exception', value: 'Exception' },
    { label: 'Released', value: 'Released' },
    { label: 'Breached', value: 'Breached' },
  ];

  private searchSignal = signal('');

  filteredRecords = computed(() => {
    let data = this.dataStore.lcs();
    const filter = this.currentFilter();
    const search = this.searchSignal().toLowerCase();

    if (filter !== 'all') {
      data = data.filter(r => r.status === filter);
    }
    if (search) {
      data = data.filter(r =>
        (r.urn || '').toLowerCase().includes(search) ||
        (r.senderEmail || '').toLowerCase().includes(search) ||
        (r.subject || '').toLowerCase().includes(search) ||
        (r.assignedTo || '').toLowerCase().includes(search)
      );
    }
    return data;
  });

  setFilter(value: string) {
    this.currentFilter.set(value);
  }

  onSearch() {
    this.searchSignal.set(this.searchTerm);
  }

  async handleAction(r: any, action: string) {
    let newStatus = '';
    const payload: any = { userId: r.assignedTo };

    switch (action) {
      case 'start-drafting':
        newStatus = 'Drafting';
        payload.notes = this.ts.translate('note.start_drafting');
        break;
      case 'start-checking':
        newStatus = 'Checking Underlying';
        payload.notes = this.ts.translate('note.start_checking');
        break;
      case 'release':
        newStatus = 'Released';
        payload.notes = this.ts.translate('note.release');
        break;
      default:
        return;
    }
    payload.newStatus = newStatus;
    try {
      await this.dataStore.updateLCStatus(r.id, payload);
      this.showToast('success', `${r.urn} → ${newStatus}`);
    } catch (e: any) {
      this.showToast('info', e.message || 'Action failed');
    }
  }

  async promptMarkException(r: any) {
    const reason = prompt(this.ts.translate('prompt.mark_exception'), '');
    if (reason === null) return;
    try {
      await this.dataStore.updateLCStatus(r.id, {
        newStatus: 'Exception',
        exceptionReason: reason,
        userId: r.assignedTo,
        notes: this.ts.translate('note.mark_exception') + (reason ? `: ${reason}` : ''),
      });
      this.showToast('success', `${r.urn} → Exception`);
    } catch (e: any) {
      this.showToast('info', e.message || 'Action failed');
    }
  }

  async promptResolveException(r: any) {
    if (!r.exceptionStartedAt) return;
    const autoMins = Math.round((Date.now() - new Date(r.exceptionStartedAt).getTime()) / 60000);
    const promptMsg = this.ts.translate('prompt.resolve_exception').replace('{0}', String(autoMins));
    const userInput = prompt(promptMsg, String(autoMins));
    if (userInput === null) return;
    const parsedMins = parseInt(userInput, 10);
    const finalMins = isNaN(parsedMins) ? autoMins : parsedMins;

    const prevStatus = r.previousStatus || 'Drafting';
    try {
      await this.dataStore.updateLCStatus(r.id, {
        newStatus: prevStatus,
        exceptionMinutes: finalMins,
        userId: r.assignedTo,
        notes: this.ts.translate('note.resolve_exception'),
      });
      this.showToast('success', `${r.urn} → ${prevStatus}`);
    } catch (e: any) {
      this.showToast('info', e.message || 'Action failed');
    }
  }

  showLcDetails(r: any) {
    this.selectedLc = r;
  }

  formatTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatDateTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatElapsed(r: any): string {
    const mins = this.getElapsedMinutes(r);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  statusClass(status: string): string {
    const map: any = { 'Received': 'received', 'Drafting': 'drafting', 'Checking Underlying': 'checking', 'Released': 'released', 'Breached': 'breached', 'Exception': 'exception' };
    return map[status] || 'received';
  }

  slaIndicatorHtml(r: any): string {
    const sla = this.dataStore.slaConfig();
    if (r.status === 'Released' && r.releasedAt) {
      const total = Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      if (total <= sla.slaMinMinutes) return `<span class="sla-indicator green">✓ ${total}m</span>`;
      if (total <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">⚠ ${total}m</span>`;
      return `<span class="sla-indicator red">✗ ${total}m</span>`;
    }
    const elapsed = this.getElapsedMinutes(r);
    if (elapsed <= sla.slaMinMinutes) return `<span class="sla-indicator green">✓ ${this.ts.translate('sla.ok')}</span>`;
    if (elapsed <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">⚠ ${this.ts.translate('sla.warning')}</span>`;
    return `<span class="sla-indicator red">✗ ${this.ts.translate('sla.breach')}</span>`;
  }

  private getElapsedMinutes(r: any): number {
    let total = 0;
    if (r.status === 'Released' && r.releasedAt) {
      total = Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
    } else if (r.status === 'Exception' && r.exceptionStartedAt) {
      total = Math.round((new Date(r.exceptionStartedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
    } else {
      total = Math.round((Date.now() - new Date(r.receivedAt).getTime()) / 60000);
    }
    return Math.max(0, total - (r.exceptionTotalMinutes || 0));
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