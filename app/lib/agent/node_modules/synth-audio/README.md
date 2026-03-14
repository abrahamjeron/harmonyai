# synth-audio

synth-audio is a lightweight Node.js music generation engine (nth Harmony) that synthesizes audio buffers and exports WAV files. It is designed for programmatic/AI-driven music generation and can be used in Node.js projects (ES modules).

Overview
--------
- Package name: `synth-audio`
- Entry point: `engine/MusicEngine.js` (exports the default `MusicEngine` class)
- Module type: ES modules (`"type": "module"` in package.json)

Quick usage
-----------

```js
import MusicEngine from 'synth-audio';

const params = {
  mood: 'happy',            // required; one of: happy, sad, energetic, peaceful, dramatic, dreamy
  tempo: 120,              // required; BPM (60-180)
  key: 'C',                // required; one of: C,G,D,A,E,F,Bb
  duration: 30,            // required; seconds (5-300)
  energy: 'medium',        // required; one of: low, medium, high
  lyrics: 'A seed of melody',
  instruments: [
    { name: 'lead', waveform: 'sine', volume: 0.3, envelope: { attack: 0.01, decay: 0.05, sustain: 0.8, release: 0.1 } },
    { name: 'pad', waveform: 'triangle', volume: 0.2, envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.5 } }
  ],
  customChords: ['C4','G3','A3','F3'],
  customScale: ['C4','D4','E4','F4','G4','A4','B4'],
  melody: { type: 'custom', notes: ['E4','D4','C4','G3'], loop: true }
};

const main = async () => {
  const result = await MusicEngine.generate(params);
  console.log('Generation result:', result);
};

main();
```

Input parameters (detailed)
---------------------------

- mood (string, required): Creative mood. Valid: `happy`, `sad`, `energetic`, `peaceful`, `dramatic`, `dreamy`.
- tempo (number, required): Beats per minute. Clamped between 60 and 180.
- key (string, required): Musical key. Valid: `C`, `G`, `D`, `A`, `E`, `F`, `Bb`.
- duration (number, required): Length of generated audio in seconds. Clamped between 5 and 300.
- energy (string, required): Overall energy. Valid: `low`, `medium`, `high`.
- lyrics (string, required): Optional lyrics/seed text for the generator.
- instruments (array, required): Array of instrument objects. Each instrument must include:
  - name (string)
  - waveform (string): one of `sine`, `triangle`, `square`, `sawtooth`
  - volume (number): 0.0 - 1.0
  - envelope (object): ADSR envelope with `attack`, `decay`, `sustain`, `release` in seconds
- customChords (array of strings, optional): Sequence of chord root notes like `C4`, `G3`.
- customScale (array of strings, optional): Explicit scale notes like `C4`, `D4`, etc.
- melody (object|string, optional): Can be a melody type string (see supported types) or an object with `type: 'custom'` and `notes` array. Example: `{ type: 'custom', notes: ['E4','D4'], loop: true }`.
- effects (object, optional): Effects configuration (reverb, delay, distortion) — see code for options and defaults.
- dynamics (object, optional): Dynamics settings (swing, humanize, volumeVariation).
- rests (array/object, optional): Rests/silence placements between notes.

Return value
------------

`MusicEngine.generate(params)` returns a Promise that resolves to an object with:

- success (boolean)
- filePath (string) — path to the exported WAV file (when success is true)
- duration (number) — duration in seconds
- message (string) — human-readable status

Example result:

```
{
  success: true,
  filePath: '/path/to/output/music_2026-03-10T05-43-00.wav',
  duration: 30,
  message: '✅ Music generated successfully! (30.00s)'
}
```


