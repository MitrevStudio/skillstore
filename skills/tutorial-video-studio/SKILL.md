---
name: tutorial-video-studio
description: >-
  Produce narrated, captioned 1080p tutorial / screencast / demo videos of any
  web app by scripting its UI. Records the browser with Playwright (animated
  cursor + click ripples), voices it with ElevenLabs TTS or free Edge TTS
  (edge-tts, no API key), burns in captions,
  adds intro/outro brand cards, and assembles clean MP4s with ffmpeg — plus a
  combined walkthrough. Use whenever the user wants tutorial videos, screencasts,
  a "video portal", onboarding/how-to videos, narrated product demos, or to
  reproduce this same video setup for another project. Bulgarian or any language.
---

# Tutorial Video Studio

Turns a running web app into a set of polished, narrated tutorial MP4s. A generic
engine (`scripts/studio.mjs` + `scripts/produce.mjs`) does the recording,
narration and assembly; each project supplies one **clips config** describing
what to click and what to say.

## What it produces

- One MP4 per feature area (`<id>.mp4`) + matching `.srt` subtitles.
- A combined `00-full.mp4` walkthrough.
- 1920×1080, H.264 + AAC stereo 48 kHz, with an animated cursor, click ripples,
  burned captions, and intro/outro brand cards.

## Pipeline (how it works)

1. **Record** — Playwright drives a real browser flow (headless msedge/chromium)
   at 1920×1080 and records a silent `.webm`. A fake cursor is injected so moves,
   clicks and typing are visible. For authed areas a session cookie is injected
   so recording starts logged in.
2. **Narrate** — each "beat" has a sentence; the configured TTS provider
   (ElevenLabs, or free Edge TTS) synthesises it before recording (cached;
   tempo-adjusted for pace). Narration plays **while** its action happens, so the
   whole action is shown as it's described.
3. **Caption** — beats become an `.ass` subtitle (opaque box, readable on light
   and dark pages) burned into the video, and an `.srt` sidecar.
4. **Assemble** — screen recording + narration mix + captions → body MP4; intro
   and outro cards are generated; all three are concatenated. A final pass
   concatenates every clip into the walkthrough.

## Prerequisites

- **ffmpeg + ffprobe** on PATH (system ffmpeg, used for assembly).
- **Node 18+** and **Playwright** importable from a folder you point
  `--require-base` at (`npm i playwright` there).
- **Playwright's browser + its own recording ffmpeg:**
  `npx playwright install msedge` (or `chromium`) **and** `npx playwright install
  ffmpeg`. Video recording fails without Playwright's bundled ffmpeg
  ("Executable doesn't exist at .../ffmpeg-xxxx"); installing `chromium` pulls it
  in, `msedge` alone does not — so run the `ffmpeg` install explicitly.
- **A narration provider** (`studio.ttsProvider`, see `references/tts-providers.md`):
  - `"elevenlabs"` (default, paid, most natural): **`ELEVENLABS_API_KEY`** in the
    environment, and a **voice id** for the target language (Milena
    `M1ydWt7KnBCiuv4CnEDC` is a good Bulgarian voice).
  - `"edge"` (free, online, no key): Python 3 and `pip install edge-tts`
    (7.3.1+). Bulgarian voices: `bg-BG-KalinaNeural`, `bg-BG-BorislavNeural`.

  Ask the user which one they want if they have not said; do not spend
  ElevenLabs credits when they asked for the free option.

## Steps

1. **Run the app locally with demo data.** Strongly prefer a local instance
   seeded with realistic but fake content. **Never record real users' personal
   data** (e.g. a contact-inquiries / CRM screen on production) — it ends up in a
   shareable file. If the app needs auth, confirm how it authenticates.
2. **Copy `references/clips-template.mjs`** into the project (e.g.
   `video/clips.mjs`) and fill it in:
   - `studio`: `baseUrl`, `outDir`, `scratchDir`, `ttsProvider` + its voice
     (`voiceId` for ElevenLabs, `edgeVoice` for Edge), `wordmark`,
     `cardSubtitle`, and `speed`/`modelId` if tuning.
   - `authCookies()`: return the session cookie(s) for `authed:true` clips —
     supply a local demo session via environment variables. Omit
     for public-only apps.
   - `respell`: phonetic swaps for foreign UI words (narration only).
   - `clips`: one entry per feature; short one-sentence beats, each `do(page, S)`
     performing the on-screen action (`S.goto/click/typeInto/moveTo`, or any
     Playwright call on `page`).
3. **Produce one clip and verify the audio.** Run:
   ```bash
   node <skill>/scripts/produce.mjs ./video/clips.mjs <clip-id> --require-base ./video
   ```
   Then render its spectrogram and check it (see `references/audio-pipeline.md`).
   Show the clip to the user for style/pace approval BEFORE batching.
4. **Produce everything** once approved:
   ```bash
   node <skill>/scripts/produce.mjs ./video/clips.mjs all --require-base ./video
   ```
   `all` makes every clip then the `full` walkthrough; a single `<id>` or `full`
   also work. Long runs: launch in the background and watch the `DONE` lines.

## Critical rules

- **Audio format is load-bearing.** Read `references/audio-pipeline.md`. Keep the
  stereo-48 kHz-everywhere + edge-fades + concat-**filter** design. Breaking it
  brings back a periodic clicking/background-noise artifact. Always spectrogram a
  sample before a full batch.
- **One short sentence per beat.** Long lines make `eleven_v3` glitch. If the
  user reports audio weirdness, switch `modelId` to `eleven_multilingual_v2` and
  bump `settingsVer`.
- **Edge TTS is an unofficial endpoint.** If it fails with 403, run
  `pip install -U edge-tts` before anything else; if it stays down, fall back to
  ElevenLabs (see `references/tts-providers.md`).
- **Narration vs captions:** captions always show the original text; `respell`
  only changes how it is spoken.
- **Never write to production.** Demo editing flows (Save/publish/delete) against
  a local demo DB; on real data, show the form and stop before saving.
- **Timeouts:** the engine sets a 6 s default Playwright timeout so a missing
  selector fails fast instead of hanging 30 s and bloating the video.

## Tuning after review

| Problem | Fix |
|---|---|
| Too slow / fast | `studio.speed` (0.9–1.25; with Edge start at 1.0 and prefer `edgeRate`); `studio.beatGap` (pause between beats); card durations in `produce.mjs` |
| Audio glitch / 2nd voice (ElevenLabs) | `modelId: "eleven_multilingual_v2"`, bump `settingsVer`, re-run |
| Edge narration fails (403 / no audio) | `pip install -U edge-tts`; set `edgeCommand` if it is not on PATH |
| Mispronounced term | add a `respell` pair |
| Action cut off | the beat's `do()` needs a longer settle, or split into two beats |
| First frame blank (heavy hero image) | in the opening beat, after `goto` wait for the hero to paint: `await p.waitForTimeout(1200)` or `await p.locator("img").first().waitFor()` |
| Next.js dev "Issue" badge in frame | record against a production build (`next build && next start`) or hide the dev overlay |
| Dates/times in US format (10/15/2026, 09:30 AM) | `studio.locale: "bg-BG"` (+ `timezoneId`) — sets the context locale AND `--lang` (native date/time inputs follow the browser language) |

See `references/handoff.md` for a ready prompt to hand another agent,
`references/clips-template.mjs` for the config to copy, and
`references/tts-providers.md` for the narration providers.
