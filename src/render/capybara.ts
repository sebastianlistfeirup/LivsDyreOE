import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { LocomotionPose } from './locomotion';

let asset: GLTF | null = null;
let loading: Promise<void> | undefined;

/** One cached, original skinned asset; each animal gets an independent skeleton. */
export function loadCapybara(): Promise<void> {
  loading ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/capybara.glb`).then(gltf => {
    if (!gltf.animations.some(clip => clip.name === 'Walk') || !gltf.animations.some(clip => clip.name === 'Idle'))
      throw new Error('Kapivarmodellen mangler gang eller hvileanimation.');
    gltf.scene.traverse(node => {
      if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    asset = gltf;
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}

export class CapybaraActor {
  readonly root = new THREE.Group();
  private readonly model: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly walk: THREE.AnimationAction;
  private readonly idle: THREE.AnimationAction;
  private weight = 0;
  private idleTime = 0;

  constructor(gltf: GLTF, scale = 1) {
    this.model = clone(gltf.scene);
    this.model.scale.setScalar(scale);
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.walk = this.mixer.clipAction(gltf.animations.find(clip => clip.name === 'Walk')!);
    this.idle = this.mixer.clipAction(gltf.animations.find(clip => clip.name === 'Idle')!);
    this.walk.play(); this.idle.play();
    this.walk.setEffectiveWeight(0);
    this.idle.setEffectiveWeight(1);
    this.mixer.update(0);
  }

  update(dt: number, pose: LocomotionPose): void {
    this.root.position.set(pose.position.x, 0.03, pose.position.z);
    this.root.rotation.y = pose.yaw;
    // The walk clip is sampled by distance, never by elapsed wall time. This
    // keeps stance feet planted when speed changes or the browser stalls.
    const target = pose.moving ? 1 : 0;
    this.weight = THREE.MathUtils.damp(this.weight, target, 12, dt);
    this.idleTime += dt;
    this.walk.time = pose.stridePhase * this.walk.getClip().duration;
    this.idle.time = this.idleTime % this.idle.getClip().duration;
    this.walk.setEffectiveWeight(this.weight);
    this.idle.setEffectiveWeight(1 - this.weight);
    this.mixer.update(0);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.root.removeFromParent();
    // Geometry/material/texture resources belong to the shared cached asset.
    this.model.traverse(node => { if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose(); });
  }
}

export function createCapybara(scale = 1): CapybaraActor | null {
  return asset ? new CapybaraActor(asset, scale) : null;
}
