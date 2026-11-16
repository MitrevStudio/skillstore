// ===========================================================================
// PROJECT CLIPS CONFIG — copy this into your project (e.g. video/clips.mjs),
// then run:  node <skill>/scripts/produce.mjs ./video/clips.mjs all
// ===========================================================================
import path from "node:path"

// --- 1. Studio config ------------------------------------------------------
export const studio = {
  baseUrl: "http://localhost:3000",      // the running app (prefer a LOCAL demo instance)
  outDir: path.resolve("tutorial-videos"),// where finished .mp4 + .srt land
  scratchDir: path.resolve(".studio"),    // work/cache dir (can be temp)
  channel: "",                     // "msedge" or "chrome"; "" = Playwright's bundled chromium
  voiceId: process.env.ELEVENLABS_VOICE_ID, // select a voice available to your account
  modelId: "eleven_v3",                  // "eleven_v3" (expressive) | "eleven_multilingual_v2" (most stable)
  settingsVer: "v1",                     // bump to force-regenerate cached audio
  voiceSettings: { stability: 0.5, similarity_boost: 0.8, use_speaker_boost: true },
  speed: 1.18,                           // 1.0 = original tempo; >1 faster (pitch preserved)
  wordmark: "Y O U R   A P P",     // intro/outro big text (spaces = letter-spacing)
  cardSubtitle: "Административен панел",  // outro subtitle
}

// --- 2. Auth (only if any clip is authed:true) -----------------------------
// Use a local demo account. Supply an existing session through the environment;
// adapt the cookie name to your application. Never commit a cookie value.
export async function authCookies() {
  const name = process.env.APP_SESSION_COOKIE_NAME
  const value = process.env.APP_SESSION_COOKIE
  if (!name || !value) throw new Error("Set APP_SESSION_COOKIE_NAME and APP_SESSION_COOKIE for authenticated clips")
  return [{ name, value, url: studio.baseUrl }]
}

function demoCredential(name) {
  const value = process.env[name]
  if (!value) throw new Error("Missing demo credential: " + name)
  return value
}

// --- 3. Phonetic fixes for TTS (optional) ----------------------------------
// English UI terms read inside another language sound wrong; respell them
// phonetically. Captions keep the ORIGINAL text; only narration is swapped.
export const respell = [
  ["Save settings", "Сейв сетингс"],
  ["Sign in", "Сайн ин"],
  ["Preview", "Превю"],
  ["Save", "Сейв"],
]

// --- 4. Clips --------------------------------------------------------------
// Each beat = { text, do(page, S) }. `text` is narration + caption. `do`
// performs the visual action; narration plays WHILE it happens. Keep each
// `text` to ONE short sentence (long sentences make v3 glitch). Helpers on S:
//   S.goto(page,"/path")  S.click(page,sel)  S.typeInto(page,sel,txt)
//   S.moveTo(page,sel)    page.waitForTimeout(ms)   any Playwright call
export const clips = {
  "01-login": {
    title: "Вход", authed: false,
    beats: [
      { text: "Добре дошли в административния панел.", do: async (p, S) => { await S.goto(p, "/admin/login") } },
      { text: "Въведете имейл адрес.", do: async (p, S) => { await S.typeInto(p, "#email", demoCredential("DEMO_EMAIL")) } },
      { text: "И паролата.", do: async (p, S) => { await S.typeInto(p, "#password", demoCredential("DEMO_PASSWORD")) } },
      { text: "Натиснете Sign in.", do: async (p, S) => { await S.click(p, 'button[type="submit"]'); await p.waitForURL("**/admin", { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(800) } },
      { text: "Това е таблото.", do: async p => { await p.waitForTimeout(300) } },
    ],
  },
  "02-section": {
    title: "Раздел", authed: true,
    beats: [
      { text: "Разделът показва списък със записи.", do: async (p, S) => { await S.goto(p, "/admin/items") } },
      { text: "Отваряме един запис за редакция.", do: async (p, S) => { await S.click(p, 'a[aria-label="Edit"]').catch(() => {}); await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(500) } },
      { text: "Полетата се попълват и се запазват с бутона Save.", do: async (p, S) => { await S.moveTo(p, 'button:has-text("Save")').catch(() => {}) } },
    ],
  },
}
