import type { Page } from '@playwright/test';

/** Deterministic local-only XR runtime. It drives Three.js's real stereo WebGL renderer, not a mocked view. */
export async function installXrRuntime(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const telemetry = {
      frames: 0, sessions: 0, ended: 0, spaces: [] as string[], rejectAttach: false,
      trackingX: 0, trackingY: 0, aimX: 0, aimY: 0, aimZ: -1, leftPixels: 0, rightPixels: 0, image: '',
      session: null as FakeSession | null, capture: false, trace: [] as Array<{ left: number; right: number }>,
    };
    Object.assign(window, { xrTest: telemetry });
    Object.defineProperty(WebGL2RenderingContext.prototype, 'makeXRCompatible', {
      configurable: true, value: async () => { if (telemetry.rejectAttach) throw new Error('XR test: incompatible GPU'); },
    });
    class FakeSpace extends EventTarget {}
    class FakeLayer {
      framebuffer = null;
      framebufferWidth = 640;
      framebufferHeight = 320;
      fixedFoveation = 0;
      constructor(_session: unknown, readonly gl: WebGL2RenderingContext) {}
      getViewport(view: { eye: string }) { return { x: view.eye === 'left' ? 0 : 320, y: 0, width: 320, height: 320 }; }
    }
    Object.assign(window, { XRWebGLLayer: FakeLayer });
    class FakeSession extends EventTarget {
      inputSources: Array<{ handedness: string; targetRayMode: string; profiles: string[]; targetRaySpace: object; gamepad: { axes: number[]; mapping: string } }> = [];
      lastFrame: object | null = null;
      releaseStickAfterFrame = false;
      pulseStick(axes: number[]) { this.inputSources[0]!.gamepad.axes = axes; this.releaseStickAfterFrame = true; }
      connectController(handedness = 'right', axes = [0, 0, 0, 0]) {
        const input = { handedness, targetRayMode: 'tracked-pointer', profiles: [], targetRaySpace: {}, gamepad: { axes, mapping: 'xr-standard' } };
        this.inputSources.push(input);
        const event = new Event('inputsourceschange'); Object.assign(event, { added: [input], removed: [] }); this.dispatchEvent(event);
      }
      gesture(type: 'select' | 'squeeze') { const event = new Event(type); Object.assign(event, { inputSource: this.inputSources[0], frame: this.lastFrame }); this.dispatchEvent(event); }
      select() { this.gesture('select'); }
      squeeze() { this.gesture('squeeze'); }
      enabledFeatures = [];
      environmentBlendMode = 'opaque';
      visibilityState = 'visible';
      renderState = { baseLayer: null as FakeLayer | null, depthNear: .05, depthFar: 120 };
      stopped = false;
      updateRenderState(state: Partial<FakeSession['renderState']>) { Object.assign(this.renderState, state); }
      async requestReferenceSpace(type: string) {
        telemetry.spaces.push(type);
        if (type !== 'local') throw new DOMException('Floor tracking is unavailable on this phone.', 'NotSupportedError');
        return new FakeSpace();
      }
      requestAnimationFrame(callback: (time: number, frame: unknown) => void): number {
        return window.requestAnimationFrame(time => {
          if (this.stopped) return;
          const near = this.renderState.depthNear, far = this.renderState.depthFar;
          const projectionMatrix = new Float32Array([1.2, 0, 0, 0, 0, 1.2, 0, 0, 0, 0, -(far + near) / (far - near), -1, 0, 0, -2 * far * near / (far - near), 0]);
          const length = Math.hypot(telemetry.aimX, telemetry.aimY, telemetry.aimZ);
          const z = [-telemetry.aimX / length, -telemetry.aimY / length, -telemetry.aimZ / length];
          const sideLength = Math.hypot(z[2]!, z[0]!);
          const x = [z[2]! / sideLength, 0, -z[0]! / sideLength];
          const y = [z[1]! * x[2]!, z[2]! * x[0]! - z[0]! * x[2]!, -z[1]! * x[0]!];
          const frame = { session: this,
            getPose: () => ({ transform: { matrix: new Float32Array([...x, 0, ...y, 0, ...z, 0, telemetry.trackingX, telemetry.trackingY, 0, 1]) } }),
            getViewerPose: () => ({ views: ['left', 'right'].map(eye => ({ eye, projectionMatrix,
            transform: { matrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
              telemetry.trackingX + (eye === 'left' ? -.032 : .032), telemetry.trackingY, 0, 1]) },
          })) }) };
          this.lastFrame = frame; callback(time, frame);
          if (this.releaseStickAfterFrame) { this.inputSources[0]!.gamepad.axes.fill(0); this.releaseStickAfterFrame = false; }
          telemetry.frames++;
          const layer = this.renderState.baseLayer;
          if (!layer) return;
          const gl = layer.gl;
          const pixels = new Uint8Array(640 * 320 * 4);
          gl.readPixels(0, 0, 640, 320, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          for (const [index, key] of ['leftPixels', 'rightPixels'].entries()) {
            let lit = 0;
            // The center of each eye excludes HUD panels and the held weapon.
            for (let y = 130; y < 190; y += 3) for (let x = 100 + index * 320; x < 180 + index * 320; x += 3) {
              const offset = (y * 640 + x) * 4;
              if (Math.max(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!) > 30) lit++;
            }
            telemetry[key as 'leftPixels' | 'rightPixels'] = lit;
          }
          if (telemetry.capture) telemetry.trace.push({ left: telemetry.leftPixels, right: telemetry.rightPixels });
          if (telemetry.frames % 10 === 0) {
            const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 320;
            const context = canvas.getContext('2d')!;
            const flipped = new Uint8ClampedArray(pixels.length);
            for (let y = 0; y < 320; y++) flipped.set(pixels.subarray(y * 640 * 4, (y + 1) * 640 * 4), (319 - y) * 640 * 4);
            context.putImageData(new ImageData(flipped, 640, 320), 0, 0);
            telemetry.image = canvas.toDataURL();
          }
        });
      }
      cancelAnimationFrame(id: number) { window.cancelAnimationFrame(id); }
      async end() { if (this.stopped) return; this.stopped = true; telemetry.ended++; this.dispatchEvent(new Event('end')); }
    }
    Object.defineProperty(navigator, 'xr', { configurable: true, value: {
      isSessionSupported: async (mode: string) => mode === 'immersive-vr',
      requestSession: async () => { telemetry.sessions++; telemetry.session = new FakeSession(); return telemetry.session; },
    } });
  });
}
