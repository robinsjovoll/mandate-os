import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('renders the MandateOS brand shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.brand-name')?.textContent).toContain(
      'MandateOS',
    );
    expect(compiled.querySelectorAll('.integration-card')).toHaveLength(4);
    expect(compiled.querySelectorAll('.package-card')).toHaveLength(3);
    expect(compiled.querySelectorAll('.installer-card')).toHaveLength(3);
    expect(compiled.querySelector('.hero-copy h1')?.textContent).toContain(
      'Put real guardrails',
    );
    expect(
      compiled.querySelector('.env-card .command-block')?.textContent,
    ).toContain('MANDATE_OS_BASE_URL');
  });
});
