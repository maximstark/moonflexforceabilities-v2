"use strict";
/* =====================================================================
 *  AUDIO — chiptune tracker + SFX, all synthesized with WebAudio.
 *  Per Josie's spec: "comically cute and simultaneously a little bit
 *  bad retro nes style music." Earnest bootleg energy, on purpose.
 *
 *  Pattern DSL: space-separated 16th-note tokens.
 *    c4 d#3 ...  play that note      "-" hold previous     "." rest
 *  Drum DSL:  k kick  s snare  h hat  .  rest
 * ===================================================================== */
const AudioSys = (() => {
  let ac = null, master, musicBus, sfxBus;
  let muted = false, started = false;
  let song = null, songName = null, stepTimer = null;

  const NOTE = { c:0, d:2, e:4, f:5, g:7, a:9, b:11 };
  function freq(tok) {
    const m = /^([a-g])(#?)(\d)$/.exec(tok);
    if (!m) return 0;
    const semi = NOTE[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3]) + 1) * 12;
    return 440 * Math.pow(2, (semi - 69) / 12);
  }

  function init() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      started = true;
    }
    if (ac.state === "suspended") ac.resume();        // mobile: contexts start suspended
    if (songName && !song) playSong(songName, true);  // start the pending track once live
  }
  function toggleMute() {
    muted = !muted;
    if (ac && ac.state === "suspended") ac.resume();  // a tap on mute also wakes audio
    if (master) master.gain.value = muted ? 0 : 0.55;
    return muted;
  }

  /* ---------------- the songbook ---------------- */
  // tracks: [wave, volume, detuneCents, pattern]
  const SONGS = {
    title: { bpm: 96, tracks: [
      ["square",.30,0,"c4 - e4 - g4 - - - a4 - g4 - e4 - - - f4 - a4 - c5 - - - g4 - - - - - - -"],
      ["square",.16,4,"e3 - g3 - c4 - - - c4 - c4 - g3 - - - a3 - c4 - f4 - - - e4 - - - d4 - - -"],
      ["triangle",.5,0,"c3 - - - g2 - - - a2 - - - e2 - - - f2 - - - c3 - - - g2 - - - g2 - - -"],
      ["drums",.5,0,"k . . . s . . h k . . . s . h h"]]},
    map: { bpm: 92, tracks: [    // paddling between dreams — a calm little rowing tune
      ["triangle",.42,0,"e4 - g4 - a4 - g4 - e4 - d4 - c4 - - - e4 - g4 - a4 - c5 - g4 - a4 - - - - -"],
      ["square",.10,5,"c3 - - - e3 - - - f3 - - - d3 - - - c3 - - - e3 - - - g3 - - - e3 - - -"],
      ["triangle",.45,0,"c3 - - - a2 - - - f2 - - - g2 - - - c3 - - - a2 - - - f2 - - - g2 - - -"],
      ["drums",.3,0,". . h . . . h . . . h . . . h ."]]},
    hub: { bpm: 84, tracks: [
      ["triangle",.42,0,"c5 - g4 - e5 - g4 - d5 - g4 - f5 - e5 - c5 - g4 - e5 - g4 - d5 - b4 - c5 - - -"],
      ["triangle",.3,0,"c3 - - - e3 - - - f3 - - - g3 - - - a3 - - - f3 - - - g3 - - - c3 - - -"]]},
    lake: { bpm: 112, tracks: [
      ["square",.28,0,"c4 e4 g4 e4 a4 - g4 - f4 a4 c5 a4 g4 - e4 - d4 f4 a4 f4 g4 - e4 - c4 d4 e4 d4 c4 - - -"],
      ["square",.14,3,"e3 g3 c4 g3 c4 - c4 - a3 c4 f4 c4 e4 - c4 - b3 d4 f4 d4 e4 - c4 - a3 b3 c4 b3 e3 - - -"],
      ["triangle",.5,0,"c3 - g2 - a2 - e2 - f2 - c3 - g2 - g2 - b2 - g2 - c3 - c3 - f2 - g2 - c3 - - -"],
      ["drums",.55,0,"k . h . s . h . k . h k s . h ."]]},
    night: { bpm: 80, tracks: [
      ["square",.22,0,"a3 - c4 - e4 - c4 - g3 - b3 - e4 - b3 - f3 - a3 - c4 - a3 - e4 - d4 - b3 - - -"],
      ["triangle",.45,0,"a2 - - - e2 - - - g2 - - - e2 - - - f2 - - - a2 - - - e2 - - - e2 - - -"],
      ["drums",.3,0,". . h . . . h . . . h . . . h ."]]},
    under: { bpm: 100, tracks: [
      ["triangle",.4,0,"d4 f4 a4 c5 a4 f4 d4 f4 e4 g4 b4 d5 b4 g4 e4 g4 d4 f4 a4 c5 a4 f4 g4 a4 f4 - d4 - - - - -"],
      ["square",.10,6,"d3 - - - a3 - - - e3 - - - b3 - - - d3 - - - a3 - - - g3 - - - a3 - - -"],
      ["drums",.25,0,". . h . . . . h . . h . . . . ."]]},
    candy: { bpm: 140, tracks: [
      ["square",.26,0,"c4 - g4 - e4 g4 c5 - a4 - c5 - g4 - e4 - d4 - a4 - f4 a4 d5 - c5 b4 a4 b4 c5 - - -"],
      ["square",.13,5,"e3 - c4 - g3 c4 e4 - c4 - e4 - c4 - g3 - f3 - d4 - a3 d4 f4 - e4 d4 c4 d4 e4 - - -"],
      ["triangle",.5,0,"c3 - c3 - e2 - g2 - a2 - a2 - e2 - g2 - f2 - f2 - d2 - f2 - g2 - g2 - c3 - - -"],
      ["drums",.6,0,"k . s h k h s . k . s h k h s h"]]},
    fever: { bpm: 172, tracks: [
      ["square",.26,0,"e4 e4 d#4 e4 g4 e4 a4 g4 e4 e4 d#4 e4 b4 a4 g4 e4 c5 b4 a4 g4 a4 g4 e4 d4 e4 - e4 - e4 d#4 e4 -"],
      ["square",.2,-9,"e4 e4 d#4 e4 g4 e4 a4 g4 e4 e4 d#4 e4 b4 a4 g4 e4 c5 b4 a4 g4 a4 g4 e4 d4 e4 - e4 - e4 d#4 e4 -"],
      ["triangle",.55,0,"e2 e2 e2 e2 g2 g2 a2 a2 e2 e2 e2 e2 b2 b2 g2 g2 a2 a2 g2 g2 f2 f2 e2 e2 e2 b2 e2 b2 e2 e2 e2 e2"],
      ["drums",.7,0,"k h s h k h s k k h s h k s k s"]]},
    boss: { bpm: 150, tracks: [
      ["square",.28,0,"a3 - a3 c4 e4 - d4 c4 a3 - a3 c4 f4 - e4 d4 a3 - a3 c4 e4 - g4 a4 g4 e4 d4 c4 d4 - - -"],
      ["triangle",.55,0,"a2 a2 - a2 a2 - a2 - f2 f2 - f2 f2 - f2 - g2 g2 - g2 g2 - g2 - e2 e2 e2 - e2 - e2 -"],
      ["drums",.65,0,"k . k s k . s . k . k s k . s s"]]},
    hogdog: { bpm: 132, tracks: [
      ["square",.26,0,"d3 - - - d3 f3 g#3 - g3 - f3 - d3 - - - d3 - - - d3 f3 g#3 - a3 - c4 - d4 - - -"],
      ["square",.16,8,"d4 - - - . . . . g4 - f4 - d4 - - - . . . . d4 f4 g#4 - a4 - c5 - d5 - - -"],
      ["triangle",.6,0,"d2 - d2 - d2 - d2 - g1 - g1 - d2 - d2 - d2 - d2 - d2 - d2 - a1 - c2 - d2 - - -"],
      ["drums",.7,0,"k . . k . . s . k . . k . . s h"]]},
    mecha: { bpm: 128, tracks: [
      ["square",.3,0,"c4 - c4 - g4 - - - e4 - g4 - c5 - - - a4 - c5 - f4 - a4 - g4 - e4 - c4 - - -"],
      ["square",.18,4,"e3 - e3 - c4 - - - g3 - c4 - e4 - - - c4 - f4 - a3 - c4 - c4 - g3 - e3 - - -"],
      ["triangle",.55,0,"c3 - c3 - c3 - g2 - c3 - c3 - a2 - a2 - f2 - f2 - f2 - g2 - c3 - g2 - c3 - - -"],
      ["drums",.7,0,"k . h . s . h . k k h . s . h h"]]},
    store: { bpm: 116, tracks: [
      ["square",.24,0,"g4 - e4 - c4 - e4 - g4 - a4 - g4 - - - f4 - d4 - b3 - d4 - f4 - e4 - c4 - - -"],
      ["triangle",.45,0,"c3 - - - e2 - - - f2 - - - g2 - - - g2 - - - b2 - - - c3 - - - c3 - - -"],
      ["drums",.4,0,". . h . . . h . . . h . . . h ."]]},
    biggest: { bpm: 144, tracks: [   // THE BIGGEST DREAM — the whole big guy deserves his own song
      ["square",.28,0,"a3 - c4 - e4 - a4 - g4 - e4 - c4 - e4 - f4 - a4 - c5 - b4 a4 g4 - e4 - a4 - - -"],
      ["square",.14,-7,"e3 - a3 - c4 - e4 - e4 - c4 - a3 - c4 - d4 - f4 - a4 - g4 f4 e4 - c4 - e4 - - -"],
      ["triangle",.55,0,"a2 a2 - a2 a2 - a2 - f2 f2 - f2 f2 - f2 - g2 g2 - g2 g2 - g2 - e2 e2 - e2 g2 - a2 -"],
      ["drums",.7,0,"k . h . s . h h k . h . s . h k"]]},
    ending: { bpm: 66, tracks: [
      ["triangle",.45,0,"c4 - e4 - g4 - - - a4 - g4 - e4 - - - f4 - e4 - d4 - - - c4 - - - - - - -"],
      ["triangle",.3,0,"c3 - - - - - - - f2 - - - - - - - a2 - - - g2 - - - c3 - - - - - - -"],
      ["square",.08,3,"e5 - - - - - - - c5 - - - - - - - d5 - - - b4 - - - c5 - - - - - - -"]]},
  };

  function stopSong() {
    if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
    song = null;
  }
  function playSong(name, force) {
    songName = name;
    if (!started) return;                      // remember; start on first input
    if (!force && song && song.name === name) return;
    stopSong();
    if (!name || !SONGS[name]) return;
    const def = SONGS[name];
    song = { name, def, step: 0, nextTime: ac.currentTime + 0.06,
             stepDur: 60 / def.bpm / 4,
             tracks: def.tracks.map(t => ({ wave: t[0], vol: t[1], det: t[2],
                                            toks: t[3].trim().split(/\s+/) })) };
    stepTimer = setInterval(schedule, 40);
  }
  function schedule() {
    if (!song) return;
    while (song.nextTime < ac.currentTime + 0.15) {
      for (const tr of song.tracks) {
        const tok = tr.toks[song.step % tr.toks.length];
        if (tok === "." || tok === "-") continue;
        // count holds to size the note
        let len = 1;
        for (let k = 1; k < 32; k++) {
          if (tr.toks[(song.step + k) % tr.toks.length] === "-") len++; else break;
        }
        if (tr.wave === "drums") drum(tok, song.nextTime, tr.vol);
        else blip(tr.wave, freq(tok), song.nextTime, song.stepDur * len, tr.vol, tr.det);
      }
      song.step++;
      song.nextTime += song.stepDur;
    }
  }
  function blip(wave, f, t, dur, vol, det) {
    if (!f) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = wave; o.frequency.value = f; if (det) o.detune.value = det;
    g.gain.setValueAtTime(vol, t);
    g.gain.setTargetAtTime(0, t + dur * 0.7, 0.03);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.12);
  }
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function drum(tok, t, vol) {
    if (tok === "k") {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "square"; o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
      g.gain.setValueAtTime(vol * 0.5, t); g.gain.setTargetAtTime(0, t + 0.02, 0.03);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.15);
    } else {
      const s = noise(), g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = tok === "s" ? 1200 : 6000;
      g.gain.setValueAtTime(vol * (tok === "s" ? 0.4 : 0.18), t);
      g.gain.setTargetAtTime(0, t, tok === "s" ? 0.04 : 0.015);
      s.connect(f); f.connect(g); g.connect(musicBus); s.start(t); s.stop(t + 0.12);
    }
  }

  /* ---------------- SFX ---------------- */
  function env(wave, f0, f1, dur, vol, curve) {
    if (!started || muted) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) {
      if (curve === "exp") o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      else o.frequency.linearRampToValueAtTime(f1, t + dur);
    }
    g.gain.setValueAtTime(vol, t);
    g.gain.setTargetAtTime(0, t + dur * 0.55, dur * 0.22);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.15);
  }
  function noiseHit(dur, vol, hp) {
    if (!started || muted) return;
    const t = ac.currentTime;
    const s = noise(), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = hp || 800;
    g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0, t, dur * 0.4);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.05);
  }
  function arp(notes, dt, dur, vol, wave) {
    if (!started || muted) return;
    notes.forEach((n, i) => {
      const t = ac.currentTime + i * dt;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = wave || "square"; o.frequency.value = typeof n === "string" ? freq(n) : n;
      g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0, t + dur * 0.5, 0.04);
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.1);
    });
  }

  const SFX = {
    jump:      () => env("square", 280, 620, 0.12, 0.22),
    flap:      () => env("triangle", 360, 520, 0.09, 0.25),
    stomp:     () => { env("square", 300, 80, 0.12, 0.3, "exp"); noiseHit(0.08, 0.18, 2000); },
    hurt:      () => env("sawtooth", 320, 90, 0.28, 0.3, "exp"),
    popcorn:   () => arp(["e5","g5"], 0.05, 0.08, 0.18),
    star:      () => arp(["c5","e5","g5","c6"], 0.06, 0.1, 0.2),
    treat:     () => arp(["g4","c5","e5"], 0.05, 0.1, 0.22),
    moon:      () => arp(["c5","d5","e5","g5","c6","e6"], 0.06, 0.12, 0.2),
    transform: () => arp(["c4","e4","g4","c5","e5"], 0.04, 0.09, 0.22),
    shed:      () => arp(["e5","c5","g4"], 0.05, 0.08, 0.2),
    laser:     () => env("sawtooth", 1600, 200, 0.18, 0.16, "exp"),
    fire:      () => { env("square", 500, 220, 0.14, 0.2, "exp"); noiseHit(0.1, 0.1, 3000); },
    pink:      () => { arp(["c5","e5","g5","b5","d6"], 0.03, 0.16, 0.2, "triangle"); noiseHit(0.3, 0.12, 500); },
    nut:       () => env("square", 700, 400, 0.06, 0.18),
    spoon:     () => { env("triangle", 900, 200, 0.1, 0.25, "exp"); noiseHit(0.05, 0.12, 4000); },
    splash:    () => noiseHit(0.3, 0.25, 900),
    bubble:    () => env("sine", 300, 700, 0.12, 0.15),
    agh:       () => { env("sawtooth", 200, 600, 0.1, 0.3); env("sawtooth", 600, 150, 0.35, 0.3, "exp"); },
    roar:      () => { env("sawtooth", 140, 60, 0.5, 0.4, "exp"); noiseHit(0.4, 0.2, 300); },
    bossHurt:  () => { env("square", 240, 60, 0.3, 0.35, "exp"); arp(["c5","g4"], 0.08, 0.1, 0.2); },
    bossDie:   () => arp(["c4","g3","e3","c3","g2","c2"], 0.1, 0.2, 0.3),
    letter:    () => arp(["c5","c5"], 0.06, 0.05, 0.18),
    refund:    () => arp(["c5","g4"], 0.06, 0.05, 0.15),
    ding:      () => arp(["g5","c6"], 0.1, 0.3, 0.2, "triangle"),
    door:      () => env("triangle", 220, 320, 0.15, 0.2),
    pound:     () => { env("square", 200, 50, 0.18, 0.4, "exp"); noiseHit(0.15, 0.3, 600); },
    breakblock:() => noiseHit(0.18, 0.3, 1200),
    spring:    () => env("square", 220, 880, 0.18, 0.25),
    baby:      () => arp(["e5","g5","e5","c6"], 0.07, 0.12, 0.2, "triangle"),
    win:       () => arp(["c4","e4","g4","c5","e5","g5","c6"], 0.09, 0.25, 0.25),
    tenmil:    () => arp(["c4","g4","c5","e5","g5","c6","e6","g6"], 0.07, 0.3, 0.28),
    moonflex:  () => arp(["c4","e4","g4","b4","d5","f#5","a5"], 0.05, 0.12, 0.22),
    menu:      () => env("square", 520, 660, 0.05, 0.10),
    checkpoint:() => arp(["g4","c5","e5","g5"], 0.06, 0.14, 0.22, "triangle"),
  };
  function sfx(name) { if (SFX[name]) SFX[name](); }

  return { init, sfx, playSong, stopSong, toggleMute,
           get muted() { return muted; }, get song() { return songName; } };
})();
