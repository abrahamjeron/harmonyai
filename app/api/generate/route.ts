import { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper: send an SSE line
function sseEvent(controller: ReadableStreamDefaultController, data: object) {
  const line = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(line));
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  if (!prompt || typeof prompt !== 'string') {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── 1. Signal thinking ──────────────────────────────────────────────
        sseEvent(controller, { type: 'thinking' });

        // ── 2. Dynamically import the agent (avoids Next.js compile issues
        //       with ADK / Node-only deps)  ──────────────────────────────────
        const agentModule = await import('../../lib/agent/index');
        const { generateSong, isFinalResponseEvent, getEventStream } =
          agentModule as {
            generateSong: (msg: string) => Promise<string>;
            isFinalResponseEvent?: unknown;
            getEventStream?: unknown;
          };

        // ── 3. Step badges emitted in expected pipeline order ───────────────
        const agentOrder: string[] = [
          'HarmonyAI',
          'VerseCreator',
          'ChorusCreator',
          'BridgeCreator',
          'Orchestrator',
        ];

        // Emit first badge immediately so the UI shows activity
        sseEvent(controller, {
          type: 'agent_step',
          agent: 'HarmonyAI',
          status: 'active',
        });

        // ── 4. Run the pipeline ─────────────────────────────────────────────
        // generateSong is synchronous from the stream's perspective — it
        // resolves when the final response is ready.  We stagger agent-step
        // badges with a rough heuristic while it runs.
        let badgeIdx = 1;
        const badgeTimer = setInterval(() => {
          if (badgeIdx < agentOrder.length) {
            // Mark previous as done, new as active
            sseEvent(controller, {
              type: 'agent_step',
              agent: agentOrder[badgeIdx - 1],
              status: 'done',
            });
            sseEvent(controller, {
              type: 'agent_step',
              agent: agentOrder[badgeIdx],
              status: 'active',
            });
            badgeIdx++;
          } else {
            clearInterval(badgeTimer);
          }
        }, 12_000); // ~12 s per agent phase (tune to your model latency)

        const finalText = await generateSong(prompt);
        clearInterval(badgeTimer);

        // Mark the last active badge as done
        for (let i = badgeIdx - 1; i < agentOrder.length; i++) {
          sseEvent(controller, {
            type: 'agent_step',
            agent: agentOrder[i],
            status: 'done',
          });
        }

        // ── 5. Stream the final text token-by-token (word chunks) ───────────
        const words = finalText.split(/(\s+)/);
        for (const chunk of words) {
          sseEvent(controller, { type: 'text_delta', text: chunk });
          // tiny delay for typewriter effect
          await new Promise((r) => setTimeout(r, 18));
        }

        // ── 6. Discover generated WAV files and emit audio_ready events ─────
        // Agent writes files to harmonyai/app/lib/agent/output/
        const outputDir = path.resolve(
          process.cwd(),
          'app/lib/agent/output'
        );

        if (fs.existsSync(outputDir)) {
          const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.wav'));

          // Sort by mtime so we get the freshest batch
          const stamped = files
            .map((f) => ({
              name: f,
              mtime: fs.statSync(path.join(outputDir, f)).mtimeMs,
            }))
            .sort((a, b) => b.mtime - a.mtime);

          // Keep only files written in the last 10 minutes (this request)
          const cutoff = Date.now() - 10 * 60 * 1000;
          const fresh = stamped.filter((f) => f.mtime > cutoff);

          const sectionMap: Record<string, 'verse' | 'chorus' | 'bridge' | 'full'> = {};
          for (const { name } of fresh) {
            if (name.startsWith('verse_')) sectionMap['verse'] = 'verse';
            if (name.startsWith('chorus_')) sectionMap['chorus'] = 'chorus';
            if (name.startsWith('bridge_')) sectionMap['bridge'] = 'bridge';
            if (name.startsWith('full_song_')) sectionMap['full'] = 'full';
          }

          for (const { name } of fresh) {
            let section: 'verse' | 'chorus' | 'bridge' | 'full' | null = null;
            if (name.startsWith('verse_')) section = 'verse';
            else if (name.startsWith('chorus_')) section = 'chorus';
            else if (name.startsWith('bridge_')) section = 'bridge';
            else if (name.startsWith('full_song_')) section = 'full';

            if (section) {
              // Serve via the /output/* static route
              sseEvent(controller, {
                type: 'audio_ready',
                section,
                url: `/output/${name}`,
              });
            }
          }
        }

        // ── 7. Done ─────────────────────────────────────────────────────────
        sseEvent(controller, { type: 'done' });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        sseEvent(controller, { type: 'error', message });
        sseEvent(controller, { type: 'done' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
