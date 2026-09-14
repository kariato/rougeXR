export interface XrSessionLike extends EventTarget { end(): Promise<void> }
export interface XrSystemLike {
  isSessionSupported(mode: 'immersive-vr'): Promise<boolean>;
  requestSession(mode: 'immersive-vr', options: { optionalFeatures: string[] }): Promise<XrSessionLike>;
}

export type XrCapability = 'checking' | 'unavailable' | 'available' | 'active';

export class XrSessionController {
  private session: XrSessionLike | null = null;
  private capability: XrCapability = 'checking';

  constructor(private readonly system: XrSystemLike | null, private readonly attach: (session: XrSessionLike | null) => Promise<void>) {}

  status(): XrCapability { return this.capability; }

  async detect(): Promise<XrCapability> {
    try { this.capability = this.system && await this.system.isSessionSupported('immersive-vr') ? 'available' : 'unavailable'; }
    catch { this.capability = 'unavailable'; }
    return this.capability;
  }

  async toggle(): Promise<XrCapability> {
    if (this.session) { await this.session.end(); return this.capability; }
    if (!this.system || this.capability !== 'available') return this.capability;
    const session = await this.system.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    this.session = session; session.addEventListener('end', this.onEnd, { once: true });
    await this.attach(session); this.capability = 'active'; return this.capability;
  }

  private readonly onEnd = (): void => {
    this.session = null; this.capability = this.system ? 'available' : 'unavailable'; void this.attach(null);
  };
}
