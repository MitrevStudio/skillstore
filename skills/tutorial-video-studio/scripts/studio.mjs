// tutorial-video-studio — generic engine
// ---------------------------------------------------------------------------
// Records a scripted browser flow with Playwright (animated cursor + click
// ripples), narrates it with ElevenLabs TTS, burns Bulgarian/any-language
// captions, and assembles a clean 1080p MP4 with intro/outro cards.
//
// This file is PROJECT-AGNOSTIC. All project specifics (target URL, auth,
// voice, the clips themselves) come from a config object passed to configure()
// and the clips file loaded by produce.mjs.
//
// AUDIO IS THE FRAGILE PART — read references/audio-pipeline.md. Everything is
// forced to ONE format (stereo 48 kHz) with edge-fades on every narration
// segment and concatenation via the concat FILTER, because mixing mono audio
// with stereo cards through the concat *demuxer* produces a periodic clicking
// / "background noise" artifact. Do not "simplify" that away.
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"

// Playwright is resolved from wherever the runner installed it (see produce.mjs
// --require-base, defaults to this scripts/ dir).
let _require = createRequire(import.meta.url)
export function setRequireBase(dir) { _require = createRequire(path.join(dir, "noop.js")) }
function pw() { return _require("playwright") }

// ── configuration ───────────────────────────────────────────────────────────
let CFG = {
  baseUrl: "http://localhost:3000",
  outDir: "./videos",
  scratchDir: "./.studio",
  channel: "msedge",          // Playwright browser channel; "" uses bundled chromium
  voiceId: "",                // ElevenLabs voice id (required for narration)
  modelId: "eleven_v3",       // or "eleven_multilingual_v2" (more stable, less expressive)
  settingsVer: "v1",          // bump to force-regenerate cached audio when voice settings change
  voiceSettings: { stability: 0.5, similarity_boost: 0.8, use_speaker_boost: true },
  speed: 1.18,                // post-process tempo (keeps pitch); 1.0 = original
  apiKeyEnv: "ELEVENLABS_API_KEY",
  wordmark: "",               // intro/outro big text, e.g. "A C M E"
  cardSubtitle: "",           // outro subtitle, e.g. "Admin panel"
  captionFont: "arial.ttf",   // under C:/Windows/Fonts (or absolute)
  captionFontBold: "arialbd.ttf",
  viewport: { width: 1920, height: 1080 },
  locale: "",                 // browser locale, e.g. "bg-BG" (date/time inputs, Intl); "" = Playwright default (en-US)
  timezoneId: "",             // e.g. "Europe/Sofia"; "" = the machine's zone
}
export function configure(cfg) {
  CFG = { ...CFG, ...cfg }
  fs.mkdirSync(CFG.outDir, { recursive: true })
  fs.mkdirSync(path.join(CFG.scratchDir, "tts-cache"), { recursive: true })
  return CFG
}
export function config() { return CFG }

function apiKey() {
  const k = process.env[CFG.apiKeyEnv]
  if (!k) throw new Error(`Missing ${CFG.apiKeyEnv} in environment`)
  return k.trim()
}

// ── ElevenLabs TTS (cached by text+settings, tempo-adjusted) ─────────────────
export async function synth(text) {
  const cacheDir = path.join(CFG.scratchDir, "tts-cache")
  const hash = crypto.createHash("md5")
    .update(CFG.settingsVer + "|" + CFG.modelId + "|" + CFG.voiceId + "|" + text)
    .digest("hex").slice(0, 16)
  const mp3 = path.join(cacheDir, `${hash}.mp3`)
  if (!fs.existsSync(mp3)) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${CFG.voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: CFG.modelId, voice_settings: CFG.voiceSettings }),
    })
    if (!res.ok) throw new Error("TTS failed " + res.status + " " + (await res.text()).slice(0, 200))
    fs.writeFileSync(mp3, Buffer.from(await res.arrayBuffer()))
  }
  let out = mp3
  if (CFG.speed && CFG.speed !== 1) {
    const fast = mp3.replace(/\.mp3$/, `_${String(CFG.speed).replace(".", "")}.mp3`)
    if (!fs.existsSync(fast)) {
      execFileSync("ffmpeg", ["-y", "-i", mp3, "-filter:a", `atempo=${CFG.speed}`, "-c:a", "libmp3lame", "-q:a", "3", fast], { stdio: "ignore" })
    }
    out = fast
  }
  const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", out]).toString().trim())
  return { mp3: out, dur }
}

// ── animated cursor injected into every page / navigation ────────────────────
const CURSOR_INIT = `
(() => {
  if (window.__cursorReady) return; window.__cursorReady = true;
  const add = () => {
    if (document.getElementById('__cursor')) return;
    const c = document.createElement('div'); c.id = '__cursor';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3 L5 22 L10 17 L13.5 24 L16.5 22.5 L13 15.5 L20 15.5 Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position:'fixed', left:'0px', top:'0px', zIndex:'2147483647', pointerEvents:'none', transition:'left .28s cubic-bezier(.22,.61,.36,1), top .28s cubic-bezier(.22,.61,.36,1)', filter:'drop-shadow(0 2px 3px rgba(0,0,0,.35))', transform:'translate(-3px,-2px)' });
    document.documentElement.appendChild(c);
  };
  window.__cur = (x,y) => { add(); const c=document.getElementById('__cursor'); c.style.left=x+'px'; c.style.top=y+'px'; };
  window.__ripple = (x,y) => { add();
    const r=document.createElement('div');
    Object.assign(r.style,{position:'fixed',left:(x-6)+'px',top:(y-6)+'px',width:'12px',height:'12px',borderRadius:'50%',border:'2px solid #2f5068',zIndex:'2147483646',pointerEvents:'none',opacity:'0.9',transition:'transform .5s ease-out, opacity .5s ease-out'});
    document.documentElement.appendChild(r);
    requestAnimationFrame(()=>{ r.style.transform='scale(4)'; r.style.opacity='0'; });
    setTimeout(()=>r.remove(),600);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();`

export async function launch() {
  const opts = { headless: true }
  if (CFG.channel) opts.channel = CFG.channel
  // the native date/time inputs follow the BROWSER language, not the emulated context locale
  if (CFG.locale) opts.args = [`--lang=${CFG.locale}`]
  return pw().chromium.launch(opts)
}

// cookies: optional array of {name, value, url} for authed contexts
export async function newPage(browser, { videoDir, cookies } = {}) {
  const ctx = await browser.newContext({
    viewport: CFG.viewport, deviceScaleFactor: 1,
    recordVideo: videoDir ? { dir: videoDir, size: CFG.viewport } : undefined,
    ...(CFG.locale ? { locale: CFG.locale } : {}),
    ...(CFG.timezoneId ? { timezoneId: CFG.timezoneId } : {}),
  })
  if (cookies && cookies.length) await ctx.addCookies(cookies)
  await ctx.addInitScript(CURSOR_INIT)
  const page = await ctx.newPage()
  page.setDefaultTimeout(6000)
  return { ctx, page }
}

export async function cursorTo(page, x, y, settle = 300) {
  await page.evaluate(([x, y]) => window.__cur(x, y), [x, y]); await page.waitForTimeout(settle)
}
async function boxCenter(page, sel) {
  const el = page.locator(sel).first()
  await el.waitFor({ state: "visible" }).catch(() => {})
  await el.scrollIntoViewIfNeeded().catch(() => {})
  const b = await el.boundingBox().catch(() => null)
  if (!b) throw new Error("no box for " + sel)
  return { el, x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
export async function moveTo(page, sel) { const { x, y } = await boxCenter(page, sel); await cursorTo(page, x, y) }
export async function click(page, sel) {
  const { el, x, y } = await boxCenter(page, sel)
  await cursorTo(page, x, y)
  await page.evaluate(([x, y]) => window.__ripple(x, y), [x, y]); await page.waitForTimeout(90)
  await el.click(); await page.waitForTimeout(150)
}
export async function typeInto(page, sel, text) {
  const { el, x, y } = await boxCenter(page, sel)
  await cursorTo(page, x, y)
  await page.evaluate(([x, y]) => window.__ripple(x, y), [x, y])
  await el.click(); await el.fill(""); await el.type(text, { delay: 38 }); await page.waitForTimeout(120)
}
export async function goto(page, url) {
  await page.goto(CFG.baseUrl + url, { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(300)
}

// ── captions (.ass) ──────────────────────────────────────────────────────────
function fmt(t) { const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60), cs = Math.round((t - Math.floor(t)) * 100); const p = (n, l = 2) => String(n).padStart(l, "0"); return `${p(h)}:${p(m)}:${p(s)}.${p(cs)}` }
function wrap(text, max = 62) { const w = text.split(" "); const lines = []; let c = ""; for (const x of w) { if ((c + " " + x).trim().length > max) { lines.push(c.trim()); c = x } else c += " " + x } if (c.trim()) lines.push(c.trim()); return lines.join("\\N") }
export function writeAss(file, beats) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap, Arial, 42, &H00FFFFFF, &H14101010, &H14101010, 1, 3, 10, 0, 2, 160, 160, 90, 204

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const lines = beats.map(b => `Dialogue: 0,${fmt(b.start)},${fmt(b.end)},Cap,,0,0,0,,${wrap(b.text)}`).join("\n")
  fs.writeFileSync(file, header + lines + "\n")
}
export function writeSrt(file, beats) {
  const f = x => { const h = Math.floor(x / 3600), m = Math.floor(x % 3600 / 60), s = Math.floor(x % 60), ms = Math.round((x - Math.floor(x)) * 1000); const p = (n, l = 2) => String(n).padStart(l, "0"); return `${p(h)}:${p(m)}:${p(s)},${p(ms, 3)}` }
  fs.writeFileSync(file, beats.map((b, i) => `${i + 1}\n${f(b.start)} --> ${f(b.end)}\n${b.text}\n`).join("\n"))
}

// ── assemble body (screen recording + narration + captions) ──────────────────
// beats: [{ text, start, end, mp3, dur }]. Produces ONE stereo-48k MP4.
export function assemble({ webm, outMp4, beats, workDir }) {
  const ass = path.join(workDir, "captions.ass"); writeAss(ass, beats)
  const probe = f => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", f]).toString().trim())
  const inputs = ["-i", webm]; beats.forEach(b => inputs.push("-i", b.mp3))
  const filters = []
  beats.forEach((b, i) => {
    const ms = Math.round(b.start * 1000)
    const d = b.dur || probe(b.mp3)
    const fo = Math.max(d - 0.05, 0.01).toFixed(3)
    // resample → mono float, edge-fade (kills onset/offset clicks), delay to start
    filters.push(`[${i + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,afade=t=in:st=0:d=0.03,afade=t=out:st=${fo}:d=0.05,adelay=${ms}[a${i}]`)
  })
  filters.push(`${beats.map((_, i) => `[a${i}]`).join("")}amix=inputs=${beats.length}:normalize=0:dropout_transition=0,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[mix]`)
  filters.push(`[0:v]subtitles=captions.ass[v]`)
  execFileSync("ffmpeg", ["-y", ...inputs, "-filter_complex", filters.join(";"),
    "-map", "[v]", "-map", "[mix]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart", "-shortest", outMp4], { cwd: workDir, stdio: "ignore" })
  return outMp4
}

// ── intro / outro cards ──────────────────────────────────────────────────────
function ensureFonts(workDir) {
  for (const f of [CFG.captionFont, CFG.captionFontBold]) {
    const src = path.isAbsolute(f) ? f : `C:/Windows/Fonts/${f}`
    const dst = path.join(workDir, path.basename(f))
    if (!fs.existsSync(dst) && fs.existsSync(src)) fs.copyFileSync(src, dst)
  }
}
export function makeCard({ workDir, wordmark, subtitle, out, dur = 1.5 }) {
  ensureFonts(workDir)
  fs.writeFileSync(path.join(workDir, "wm.txt"), wordmark)
  fs.writeFileSync(path.join(workDir, "sub.txt"), subtitle)
  const bold = path.basename(CFG.captionFontBold), reg = path.basename(CFG.captionFont)
  const vf = [
    `drawtext=fontfile=${bold}:textfile=wm.txt:fontcolor=white:fontsize=62:x=(w-text_w)/2:y=(h/2)-72`,
    `drawtext=fontfile=${reg}:textfile=sub.txt:fontcolor=0x9aa4ad:fontsize=42:x=(w-text_w)/2:y=(h/2)+12`,
    `fade=t=in:st=0:d=0.4`, `fade=t=out:st=${(dur - 0.45).toFixed(2)}:d=0.45`,
  ].join(",")
  execFileSync("ffmpeg", ["-y",
    "-f", "lavfi", "-i", `color=c=0x17191d:s=${CFG.viewport.width}x${CFG.viewport.height}:r=25:d=${dur}`,
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    "-vf", vf, "-t", String(dur),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", out], { cwd: workDir, stdio: "ignore" })
}

// ── concat via the concat FILTER (unifies formats; never the demuxer) ─────────
export function concat(list, out, workDir) {
  const inputs = []; list.forEach(f => inputs.push("-i", f))
  const pre = list.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("")
  execFileSync("ffmpeg", ["-y", ...inputs,
    "-filter_complex", `${pre}concat=n=${list.length}:v=1:a=1[v][a]`,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "25",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart", out], { cwd: workDir, stdio: "ignore" })
}
