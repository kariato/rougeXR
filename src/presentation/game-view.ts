import type { PresentationEvent } from '../engine/model/action';
import type { PlayerObservation } from '../engine/model/observation';

/** A presentation owns only DOM/render state; gameplay remains in GameSession. */
export interface GameView {
  mount(host: HTMLElement): void;
  update(observation: PlayerObservation, events: PresentationEvent[]): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
