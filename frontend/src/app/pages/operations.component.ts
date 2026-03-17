import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-operations',
  standalone: true,
  imports: [CommonModule],
  template: `<h2>{{ type }} Operations <small>(Refactoring in progress...)</small></h2>`
})
export class OperationsComponent {
  @Input() type: 'Import' | 'Export' = 'Import';
}