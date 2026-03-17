import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from '../services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // necessary to update when signal/language changes internally, or we can just pass the signal value
})
export class TranslatePipe implements PipeTransform {

  constructor(private translationService: TranslationService) {}

  transform(key: string, _triggerRenender?: string): string {
    return this.translationService.translate(key);
  }
}