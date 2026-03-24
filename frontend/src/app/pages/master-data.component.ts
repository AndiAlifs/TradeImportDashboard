import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-master-data',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="page-content">
      <!-- Add Form -->
      <div class="settings-card">
        <h3>{{ titleKey | translate }}</h3>
        <p>{{ descKey | translate }}</p>

        <form (ngSubmit)="handleAdd()" style="margin-top: 1.5rem;">
          <div class="form-group">
            <label [for]="'master-name'">{{ nameLabel | translate }}</label>
            <input type="text" id="master-name" [(ngModel)]="newName" name="name" required [placeholder]="namePlaceholder | translate" />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="submitting || !canManage()">{{ submitLabel | translate }}</button>
          </div>
        </form>
      </div>

      <!-- List Table -->
      <div class="data-table-wrapper" style="margin-top:1.5rem">
        <div class="table-header">
          <h3>{{ listTitle | translate }}</h3>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ colNameKey | translate }}</th>
              <th style="width: 120px; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="items().length === 0">
              <td colspan="3" style="text-align:center;color:var(--text-muted);padding:2rem">{{ emptyKey | translate }}</td>
            </tr>
            <tr *ngFor="let item of items(); let i = index">
              <td style="color:var(--text-muted)">{{ i + 1 }}</td>
              <td>
                <ng-container *ngIf="editingId !== item.id">
                  {{ item.name }}
                </ng-container>
                <ng-container *ngIf="editingId === item.id">
                  <input type="text" [(ngModel)]="editName" class="form-control" style="padding: 0.25rem 0.5rem; width: 100%; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-modifier); color: var(--text-base);" />
                </ng-container>
              </td>
              <td style="text-align: center;">
                <ng-container *ngIf="editingId !== item.id">
                  <button class="btn btn-icon" style="padding: 0.25rem 0.5rem; font-size: 0.875rem; background: transparent; border: none; cursor: pointer;" [disabled]="!canManage()" (click)="startEdit(item)" title="Edit">✏️</button>
                  <button class="btn btn-icon" style="padding: 0.25rem 0.5rem; font-size: 0.875rem; background: transparent; border: none; cursor: pointer; color: #ef4444;" [disabled]="!canManage()" (click)="handleDelete(item)" title="Delete">🗑️</button>
                </ng-container>
                <ng-container *ngIf="editingId === item.id">
                  <button class="btn btn-icon" style="padding: 0.25rem 0.5rem; font-size: 0.875rem; background: transparent; border: none; cursor: pointer; color: #10b981;" [disabled]="!canManage()" (click)="saveEdit(item)" title="Save">💾</button>
                  <button class="btn btn-icon" style="padding: 0.25rem 0.5rem; font-size: 0.875rem; background: transparent; border: none; cursor: pointer;" (click)="cancelEdit()" title="Cancel">❌</button>
                </ng-container>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class MasterDataComponent implements OnInit {
  private dataStore = inject(DataStoreService);
  private route = inject(ActivatedRoute);
  private ts = inject(TranslationService);

  dataType: 'assignee' | 'officer' = 'assignee';
  newName = '';
  submitting = false;

  // Translation keys based on type
  titleKey = '';
  descKey = '';
  nameLabel = '';
  namePlaceholder = '';
  submitLabel = '';
  listTitle = '';
  colNameKey = '';
  emptyKey = '';

  ngOnInit() {
    this.dataType = this.route.snapshot.data['type'] || 'assignee';
    if (this.dataType === 'assignee') {
      this.titleKey = 'assignee.title';
      this.descKey = 'assignee.desc';
      this.nameLabel = 'assignee.form.name';
      this.namePlaceholder = 'assignee.form.placeholder';
      this.submitLabel = 'assignee.form.submit';
      this.listTitle = 'assignee.list_title';
      this.colNameKey = 'assignee.col_name';
      this.emptyKey = 'assignee.empty';
    } else {
      this.titleKey = 'officer_registration.title';
      this.descKey = 'officer_registration.desc';
      this.nameLabel = 'officer_registration.form.name';
      this.namePlaceholder = 'officer_registration.form.placeholder';
      this.submitLabel = 'officer_registration.form.submit';
      this.listTitle = 'officer_registration.list_title';
      this.colNameKey = 'officer_registration.col_name';
      this.emptyKey = 'officer_registration.empty';
    }
  }

  items = computed(() => this.dataType === 'assignee' ? this.dataStore.assignees() : this.dataStore.officers());

  canManage = computed(() => {
    if (this.dataType === 'assignee') {
      return this.dataStore.canAccessAction('manage_assignee');
    }
    return this.dataStore.canAccessAction('manage_officer');
  });

  async handleAdd() {
    if (!this.canManage()) {
      this.showToast('info', 'Forbidden: current role cannot manage this master data');
      return;
    }
    if (this.submitting || !this.newName.trim()) return;
    this.submitting = true;
    try {
      if (this.dataType === 'assignee') {
        await this.dataStore.createAssignee({ name: this.newName.trim() });
        this.showToast('success', this.ts.translate('toast.assignee_added') || 'Assignee added successfully');
      } else {
        await this.dataStore.createOfficer({ name: this.newName.trim() });
        this.showToast('success', this.ts.translate('toast.officer_added') || 'Officer added successfully');
      }
      this.newName = '';
    } catch (e: any) {
      const failKey = this.dataType === 'assignee' ? 'toast.assignee_add_failed' : 'toast.officer_add_failed';
      this.showToast('info', this.ts.translate(failKey) || 'Failed to add item');
    } finally {
      this.submitting = false;
    }
  }

  editingId: number | null = null;
  editName = '';

  startEdit(item: any) {
    if (!this.canManage()) return;
    this.editingId = item.id;
    this.editName = item.name;
  }

  cancelEdit() {
    this.editingId = null;
    this.editName = '';
  }

  async saveEdit(item: any) {
    if (!this.canManage()) {
      this.showToast('info', 'Forbidden: current role cannot update this master data');
      return;
    }
    if (!this.editName.trim()) return;
    try {
      if (this.dataType === 'assignee') {
        await this.dataStore.updateAssignee(item.id, { name: this.editName.trim() });
        this.showToast('success', 'Assignee updated successfully');
      } else {
        await this.dataStore.updateOfficer(item.id, { name: this.editName.trim() });
        this.showToast('success', 'Officer updated successfully');
      }
      this.editingId = null;
    } catch (e: any) {
      this.showToast('info', 'Failed to update item');
    }
  }

  async handleDelete(item: any) {
    if (!this.canManage()) {
      this.showToast('info', 'Forbidden: current role cannot delete this master data');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
    try {
      if (this.dataType === 'assignee') {
        await this.dataStore.deleteAssignee(item.id);
        this.showToast('success', 'Assignee deleted successfully');
      } else {
        await this.dataStore.deleteOfficer(item.id);
        this.showToast('success', 'Officer deleted successfully');
      }
    } catch (e: any) {
      this.showToast('info', 'Failed to delete item');
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