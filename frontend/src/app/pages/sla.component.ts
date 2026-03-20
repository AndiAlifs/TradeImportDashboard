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
          <label for="sla-min">{{ 'sla.min_label' | translate }}</label>
          <input type="number" id="sla-min" [(ngModel)]="slaMin" min="1" />
        </div>

        <div class="form-group">
          <label for="sla-max">{{ 'sla.max_label' | translate }}</label>
          <input type="number" id="sla-max" [(ngModel)]="slaMax" min="1" />
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" (click)="handleSave()" [disabled]="saving">{{ 'sla.save' | translate }}</button>
          <button class="btn btn-secondary" (click)="handleReset()">{{ 'sla.reset_default' | translate }}</button>
        </div>
      </div>

      <div class="settings-card" style="margin-top:1.5rem">
        <h3>{{ 'sla.data_title' | translate }}</h3>
        <p>{{ 'sla.data_desc' | translate }}</p>
        <div class="form-actions">
          <button class="btn btn-danger" (click)="handleResetAll()">{{ 'sla.reset_all' | translate }}</button>
        </div>
      </div>
    </div>
  `
})
export class SlaComponent {
  private dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);

  slaMin = 90;
  slaMax = 120;
  saving = false;

  constructor() {
    const current = this.dataStore.slaConfig();
    this.slaMin = current.slaMinMinutes;
    this.slaMax = current.slaMaxMinutes;
  }

  async handleSave() {
    this.saving = true;
    try {
      await this.dataStore.saveSlaConfig({ slaMinMinutes: this.slaMin, slaMaxMinutes: this.slaMax });
      this.showToast('success', this.ts.translate('toast.sla_saved'));
    } catch (e: any) {
      this.showToast('info', e.message || 'Failed to save SLA');
    } finally {
      this.saving = false;
    }
  }

  handleReset() {
    this.slaMin = 90;
    this.slaMax = 120;
    this.dataStore.saveSlaConfig({ slaMinMinutes: 90, slaMaxMinutes: 120 }).then(() => {
      this.showToast('info', this.ts.translate('toast.sla_reset'));
    });
  }

  async handleResetAll() {
    if (!confirm(this.ts.translate('toast.confirm_reset'))) return;
    try {
      await this.dataStore.resetAllData();
      const updated = this.dataStore.slaConfig();
      this.slaMin = updated.slaMinMinutes;
      this.slaMax = updated.slaMaxMinutes;
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