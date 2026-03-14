import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

/**
 * AudioExporter - Handles audio buffer conversion and file export
 */
class AudioExporter {
  /**
   * Export audio samples (Float32Array) to WAV file
   * @param {Float32Array|AudioBuffer} audio - Audio samples or AudioBuffer
   * @param {string} filename - Output filename
   * @param {string} outputDir - Output directory (default: ./output)
   * @param {number} sampleRate - Sample rate (default: 44100)
   * @returns {string} Path to exported file
   */
  static exportToWAV(audio, filename = 'music.wav', outputDir = './output', sampleRate = 44100) {
    if (!(audio instanceof Float32Array)) {
      throw new Error('Input must be Float32Array');
    }

    const samples = audio;
    const wavData = this.audioToWAV(samples, sampleRate, 1);
    
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    const filepath = resolve(outputDir, filename);

    try {
      writeFileSync(filepath, wavData);
      console.log(`✅ Audio exported to: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error(`❌ Export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert audio samples to WAV format
   * @param {Float32Array} samples - Audio samples (-1.0 to 1.0)
   * @param {number} sampleRate - Sample rate in Hz
   * @param {number} numChannels - Number of channels (default: 1 for mono)
   * @returns {Buffer} WAV file buffer
   */
  static audioToWAV(samples, sampleRate = 44100, numChannels = 1) {
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const dataLength = samples.length * bytesPerSample;
    const fileLength = 36 + dataLength;

    const wavBuffer = Buffer.alloc(44 + dataLength);
    const view = new DataView(wavBuffer.buffer);

    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, fileLength, true);
    this.writeString(view, 8, 'WAVE');

    // fmt subchunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, format, true); // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitDepth, true); // BitsPerSample

    // data subchunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write samples
    this.writePCM16(view, 44, samples);

    return wavBuffer;
  }

  /**
   * Write string to DataView (ASCII)
   */
  static writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Convert float samples (-1.0 to 1.0) to 16-bit PCM and write to DataView
   */
  static writePCM16(view, offset, samples) {
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  /**
   * Get audio duration in seconds
   * @param {Float32Array} audio - Audio samples
   * @param {number} sampleRate - Sample rate (default 44100)
   * @returns {number} Duration in seconds
   */
  static getDuration(audio, sampleRate = 44100) {
    if (audio instanceof Float32Array) {
      return audio.length / sampleRate;
    }
    return 0;
  }
}

export default AudioExporter;
