# Handoff prompt — give this to another agent

Copy the block below to a Claude Code agent working in the TARGET project. It
assumes this skill exists at `~/.claude/skills/tutorial-video-studio/`. If it
does not, first copy that folder into the target machine's `~/.claude/skills/`.

---

> Make narrated tutorial videos of this app's admin/UI using the
> **tutorial-video-studio** skill. Follow its SKILL.md. Specifically:
>
> 1. Stand up a LOCAL instance of the app with realistic DEMO data (never record
>    real users' personal data). Seed a few representative records.
> 2. Install Playwright browsers once (`npx playwright install msedge` or
>    `chromium`) and ensure `ffmpeg`/`ffprobe` are on PATH.
> 3. Put an ElevenLabs key in the environment as `ELEVENLABS_API_KEY`. Pick a
>    voice id for the target language (ask me if unsure).
> 4. Write `video/clips.mjs` from the skill's `references/clips-template.mjs`:
>    set `studio` config (baseUrl, outDir, voiceId, wordmark), wire `authCookies`
>    to how THIS app authenticates, and write one clip per feature area — short
>    one-sentence beats, each `do()` performing the on-screen action.
> 5. Produce one clip first, render its spectrogram (see
>    `references/audio-pipeline.md`), confirm the audio is clean, show it to me.
> 6. After I approve the style, produce the rest and the `full` walkthrough.
>
> Constraints: do not click Save/Delete/publish against production data; record
> against the local demo instead. Keep each narration line to one short sentence.

---

## What to tune after first review

- **Too slow / too fast:** `studio.speed` (0.9–1.25) and the card durations.
- **Audio glitches / second voice:** switch `modelId` to
  `eleven_multilingual_v2`, bump `settingsVer`, re-run.
- **Mispronounced UI terms:** add `[from, to]` pairs to `respell`.
- **Captions unreadable on light pages:** the `.ass` style already uses an
  opaque box; raise `Fontsize`/box alpha in `studio.mjs > writeAss` if needed.
