/** World-space ground coordinates. A model facing +Z has yaw 0. */
export type PointXZ = Readonly<{ x: number; z: number }>;
export type LocomotionMode = 'walking' | 'turning' | 'resting';

export type LocomotionOptions = Readonly<{
  /** Ground units per second; 0.42 m per 1.2 s for the authored capy walk. */
  speed?: number;
  /** Ground units travelled during one complete walk clip. */
  strideLength?: number;
  /** Fraction of a walk clip at the first frame. */
  startPhase?: number;
  /** Maximum yaw change, radians per second. */
  turnRate?: number;
  /** Pause before turning around at either end of an open route. */
  endpointRest?: number;
  acceleration?: number;
  deceleration?: number;
}>;

export type LocomotionPose = Readonly<{
  position: PointXZ;
  yaw: number;
  travelledDistance: number;
  stridePhase: number;
  speed: number;
  moving: boolean;
  state: LocomotionMode;
}>;

const STEP_SECONDS = 1 / 120;
const MAX_FRAME_SECONDS = 0.25;
const EPS = 1e-7;
const REACH_EPS = 0.0001;

function angleTo(from: PointXZ, to: PointXZ): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function segmentLength(a: PointXZ, b: PointXZ): number {
  return Math.abs(b.x - a.x) + Math.abs(b.z - a.z);
}

function sameHeading(a: PointXZ, b: PointXZ, c: PointXZ): boolean {
  const dx1 = b.x - a.x, dz1 = b.z - a.z;
  const dx2 = c.x - b.x, dz2 = c.z - b.z;
  return dx1 * dx2 + dz1 * dz2 > EPS;
}

/**
 * Deterministic, renderer-independent walking on a prevalidated safe cell route.
 * The caller must make sure each listed cell is free and every shared edge is
 * passable; this class rejects jumps/diagonals but does not know park fences.
 */
export class LocomotionController {
  private readonly route: PointXZ[];
  private readonly cruiseSpeed: number;
  private readonly strideLength: number;
  private readonly initialPhase: number;
  private readonly turnRate: number;
  private readonly endpointRest: number;
  private readonly acceleration: number;
  private readonly deceleration: number;
  private direction: 1 | -1 = 1;
  private fromIndex = 0;
  private toIndex = 1;
  private along = 0;
  private position: { x: number; z: number };
  private yaw: number;
  private distance = 0;
  private speed = 0;
  private mode: LocomotionMode;
  private restLeft = 0;
  private remainder = 0;

  constructor(route: readonly PointXZ[], options: LocomotionOptions = {}) {
    if (!route.length) throw new RangeError('A walking route needs at least one cell.');
    this.route = route.map(point => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) throw new RangeError('Route coordinates must be finite.');
      return { x: point.x, z: point.z };
    });
    for (let i = 1; i < this.route.length; i++) {
      const a = this.route[i - 1], b = this.route[i];
      const dx = Math.abs(b.x - a.x), dz = Math.abs(b.z - a.z);
      if (dx < EPS && dz < EPS) throw new RangeError('A route may not repeat the same cell.');
      if (dx > EPS && dz > EPS) throw new RangeError('Diagonal route steps are not safe.');
      if (dx + dz > 1 + EPS) throw new RangeError('Route steps must be neighboring cells.');
    }
    this.cruiseSpeed = options.speed ?? 0.35;
    this.strideLength = options.strideLength ?? 0.42;
    this.initialPhase = options.startPhase ?? 0;
    this.turnRate = options.turnRate ?? 2.8;
    this.endpointRest = options.endpointRest ?? 0.7;
    this.acceleration = options.acceleration ?? 0.85;
    this.deceleration = options.deceleration ?? 1.05;
    if (![this.cruiseSpeed, this.strideLength, this.turnRate, this.acceleration, this.deceleration].every(value => Number.isFinite(value) && value > 0) ||
      !Number.isFinite(this.endpointRest) || this.endpointRest < 0 || !Number.isFinite(this.initialPhase))
      throw new RangeError('Locomotion options must be finite and positive (rest may be zero).');
    this.position = { ...this.route[0] };
    this.yaw = this.route.length > 1 ? angleTo(this.route[0], this.route[1]) : 0;
    this.mode = this.route.length > 1 ? 'walking' : 'resting';
  }

  get pose(): LocomotionPose {
    const rawPhase = (this.initialPhase + this.distance / this.strideLength) % 1;
    const stridePhase = rawPhase < 0 ? rawPhase + 1 : rawPhase;
    return {
      position: { ...this.position }, yaw: this.yaw,
      travelledDistance: this.distance, stridePhase,
      speed: this.speed, moving: this.mode === 'walking' && this.speed > 0.02,
      state: this.mode,
    };
  }

  update(deltaSeconds: number): LocomotionPose {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Delta time must be finite and nonnegative.');
    // A tab/phone resume may report minutes in one frame. Drop excess time so
    // the animal never jumps across its route or stalls the main thread.
    this.remainder += Math.min(deltaSeconds, MAX_FRAME_SECONDS);
    // Fixed simulation steps make the route, acceleration, and foot phase
    // independent of display frame rate during normal rendering.
    const steps = Math.floor((this.remainder + EPS) / STEP_SECONDS);
    this.remainder -= steps * STEP_SECONDS;
    for (let i = 0; i < steps; i++) this.step(STEP_SECONDS);
    return this.pose;
  }

  private step(dt: number): void {
    if (this.route.length === 1) return;
    if (this.mode === 'resting') {
      this.restLeft = Math.max(0, this.restLeft - dt);
      if (this.restLeft <= EPS) this.mode = 'turning';
      return;
    }
    if (this.mode === 'turning') {
      const target = angleTo(this.route[this.fromIndex], this.route[this.toIndex]);
      const remaining = shortestTurn(this.yaw, target);
      const maxTurn = this.turnRate * dt;
      if (Math.abs(remaining) <= maxTurn + EPS) {
        this.yaw = target;
        this.mode = 'walking';
      } else this.yaw += Math.sign(remaining) * maxTurn;
      this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
      return;
    }

    const remaining = this.distanceToNextStop();
    const brakingSpeed = Math.sqrt(2 * this.deceleration * remaining);
    const targetSpeed = Math.min(this.cruiseSpeed, brakingSpeed);
    if (this.speed < targetSpeed) this.speed = Math.min(targetSpeed, this.speed + this.acceleration * dt);
    else this.speed = Math.max(targetSpeed, this.speed - this.deceleration * dt);
    let travel = this.speed * dt;
    while (travel > EPS && this.mode === 'walking') {
      const from = this.route[this.fromIndex], to = this.route[this.toIndex];
      const length = segmentLength(from, to);
      const segmentLeft = length - this.along;
      const moved = Math.min(segmentLeft, travel);
      this.along += moved;
      this.distance += moved;
      travel -= moved;
      const fraction = this.along / length;
      this.position.x = from.x + (to.x - from.x) * fraction;
      this.position.z = from.z + (to.z - from.z) * fraction;
      if (segmentLeft - moved <= REACH_EPS) this.reachWaypoint();
      else break;
    }
    if (remaining <= REACH_EPS && this.speed < 0.02) this.reachWaypoint();
  }

  private distanceToNextStop(): number {
    let distance = segmentLength(this.route[this.fromIndex], this.route[this.toIndex]) - this.along;
    let from = this.fromIndex, to = this.toIndex;
    while (true) {
      const next = to + this.direction;
      if (next < 0 || next >= this.route.length || !sameHeading(this.route[from], this.route[to], this.route[next])) return distance;
      distance += segmentLength(this.route[to], this.route[next]);
      from = to;
      to = next;
    }
  }

  private reachWaypoint(): void {
    const arrived = this.toIndex;
    this.position = { ...this.route[arrived] };
    this.fromIndex = arrived;
    this.along = 0;
    const next = arrived + this.direction;
    if (next < 0 || next >= this.route.length) {
      this.direction = this.direction === 1 ? -1 : 1;
      this.toIndex = arrived + this.direction;
      this.speed = 0;
      this.restLeft = this.endpointRest;
      this.mode = this.restLeft > 0 ? 'resting' : 'turning';
      return;
    }
    const previous = arrived - this.direction;
    this.toIndex = next;
    if (!sameHeading(this.route[previous], this.route[arrived], this.route[next])) {
      this.speed = 0;
      this.mode = 'turning';
    }
  }
}

