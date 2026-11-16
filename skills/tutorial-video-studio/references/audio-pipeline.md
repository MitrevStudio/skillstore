# Audio pipeline — why it is built this way (do not "simplify")

The single hardest bug in this tool was a **periodic clicking / background-noise
artifact** that ran through the whole soundtrack — audible as "skipping" or an
unpleasant hiss even during silence between words. It was NOT in the ElevenLabs
audio (the raw TTS is clean). It was introduced during assembly.

## Root cause

Two things, both fixed in `studio.mjs`:

1. **Channel/format mismatch across concatenated segments.** The narrated body
   track was **mono**, the intro/outro cards were **stereo**. Joining them with
   ffmpeg's **concat demuxer** (`-f concat ... -c copy`/re-encode) across a
   channel-count change produces a regular comb of full-spectrum clicks.
2. **Abrupt segment starts in the mix.** Each narration MP3 placed with
   `adelay` started/ended on a non-zero sample → a click at every beat edge.

## The rules (keep all of them)

- **One audio format everywhere: stereo, 48000 Hz, AAC.** Body, cards, and the
  final concat all output `-ar 48000 -ac 2`. Never let a mono segment meet a
  stereo one.
- **Edge-fade every narration segment** before delaying it:
  `aresample=48000, aformat=...:channel_layouts=mono, afade in 0.03s,
  afade out 0.05s, adelay=<ms>`. The fades zero the edges → no click.
- After `amix`, normalise the format: `aresample=48000,
  aformat=sample_fmts=fltp:channel_layouts=stereo`.
- **Concatenate clips with the concat FILTER, never the demuxer:**
  `[0:v][0:a][1:v][1:a]...concat=n=N:v=1:a=1`. The filter resamples/unifies
  inside the graph, so a format mismatch can't create clicks.

## How to verify (always do this on a sample before a full batch)

Render a spectrogram and LOOK at it — the ear is replaceable by eyes here:

```bash
ffmpeg -y -i clip.mp4 -vn -c:a pcm_s16le a.wav
ffmpeg -y -i a.wav -lavfi "showspectrumpic=s=1400x420:legend=1" spec.png
```

- **Clean:** speech bands with harmonics; silences are solid black; energy rolls
  off ~15–16 kHz (ElevenLabs) or ~12 kHz (Edge TTS, whose source is 24 kHz).
- **Broken:** regular vertical streaks to 20 kHz running through the whole
  clip, present even in the silent gaps. If you see that comb, the format
  unification above has been broken somewhere.

## Voice model notes

- Edge TTS (`ttsProvider: "edge"`) returns 24 kHz mono MP3. The assembly
  graph resamples it to stereo 48 kHz like any other source, so the rules above
  are unchanged.
- All narration is synthesised before the browser starts recording, so TTS
  latency never shows up as dead air between beats.

- `eleven_v3` is expressive but can hallucinate artifacts / a faint second
  voice, especially on long sentences. Mitigate: `stability: 0.5`–`1.0`, keep
  each narration line to ONE short sentence, bump `settingsVer` and re-generate.
- `eleven_multilingual_v2` is markedly more stable (no artifacts) and is the
  safe choice if the client reports any audio weirdness.
- Speed is applied as an ffmpeg `atempo` post-process (pitch preserved), not via
  the API, so it is reliable across models. Cached raw MP3s are reused when only
  the speed changes — no extra API spend.
