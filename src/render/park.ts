import * as THREE from 'three';
import { DOCK, HEIGHT, OBJECT_BY_ID, WIDTH } from '../content/data';
import { cellKey, footprint, home } from '../core/game';
import type { GameState, Point, Species } from '../core/types';

type Preview = { at: Point; side: number; valid: boolean; definitionId: string | null; rotation: 0 | 1 } | null;

const mat = (color: string, roughness = 0.88) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
const sand = mat('#ddc69a'), pathMat = mat('#e8d6ae');
const wood = mat('#805b40'), paleWood = mat('#bd8c60'), darkWood = mat('#4d5148');
const leaf = mat('#437953'), leafLight = mat('#629464'), stone = mat('#82948b'), frost = mat('#b8dfe1');
const cream = mat('#f4e9cf'), orange = mat('#df8842'), charcoal = mat('#273b48'), flower = mat('#e8a6a0');
const box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(1, 8, 6), cone = new THREE.ConeGeometry(1, 1, 7);
const shadowDisk = new THREE.CircleGeometry(1, 16);
const shadowInk = new THREE.MeshBasicMaterial({ color: '#28442c', transparent: true, opacity: 0.17, depthWrite: false });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = false; m.receiveShadow = false;
  return m;
}

function coord(x: number, y: number): [number, number] { return [x - WIDTH / 2 + 0.5, y - HEIGHT / 2 + 0.5]; }

function groundShadow(x: number, z: number, radiusX: number, radiusZ: number): THREE.Mesh {
  const shadow = mesh(shadowDisk, shadowInk, x, 0.055, z, radiusX, radiusZ, 1);
  shadow.rotation.x = -Math.PI / 2;
  return shadow;
}

function edgeMesh(key: string, material: THREE.Material): THREE.Group {
  const [dir, xs, ys] = key.split(':');
  const x = Number(xs) - WIDTH / 2, z = Number(ys) - HEIGHT / 2;
  const g = new THREE.Group();
  const vertical = dir === 'v';
  const px = vertical ? x : x + 0.5, pz = vertical ? z + 0.5 : z;
  g.add(mesh(box, material, px, 0.19, pz, vertical ? 0.075 : 0.94, 0.12, vertical ? 0.94 : 0.075));
  for (const offset of [-0.43, 0.43])
    g.add(mesh(box, darkWood, px + (vertical ? 0 : offset), 0.21, pz + (vertical ? offset : 0), 0.11, 0.42, 0.11));
  return g;
}

function addObject(group: THREE.Group, object: GameState['placedObjects'][number], art: Record<string, THREE.SpriteMaterial>): void {
  const def = OBJECT_BY_ID[object.definitionId];
  const [x, z] = coord(object.gridPosition.x, object.gridPosition.y);
  const w = object.rotation ? def.height : def.width, h = object.rotation ? def.width : def.height;
  const cx = x + (w - 1) / 2, cz = z + (h - 1) / 2;
  const g = new THREE.Group(); g.position.set(cx, 0, cz);
  const id = object.definitionId;
  if (art[id]) {
    const sprite = new THREE.Sprite(art[id]);
    const sizes: Record<string, [number, number]> = {
      pond: [2.65, 1.74], shelter: [2.32, 1.84], cave: [2.62, 1.76],
      swim: [2.55, 1.72], log: [2.44, 1.62], portal: [2.45, 2.25], shade: [2.3, 2.25],
    };
    const [width, height] = sizes[id];
    sprite.scale.set(width, height, 1);
    sprite.position.y = height * 0.48;
    g.add(sprite);
  } else if (id === 'shrub') {
    g.add(mesh(ball, leaf, -0.19, 0.28, 0, 0.3, 0.26, 0.4));
    g.add(mesh(ball, leafLight, 0.18, 0.38, -0.04, 0.27, 0.23, 0.37));
  } else if (id === 'coolrock') {
    g.add(mesh(cone, frost, -0.3, 0.45, 0, 0.46, 0.86, 0.55));
    g.add(mesh(cone, stone, 0.37, 0.32, 0.1, 0.54, 0.6, 0.51));
  } else if (id === 'feed') {
    g.add(mesh(box, wood, 0, 0.16, 0, 0.7, 0.22, 0.48));
    g.add(mesh(box, sand, 0, 0.28, 0, 0.56, 0.06, 0.32));
  } else if (id === 'ball') g.add(mesh(ball, flower, 0, 0.3, 0, 0.28, 0.28, 0.28));
  else if (id === 'bench') {
    g.add(mesh(box, wood, 0, 0.32, 0, 0.72, 0.11, 0.35));
    g.add(mesh(box, wood, 0, 0.53, -0.15, 0.72, 0.38, 0.1));
  } else if (id === 'sign') {
    g.add(mesh(box, wood, 0, 0.55, 0, 0.09, 0.9, 0.09));
    g.add(mesh(box, cream, 0, 0.9, 0, 0.8, 0.43, 0.08));
    g.add(mesh(ball, leaf, 0, 0.9, 0.06, 0.14, 0.14, 0.03));
  } else if (id === 'portal') {
    for (const sx of [-0.65, 0.65]) {
      g.add(mesh(box, paleWood, sx, 0.65, 0, 0.14, 1.3, 0.15));
      g.add(mesh(ball, flower, sx, 1.31, 0, 0.24, 0.18, 0.2));
    }
    g.add(mesh(box, paleWood, 0, 1.33, 0, 1.45, 0.15, 0.15));
  }
  group.add(g);
}

export class ParkScene {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.OrthographicCamera(-15, 15, 15, -15, 0.1, 200);
  private staticGroup = new THREE.Group();
  private dynamicGroup = new THREE.Group();
  private animated: { object: THREE.Object3D; origin: THREE.Vector3; kind: 'animal' | 'visitor' | 'tree' }[] = [];
  private terrainGrid: THREE.LineSegments | null = null;
  private animalMaterials: Record<Species, THREE.SpriteMaterial>;
  private propMaterials: Record<string, THREE.SpriteMaterial>;
  private treeMaterial: THREE.SpriteMaterial;
  private seaTexture: THREE.Texture | null = null;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private target = new THREE.Vector3(-5, 0, 4);
  private zoom = 2.2;
  private motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private pointerStart: { x: number; y: number } | null = null;
  private moved = false;
  onCell: (at: Point, side: number) => void = () => {};

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const loader = new THREE.TextureLoader();
    this.animalMaterials = Object.fromEntries((['capybara', 'tiger', 'penguin'] as Species[]).map(species => {
      const texture = loader.load(`${import.meta.env.BASE_URL}art/${species}.webp`);
      texture.colorSpace = THREE.SRGBColorSpace;
      return [species, new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.02, depthWrite: false })];
    })) as Record<Species, THREE.SpriteMaterial>;
    this.propMaterials = Object.fromEntries(['pond', 'shelter', 'cave', 'swim', 'log', 'portal', 'shade'].map(id => {
      const texture = loader.load(`${import.meta.env.BASE_URL}art/${id === 'shade' ? 'coastal-tree' : id}.webp`);
      texture.colorSpace = THREE.SRGBColorSpace;
      return [id, new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.025, depthWrite: false })];
    }));
    const treeTexture = loader.load(`${import.meta.env.BASE_URL}art/coastal-tree.webp`);
    treeTexture.colorSpace = THREE.SRGBColorSpace;
    this.treeMaterial = new THREE.SpriteMaterial({ map: treeTexture, transparent: true, alphaTest: 0.03, depthWrite: false });
    this.host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#fff7e4', '#6b8d72', 2.2));
    const sun = new THREE.DirectionalLight('#fff4d4', 2.3); sun.position.set(-10, 22, -15); this.scene.add(sun);
    this.scene.add(this.staticGroup, this.dynamicGroup);
    this.buildGround();
    this.camera.position.set(this.target.x + 17, 19, this.target.z + 21);
    this.camera.lookAt(this.target);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', e => { this.pointerStart = { x: e.clientX, y: e.clientY }; this.moved = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!this.pointerStart) return;
      const dx = e.clientX - this.pointerStart.x, dy = e.clientY - this.pointerStart.y;
      if (Math.hypot(dx, dy) > 7) this.moved = true;
      if (this.moved) {
        const factor = 23 / (this.host.clientWidth * this.zoom);
        this.target.x -= dx * factor * 0.8; this.target.z -= dy * factor * 1.1;
        this.target.x = THREE.MathUtils.clamp(this.target.x, -11, 11);
        this.target.z = THREE.MathUtils.clamp(this.target.z, -9, 9);
        this.updateCamera(); this.pointerStart = { x: e.clientX, y: e.clientY };
      }
    });
    canvas.addEventListener('pointerup', e => { if (!this.moved) this.pick(e); this.pointerStart = null; });
    canvas.addEventListener('pointercancel', () => { this.pointerStart = null; });
    canvas.style.touchAction = 'none';
    this.animate();
  }

  private buildGround(): void {
    this.staticGroup.add(mesh(box, sand, 0, -0.25, 0, WIDTH + 0.8, 0.52, HEIGHT + 0.8));
    const meadow = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}art/meadow.webp`);
    meadow.colorSpace = THREE.SRGBColorSpace; meadow.wrapS = THREE.RepeatWrapping; meadow.wrapT = THREE.RepeatWrapping;
    meadow.repeat.set(3, 2.5); meadow.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    const meadowPlane = mesh(new THREE.PlaneGeometry(WIDTH, HEIGHT), new THREE.MeshStandardMaterial({ map: meadow, roughness: 1 }), 0, 0.025, 0);
    meadowPlane.rotation.x = -Math.PI / 2; this.staticGroup.add(meadowPlane);
    const lines: number[] = [];
    for (let x = -WIDTH / 2; x <= WIDTH / 2; x++) lines.push(x, 0.043, -HEIGHT / 2, x, 0.043, HEIGHT / 2);
    for (let z = -HEIGHT / 2; z <= HEIGHT / 2; z++) lines.push(-WIDTH / 2, 0.043, z, WIDTH / 2, 0.043, z);
    const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    this.terrainGrid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: '#f3eecf', transparent: true, opacity: 0.48 }));
    this.terrainGrid.visible = false; this.staticGroup.add(this.terrainGrid);
    const seaTexture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}art/sea.webp`);
    seaTexture.colorSpace = THREE.SRGBColorSpace;
    seaTexture.wrapS = seaTexture.wrapT = THREE.RepeatWrapping;
    seaTexture.repeat.set(18, 18);
    seaTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.seaTexture = seaTexture;
    const sea = mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: seaTexture, roughness: 0.72 }), 0, -0.55, 0);
    sea.rotation.x = -Math.PI / 2; this.staticGroup.add(sea);
    for (let i = 0; i < 42; i++) {
      const x = (i * 7.37) % 28 - 14, z = (i * 9.73) % 24 - 12;
      if (Math.abs(x) < 11.5 && Math.abs(z) < 9.5) continue;
      this.staticGroup.add(mesh(cone, stone, x, -0.32, z, 0.5 + i % 3 * 0.2, 0.45 + i % 4 * 0.12, 0.5));
    }
    for (let i = 0; i < 42; i++) {
      const x = -WIDTH / 2 + 0.3 + i * (WIDTH - 0.6) / 41;
      const z = HEIGHT / 2 + Math.sin(i * 2.11) * 0.27;
      const rock = mesh(ball, i % 3 ? stone : sand, x, -0.34, z, 0.25 + i % 4 * 0.09, 0.13 + i % 3 * 0.04, 0.3 + i % 5 * 0.06);
      rock.rotation.y = i * 2.19; this.staticGroup.add(rock);
    }
    const dockTexture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}art/dock.webp`);
    dockTexture.colorSpace = THREE.SRGBColorSpace;
    const dock = new THREE.Sprite(new THREE.SpriteMaterial({ map: dockTexture, transparent: true, alphaTest: 0.03, depthWrite: false }));
    dock.position.set(-11.8, 1.24, 8.5); dock.scale.set(4.45, 2.75, 1); this.staticGroup.add(dock);
    const clinicTexture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}art/clinic.webp`);
    clinicTexture.colorSpace = THREE.SRGBColorSpace;
    const clinic = new THREE.Sprite(new THREE.SpriteMaterial({ map: clinicTexture, transparent: true, alphaTest: 0.03, depthWrite: false }));
    clinic.position.set(0.5, 1.75, 6.5); clinic.scale.set(4.3, 3.6, 1); this.staticGroup.add(clinic);
  }

  private updateCamera(): void {
    this.camera.position.set(this.target.x + 17, 19, this.target.z + 21);
    this.camera.lookAt(this.target);
  }

  resize(): void {
    const w = Math.max(this.host.clientWidth, 1), h = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.left = -15; this.camera.right = 15; this.camera.top = 15 / aspect; this.camera.bottom = -15 / aspect;
    this.camera.zoom = this.zoom; this.camera.updateProjectionMatrix();
  }

  focus(species: Species | 'all' | 'dock'): void {
    const p = species === 'all' ? { x: 12, y: 10 } : species === 'dock' ? DOCK :
      species === 'capybara' ? { x: 5, y: 12 } : species === 'tiger' ? { x: 12, y: 5 } : { x: 19, y: 11 };
    const [x, z] = coord(p.x, p.y); this.target.set(x, 0, z); this.zoom = species === 'all' ? 1.15 : 2.9; this.updateCamera(); this.resize();
  }

  changeZoom(delta: number): void { this.zoom = THREE.MathUtils.clamp(this.zoom + delta, 0.9, 4.5); this.resize(); }

  setBuildMode(enabled: boolean): void { if (this.terrainGrid) this.terrainGrid.visible = enabled; }

  capture(): string {
    this.renderer.render(this.scene, this.camera);
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = Math.max(280, Math.round(480 * this.renderer.domElement.height / this.renderer.domElement.width));
    canvas.getContext('2d')?.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  captureOverview(): string {
    const previousTarget = this.target.clone(), previousZoom = this.zoom;
    this.focus('all');
    const image = this.capture();
    this.target.copy(previousTarget); this.zoom = previousZoom;
    this.updateCamera(); this.resize();
    return image;
  }

  private pick(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
    this.ray.setFromCamera(ndc, this.camera);
    const point = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, point)) return;
    const fx = point.x + WIDTH / 2, fy = point.z + HEIGHT / 2;
    const x = Math.floor(fx), y = Math.floor(fy);
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
    const localX = fx - x, localY = fy - y;
    const values = [localY, 1 - localX, 1 - localY, localX];
    const side = values.indexOf(Math.min(...values));
    this.onCell({ x, y }, side);
  }

  draw(state: GameState, preview: Preview): void {
    this.dynamicGroup.clear(); this.animated = [];
    const group = this.dynamicGroup;
    const occupied = new Set(state.paths);
    for (const object of state.placedObjects) for (const p of footprint(object)) occupied.add(cellKey(p.x, p.y));
    const foliage: Point[] = [];
    for (let y = 1; y < HEIGHT - 1; y++) for (let x = 1; x < WIDTH - 1; x++) {
      if ((x * 13 + y * 17 + x * y * 3) % 17 !== 0) continue;
      if (occupied.has(cellKey(x, y))) continue;
      if ((x >= 2 && x <= 7 && y >= 10 && y <= 14) || (x >= 9 && x <= 14 && y >= 2 && y <= 7) || (x >= 16 && x <= 21 && y >= 9 && y <= 13)) continue;
      foliage.push({ x, y });
    }
    const shrublets = new THREE.InstancedMesh(ball, leafLight, Math.max(1, foliage.length));
    const foliageDummy = new THREE.Object3D();
    foliage.forEach((p, i) => {
      const [x, z] = coord(p.x, p.y);
      foliageDummy.position.set(x + 0.28, 0.12, z + 0.1); foliageDummy.scale.set(0.23, 0.14, 0.23); foliageDummy.updateMatrix(); shrublets.setMatrixAt(i, foliageDummy.matrix);
    });
    shrublets.count = foliage.length; shrublets.instanceMatrix.needsUpdate = true; group.add(shrublets);
    const trees: Point[] = [
      { x: 1, y: 1 }, { x: 5, y: 2 }, { x: 8, y: 1 }, { x: 12, y: 1 }, { x: 16, y: 2 }, { x: 21, y: 3 },
      { x: 2, y: 5 }, { x: 7, y: 6 }, { x: 1, y: 7 }, { x: 8, y: 8 }, { x: 13, y: 8 }, { x: 15, y: 7 }, { x: 22, y: 7 },
      { x: 1, y: 13 }, { x: 9, y: 12 }, { x: 12, y: 11 }, { x: 16, y: 15 }, { x: 15, y: 16 }, { x: 22, y: 17 },
      { x: 2, y: 18 }, { x: 7, y: 18 }, { x: 12, y: 18 }, { x: 19, y: 18 },
    ];
    trees.forEach((p, i) => {
      if (occupied.has(cellKey(p.x, p.y))) return;
      if (state.habitats.some(h => home(state, h.speciesId).check?.valid && home(state, h.speciesId).check?.cells.includes(cellKey(p.x, p.y)))) return;
      const [x, z] = coord(p.x, p.y);
      const tree = new THREE.Sprite(this.treeMaterial);
      const scale = 3.45 + i % 3 * 0.43;
      tree.scale.set(scale, scale * 0.88, 1); tree.position.set(x, scale * 0.42, z);
      group.add(groundShadow(x, z, scale * 0.32, scale * 0.19), tree);
      this.animated.push({ object: tree, origin: tree.position.clone(), kind: 'tree' });
    });
    const pathGeometry = new THREE.BoxGeometry(0.83, 0.035, 0.83);
    const pathInstances = new THREE.InstancedMesh(pathGeometry, pathMat, Math.max(1, state.paths.length));
    const dummy = new THREE.Object3D();
    for (let i = 0; i < state.paths.length; i++) {
      const [x, y] = state.paths[i].split(',').map(Number), [wx, wz] = coord(x, y);
      dummy.position.set(wx, 0.08, wz); dummy.updateMatrix(); pathInstances.setMatrixAt(i, dummy.matrix);
    }
    pathInstances.count = state.paths.length; pathInstances.instanceMatrix.needsUpdate = true; group.add(pathInstances);
    for (const key of state.fences) group.add(edgeMesh(key, paleWood));
    for (const key of state.gates) { const gate = edgeMesh(key, orange); gate.add(mesh(ball, flower, 0, 0.48, 0, 0.16, 0.16, 0.16)); group.add(gate); }
    for (const object of state.placedObjects) addObject(group, object, this.propMaterials);
    for (const species of ['capybara', 'tiger', 'penguin'] as Species[]) {
      const { habitat, check } = home(state, species);
      if (!habitat || !check?.valid) continue;
      const animals = state.animals.filter(a => a.speciesId === species && a.habitatId);
      const cells = check.cells.filter(k => {
        const [x, y] = k.split(',').map(Number);
        return !state.placedObjects.some(o => footprint(o).some(p => p.x === x && p.y === y));
      });
      const displayCells: Record<Species, string[]> = { capybara: ['3,14', '4,13'], tiger: ['10,6', '13,5'], penguin: ['17,13', '20,13'] };
      animals.forEach((_, i) => {
        const preferred = displayCells[species][i];
        const key = cells.includes(preferred) ? preferred : cells[(i * 5 + Math.floor(cells.length / 3)) % cells.length] ?? cellKey(habitat.seed.x, habitat.seed.y);
        const [cx, cy] = key.split(',').map(Number), [x, z] = coord(cx, cy);
        const figure = new THREE.Sprite(this.animalMaterials[species]);
        // Habitat buildings stay substantially larger than each animal. The sprites
        // have transparent padding, so rendered animal bounds are smaller than scale.
        const width = species === 'tiger' ? 1.78 : species === 'penguin' ? 0.9 : 1.72;
        const height = species === 'tiger' ? 1.36 : species === 'penguin' ? 1.1 : 1.32;
        figure.position.set(x, height * 0.43, z);
        figure.scale.set(width, height, 1);
        if (i) figure.material = this.animalMaterials[species].clone();
        group.add(groundShadow(x, z, width * 0.37, width * 0.22), figure);
        this.animated.push({ object: figure, origin: figure.position.clone(), kind: 'animal' });
      });
    }
    if (state.animals.length) {
      const visitorPaths = state.paths.slice(0, Math.min(8, state.paths.length));
      visitorPaths.forEach((key, i) => {
        if (i % 2) return;
        const [cx, cy] = key.split(',').map(Number), [x, z] = coord(cx, cy);
        const person = new THREE.Group(); person.position.set(x, 0, z); person.scale.setScalar(0.82);
        const shirt = [flower, frost, orange, leaf][i % 4];
        person.add(mesh(box, shirt, 0, 0.62, 0, 0.28, 0.43, 0.2));
        person.add(mesh(box, charcoal, -0.075, 0.24, 0, 0.1, 0.37, 0.11));
        person.add(mesh(box, charcoal, 0.075, 0.24, 0, 0.1, 0.37, 0.11));
        person.add(mesh(box, cream, -0.19, 0.61, 0, 0.09, 0.35, 0.1));
        person.add(mesh(box, cream, 0.19, 0.61, 0, 0.09, 0.35, 0.1));
        person.add(mesh(ball, cream, 0, 0.98, 0, 0.13, 0.14, 0.13));
        person.add(mesh(box, i % 4 === 0 ? darkWood : wood, 0, 1.09, -0.01, 0.25, 0.07, 0.25));
        group.add(person); this.animated.push({ object: person, origin: person.position.clone(), kind: 'visitor' });
      });
    }
    if (preview) {
      const [x, z] = coord(preview.at.x, preview.at.y);
      const indicator = new THREE.MeshBasicMaterial({ color: preview.valid ? '#fff3ad' : '#e78f8f', transparent: true, opacity: 0.63, depthWrite: false });
      let w = 1, h = 1;
      if (preview.definitionId && OBJECT_BY_ID[preview.definitionId]) {
        const def = OBJECT_BY_ID[preview.definitionId]; w = preview.rotation ? def.height : def.width; h = preview.rotation ? def.width : def.height;
      }
      group.add(mesh(box, indicator, x + (w - 1) / 2, 0.14, z + (h - 1) / 2, w * 0.95, 0.08, h * 0.95));
    }
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const t = performance.now() / 1000;
    if (this.seaTexture && !this.motionQuery.matches) this.seaTexture.offset.set(t * 0.0016, t * 0.0008);
    this.animated.forEach(({ object, origin, kind }, i) => {
      if (this.motionQuery.matches) { object.position.copy(origin); return; }
      const phase = t * (kind === 'animal' ? 0.95 : kind === 'visitor' ? 1.7 : 0.58) + i * 1.37;
      object.position.set(
        origin.x + Math.sin(phase) * (kind === 'animal' ? 0.12 : kind === 'visitor' ? 0.18 : 0.015),
        origin.y + Math.abs(Math.sin(phase * 1.6)) * (kind === 'animal' ? 0.025 : kind === 'visitor' ? 0.045 : 0.008),
        origin.z + Math.cos(phase * 0.63) * (kind === 'animal' ? 0.06 : kind === 'visitor' ? 0.12 : 0),
      );
    });
    this.renderer.render(this.scene, this.camera);
  };
}
