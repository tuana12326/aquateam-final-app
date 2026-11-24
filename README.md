# AquaTeam Web Sitesi (Node.js + Express + SQLite + EJS)

Afyon Kocatepe Üniversitesi AquaTeam için gerçek müşteri web projesi (BİLP2135).

## Çalıştırma
Gereksinim: Node.js 22.13+ (yerleşik `node:sqlite` kullanılır).
```
npm install
npm start        # http://localhost:3000
```
Geliştirmede yönetici girişi: `admin` / `degistir` (üretimde mutlaka `ADMIN_PASS` tanımlayın).

## Ortam değişkenleri (hosting panelinde tanımlayın, repoya YAZMAYIN)
| Değişken | Açıklama |
|---|---|
| `NODE_ENV=production` | Üretim modu |
| `ADMIN_USER`, `ADMIN_PASS` | Yönetim paneli girişi (`ADMIN_PASS` yoksa üretimde giriş kapalı kalır) |
| `SESSION_SECRET` | Uzun rastgele metin |
| `DATA_DIR` | Kalıcı klasör (Azure: `/home/data`). Veritabanı + yüklenen dosyalar burada tutulur |
| `MAIL_TO` | Mesajların gideceği adres (varsayılan `aquateam0303@gmail.com`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | (Önerilen) Gmail uygulama şifresi ile doğrudan e-posta |
| `FORMSPREE_URL` | SMTP yoksa kullanılan yedek uç nokta (varsayılan: takımın mevcut sitesindeki) |

## E-posta akışı
İletişim / Sponsorluk teklif talebi / Üye başvurusu formları: doğrulama → veritabanına kayıt → takım e-postası.
Gönderim durumu yönetim panelinde (Mesajlar) görünür; başarısızlar 10 dakikada bir otomatik yeniden denenir, “Tekrar gönder” ile elle de denenebilir.
SMTP tanımlıysa gönderene otomatik onay e-postası da gider. Formspree kullanılacaksa, uç noktanın sahibi (takım) ilk gönderimdeki doğrulama e-postasını onaylamalıdır.

## Yönetim paneli (`/admin`)
Duyuru/blog, havuz testi günlüğü, galeri (foto/video/YouTube), sponsorlar, üyeler (CRUD) + Dosyalar (logo, sponsorluk PDF, `.glb`, CORAL arayüz görseli, basın kiti) + gelen mesajlar.
`model.glb` yüklenince Sistemler sayfasında “CAD modeli” sekmesi otomatik açılır.

## REST API (salt okunur)
`/api/posts`, `/api/tests`, `/api/gallery`, `/api/sponsors`, `/api/members`, `/api/<tablo>/<id>`

## Yapı
`server.js` (rotalar, CRUD, formlar) · `lib/mail.js` (e-posta) · `views/*.ejs` · `public/js/rov3d.js` (kütüphanesiz WebGL 3D görüntüleyici) · `public/js/forms.js` (istemci doğrulama)

## Marka kuralları (müşteri brief’i)
Mat siyah #050505 + AquaTeam mavisi #00a8ff; arka plan animasyonu/baloncuk/parçacık/radar/neon yok; TEKNOFEST başvuru ID’si ve bütçe/maliyet bilgisi sitede yok.
