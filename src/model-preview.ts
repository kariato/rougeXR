import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const requestedModel = new URLSearchParams(location.search).get('model');
const model = requestedModel === 'aquator' || requestedModel === 'bat' || requestedModel === 'centaur' || requestedModel === 'ice-monster' || requestedModel === 'kestrel' || requestedModel === 'leprechaun' || requestedModel === 'nymph' || requestedModel === 'orc' || requestedModel === 'quagga' || requestedModel === 'rattlesnake' || requestedModel === 'snake' || requestedModel === 'zombie' ? requestedModel : 'hobgoblin';
const modelSelector = document.querySelector<HTMLSelectElement>('#model')!;
modelSelector.value = model;
modelSelector.addEventListener('change', () => { location.search = new URLSearchParams({ model: modelSelector.value }).toString(); });
const displayName = model.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const title = `${displayName} · model study`;
document.querySelector('h1')!.textContent = title; document.title = title;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x111820);
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 50); camera.position.set(2, 1.7, 3.4);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0.72, 0); controls.update();
if (model === 'kestrel' || model === 'bat') { camera.position.set(1.25, 1.65, 2.0); controls.target.set(0, 0.8, 0); controls.update(); }
if (model === 'rattlesnake' || model === 'snake') { camera.position.set(1.2, 1.3, 1.9); controls.target.set(0, 0.18, -0.12); controls.update(); }
scene.add(new THREE.HemisphereLight(0xe6efff, 0x716244, 2.5));
const key = new THREE.DirectionalLight(0xffe4b3, 3); key.position.set(3, 5, 4); scene.add(key);
const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 64), new THREE.MeshStandardMaterial({ color: 0x27313a, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.015; scene.add(floor);
const selector = document.querySelector<HTMLSelectElement>('#animation')!;
const status = document.querySelector<HTMLElement>('#status')!;
let mixer: THREE.AnimationMixer | null = null;
let active: THREE.AnimationAction | null = null;
new GLTFLoader().load(`/assets/creatures/${model}.glb`, gltf => {
  scene.add(gltf.scene); mixer = new THREE.AnimationMixer(gltf.scene);
  selector.replaceChildren(...gltf.animations.map(clip => { const option = document.createElement('option'); option.value = clip.name; option.textContent = clip.name; return option; }));
  const play = (): void => {
    const clip = gltf.animations.find(candidate => candidate.name === selector.value); if (!clip || !mixer) return;
    active?.stop(); mixer.stopAllAction(); active = mixer.clipAction(clip); active.reset();
    active.setLoop(['idle', 'move'].includes(clip.name) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    active.clampWhenFinished = true; active.play();
  };
  selector.value = 'idle'; selector.addEventListener('change', play); play();
  status.textContent = `${gltf.animations.length} exported animations · original procedural Blender asset`;
}, undefined, error => { status.textContent = `Unable to load model: ${String(error)}`; });
function resize(): void { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let previous = performance.now();
renderer.setAnimationLoop(now => { mixer?.update(Math.min((now - previous) / 1000, 0.1)); previous = now; renderer.render(scene, camera); });
