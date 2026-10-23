import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioFX } from '../src/audio-fx.js';

function fixture({ activation = true, failConstruction = false } = {}) {
  const timers = new Map(), listeners = new Map(), contexts = [];
  let timerId = 0;
  const param = () => ({
    value: 0, events: [],
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); },
    setTargetAtTime(value, time, constant) { this.value = value; this.events.push(['target', value, time, constant]); },
    linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]); },
    exponentialRampToValueAtTime(value, time) { this.events.push(['exponential', value, time]); },
    cancelScheduledValues(time) { this.events.push(['cancel', time]); },
  });
  class FakeContext {
    constructor() {
      if (failConstruction) throw new Error('Audio unavailable');
      this.currentTime = 0;
      this.state = 'suspended';
      this.destination = {};
      this.oscillators = [];
      this.gains = [];
      this.listeners = new Map();
      this.resumes = 0;
      this.suspends = 0;
      contexts.push(this);
    }
    createGain() {
      const gain = { gain: param(), connect() {}, disconnect() { this.disconnected = true; } };
      this.gains.push(gain);
      return gain;
    }
    createOscillator() {
      const oscillator = {
        frequency: param(), type: 'sine', starts: [], stops: [],
        connect() {}, disconnect() { this.disconnected = true; },
        start(time) { this.starts.push(time); },
        stop(time) { this.stops.push(time); if (time === undefined) this.onended?.(); },
      };
      this.oscillators.push(oscillator);
      return oscillator;
    }
    async resume() { this.resumes += 1; this.state = 'running'; this.listeners.get('statechange')?.(); }
    async suspend() { this.suspends += 1; this.state = 'suspended'; this.listeners.get('statechange')?.(); }
    async close() { this.state = 'closed'; }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    removeEventListener(name, listener) { if (this.listeners.get(name) === listener) this.listeners.delete(name); }
  }
  const document = {
    hidden: false, visibilityState: 'visible',
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
  };
  const window = {
    AudioContext: FakeContext, document, navigator: { userActivation: { isActive: activation } },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const fx = createAudioFX({ window });
  return {
    fx, window, document, contexts, timers, listeners,
    async visibility(hidden) {
      document.hidden = hidden;
      document.visibilityState = hidden ? 'hidden' : 'visible';
      listeners.get('visibilitychange')?.();
      await Promise.resolve(); await Promise.resolve();
    },
    tick(seconds = 0.11) {
      for (const context of contexts) {
        context.currentTime += seconds;
        for (const oscillator of context.oscillators) {
          const end = oscillator.stops.at(-1);
          if (typeof end === 'number' && end <= context.currentTime) oscillator.onended?.();
        }
      }
      const pending = [...timers];
      for (const [id, { callback }] of pending) if (timers.delete(id)) callback();
    },
  };
}

test('does not create or play audio until a user gesture unlocks it', async () => {
  const f = fixture({ activation: false });
  assert.deepEqual(f.fx.getState(), {
    supported: true, unlocked: false, music: false, sound: true, volume: 0.65,
    destroyed: false, active: false, suspended: true, playingMusic: false, activeVoices: 0,
  });
  f.fx.setMusic(true);
  f.fx.setSound(true);
  f.fx.setVolume(0.4);
  assert.equal(f.fx.play('click'), false);
  assert.equal(await f.fx.resume(), false);
  assert.equal(await f.fx.unlock(), false);
  assert.equal(f.contexts.length, 0);
  assert.equal(f.timers.size, 0);
  f.window.navigator.userActivation.isActive = true;
  assert.equal(await f.fx.unlock(), true);
  assert.equal(f.contexts.length, 1);
  assert.equal(f.fx.getState().playingMusic, true);
  assert.equal(f.contexts[0].gains[0].gain.value, 0.4);
  await f.fx.unlock();
  assert.equal(f.contexts.length, 1);
  await f.fx.destroy();
});

test('music is opt-in and every effect has short, finite, original synthesized voices', async () => {
  const { fx, contexts, timers } = fixture();
  await fx.unlock();
  assert.equal(contexts[0].oscillators.length, 0);
  assert.equal(timers.size, 0);
  for (const name of ['select', 'discover', 'coin', 'progress', 'correct', 'incorrect', 'complete', 'click', 'step']) {
    assert.equal(fx.play(name), true, name);
  }
  assert.equal(fx.play('unknown'), false);
  assert.equal(fx.play('__proto__'), false);
  for (const oscillator of contexts[0].oscillators) {
    assert.ok(oscillator.starts[0] >= 0);
    assert.ok(oscillator.stops[0] < 1);
    assert.ok(oscillator.frequency.events.every(([, frequency]) => Number.isFinite(frequency) && frequency > 0));
  }
  assert.equal(fx.getState().playingMusic, false);
  await fx.destroy();
});

test('running step is a single quiet short cue and respects every audio guard', async () => {
  const f = fixture();
  assert.equal(f.fx.play('step'), false);
  assert.equal(f.contexts.length, 0);
  await f.fx.unlock();
  assert.equal(f.fx.play('step'), true);
  const context = f.contexts[0], oscillator = context.oscillators[0];
  assert.equal(context.oscillators.length, 1);
  assert.equal(oscillator.type, 'triangle');
  assert.ok(oscillator.stops[0] - oscillator.starts[0] <= 0.075);
  const peak = Math.max(...context.gains[1].gain.events.map(([, value]) => value));
  assert.ok(peak > 0 && peak <= 0.035);
  for (let i = 0; i < 100; i++) {
    f.tick(0.28);
    assert.equal(f.fx.play('step'), true);
    assert.equal(f.fx.getState().activeVoices, 1);
    assert.equal(f.timers.size, 0, 'steps never schedule a repeating loop');
  }
  f.fx.setSound(false);
  assert.equal(f.fx.play('step'), false);
  assert.equal(f.fx.getState().activeVoices, 0);
  f.fx.setSound(true);
  f.fx.setVolume(0);
  assert.equal(f.fx.play('step'), false);
  f.fx.setVolume(0.65);
  await f.visibility(true);
  assert.equal(f.fx.play('step'), false);
  await f.visibility(false);
  await f.fx.suspend();
  assert.equal(f.fx.play('step'), false);
  await f.fx.resume();
  assert.equal(f.fx.play('step'), true);
  await f.fx.destroy();
  assert.equal(f.fx.play('step'), false);
});

test('sound and music toggles are independent; volume clamps and mutes all scheduling', async () => {
  const { fx, timers } = fixture();
  await fx.unlock();
  fx.setMusic(true);
  assert.equal(timers.size, 1);
  fx.setSound(false);
  assert.equal(fx.play('coin'), false);
  assert.equal(fx.getState().playingMusic, true);
  fx.setSound(true);
  assert.equal(fx.play('coin'), true);
  fx.setMusic(false);
  assert.equal(timers.size, 0);
  assert.equal(fx.getState().activeVoices, 2, 'turning music off leaves SFX intact');
  fx.setMusic(true);
  assert.equal(fx.setVolume(-1), 0);
  assert.equal(fx.getState().activeVoices, 0);
  assert.equal(timers.size, 0);
  assert.equal(fx.play('coin'), false);
  assert.equal(fx.setVolume(5), 1);
  assert.equal(fx.setVolume(NaN), 1);
  assert.equal(fx.setVolume('0.5'), 1);
  assert.equal(timers.size, 1);
  await fx.destroy();
});

test('hidden tabs cancel all voices and timers, preserving user preferences', async () => {
  const f = fixture();
  await f.fx.unlock();
  f.fx.setMusic(true);
  f.fx.play('complete');
  await f.visibility(true);
  assert.equal(f.fx.getState().activeVoices, 0);
  assert.equal(f.fx.getState().playingMusic, false);
  assert.equal(f.contexts[0].state, 'suspended');
  assert.equal(f.timers.size, 0);
  assert.equal(f.fx.play('coin'), false);
  assert.equal(await f.fx.resume(), false);
  assert.equal(await f.fx.unlock(), false);
  f.fx.setSound(false);
  await f.visibility(false);
  assert.equal(f.contexts[0].state, 'running');
  assert.equal(f.fx.getState().music, true);
  assert.equal(f.fx.getState().sound, false);
  assert.equal(f.timers.size, 1);
  await f.fx.destroy();
});

test('visibility changes cannot unlock audio or override an explicit pause', async () => {
  const f = fixture();
  f.fx.setMusic(true);
  await f.visibility(true);
  await f.visibility(false);
  assert.equal(f.contexts.length, 0);
  await f.fx.unlock();
  await f.fx.suspend();
  await f.visibility(true);
  await f.visibility(false);
  assert.equal(f.contexts[0].state, 'suspended');
  assert.equal(f.timers.size, 0);
  assert.equal(await f.fx.resume(), true);
  assert.equal(f.timers.size, 1);
  await f.fx.destroy();
});

test('rapid events and a long-running loop keep oscillator and timer counts bounded', async () => {
  const f = fixture();
  await f.fx.unlock();
  f.fx.setMusic(true);
  for (let i = 0; i < 200; i++) f.fx.play('complete');
  assert.ok(f.fx.getState().activeVoices <= 24);
  for (let i = 0; i < 1000; i++) {
    f.tick();
    assert.ok(f.fx.getState().activeVoices <= 24);
    assert.equal(f.timers.size, 1);
  }
  const before = f.contexts[0].oscillators.length;
  f.tick(1000);
  assert.ok(f.contexts[0].oscillators.length - before <= 2, 'no catch-up burst after throttling');
  await f.fx.destroy();
});

test('late resume completion cannot restart sound after becoming hidden', async () => {
  const f = fixture();
  await f.fx.unlock();
  await f.fx.suspend();
  let finish;
  f.contexts[0].resume = () => new Promise(resolve => { finish = () => { f.contexts[0].state = 'running'; resolve(); }; });
  f.fx.setMusic(true);
  const resumed = f.fx.resume();
  await f.visibility(true);
  finish();
  assert.equal(await resumed, false);
  assert.equal(f.contexts[0].state, 'suspended');
  assert.equal(f.timers.size, 0);
  await f.fx.destroy();
});

test('destroy is idempotent and closes context, listeners, timers, and oscillators', async () => {
  const f = fixture();
  await f.fx.unlock();
  f.fx.setMusic(true);
  f.fx.play('complete');
  await f.fx.destroy();
  await f.fx.destroy();
  assert.equal(f.contexts[0].state, 'closed');
  assert.equal(f.contexts[0].listeners.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.fx.getState().activeVoices, 0);
  assert.equal(f.fx.getState().destroyed, true);
  assert.equal(await f.fx.unlock(), false);
  assert.equal(await f.fx.resume(), false);
  assert.equal(f.fx.play('coin'), false);
  assert.equal(f.fx.setMusic(true), false);
  assert.equal(f.fx.setSound(true), false);
});

test('unsupported, rejected, and broken Web Audio fail without throwing', async () => {
  const absent = createAudioFX({ window: {} });
  assert.equal(absent.getState().supported, false);
  assert.equal(await absent.unlock(), false);
  assert.equal(absent.play('click'), false);
  await absent.destroy();
  const broken = fixture({ failConstruction: true });
  assert.equal(await broken.fx.unlock(), false);
  assert.equal(broken.fx.getState().supported, false);
  await broken.fx.destroy();
  const rejected = fixture();
  await rejected.fx.unlock();
  await rejected.fx.suspend();
  rejected.contexts[0].resume = () => Promise.reject(new Error('Gesture needed'));
  assert.equal(await rejected.fx.resume(), false);
  assert.equal(rejected.timers.size, 0);
  await rejected.fx.destroy();
});

test('contextFactory injection works without a global window or AudioContext', async () => {
  const f = fixture();
  const fx = createAudioFX({
    window: {}, document: f.document,
    contextFactory: () => new f.window.AudioContext(),
    setTimeout: f.window.setTimeout, clearTimeout: f.window.clearTimeout,
  });
  assert.equal(f.contexts.length, 0);
  assert.equal(await fx.unlock(), true);
  assert.equal(fx.play('click'), true);
  await fx.destroy();
  await f.fx.destroy();
});
