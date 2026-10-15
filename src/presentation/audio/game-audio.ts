import type { PresentationEvent } from '../../engine/model/action';
import type { PlayerObservation } from '../../engine/model/observation';
export type SoundCue = 'step' | 'swing' | 'hit' | 'hurt' | 'pickup' | 'door' | 'stairs' | 'death' | 'victory' | 'magic';

/** Only disclosed events and player health may produce sounds. */
export function soundCues(observation: PlayerObservation, events: readonly PresentationEvent[], previousHp: number): SoundCue[] {
  const cues = new Set<SoundCue>();
  if (observation.status.hp < previousHp) cues.add('hurt');
  for (const event of events) {
    if (event.type === 'visibleMovement' && event.token === 'player') {
      cues.add(observation.cells[event.to.y * observation.width + event.to.x]?.appearance?.terrainLabel === 'door' ? 'door' : 'step');
    }
    if (event.type === 'visibleAttack') {
      if (event.attackerToken === 'player') cues.add('swing');
      if (event.hit) cues.add(event.defenderToken === 'player' ? 'hurt' : 'hit');
    }
    if (event.type === 'visibleDiscovery') cues.add('magic');
    if (event.type === 'levelViewReset') cues.add('stairs');
    if (event.type === 'visiblePlayerAction' && ['drink', 'read', 'zap'].includes(event.action)) cues.add('magic');
    if (event.type === 'message') {
      if (/gold pieces|Added .*to your pack|open the chest/i.test(event.text)) cues.add('pickup');
      if (/escaped with the Amulet/i.test(event.text)) cues.add('victory');
    }
  }
  if (observation.status.hp <= 0 && previousHp > 0) cues.add('death');
  return [...cues];
}

/** Lightweight synthesized effects: no audio downloads, engine RNG, or hidden actors. */
export class GameAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private revision: number | null = null;
  private hp = 0;
  private noise: AudioBuffer | null = null;
  enabled = true;
  volume = .35;
  constructor() {
    try { this.enabled = localStorage.getItem('rougexr.sound-enabled') !== 'false';
      const volume = localStorage.getItem('rougexr.sound-volume');
      if (volume !== null && Number.isFinite(Number(volume))) this.volume = Math.max(0, Math.min(1, Number(volume)));
    } catch { /* Audio still works without preference storage. */ }
  }
  async unlock(): Promise<void> {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.gain = this.context.createGain(); this.gain.connect(this.context.destination);
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        let seed = 137;
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
      }
      this.gain!.gain.value = this.enabled ? this.volume * .28 : 0;
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { /* Unsupported/blocked audio must never interrupt gameplay. */ }
  }
  configure(enabled: boolean, volume = this.volume): void {
    this.enabled = enabled; this.volume = Math.max(0, Math.min(1, volume));
    if (this.gain) this.gain.gain.value = enabled ? this.volume * .28 : 0;
    try { localStorage.setItem('rougexr.sound-enabled', String(enabled)); localStorage.setItem('rougexr.sound-volume', String(this.volume)); } catch { /* Optional preferences. */ }
    if (enabled) void this.unlock();
  }
  reset(): void { this.revision = null; }
  update(observation: PlayerObservation, events: readonly PresentationEvent[]): SoundCue[] {
    const cues = this.revision !== null && this.revision !== observation.revision ? soundCues(observation, events, this.hp) : [];
    this.revision = observation.revision; this.hp = observation.status.hp;
    if (this.enabled && cues.length) {
      if (this.context?.state === 'running') for (const cue of cues) this.play(cue);
      else void this.unlock().then(() => {
        // A browser may finish resuming audio after the action has rendered.
        // Drop stale cues instead of playing a backlog after further moves.
        if (this.enabled && this.context?.state === 'running' && this.revision === observation.revision)
          for (const cue of cues) this.play(cue);
      });
    }
    return cues;
  }
  private tone(frequency: number, end: number, duration: number, delay = 0, type: OscillatorType = 'sine', strength = .35): void {
    const ctx = this.context!, oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(.001, start); gain.gain.linearRampToValueAtTime(strength, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain); gain.connect(this.gain!); oscillator.start(start); oscillator.stop(start + duration + .02);
  }
  private rustle(duration: number, cutoff: number, strength: number): void {
    const ctx = this.context!, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(strength, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.gain!); source.start(); source.stop(ctx.currentTime + duration);
  }
  private play(cue: SoundCue): void {
    switch (cue) {
      case 'step': this.rustle(.09, 650, .7); this.tone(100, 55, .08); break;
      case 'swing': this.rustle(.18, 2500, .5); break;
      case 'hit': this.rustle(.12, 1500, .7); this.tone(180, 55, .13, .06, 'triangle'); break;
      case 'hurt': this.tone(95, 40, .22, 0, 'sawtooth', .24); break;
      case 'pickup': this.tone(900, 1200, .12); this.tone(1350, 1500, .18, .1); break;
      case 'door': this.tone(150, 70, .3, 0, 'triangle'); this.rustle(.24, 800, .3); break;
      case 'stairs': [440, 330, 220].forEach((pitch, i) => this.tone(pitch, pitch * .8, .2, i * .12)); break;
      case 'death': [180, 135, 90, 45].forEach((pitch, i) => this.tone(pitch, pitch * .6, .6, i * .18, 'triangle')); break;
      case 'victory': [262, 330, 392, 523].forEach((pitch, i) => this.tone(pitch, pitch, .4, i * .18, 'triangle')); break;
      case 'magic': this.tone(400, 1500, .35, 0, 'sine', .2); break;
    }
  }
}
