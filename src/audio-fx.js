/**
 * Tiny, original Web Audio score and UI sounds. No downloaded music or voices.
 * Call unlock() synchronously from a user gesture; nothing creates an AudioContext
 * before that call. Native user-activation checks are respected when available.
 */
export function createAudioFX(options = {}) {
  const host = options.window ?? globalThis.window ?? globalThis;
  const page = options.document ?? host.document;
  const Context = options.AudioContext ?? host.AudioContext ?? host.webkitAudioContext;
  const factory = options.contextFactory ?? (Context ? () => new Context({ latencyHint: 'interactive' }) : null);
  const later = options.setTimeout ?? host.setTimeout?.bind(host) ?? globalThis.setTimeout;
  const cancel = options.clearTimeout ?? host.clearTimeout?.bind(host) ?? globalThis.clearTimeout;
  const MAX_VOICES = 24;
  const voices = new Set();
  let supported = Boolean(factory), context = null, master = null;
  let unlocked = false, music = false, sound = true, volume = 0.65;
  let destroyed = false, manuallySuspended = false, musicTimer = null;
  let nextBeat = 0, beat = 0;

  const hidden = () => page?.hidden === true || page?.visibilityState === 'hidden';
  const permitted = () => !destroyed && unlocked && !manuallySuspended && !hidden();
  const running = () => permitted() && context?.state === 'running';
  const now = () => context?.currentTime ?? 0;

  function cleanVoice(voice) {
    if (!voices.delete(voice)) return;
    voice.oscillator.onended = null;
    try { voice.oscillator.disconnect(); } catch { /* Already disconnected. */ }
    try { voice.envelope.disconnect(); } catch { /* Already disconnected. */ }
  }

  function stopVoice(voice) {
    try { voice.oscillator.stop(); } catch { /* A stopped oscillator is harmless. */ }
    cleanVoice(voice);
  }

  function stopVoices(track) {
    for (const voice of voices) if (!track || voice.track === track) stopVoice(voice);
  }

  function stopMusic() {
    if (musicTimer !== null) cancel(musicTimer);
    musicTimer = null;
    nextBeat = 0;
    beat = 0;
    stopVoices('music');
  }

  function stopAll() {
    stopMusic();
    stopVoices();
  }

  function suspendContext() {
    stopAll();
    if (!context || context.state === 'closed' || context.state === 'suspended') return Promise.resolve(true);
    try { return Promise.resolve(context.suspend?.()).then(() => true, () => false); }
    catch { return Promise.resolve(false); }
  }

  function setParam(param, value, time) {
    if (param?.setValueAtTime) param.setValueAtTime(value, time);
    else if (param) param.value = value;
  }

  function updateVolume() {
    if (!master) return;
    const time = now();
    try {
      master.gain.cancelScheduledValues?.(time);
      // A short gain glide prevents clicks while dragging a volume slider.
      if (master.gain.setTargetAtTime) master.gain.setTargetAtTime(volume, time, 0.015);
      else setParam(master.gain, volume, time);
    } catch { /* A browser may close its audio device at any time. */ }
  }

  function tone(frequency, start, duration, strength, type, track, endFrequency) {
    if (!running() || volume === 0) return false;
    for (const voice of voices) if (voice.end <= now()) cleanVoice(voice);
    while (voices.size >= MAX_VOICES) stopVoice(voices.values().next().value);
    let oscillator, envelope, voice;
    try {
      oscillator = context.createOscillator();
      envelope = context.createGain();
      oscillator.type = type;
      setParam(oscillator.frequency, frequency, start);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime?.(endFrequency, start + duration);
      const attack = Math.min(0.018, duration / 4);
      setParam(envelope.gain, 0, start);
      if (envelope.gain.linearRampToValueAtTime) {
        envelope.gain.linearRampToValueAtTime(strength, start + attack);
        envelope.gain.linearRampToValueAtTime(0, start + duration);
      } else {
        setParam(envelope.gain, strength, start);
        setParam(envelope.gain, 0, start + duration);
      }
      oscillator.connect(envelope);
      envelope.connect(master);
      voice = { oscillator, envelope, track, end: start + duration + 0.025 };
      voices.add(voice);
      oscillator.onended = () => cleanVoice(voice);
      oscillator.start(start);
      oscillator.stop(voice.end);
      return true;
    } catch {
      if (voice) stopVoice(voice);
      else {
        try { oscillator?.disconnect(); } catch { /* Partial construction. */ }
        try { envelope?.disconnect(); } catch { /* Partial construction. */ }
      }
      return false;
    }
  }

  function scheduleMusic() {
    musicTimer = null;
    if (!running() || !music || volume === 0) return;
    const time = now();
    // Do not replay a backlog after a throttled tab or sleeping device.
    if (nextBeat < time) nextBeat = time + 0.035;
    const melody = [261.63, 329.63, 392.0, 329.63];
    while (nextBeat < time + 0.18) {
      const frequency = melody[beat % melody.length];
      tone(frequency, nextBeat, 0.60, 0.085, 'sine', 'music');
      if (beat % 4 === 0) tone(130.815, nextBeat, 1.1, 0.035, 'triangle', 'music');
      nextBeat += 0.7;
      beat += 1;
    }
    musicTimer = later(scheduleMusic, 110);
  }

  function startMusic() {
    if (running() && music && volume > 0 && musicTimer === null) scheduleMusic();
  }

  function onContextStateChange() {
    if (destroyed) return;
    if (!permitted()) void suspendContext();
    else if (context?.state === 'running') startMusic();
    else stopAll();
  }

  function ensureContext() {
    if (context) return context.state !== 'closed';
    if (!factory || !supported) return false;
    try {
      context = factory();
      if (!context?.createGain || !context?.createOscillator || !context?.destination) throw new Error('Web Audio unavailable');
      master = context.createGain();
      setParam(master.gain, volume, now());
      master.connect(context.destination);
      context.addEventListener?.('statechange', onContextStateChange);
      return true;
    } catch {
      try { master?.disconnect(); } catch { /* Partial initialization. */ }
      try { Promise.resolve(context?.close?.()).catch(() => {}); } catch { /* Unsupported context. */ }
      context = null;
      master = null;
      supported = false;
      return false;
    }
  }

  async function resumeContext() {
    if (!permitted() || !context || context.state === 'closed') return false;
    try {
      // Invoke resume before the first await, retaining the user's gesture.
      if (context.state !== 'running') await context.resume?.();
      // A pending resume must not restart audio after hiding, pausing, or disposal.
      if (!permitted()) {
        await suspendContext();
        return false;
      }
      startMusic();
      return running();
    } catch {
      stopAll();
      return false;
    }
  }

  function onVisibilityChange() {
    if (hidden()) void suspendContext();
    else if (unlocked && !manuallySuspended) void resumeContext();
  }

  page?.addEventListener?.('visibilitychange', onVisibilityChange);

  return {
    /** Only invoke directly from a pointer, keyboard, or click handler. */
    unlock() {
      if (destroyed || hidden() || !supported) return Promise.resolve(false);
      const activation = host.navigator?.userActivation;
      if (activation && activation.isActive === false) return Promise.resolve(false);
      if (!ensureContext()) return Promise.resolve(false);
      unlocked = true;
      manuallySuspended = false;
      return resumeContext();
    },
    setMusic(enabled) {
      if (destroyed) return false;
      music = Boolean(enabled);
      if (music) startMusic();
      else stopMusic();
      return music;
    },
    setSound(enabled) {
      if (destroyed) return false;
      sound = Boolean(enabled);
      if (!sound) stopVoices('sound');
      return sound;
    },
    setVolume(value) {
      if (destroyed || typeof value !== 'number' || !Number.isFinite(value)) return volume;
      volume = Math.max(0, Math.min(1, value));
      updateVolume();
      if (volume === 0) stopAll();
      else startMusic();
      return volume;
    },
    play(name) {
      if (!running() || !sound || volume === 0) return false;
      const sounds = {
        // A soft 45 ms low thud, paced by the caller only while running.
        step: [[125, 0, 0.045, 0.035, 'triangle', 78]],
        click: [[440, 0, 0.055, 0.10, 'sine', 580]],
        select: [[523.25, 0, 0.12, 0.11], [783.99, 0.065, 0.17, 0.08]],
        discover: [[392, 0, 0.18, 0.10], [523.25, 0.09, 0.20, 0.10], [659.25, 0.18, 0.28, 0.10]],
        coin: [[987.77, 0, 0.09, 0.12], [1318.51, 0.07, 0.20, 0.10]],
        progress: [[523.25, 0, 0.12, 0.10], [659.25, 0.08, 0.16, 0.09], [783.99, 0.16, 0.24, 0.08]],
        correct: [[523.25, 0, 0.16, 0.11], [659.25, 0.10, 0.18, 0.10], [1046.50, 0.21, 0.30, 0.08]],
        incorrect: [[293.66, 0, 0.15, 0.10, 'triangle', 246.94], [220, 0.13, 0.20, 0.08, 'triangle']],
        complete: [[523.25, 0, 0.17, 0.10], [659.25, 0.12, 0.17, 0.09], [783.99, 0.24, 0.19, 0.09], [1046.50, 0.38, 0.48, 0.08], [523.25, 0.38, 0.50, 0.055]],
      };
      const notes = Object.hasOwn(sounds, name) ? sounds[name] : null;
      if (!notes) return false;
      const start = now() + 0.008;
      let played = false;
      for (const [frequency, offset, duration, strength, type = 'sine', endFrequency] of notes) {
        played = tone(frequency, start + offset, duration, strength, type, 'sound', endFrequency) || played;
      }
      return played;
    },
    suspend() {
      manuallySuspended = true;
      return suspendContext();
    },
    resume() {
      if (destroyed) return Promise.resolve(false);
      manuallySuspended = false;
      // This never creates a context or unlocks audio on its own.
      return resumeContext();
    },
    async destroy() {
      if (destroyed) return;
      destroyed = true;
      unlocked = false;
      stopAll();
      page?.removeEventListener?.('visibilitychange', onVisibilityChange);
      context?.removeEventListener?.('statechange', onContextStateChange);
      try { master?.disconnect(); } catch { /* Already disconnected. */ }
      try { if (context?.state !== 'closed') await context?.close?.(); } catch { /* Device already gone. */ }
      master = null;
    },
    getState() {
      return {
        supported, unlocked, music, sound, volume, destroyed,
        active: Boolean(running()),
        suspended: !running(),
        playingMusic: musicTimer !== null,
        activeVoices: voices.size,
      };
    },
  };
}
