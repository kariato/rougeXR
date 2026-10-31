import { assetUrl } from "./asset-url";
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const query = new URLSearchParams(location.search);
const localMonsters = query.get('set') === 'hunyuan-v1';
const localProps = query.get('set') === 'hunyuan-props-v1';
const localSet = localMonsters || localProps;
const propModels = ['door', 'chest', 'torch', 'urn', 'pillar', 'potion'];
const assetSet = document.querySelector<HTMLSelectElement>('#asset-set')!;
assetSet.value = localProps ? 'hunyuan-props-v1' : localMonsters ? 'hunyuan-v1' : 'original';
assetSet.addEventListener('change', () => { query.set('set', assetSet.value); location.search = query.toString(); });
const requestedModel = query.get('model');
const monsterModel = requestedModel === 'aquator' || requestedModel === 'bat' || requestedModel === 'black-unicorn' || requestedModel === 'centaur' || requestedModel === 'dragon' || requestedModel === 'emu' || requestedModel === 'griffin' || requestedModel === 'ice-monster' || requestedModel === 'jabberwock' || requestedModel === 'kestrel' || requestedModel === 'leprechaun' || requestedModel === 'medusa' || requestedModel === 'nymph' || requestedModel === 'orc' || requestedModel === 'phantom' || requestedModel === 'quagga' || requestedModel === 'rattlesnake' || requestedModel === 'snake' || requestedModel === 'troll' || requestedModel === 'venus-flytrap' || requestedModel === 'vampire' || requestedModel === 'wraith' || requestedModel === 'xeroc' || requestedModel === 'yeti' || requestedModel === 'zombie' ? requestedModel : 'hobgoblin';
const model = localProps ? requestedModel && propModels.includes(requestedModel) ? requestedModel : 'door' : monsterModel;
const modelSelector = document.querySelector<HTMLSelectElement>('#model')!;
if (localProps) modelSelector.replaceChildren(...propModels.map(id => { const option = document.createElement('option'); option.value = id; option.textContent = id[0]!.toUpperCase() + id.slice(1); return option; }));
modelSelector.value = model;
modelSelector.addEventListener('change', () => { query.set('model', modelSelector.value); location.search = query.toString(); });
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
new GLTFLoader().load(localProps ? assetUrl(`assets/hunyuan-v1/props/${model}.glb`) : localMonsters ? assetUrl(`assets/hunyuan-v1/creatures/${model}.glb`) : assetUrl(`assets/creatures/${model}.glb`), gltf => {
  scene.add(gltf.scene);
  if (localSet) {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() * (localProps && model === 'chest' ? .9 : .65);
    if (localProps && model === 'chest') center.y += .2;
    controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(radius * .5, radius * .3, radius * 1.8));
    controls.update(); floor.scale.setScalar(Math.max(1, radius));
  }
  renderer.domElement.dataset.modelReady = model;
  renderer.domElement.dataset.clips = gltf.animations.map(clip => clip.name).join(',');
  mixer = new THREE.AnimationMixer(gltf.scene);
  selector.replaceChildren(...gltf.animations.map(clip => { const option = document.createElement('option'); option.value = clip.name; option.textContent = clip.name; return option; }));
  const play = (): void => {
    const clip = gltf.animations.find(candidate => candidate.name === selector.value); if (!clip || !mixer) return;
    active?.stop(); mixer.stopAllAction(); active = mixer.clipAction(clip); active.reset();
    active.setLoop(['idle', 'move'].includes(clip.name) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    active.clampWhenFinished = true; active.play();
  };
  selector.disabled = gltf.animations.length === 0;
  if (!gltf.animations.length) { const option = new Option('Static', ''); selector.replaceChildren(option); }
  selector.value = gltf.animations.some(clip => clip.name === 'idle') ? 'idle' : gltf.animations[0]?.name ?? '';
  selector.addEventListener('change', play); play();
  status.textContent = `${gltf.animations.length} exported animations · ${localProps ? 'Hunyuan prop · rigid hinges where applicable · approximate rear texture' : localMonsters ? 'Hunyuan mesh · authored species rig · approximate rear texture' : 'original procedural Blender asset'}`;
}, undefined, error => { status.textContent = `Unable to load model: ${String(error)}`; });
function resize(): void { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let previous = performance.now();
renderer.setAnimationLoop(now => { mixer?.update(Math.min((now - previous) / 1000, 0.1)); previous = now; renderer.render(scene, camera); });
