import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCapybara, loadCapybara, type CapybaraActor } from './render/capybara';
import { LocomotionController, type LocomotionPose } from './render/locomotion';
import './animation-preview.css';

type Playback = 'walk' | 'idle' | 'pause';
type View = 'three-quarter' | 'side' | 'front';

const app = document.querySelector<HTMLElement>('#animation-app')!;
app.innerHTML = `<main class="preview-app">
  <div id="stage" class="stage" aria-label="Interaktiv tredimensionel kapivar"></div>
  <div class="stage-glow" aria-hidden="true"></div>
  <header class="preview-header">
    <a class="back-link" href="${import.meta.env.BASE_URL}" aria-label="Tilbage til Livs Dyreø"><span aria-hidden="true">←</span> Til parken</a>
    <span class="preview-mark">✦ <span>Livs Dyreø</span></span>
    <span class="preview-tag">3D-prøve</span>
  </header>
  <section class="intro" aria-labelledby="preview-title">
    <div class="eyebrow">ET LILLE SKRIDT MOD EN LEVENDE Ø</div>
    <h1 id="preview-title">Mød kapivaren.</h1>
    <p>Se den gå, hvile og vende sig. Drej selv kameraet for at se de små detaljer.</p>
  </section>
  <div id="load-state" class="load-state" role="status" aria-live="polite">
    <div class="load-card"><span class="load-spinner" aria-hidden="true"></span><strong id="load-title">Kapivaren er på vej …</strong><p id="load-detail">Henter 3D-modellen og dens animationer.</p><button id="retry-load" class="retry-button" type="button" hidden>Prøv igen</button></div>
  </div>
  <aside class="animal-fact" aria-label="Modellens størrelse"><span class="fact-line"></span><span>Kapivar · omtrent 1,2 m lang</span></aside>
  <section class="preview-controls" aria-label="Animationskontroller">
    <div class="control-heading"><div><span class="eyebrow">KIG DIG OMKRING</span><strong>Et levende dyr, alle vinkler.</strong></div><span class="gesture-hint">1 finger: drej · 2 fingre: zoom</span></div>
    <div class="view-buttons" role="group" aria-label="Kameravinkel">
      <button type="button" data-view="three-quarter" aria-pressed="true">◇ <span>3/4-vinkel</span></button>
      <button type="button" data-view="side" aria-pressed="false">▤ <span>Fra siden</span></button>
      <button type="button" data-view="front" aria-pressed="false">◉ <span>Forfra</span></button>
    </div>
    <div class="play-buttons" role="group" aria-label="Kapivarens bevægelse">
      <button type="button" data-play="walk" aria-pressed="true"><span aria-hidden="true">▶</span> Gå</button>
      <button type="button" data-play="idle" aria-pressed="false"><span aria-hidden="true">✦</span> Hvile</button>
      <button type="button" data-play="pause" aria-pressed="false"><span aria-hidden="true">Ⅱ</span> Pause</button>
    </div>
    <p id="animation-status" class="animation-status" role="status" aria-live="polite">Modellen indlæses …</p>
  </section>
</main>`;

const stage = document.querySelector<HTMLElement>('#stage')!;
const loadState = document.querySelector<HTMLElement>('#load-state')!;
const loadTitle = document.querySelector<HTMLElement>('#load-title')!;
const loadDetail = document.querySelector<HTMLElement>('#load-detail')!;
const retry = document.querySelector<HTMLButtonElement>('#retry-load')!;
const status = document.querySelector<HTMLElement>('#animation-status')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9d0b5');
scene.fog = new THREE.Fog('#b9d0b5', 9, 24);
const camera = new THREE.PerspectiveCamera(34, 1, 0.04, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = 'none';

const light = new THREE.DirectionalLight('#ffe9c2', 2.2);
light.position.set(-3.5, 7.5, 5);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
light.shadow.camera.left = -7;
light.shadow.camera.right = 7;
light.shadow.camera.top = 7;
light.shadow.camera.bottom = -7;
light.shadow.camera.near = 0.2;
light.shadow.camera.far = 22;
light.shadow.bias = -0.00015;
light.shadow.normalBias = 0.015;
light.shadow.radius = 3;
scene.add(new THREE.HemisphereLight('#fff7df', '#718766', 1.55), light);

function meadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#91ad7f';
  context.fillRect(0, 0, 256, 256);
  let randomState = 18321;
  const rand = () => { randomState = (randomState * 1664525 + 1013904223) >>> 0; return randomState / 4294967296; };
  for (let i = 0; i < 340; i++) {
    context.fillStyle = i % 4 ? 'rgba(63,104,63,.055)' : 'rgba(245,218,156,.09)';
    context.beginPath();
    context.ellipse(rand() * 256, rand() * 256, 2 + rand() * 10, 1 + rand() * 5, rand() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

const grassTexture = meadowTexture();
const ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const blossomColors = ['#f5e8c3', '#e4b77c', '#f5d8a0'];
const blossomMats = blossomColors.map(color => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
const blossomShape = new THREE.SphereGeometry(0.026, 5, 4);
let flowerSeed = 27831;
const flowerRand = () => { flowerSeed = (flowerSeed * 1103515245 + 12345) >>> 0; return flowerSeed / 4294967296; };
for (let i = 0; i < 65; i++) {
  const x = (flowerRand() - 0.5) * 9, z = (flowerRand() - 0.5) * 8;
  if (Math.abs(x) < 2.8 && z > -0.45 && z < 1.5) continue;
  const bloom = new THREE.Mesh(blossomShape, blossomMats[i % blossomMats.length]);
  bloom.position.set(x, 0.052, z);
  bloom.scale.setScalar(0.65 + flowerRand() * 0.7);
  scene.add(bloom);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-2, 0.42, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 2.6;
controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minPolarAngle = Math.PI * 0.12;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.85;

const path = [
  { x: -2, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 },
  { x: 2, z: 1 }, { x: 1, z: 1 }, { x: 0, z: 1 }, { x: -1, z: 1 }, { x: -2, z: 1 },
] as const;
const locomotion = new LocomotionController(path, { speed: 0.35, strideLength: 0.42, endpointRest: 0.9 });
let lastPose = locomotion.pose;
let actor: CapybaraActor | null = null;
let playback: Playback = 'walk';
let viewGoal: THREE.Vector3 | null = null;
let modelLength = 1.2;
let lastFrame = performance.now();
let frameId = 0;

function idealDistance(): number {
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  const baseline = THREE.MathUtils.clamp(5.5 - (aspect - 0.5) * 1.55, 3.65, 5.7);
  return baseline * Math.max(1, modelLength / 1.2) * 1.18;
}

function viewOffset(which: View): THREE.Vector3 {
  const distance = idealDistance();
  if (which === 'side') return new THREE.Vector3(distance * 0.96, distance * 0.24, 0);
  if (which === 'front') return new THREE.Vector3(0, distance * 0.24, distance * 0.96);
  return new THREE.Vector3(distance * 0.61, distance * 0.37, distance * 0.7);
}

function changeView(which: View, immediate = false): void {
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.view === which)));
  viewGoal = viewOffset(which);
  if (immediate) {
    camera.position.copy(controls.target).add(viewGoal);
    viewGoal = null;
    controls.update();
  }
}

controls.addEventListener('start', () => { viewGoal = null; });

function changePlayback(next: Playback): void {
  playback = next;
  document.querySelectorAll<HTMLButtonElement>('[data-play]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.play === next)));
  status.textContent = next === 'walk' ? 'Kapivaren går i sit eget rolige tempo.' : next === 'idle' ? 'Kapivaren står stille og hviler.' : 'Animationen er sat på pause. Du kan stadig dreje kameraet.';
}

function resize(): void {
  const width = Math.max(1, stage.clientWidth), height = Math.max(1, stage.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(stage);
resize();
changeView('three-quarter', true);

function frame(now: number): void {
  frameId = requestAnimationFrame(frame);
  const dt = Math.min(Math.max((now - lastFrame) / 1000, 0), 0.05);
  lastFrame = now;
  if (actor && playback !== 'pause') {
    if (playback === 'walk') lastPose = locomotion.update(dt);
    const pose: LocomotionPose = playback === 'idle' ? { ...lastPose, speed: 0, moving: false, state: 'resting' } : lastPose;
    actor.update(dt, pose);
  }
  if (actor) {
    const wanted = new THREE.Vector3(lastPose.position.x, 0.42, lastPose.position.z);
    const shift = wanted.sub(controls.target).multiplyScalar(1 - Math.exp(-3.5 * dt));
    controls.target.add(shift);
    camera.position.add(shift);
  }
  if (viewGoal) {
    const wanted = controls.target.clone().add(viewGoal);
    camera.position.lerp(wanted, 1 - Math.exp(-6 * dt));
    if (camera.position.distanceTo(wanted) < 0.015) viewGoal = null;
  }
  controls.update();
  renderer.render(scene, camera);
}
frameId = requestAnimationFrame(frame);

async function load(): Promise<void> {
  loadState.hidden = false;
  retry.hidden = true;
  loadTitle.textContent = 'Kapivaren er på vej …';
  loadDetail.textContent = 'Henter 3D-modellen og dens animationer.';
  try {
    await loadCapybara();
    actor = createCapybara();
    if (!actor) throw new Error('Kapivaren kunne ikke oprettes.');
    actor.root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(actor.root).getSize(new THREE.Vector3());
    modelLength = Math.max(size.x, size.z);
    if (!Number.isFinite(modelLength) || modelLength <= 0.01) throw new Error('3D-modellen har ingen læsbar størrelse.');
    scene.add(actor.root);
    actor.update(0, lastPose);
    changeView('three-quarter', true);
    loadState.hidden = true;
    changePlayback(playback);
  } catch (error) {
    loadTitle.textContent = 'Kapivaren kunne ikke vises endnu.';
    loadDetail.textContent = error instanceof Error ? error.message : 'Prøv at indlæse siden igen.';
    status.textContent = '3D-modellen kunne ikke indlæses. Parken virker stadig.';
    retry.hidden = false;
  }
}

document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
  button.addEventListener('click', () => changeView(button.dataset.view as View));
});
document.querySelectorAll<HTMLButtonElement>('[data-play]').forEach(button => {
  button.addEventListener('click', () => changePlayback(button.dataset.play as Playback));
});
retry.addEventListener('click', () => { void load(); });
window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(frameId);
  resizeObserver.disconnect();
  controls.dispose();
  actor?.dispose();
  grassTexture.dispose();
  renderer.dispose();
});

void load();
