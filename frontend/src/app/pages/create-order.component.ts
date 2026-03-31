import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

type CreateOrderFormData = {
  transactionType: string;
  urn: string;
  subject: string;
  assignedTo: string;
  receivedAt: string;
};

@Component({
  selector: 'app-create-order',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="page-content">
      <div class="settings-card">
        <h3>{{ 'create.title' | translate }} ({{ transactionType() }})</h3>
        <p>{{ 'create.desc' | translate }}</p>

        <form (ngSubmit)="handleSubmit()" style="margin-top: 1.5rem;">
          <div class="form-group">
            <label for="create-type">{{ 'create.form.type' | translate }}</label>
            <input type="text" id="create-type" [value]="formData.transactionType" disabled style="background-color: var(--bg-hover)"/>
          </div>
          <div class="form-group">
            <label for="create-urn">{{ 'create.form.urn' | translate }}</label>
            <input type="text" id="create-urn" [(ngModel)]="formData.urn" name="urn" required placeholder="LC-20260325-001" />
          </div>
          <div class="form-group">
            <label for="create-subject">{{ 'create.form.subject' | translate }}</label>
            <input type="text" id="create-subject" [(ngModel)]="formData.subject" name="subject" required placeholder="L/C Application – PO#1234" />
          </div>
          <div class="form-group">
            <label for="create-received-at">{{ 'create.form.received_at' | translate }}</label>
            <input type="datetime-local" id="create-received-at" [(ngModel)]="formData.receivedAt" name="receivedAt" required />
          </div>
          <div class="form-group">
            <label for="create-assigned">{{ 'create.form.assigned' | translate }}</label>
            <select id="create-assigned" [(ngModel)]="formData.assignedTo" name="assignedTo" required>
              <option value="" disabled *ngIf="assigneeList().length === 0">{{ 'create.form.assigned_loading' | translate }}</option>
              <option *ngFor="let a of assigneeList()" [value]="a.name">{{ a.name }}</option>
            </select>
          </div>
          <div class="form-actions" style="margin-top: 2rem;">
            <button type="submit" class="btn btn-primary" [disabled]="submitting || !canCreate()">{{ 'create.form.submit' | translate }}</button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class CreateOrderComponent implements OnInit {
  private dataStore = inject(DataStoreService);
  private router = inject(Router);
  private ts = inject(TranslationService);
  private route = inject(ActivatedRoute);

  assigneeList = computed(() => this.dataStore.assignees().filter(a => a.section === this.transactionType()));
  canCreate = computed(() => this.dataStore.canAccessAction('create_lc', this.transactionType()));

  transactionType = signal<string>('Import');

  formData: CreateOrderFormData = {
    transactionType: 'Import',
    urn: '',
    subject: '',
    assignedTo: '',
    receivedAt: '',
  };
  submitting = false;

  ngOnInit() {
    this.formData.receivedAt = this.nowForDateTimeLocal();
    this.route.data.subscribe(data => {
      if (data['type']) {
        this.transactionType.set(data['type']);
        this.formData.transactionType = data['type'];
      }
    });
  }

  async handleSubmit() {
    if (!this.canCreate()) {
      this.showToast('info', 'Forbidden: current role cannot create this transaction type');
      return;
    }
    if (this.submitting) return;
    this.submitting = true;
    try {
      await this.dataStore.createLCOrder({
        transactionType: this.formData.transactionType,
        urn: this.formData.urn,
        subject: this.formData.subject,
        assignedTo: this.formData.assignedTo,
        receivedAt: this.toIsoOrThrow(this.formData.receivedAt),
      });
      this.showToast('success', this.ts.translate('toast.order_created'));
      this.formData = {
        transactionType: this.transactionType(),
        urn: '',
        subject: '',
        assignedTo: '',
        receivedAt: this.nowForDateTimeLocal(),
      };
      this.router.navigate([`/${this.transactionType().toLowerCase()}/queue`]);
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

  private nowForDateTimeLocal(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  private toIsoOrThrow(localDateTime: string): string {
    const parsed = new Date(localDateTime);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(this.ts.translate('create.form.received_at_invalid'));
    }
    return parsed.toISOString();
  }
}