# Skillstore

Reusable agent skills by Mitrev Studio. Each skill lives under `skills/` with its instructions, scripts, and supporting references.

## Catalog

| Skill | Purpose |
| --- | --- |
| [tutorial-video-studio](skills/tutorial-video-studio/SKILL.md) | Record a web app with Playwright, narrate it with ElevenLabs or free Edge TTS, and assemble captioned tutorial MP4s with FFmpeg. |

## Install

Clone this repository:

```sh
git clone https://github.com/mitrevstudio/skillstore.git
```

Copy the entire `skills/tutorial-video-studio` folder to your agent's skill directory:

- Claude Code: `~/.claude/skills/tutorial-video-studio`
- Codex: `~/.agents/skills/tutorial-video-studio`
- OpenCode: `~/.config/opencode/skills/tutorial-video-studio` (also discovers `~/.claude/skills` and `~/.agents/skills`)

The skill format is compatible with all three agents. Full video production has been exercised through Claude Code on Windows; Codex and OpenCode end-to-end runs have not yet been verified. Each agent needs permission to execute local commands, launch the browser, and reach the narration service (ElevenLabs or Microsoft Edge TTS).

Start a new agent session and ask it to use `tutorial-video-studio` on your project. The scripts and references are required alongside SKILL.md.

## Tutorial Video Studio setup

Requires Node.js 18+, system `ffmpeg` and `ffprobe` on PATH, and an FFmpeg build with the `subtitles` and `drawtext` filters.

From the installed skill's `scripts` directory:

```sh
npm install
npx playwright install chromium ffmpeg
```

Choose a narration provider with `studio.ttsProvider` in your clips config:

- `"elevenlabs"` (default): set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in your environment. Never commit their values. Narration text is sent to ElevenLabs and uses your account's credits.
- `"edge"` (free, no API key): install Python 3 and `pip install edge-tts` (7.3.1 or newer), then set `edgeVoice`, for example `bg-BG-KalinaNeural` or `bg-BG-BorislavNeural`. Narration text is sent to Microsoft's Edge Read Aloud service, which is an unofficial endpoint without an SLA.

Browser capture and assembly run locally. Details and alternatives: [tts-providers.md](skills/tutorial-video-studio/references/tts-providers.md).

Configs written for v1 work unchanged. The previous version is available as the `tutorial-video-studio-v1.0.0` tag and release.

Copy `references/clips-template.mjs` to your project's `video/clips.mjs`. Adapt its URL, selectors, narration, branding, and authentication. Selectors are examples, not automatic app discovery. The login example reads `DEMO_EMAIL` and `DEMO_PASSWORD`; authenticated clips read `APP_SESSION_COOKIE_NAME` and `APP_SESSION_COOKIE`. Use a local demo account.

```sh
node <installed-skill>/scripts/produce.mjs ./video/clips.mjs 01-login --require-base <installed-skill>/scripts
```

Review the first clip, then replace `01-login` with `all` to produce all clips and `00-full.mp4`.

The original implementation was used on Windows. For macOS/Linux, set `studio.channel` to `""` for bundled Chromium and supply absolute paths to installed fonts in `captionFont` and `captionFontBold`. Defaults use Windows Arial; cross-platform end-to-end recording has not been verified.

## Adding another skill

Create `skills/<lowercase-hyphenated-name>/SKILL.md` with `name` and `description` frontmatter. Keep scripts and references within that folder and add a catalog row above. Include reusable source and documentation only.

## Publishing changes

Review staged files, including examples. Keep project configs, credentials, session cookies, browser state, recordings, caches, and customer data outside this repository. The ignore rules help avoid accidental additions but cannot detect secrets embedded in source.
