export interface XrSessionLike extends EventTarget { end(): Promise<void> }
export interface XrSystemLike {
  isSessionSupported(mode: 'immersive-vr'): Promise<boolean>;
  requestSession(mode: 'immersive-vr', options: { optionalFeatures: string[] }): Promise<XrSessionLike>;
}

export type XrCapability = 'checking' | 'unavailable' | 'available' | 'active';

export class XrSessionController {
  private session: XrSessionLike | null = null;
  private capability: XrCapability = 'checking';
  private busy = false;
  private cleanup: Promise<void> = Promise.resolve();

  constructor(private readonly system: XrSystemLike | null,
    private readonly attach: (session: XrSessionLike | null) => Promise<void>,
    private readonly changed: (status: XrCapability) => void = () => {},
    private readonly failed: (error: unknown) => void = () => {}) {}

  status(): XrCapability { return this.capability; }
  private setStatus(status: XrCapability): void { this.capability = status; this.changed(status); }

  async detect(): Promise<XrCapability> {
    try { this.setStatus(this.system && await this.system.isSessionSupported('immersive-vr') ? 'available' : 'unavailable'); }
    catch { this.setStatus('unavailable'); }
    return this.capability;
  }

  async toggle(): Promise<XrCapability> {
    if (this.busy) return this.capability;
    this.busy = true;
    let requested: XrSessionLike | null = null;
    try {
      if (this.session) { await this.session.end(); await this.cleanup; return this.capability; }
      if (!this.system || this.capability !== 'available') return this.capability;
      requested = await this.system.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      this.session = requested;
      requested.addEventListener('end', this.onEnd, { once: true });
      await this.attach(requested);
      if (this.session === requested) this.setStatus('active');
      else await this.cleanup;
      return this.capability;
    } catch (error) {
      if (requested && this.session === requested) {
        requested.removeEventListener('end', this.onEnd);
        this.session = null;
        try { await requested.end(); } catch { /* Preserve the original attachment error. */ }
        try { await this.attach(null); } catch { /* The original error is reported to the caller. */ }
      }
      this.setStatus(this.system ? 'available' : 'unavailable');
      throw error;
    } finally { this.busy = false; }
  }

  private readonly onEnd = (): void => {
    this.session = null;
    // Let the renderer's session-end listener restore its framebuffer before detaching the view.
    this.cleanup = Promise.resolve().then(() => this.attach(null)).catch(error => this.failed(error)).then(() => {
      this.setStatus(this.system ? 'available' : 'unavailable');
    });
  };
}
