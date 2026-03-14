class SimpleAudioGenerator {
  static generateSineWave(frequency, duration, sampleRate = 44100, amplitude = 0.3) {
    const samples = new Float32Array(Math.floor(duration * sampleRate));
    
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
    }
    
    return samples;
  }

  static generateTriangleWave(frequency, duration, sampleRate = 44100, amplitude = 0.3) {
    const samples = new Float32Array(Math.floor(duration * sampleRate));
    const period = sampleRate / frequency;
    
    for (let i = 0; i < samples.length; i++) {
      const phase = (i % period) / period;
      let value;
      
      if (phase < 0.25) {
        value = 4 * phase;
      } else if (phase < 0.75) {
        value = 2 - 4 * phase;
      } else {
        value = 4 * (phase - 1);
      }
      
      samples[i] = amplitude * value;
    }
    
    return samples;
  }

  static generateSquareWave(frequency, duration, sampleRate = 44100, amplitude = 0.3) {
    const samples = new Float32Array(Math.floor(duration * sampleRate));
    const period = sampleRate / frequency;
    
    for (let i = 0; i < samples.length; i++) {
      const phase = (i % period) / period;
      samples[i] = amplitude * (phase < 0.5 ? 1 : -1);
    }
    
    return samples;
  }

  static generateSawtoothWave(frequency, duration, sampleRate = 44100, amplitude = 0.3) {
    const samples = new Float32Array(Math.floor(duration * sampleRate));
    const period = sampleRate / frequency;
    
    for (let i = 0; i < samples.length; i++) {
      const phase = (i % period) / period;
      samples[i] = amplitude * (2 * phase - 1);
    }
    
    return samples;
  }

  /**
   * Parse note string to frequency (e.g., "C4" -> 261.63)
   * @param {string} note - Note name (e.g., "C4", "D#4")
   * @returns {number} Frequency in Hz
   */
  static noteToFrequency(note) {
    const notes = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };
    
    let noteMatch = note.match(/([A-G])([#b])?(\d)/);
    if (!noteMatch) return 261.63; // Default to C4
    
    const [, noteName, modifier, octave] = noteMatch;
    let semitone = notes[noteName];
    
    if (modifier === '#') semitone += 1;
    if (modifier === 'b') semitone -= 1;
    
    // A4 = 440Hz, C4 = 261.63Hz
    // Calculate based on semitone distance from C0
    const semitonesFromA0 = (parseInt(octave) - 0) * 12 + semitone - notes['A'];
    const frequency = 27.5 * Math.pow(2, semitonesFromA0 / 12);
    
    return frequency;
  }

  /**
   * Apply ADSR envelope to samples
   * @param {Float32Array} samples - Input samples
   * @param {Object} envelope - {attack, decay, sustain, release} times in seconds
   * @param {number} sampleRate - Sample rate
   * @returns {Float32Array} Enveloped samples
   */
  static applyEnvelope(samples, envelope, sampleRate = 44100) {
    const { attack = 0.005, decay = 0.1, sustain = 0.3, release = 0.5 } = envelope;
    const totalTime = attack + decay + sustain + release;
    const totalSamples = Math.floor(totalTime * sampleRate);
    
    const attackSamples = Math.floor(attack * sampleRate);
    const decaySamples = Math.floor(decay * sampleRate);
    const sustainSamples = Math.floor(sustain * sampleRate);
    const releaseSamples = Math.floor(release * sampleRate);
    
    const enveloped = new Float32Array(totalSamples);
    let srcIndex = 0;
    
    // Attack phase
    for (let i = 0; i < attackSamples && srcIndex < samples.length; i++) {
      const envelope = i / attackSamples;
      enveloped[i] = samples[srcIndex++] * envelope;
    }
    
    // Decay phase
    for (let i = 0; i < decaySamples && srcIndex < samples.length; i++) {
      const decayEnv = 1 - (i / decaySamples) * 0.7; // Decay to 30% of peak
      enveloped[attackSamples + i] = samples[srcIndex++] * decayEnv;
    }
    
    // Sustain phase
    for (let i = 0; i < sustainSamples && srcIndex < samples.length; i++) {
      enveloped[attackSamples + decaySamples + i] = samples[srcIndex++] * 0.3;
    }
    
    // Release phase
    for (let i = 0; i < releaseSamples && srcIndex < samples.length; i++) {
      const releaseEnv = 1 - (i / releaseSamples);
      enveloped[attackSamples + decaySamples + sustainSamples + i] = samples[srcIndex++] * releaseEnv * 0.3;
    }
    
    return enveloped;
  }

  /**
   * Mix multiple audio samples together
   * @param {Float32Array[]} audioSamples - Array of audio samples
   * @returns {Float32Array} Mixed audio
   */
  static mixAudio(audioSamples) {
    if (audioSamples.length === 0) return new Float32Array();
    if (audioSamples.length === 1) return audioSamples[0];
    
    const maxLength = Math.max(...audioSamples.map(s => s.length));
    const mixed = new Float32Array(maxLength);
    
    for (const samples of audioSamples) {
      for (let i = 0; i < samples.length; i++) {
        mixed[i] += samples[i];
      }
    }
    
    // Normalize to prevent clipping
    let max = 0;
    for (let i = 0; i < mixed.length; i++) {
      max = Math.max(max, Math.abs(mixed[i]));
    }
    
    if (max > 1) {
      for (let i = 0; i < mixed.length; i++) {
        mixed[i] /= max;
      }
    }
    
    return mixed;
  }
}

export default SimpleAudioGenerator;
