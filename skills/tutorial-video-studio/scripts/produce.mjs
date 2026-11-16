// tutorial-video-studio — generic runner
// ---------------------------------------------------------------------------
// Usage:
//   node produce.mjs <clips-config.mjs> <clip-id | full | all> [--require-base DIR]
//
// <clips-config.mjs> is a PROJECT file (see references/clips-template.mjs) that
// exports:
//   studio       : config object passed to studio.configure()
//   clips        : { "<id>": { title, authed, beats:[{text, do(page)}] }, ... }
//   authCookies? : async () => [{name,value,url}]   (for authed:true clips)
//   respell?     : [[from, to], ...]  phonetic swaps applied to NARRATION only
//
// Env: ELEVENLABS_API_KEY (or the key named by studio.apiKeyEnv). Playwright
// must be importable from --require-base (default: the config file's folder).
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { execFileSync } from "node:child_process"
import * as S from "./studio.mjs"

const argv = process.argv.slice(2)
const rbIdx = argv.indexOf("--require-base")
const requireBase = rbIdx >= 0 ? argv[rbIdx + 1] : null
const positional = argv.filter((a, i) => a !== "--require-base" && argv[i - 1] !== "--require-base")
const configPath = positional[0]
const target = positional[1] || "all"

if (!configPath) { console.error("usage: node produce.mjs <clips-config.mjs> <clip-id|full|all> [--require-base DIR]"); process.exit(1) }

const cfgMod = await import(pathToFileURL(path.resolve(configPath)).href)
S.setRequireBase(requireBase || path.dirname(path.resolve(configPath)))
const CFG = S.configure(cfgMod.studio || {})
const CLIPS = cfgMod.clips || {}
const respellPairs = cfgMod.respell || []
const authCookies = typeof cfgMod.authCookies === "function" ? cfgMod.authCookies : null

const wait = (p, ms) => p.waitForTimeout(ms)
function say(text) { let t = text; for (const [a, b] of respellPairs) t = t.replaceAll(a, b); return t }

async function produceClip(id) {
  const clip = CLIPS[id]
  if (!clip) throw new Error("no such clip: " + id)
  const work = path.join(CFG.scratchDir, "work", id)
  fs.mkdirSync(work, { recursive: true })

  const cookies = clip.authed && authCookies ? await authCookies() : undefined
  const browser = await S.launch()
  const { ctx, page } = await S.newPage(browser, { videoDir: work, cookies })
  const video = page.video()
  const t0 = Date.now()
  await wait(page, 300)

  for (const b of clip.beats) {
    const { dur, mp3 } = await S.synth(say(b.text))
    b.dur = dur; b.mp3 = mp3
    // Narration starts WITH the action, so the whole action is visible while spoken.
    const start = (Date.now() - t0) / 1000
    b.start = start; b.end = start + dur + 0.1
    try { await b.do(page, S) } catch (e) { console.log("  beat warn:", e.message.slice(0, 70)) }
    const elapsed = (Date.now() - t0) / 1000 - start
    await wait(page, Math.round(Math.max(dur - elapsed, 0.12) * 1000))
  }
  await wait(page, 400)
  await ctx.close()
  const webm = await video.path()
  await browser.close()

  const body = path.join(work, "body.mp4")
  S.assemble({ webm, outMp4: body, beats: clip.beats.map(b => ({ text: b.text, start: b.start, end: b.end, mp3: b.mp3, dur: b.dur })), workDir: work })

  const intro = path.join(work, "intro.mp4"), outro = path.join(work, "outro.mp4")
  S.makeCard({ workDir: work, wordmark: CFG.wordmark, subtitle: clip.title, out: intro, dur: 1.5 })
  S.makeCard({ workDir: work, wordmark: CFG.wordmark, subtitle: CFG.cardSubtitle, out: outro, dur: 1.3 })

  const final = path.join(CFG.outDir, `${id}.mp4`)
  S.concat([intro, body, outro], final, work)
  S.writeSrt(path.join(CFG.outDir, `${id}.srt`), clip.beats)
  const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", final]).toString().trim()
  console.log(`DONE ${id} -> ${final} (${(+dur).toFixed(1)}s)`)
}

function buildFull() {
  const ids = Object.keys(CLIPS)
  const work = path.join(CFG.scratchDir, "work", "_full"); fs.mkdirSync(work, { recursive: true })
  const parts = ids.map(id => path.join(CFG.outDir, `${id}.mp4`)).filter(f => fs.existsSync(f))
  const out = path.join(CFG.outDir, "00-full.mp4")
  S.concat(parts, out, work)
  const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", out]).toString().trim()
  console.log(`DONE full (${parts.length} parts) -> ${out} (${(+dur).toFixed(1)}s)`)
}

if (target === "full") {
  buildFull()
} else if (target === "all") {
  for (const id of Object.keys(CLIPS)) await produceClip(id)
  buildFull()
} else if (CLIPS[target]) {
  await produceClip(target)
} else {
  console.log("clips:", Object.keys(CLIPS).join(", "), "| or: full | all")
}
