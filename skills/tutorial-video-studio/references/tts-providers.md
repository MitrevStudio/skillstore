# Narration providers

Set `studio.ttsProvider` in the clips config. Configs written for v1 have no
`ttsProvider` and keep using ElevenLabs exactly as before (same cache keys).

| | `"elevenlabs"` (default) | `"edge"` |
|---|---|---|
| Cost | Paid credits | Free |
| Credentials | `ELEVENLABS_API_KEY` + `voiceId` | None |
| Install | Nothing extra | Python 3 + `pip install edge-tts` |
| Bulgarian voices | Any multilingual voice | `bg-BG-KalinaNeural` (female), `bg-BG-BorislavNeural` (male) |
| Audio | 44.1 kHz MP3, most natural/expressive | 24 kHz mono MP3, clear neural voice, flatter delivery |
| Runs | Online (ElevenLabs API) | Online (Microsoft Edge Read Aloud service) |
| Stability | Official API | Unofficial endpoint, no SLA — see below |

## Edge provider

```js
export const studio = {
  ttsProvider: "edge",
  edgeVoice: "bg-BG-KalinaNeural", // or "bg-BG-BorislavNeural"
  edgeRate: "+0%",                 // native speaking rate, e.g. "+10%", "-5%"
  edgePitch: "+0Hz",
  edgeVolume: "+0%",
  edgeCommand: "",                 // "" = auto: `edge-tts`, then `python -m edge_tts`
  speed: 1.0,                      // ffmpeg tempo on top of edgeRate; 1.18 was tuned for ElevenLabs
  // ...
}
```

- Install once: `pip install edge-tts` (or `pipx install edge-tts`). If the
  command is not on PATH, set `edgeCommand` to the full path of the executable
  (e.g. a venv's `Scripts/edge-tts.exe` or `bin/edge-tts`).
- Other languages: `edge-tts --list-voices`.
- Audio is cached per voice + rate + pitch + volume + text; bump `settingsVer`
  to force regeneration.
- `respell` works the same way (narration only). `modelId`, `voiceId` and
  `voiceSettings` are ignored.
- The engine retries a failed synthesis up to 4 times, because the service
  occasionally closes the connection without sending audio.

### Caveats (checked November 2026)

- `edge-tts` talks to the endpoint behind Edge's "Read Aloud" feature. It is
  **not a documented public API**: there is no SLA and no stated quota, and
  Microsoft changes its access token scheme from time to time. In October 2026
  every version up to 7.2.8 started failing with HTTP 403; 7.3.0/7.3.1 fixed it
  three days later. **If narration suddenly fails with 403, run
  `pip install -U edge-tts` first.** Use 7.3.1 or newer.
- Narration text is sent to Microsoft.
- For client work that needs a contractual, supported service, use the paid
  ElevenLabs provider, or see Azure Speech below.

## Alternatives considered (online, Bulgarian voices, no local models)

| Option | Bulgarian | Free allowance | Why it was not chosen as the free default |
|---|---|---|---|
| **edge-tts** (chosen) | Kalina, Borislav (neural) | No key, no stated quota | — |
| Azure AI Speech (F0 tier) | The same Kalina / Borislav voices, official API | 0.5 M neural characters / month | Needs an Azure account, a Speech resource and a key. The right upgrade if the Edge endpoint becomes unreliable — same voices, supported API. |
| Google Cloud Text-to-Speech | bg-BG Standard and Chirp 3 HD voices | About 1 M characters / month on premium voices (check current pricing) | Needs a Google Cloud project with billing enabled and service credentials. |
| gTTS (Google Translate voice) | Yes (`bg`) | No key | Unofficial as well, and a single noticeably robotic voice with no rate/pitch control. |
| ElevenLabs free plan | Yes | Small monthly credit | Free plan carries no commercial licence (check current terms); already supported as the paid provider. |
| npm `msedge-tts` | Same Edge voices | No key | Pure Node port of the same endpoint; it synthesised Bulgarian fine when tested, but the Python project is the upstream that reacts first when Microsoft changes the token scheme. |

Azure Speech and Google Cloud are not implemented as providers. To add one, add
an entry to `PROVIDERS` in `scripts/studio.mjs` with `key(text)` and
`fetch(text, mp3)`.
