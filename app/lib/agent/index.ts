import {
  LlmAgent,
  SequentialAgent,
  ParallelAgent,
  FunctionTool,
  InMemoryRunner,
  isFinalResponse,
} from '@google/adk';
import type { Context } from '@google/adk';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import MusicEngine from 'synth-audio';

// ─────────────────────────────────────────────────────────────────────────────
// PATHS
// ─────────────────────────────────────────────────────────────────────────────
// Detect the workspace root by locating the Next.js package (with next in package.json)
// Use both process.cwd() and the on-disk location of this module as seeds,
// since bundlers / runtimes sometimes change one but not the other.

const CWD = process.cwd();
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

type MusicEngineModule = {
  generate: (params: Record<string, unknown>) => Promise<{
    success: boolean;
    filePath?: string;
    duration?: number;
    message?: string;
    error?: string;
  }>;
  mixSections: (args: {
    verseWavPath: string;
    chorusWavPath: string;
    bridgeWavPath: string;
    outputPath: string;
    arrangement?: string[];
  }) => {
    success: boolean;
    filePath?: string;
    totalDuration?: number;
    arrangement?: string;
    message: string;
    error?: string;
  };
};

const musicEngine = MusicEngine as MusicEngineModule;

function isNextWorkspaceRoot(dir: string): boolean {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;

  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const hasNext = Boolean(pkgJson.dependencies?.next || pkgJson.devDependencies?.next);
    const hasAppDir = fs.existsSync(path.join(dir, 'app'));
    return hasNext && hasAppDir;
  } catch {
    return false;
  }
}

function findWorkspaceRoot(): string {
  const visited = new Set<string>();
  const seeds = [
    process.env.HARMONY_WORKSPACE_ROOT,
    CWD,
    MODULE_DIR,
  ].filter((p): p is string => Boolean(p));

  const searchFromSeed = (start: string): string | undefined => {
    let current = path.resolve(start);

    while (true) {
      visited.add(current);

      if (isNextWorkspaceRoot(current)) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }

    return undefined;
  };

  for (const seed of seeds) {
    const root = searchFromSeed(seed);
    if (root) {
      return root;
    }
  }

  throw new Error(
    `Unable to locate the Next.js workspace root. Checked:\n${Array.from(visited)
      .map((p) => ` - ${p}`)
      .join('\n')}`
  );
}

const WORKSPACE_ROOT = findWorkspaceRoot();

// Output dir: always inside harmonyai/app/lib/agent/output/ so the
// Next.js /output/[filename] route can serve the WAV files.
const workspaceAgentDir = path.resolve(WORKSPACE_ROOT, 'app/lib/agent');
const OUTPUT_DIR = fs.existsSync(workspaceAgentDir)
  ? path.resolve(workspaceAgentDir, 'output')
  : path.resolve(WORKSPACE_ROOT, 'harmonyai/app/lib/agent/output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`[HarmonyAI] CWD: ${CWD}`);
console.log(`[HarmonyAI] WORKSPACE_ROOT: ${WORKSPACE_ROOT}`);
console.log(`[HarmonyAI] OUTPUT_DIR: ${OUTPUT_DIR}`);

// ─────────────────────────────────────────────────────────────────────────────
// SHARED ZOD SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize customChords — flatten nested arrays if the LLM returns chord voicings
 * as [["Bb3","D4","F4"], ["G3","B3","D4"]] instead of ["Bb3","D4","F4","G3","B3","D4"]
 */
function normalizeCustomChords(chords: unknown): string[] | undefined {
  if (!chords) return undefined;
  if (!Array.isArray(chords)) return undefined;
  if (chords.length === 0) return undefined;

  // Check if it's a nested array (array of arrays)
  if (Array.isArray(chords[0])) {
    // Flatten: [["Bb3","D4","F4"], [...]] → ["Bb3","D4","F4",...]
    return (chords as unknown[][]).flat().filter((n) => typeof n === 'string');
  }

  // Already flat
  return chords.filter((n) => typeof n === 'string');
}

/**
 * The MusicEngine params schema — mirrors MusicEngine.validateAndNormalizeInput
 */
const MusicEngineParamsSchema = z.object({
  tempo: z.number().min(60).max(180).describe('BPM'),
  key: z.enum(['C', 'G', 'D', 'A', 'E', 'F', 'Bb']).describe('Musical key'),
  duration: z.number().min(5).max(60).describe('Duration in seconds'),
  customChords: z
    .array(z.string())
    .optional()
    .describe('Chord notes e.g. ["C4","E4","G4"]'),
  customScale: z
    .array(z.string())
    .optional()
    .describe('Scale notes e.g. ["C4","D4","E4","F4","G4","A4","B4"]'),
  instruments: z
    .array(
      z.object({
        name: z.string(),
        waveform: z.enum(['sine', 'triangle', 'square', 'sawtooth']),
        volume: z.number().min(0).max(1),
        envelope: z.object({
          attack: z.number(),
          decay: z.number(),
          sustain: z.number(),
          release: z.number(),
        }),
      })
    )
    .optional()
    .describe('Instrument definitions with waveform and ADSR envelope'),
  effects: z
    .object({
      reverb: z
        .object({ enabled: z.boolean(), decay: z.number() })
        .optional(),
      delay: z
        .object({
          enabled: z.boolean(),
          time: z.number(),
          feedback: z.number(),
        })
        .optional(),
    })
    .optional()
    .describe('Audio effects'),
  dynamics: z
    .object({
      swing: z.number().min(0).max(1),
      humanize: z.boolean(),
      volumeVariation: z.number().min(0).max(1),
    })
    .optional()
    .describe('Dynamics / groove settings'),
  outputPath: z.string().describe('File path for the output .wav file'),
});

// ─────────────────────────────────────────────────────────────────────────────
// MUSIC ENGINE AI PROMPT (used by tuneGeneratorTool)
// ─────────────────────────────────────────────────────────────────────────────
const MUSIC_ENGINE_PROMPT = `You are an advanced music generation AI.
You have full creative control over music generation.
RESPOND WITH ONLY VALID JSON - no explanations, no markdown, no code fences.

REQUIRED FIELDS:
- tempo (number): 60-180
- key: C|G|D|A|E|F|Bb
- duration (number): 15-30
- outputPath (string): file path for .wav output
- customChords (array): e.g. ["C4","E4","G4","Bb4"]
- customScale (array): e.g. ["C4","D4","E4","F4","G4","A4","B4","C5"]
- instruments (array): each must have name, waveform (sine|triangle|square|sawtooth), volume (0-1), envelope { attack, decay, sustain, release }`;

// ─────────────────────────────────────────────────────────────────────────────
// TOOL FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * lyricsGeneratorTool — makes an LLM call to write section-specific lyrics.
 * Reads song_request directly from tool_context.state so it never relies on
 * instruction-level {variable} interpolation.
 */
function makeLyricsGeneratorTool(section: 'verse' | 'chorus' | 'bridge') {
  return new FunctionTool({
    name: `${section}_lyrics_generator_tool`,
    description: `Generates creative, complete ${section} lyrics for the song.
      Call this tool first. It returns a lyrics string for the ${section}.`,
    parameters: z.object({
      sectionContext: z
        .string()
        .describe(
          `Brief description of what this ${section} should convey emotionally or narratively`
        ),
    }),
    execute: async ({ sectionContext }, tool_context?: Context) => {
      // Read song_request directly from shared state — the only reliable source
      const songConcept =
        (tool_context?.state.get<string>('song_request') ?? '').trim() ||
        'A general song';

      const { GoogleGenAI } = await import('@google/genai');
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const prompt = `You are a professional songwriter. Write the ${section} lyrics for a song.

Song concept: ${songConcept}
${section} context: ${sectionContext}

Requirements:
- Write ONLY the ${section} lyrics, no labels or section headers
- ${section === 'chorus' ? 'Make it catchy, memorable, and emotionally resonant — the hook of the song' : ''}
- ${section === 'verse' ? 'Tell the story, set the scene, build towards the chorus' : ''}
- ${section === 'bridge' ? 'Provide contrast, a turning point or emotional shift from the verse and chorus' : ''}
- Keep it 4–8 lines
- Make it cohesive with the song concept

Output ONLY the lyrics text, nothing else.`;

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const lyrics =
        response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      console.log(`\n🎤 [${section.toUpperCase()} LYRICS]\n${lyrics}\n`);
      return { lyrics, section };
    },
  });
}

/**
 * tuneGeneratorTool — makes an LLM call to produce a valid MusicEngine JSON
 * params object that is coherent with the lyrics and song concept.
 * Reads song_request directly from tool_context.state.
 */
function makeTuneGeneratorTool(section: 'verse' | 'chorus' | 'bridge') {
  return new FunctionTool({
    name: `${section}_tune_generator_tool`,
    description: `Generates MusicEngine JSON parameters for the ${section} tune.
      Call this AFTER the lyrics generator tool.
      It returns a JSON object with all required MusicEngine parameters.`,
    parameters: z.object({
      lyrics: z.string().describe(`The ${section} lyrics just generated`),
      section: z
        .enum(['verse', 'chorus', 'bridge'])
        .describe('Which section this tune is for'),
    }),
    execute: async ({ lyrics, section: sec }, tool_context?: Context) => {
      // Read song_request directly from shared state
      const songConcept =
        (tool_context?.state.get<string>('song_request') ?? '').trim() ||
        'A general song';

      const { GoogleGenAI } = await import('@google/genai');
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const outputFileName = `${sec}_${Date.now()}.wav`;
      const outputPath = path.join(OUTPUT_DIR, outputFileName);

      const prompt = `${MUSIC_ENGINE_PROMPT}

Generate MusicEngine parameters for the ${sec.toUpperCase()} section of this song.

Song concept: ${songConcept}
${sec} lyrics:
${lyrics}

Guidelines for the ${sec}:
${sec === 'verse' ? '- More subdued, storytelling mood. Medium energy. Set the scene.' : ''}
${sec === 'chorus' ? '- Peak energy, most memorable melody. Higher BPM feel, bright chords.' : ''}
${sec === 'bridge' ? '- Contrasting section. Different chord progression, shift in mood/key feel.' : ''}

IMPORTANT:
- outputPath must be exactly: "${outputPath}"
- Use only supported keys: C, G, D, A, E, F, Bb
- All instruments must have name, waveform, volume, and envelope
- melody must be type "custom" with explicit notes array
- customChords and customScale are REQUIRED

Respond with ONLY valid JSON, no markdown, no explanation.`;

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      let rawText =
        response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '{}';

      // Strip markdown code fences if present
      rawText = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      let tuneParams: Record<string, unknown>;
      try {
        tuneParams = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Tune generator returned invalid JSON for ${sec}: ${rawText.slice(0, 200)}`
        );
      }

      // Normalize customChords — flatten nested arrays if LLM returned chord voicings
      if (tuneParams.customChords) {
        tuneParams.customChords = normalizeCustomChords(tuneParams.customChords);
      }

      // Always enforce the correct outputPath
      tuneParams.outputPath = outputPath;

      console.log(
        `\n🎼 [${sec.toUpperCase()} TUNE PARAMS]\n`,
        JSON.stringify(tuneParams, null, 2),
        '\n'
      );

      return { tuneParams, outputPath, section: sec };
    },
  });
}

/**
 * musicEngineTool — calls MusicEngine.generate(params) and writes the .wav file.
 * One instance per section (verse / chorus / bridge).
 */
function makeMusicEngineTool(section: 'verse' | 'chorus' | 'bridge') {
  return new FunctionTool({
    name: `${section}_music_engine_tool`,
    description: `Calls the MusicEngine to generate the audio .wav file for the ${section}.
      Call this LAST, after the tune generator tool.
      Pass the tuneParams object returned by the tune generator tool.`,
    parameters: z.object({
      tuneParams: MusicEngineParamsSchema.describe(
        `The complete MusicEngine params object for the ${section}`
      ),
    }),
    execute: async ({ tuneParams }) => {
      console.log(`\n🎵 Running MusicEngine for ${section}...`);

      // Ensure instruments always has at least one valid entry —
      // MusicEngine.validateAndNormalizeInput throws if instruments is missing/empty.
      const params = { ...tuneParams } as Record<string, unknown>;
      if (!Array.isArray(params.instruments) || (params.instruments as unknown[]).length === 0) {
        params.instruments = [
          {
            name: 'synth',
            waveform: 'triangle',
            volume: 0.5,
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.4 },
          },
          {
            name: 'bass',
            waveform: 'sine',
            volume: 0.4,
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.3 },
          },
        ];
      }

      if (typeof musicEngine.generate !== 'function') {
        throw new Error('synth-audio package is missing MusicEngine.generate');
      }

      const result = await musicEngine.generate(params);

      if (!result.success) {
        throw new Error(
          `MusicEngine failed for ${section}: ${result.error ?? result.message}`
        );
      }

      console.log(
        `✅ [${section.toUpperCase()}] WAV written → ${result.filePath} (${result.duration}s)`
      );

      return {
        section,
        wavPath: result.filePath,
        duration: result.duration,
        message: result.message,
      };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TUNE MIXER TOOL  (used by OrchestratorAgent)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * tuneMixerTool — reads the 3 section WAV files, concatenates their PCM data
 * (skipping the 44-byte headers), and writes a new combined WAV file.
 * Arrangement: verse → chorus → verse → chorus → bridge → chorus
 */
const tuneMixerTool = new FunctionTool({
  name: 'tune_mixer_tool',
  description: `Combines the verse, chorus, and bridge .wav files into a single
    full_song.wav. Arranges them in song order: verse → chorus → verse → chorus → bridge → chorus.
    Returns the path to the final mixed WAV file.`,
  parameters: z.object({
    verseWavPath: z.string().describe('Path to the verse .wav file'),
    chorusWavPath: z.string().describe('Path to the chorus .wav file'),
    bridgeWavPath: z.string().describe('Path to the bridge .wav file'),
  }),
  execute: async ({ verseWavPath, chorusWavPath, bridgeWavPath }) => {
    // Delegate all mixing logic to MusicEngine.mixSections
    if (typeof musicEngine.mixSections !== 'function') {
      throw new Error('synth-audio package is missing MusicEngine.mixSections');
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    const outputPath = path.join(OUTPUT_DIR, `full_song_${timestamp}.wav`);

    const result = musicEngine.mixSections({
      verseWavPath,
      chorusWavPath,
      bridgeWavPath,
      outputPath,
    });

    if (!result.success) {
      throw new Error(`MusicEngine.mixSections failed: ${result.error ?? result.message}`);
    }

    return {
      finalWavPath: result.filePath,
      totalDuration: result.totalDuration,
      arrangement: result.arrangement,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CREATOR AGENTS  (Verse / Chorus / Bridge)
// Each LlmAgent runs its 3 tools in sequence as directed by its instruction.
// song_request is read from state directly inside each tool — no {variable}
// interpolation needed in the instruction.
// ─────────────────────────────────────────────────────────────────────────────

function makeSectionCreatorAgent(section: 'verse' | 'chorus' | 'bridge') {
  const sectionDescriptions: Record<typeof section, string> = {
    verse:
      'storytelling sections that set the scene and build toward the chorus',
    chorus: 'the memorable hook and emotional peak of the song',
    bridge: 'a contrasting section that provides a narrative or tonal shift',
  };

  return new LlmAgent({
    name: `${section.charAt(0).toUpperCase() + section.slice(1)}CreatorAgent`,
    model: 'gemini-2.5-flash',
    description: `Generates the ${section} — ${sectionDescriptions[section]}.
      Produces lyrics, tune parameters, and a .wav audio file for the ${section}.`,
    instruction: `You are the ${section} creator for a song. Your job is to produce the ${section} lyrics and audio.

You MUST call your tools in this exact order:

1. Call \`${section}_lyrics_generator_tool\` with:
   - sectionContext: a brief description of what this ${section} should convey emotionally

2. Call \`${section}_tune_generator_tool\` with:
   - lyrics: the lyrics string returned by step 1
   - section: "${section}"

3. Call \`${section}_music_engine_tool\` with:
   - tuneParams: the complete tuneParams object returned by step 2

After all three tools complete successfully, respond with a JSON object:
{
  "section": "${section}",
  "lyrics": "<the full lyrics text from step 1>",
  "wavPath": "<the wavPath string from step 3>",
  "duration": <the duration number from step 3>
}`,
    tools: [
      makeLyricsGeneratorTool(section),
      makeTuneGeneratorTool(section),
      makeMusicEngineTool(section),
    ],
    outputKey: `${section}_output`,
  });
}

const verseCreatorAgent = makeSectionCreatorAgent('verse');
const chorusCreatorAgent = makeSectionCreatorAgent('chorus');
const bridgeCreatorAgent = makeSectionCreatorAgent('bridge');

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR AGENT
// Reads all three section outputs, mixes audio, and assembles the full song.
// ─────────────────────────────────────────────────────────────────────────────

const orchestratorAgent = new LlmAgent({
  name: 'OrchestratorAgent',
  model: 'gemini-2.5-flash',
  description:
    'Final song producer. Combines verse, chorus, and bridge into a complete song with full lyrics and a single mixed .wav file.',
  instruction: `You are the song orchestrator. All three sections have been generated.
Their results are in shared state:
- Verse data:   {verse_output}
- Chorus data:  {chorus_output}
- Bridge data:  {bridge_output}

Your tasks:
1. Parse each section output JSON to extract the "wavPath" field for each section.
2. Call \`tune_mixer_tool\` with:
   - verseWavPath:  wavPath from verse_output
   - chorusWavPath: wavPath from chorus_output
   - bridgeWavPath: wavPath from bridge_output

3. After the mixer completes, assemble and return the complete final song result:

---FULL SONG LYRICS---

[VERSE]
<verse lyrics from verse_output>

[CHORUS]
<chorus lyrics from chorus_output>

[VERSE]
<verse lyrics from verse_output>

[CHORUS]
<chorus lyrics from chorus_output>

[BRIDGE]
<bridge lyrics from bridge_output>

[CHORUS]
<chorus lyrics from chorus_output>

---AUDIO OUTPUT---
🎶 Full song WAV: <finalWavPath from tune_mixer_tool result>
⏱  Total duration: <totalDuration>s
🎵 Arrangement: <arrangement>`,
  tools: [tuneMixerTool],
  outputKey: 'final_song',
});

// ─────────────────────────────────────────────────────────────────────────────
// AGENT COMPOSITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CreationPhase — runs verse, chorus, bridge concurrently.
 * All three agents read song_request from state via tool_context.state.get()
 * and write to distinct state keys (verse_output / chorus_output / bridge_output).
 */
const creationPhase = new ParallelAgent({
  name: 'CreationPhase',
  description:
    'Runs verse, chorus, and bridge creator agents concurrently. Each independently generates lyrics and audio for its section.',
  subAgents: [verseCreatorAgent, chorusCreatorAgent, bridgeCreatorAgent],
});

/**
 * ProductionPipeline — sequential: creation phase → orchestration.
 * Runs after ParentAgent has committed song_request to state.
 */
const productionPipeline = new SequentialAgent({
  name: 'ProductionPipeline',
  description:
    'Full song production pipeline: parallel section creation followed by orchestration into the final mixed song.',
  subAgents: [creationPhase, orchestratorAgent],
});

/**
 * ParentAgent (HarmonyAI) — entry point / step 1.
 *
 * Uses outputKey: 'song_request' so ADK commits the enriched song brief to
 * session state before the next sequential step (ProductionPipeline) runs.
 * This is the ADK-idiomatic pattern: SequentialAgent guarantees the state
 * write from outputKey is visible to every subsequent sub-agent.
 *
 * NO subAgents here — it must not transfer/delegate internally. It just
 * interprets the user request, enriches it, and lets the SequentialAgent
 * hand off to ProductionPipeline.
 */
const parentAgent = new LlmAgent({
  name: 'HarmonyAI',
  model: 'gemini-2.5-flash',
  description:
    'Interprets the user song request and writes a detailed song brief to state.',
  instruction: `You are Harmony AI, a creative music production assistant.
Your ONLY job in this step is to read the user's song request and write a detailed, enriched song brief.

Formulate a detailed song brief that includes:
- Theme / concept of the song
- Desired mood (choose one: happy, sad, energetic, peaceful, dramatic, dreamy)
- Genre or style hints
- Tempo suggestion (60–180 BPM)
- Key suggestion (C, G, D, A, E, F, or Bb)
- Instrument preferences
- Duration guidance (~20 seconds per section)

Example output:
"A melancholic indie song about missing someone in the rain. Sad mood, 80 BPM, key of D, piano and strings, dreamy atmosphere, ~20s per section."

Output ONLY the song brief text. No greetings, no explanation. Just the brief.`,
  outputKey: 'song_request',
  disallowTransferToParent: true,
  disallowTransferToPeers: true,
});

/**
 * Root agent — the top-level SequentialAgent.
 *
 * Step 1: ParentAgent runs → writes state['song_request'] via outputKey.
 *         (ADK commits stateDelta before advancing to the next sub-agent)
 * Step 2: ProductionPipeline runs → reads state['song_request'] from tools
 *         via tool_context.state.get('song_request').
 *
 * This is the correct ADK pattern for guaranteed state propagation between
 * agents (documented as the Sequential Pipeline Pattern).
 */
const rootAgent = new SequentialAgent({
  name: 'HarmonyAIPipeline',
  description:
    'Harmony AI root pipeline. Interprets the user request then runs full song production.',
  subAgents: [parentAgent, productionPipeline],
});

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────────────────────────────────────────

const runner = new InMemoryRunner({
  agent: rootAgent,
  appName: 'harmony_ai',
});

/**
 * generateSong — run the full Harmony AI multi-agent pipeline.
 * @param userMessage  Natural-language song request from the end user.
 * @returns            Final song text (full lyrics + WAV path).
 */
export async function generateSong(userMessage: string): Promise<string> {
  console.log('\n🎵 ═══════════════════════════════════════════════════');
  console.log('      H A R M O N Y   A I  —  Song Generator');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📝 Request: "${userMessage}"\n`);

  let finalResponse = '';

  const eventStream = runner.runEphemeral({
    userId: 'user',
    newMessage: {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  });

  for await (const event of eventStream) {
    if (isFinalResponse(event) && event.content?.parts) {
      const text = event.content.parts
        .map((p: { text?: string }) => p.text ?? '')
        .join('');
      if (text) {
        finalResponse = text;
        console.log('\n🎶 FINAL OUTPUT:\n', text);
      }
    }
  }

  return finalResponse;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/** Root agent — exported for ADK devtools / external consumers */
export { rootAgent as agent };
export default rootAgent;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — self-invocation when run directly via: npx tsx index.ts "your request"
// ─────────────────────────────────────────────────────────────────────────────

// Detect direct execution: argv[1] ends with index.ts or index.js (tsx / node)
const isMain =
  process.argv[1] != null &&
  /index\.(ts|js|cjs|mjs)$/.test(process.argv[1]);

if (isMain) {
  const userRequest =
    process.argv[2] ??
    'Create a hopeful indie-pop song about starting a new journey. Energetic mood, 110 BPM, key of G, with guitar and synth.';

  generateSong(userRequest).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}