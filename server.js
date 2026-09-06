require("dotenv").config();
const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");
const { Redis } = require("@upstash/redis");

const app = express();
app.use(express.json());

const {
PAGE_ACCESS_TOKEN,
VERIFY_TOKEN,
IG_BUSINESS_ACCOUNT_ID,
ANTHROPIC_API_KEY,
UPSTASH_REDIS_REST_URL,
UPSTASH_REDIS_REST_TOKEN,
LEADS_ACCESS_KEY,
PORT = 3000,
} = process.env;

const WHATSAPP_NUMBER_DISPLAY = "+90 533 556 62 10";
const WHATSAPP_NUMBER_DIGITS = "905335566210";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER_DIGITS}`;
const WHATSAPP_BUTTON_MARKER = "[[WHATSAPP_BUTTON]]";

const anthropic = ANTHROPIC_API_KEY
? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
: null;

const redis =
UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
? new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })
: null;

if (!anthropic) {
console.warn("ANTHROPIC_API_KEY tanimli degil - sabit yanit kullanilacak.");
}
if (!redis) {
console.warn("Upstash Redis bilgileri eksik - konusma gecmisi saklanmayacak.");
}
if (!LEADS_ACCESS_KEY) {
console.warn("LEADS_ACCESS_KEY tanimli degil - /leads sayfasi kilitli kalacak.");
}

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_HISTORY_MESSAGES = 12;
const FALLBACK_REPLY =
"Merhaba! Mesajınız için teşekkürler, en kısa sürede döneceğiz.";

const FLOW_TTL_SECONDS = 60 * 60 * 24 * 3;
const LEADS_KEY = "leads";
const MAX_LEADS = 500;

const REGION_LABELS = {
REGION_AFYON: "Afyon",
REGION_USAK: "Uşak",
REGION_ISPARTA: "Isparta",
REGION_BURDUR: "Burdur",
REGION_ANTALYA: "Antalya",
REGION_OTHER: "Diğer",
};

const SYSTEM_PROMPT = `Sen Wintek'in Instagram hesabı için çalışan bir müşteri asistanısın. Türkçe, samimi, kısa ve net cevaplar veriyorsun.

WINTEK NE SATAR:
- İş güvenliği ve el aletleri: iş eldivenleri, matkap uçları, sanayi için (demonte) çalışma tezgahları, akülü el aletleri ve benzeri endüstriyel ürünler.
- WINKEL markasının bayisi olarak: anaerobik ürünler (vida/boru sıkılığı için), yapıştırıcılar (metal dolgulu epoksi macunlar dahil), elastik sızdırmazlık ürünleri, yağlayıcılar (gres, pas sökücü ve anti-seize spreyler), metal kaplama/pas dönüştürücü ürünler, parça ve yüzey temizleyiciler, sprey boyalar. Bu ürünler sanayi, otomotiv ve denizcilik sektörlerine yöneliktir.

KURALLAR:
1. Ürünler, kullanım alanları ve genel bilgilerle ilgili sorulara elinden geldiğince net ve yardımcı şekilde cevap ver.
2. STOK DURUMU veya KESİN FİYAT sorulduğunda: canlı stok/fiyat sistemine erişimin olmadığını unutma, bu yüzden kesin rakam veya "stokta var/yok" bilgisi UYDURMA. Bu durumlarda nazikçe kesin teyit için WhatsApp'tan iletişime geçmeyi öner (cevabında "WhatsApp'tan yazabilirsiniz" gibi bir ifade kullanabilirsin ama telefon numarasını asla yazma). Bu durumda, cevabının en sonuna başka hiçbir şey eklemeden tam olarak şu işareti ekle: ${WHATSAPP_BUTTON_MARKER}
3. Alakasız, uygunsuz ya da Wintek'in işiyle ilgisi olmayan taleplerde kibarca konuyu Wintek'in ürün/hizmetlerine getir ya da gerekiyorsa yukarıdaki WhatsApp yönlendirmesini (2. kuraldaki gibi) kullan.
4. Yanıtların Instagram DM/yorum ortamına uygun olsun: kısa (1-4 cümle), gereksiz uzatmadan, doğal bir müşteri temsilcisi tonunda. Emoji kullanımı ölçülü olsun, abartma.
5. Kendini yapay zeka olarak tanıtmana gerek yok, Wintek adına yazan doğal bir temsilci gibi davran.`;

app.get("/webhook", (req, res) => {
const mode = req.query["hub.mode"];
const token = req.query["hub.verify_token"];
const challenge = req.query["hub.challenge"];

if (mode === "subscribe" && token === VERIFY_TOKEN) {
console.log("Webhook dogrulandi.");
return res.status(200).send(challenge);
}

console.warn("Webhook dogrulama basarisiz. Token eslesmedi.");
return res.status(403).send("Forbidden");
});

app.get("/privacy", (req, res) => {
res.set("Content-Type", "text/html; charset=utf-8");
res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Gizlilik Politikasi - Wintek Sosyal Medya Otomasyonu</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
h1 { font-size: 1.6em; }
h2 { font-size: 1.2em; margin-top: 1.6em; }
footer { margin-top: 3em; font-size: 0.85em; color: #666; }
</style>
</head>
<body>
<h1>Gizlilik Politikasi</h1>
<p><strong>Wintek Sosyal Medya Otomasyonu</strong> uygulamasi, Wintek'in Instagram isletme hesabina gelen dogrudan mesajlara (DM) ve gonderi yorumlarina otomatik yanit vermek amaciyla gelistirilmistir. Bu sayfa, uygulamanin hangi verileri nasil isledigini aciklar.</p>
<h2>Hangi Veriler Islenir?</h2>
<ul>
<li>Mesaj gonderen veya yorum yapan kullanicinin Instagram kullanici kimligi (IGSID)</li>
<li>Gonderilen mesaj veya yorumun metin icerigi</li>
<li>Kullanicinin kendi istegiyle paylastigi bolge, ihtiyac, ad soyad ve telefon numarasi gibi iletisim bilgileri (yalnizca bolge/temsilci akisinda, kullanici bu bilgileri kendisi yazdiginda)</li>
</ul>
<h2>Veriler Ne Amacla Kullanilir?</h2>
<p>Bu veriler, gelen mesaj/yoruma anlamli ve baglamsal bir yanit uretmek amaciyla Meta/Instagram Graph API ve Anthropic Claude API uzerinden islenir. Konusma baglamini surdurebilmek icin son mesajlar, kullaniciya ozel olarak, sifreli bir bulut veritabaninda (Upstash Redis) en fazla 7 gun sureyle saklanir ve bu surenin sonunda otomatik olarak silinir. Kullanicinin bolge/temsilci talebiyle kendi istegiyle paylastigi iletisim bilgileri, yalnizca Wintek satis ekibinin kendisiyle iletisime gecebilmesi icin saklanir. Veriler pazarlama, profil olusturma veya ucuncu taraflarla paylasim amaciyla kullanilmaz.</p>
<h2>Veri Saklama</h2>
<p>Konusma gecmisi en fazla 7 gun saklanip otomatik silinir. Sunucu calisma gunluklerinde (log) teknik hata ayiklama amaciyla kisa sureligine tutulabilir ve duzenli olarak temizlenir.</p>
<h2>Ucuncu Taraflarla Paylasim</h2>
<p>Toplanan veriler, yanit gonderme islemini gerceklestirmek icin gereken Meta/Instagram Graph API ve yaniti olusturmak icin gereken Anthropic Claude API cagrilari disinda hicbir ucuncu tarafla paylasilmaz veya satilmaz.</p>
<h2>Veri Silme Talepleri</h2>
<p>Verilerinizin silinmesini talep etmek icin asagidaki iletisim adresinden bize ulasabilirsiniz.</p>
<h2>Iletisim</h2>
<p>Sorulariniz icin: <a href="mailto:alkanedim@gmail.com">alkanedim@gmail.com</a></p>
<footer>Son guncelleme: 6 Eylul 2026</footer>
</body>
</html>`);
});

app.get("/leads", async (req, res) => {
if (!LEADS_ACCESS_KEY || req.query.key !== LEADS_ACCESS_KEY) {
return res.status(403).send("Yetkisiz erisim.");
}

if (!redis) {
return res.status(200).send("Redis baglantisi yok, kayit gosterilemiyor.");
}

try {
const raw = await redis.lrange(LEADS_KEY, 0, MAX_LEADS - 1);
const leads = raw
.map((item) => {
try {
return typeof item === "string" ? JSON.parse(item) : item;
} catch (e) {
return null;
}
})
.filter(Boolean);

const rows = leads
.map((lead) => {
const date = lead.timestamp
? new Date(lead.timestamp).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
: "-";
return `<tr><td>${escapeHtml(date)}</td><td>${escapeHtml(lead.region || "-")}</td><td>${escapeHtml(lead.need || "-")}</td><td>${escapeHtml(lead.contactInfo || "-")}</td></tr>`;
})
.join("\n");

res.set("Content-Type", "text/html; charset=utf-8");
res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Gelen Talepler - Wintek</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 960px; margin: 40px auto; padding: 0 20px; color: #222; }
h1 { font-size: 1.5em; }
table { width: 100%; border-collapse: collapse; margin-top: 20px; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 0.95em; vertical-align: top; }
th { background: #f7f7f7; }
tr:hover { background: #fafafa; }
.empty { color: #666; margin-top: 20px; }
</style>
</head>
<body>
<h1>Gelen Talepler</h1>
<p>Instagram uzerinden bolge secip bilgi birakan musteriler. Sayfayi yenileyerek guncel listeyi gorebilirsin.</p>
${leads.length === 0 ? '<p class="empty">Henuz kayit yok.</p>' : `<table><thead><tr><th>Tarih</th><th>Bolge</th><th>Ihtiyac</th><th>Iletisim Bilgisi</th></tr></thead><tbody>${rows}</tbody></table>`}
</body>
</html>`);
} catch (err) {
console.error("Leads sayfasi hatasi:", err.message);
res.status(500).send("Bir hata olustu.");
}
});

app.post("/webhook", (req, res) => {
res.status(200).send("EVENT_RECEIVED");

const body = req.body;
console.log("RAW webhook body:", JSON.stringify(body));

if (body.object !== "instagram") return;

const entries = body.entry || [];

for (const entry of entries) {
const messagingEvents = entry.messaging || [];
for (const event of messagingEvents) {
handleDirectMessage(event);
}

const changes = entry.changes || [];
for (const change of changes) {
if (change.field === "comments") {
handleComment(change.value);
} else if (change.field === "messages") {
handleDirectMessage(change.value);
}
}
}
});

function escapeHtml(str) {
return String(str)
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#39;");
}

async function getHistory(historyKey) {
if (!redis) return [];
try {
const data = await redis.get(historyKey);
return Array.isArray(data) ? data : [];
} catch (err) {
console.error("Redis okuma hatasi:", err.message);
return [];
}
}

async function saveHistory(historyKey, history) {
if (!redis) return;
try {
const trimmed = history.slice(-MAX_HISTORY_MESSAGES);
await redis.set(historyKey, trimmed, { ex: HISTORY_TTL_SECONDS });
} catch (err) {
console.error("Redis yazma hatasi:", err.message);
}
}

async function getFlowState(senderId) {
if (!redis) return null;
try {
const data = await redis.get(`flow:dm:${senderId}`);
return data || null;
} catch (err) {
console.error("Redis flow okuma hatasi:", err.message);
return null;
}
}

async function setFlowState(senderId, state) {
if (!redis) return;
try {
await redis.set(`flow:dm:${senderId}`, state, { ex: FLOW_TTL_SECONDS });
} catch (err) {
console.error("Redis flow yazma hatasi:", err.message);
}
}

async function saveLead(lead) {
if (!redis) return;
try {
await redis.lpush(LEADS_KEY, lead);
await redis.ltrim(LEADS_KEY, 0, MAX_LEADS - 1);
console.log(`Yeni talep kaydedildi -> ${lead.senderId} (${lead.region} / ${lead.need})`);
} catch (err) {
console.error("Lead kaydetme hatasi:", err.message);
}
}

async function generateAIReply(historyKey, userText, maxTokens) {
if (!anthropic) return { text: FALLBACK_REPLY, whatsapp: false };

const history = await getHistory(historyKey);
const messages = [...history, { role: "user", content: userText }];

try {
const response = await anthropic.messages.create({
model: CLAUDE_MODEL,
max_tokens: maxTokens,
system: SYSTEM_PROMPT,
messages,
});

const rawText = (response.content || [])
.filter((block) => block.type === "text")
.map((block) => block.text)
.join("\n")
.trim();

if (!rawText) return { text: FALLBACK_REPLY, whatsapp: false };

const whatsapp = rawText.includes(WHATSAPP_BUTTON_MARKER);
const cleanText = rawText.split(WHATSAPP_BUTTON_MARKER).join("").trim();
const finalText = cleanText || FALLBACK_REPLY;

const updatedHistory = [...messages, { role: "assistant", content: finalText }];
await saveHistory(historyKey, updatedHistory);

return { text: finalText, whatsapp };
} catch (err) {
console.error("Claude API hatasi:", err.response?.data || err.message);
return { text: FALLBACK_REPLY, whatsapp: false };
}
}

async function handleDirectMessage(event) {
const senderId = event.sender?.id;
const message = event.message;

if (!senderId || senderId === IG_BUSINESS_ACCOUNT_ID) return;

if (message?.is_echo) return;

if (!message?.text) return;

const quickReplyPayload = message.quick_reply?.payload;

console.log(`DM alindi - Gonderen: ${senderId}, Mesaj: "${message.text}"${quickReplyPayload ? `, QuickReply: ${quickReplyPayload}` : ""}`);

const flow = await getFlowState(senderId);

if (quickReplyPayload && REGION_LABELS[quickReplyPayload]) {
const region = REGION_LABELS[quickReplyPayload];

if (quickReplyPayload === "REGION_OTHER") {
await setFlowState(senderId, { stage: "done", region });
} else {
await setFlowState(senderId, { stage: "awaiting_need", region });
sendNeedMenu(senderId, region);
return;
}
} else if (quickReplyPayload === "NEED_REP" || quickReplyPayload === "NEED_STORE") {
const need = quickReplyPayload === "NEED_REP" ? "Satış Temsilcisi" : "Mağaza Bilgisi";
const region = flow?.region || "Bilinmiyor";
await setFlowState(senderId, { stage: "awaiting_contact", region, need });
sendDirectReply(
senderId,
`Harika, sizi ${region} bölgesi için ${need.toLowerCase()} konusunda ekibimize yönlendireceğim. Size ulaşabilmemiz için ad soyad ve telefon numaranızı yazar mısınız?`
);
return;
} else if (flow?.stage === "awaiting_contact") {
await saveLead({
senderId,
region: flow.region,
need: flow.need,
contactInfo: message.text,
timestamp: Date.now(),
});
await setFlowState(senderId, { stage: "done", region: flow.region, need: flow.need });
sendDirectReply(
senderId,
`Teşekkürler! Bilgileriniz alındı, ${flow.region} bölgesi ekibimiz en kısa sürede sizinle iletişime geçecek.`
);
return;
} else if (!flow) {
const history = await getHistory(`conv:dm:${senderId}`);
if (history.length === 0) {
await setFlowState(senderId, { stage: "awaiting_region" });
sendRegionMenu(senderId);
return;
}
}

const { text, whatsapp } = await generateAIReply(`conv:dm:${senderId}`, message.text, 400);

if (whatsapp) {
sendDirectReplyWithWhatsApp(senderId, text);
} else {
sendDirectReply(senderId, text);
}
}

async function handleComment(value) {
const commentId = value?.id;
const commenterId = value?.from?.id;
const commentText = value?.text;

if (!commenterId || commenterId === IG_BUSINESS_ACCOUNT_ID) return;

if (!commentId || !commentText) return;

console.log(`Yorum alindi - Yazan: ${commenterId}, Yorum: "${commentText}"`);

const { text, whatsapp } = await generateAIReply(`conv:comment:${commenterId}`, commentText, 150);

const finalText = whatsapp
? `${text} WhatsApp: ${WHATSAPP_NUMBER_DISPLAY}`
: text;

sendCommentReply(commentId, finalText);
}

async function sendRegionMenu(recipientId) {
const url = `https://graph.instagram.com/v21.0/me/messages`;

try {
await axios.post(
url,
{
recipient: { id: recipientId },
message: {
text: "Merhaba! Wintek'e hoş geldiniz! Size daha iyi yardımcı olabilmemiz için hangi bölgeden yazdığınızı öğrenebilir miyiz?",
quick_replies: [
{ content_type: "text", title: "Afyon", payload: "REGION_AFYON" },
{ content_type: "text", title: "Uşak", payload: "REGION_USAK" },
{ content_type: "text", title: "Isparta", payload: "REGION_ISPARTA" },
{ content_type: "text", title: "Burdur", payload: "REGION_BURDUR" },
{ content_type: "text", title: "Antalya", payload: "REGION_ANTALYA" },
{ content_type: "text", title: "Diğer", payload: "REGION_OTHER" },
],
},
},
{ params: { access_token: PAGE_ACCESS_TOKEN } }
);
console.log(`Bolge menusu gonderildi -> ${recipientId}`);
} catch (err) {
console.error(`Bolge menusu gonderilemedi -> ${recipientId}:`, err.response?.data || err.message);
}
}

async function sendNeedMenu(recipientId, region) {
const url = `https://graph.instagram.com/v21.0/me/messages`;

try {
await axios.post(
url,
{
recipient: { id: recipientId },
message: {
text: `${region} bölgesindesiniz, harika! Size nasıl yardımcı olabiliriz?`,
quick_replies: [
{ content_type: "text", title: "Satış Temsilcisi", payload: "NEED_REP" },
{ content_type: "text", title: "Mağaza Bilgisi", payload: "NEED_STORE" },
],
},
},
{ params: { access_token: PAGE_ACCESS_TOKEN } }
);
console.log(`Ihtiyac menusu gonderildi -> ${recipientId}`);
} catch (err) {
console.error(`Ihtiyac menusu gonderilemedi -> ${recipientId}:`, err.response?.data || err.message);
}
}

async function sendDirectReply(recipientId, text) {
const url = `https://graph.instagram.com/v21.0/me/messages`;

try {
await axios.post(
url,
{
recipient: { id: recipientId },
message: { text },
},
{
params: { access_token: PAGE_ACCESS_TOKEN },
}
);
console.log(`DM yaniti gonderildi -> ${recipientId}`);
} catch (err) {
console.error(
`DM yaniti gonderilemedi -> ${recipientId}:`,
err.response?.data || err.message
);
}
}

async function sendDirectReplyWithWhatsApp(recipientId, text) {
const url = `https://graph.instagram.com/v21.0/me/messages`;

try {
await axios.post(
url,
{
recipient: { id: recipientId },
message: {
attachment: {
type: "template",
payload: {
template_type: "button",
text: text.slice(0, 640),
buttons: [
{
type: "web_url",
url: WHATSAPP_LINK,
title: "WhatsApp'tan Yaz",
},
],
},
},
},
},
{
params: { access_token: PAGE_ACCESS_TOKEN },
}
);
console.log(`DM yaniti (WhatsApp butonlu) gonderildi -> ${recipientId}`);
} catch (err) {
console.error(
`DM yaniti (WhatsApp butonlu) gonderilemedi -> ${recipientId}:`,
err.response?.data || err.message
);
sendDirectReply(recipientId, `${text} WhatsApp: ${WHATSAPP_NUMBER_DISPLAY}`);
}
}

async function sendCommentReply(commentId, text) {
const url = `https://graph.instagram.com/v21.0/${commentId}/replies`;

try {
await axios.post(
url,
{ message: text },
{
params: { access_token: PAGE_ACCESS_TOKEN },
}
);
console.log(`Yorum yaniti gonderildi -> ${commentId}`);
} catch (err) {
console.error(
`Yorum yaniti gonderilemedi -> ${commentId}:`,
err.response?.data || err.message
);
}
}

app.listen(PORT, () => {
console.log(`Webhook sunucusu http://localhost:${PORT}/webhook adresinde calisiyor`);
});
