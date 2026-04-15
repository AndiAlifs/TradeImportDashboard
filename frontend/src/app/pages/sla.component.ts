import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-sla',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="page-content">
      <div class="settings-card">
        <h3>{{ 'sla.config_title' | translate }}</h3>
        <p>{{ 'sla.config_desc' | translate }}</p>

        <div class="form-group">
          <label for="sla-import-max">{{ 'sla.import_max_label' | translate }}</label>
          <input type="number" id="sla-import-max" [(ngModel)]="importSlaMaxMinutes" min="1" />
        </div>
        <div class="form-group">
          <label for="sla-export-max">{{ 'sla.export_max_label' | translate }}</label>
          <input type="number" id="sla-export-max" [(ngModel)]="exportSlaMaxMinutes" min="1" />
        </div>
        <div class="form-group">
          <label for="sla-bg-max">{{ 'sla.bg_max_label' | translate }}</label>
          <input type="number" id="sla-bg-max" [(ngModel)]="bgSlaMaxMinutes" min="1" />
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" (click)="handleSave()" [disabled]="saving || !canManageSla()">{{ 'sla.save' | translate }}</button>
          <button class="btn btn-secondary" (click)="handleReset()" [disabled]="!canManageSla()">{{ 'sla.reset_default' | translate }}</button>
        </div>
      </div>

      <!-- Warning Threshold Config (Super Admin only) -->
      <div class="settings-card" style="margin-top:1.5rem" *ngIf="isSuperAdmin()">
        <h3>{{ 'sla.warning_threshold_title' | translate }}</h3>
        <p>{{ 'sla.warning_threshold_desc' | translate }}</p>

        <div style="display:flex; gap:1.5rem; flex-wrap:wrap; margin-top:1rem;">
          <div class="form-group" style="flex:1; min-width:180px;">
            <label for="sla-warn-t1">
              <span style="display:inline-flex;align-items:center;gap:0.4rem;">
                <span style="width:12px;height:12px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>
                {{ 'sla.warning_threshold_1' | translate }}
              </span>
            </label>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <input type="number" id="sla-warn-t1" [(ngModel)]="warningThreshold1" min="1" max="99" style="width:100px;" />
              <span style="color:var(--text-muted);font-size:0.9rem;">%</span>
            </div>
          </div>
          <div class="form-group" style="flex:1; min-width:180px;">
            <label for="sla-warn-t2">
              <span style="display:inline-flex;align-items:center;gap:0.4rem;">
                <span style="width:12px;height:12px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
                {{ 'sla.warning_threshold_2' | translate }}
              </span>
            </label>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <input type="number" id="sla-warn-t2" [(ngModel)]="warningThreshold2" min="1" max="100" style="width:100px;" />
              <span style="color:var(--text-muted);font-size:0.9rem;">%</span>
            </div>
          </div>
        </div>

        <div style="margin-top:1rem;padding:0.75rem 1rem;background:var(--bg-modifier,rgba(0,0,0,0.1));border-radius:8px;font-size:0.85rem;color:var(--text-muted);">
          ℹ️ A full-screen early warning modal will appear when a document reaches
          <strong style="color:#f59e0b;">{{ warningThreshold1 }}%</strong> and
          <strong style="color:#ef4444;">{{ warningThreshold2 }}%</strong> of its SLA limit.
          The modal auto-dismisses after 30 seconds.
        </div>

        <div class="form-actions" style="margin-top:1rem;">
          <button class="btn btn-primary" (click)="handleSave()" [disabled]="saving">{{ 'sla.save' | translate }}</button>
        </div>
      </div>

      <div class="settings-card" style="margin-top:1.5rem">
        <h3>{{ 'sla.data_title' | translate }}</h3>
        <p>{{ 'sla.data_desc' | translate }}</p>
        <div class="form-actions">
          <button class="btn btn-danger" (click)="handleResetAll()" [disabled]="!canManageSla()">{{ 'sla.reset_all' | translate }}</button>
        </div>
      </div>
    </div>
  `
})
export class SlaComponent {
  private dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);

  importSlaMaxMinutes = 120;
  exportSlaMaxMinutes = 120;
  bgSlaMaxMinutes = 120;
  warningThreshold1 = 75;
  warningThreshold2 = 90;
  saving = false;
  canManageSla = computed(() => this.dataStore.canAccessAction('manage_sla'));
  isSuperAdmin = computed(() => this.dataStore.currentRole() === 'super_admin');

  constructor() {
    const current = this.dataStore.slaConfig();
    this.importSlaMaxMinutes = current.importSlaMaxMinutes;
    this.exportSlaMaxMinutes = current.exportSlaMaxMinutes;
    this.bgSlaMaxMinutes = current.bgSlaMaxMinutes;
    this.warningThreshold1 = current.warningThreshold1 ?? 75;
    this.warningThreshold2 = current.warningThreshold2 ?? 90;
  }

  async handleSave() {
    if (!this.canManageSla()) {
      this.showToast('info', 'Forbidden: current role cannot update SLA');
      return;
    }
    this.saving = true;
    try {
      await this.dataStore.saveSlaConfig({
        importSlaMaxMinutes: this.importSlaMaxMinutes,
        exportSlaMaxMinutes: this.exportSlaMaxMinutes,
        bgSlaMaxMinutes: this.bgSlaMaxMinutes,
        warningThreshold1: this.warningThreshold1,
        warningThreshold2: this.warningThreshold2,
      });
      this.showToast('success', this.ts.translate('toast.sla_saved'));
    } catch (e: any) {
      this.showToast('info', e.message || 'Failed to save SLA');
    } finally {
      this.saving = false;
    }
  }

  handleReset() {
    if (!this.canManageSla()) {
      this.showToast('info', 'Forbidden: current role cannot reset SLA');
      return;
    }
    this.importSlaMaxMinutes = 120;
    this.exportSlaMaxMinutes = 120;
    this.bgSlaMaxMinutes = 120;
    this.warningThreshold1 = 75;
    this.warningThreshold2 = 90;
    this.dataStore.saveSlaConfig({
      importSlaMaxMinutes: 120,
      exportSlaMaxMinutes: 120,
      bgSlaMaxMinutes: 120,
      warningThreshold1: 75,
      warningThreshold2: 90,
    }).then(() => {
      this.showToast('info', this.ts.translate('toast.sla_reset'));
    });
  }

  async handleResetAll() {
    if (!this.canManageSla()) {
      this.showToast('info', 'Forbidden: current role cannot reset data');
      return;
    }
    if (!confirm(this.ts.translate('toast.confirm_reset'))) return;
    try {
      await this.dataStore.resetAllData();
      const updated = this.dataStore.slaConfig();
      this.importSlaMaxMinutes = updated.importSlaMaxMinutes;
      this.exportSlaMaxMinutes = updated.exportSlaMaxMinutes;
      this.bgSlaMaxMinutes = updated.bgSlaMaxMinutes;
      this.warningThreshold1 = updated.warningThreshold1 ?? 75;
      this.warningThreshold2 = updated.warningThreshold2 ?? 90;
      this.showToast('info', this.ts.translate('toast.data_reset'));
    } catch (e: any) {
      this.showToast('info', e.message || 'Reset failed');
    }
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