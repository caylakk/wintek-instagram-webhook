# wintek-instagram-webhook

Instagram DM ve yorum oto-cevap webhook (Meta Graph API)

## Özellikler

- **DM Otomatik Yanıt**: Gelen Instagram Direct mesajlarına otomatik cevap gönderir.
- **Yorum Otomatik Yanıt**: Gönderilere gelen yorumlara otomatik cevap gönderir.
- **Döngü Koruması**: Kendi gönderdiğimiz mesaj/yorumlara tekrar cevap vermez.
- **Hızlı Yanıt**: POST isteklerini hemen 200 ile yanıtlar, işlemi arka planda yapar (Meta timeout koruması).

## Kurulum

### 1. Bağımlılıkları yükle

```bash
npm install
```

### 2. Ortam değişkenlerini ayarla

`.env.example` dosyasını kopyalayıp `.env` olarak adlandır ve değerleri doldur:

```bash
cp .env.example .env
```

| Değişken                | Açıklama                                           |
|-------------------------|----------------------------------------------------|
| `PAGE_ACCESS_TOKEN`     | Meta uygulamasından alınan sayfa erişim tokeni      |
| `VERIFY_TOKEN`          | Webhook doğrulaması için belirlediğin gizli anahtar |
| `APP_SECRET`            | Meta uygulamasının secret anahtarı                  |
| `IG_BUSINESS_ACCOUNT_ID`| Instagram Business hesap ID'si                      |
| `PORT`                  | Sunucu portu (varsayılan: 3000)                     |

### 3. Sunucuyu başlat

```bash
npm start
```

Sunucu `http://localhost:3000/webhook` adresinde çalışacak.

## Deploy (Render)

Bu uygulama **Render** üzerinde Web Service olarak deploy edilecektir:

1. Render'da yeni bir **Web Service** oluştur.
2. Bu GitHub reposunu bağla.
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment Variables** bölümüne `.env` değişkenlerini ekle.
6. Meta Developer panelinden webhook URL'ini `https://<render-adresi>/webhook` olarak ayarla.

## Meta Uygulama Ayarları

1. [Meta for Developers](https://developers.facebook.com/) paneline git.
2. Uygulamana Instagram Graph API ürününü ekle.
3. Webhook ayarlarında:
   - **Callback URL**: `https://<render-adresi>/webhook`
   - **Verify Token**: `.env`'deki `VERIFY_TOKEN` ile aynı değer
   - **Subscriptions**: `messages`, `comments` alanlarını seç.
