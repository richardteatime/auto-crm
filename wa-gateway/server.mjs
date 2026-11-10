// Vendiora WhatsApp gateway: un numero WhatsApp collegato via QR (Baileys) esposto al CRM via HTTP.
import http from "node:http";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import makeWASocket, {
  Browsers, DisconnectReason, fetchLatestBaileysVersion, normalizeMessageContent, useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.WA_GATEWAY_SECRET || "";
const INBOUND = process.env.CRM_INBOUND_URL || "";
const DATA = process.env.DATA_DIR || "/data";
const SESSION = join(DATA, "session");
const LIDMAP = join(DATA, "lidmap.json");
const log = pino({ level: process.env.LOG_LEVEL || "info" });

if (!SECRET) { log.fatal("WA_GATEWAY_SECRET mancante"); process.exit(1); }
mkdirSync(DATA, { recursive: true });

// ---------------------------------------------------------------- stato
let sock = null;
let state = { status: "disconnected", reason: null, phone: null, qr: null };
let stopped = true;
let retries = 0;
let timer = null;
let starting = null;

let lidMap = {};
try { lidMap = JSON.parse(readFileSync(LIDMAP, "utf8")); } catch { lidMap = {}; }
function saveLid(lid, phone) {
  if (!lid || !phone || lidMap[lid] === phone) return;
  lidMap[lid] = phone;
  try { writeFileSync(LIDMAP, JSON.stringify(lidMap)); } catch (e) { log.warn({ e: e.message }, "lidmap"); }
}

function setState(s) {
  state = { ...state, ...s };
  log.info({ status: state.status, reason: state.reason, phone: state.phone }, "stato WhatsApp");
}

const registered = () => {
  try { return JSON.parse(readFileSync(join(SESSION, "creds.json"), "utf8")).registered === true; } catch { return false; }
};

const digits = (s) => String(s || "").replace(/\D/g, "");
const phoneOfJid = (jid) => (jid && jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0].split(":")[0] : null);

// ---------------------------------------------------------------- socket
async function start() {
  stopped = false;
  if (sock) return;
  if (!starting) starting = open().catch((e) => { log.warn({ e: e.message }, "apertura fallita"); schedule(); }).finally(() => { starting = null; });
  return starting;
}

function schedule(delay) {
  if (stopped) return setState({ status: "disconnected", reason: "stopped", qr: null });
  clearTimeout(timer);
  const d = delay ?? Math.min(60_000, 1000 * 2 ** retries++);
  setState({ status: "reconnecting" });
  timer = setTimeout(() => void start(), d);
}

async function open() {
  mkdirSync(SESSION, { recursive: true, mode: 0o700 });
  if (state.status !== "reconnecting") setState({ status: "connecting", reason: null });
  const { state: auth, saveCreds } = await useMultiFileAuthState(SESSION);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
  const s = makeWASocket({
    version, auth,
    browser: Browsers.macOS("Desktop"),
    logger: log.child({ lib: "baileys" }, { level: "warn" }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    getMessage: async () => undefined,
  });
  sock = s;
  s.ev.on("creds.update", () => void saveCreds().catch(() => {}));
  s.ev.on("connection.update", async (u) => {
    if (sock !== s) return;
    if (u.qr) setState({ status: "qr", qr: await QRCode.toDataURL(u.qr, { margin: 1, width: 320 }) });
    if (u.connection === "open") {
      retries = 0;
      setState({ status: "connected", reason: null, qr: null, phone: phoneOfJid((s.user?.id || "").replace(/:\d+@/, "@")) || digits((s.user?.id || "").split(":")[0]) });
    }
    if (u.connection === "close") onClose(s, u.lastDisconnect?.error?.output?.statusCode);
  });
  s.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const m of messages) {
      try { await inbound(s, m, type); } catch (e) { log.error({ e: e.message }, "inbound"); }
    }
  });
}

function onClose(s, code) {
  if (sock !== s) return;
  sock = null;
  if (stopped) return setState({ status: "disconnected", reason: "stopped", qr: null });
  if ([DisconnectReason.loggedOut, DisconnectReason.badSession, DisconnectReason.multideviceMismatch].includes(code)) {
    rmSync(SESSION, { recursive: true, force: true });
    stopped = true;
    return setState({ status: "logged_out", reason: "scollegato dal telefono", qr: null, phone: null });
  }
  if (code === DisconnectReason.connectionReplaced) { stopped = true; return setState({ status: "disconnected", reason: "sessione aperta altrove", qr: null }); }
  if (code === DisconnectReason.forbidden) { stopped = true; return setState({ status: "disconnected", reason: "numero bloccato o limitato da WhatsApp", qr: null }); }
  if (code === DisconnectReason.timedOut && !registered()) { stopped = true; return setState({ status: "disconnected", reason: "QR scaduto", qr: null }); }
  schedule(code === DisconnectReason.restartRequired ? 300 : undefined);
}

async function inbound(s, m, type) {
  const key = m.key;
  const chatId = key?.remoteJid;
  if (!key?.id || !chatId || !m.message) return;
  if (/@(g\.us|broadcast|newsletter)$/.test(chatId) || chatId === "status@broadcast") return;
  const msg = normalizeMessageContent(m.message);
  if (!msg || msg.protocolMessage || msg.reactionMessage || msg.senderKeyDistributionMessage) return;
  const text =
    msg.conversation ?? msg.extendedTextMessage?.text ?? msg.imageMessage?.caption ?? msg.videoMessage?.caption ??
    msg.documentMessage?.caption ?? msg.buttonsResponseMessage?.selectedDisplayText ?? msg.listResponseMessage?.title ??
    (msg.audioMessage ? "[messaggio vocale]" : undefined) ?? (msg.imageMessage ? "[immagine]" : undefined) ??
    (msg.videoMessage ? "[video]" : undefined) ?? (msg.documentMessage ? "[documento]" : undefined) ??
    (msg.stickerMessage ? "[sticker]" : undefined) ?? (msg.locationMessage ? "[posizione]" : undefined) ??
    (msg.contactMessage ? "[contatto]" : undefined);
  if (!text) return;
  const ts = Number(m.messageTimestamp || 0) * 1000 || Date.now();
  if (type !== "notify" && Date.now() - ts > 6 * 3600_000) return; // storico vecchio
  let phone = phoneOfJid(chatId) || phoneOfJid(key.remoteJidAlt) || lidMap[chatId] || null;
  if (!phone && chatId.endsWith("@lid")) {
    const pn = await s.signalRepository?.lidMapping?.getPNForLID?.(chatId).catch(() => null);
    phone = phoneOfJid(pn);
    if (phone) saveLid(chatId, phone);
  }
  if (!INBOUND) return;
  const body = { id: key.id, chatId, phone, fromMe: !!key.fromMe, text, ts, pushName: key.fromMe ? null : m.pushName || null };
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(INBOUND, { method: "POST", headers: { "Content-Type": "application/json", "X-WA-Secret": SECRET }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
      if (r.ok || (r.status >= 400 && r.status < 500)) return;
    } catch (e) { log.warn({ e: e.message }, "inoltro al CRM fallito"); }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
}

async function send(phone, text) {
  if (!sock || state.status !== "connected") return [409, { error: `WhatsApp non collegato (${state.status})` }];
  const p = digits(phone);
  if (p.length < 8) return [422, { error: "Numero non valido" }];
  const res = await sock.onWhatsApp(`${p}@s.whatsapp.net`);
  if (res === undefined) return [503, { error: "Verifica del numero fallita, riprova" }];
  const hit = res.find((r) => r.exists);
  if (!hit) return [422, { error: "Questo numero non ha WhatsApp" }];
  const lid = await sock.signalRepository?.lidMapping?.getLIDForPN?.(hit.jid).catch(() => null);
  if (lid) saveLid(lid, p);
  await sock.sendPresenceUpdate("composing", hit.jid).catch(() => {});
  await new Promise((r) => setTimeout(r, Math.min(4000, 800 + text.length * 25)));
  const sent = await sock.sendMessage(hit.jid, { text });
  await sock.sendPresenceUpdate("paused", hit.jid).catch(() => {});
  return [200, { ok: true, chatId: hit.jid, lid: lid || null, id: sent?.key?.id || null }];
}

// ---------------------------------------------------------------- http
function authorized(req) {
  const got = Buffer.from(String(req.headers["x-wa-secret"] || ""));
  const want = Buffer.from(SECRET);
  return got.length === want.length && timingSafeEqual(got, want);
}

function reply(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

async function readJson(req) {
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > 64_000) throw new Error("body troppo grande"); }
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/health") return reply(res, 200, { ok: true, status: state.status });
    if (!authorized(req)) return reply(res, 401, { error: "non autorizzato" });
    if (req.method === "GET" && url.pathname === "/status") return reply(res, 200, state);
    if (req.method === "POST" && url.pathname === "/connect") {
      if (state.status === "logged_out" || state.status === "disconnected") setState({ reason: null });
      void start();
      await new Promise((r) => setTimeout(r, 2500));
      return reply(res, 200, state);
    }
    if (req.method === "POST" && url.pathname === "/logout") {
      stopped = true;
      clearTimeout(timer);
      try { await sock?.logout(); } catch { /* gia' chiusa */ }
      try { sock?.end(undefined); } catch { /* */ }
      sock = null;
      rmSync(SESSION, { recursive: true, force: true });
      setState({ status: "disconnected", reason: "scollegato dal CRM", qr: null, phone: null });
      return reply(res, 200, state);
    }
    if (req.method === "POST" && url.pathname === "/send") {
      const b = await readJson(req);
      if (!b.text || typeof b.text !== "string") return reply(res, 400, { error: "text mancante" });
      const [code, out] = await send(b.phone, b.text.slice(0, 4000));
      return reply(res, code, out);
    }
    return reply(res, 404, { error: "not found" });
  } catch (e) {
    log.error({ e: e.message }, "errore richiesta");
    return reply(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => log.info({ port: PORT }, "gateway pronto"));
if (registered()) void start(); // sessione gia' collegata: riparte da sola
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { stopped = true; try { sock?.end(undefined); } catch { /* */ } process.exit(0); });
