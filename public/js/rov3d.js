/* AquaTeam – CORAL Ana ROV temsili 3D görüntüleyici
   Harici kütüphane yok: saf WebGL. Ölçüler KTR verisine göre (386 × 340 × 205 mm), 1 birim = 100 mm.
   Bu model TEMSİLİDİR; gerçek CAD (.glb) yüklenince sistem sayfasında o gösterilir. */
(function () {
  'use strict';
  function init(root) {
  if (root.dataset.ready) return; root.dataset.ready = '1';
  const TR = root.dataset.lang !== 'en';
  const canvas = root.querySelector('canvas');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) { root.classList.add('nogl'); return; }

  /* ---------- Bileşen bilgileri (gerçek KTR verileri) ---------- */
  const INFO = {
    hull:   ['Lenta Marine Sızdırmaz Hazne', 'Lenta Marine Watertight Enclosure', ['Ø110 × 325 mm', 'Çift katmanlı O-ring flanş|Double O-ring flange', 'M10 sızdırmaz penetratörler|M10 watertight penetrators']],
    camera: ['Sony IMX322 HD Kamera', 'Sony IMX322 HD Camera', ['Ön optik kubbe arkasında|Behind the front optical dome', 'CLAHE + YOLOv9 hattını besler|Feeds the CLAHE + YOLOv9 pipeline', 'Çift su altı LED aydınlatma|Dual underwater LED lighting']],
    jetson: ['Nvidia Jetson Orin Nano', 'Nvidia Jetson Orin Nano', ['Görüntü işleme ve sensör füzyonu|Image processing and sensor fusion', 'Mini ROV Ethernet Veri Köprüsü|Mini ROV Ethernet Data Bridge', 'TI-Poe200 Ethernet + UART']],
    pixhawk:['3DR Pixhawk 2.4.8 (ArduSub)', '3DR Pixhawk 2.4.8 (ArduSub)', ['Kapalı döngü PID derinlik / yönelim|Closed-loop PID depth / heading', 'İtici ESC’lere PWM çıkışı|PWM output to thruster ESCs', 'Pymavlink / MAVLink']],
    battery:['14.8V 5000 mAh 50C Li-Po', '14.8V 5000 mAh 50C Li-Po', ['XT-60 konnektör|XT-60 connectors', '+%10 toleranslı sigorta|+10% rated fuse', 'Power Module + UBEC 5V 3A']],
    esc:    ['6× 40A Çift Yönlü ESC', '6× 40A Bidirectional ESC', ['Proteus ile özgün güç dağıtım kartı|Custom power distribution PCB (Proteus)', 'Sinyal hatlarından izole|Isolated from sensor signal lines']],
    thr_h:  ['4× Degz M5 (yatay vektörel)', '4× Degz M5 (horizontal, vectored)', ['14.8V’ta maks. 9 kgf itki|Up to 9 kgf thrust at 14.8V', '27A / 650W · 310 g', 'Surge · Sway · Yaw']],
    thr_v:  ['2× Degz M5 (dikey)', '2× Degz M5 (vertical)', ['Dalış / çıkış (heave)|Dive / ascend (heave)', 'MS5837 verisiyle derinlik tutma|Depth hold using MS5837 data']],
    sonar:  ['Blue Robotics Ping1D Sonar', 'Blue Robotics Ping1D Sonar', ['Akustik altimetre / mesafe|Acoustic altimeter / range', 'Tahtaya temas etmeden mesafe tutma|Keeps distance without touching the board']],
    depth:  ['MS5837-30BA Derinlik Sensörü', 'MS5837-30BA Depth Sensor', ['Basınç + sıcaklık|Pressure + temperature', 'PID derinlik kilidi|PID depth lock']],
    frame:  ['Pleksiglas Şase + 3B PLA', 'Acrylic Chassis + 3D-printed PLA', ['Hassas lazer kesim pleksiglas|Precision laser-cut acrylic', '386 × 340 × 205 mm · ~8.0 kg', 'SOLIDWORKS tasarım|SOLIDWORKS design']],
    foam:   ['Yüzdürücü Köpük', 'Buoyancy Foam', ['Pozitif yüzerlilik ve ağırlık dengesi|Positive buoyancy and weight balance']],
    kill:   ['Mekanik Acil Durdurma', 'Mechanical Kill Switch', ['Enerjiyi mekanik olarak anında keser|Cuts power mechanically and instantly', 'Mini ROV’da bağımsız bir tane daha|A separate one on the Mini ROV']],
    mini:   ['CORAL Mini ROV', 'CORAL Mini ROV', ['200 × 160 × 115 mm · ~2.3 kg', '4× Degz M1 + 30A ESC', 'Bağımsız Pixhawk 2.4.8 · 14.8V 2200 mAh|Independent Pixhawk 2.4.8 · 14.8V 2200 mAh', 'Ana ROV üzerinden Ethernet köprüsü|Ethernet bridge via Main ROV']]
  };
  const pick = (s) => { const p = String(s).split('|'); return TR ? p[0] : (p[1] || p[0]); };

  /* ---------- Küçük matris yardımcıları (sütun-ana sıralı) ---------- */
  const I = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; } return o; };
  const X = (...m) => m.reduce(mul);
  const T = (x, y, z) => { const m = I(); m[12] = x; m[13] = y; m[14] = z; return m; };
  const RX = (a) => { const m = I(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
  const RY = (a) => { const m = I(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
  const RZ = (a) => { const m = I(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; };
  const persp = (f, asp, n, fa) => { const t = 1 / Math.tan(f / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (fa + n) / (n - fa); m[11] = -1; m[14] = 2 * fa * n / (n - fa); return m; };
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const look = (e, c, u) => { const z = norm([e[0]-c[0], e[1]-c[1], e[2]-c[2]]), x = norm(cross(u, z)), y = cross(z, x);
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1]); };
  const apply = (m, p) => [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14], m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]];

  /* ---------- Geometri üreticileri: {v: [x,y,z,nx,ny,nz,...], i: [...]} ---------- */
  function box(w, h, d) {
    const v = [], i = [], hw = w/2, hh = h/2, hd = d/2;
    const F = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const n of F) {
      const u = Math.abs(n[1]) ? [1,0,0] : [0,1,0], t = cross(n, u), s = [hw, hh, hd], b = v.length / 6;
      for (const [a, c] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
        const p = [0,1,2].map(k => (n[k] + u[k]*a + t[k]*c) * s[k]);
        v.push(p[0], p[1], p[2], n[0], n[1], n[2]);
      }
      i.push(b, b+1, b+2, b, b+2, b+3);
    }
    return { v, i };
  }
  function cyl(r, len, seg, caps = true) { // X ekseni boyunca
    const v = [], i = [], h = len / 2;
    for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      v.push(-h, r*c, r*s, 0, c, s, h, r*c, r*s, 0, c, s); }
    for (let k = 0; k < seg; k++) { const b = k * 2; i.push(b, b+1, b+2, b+1, b+3, b+2); }
    if (caps) for (const sg of [1, -1]) { const b = v.length / 6; v.push(sg*h, 0, 0, sg, 0, 0);
      for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; v.push(sg*h, r*Math.cos(a), r*Math.sin(a), sg, 0, 0); }
      for (let k = 0; k < seg; k++) i.push(b, b+1+k+(sg>0?0:1), b+1+k+(sg>0?1:0)); }
    return { v, i };
  }
  function dome(r, seg, rings) { // +X yönüne bakan yarım küre
    const v = [], i = [];
    for (let j = 0; j <= rings; j++) { const t = j / rings * Math.PI / 2;
      for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2, n = [Math.cos(t), Math.sin(t)*Math.cos(a), Math.sin(t)*Math.sin(a)];
        v.push(n[0]*r, n[1]*r, n[2]*r, n[0], n[1], n[2]); } }
    for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) { const a = j*(seg+1)+k, b = a+seg+1; i.push(a, b, a+1, a+1, b, b+1); }
    return { v, i };
  }
  function torus(R, r, s1, s2) { // X ekseni etrafında halka
    const v = [], i = [];
    for (let a = 0; a <= s1; a++) { const A = a / s1 * Math.PI * 2;
      for (let b = 0; b <= s2; b++) { const B = b / s2 * Math.PI * 2, cy = Math.cos(A), sz = Math.sin(A);
        const n = [Math.sin(B), Math.cos(B)*cy, Math.cos(B)*sz];
        v.push(n[0]*r, (R + r*Math.cos(B))*cy, (R + r*Math.cos(B))*sz, n[0], n[1], n[2]); } }
    for (let a = 0; a < s1; a++) for (let b = 0; b < s2; b++) { const p = a*(s2+1)+b, q = p+s2+1; i.push(p, q, p+1, p+1, q, q+1); }
    return { v, i };
  }

  /* ---------- WebGL kurulum ---------- */
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, `attribute vec3 aP,aN;uniform mat4 uP,uV,uM;uniform mat3 uNM;varying vec3 vN,vV;
    void main(){vec4 v=uV*uM*vec4(aP,1.);vN=uNM*aN;vV=-v.xyz;gl_Position=uP*v;}`));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `precision mediump float;varying vec3 vN,vV;uniform vec3 uC;uniform float uA,uH;
    void main(){vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 v=normalize(vV);
      vec3 L=normalize(vec3(-.45,.8,.6));float d=max(dot(n,L),0.),d2=max(dot(n,normalize(vec3(.6,-.25,.5))),0.);
      float sp=pow(max(dot(n,normalize(L+v)),0.),40.),rim=pow(1.-max(dot(n,v),0.),3.);
      vec3 c=uC*(.30+.70*d+.16*d2)+vec3(.5)*sp*.5+vec3(0.,.5,1.)*rim*.18;
      c=mix(c,vec3(0.,.66,1.),uH*.6);gl_FragColor=vec4(c,uA);}`));
  gl.linkProgram(prog); gl.useProgram(prog);
  const loc = (n) => gl.getUniformLocation(prog, n), U = { P: loc('uP'), V: loc('uV'), M: loc('uM'), NM: loc('uNM'), C: loc('uC'), A: loc('uA'), H: loc('uH') };
  const aP = gl.getAttribLocation(prog, 'aP'), aN = gl.getAttribLocation(prog, 'aN');
  const upload = (g) => { const vb = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.v), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.i), gl.STATIC_DRAW);
    return { vb, ib, n: g.i.length }; };
  const G = { // paylaşılan geometriler
    hull: upload(cyl(.55, 3.25, 48)), dome: upload(dome(.55, 48, 14)), cap: upload(cyl(.56, .08, 48)),
    plate: upload(box(3.3, .06, 2.9)), foam: upload(box(1.5, .22, .7)),
    bat: upload(box(1.15, .34, .72)), jet: upload(box(.75, .1, .55)), pix: upload(box(.55, .09, .42)), esc: upload(box(.3, .08, .34)),
    camc: upload(cyl(.16, .12, 24)), thr: upload(cyl(.2, .7, 28)), ring: upload(torus(.27, .035, 28, 10)), blade: upload(box(.03, .24, .09)),
    pen: upload(cyl(.04, .18, 12)), sonar: upload(cyl(.14, .3, 24)), dep: upload(cyl(.06, .16, 16)), kill: upload(cyl(.1, .14, 20)),
    disk: upload(cyl(3.0, .05, 64)), rim: upload(torus(3.0, .014, 90, 6)),
    mbody: upload(box(1.6, .9, 1.2)), mdome: upload(dome(.42, 28, 10)), mthr: upload(cyl(.12, .42, 20)), mring: upload(torus(.16, .02, 20, 8))
  };

  /* ---------- Sahne ---------- */
  const parts = []; // {g, m, c, a, comp, fade}
  const add = (g, m, c, a, comp, fade) => parts.push({ g: G[g], m, c, a, comp, fade, w: [m[12], m[13], m[14]] });
  const rgb = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
  const C = { glass: rgb(0x9fb4c4), plate: rgb(0xaec4d4), dark: rgb(0x14181d), board: rgb(0x1a3a52), green: rgb(0x1f4d3a), batt: rgb(0x1d6fa8), blue: rgb(0x00a8ff), white: rgb(0xe8edf2), foam: rgb(0xd7dde3), steel: rgb(0x7d8894), red: rgb(0xc62828), esc: rgb(0x252b33) };

  // yer / temel
  add('disk', X(T(0, -2.3, 0), RZ(Math.PI / 2)), rgb(0x0f151c), 1, 'base'); add('rim', X(T(0, -2.27, 0), RZ(Math.PI / 2)), C.blue, .7, 'base');
  // şase plakaları (pleksiglas) + yüzdürücü köpük
  add('plate', T(0, .8, 0), C.plate, .38, 'frame', 'plate'); add('plate', T(0, -.8, 0), C.plate, .38, 'frame', 'plate');
  add('foam', T(.1, .94, .85), C.foam, 1, 'foam'); add('foam', T(.1, .94, -.85), C.foam, 1, 'foam');
  // ana hazne
  add('hull', T(0, 0, 0), C.glass, .88, 'hull', 'hull');
  add('dome', T(1.625, 0, 0), C.glass, .88, 'hull', 'hull');
  add('cap', T(-1.66, 0, 0), C.steel, 1, 'hull');
  for (const [y, z] of [[.18, .2], [-.18, .2], [.18, -.2], [-.18, -.2]]) add('pen', X(T(-1.82, y, z)), C.blue, 1, 'hull');
  // iç parçalar
  add('camc', T(1.52, 0, 0), C.dark, 1, 'camera'); add('ring', X(T(1.47, 0, 0), RZ(0)), C.blue, 1, 'camera');
  add('bat', T(-.95, -.2, 0), C.batt, 1, 'battery');
  add('jet', T(.15, .2, 0), C.green, 1, 'jetson'); add('pix', T(.95, 0, 0), C.board, 1, 'pixhawk');
  for (let k = 0; k < 6; k++) add('esc', T(-1.05 + k * .36, .27, 0), C.esc, 1, 'esc');
  add('esc', T(-.2, -.1, 0), rgb(0x2a3340), 1, 'esc'); // güç dağıtım kartı
  // dış sensörler ve acil durdurma
  add('sonar', X(T(1.25, -.95, 0)), rgb(0x2b333c), 1, 'sonar'); add('dep', X(T(-.5, .95, 0), RZ(Math.PI / 2)), C.steel, 1, 'depth');
  add('kill', X(T(-1.3, .93, -.1), RZ(Math.PI / 2)), C.red, 1, 'kill');
  // iticiler
  const thr = (x, y, z, ry, rz, comp) => {
    const B = X(T(x, y, z), RY(ry), RZ(rz));
    add('thr', B, rgb(0x5b6876), 1, comp); add('ring', X(B, T(.38, 0, 0)), C.steel, 1, comp);
    for (let k = 0; k < 3; k++) add('blade', X(B, T(.3, 0, 0), RX(k * Math.PI * 2 / 3), T(0, .13, 0)), C.blue, 1, comp);
  };
  for (const [x, z, ry] of [[1.35, 1.2, -Math.PI / 4], [1.35, -1.2, Math.PI / 4], [-1.35, 1.2, Math.PI / 4], [-1.35, -1.2, -Math.PI / 4]]) thr(x, 0, z, ry, 0, 'thr_h');
  for (const z of [1.28, -1.28]) thr(0, 0, z, 0, Math.PI / 2, 'thr_v');
  // Mini ROV (isteğe bağlı, ana aracın altında)
  const MY = -1.55;
  add('mbody', T(0, MY, 0), C.plate, .9, 'mini'); add('mdome', T(.8, MY, 0), C.glass, .8, 'mini');
  for (const [x, z] of [[.55, .72], [.55, -.72], [-.55, .72], [-.55, -.72]]) { const B = X(T(x, MY, z), RY(z > 0 ? -.6 : .6)); add('mthr', B, C.dark, 1, 'mini'); add('mring', X(B, T(.21, 0, 0)), C.blue, 1, 'mini'); }
  const miniParts = parts.filter(p => p.comp === 'mini');

  /* ---------- Durum ve kamera ---------- */
  const S = { yaw: .7, pitch: .36, dist: 7.2, inner: 0, innerT: 0, sel: null, mini: false, auto: false, dirty: true, tx: 0, ty: 0 };
  const VIEWS = { reset: [.7, .36, 7.2], top: [0, 1.5, 7.2], side: [0, 0, 7.2], front: [-Math.PI / 2, 0, 7.2] };
  let W = 1, H = 1, PM = I(), VM = I();

  function resize() {
    const r = canvas.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * d); canvas.height = Math.round(H * d); S.dirty = true;
  }
  function draw(p, alpha, hl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, p.g.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.g.ib);
    gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 24, 12);
    const vm = mul(VM, p.m);
    gl.uniformMatrix4fv(U.M, false, p.m);
    gl.uniformMatrix3fv(U.NM, false, new Float32Array([vm[0], vm[1], vm[2], vm[4], vm[5], vm[6], vm[8], vm[9], vm[10]]));
    gl.uniform3fv(U.C, p.c); gl.uniform1f(U.A, alpha); gl.uniform1f(U.H, hl);
    gl.drawElements(gl.TRIANGLES, p.g.n, gl.UNSIGNED_SHORT, 0);
  }
  function frame() {
    if (S.auto) { S.yaw += .006; S.dirty = true; }
    if (Math.abs(S.inner - S.innerT) > .001) { S.inner += (S.innerT - S.inner) * .18; S.dirty = true; } else S.inner = S.innerT;
    if (S.dirty) {
      S.dirty = false;
      const cy = Math.cos(S.pitch), eye = [S.dist * cy * Math.sin(S.yaw), S.dist * Math.sin(S.pitch) + S.ty, S.dist * cy * Math.cos(S.yaw)];
      VM = look(eye, [0, S.ty, 0], [0, 1, 0]); PM = persp(.7, W / H, .5, 60);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(.043, .055, .071, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.uniformMatrix4fv(U.P, false, PM); gl.uniformMatrix4fv(U.V, false, VM);
      const vis = parts.filter(p => p.comp !== 'mini' || S.mini);
      const alphaOf = (p) => p.fade === 'hull' ? .88 - .76 * S.inner : p.fade === 'plate' ? .42 - .14 * S.inner : p.a;
      const hlOf = (p) => (S.sel && p.comp === S.sel) ? 1 : 0;
      gl.disable(gl.BLEND); gl.depthMask(true);
      for (const p of vis) if (alphaOf(p) >= .99) draw(p, 1, hlOf(p));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      const dist = (p) => { const v = apply(VM, p.w); return -v[2]; };
      vis.filter(p => alphaOf(p) < .99).sort((a, b) => dist(b) - dist(a)).forEach(p => draw(p, alphaOf(p), hlOf(p)));
      gl.depthMask(true); placeTag();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Seçim, etiket, arayüz ---------- */
  const tag = root.querySelector('.rov3d__tag'), info = root.querySelector('.rov3d__info'), list = root.querySelector('.rov3d__list');
  const center = (comp) => { const ps = parts.filter(p => p.comp === comp); const c = [0, 0, 0]; ps.forEach(p => p.w.forEach((v, k) => c[k] += v / ps.length)); return c; };
  function project(c) { const q = apply(mul(PM, VM), c); return [(q[0] / q[3] * .5 + .5) * W, (1 - (q[1] / q[3] * .5 + .5)) * H]; }
  function placeTag() { if (!S.sel) { tag.hidden = true; return; } const [x, y] = project(center(S.sel)); tag.hidden = false; tag.style.left = x + 'px'; tag.style.top = y + 'px'; tag.textContent = INFO[S.sel][TR ? 0 : 1]; }
  function select(id) {
    S.sel = id; S.dirty = true;
    list.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    if (!id) { info.innerHTML = ''; return; }
    const d = INFO[id];
    info.innerHTML = '<h4></h4><ul></ul>'; info.querySelector('h4').textContent = d[TR ? 0 : 1];
    d[2].forEach(t => { const li = document.createElement('li'); li.textContent = pick(t); info.querySelector('ul').appendChild(li); });
  }
  Object.keys(INFO).forEach(id => { if (id === 'mini') return; const b = document.createElement('button'); b.type = 'button'; b.dataset.id = id; b.textContent = INFO[id][TR ? 0 : 1]; b.onclick = () => select(S.sel === id ? null : id); list.appendChild(b); });
  const setInner = (v) => { S.innerT = v ? 1 : 0; root.querySelectorAll('[data-inner]').forEach(b => b.classList.toggle('on', (b.dataset.inner === '1') === !!v)); };
  const setMini = (v) => { S.mini = v; S.ty = v ? -.35 : 0; S.dirty = true; root.querySelector('[data-act="mini"]').classList.toggle('on', v);
    const mb = list.querySelector('[data-id="mini"]'); if (v && !mb) { const b = document.createElement('button'); b.type = 'button'; b.dataset.id = 'mini'; b.textContent = INFO.mini[TR ? 0 : 1]; b.onclick = () => select(S.sel === 'mini' ? null : 'mini'); list.appendChild(b); }
    if (!v) { if (mb) mb.remove(); if (S.sel === 'mini') select(null); } };
  root.querySelectorAll('[data-inner]').forEach(b => b.onclick = () => setInner(b.dataset.inner === '1'));
  root.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { const v = VIEWS[b.dataset.view]; [S.yaw, S.pitch, S.dist] = v; S.dirty = true; });
  root.querySelector('[data-act="mini"]').onclick = () => setMini(!S.mini);
  root.querySelector('[data-act="auto"]').onclick = (e) => { S.auto = !S.auto; e.currentTarget.classList.toggle('on', S.auto); };
  root.querySelector('[data-act="zin"]').onclick = () => { S.dist = Math.max(4, S.dist - 1); S.dirty = true; };
  root.querySelector('[data-act="zout"]').onclick = () => { S.dist = Math.min(16, S.dist + 1); S.dirty = true; };

  // sürükleyerek döndürme + iki parmakla yakınlaştırma
  const ptr = new Map(); let moved = 0, pd = 0;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; });
  canvas.addEventListener('pointermove', (e) => {
    if (!ptr.has(e.pointerId)) return; const o = ptr.get(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd) { S.dist = Math.min(16, Math.max(4, S.dist * pd / d)); } pd = d; }
    else { const dx = e.clientX - o[0], dy = e.clientY - o[1]; moved += Math.abs(dx) + Math.abs(dy); S.yaw -= dx * .008; S.pitch = Math.max(-1.35, Math.min(1.45, S.pitch + dy * .008)); }
    S.dirty = true;
  });
  const up = (e) => { if (ptr.size === 1 && moved < 5 && e.type === 'pointerup') { // tıklama: en yakın bileşeni seç
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 46;
      new Set(parts.filter(p => p.comp !== 'base' && (p.comp !== 'mini' || S.mini)).map(p => p.comp)).forEach(c => { const [px, py] = project(center(c)), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = c; } });
      select(best); }
    ptr.delete(e.pointerId); pd = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); S.dist = Math.min(16, Math.max(4, S.dist * (1 + e.deltaY * .002))); S.dirty = true; }, { passive: false });
  new ResizeObserver(resize).observe(canvas); resize(); setInner(0); frame();

  // test / sunum için dış erişim
  window.AquaROV = { select, setInner, setMini, state: S };
  }
  document.querySelectorAll('.rov3d').forEach(init);
})();
