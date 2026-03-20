import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-officer-release',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="page-content">
      <div class="data-table-wrapper">
        <div class="table-header">
          <h3>{{ 'officer_release.title' | translate }}</h3>
          <div class="table-filters">
            <input type="text" class="search-input" [placeholder]="'officer_release.search' | translate"
              [(ngModel)]="searchTerm" (input)="onSearch()" />
          </div>
        </div>
        <div class="table-scroll" style="max-height:600px">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'officer_release.col_num' | translate }}</th>
                <th>{{ 'officer_release.col_urn' | translate }}</th>
                <th>{{ 'officer_release.col_type' | translate }}</th>
                <th>{{ 'officer_release.col_sender' | translate }}</th>
                <th>{{ 'officer_release.col_assigned' | translate }}</th>
                <th>{{ 'officer_release.col_status' | translate }}</th>
                <th>{{ 'officer_release.col_elapsed' | translate }}</th>
                <th>{{ 'officer_release.col_action' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="filteredRecords().length === 0">
                <td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">{{ 'officer_release.no_records' | translate }}</td>
              </tr>
              <tr *ngFor="let r of filteredRecords(); let i = index">
                <td style="color:var(--text-muted)">{{ i + 1 }}</td>
                <td><strong>{{ r.urn }}</strong></td>
                <td><span class="type-badge" [ngClass]="r.transactionType === 'Import' ? 'import' : 'export'">{{ r.transactionType }}</span></td>
                <td style="font-size:0.8rem">{{ r.senderEmail }}</td>
                <td style="font-size:0.8rem">{{ r.assignedTo }}</td>
                <td><span class="status-badge checking"><span class="dot"></span>{{ r.status }}</span></td>
                <td class="elapsed-time">{{ formatElapsed(r) }}</td>
                <td>
                  <div style="display:flex;flex-direction:column;gap:4px">
                    <select class="search-input" style="width:160px;padding-left:0.75rem" [(ngModel)]="officerSelections[r.id]">
                      <option value="" disabled>{{ 'officer_release.select_officer' | translate }}</option>
                      <option *ngFor="let o of officers()" [value]="o.name">{{ o.name }}</option>
                    </select>
                    <button class="action-btn success" [disabled]="!officerSelections[r.id]" (click)="handleRelease(r)">{{ 'action.release' | translate }}</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class OfficerReleaseComponent {
  dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);

  searchTerm = '';
  officerSelections: Record<number, string> = {};
  private searchSignal = signal('');

  officers = computed(() => this.dataStore.officers());

  private releasableLCs = computed(() =>
    this.dataStore.lcs().filter(r => r.status === 'Checking Underlying')
  );

  filteredRecords = computed(() => {
    const search = this.searchSignal().toLowerCase();
    let data = this.releasableLCs();
    if (search) {
      data = data.filter(r =>
        (r.urn || '').toLowerCase().includes(search) ||
        (r.senderEmail || '').toLowerCase().includes(search) ||
        (r.assignedTo || '').toLowerCase().includes(search)
      );
    }
    return data;
  });

  onSearch() {
    this.searchSignal.set(this.searchTerm);
  }

  async handleRelease(r: any) {
    const officerName = this.officerSelections[r.id];
    if (!officerName) return;
    try {
      await this.dataStore.updateLCStatus(r.id, {
        newStatus: 'Released',
        approvedBy: officerName,
        userId: r.assignedTo,
        notes: `Released by officer: ${officerName}`,
      });
      delete this.officerSelections[r.id];
      this.showToast('success', `${r.urn} → Released (by ${officerName})`);
    } catch (e: any) {
      this.showToast('info', e.message || 'Release failed');
    }
  }

  formatElapsed(r: any): string {
    const mins = this.getElapsedMinutes(r);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
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