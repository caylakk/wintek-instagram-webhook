require("dotenv").config();
const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");
const { Redis } = require("@upstash/redis");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const {
    PAGE_ACCESS_TOKEN,
    VERIFY_TOKEN,
    IG_BUSINESS_ACCOUNT_ID,
    ANTHROPIC_API_KEY,
    UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN,
    TELEGRAM_BOT_TOKEN,
    RENDER_EXTERNAL_URL,
    ADMIN_ACCESS_KEY,
    ADMIN_TELEGRAM_CHAT_ID,
    PORT = 3000,
} = process.env;

const WHATSAPP_NUMBER_DISPLAY = "+90 533 556 62 10";
const WHATSAPP_NUMBER_DIGITS = "905335566210";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER_DIGITS}`;
const WHATSAPP_BUTTON_MARKER = "[[WHATSAPP_BUTTON]]";
const PUBLIC_URL = RENDER_EXTERNAL_URL || "https://wintek-instagram-webhook.onrender.com";

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
if (!TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN tanimli degil - Telegram entegrasyonu pasif.");
}
if (!ADMIN_ACCESS_KEY) {
    console.warn("ADMIN_ACCESS_KEY tanimli degil - toplu mesaj (broadcast) sayfasi pasif.");
}
if (!TELEGRAM_BOT_TOKEN || !ADMIN_TELEGRAM_CHAT_ID) {
    console.warn("TELEGRAM_BOT_TOKEN ve/veya ADMIN_TELEGRAM_CHAT_ID tanimli degil - admin bildirimleri pasif.");
}

const PRODUCT_FEED_URL = "https://winkelgroup.de/api/products/xml";
const PRODUCT_FEED_REFRESH_MS = 6 * 60 * 60 * 1000;
const PRODUCT_IMAGE_MARKER_REGEX = /\[\[PRODUCT_IMAGE:([A-Za-z0-9._-]+)\]\]/;

let productCatalog = [];
let productsWithImages = [];

function decodeCData(raw) {
    if (!raw) return "";
    const match = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
    return (match ? match[1] : raw).trim();
}

function extractTag(block, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = block.match(re);
    return match ? decodeCData(match[1]) : "";
}

function extractImages(block) {
    // (?=[\s>]) tag-siniri zorunlu kilar: <images> konteynir etiketini
    // <image ...> ile karistirmayi onler ("s" harfi [^>]* tarafindan yutulup
    // yanlislikla eslesmesin diye).
    const matches = [...block.matchAll(/<image(?=[\s>])[^>]*>([\s\S]*?)<\/image>/gi)];
    return matches
        .map((m) => decodeCData(m[1]))
        .filter((url) => url && /^https?:\/\//i.test(url));
}

function parseProductFeed(xml) {
    const blocks = xml.match(/<product[^>]*>[\s\S]*?<\/product>/gi) || [];
    return blocks
        .map((block) => ({
            barcode: extractTag(block, "barcode"),
            title: extractTag(block, "title"),
            category: extractTag(block, "categoryName"),
            description: extractTag(block, "description"),
            images: extractImages(block),
        }))
        .filter((p) => p.barcode && p.title);
}

async function refreshProductCatalog() {
    try {
        const res = await axios.get(PRODUCT_FEED_URL, { timeout: 20000 });
        const xml = typeof res.data === "string" ? res.data : String(res.data);
        productCatalog = parseProductFeed(xml);
        productsWithImages = productCatalog.filter((p) => p.images.length > 0);
        console.log(
            `Urun feed guncellendi: ${productCatalog.length} urun, ${productsWithImages.length} tanesinde foto var.`
        );
    } catch (err) {
        console.error("Urun feed alinamadi:", err.response?.data || err.message);
    }
}

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_HISTORY_MESSAGES = 12;
const FALLBACK_REPLY =
    "Merhaba! Mesajınız için teşekkürler, en kısa sürede döneceğiz.";

const WELCOME_MESSAGE =
    "Merhaba, Wintek'e hoş geldiniz. İş güvenliği ekipmanları ve endüstriyel el aletlerinin yanı sıra, WINKEL'in yetkili bayisi olarak sanayi, otomotiv ve denizcilik sektörlerine yönelik yapıştırıcı, yağlayıcı, sızdırmazlık ve yüzey bakım ürünleri sunuyoruz. Ürün ve hizmetlerimizle ilgili merak ettiğiniz her konuda size memnuniyetle yardımcı olalım.";

const BASE_SYSTEM_PROMPT = `Sen Wintek'in Instagram hesabı için çalışan bir müşteri asistanısın. Türkçe, samimi, kısa ve net cevaplar veriyorsun.

WINTEK NE SATAR:
- İş güvenliği ve el aletleri: iş eldivenleri, matkap uçları, sanayi için (demonte) çalışma tezgahları, akülü el aletleri ve benzeri endüstriyel ürünler.
- WINKEL markasının yetkili bayisi olarak (sanayi, otomotiv ve denizcilik sektörlerine yönelik):
  * Anaerobik ürünler: vida/dişli sabitleyiciler (PRO 2W43, 2W70, 2W77 serisi), boru dişli sızdırmazlık ürünleri (PRO 5W11, 5W72, 5W77, 5W42, 5W65 serisi ve WIN-LOCK sızdırmazlık ipi), flanş sızdırmazlık ürünleri (PRO 5W18, 5W10 serisi), kenetleyici/tutturucu ürünler (PRO 6W01, 6W20, 6W38, 6W41, 6W48 serisi) — titreşime, yağa ve yüksek sıcaklığa (150-230°C) dayanıklıdır.
  * Yapıştırıcılar: hızlı yapışan siyanoakrilat (süper) yapıştırıcılar (metal, MDF, kauçuk tipleri dahil), 2 bileşenli epoksi sistemler ve metal/çelik onarım macunları (PRO W-A, PRO Knead Steel/Water, PRO Metal Mix, ısıya dayanıklı şeffaf epoksi gibi), aşınmaya ve aside dayanıklı özel kaplamalar (PRO WINBACK serisi).
  * Elastik sızdırmazlık ürünleri: silikon sızdırmazlıklar (universal, nötr, yüksek ısı RTV silikon), poliüretan yapıştırıcı, sıvı conta, MS polimer bazlı sızdırmazlıklar, Hylomar tipi conta macunları.
  * Yağlayıcılar: yüksek sıcaklık gresleri (400°C-700°C'ye kadar, MoS2 içerikli), gıda sektörüne uygun (H1 sertifikalı) gresler ve silikon spreyler, deniz/gemi gresi, anti-seize bakır/alüminyum/seramik montaj pastaları, çok fonksiyonlu spreyler (yağlama + pas çözme + temizleme + nem giderme bir arada), zincir ve halat bakım spreyleri, PTFE kuru yağlayıcı sprey, grafitli gres sprey.
  * Metal kaplama, koruma ve yüzey işlem ürünleri: pas dönüştürücüler, koruyucu metal kaplamalar ve montaj pastaları.
  * Parça, yüzey ve el temizleyicileri; sprey boyalar.

KURALLAR:
1. Ürünler, kullanım alanları ve genel bilgilerle ilgili sorulara elinden geldiğince net ve yardımcı şekilde cevap ver.
2. STOK DURUMU veya KESİN FİYAT sorulduğunda: canlı stok/fiyat sistemine erişimin olmadığını unutma, bu yüzden kesin rakam veya "stokta var/yok" bilgisi UYDURMA. Bu durumlarda nazikçe kesin teyit için WhatsApp'tan iletişime geçmeyi öner (cevabında "WhatsApp'tan yazabilirsiniz" gibi bir ifade kullanabilirsin ama telefon numarasını asla yazma). Bu durumda, cevabının en sonuna başka hiçbir şey eklemeden tam olarak şu işareti ekle: ${WHATSAPP_BUTTON_MARKER}
3. Alakasız, uygunsuz ya da Wintek'in işiyle ilgisi olmayan taleplerde kibarca konuyu Wintek'in ürün/hizmetlerine getir ya da gerekiyorsa yukarıdaki WhatsApp yönlendirmesini (2. kuraldaki gibi) kullan.
4. Yanıtların Instagram DM/yorum ortamına uygun olsun: kısa (1-4 cümle), gereksiz uzatmadan, doğal bir müşteri temsilcisi tonunda. Emoji kullanımı ölçülü olsun, abartma.
5. Kendini yapay zeka olarak tanıtmana gerek yok, Wintek adına yazan doğal bir temsilci gibi davran.
6. Konuşmanın başında müşteriye otomatik bir karşılama mesajı zaten gönderiliyor. Bu yüzden sen ayrıca "hoş geldiniz", "merhaba" gibi bir karşılama cümlesiyle başlama; doğrudan müşterinin sorusuna veya talebine odaklan.`;

function buildSystemPrompt() {
    if (productsWithImages.length === 0) {
        return BASE_SYSTEM_PROMPT;
    }

    const lines = productsWithImages
        .map((p) => `- [${p.barcode}] ${p.title}`)
        .join("\n");

    const catalogSection = `

FOTOĞRAFI MEVCUT ÜRÜNLER (sadece bu listedeki ürünler için fotoğraf paylaşabilirsin):
${lines}

7. Müşteri yukarıdaki listede bulunan bir ürünü özellikle soruyorsa ve hangi ürünü kastettiğinden eminsen, cevabının en sonuna (varsa WhatsApp işaretinden sonra, ayrı bir satırda) tam olarak şu formatta ekle: [[PRODUCT_IMAGE:BARKOD]] — BARKOD yerine yukarıdaki listeden ilgili ürünün gerçek barkodunu yaz. Listede olmayan ya da hangi ürün olduğundan emin olmadığın durumlarda bu işareti KESİNLİKLE kullanma; bu durumda elinde o ürünün fotoğrafı olmadığını söyleyip normal şekilde yardımcı ol.`;

    return `${BASE_SYSTEM_PROMPT}${catalogSection}`;
}

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
    </ul>
    <h2>Veriler Ne Amacla Kullanilir?</h2>
    <p>Bu veriler, gelen mesaj/yoruma anlamli ve baglamsal bir yanit uretmek amaciyla Meta/Instagram Graph API ve Anthropic Claude API uzerinden islenir. Konusma baglamini surdurebilmek icin son mesajlar, kullaniciya ozel olarak, sifreli bir bulut veritabaninda (Upstash Redis) en fazla 7 gun sureyle saklanir ve bu surenin sonunda otomatik olarak silinir. Veriler pazarlama, profil olusturma veya ucuncu taraflarla paylasim amaciyla kullanilmaz.</p>
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

app.post("/webhook/telegram", (req, res) => {
    res.status(200).send("OK");

    handleTelegramMessage(req.body).catch((err) => {
        console.error("Telegram webhook hatasi:", err.message);
    });
});

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

async function generateAIReply(historyKey, userText, maxTokens) {
    if (!anthropic) return { text: FALLBACK_REPLY, whatsapp: false, productImageUrl: null };

const history = await getHistory(historyKey);
    const messages = [...history, { role: "user", content: userText }];

try {
    const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: buildSystemPrompt(),
        messages,
    });

    const rawText = (response.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

    if (!rawText) return { text: FALLBACK_REPLY, whatsapp: false, productImageUrl: null };

    const whatsapp = rawText.includes(WHATSAPP_BUTTON_MARKER);
    let cleanText = rawText.split(WHATSAPP_BUTTON_MARKER).join("").trim();

    let productImageUrl = null;
    const productMatch = cleanText.match(PRODUCT_IMAGE_MARKER_REGEX);
    if (productMatch) {
        const barcode = productMatch[1];
        const product = productsWithImages.find((p) => p.barcode === barcode);
        if (product && product.images.length > 0) {
            productImageUrl = product.images[0];
        }
        cleanText = cleanText.replace(PRODUCT_IMAGE_MARKER_REGEX, "").trim();
    }

    const finalText = cleanText || FALLBACK_REPLY;

    const updatedHistory = [...messages, { role: "assistant", content: finalText }];
    await saveHistory(historyKey, updatedHistory);

    return { text: finalText, whatsapp, productImageUrl };
} catch (err) {
    console.error("Claude API hatasi:", err.response?.data || err.message);
    return { text: FALLBACK_REPLY, whatsapp: false, productImageUrl: null };
}
}

async function handleDirectMessage(event) {
    const senderId = event.sender?.id;
    const message = event.message;

if (!senderId || senderId === IG_BUSINESS_ACCOUNT_ID) return;

if (message?.is_echo) return;

if (!message?.text) return;

console.log(`DM alindi - Gonderen: ${senderId}, Mesaj: "${message.text}"`);

const historyKey = `conv:dm:${senderId}`;
const existingHistory = await getHistory(historyKey);
if (existingHistory.length === 0) {
    await sendDirectReply(senderId, WELCOME_MESSAGE);
}

const { text, whatsapp, productImageUrl } = await generateAIReply(historyKey, message.text, 400);

if (whatsapp) {
    await sendDirectReplyWithWhatsApp(senderId, text);
    notifyAdmin(
        `🔔 <b>Stok/Fiyat Sorusu - Instagram DM</b>\n` +
        `Musteri: ${escapeHtml(senderId)}\n` +
        `Mesaj: ${escapeHtml(message.text)}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/dm/${encodeURIComponent(senderId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
} else {
    await sendDirectReply(senderId, text);
}

if (productImageUrl) {
    await sendDirectImage(senderId, productImageUrl);
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

if (whatsapp) {
    notifyAdmin(
        `🔔 <b>Stok/Fiyat Sorusu - Instagram Yorum</b>\n` +
        `Yazan: ${escapeHtml(commenterId)}\n` +
        `Yorum: ${escapeHtml(commentText)}\n\n` +
        `Konusmayi gor: ${PUBLIC_URL}/panel/comment/${encodeURIComponent(commenterId)}?key=${ADMIN_ACCESS_KEY || ""}`
    );
}
}

async function handleTelegramMessage(update) {
    const message = update?.message;
    const chatId = message?.chat?.id;
    const text = message?.text;

if (!chatId || !text) return;

console.log(`Telegram mesaji alindi - Chat: ${chatId}, Mesaj: "${text}"`);

const historyKey = `conv:telegram:${chatId}`;
const existingHistory = await getHistory(historyKey);

if (text.trim() === "/start") {
    if (existingHistory.length === 0) {
        await sendTelegramReply(chatId, WELCOME_MESSAGE);
    }
    return;
}

if (existingHistory.length === 0) {
    await sendTelegramReply(chatId, WELCOME_MESSAGE);
}

const { text: replyText, whatsapp, productImageUrl } = await generateAIReply(historyKey, text, 400);

if (whatsapp) {
    await sendTelegramReplyWithWhatsApp(chatId, replyText);
    notifyAdmin(
        `🔔 <b>Stok/Fiyat Sorusu - Telegram</b>\n` +
        `Musteri: ${escapeHtml(String(chatId))}\n` +
        `Mesaj: ${escapeHtml(text)}`
    );
} else {
    await sendTelegramReply(chatId, replyText);
}

if (productImageUrl) {
    await sendTelegramPhoto(chatId, productImageUrl);
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

async function sendDirectImage(recipientId, imageUrl) {
    const url = `https://graph.instagram.com/v21.0/me/messages`;

try {
    await axios.post(
        url,
        {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "image",
                    payload: {
                        url: imageUrl,
                        is_reusable: true,
                    },
                },
            },
        },
        {
            params: { access_token: PAGE_ACCESS_TOKEN },
        }
        );
    console.log(`Urun fotografi gonderildi -> ${recipientId}`);
} catch (err) {
    console.error(
        `Urun fotografi gonderilemedi -> ${recipientId}:`,
        err.response?.data || err.message
        );
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

async function sendTelegramReply(chatId, text) {
    if (!TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

try {
    await axios.post(url, {
        chat_id: chatId,
        text,
    });
    console.log(`Telegram yaniti gonderildi -> ${chatId}`);
} catch (err) {
    console.error(
        `Telegram yaniti gonderilemedi -> ${chatId}:`,
        err.response?.data || err.message
        );
}
}

async function sendTelegramReplyWithWhatsApp(chatId, text) {
    if (!TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

try {
    await axios.post(url, {
        chat_id: chatId,
        text,
        reply_markup: {
            inline_keyboard: [[{ text: "WhatsApp'tan Yaz", url: WHATSAPP_LINK }]],
        },
    });
    console.log(`Telegram yaniti (WhatsApp butonlu) gonderildi -> ${chatId}`);
} catch (err) {
    console.error(
        `Telegram yaniti (WhatsApp butonlu) gonderilemedi -> ${chatId}:`,
        err.response?.data || err.message
        );
    sendTelegramReply(chatId, `${text} WhatsApp: ${WHATSAPP_NUMBER_DISPLAY}`);
}
}

async function sendTelegramPhoto(chatId, photoUrl) {
    if (!TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;

try {
    await axios.post(url, {
        chat_id: chatId,
        photo: photoUrl,
    });
    console.log(`Telegram urun fotografi gonderildi -> ${chatId}`);
} catch (err) {
    console.error(
        `Telegram urun fotografi gonderilemedi -> ${chatId}:`,
        err.response?.data || err.message
        );
}
}

async function setupTelegramWebhook() {
    if (!TELEGRAM_BOT_TOKEN) return;

    const webhookUrl = `${PUBLIC_URL}/webhook/telegram`;

try {
    await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        params: { url: webhookUrl },
    });
    console.log(`Telegram webhook ayarlandi -> ${webhookUrl}`);
} catch (err) {
    console.error("Telegram webhook ayarlanamadi:", err.response?.data || err.message);
}
}

// Onemli bir olay (stok/fiyat sorusu -> WhatsApp yonlendirmesi gibi) oldugunda
// isletme sahibinin kendi Telegram hesabina anlik bildirim gonderir. Musteriye
// giden mesajlardan tamamen ayri, sadece admin'e (ADMIN_TELEGRAM_CHAT_ID) gider.
async function notifyAdmin(message) {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_TELEGRAM_CHAT_ID) return;

try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: ADMIN_TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
    });
} catch (err) {
    console.error("Admin bildirimi gonderilemedi:", err.response?.data || err.message);
}
}

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAllInstagramCustomerIds() {
    if (!redis) return [];
    try {
        const keys = await redis.keys("conv:dm:*");
        return keys.map((k) => k.replace(/^conv:dm:/, "")).filter(Boolean);
    } catch (err) {
        console.error("Musteri listesi alinamadi:", err.message);
        return [];
    }
}

// Normal sendDirectReply/sendDirectImage fonksiyonlari hata durumunu disariya
// dondurmuyor (sessizce logluyor); toplu gonderimde her alici icin gercek
// basari/hata durumunu raporlayabilmek icin ayri, durum donduren versiyonlar.
async function sendBroadcastToRecipient(recipientId, message, imageUrl) {
    const url = `https://graph.instagram.com/v21.0/me/messages`;

    try {
        await axios.post(
            url,
            {
                recipient: { id: recipientId },
                message: { text: message },
            },
            { params: { access_token: PAGE_ACCESS_TOKEN } }
        );
    } catch (err) {
        const reason = err.response?.data?.error?.message || err.message;
        return { ok: false, reason };
    }

    if (imageUrl) {
        try {
            await axios.post(
                url,
                {
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: "image",
                            payload: { url: imageUrl, is_reusable: true },
                        },
                    },
                },
                { params: { access_token: PAGE_ACCESS_TOKEN } }
            );
        } catch (err) {
            const reason = err.response?.data?.error?.message || err.message;
            return { ok: false, reason: `Metin gonderildi, resim basarisiz: ${reason}` };
        }
    }

    return { ok: true, reason: null };
}

async function broadcastToAllCustomers(message, imageUrl) {
    const recipientIds = await getAllInstagramCustomerIds();
    const results = [];
    let sent = 0;
    let failed = 0;

    for (const recipientId of recipientIds) {
        const result = await sendBroadcastToRecipient(recipientId, message, imageUrl);
        if (result.ok) {
            sent += 1;
        } else {
            failed += 1;
        }
        results.push({ recipientId, ...result });
        // Instagram Graph API rate limitine takilmamak icin gonderimler arasi kucuk bekleme.
        await sleep(300);
    }

    return { total: recipientIds.length, sent, failed, results };
}

function checkAdminKey(req, res) {
    if (!ADMIN_ACCESS_KEY) {
        res.status(503).send("ADMIN_ACCESS_KEY sunucuda tanimli degil. Once Render'da bu ortam degiskenini olusturun.");
        return false;
    }
    if (req.query.key !== ADMIN_ACCESS_KEY && req.body?.key !== ADMIN_ACCESS_KEY) {
        res.status(403).send("Yetkisiz erisim: gecersiz veya eksik anahtar.");
        return false;
    }
    return true;
}

app.get("/broadcast", (req, res) => {
    if (!checkAdminKey(req, res)) return;

    const key = escapeHtml(req.query.key);

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Toplu Mesaj Gonder - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.4em; }
    textarea { width: 100%; min-height: 140px; font-size: 1em; padding: 10px; box-sizing: border-box; }
    input[type=text] { width: 100%; font-size: 1em; padding: 10px; box-sizing: border-box; }
    label { display: block; margin-top: 16px; font-weight: bold; }
    button { margin-top: 20px; padding: 12px 24px; font-size: 1em; background: #d32f2f; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .warn { background: #fff4e5; border: 1px solid #ffb74d; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 0.92em; }
    </style>
    </head>
    <body>
    <h1>Instagram - Tum Musterilere Toplu Mesaj</h1>
    <div class="warn">
    <strong>Onemli:</strong> Bu mesaj, botla daha once konusmus olan <strong>tum</strong> Instagram musterilerine gonderilmeye calisilacak. Meta'nin kurallari geregi, son 24 saat icinde size yazmamis musterilere gonderim <strong>basarisiz olabilir</strong> — sistem bunu gizlemez, sonuc sayfasinda kime gidip kime gitmedigini gorursunuz. Gonderilen mesajlar geri alinamaz.
    </div>
    <form method="POST" action="/broadcast">
    <input type="hidden" name="key" value="${key}">
    <label for="message">Mesaj</label>
    <textarea name="message" id="message" required placeholder="Musterilere gonderilecek mesaji yazin..."></textarea>
    <label for="imageUrl">Resim URL (opsiyonel)</label>
    <input type="text" name="imageUrl" id="imageUrl" placeholder="https://... (bos birakilabilir)">
    <button type="submit">Tum Musterilere Gonder</button>
    </form>
    <p><a href="/panel?key=${key}">Musteri konusmalarini goruntule &rarr;</a></p>
    </body>
    </html>`);
});

app.post("/broadcast", async (req, res) => {
    if (!checkAdminKey(req, res)) return;

    const message = (req.body.message || "").trim();
    const imageUrl = (req.body.imageUrl || "").trim();
    const key = escapeHtml(req.query.key || req.body.key);

    if (!message) {
        res.status(400).send("Mesaj bos olamaz.");
        return;
    }

    console.log(`Toplu mesaj baslatildi. Uzunluk: ${message.length}, Resim: ${imageUrl ? "var" : "yok"}`);
    const summary = await broadcastToAllCustomers(message, imageUrl || null);
    console.log(`Toplu mesaj tamamlandi. Toplam: ${summary.total}, Basarili: ${summary.sent}, Basarisiz: ${summary.failed}`);

    const rows = summary.results
        .map(
            (r) =>
                `<tr><td>${escapeHtml(r.recipientId)}</td><td>${r.ok ? "Basarili" : "Basarisiz"}</td><td>${escapeHtml(r.reason || "")}</td></tr>`
        )
        .join("\n");

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Toplu Mesaj Sonucu - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.9em; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
    a { color: #1565c0; }
    </style>
    </head>
    <body>
    <h1>Toplu Mesaj Sonucu</h1>
    <p>Toplam alici: <strong>${summary.total}</strong> — Basarili: <strong>${summary.sent}</strong> — Basarisiz: <strong>${summary.failed}</strong></p>
    <table>
    <thead><tr><th>Alici ID</th><th>Durum</th><th>Not</th></tr></thead>
    <tbody>
    ${rows || "<tr><td colspan=\"3\">Kayitli musteri bulunamadi.</td></tr>"}
    </tbody>
    </table>
    <p><a href="/broadcast?key=${key}">&larr; Yeni mesaj gonder</a></p>
    </body>
    </html>`);
});

async function getConversationSummaries(prefix) {
    if (!redis) return [];
    try {
        const keys = await redis.keys(`${prefix}*`);
        const summaries = await Promise.all(
            keys.map(async (key) => {
                const id = key.slice(prefix.length);
                const history = await getHistory(key);
                const last = history[history.length - 1];
                return {
                    id,
                    messageCount: history.length,
                    lastRole: last?.role || null,
                    lastText: typeof last?.content === "string" ? last.content : "",
                };
            })
        );
        // Redis mesaj zaman damgasi tutmuyor, bu yuzden ID'ye gore alfabetik sirala.
        return summaries.sort((a, b) => a.id.localeCompare(b.id));
    } catch (err) {
        console.error("Konusma ozeti alinamadi:", err.message);
        return [];
    }
}

function renderPanelRows(summaries, type, key) {
    if (summaries.length === 0) {
        return `<tr><td colspan="4">Henuz kayitli konusma yok.</td></tr>`;
    }
    return summaries
        .map((s) => {
            const preview = escapeHtml((s.lastText || "").slice(0, 80)) + (s.lastText && s.lastText.length > 80 ? "..." : "");
            return `<tr>
                <td>${escapeHtml(s.id)}</td>
                <td>${s.messageCount}</td>
                <td>${preview}</td>
                <td><a href="/panel/${type}/${encodeURIComponent(s.id)}?key=${key}">Goruntule</a></td>
            </tr>`;
        })
        .join("\n");
}

function renderConversationThread(history) {
    if (!history || history.length === 0) {
        return `<p>Bu musteri icin kayitli mesaj yok.</p>`;
    }
    return history
        .map((m) => {
            const who = m.role === "user" ? "Musteri" : "Bot";
            const cls = m.role === "user" ? "msg-user" : "msg-bot";
            const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
            return `<div class="msg ${cls}"><div class="msg-role">${who}</div><div class="msg-text">${escapeHtml(text)}</div></div>`;
        })
        .join("\n");
}

app.get("/panel", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const key = escapeHtml(req.query.key);

    const [dmSummaries, commentSummaries] = await Promise.all([
        getConversationSummaries("conv:dm:"),
        getConversationSummaries("conv:comment:"),
    ]);

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Musteri Konusmalari - Wintek</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.4em; }
    h2 { font-size: 1.1em; margin-top: 2em; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.9em; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    a { color: #1565c0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nav { margin-top: 24px; font-size: 0.9em; }
    </style>
    </head>
    <body>
    <h1>Instagram Musteri Konusmalari</h1>

    <h2>Direkt Mesajlar (DM)</h2>
    <table>
    <thead><tr><th>Musteri ID</th><th>Mesaj Sayisi</th><th>Son Mesaj</th><th></th></tr></thead>
    <tbody>${renderPanelRows(dmSummaries, "dm", key)}</tbody>
    </table>

    <h2>Gonderi Yorumlari</h2>
    <table>
    <thead><tr><th>Yorum Yapan ID</th><th>Mesaj Sayisi</th><th>Son Mesaj</th><th></th></tr></thead>
    <tbody>${renderPanelRows(commentSummaries, "comment", key)}</tbody>
    </table>

    <div class="nav"><a href="/broadcast?key=${key}">&larr; Toplu mesaj sayfasina git</a></div>
    </body>
    </html>`);
});

app.get("/panel/:type/:id", async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    const { type, id } = req.params;
    if (type !== "dm" && type !== "comment") {
        res.status(404).send("Gecersiz konusma turu.");
        return;
    }
    const key = escapeHtml(req.query.key);
    const historyKey = `conv:${type}:${id}`;
    const history = await getHistory(historyKey);

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
    <html lang="tr">
    <head>
    <meta charset="UTF-8">
    <title>Konusma - ${escapeHtml(id)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
    h1 { font-size: 1.2em; word-break: break-all; }
    .msg { margin: 14px 0; padding: 10px 14px; border-radius: 10px; max-width: 80%; white-space: pre-wrap; }
    .msg-user { background: #f1f1f1; margin-right: auto; }
    .msg-bot { background: #e3f2fd; margin-left: auto; text-align: right; }
    .msg-role { font-size: 0.75em; color: #777; margin-bottom: 4px; }
    a { color: #1565c0; }
    </style>
    </head>
    <body>
    <h1>Konusma: ${escapeHtml(id)}</h1>
    <p><a href="/panel?key=${key}">&larr; Tum konusmalara don</a></p>
    ${renderConversationThread(history)}
    </body>
    </html>`);
});

Promise.all([refreshProductCatalog(), setupTelegramWebhook()]).finally(() => {
    app.listen(PORT, () => {
        console.log(`Webhook sunucusu http://localhost:${PORT}/webhook adresinde calisiyor`);
    });
});

setInterval(refreshProductCatalog, PRODUCT_FEED_REFRESH_MS);
