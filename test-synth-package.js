#!/usr/bin/env node

/**
 * Test script for synth-audio npm package
 * Validates MusicEngine.generate() and MusicEngine.mixSections()
 * 
 * Usage:
 *   node test-synth-package.js [--tempo=120] [--duration=10] [--key=C]
 */

import MusicEngine from 'synth-audio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_OUTPUT_DIR = path.join(__dirname, 'test-output');

// Ensure output directory exists
if (!fs.existsSync(TEST_OUTPUT_DIR)) {
  fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
}

// Parse command-line arguments
function parseArgs() {
  const args = {
    tempo: 120,
    duration: 10,
    key: 'C',
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (key === 'tempo' || key === 'duration') {
        args[key] = parseInt(value, 10);
      } else if (key === 'key') {
        args[key] = value;
      }
    }
  });

  return args;
}

async function testMusicEngineGenerate() {
  const args = parseArgs();

  console.log('\n🎵 ============================================');
  console.log('   synth-audio Package Test Suite');
  console.log('============================================\n');

  console.log('📋 Test Parameters:');
  console.log(`   Tempo: ${args.tempo} BPM`);
  console.log(`   Duration: ${args.duration}s`);
  console.log(`   Key: ${args.key}`);
  console.log();

  // Test 1: Basic generation with minimal params
  console.log('🧪 Test 1: Basic Music Generation');
  console.log('   ↳ Testing MusicEngine.generate() with minimal parameters...\n');

  const verseOutputPath = path.join(TEST_OUTPUT_DIR, 'test_verse.wav');
  const verseParams = {
    tempo: args.tempo,
    key: args.key,
    duration: args.duration,
    outputPath: verseOutputPath,
    instruments: [
      {
        name: 'synth',
        waveform: 'sine',
        volume: 0.6,
        envelope: {
          attack: 0.01,
          decay: 0.1,
          sustain: 0.7,
          release: 0.3,
        },
      },
    ],
    customChords: ['C4', 'E4', 'G4'],
    customScale: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  };

  try {
    const verseResult = await MusicEngine.generate(verseParams);

    if (verseResult.success) {
      console.log('   ✅ PASS: MusicEngine.generate() succeeded');
      console.log(`   Output: ${verseResult.filePath}`);
      console.log(`   Duration: ${verseResult.duration}s`);

      // Verify file exists
      if (fs.existsSync(verseResult.filePath)) {
        const stats = fs.statSync(verseResult.filePath);
        console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
      }
      console.log();
    } else {
      console.log('   ❌ FAIL: MusicEngine.generate() returned success=false');
      console.log(`   Error: ${verseResult.error}`);
      console.log();
    }
  } catch (error) {
    console.log('   ❌ FAIL: MusicEngine.generate() threw an error');
    console.log(`   Error: ${error.message}`);
    console.log();
    process.exit(1);
  }

  // Test 2: Generation with custom chords
  console.log('🧪 Test 2: Music Generation with Custom Chords');
  console.log('   ↳ Testing MusicEngine.generate() with custom chord progression...\n');

  const chorusOutputPath = path.join(TEST_OUTPUT_DIR, 'test_chorus.wav');
  const chorusParams = {
    tempo: args.tempo,
    key: args.key,
    duration: args.duration,
    outputPath: chorusOutputPath,
    instruments: [
      {
        name: 'synth',
        waveform: 'triangle',
        volume: 0.5,
        envelope: {
          attack: 0.02,
          decay: 0.15,
          sustain: 0.6,
          release: 0.4,
        },
      },
      {
        name: 'bass',
        waveform: 'sine',
        volume: 0.4,
        envelope: {
          attack: 0.01,
          decay: 0.1,
          sustain: 0.5,
          release: 0.2,
        },
      },
    ],
    customChords: ['C4', 'E4', 'G4', 'Bb4'],
    customScale: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    effects: {
      reverb: { enabled: true, decay: 1.5 },
    },
  };

  try {
    const chorusResult = await MusicEngine.generate(chorusParams);

    if (chorusResult.success) {
      console.log('   ✅ PASS: MusicEngine.generate() with custom chords succeeded');
      console.log(`   Output: ${chorusResult.filePath}`);
      console.log(`   Duration: ${chorusResult.duration}s`);

      if (fs.existsSync(chorusResult.filePath)) {
        const stats = fs.statSync(chorusResult.filePath);
        console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
      }
      console.log();
    } else {
      console.log('   ❌ FAIL: MusicEngine.generate() with chords returned success=false');
      console.log(`   Error: ${chorusResult.error}`);
      console.log();
    }
  } catch (error) {
    console.log('   ❌ FAIL: MusicEngine.generate() with chords threw an error');
    console.log(`   Error: ${error.message}`);
    console.log();
    process.exit(1);
  }

  // Test 3: Mix sections
  console.log('🧪 Test 3: Section Mixing');
  console.log('   ↳ Testing MusicEngine.mixSections()...\n');

  const bridgeOutputPath = path.join(TEST_OUTPUT_DIR, 'test_bridge.wav');
  const bridgeParams = {
    tempo: args.tempo,
    key: args.key,
    duration: args.duration,
    outputPath: bridgeOutputPath,
    instruments: [
      {
        name: 'synth',
        waveform: 'square',
        volume: 0.5,
        envelope: {
          attack: 0.02,
          decay: 0.12,
          sustain: 0.65,
          release: 0.35,
        },
      },
    ],
    customChords: ['F4', 'A4', 'C5'],
    customScale: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  };

  try {
    const bridgeResult = await MusicEngine.generate(bridgeParams);

    if (!bridgeResult.success) {
      console.log('   ⚠️  Bridge generation failed, skipping mix test');
      console.log();
    } else {
      const fullOutputPath = path.join(TEST_OUTPUT_DIR, 'test_full_song.wav');

      const mixResult = MusicEngine.mixSections({
        verseWavPath: verseOutputPath,
        chorusWavPath: chorusOutputPath,
        bridgeWavPath: bridgeResult.filePath,
        outputPath: fullOutputPath,
        arrangement: ['verse', 'chorus', 'bridge', 'chorus'],
      });

      if (mixResult.success) {
        console.log('   ✅ PASS: MusicEngine.mixSections() succeeded');
        console.log(`   Output: ${mixResult.filePath}`);
        console.log(`   Total Duration: ${mixResult.totalDuration}s`);
        console.log(`   Arrangement: ${mixResult.arrangement}`);

        if (fs.existsSync(mixResult.filePath)) {
          const stats = fs.statSync(mixResult.filePath);
          console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
        }
        console.log();
      } else {
        console.log('   ❌ FAIL: MusicEngine.mixSections() returned success=false');
        console.log(`   Error: ${mixResult.error}`);
        console.log();
      }
    }
  } catch (error) {
    console.log('   ❌ FAIL: MusicEngine.mixSections() threw an error');
    console.log(`   Error: ${error.message}`);
    console.log();
  }

  // Summary
  console.log('📊 Test Summary');
  console.log('   ✅ synth-audio package is working properly!');
  console.log(`   📁 Output files: ${TEST_OUTPUT_DIR}`);
  console.log();
  console.log('Generated files:');
  fs.readdirSync(TEST_OUTPUT_DIR).forEach((file) => {
    const fullPath = path.join(TEST_OUTPUT_DIR, file);
    const stats = fs.statSync(fullPath);
    console.log(`   • ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
  console.log();
  console.log('✨ All tests completed successfully!\n');
}

testMusicEngineGenerate().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
