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
      }
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
