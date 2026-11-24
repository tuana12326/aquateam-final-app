// Form mesajlarını takım e-postasına ulaştıran modül.
// 1) SMTP_* ortam değişkenleri tanımlıysa nodemailer ile doğrudan takım e-postasına gönderir.
// 2) Tanımlı değilse Formspree (AquaTeam'in mevcut sitesinde kullandığı uç nokta) üzerinden gönderir.
// Her iki yolda da sonuç { ok, via, error } olarak döner; çağıran taraf sonucu veritabanına yazar.
const TO = process.env.MAIL_TO || 'aquateam0303@gmail.com';
const FORMSPREE = process.env.FORMSPREE_URL || 'https://formspree.io/f/mbddaqbn';

const KIND = { contact: 'İletişim', sponsor: 'Sponsorluk teklif talebi', apply: 'Üye başvurusu' };
const LABEL = { name: 'Ad Soyad', email: 'E-posta', company: 'Kurum / Firma', phone: 'Telefon', package: 'Paket', dept: 'Departman', grade: 'Bölüm / Sınıf', message: 'Mesaj' };

const PKG = { platin: 'Platin Sponsorluk', altin: 'Altın Sponsorluk', gumus: 'Gümüş Sponsorluk', ayni: 'Ayni / Teknik Destek', dosya: 'Sponsorluk Dosyası Talebi' };
function subjectOf(kind, d) {
  const extra = kind === 'sponsor' ? ' – ' + (PKG[d.package] || 'Genel') + ' – ' + (d.company || '') : ' – ' + d.name;
  return '[AquaTeam Web] ' + (KIND[kind] || kind) + extra;
}
function bodyOf(kind, d) {
  return Object.entries(d).filter(([, v]) => v).map(([k, v]) => (LABEL[k] || k) + ': ' + (k === 'package' ? PKG[v] || v : v)).join('\n');
}

let transport = null;
function smtp() {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) {
    transport = require('nodemailer').createTransport({
      host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
      secure: +process.env.SMTP_PORT === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transport;
}

async function deliver(kind, d, lang) {
  const subject = subjectOf(kind, d), text = bodyOf(kind, d);
  try {
    const t = smtp();
    if (t) {
      await t.sendMail({ from: process.env.SMTP_USER, to: TO, replyTo: d.email, subject, text });
      // Gönderene otomatik onay (yalnızca SMTP ile mümkün)
      t.sendMail({
        from: process.env.SMTP_USER, to: d.email,
        subject: lang === 'en' ? 'We received your message – AquaTeam' : 'Mesajınız alındı – AquaTeam',
        text: lang === 'en'
          ? 'Hello ' + d.name + ',\n\nYour message has reached the AquaTeam. We will get back to you soon.\n\nAquaTeam – Afyon Kocatepe University'
          : 'Merhaba ' + d.name + ',\n\nMesajınız AquaTeam’e ulaştı. En kısa sürede size dönüş yapacağız.\n\nAquaTeam – Afyon Kocatepe Üniversitesi'
      }).catch(() => {});
      return { ok: true, via: 'smtp' };
    }
    const r = await fetch(FORMSPREE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...d, package: PKG[d.package] || d.package, _subject: subject, _replyto: d.email })
    });
    if (!r.ok) {
      let msg = ''; try { msg = (await r.json()).error || ''; } catch (e) { /* yoksay */ }
      return { ok: false, via: 'formspree', error: 'HTTP ' + r.status + ' ' + msg };
    }
    return { ok: true, via: 'formspree' };
  } catch (e) {
    return { ok: false, via: t_or(), error: String(e.message || e).slice(0, 200) };
  }
}
const t_or = () => (process.env.SMTP_HOST ? 'smtp' : 'formspree');

module.exports = { deliver, subjectOf, bodyOf, TO };
