import { CommonModule } from '@angular/common';
import { Component, HostListener, signal } from '@angular/core';
import { MANDATE_OS_CONTENT } from './mandate-os-content';

@Component({
  imports: [CommonModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly content = MANDATE_OS_CONTENT;
  protected readonly year = new Date().getFullYear();
  protected readonly isProofPreviewOpen = signal(false);

  protected openProofPreview() {
    this.isProofPreviewOpen.set(true);
  }

  protected closeProofPreview() {
    this.isProofPreviewOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected handleEscape() {
    if (this.isProofPreviewOpen()) {
      this.closeProofPreview();
    }
  }
}
