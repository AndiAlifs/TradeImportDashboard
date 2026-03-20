import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-create-order',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="page-content">
      <div class="settings-card">
        <h3>{{ 'create.title' | translate }}</h3>
        <p>{{ 'create.desc' | translate }}</p>

        <form (ngSubmit)="handleSubmit()" style="margin-top: 1.5rem;">
          <div class="form-group">
            <label for="create-type">{{ 'create.form.type' | translate }}</label>
            <select id="create-type" [(ngModel)]="formData.transactionType" name="transactionType" required>
              <option value="Import">Import</option>
              <option value="Export">Export</option>
            </select>
          </div>
          <div class="form-group">
            <label for="create-sender">{{ 'create.form.sender' | translate }}</label>
            <input type="email" id="create-sender" [(ngModel)]="formData.senderEmail" name="senderEmail" required placeholder="exporter@client.com" />
          </div>
          <div class="form-group">
            <label for="create-subject">{{ 'create.form.subject' | translate }}</label>
            <input type="text" id="create-subject" [(ngModel)]="formData.subject" name="subject" required placeholder="L/C Application – PO#1234" />
          </div>
          <div class="form-group">
            <label for="create-assigned">{{ 'create.form.assigned' | translate }}</label>
            <select id="create-assigned" [(ngModel)]="formData.assignedTo" name="assignedTo" required>
              <option value="" disabled *ngIf="assigneeList().length === 0">{{ 'create.form.assigned_loading' | translate }}</option>
              <option *ngFor="let a of assigneeList()" [value]="a.name">{{ a.name }}</option>
            </select>
          </div>
          <div class="form-actions" style="margin-top: 2rem;">
            <button type="submit" class="btn btn-primary" [disabled]="submitting">{{ 'create.form.submit' | translate }}</button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class CreateOrderComponent {
  private dataStore = inject(DataStoreService);
  private router = inject(Router);
  private ts = inject(TranslationService);

  assigneeList = computed(() => this.dataStore.assignees());

  formData = {
    transactionType: 'Import',
    senderEmail: '',
    subject: '',
    assignedTo: '',
  };
  submitting = false;

  async handleSubmit() {
    if (this.submitting) return;
    this.submitting = true;
    try {
      await this.dataStore.createLCOrder({
        transactionType: this.formData.transactionType,
        senderEmail: this.formData.senderEmail,
        subject: this.formData.subject,
        assignedTo: this.formData.assignedTo,
      });
      this.showToast('success', this.ts.translate('toast.order_created'));
      this.formData = { transactionType: 'Import', senderEmail: '', subject: '', assignedTo: '' };
      this.router.navigate(['/queue']);
    } catch (e: any) {
      this.showToast('info', e.message || 'Failed to create order');
    } finally {
      this.submitting = false;
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