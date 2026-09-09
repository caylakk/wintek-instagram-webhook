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
    const matches = [...block.matchAll(/<image[^>]*>([\s\S]*?)<\/image>/gi)];
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

refreshProductCatalog().finally(() => {
    app.listen(PORT, () => {
        console.log(`Webhook sunucusu http://localhost:${PORT}/webhook adresinde calisiyor`);
    });
});

setInterval(refreshProductCatalog, PRODUCT_FEED_REFRESH_MS);
