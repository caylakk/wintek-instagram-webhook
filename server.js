require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ───────────────────────── Env vars ─────────────────────────
const {
    PAGE_ACCESS_TOKEN,
    VERIFY_TOKEN,
    IG_BUSINESS_ACCOUNT_ID,
    PORT = 3000,
} = process.env;

// ───────────────────────── GET /webhook — Doğrulama ─────────────────────────
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

          if (mode === "subscribe" && token === VERIFY_TOKEN) {
                console.log("✅ Webhook doğrulandı.");
                return res.status(200).send(challenge);
          }

          console.warn("⚠️ Webhook doğrulama başarısız. Token eşleşmedi.");
    return res.status(403).send("Forbidden");
});

// ───────────────────────── GET /privacy — Gizlilik Politikası ─────────────────────────
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
    <p>Bu veriler yalnizca gelen mesaj/yoruma otomatik bir karsilama yaniti gondermek amaciyla, Meta/Instagram Graph API uzerinden anlik olarak islenir. Veriler pazarlama, profil olusturma veya ucuncu taraflarla paylasim amaciyla kullanilmaz.</p>
    <h2>Veri Saklama</h2>
    <p>Islenen mesaj icerikleri kalici bir veritabaninda saklanmaz. Sunucu calisma gunluklerinde (log) teknik hata ayiklama amaciyla kisa sureligine tutulabilir ve duzenli olarak temizlenir.</p>
    <h2>Ucuncu Taraflarla Paylasim</h2>
    <p>Toplanan veriler, yanit gonderme islemini gerceklestirmek icin gereken Meta/Instagram Graph API cagrilari disinda hicbir ucuncu tarafla paylasilmaz veya satilmaz.</p>
    <h2>Veri Silme Talepleri</h2>
    <p>Verilerinizin silinmesini talep etmek icin asagidaki iletisim adresinden bize ulasabilirsiniz.</p>
    <h2>Iletisim</h2>
    <p>Sorulariniz icin: <a href="mailto:alkanedim@gmail.com">alkanedim@gmail.com</a></p>
    <footer>Son guncelleme: 6 Eylul 2026</footer>
    </body>
    </html>`);
});

// ───────────────────────── POST /webhook — Olaylar ─────────────────────────
app.post("/webhook", (req, res) => {
    // Meta'nın timeout'a düşmemesi için hemen 200 döndür
           res.status(200).send("EVENT_RECEIVED");

           const body = req.body;
    console.log("📥 RAW webhook body:", JSON.stringify(body));

           if (body.object !== "instagram") return;

           const entries = body.entry || [];

           for (const entry of entries) {
                 // ── DM (Direct Message) işleme ──
      const messagingEvents = entry.messaging || [];
                 for (const event of messagingEvents) {
                         handleDirectMessage(event);
                 }

      // ── Yorum (Comment) işleme ──
      const changes = entry.changes || [];
                 for (const change of changes) {
                         if (change.field === "comments") {
                                   handleComment(change.value);
                         } else if (change.field === "messages") { handleDirectMessage(change.value); }
                 }
           }
});

// ───────────────────────── DM İşleme ─────────────────────────
function handleDirectMessage(event) {
    const senderId = event.sender?.id;
    const message = event.message;

  // Kendi gönderdiğimiz mesajlara tekrar cevap verme
  if (!senderId || senderId === IG_BUSINESS_ACCOUNT_ID) return;

  // Echo (yankı) mesajlarını atla
  if (message?.is_echo) return;

  // Sadece metin mesajlarını işle (isteğe bağlı genişletilebilir)
  if (!message?.text) return;

  console.log(`📩 DM alındı — Gönderen: ${senderId}, Mesaj: "${message.text}"`);

  sendDirectReply(senderId, "Merhaba! Mesajınız için teşekkürler, en kısa sürede döneceğiz.");
}

// ───────────────────────── Yorum İşleme ─────────────────────────
function handleComment(value) {
    const commentId = value?.id;
    const commenterId = value?.from?.id;
    const commentText = value?.text;

  // Kendi yorumlarımıza tekrar cevap verme
  if (!commenterId || commenterId === IG_BUSINESS_ACCOUNT_ID) return;

  if (!commentId || !commentText) return;

  console.log(`💬 Yorum alındı — Yazan: ${commenterId}, Yorum: "${commentText}"`);

  sendCommentReply(commentId, "Merhaba! Mesajınız için teşekkürler, en kısa sürede döneceğiz.");
}

// ───────────────────────── Yanıt Gönderme Fonksiyonları ─────────────────────────

/**
 * Instagram DM üzerinden yanıt gönderir.
 * @param {string} recipientId — Alıcının IGSID'si
 * @param {string} text — Gönderilecek mesaj metni
 */
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
        console.log(`✅ DM yanıtı gönderildi → ${recipientId}`);
  } catch (err) {
        console.error(
                `❌ DM yanıtı gönderilemedi → ${recipientId}:`,
                err.response?.data || err.message
              );
  }
}

/**
 * Bir Instagram yorumuna yanıt gönderir.
 * @param {string} commentId — Yanıtlanacak yorumun ID'si
 * @param {string} text — Yanıt metni
 */
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
        console.log(`✅ Yorum yanıtı gönderildi → ${commentId}`);
  } catch (err) {
        console.error(
                `❌ Yorum yanıtı gönderilemedi → ${commentId}:`,
                err.response?.data || err.message
              );
  }
}

// ───────────────────────── Sunucuyu Başlat ─────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Webhook sunucusu http://localhost:${PORT}/webhook adresinde çalışıyor`);
});
