import { describe, expect, it } from 'vitest';
import { LocomotionController } from '../src/render/locomotion';

const circularDifference = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('capybara ground locomotion', () => {
  it('requires neighboring orthogonal safe-cell steps', () => {
    expect(() => new LocomotionController([])).toThrow(/at least one/);
    expect(() => new LocomotionController([{ x: 0, z: 0 }, { x: 1, z: 1 }])).toThrow(/Diagonal/);
    expect(() => new LocomotionController([{ x: 0, z: 0 }, { x: 2, z: 0 }])).toThrow(/neighboring/);
    expect(() => new LocomotionController([{ x: 0, z: 0 }, { x: 0, z: 0 }])).toThrow(/repeat/);
    expect(() => new LocomotionController([{ x: 0, z: 0 }, { x: Number.NaN, z: 1 }])).toThrow(/finite/);
  });

  it('rests on a one-cell route and rejects invalid time without moving', () => {
    const motion = new LocomotionController([{ x: 2, z: -3 }], { startPhase: .3 });
    expect(motion.update(5)).toEqual({
      position: { x: 2, z: -3 }, yaw: 0, travelledDistance: 0,
      stridePhase: .3, speed: 0, moving: false, state: 'resting',
    });
    expect(() => motion.update(-1)).toThrow(/Delta time/);
  });

  it('never cuts a diagonal across a right-angle corner and turns at bounded speed', () => {
    const rate = 1.6, dt = 1 / 60;
    const motion = new LocomotionController([{ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 1 }], {
      speed: .7, acceleration: 2, deceleration: 2, turnRate: rate, endpointRest: .2,
    });
    let sawTurn = false, sawNextLeg = false;
    for (let i = 0; i < 600; i++) {
      const before = motion.pose;
      const pose = motion.update(dt);
      expect(circularDifference(pose.yaw, before.yaw)).toBeLessThanOrEqual(rate * dt + 1e-6);
      expect(pose.position.x).toBeGreaterThanOrEqual(-1e-6);
      expect(pose.position.z).toBeGreaterThanOrEqual(-1e-6);
      expect(pose.position.x > 1e-5 && pose.position.z < 1 - 1e-5).toBe(false);
      if (pose.state === 'turning' && pose.position.z > .99 && pose.position.x < .01) {
        sawTurn = true;
        expect(pose.speed).toBe(0);
      }
      if (pose.position.x > .05) sawNextLeg = true;
    }
    expect(sawTurn).toBe(true);
    expect(sawNextLeg).toBe(true);
  });

  it('keeps its walking speed across a straight cell boundary', () => {
    const motion = new LocomotionController([{ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 2 }], {
      speed: .7, acceleration: 2, deceleration: 2,
    });
    let boundarySpeed: number | null = null;
    for (let i = 0; i < 400; i++) {
      const pose = motion.update(1 / 60);
      if (pose.position.z >= 1 && boundarySpeed === null) boundarySpeed = pose.speed;
    }
    expect(boundarySpeed).not.toBeNull();
    expect(boundarySpeed!).toBeGreaterThan(.6);
    expect(motion.pose.travelledDistance).toBeGreaterThan(1);
  });

  it('slows, rests, and turns in place before reversing an open route', () => {
    const motion = new LocomotionController([{ x: 0, z: 0 }, { x: 0, z: 1 }], {
      speed: .6, acceleration: 2, deceleration: 2, turnRate: 2, endpointRest: .5,
    });
    let arrival: ReturnType<typeof motion.update> | null = null;
    for (let i = 0; i < 500; i++) {
      const pose = motion.update(1 / 60);
      if (pose.state === 'resting' && pose.position.z === 1) { arrival = pose; break; }
    }
    expect(arrival).not.toBeNull();
    expect(arrival!.speed).toBe(0);
    expect(arrival!.yaw).toBe(0);
    const heldPhase = arrival!.stridePhase;
    const rest = motion.update(.25);
    expect(rest.state).toBe('resting');
    expect(rest.position).toEqual({ x: 0, z: 1 });
    expect(rest.stridePhase).toBe(heldPhase);
    let sawTurn = false, sawReverse = false;
    for (let i = 0; i < 400; i++) {
      const pose = motion.update(1 / 60);
      if (pose.state === 'turning') {
        sawTurn = true;
        expect(pose.position).toEqual({ x: 0, z: 1 });
        expect(pose.speed).toBe(0);
      }
      if (pose.position.z < .99) { sawReverse = true; break; }
    }
    expect(sawTurn).toBe(true);
    expect(sawReverse).toBe(true);
    expect(motion.pose.travelledDistance).toBeGreaterThan(arrival!.travelledDistance);
  });

  it('derives foot phase from real travelled distance, not elapsed frames', () => {
    const route = [{ x: 0, z: 0 }, { x: 0, z: 1 }];
    const options = { speed: .35, strideLength: .42, startPhase: .25, acceleration: 1, deceleration: 1 };
    const once = new LocomotionController(route, options);
    const partitioned = new LocomotionController(route, options);
    const a = once.update(.2);
    for (let i = 0; i < 20; i++) partitioned.update(.01);
    const b = partitioned.pose;
    expect(a.position.z).toBeCloseTo(b.position.z, 8);
    expect(a.travelledDistance).toBeCloseTo(b.travelledDistance, 8);
    expect(a.stridePhase).toBeCloseTo((.25 + a.travelledDistance / .42) % 1, 8);
  });

  it('drops excess elapsed time after a phone-tab pause instead of teleporting', () => {
    const motion = new LocomotionController([{ x: 0, z: 0 }, { x: 0, z: 1 }]);
    const pose = motion.update(10_000);
    expect(pose.position.z).toBeGreaterThan(0);
    expect(pose.position.z).toBeLessThan(.35 * .25);
  });
});
