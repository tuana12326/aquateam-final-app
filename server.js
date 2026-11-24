// AquaTeam web sitesi – Node.js + Express + SQLite (yerleşik node:sqlite) + EJS
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const mail = require('./lib/mail');

const PROD = process.env.NODE_ENV === 'production';

/* ------------------------------------------------------------------ */
/* Veritabanı                                                          */
/* ------------------------------------------------------------------ */
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP = path.join(DATA, 'uploads');
fs.mkdirSync(UP, { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'site.db'));

const P = ['title_tr', 'title_en', 'body_tr', 'body_en', 'date'];
// Yönetim panelinden CRUD yapılan tablolar ve sütunları (tablo adları SQL'e yalnızca bu listeden girer)
const S = {
  posts: P,
  tests: P,
  gallery: ['caption_tr', 'caption_en', 'url'],
  sponsors: ['name', 'link', 'logo'],
  members: ['name', 'role_tr', 'role_en', 'dept', 'grade', 'linkedin', 'alumni']
};
const UPL = { gallery: 'url', sponsors: 'logo' }; // dosya yüklenince hangi sütuna yazılır
const LBL = { posts: 'Duyuru / Blog', tests: 'Havuz Testi Günlüğü', gallery: 'Galeri (foto / video)', sponsors: 'Sponsorlar', members: 'Üyeler' };
// Panelden yüklenen sabit adlı dosyalar (logo, PDF, .glb, CORAL arayüz görseli, basın kiti)
const FILES = { logo: 'logo.png', sponsor: 'sponsorluk.pdf', model: 'model.glb', coral: 'coral.png', presskit: 'basin-kiti.zip' };

for (const t in S) db.exec(`CREATE TABLE IF NOT EXISTS ${t}(id INTEGER PRIMARY KEY AUTOINCREMENT,${S[t].map(c => c + ' TEXT').join(',')})`);
db.exec('CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,data TEXT,created TEXT)');
// Eski veritabanlarını yükselt: e-posta gönderim durumu
const cols = db.prepare('PRAGMA table_info(messages)').all().map(c => c.name);
if (!cols.includes('status')) db.exec("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'pending'");
if (!cols.includes('note')) db.exec('ALTER TABLE messages ADD COLUMN note TEXT');

const all = (t, order = 'id DESC') => db.prepare(`SELECT * FROM ${t} ORDER BY ${order}`).all();

/* ---- Başlangıç verisi: takımın mevcut sitesindeki gerçek bilgiler ---- */
if (!db.prepare('SELECT 1 FROM posts').get()) {
  db.prepare('INSERT INTO posts(title_tr,title_en,body_tr,body_en,date) VALUES(?,?,?,?,?)').run(
    'Yeni web sitemiz yayında', 'Our new website is live',
    'Yönetim panelinden duyuru, test günlüğü, galeri, sponsor ve üye bilgilerini artık kod yazmadan güncelleyebiliyoruz.',
    'We can now update announcements, test logs, gallery, sponsors and members from the admin panel without touching code.',
    '2026-11-22');
}
if (!db.prepare('SELECT 1 FROM members').get()) {
  const ins = db.prepare('INSERT INTO members(name,role_tr,role_en,dept,grade,linkedin,alumni) VALUES(?,?,?,?,?,?,?)');
  const E = 'Elektrik-Elektronik Müh. 3. Sınıf', B = 'Bilgisayar Müh. 2. Sınıf', M = 'Makine Müh. 2. Sınıf', L = 'https://www.linkedin.com/in/';
  for (const m of [
    ['Enes Alver', 'Takım Kaptanı / As Pilot', 'Team Captain / Co-Pilot', 'kaptan,pilot', E, L + 'enes-alver/'],
    ['Muhammed Emir Aydın', 'Arayüz Geliştirme (CORAL Arayüz)', 'Interface Development (CORAL Interface)', 'yazilim', E, L + 'muhammed-emir-aydın/'],
    ['Eslem Serra Saatçi', 'Görüntü İşleme (CLAHE / YOLOv9)', 'Image Processing (CLAHE / YOLOv9)', 'yazilim', B, L + 'eslem-serra-saatci-030978386/'],
    ['Betül Kaya', 'Görüntü İşleme (OpenCV / AI)', 'Image Processing (OpenCV / AI)', 'yazilim', B, L + 'betül-kaya-b9695738b/'],
    ['Samet Karakaş', 'Otonom Programlama (Pymavlink)', 'Autonomous Programming (Pymavlink)', 'yazilim', 'Otonom 2. Sınıf', L + 'samet-karakaş-2545863a3/'],
    ['Rahmi Yerlikaya', 'Mekanik Tasarım (SOLIDWORKS) / Test Mühendisi', 'Mechanical Design (SOLIDWORKS) / Test Engineer', 'mekanik,test', M, L + 'rahmi-yerlikaya-891877396/'],
    ['Batuhan Enes Demir', 'Mekanik Tasarım & Analiz', 'Mechanical Design & Analysis', 'mekanik', M, L + 'batuhanenesdemir/'],
    ['Oğuzhan Koçdemir', 'Parça Üretim & Montaj', 'Part Manufacturing & Assembly', 'mekanik', E, L + 'oguzhan-kocdemir/'],
    ['Hüseyin Efe Düztaş', 'Elektronik & PCB Tasarımı / Yedek Pilot', 'Electronics & PCB Design / Backup Pilot', 'elektronik,pilot', E, L + 'huseyin-efe-duztas/'],
    ['Ahmet Bilgiç', 'Güç Sistemleri & Regülasyon', 'Power Systems & Regulation', 'elektronik', E, L + 'ahmet-bilgiç-174b42325/'],
    ['Abdulkadir Küçükapan', 'Sensör Entegrasyon / Test Mühendisi', 'Sensor Integration / Test Engineer', 'elektronik,test', E, L + 'abdulkadir-küçükapan-057931330/'],
    ['Mustafa Berk Türkal', 'Sensör Entegrasyon / Test Mühendisi', 'Sensor Integration / Test Engineer', 'elektronik,test', E, L + 'mustafaberkturkal/'],
    ['Özge Zeynep Keskin', 'Sensör Entegrasyon', 'Sensor Integration', 'elektronik', E, L + 'özge-keskin-54440439b/'],
    ['Cemalettin Akdoğan', 'Akademik Danışman', 'Academic Advisor', 'danisman', 'Öğr. Gör. · Afyon Kocatepe Üniversitesi', L + 'cemalettin-akdoğan-53209717b/']
  ]) ins.run(...m, '');
}
if (!db.prepare('SELECT 1 FROM gallery').get()) {
  const g = db.prepare('INSERT INTO gallery(caption_tr,caption_en,url) VALUES(?,?,?)');
  g.run('CORAL Ana ROV havuz kenarında test hazırlığında', 'CORAL Main ROV preparing for a pool test', '/img/hero-bg.jpg');
  g.run('Takım atölye çalışması', 'Team workshop session', '/img/team-work.jpg');
}

/* ------------------------------------------------------------------ */
/* Uygulama ayarları                                                   */
/* ------------------------------------------------------------------ */
// Yönetici şifresi yalnızca ortam değişkeninden okunur (repoda şifre yok).
// Üretimde ADMIN_PASS tanımlı değilse yönetim paneli girişi kapalı kalır.
const ADMIN_PASS = process.env.ADMIN_PASS || (PROD ? '' : 'degistir');
const HASH = ADMIN_PASS ? bcrypt.hashSync(ADMIN_PASS, 10) : null;
if (!ADMIN_PASS) console.warn('UYARI: ADMIN_PASS tanımlı değil, yönetim paneli girişi kapalı.');

// Sitede kullanılan gerçek iletişim bilgileri (takımın mevcut sitesinden)
const SITE = {
  email: 'aquateam0303@gmail.com',
  captain: { name: 'Enes Alver', email: 'enesalver28@gmail.com' },
  address: 'Afyon Kocatepe Üniversitesi, Ahmet Necdet Sezer Kampüsü, Afyonkarahisar',
  lat: 38.81125, lng: 30.53557,
  mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1554.4629498927072!2d30.535566702374584!3d38.81125113886308!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14cf18726a482d59%3A0xc62a11f97058a59b!2sAfyon%20Kocatepe%20%C3%9Cniversitesi%20Ahmet%20Necdet%20Sezer%20Kamp%C3%BCs%C3%BC!5e0!3m2!1str!2str!4v1769026708199!5m2!1str!2str',
  mapLink: 'https://www.google.com/maps/search/?api=1&query=Afyon+Kocatepe+%C3%9Cniversitesi+Ahmet+Necdet+Sezer+Kamp%C3%BCs%C3%BC',
  social: {
    LinkedIn: 'https://www.linkedin.com/company/aquateam-aku',
    Instagram: 'https://www.instagram.com/aquateam_rov',
    YouTube: 'https://www.youtube.com/@AquaTeam03',
    GitHub: 'https://github.com/AquaTeam-03'
  }
};
// Teklif formundaki paket seçenekleri (finansal rakam içermez)
const PACKAGES = ['platin', 'altin', 'gumus', 'ayni', 'dosya'];

const OKEXT = /\.(png|jpe?g|webp|gif|mp4)$/i;
const up = multer({
  storage: multer.diskStorage({ destination: UP, filename: (q, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: 25e6 }, fileFilter: (q, f, cb) => cb(null, OKEXT.test(f.originalname))
});
const fileUp = multer({
  storage: multer.diskStorage({ destination: UP, filename: (q, f, cb) => cb(null, FILES[f.fieldname]) }),
  limits: { fileSize: 60e6 }
});
const safeUrl = (u) => (/^(https?:\/\/|\/uploads\/|\/img\/)/i.test(u) ? u : '');

const app = express();
app.set('view engine', 'ejs');
app.set('trust proxy', 1);
app.disable('x-powered-by');
Object.assign(app.locals, { S, LBL, FILES, SITE });

app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
  next();
});
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: PROD ? '7d' : 0 }));
app.use('/uploads', express.static(UP, { maxAge: PROD ? '1d' : 0 }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: PROD }
}));

// Her istekte: dil, yardımcı fonksiyonlar ve (varsa) form hata/geri bildirimleri
app.use((req, res, next) => {
  const lang = /(?:^|;\s*)lang=en/.test(req.headers.cookie || '') ? 'en' : 'tr';
  const flash = req.session.flash; delete req.session.flash;
  Object.assign(res.locals, {
    lang, q: req.query, title: '', flash: flash || null, path: req.path,
    x: (a, b) => (lang === 'tr' ? a : b),                       // metin seçici (TR/EN)
    f: (r, k) => r[k + '_' + lang] || r[k + '_tr'] || '',        // çift dilli alan seçici
    has: (n) => fs.existsSync(path.join(UP, n)),                 // yüklenmiş dosya var mı
    yt: (u) => (String(u).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1] // YouTube video kimliği
  });
  next();
});

app.get('/lang/:l', (req, res) => {
  res.cookie('lang', req.params.l === 'en' ? 'en' : 'tr', { maxAge: 3e10, sameSite: 'lax' });
  let back = '/';
  try { const u = new URL(req.get('referer') || '', 'http://' + req.get('host')); if (u.host === req.get('host')) back = u.pathname + u.search + u.hash; } catch (e) { /* ana sayfa */ }
  res.redirect(back);
});
app.get('/healthz', (q, r) => r.send('ok'));

/* ------------------------------------------------------------------ */
/* Herkese açık sayfalar                                               */
/* ------------------------------------------------------------------ */
const page = (name, title, data = () => ({})) =>
  app.get(name === 'home' ? '/' : '/' + name, (req, res) => res.render(name, { title, ...data(req) }));

page('home', 'AquaTeam', () => ({ posts: all('posts', 'date DESC').slice(0, 3), tests: all('tests', 'date DESC').slice(0, 3), sponsors: all('sponsors') }));
page('systems', 'Sistemler / Systems');
page('missions', 'Görevler & Test / Missions & Tests');
page('media', 'Medya / Media', () => ({ g: all('gallery') }));
page('sponsor', 'Sponsorluk / Sponsorship', (req) => ({ sponsors: all('sponsors'), pkg: PACKAGES.includes(req.query.paket) ? req.query.paket : '' }));
page('team', 'Ekibimiz / Team', () => ({ m: all('members', 'dept,name') }));
page('contact', 'İletişim / Contact');
app.get('/game', (req, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')));

// Arama destekli liste sayfaları (blog / test günlüğü)
const list = (kind, title) => (req, res) => {
  const s = String(req.query.s || '').trim().slice(0, 60), l = '%' + s + '%';
  const rows = s
    ? db.prepare(`SELECT * FROM ${kind} WHERE title_tr LIKE ? OR title_en LIKE ? OR body_tr LIKE ? OR body_en LIKE ? ORDER BY date DESC`).all(l, l, l, l)
    : all(kind, 'date DESC');
  res.render('list', { title, kind, rows, s });
};
app.get('/blog', list('posts', 'Blog'));
app.get('/tests', list('tests', 'Test'));

// Salt okunur REST API (JSON)
app.get('/api/:t', (req, res) => (S[req.params.t] ? res.json(all(req.params.t, 'id')) : res.status(404).json({ error: 'not found' })));
app.get('/api/:t/:id', (req, res) => {
  const r = S[req.params.t] && db.prepare(`SELECT * FROM ${req.params.t} WHERE id=?`).get(req.params.id);
  r ? res.json(r) : res.status(404).json({ error: 'not found' });
});

/* ------------------------------------------------------------------ */
/* Formlar: doğrulama → veritabanı → takım e-postası                   */
/* ------------------------------------------------------------------ */
const FORMS = {
  contact: { fields: ['name', 'email', 'message'], back: '/contact', needMsg: true },
  sponsor: { fields: ['name', 'email', 'company', 'phone', 'package', 'message'], back: '/sponsor', anchor: '#teklif', needMsg: false },
  apply: { fields: ['name', 'email', 'dept', 'grade', 'message'], back: '/team', anchor: '#apply', needMsg: true }
};
const hits = new Map(); // IP başına basit hız sınırı: 10 dakikada en çok 6 gönderim
const limited = (ip, max = 6, win = 6e5) => { const n = Date.now(), a = (hits.get(ip) || []).filter(t => n - t < win); a.push(n); hits.set(ip, a); return a.length > max; };

function validate(kind, d) {
  const F = FORMS[kind], e = [];
  if (d.name.length < 2) e.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e.push('email');
  if (kind === 'sponsor') { if (d.company.length < 2) e.push('company'); if (d.package && !PACKAGES.includes(d.package)) e.push('package'); if (d.phone && !/^[+\d\s()-]{7,20}$/.test(d.phone)) e.push('phone'); }
  if (kind === 'apply') { if (!d.dept) e.push('dept'); if (d.grade.length < 3) e.push('grade'); }
  if ((F.needMsg && d.message.length < 5) || (d.message && d.message.length > 2000)) e.push('message');
  return e;
}
async function sendAndStore(id, kind, d, lang) {
  const r = await mail.deliver(kind, d, lang);
  db.prepare('UPDATE messages SET status=?,note=? WHERE id=?').run(r.ok ? 'sent' : 'failed', r.ok ? r.via : r.via + ': ' + r.error, id);
  if (!r.ok) console.error('E-posta gönderilemedi:', r.error);
  return r.ok;
}
app.post('/form/:k', async (req, res) => {
  const k = req.params.k, F = FORMS[k];
  if (!F) return res.sendStatus(404);
  if (req.body.website) return res.redirect(F.back + '?ok=1'); // bot tuzağı (gizli alan)
  const d = Object.fromEntries(F.fields.map(n => [n, String(req.body[n] || '').trim().slice(0, 2000)]));
  const errors = validate(k, d);
  if (errors.length || limited(req.ip)) {
    req.session.flash = { values: d, errors: errors.length ? errors : ['rate'] };
    return res.redirect(F.back + '?err=1' + (F.anchor || '#f'));
  }
  const id = db.prepare('INSERT INTO messages(kind,data,created,status) VALUES(?,?,?,?)').run(k, JSON.stringify(d), new Date().toISOString(), 'pending').lastInsertRowid;
  await sendAndStore(id, k, d, res.locals.lang); // sonuç veritabanında; kullanıcıya her durumda alındı bilgisi verilir
  res.redirect(F.back + '?ok=1' + (F.anchor || '#f'));
});
// Gönderilemeyen mesajları 10 dakikada bir yeniden dene
setInterval(async () => {
  for (const m of db.prepare("SELECT * FROM messages WHERE status='failed' ORDER BY id LIMIT 10").all()) await sendAndStore(m.id, m.kind, JSON.parse(m.data), 'tr');
}, 6e5).unref();

app.get('/download/:n', (req, res) => {
  const n = FILES[req.params.n];
  if (!n) return res.sendStatus(404);
  const u = path.join(UP, n), d = path.join(__dirname, 'public', 'downloads', n);
  const nice = { sponsor: 'AquaTeam-Sponsorluk-Dosyasi.pdf', presskit: 'AquaTeam-Basin-Kiti.zip' }[req.params.n] || n;
  fs.existsSync(u) ? res.download(u, nice) : fs.existsSync(d) ? res.download(d, nice) : res.sendStatus(404);
});

/* ------------------------------------------------------------------ */
/* Yönetim paneli                                                      */
/* ------------------------------------------------------------------ */
const fails = new Map(); // giriş denemesi sınırı: 15 dakikada 6 hatalı deneme
app.get('/admin/login', (q, r) => r.render('admin_login', { title: 'Giriş', disabled: !HASH }));
app.post('/admin/login', (req, res) => {
  const n = Date.now(), a = (fails.get(req.ip) || []).filter(t => n - t < 9e5);
  if (!HASH || a.length >= 6) return res.redirect('/admin/login?err=1');
  if (req.body.u === (process.env.ADMIN_USER || 'admin') && bcrypt.compareSync(req.body.p || '', HASH)) {
    fails.delete(req.ip); req.session.admin = 1; return res.redirect('/admin');
  }
  a.push(n); fails.set(req.ip, a); res.redirect('/admin/login?err=1');
});
app.use('/admin', (req, res, next) => (req.session.admin ? next() : res.redirect('/admin/login')));
app.post('/admin/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/admin', (q, r) => r.render('admin', { title: 'Admin', mode: 'home', msgs: all('messages').map(m => ({ ...m, d: JSON.parse(m.data) })) }));
app.post('/admin/messages/:id/retry', async (req, res) => {
  const m = db.prepare('SELECT * FROM messages WHERE id=?').get(req.params.id);
  if (m) await sendAndStore(m.id, m.kind, JSON.parse(m.data), 'tr');
  res.redirect('/admin');
});
app.post('/admin/messages/:id/delete', (req, res) => { db.prepare('DELETE FROM messages WHERE id=?').run(req.params.id); res.redirect('/admin'); });
app.get('/admin/files', (q, r) => r.render('admin', { title: 'Dosyalar', mode: 'files' }));
app.post('/admin/files', fileUp.fields(Object.keys(FILES).map(name => ({ name, maxCount: 1 }))), (q, r) => r.redirect('/admin/files?ok=1'));

app.param('t', (req, res, next, v) => (S[v] ? next() : res.sendStatus(404)));
app.get('/admin/:t', (req, res) => res.render('admin', { title: LBL[req.params.t], mode: 'list', t: req.params.t, rows: all(req.params.t) }));
app.get('/admin/:t/form/:id?', (req, res) => {
  const t = req.params.t;
  const row = req.params.id ? db.prepare(`SELECT * FROM ${t} WHERE id=?`).get(req.params.id) || {} : {};
  res.render('admin', { title: LBL[t], mode: 'form', t, row });
});
app.post('/admin/:t/save', up.single('file'), (req, res) => {
  const t = req.params.t, c = S[t], b = req.body, id = b.id;
  const v = c.map(k => String(b[k] || '').trim().slice(0, 4000));
  for (const k of ['link', 'url', 'linkedin']) if (c.includes(k)) v[c.indexOf(k)] = safeUrl(v[c.indexOf(k)]);
  if (req.file && UPL[t]) v[c.indexOf(UPL[t])] = '/uploads/' + req.file.filename;
  if (!v[0]) return res.redirect(`/admin/${t}/form/${id || ''}?err=1`);
  if (id) db.prepare(`UPDATE ${t} SET ${c.map(k => k + '=?').join()} WHERE id=?`).run(...v, id);
  else db.prepare(`INSERT INTO ${t}(${c.join()}) VALUES(${c.map(() => '?').join()})`).run(...v);
  res.redirect('/admin/' + t);
});
app.post('/admin/:t/:id/delete', (req, res) => { db.prepare(`DELETE FROM ${req.params.t} WHERE id=?`).run(req.params.id); res.redirect('/admin/' + req.params.t); });

app.listen(process.env.PORT || 3000, () => console.log('AquaTeam çalışıyor'));
