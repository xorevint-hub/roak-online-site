/* Roak Online tanıtım sitesi */
const $ = (s, r = document) => r.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => n.toLocaleString("tr-TR");

/* ---------------- sprite motoru ---------------- */
const sprites = new Set();
class Sprite {
  constructor(el, def, scale) { this.el = el; this.scale = scale; this.set(def); sprites.add(this); }
  set(def, { once = false, onEnd = null, onFrame = null } = {}) {
    this.def = { fw: 32, row: 0, fps: 8, ...def };
    this.once = once; this.onEnd = onEnd; this.onFrame = onFrame;
    this.t = 0; this.frame = -1;
    const d = this.def, s = this.scale, fh = d.fh || d.fw;
    Object.assign(this.el.style, {
      width: d.fw * s + "px", height: fh * s + "px",
      backgroundImage: `url(${d.src})`,
      backgroundSize: `${(d.cols || d.n) * d.fw * s}px auto`,
    });
    this.draw(0);
  }
  setScale(s) { this.scale = s; this.set(this.def, { once: this.once, onEnd: this.onEnd, onFrame: this.onFrame }); }
  draw(f) {
    if (f === this.frame) return;
    this.frame = f;
    const d = this.def, s = this.scale, fh = d.fh || d.fw;
    this.el.style.backgroundPosition = `${-f * d.fw * s}px ${-d.row * fh * s}px`;
    if (this.onFrame) this.onFrame(f);
  }
  tick(dt) {
    this.t += dt;
    let f = Math.floor(this.t * this.def.fps);
    if (this.once && f >= this.def.n) {
      this.draw(this.def.n - 1);
      const cb = this.onEnd; this.once = false; this.onEnd = null; this.onFrame = null;
      if (cb) cb();
      return;
    }
    this.draw(f % this.def.n);
  }
  destroy() { sprites.delete(this); }
}

// Heroes99 karakterleri (oyundaki HeroArt varsayılan görünümleri, araclar/h99_compose.py ile birleştirildi): 72x40 kare
const H99 = 0.75;   // oyundaki gibi eski 32'lik ölçeğe indir
const HERO = cls => {
  const r = (row, n, fps) => ({ src: `assets/heroes/${cls}_h99.png`, fw: 72, fh: 40, cols: 8, row, n, fps });
  return { idle: r(0, 6, 7), run: r(1, 8, 12), attack: r(2, 6, 11), front: r(0, 6, 6) };
};
// 16 piksellik petler iki kat büyütülür (oyundaki meta dosyalarından)
const PET_FRAME = { chicken: [16, 0, 4], crow: [32, 2, 5], frog: [16, 1, 8], frog_red: [16, 1, 8], frog_yellow: [16, 1, 8], penguin: [16, 0, 4], rabbit: [16, 3, 4], rabbit_black: [16, 3, 4] };
const PET = name => { const [fw, row, n] = PET_FRAME[name] || [32, 0, 4]; return { src: `assets/pets/${name}.png`, fw, row, n, fps: n > 4 ? 10 : 6, k: 32 / fw }; };

// fw: kare boyu, k: kahraman ölçeğine göre çarpan, foot: karenin ayak altındaki boş kısmı (oran)
const ENEMY = {
  slime_green: { fw: 32, n: 4, k: .9 }, slime_lava: { fw: 32, n: 4, k: .9 }, slime_snow: { fw: 32, n: 4, k: .9 },
  myconid_red: { fw: 32, n: 4, k: .9 }, bigslime_gold: { fw: 32, n: 4, k: 1.6 },
  bat: { fw: 80, n: 5, row: 1, k: .7, foot: .3 },
  skeleton: { fw: 80, n: 4, row: 1, k: .7, foot: .3 }, demon: { fw: 80, n: 4, row: 1, k: .7, foot: .3 },
  ghost: { fw: 80, n: 4, row: 1, k: .7, foot: .3 }, wraith: { fw: 80, n: 4, row: 1, k: .7, foot: .3 },
  minotaur: { fw: 80, n: 4, row: 1, k: .75, foot: .3 }, gob_warrior: { fw: 80, n: 4, row: 1, k: .7, foot: .3 },
  witch: { fw: 80, n: 4, row: 1, k: .7, foot: .3 }, skel_knight: { fw: 80, n: 4, row: 1, k: .75, foot: .3 },
  wizard: { fw: 80, n: 4, row: 1, k: .7, foot: .3 }, mimic: { fw: 80, n: 6, row: 1, k: .7, foot: .3 },
};
// satır ve yön oyunun art.json'undan: yan görünüş, sola bakacak şekilde çevrilir
const enemyDef = name => ({ src: `assets/enemies/${name}_idle.png`, fps: 7, row: 2, flip: true, ...ENEMY[name] });

const RARITY = [
  { name: "Gri", en: "Basic", c: "#9aa0a8", mul: 1.0, aff: 0, w: 40 },
  { name: "Yeşil", en: "Standart", c: "#5fd47a", mul: 1.15, aff: 1, w: 27 },
  { name: "Mavi", en: "Rare", c: "#4fa3ff", mul: 1.32, aff: 2, w: 16 },
  { name: "Mor", en: "Epic", c: "#b56bff", mul: 1.55, aff: 3, w: 9 },
  { name: "Turuncu", en: "Ultra Epic", c: "#ff9a3c", mul: 1.9, aff: 3, w: 5 },
  { name: "Kırmızı", en: "Legendary", c: "#ff4b4b", mul: 2.35, aff: 4, w: 2.3 },
  { name: "Sarı", en: "Ultra Legendary", c: "#ffe14d", mul: 2.95, aff: 5, w: .7 },
];
const rollRarity = (luck = 1) => {
  const ws = RARITY.map((r, i) => r.w * (i >= 2 ? luck : 1));
  let x = Math.random() * ws.reduce((a, b) => a + b);
  for (let i = 0; i < ws.length; i++) { if ((x -= ws[i]) < 0) return i; }
  return 0;
};

const REGIONS = [
  { name: "Fısıltı Korusu", alt: "Alacakaranlık Korusu", key: "Koru", desc: "Balçıklar, mantarlar ve ilk goblinler.", bg: 0, mob: "slime_green", mobs: ["slime_green", "myconid_red", "gob_warrior"], boss: "minotaur" },
  { name: "Kırık Maden", alt: "Kristal Derinlikler", key: "Maden", desc: "Karanlıkta kanat çırpan yarasalar.", bg: 1, mob: "bat", mobs: ["bat", "gob_warrior", "skeleton"], boss: "skel_knight" },
  { name: "Sisli Bataklık", alt: "Batık Tapınak", key: "Bataklık", desc: "Zehirli sporlar, sudan yükselen cadılar.", bg: 2, mob: "witch", mobs: ["myconid_red", "witch", "slime_green"], boss: "mimic" },
  { name: "Kül Ocağı", alt: "Lav Nehri", key: "Kül", desc: "Kor iblisleri ve lav balçıkları.", bg: 3, mob: "demon", mobs: ["slime_lava", "demon"], boss: "demon" },
  { name: "Ayaz Kalesi", alt: "Buzul Taht", key: "Ayaz", desc: "Buzda yürüyen iskelet ordusu.", bg: 4, mob: "skeleton", mobs: ["slime_snow", "skeleton"], boss: "wizard" },
  { name: "Astral Harabe", alt: "Yıldız Kuyusu", key: "Astral", desc: "Yıldız hayaletleri, zamanın kıyısı.", bg: 5, mob: "ghost", mobs: ["ghost", "wraith"], boss: "bigslime_gold" },
];

const CLASSES = {
  guardian: { name: "Muhafız", color: "#f0b24a", role: "Yakın dövüş · Tank", ranged: false,
    desc: "Ön safta dayanan kılıç ustası. Yüksek can ve zırhla her darbeyi karşılar, kanatır ve sersemletir.",
    stats: [160, 11.5, 13, 1.0], passive: "+%20 can, +%3 can çalma", slot: "Kalkan", evo: ["Muhafız", "Paladin", "Ejder Şövalyesi"] },
  hunter: { name: "Avcı", color: "#6fd08c", role: "Uzak menzil · Kritik", ranged: true, proj: "arrow",
    desc: "Düşman yaklaşmadan onu indiren keskin göz. Kritik vuruşlar ve zehirli oklar.",
    stats: [110, 12, 6, 1.1], passive: "+%8 kritik, +%10 saldırı hızı", slot: "Sadak", evo: ["Avcı", "Keskin Nişancı", "Rüzgâr Okçusu"] },
  runer: { name: "Rüncü", color: "#a98bff", role: "Uzak menzil · Alan büyüsü", ranged: true, proj: "orb",
    desc: "Rünlerle elementleri büken büyücü. Alan hasarı ve güçlü yeteneklerle kalabalığı eritir.",
    stats: [100, 13, 5, 0.8], passive: "+%25 yetenek gücü, +%8 bekleme azalması", slot: "Büyü Küresi", evo: ["Rüncü", "Element Büyücüsü", "Kadim Arkmag"] },
  assassin: { name: "Suikastçı", color: "#ff5d6c", role: "Yakın dövüş · Hız", ranged: false,
    desc: "Gölgelerden gelen ölüm. En hızlı saldırı, en yüksek kritik hasarı, kanama ve zehir.",
    stats: [115, 12.5, 7, 1.45], passive: "+%10 kritik, +%25 kritik hasarı", slot: "Yan Hançer", evo: ["Suikastçı", "Gölge Bıçağı", "Ölüm Hançeri"] },
};

/* ---------------- canlı şerit ---------------- */
class Strip {
  constructor(root, { cls = "guardian", pet = "capybara", hud = true } = {}) {
    this.root = root; this.cls = cls; this.region = 0; this.stage = 1; this.wave = 1; this.waveMax = 7; this.gold = 0;
    root.innerHTML = `<div class="strip-bg a"></div><div class="strip-bg b"></div>
      ${hud ? `<div class="strip-hud"><span class="st"></span><span class="wv"></span><span class="g"></span></div>` : ""}
      <div class="strip-banner"></div><div class="strip-shade"></div>`;
    this.bgA = $(".a", root); this.bgB = $(".b", root); this.hud = hud;
    this.heroEl = this.add("actor"); this.petEl = this.add("actor");
    this.measure();
    this.hero = new Sprite(this.heroEl, HERO(cls).run, this.hs * H99);
    this.pet = new Sprite(this.petEl, PET(pet), this.hs * .8 * PET(pet).k);
    this.bgX = 0; this.state = "walk"; this.enemy = null; this.spawnIn = .6;
    this.setBg(REGIONS[0].bg, true);
    this.updHud();
    new ResizeObserver(() => this.measure(true)).observe(root);
  }
  add(cls, parent = this.root) { const e = document.createElement("div"); e.className = cls; parent.appendChild(e); return e; }
  measure(re) {
    this.W = this.root.clientWidth; this.H = this.root.clientHeight;
    this.s = this.H / 64; this.hs = this.s * .95;
    this.heroX = this.W * (this.W < 600 ? .22 : .3);
    if (re) { this.hero.setScale(this.hs * H99); this.pet.setScale(this.hs * .8 * (this.pet.def.k || 1)); if (this.enemy) this.enemy.spr.setScale(this.hs * this.enemy.def.k); }
  }
  setBg(i, instant) {
    const url = `url(assets/bg/bg_${i}_1.png)`;
    if (instant) { this.bgA.style.backgroundImage = url; return; }
    this.bgB.style.backgroundImage = url; this.bgB.style.opacity = 1;
    setTimeout(() => { this.bgA.style.backgroundImage = url; this.bgB.style.opacity = 0; }, 1300);
  }
  setClass(cls) {
    this.cls = cls;
    if (this.state === "walk") this.hero.set(HERO(cls).run); else { this.state = "walk"; this.hero.set(HERO(cls).run); }
  }
  updHud() {
    if (!this.hud) return;
    $(".st", this.root).textContent = `Bölüm ${this.region + 1}-${this.stage}`;
    $(".wv", this.root).textContent = this.wave > this.waveMax ? "BOSS" : `Dalga ${this.wave}/${this.waveMax}`;
    $(".g", this.root).textContent = `${fmt(this.gold)} altın`;
  }
  banner(txt) { const b = $(".strip-banner", this.root); b.textContent = txt; b.classList.remove("show"); void b.offsetWidth; b.classList.add("show"); }
  pop(txt, x, y, cls = "", color) {
    const p = this.add("pop " + cls); p.textContent = txt; p.style.left = x + "px"; p.style.top = y + "px";
    if (color) { p.style.color = color; p.style.borderLeft = `3px solid ${color}`; }
    setTimeout(() => p.remove(), 1000);
  }
  spawn() {
    const R = REGIONS[this.region], boss = this.wave > this.waveMax;
    const name = boss ? R.boss : pick(R.mobs);
    const def = enemyDef(name);
    if (boss) def.k *= 1.35;
    const el = this.add("actor enemy");
    const spr = new Sprite(el, def, this.hs * def.k);
    const w = def.fw * this.hs * def.k;
    el.style.bottom = `calc(4% - ${(def.foot || 0) * w}px)`;
    const bar = this.add("hpbar" + (boss ? " boss" : "")); bar.innerHTML = "<span></span>";
    this.enemy = { el, spr, def, w, x: this.W + 20, hp: boss ? 520 : 100, max: boss ? 520 : 100, boss, bar };
    if (boss) this.banner("BÖLGE BOSSU");
  }
  place(el, x, flip) { const t = `translateX(${x}px)${flip ? " scaleX(-1)" : ""}`; el.style.transform = t; el.style.setProperty("--t", t); }
  attack() {
    const C = CLASSES[this.cls];
    this.state = "attack";
    this.hero.set(HERO(this.cls).attack, {
      once: true,
      onFrame: f => { if (f === 3) C.ranged ? this.shoot(C) : this.hit(); },
      onEnd: () => { if (this.state === "attack") { if (this.enemy && this.enemy.hp > 0) this.attack(); } },
    });
  }
  shoot(C) {
    const e = this.enemy; if (!e) return;
    const p = this.add("proj" + (C.proj === "orb" ? " orb" : ""));
    p.style.setProperty("--pc", C.color);
    const y = this.H * .96 - 18 * this.hs;
    const x0 = this.heroX + 24 * this.hs, x1 = e.x + e.w * .35;
    p.style.top = y + "px";
    p.animate([{ transform: `translateX(${x0}px)` }, { transform: `translateX(${x1}px)` }], { duration: 220, easing: "linear" }).onfinish = () => { p.remove(); this.hit(); };
  }
  hit() {
    const e = this.enemy; if (!e || e.hp <= 0) return;
    const crit = Math.random() < .22;
    const dmg = Math.round(rand(22, 36) * (crit ? 2.1 : 1) * (1 + this.region * .15));
    const shown = Math.round(dmg * (40 + this.region * 25));
    e.hp -= dmg;
    this.pop(fmt(shown) + (crit ? "!" : ""), e.x + e.w / 2 + rand(-10, 10), this.H * .25, crit ? "crit" : "");
    e.el.classList.add("hit"); setTimeout(() => e.el.classList.remove("hit"), 90);
    e.bar.firstChild.style.width = Math.max(0, e.hp / e.max * 100) + "%";
    if (e.hp <= 0) this.kill();
  }
  kill() {
    const e = this.enemy; this.enemy = null;
    e.spr.destroy(); e.el.classList.add("dying"); e.bar.style.opacity = 0;
    setTimeout(() => { e.el.remove(); e.bar.remove(); }, 650);
    const g = Math.round((e.boss ? 900 : rand(30, 60)) * (1 + this.region));
    this.gold += g;
    const cx = e.x + e.w / 2;
    setTimeout(() => this.pop(`+${fmt(g)} altın`, cx, this.H * .45, "gold"), 150);
    if (e.boss || Math.random() < .3) {
      const r = RARITY[Math.max(rollRarity(e.boss ? 6 : 1.4), e.boss ? 2 : 0)];
      setTimeout(() => this.pop(`${r.name} Sandık!`, cx, this.H * .12, "chest", r.c), 450);
    }
    if (e.boss) {
      this.wave = 1;
      this.stage++;
      if (this.stage > 10) { this.stage = 1; }
      this.region = (this.region + 1) % REGIONS.length;
      setTimeout(() => this.setBg(REGIONS[this.region].bg), 500);
    } else this.wave++;
    this.updHud();
    this.state = "walk";
    this.spawnIn = rand(.6, 1.4);
    this.hero.set(HERO(this.cls).run);
  }
  tick(dt) {
    const speed = 34 * this.s;
    const walking = this.state === "walk";
    if (walking) {
      this.bgX -= speed * dt;
      this.bgA.style.backgroundPositionX = this.bgB.style.backgroundPositionX = this.bgX + "px";
    }
    this.place(this.heroEl, this.heroX - 36 * H99 * this.hs);
    this.place(this.petEl, this.heroX - 46 * this.hs + Math.sin(performance.now() / 300) * 2, true);
    if (!this.enemy) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0 && walking) this.spawn();
      return;
    }
    const e = this.enemy;
    const range = CLASSES[this.cls].ranged ? 95 * this.s : 12 * this.s;
    const gap = e.x + e.w * .3 - (this.heroX + 10 * this.hs);
    if (walking) {
      e.x -= (speed + 10 * this.s) * dt;
      if (gap <= range) this.attack();
    }
    this.place(e.el, e.x, e.def.flip);
    e.bar.style.left = e.x + e.w * .25 + "px"; e.bar.style.width = e.w * .5 + "px";
    e.bar.style.top = Math.max(4, this.H * .96 - (e.def.fw * this.hs * e.def.k) * (1 - (e.def.foot || 0)) - 4) + "px";
  }
}

/* ---------------- döngü ---------------- */
const strips = [];
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  sprites.forEach(s => s.tick(dt));
  strips.forEach(s => s.visible && s.tick(dt));
  requestAnimationFrame(loop);
}

/* ---------------- kıvılcımlar ---------------- */
function embers() {
  const c = $("#embers"), x = c.getContext("2d");
  let W, H, ps = [];
  const resize = () => { W = c.width = c.offsetWidth * devicePixelRatio; H = c.height = c.offsetHeight * devicePixelRatio; };
  resize(); addEventListener("resize", resize);
  const make = (init) => ({ x: Math.random() * W, y: init ? Math.random() * H : H + 10, r: rand(.6, 2.4) * devicePixelRatio,
    vy: rand(.2, .9) * devicePixelRatio, vx: rand(-.3, .3), a: rand(.3, 1), w: rand(0, 6.28), hue: Math.random() < .75 ? 40 : 265 });
  for (let i = 0; i < 90; i++) ps.push(make(true));
  (function draw() {
    x.clearRect(0, 0, W, H);
    x.globalCompositeOperation = "lighter";
    for (const p of ps) {
      p.y -= p.vy; p.w += .02; p.x += p.vx + Math.sin(p.w) * .3;
      if (p.y < -10) Object.assign(p, make(false));
      const fade = Math.min(1, p.y / H * 1.6) * p.a;
      const g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `hsla(${p.hue},100%,75%,${fade})`); g.addColorStop(1, `hsla(${p.hue},100%,60%,0)`);
      x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, p.r * 4, 0, 6.28); x.fill();
    }
    requestAnimationFrame(draw);
  })();
}

/* ---------------- sınıflar ---------------- */
function classes() {
  const tabs = $("#classTabs"), stage = $("#classStage");
  const big = new Sprite($("#classSprite"), HERO("guardian").idle, (innerWidth < 600 ? 5 : 7) * H99);
  const keys = Object.keys(CLASSES);
  const bds = $("#classBackdrops");
  keys.forEach(k => {
    const bd = document.createElement("div");
    bd.className = "class-backdrop"; bd.dataset.k = k; bd.style.backgroundImage = `url(assets/art/class_${k}.webp)`;
    bds.appendChild(bd);
    const b = document.createElement("button");
    b.className = "class-tab"; b.dataset.k = k; b.style.setProperty("--cc", CLASSES[k].color);
    b.innerHTML = `<span class="tab-ico"><span class="sprite"></span></span>${CLASSES[k].name}`;
    tabs.appendChild(b);
    new Sprite($(".sprite", b), HERO(k).front, 1.1);
    b.onclick = () => { select(k); auto = false; };
  });
  const MAX = [160, 13, 13, 1.45], LBL = ["Can", "Saldırı", "Zırh", "Hız"];
  let cur, auto = true, timer;
  const loopAnim = k => {
    clearTimeout(timer);
    big.set(HERO(k).attack, { once: true, onEnd: () => { big.set(HERO(k).idle); timer = setTimeout(() => cur === k && loopAnim(k), 1400); } });
  };
  function select(k) {
    if (k === cur) return; cur = k;
    const C = CLASSES[k];
    tabs.querySelectorAll(".class-tab").forEach(t => t.classList.toggle("on", t.dataset.k === k));
    bds.querySelectorAll(".class-backdrop").forEach(b => b.classList.toggle("on", b.dataset.k === k));
    stage.style.setProperty("--cc", C.color);
    stage.classList.remove("swap"); void stage.offsetWidth; stage.classList.add("swap");
    $("#classRole").textContent = C.role; $("#className").textContent = C.name; $("#classDesc").textContent = C.desc;
    $("#classPassive").textContent = C.passive; $("#classSlot").textContent = C.slot;
    $("#classStats").innerHTML = C.stats.map((v, i) => `<div class="stat"><span>${LBL[i]}</span><div class="stat-bar"><span></span></div><b>${String(v).replace(".", ",")}</b></div>`).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => $("#classStats").querySelectorAll(".stat-bar span").forEach((s, i) => s.style.width = C.stats[i] / MAX[i] * 100 + "%")));
    $("#classEvo").innerHTML = C.evo.map((n, i) => `<div class="evo-step"><small>${["BAŞLANGIÇ", "SV 50", "SV 100"][i]}</small>${n}</div>`).join('<span class="evo-arrow">➜</span>');
    loopAnim(k);
    strips.forEach(s => s.setClass(k));
  }
  select("guardian");
  // görünürken sınıflar arasında kendiliğinden dolaş
  setInterval(() => { if (auto && isVisible(stage)) select(keys[(keys.indexOf(cur) + 1) % keys.length]); }, 6000);
}

/* ---------------- dünya ---------------- */
function regions() {
  const box = $("#regions");
  REGIONS.forEach((R, i) => {
    const d = document.createElement("div");
    d.className = "region reveal"; d.dataset.delay = (i % 3) + 1;
    d.innerHTML = `<div class="region-art" style="background-image:url(assets/art/region_${i}.webp)"></div><div class="region-shine"></div>
      <span class="region-num">BÖLGE ${i + 1}</span><span class="region-key">${R.key} anahtarı</span>
      <div class="sprite"></div>
      <div class="region-text"><span class="alt">${R.alt}</span><h3>${R.name}</h3><p>${R.desc}</p></div>`;
    // fareyle hafif 3B eğim
    d.addEventListener("pointermove", e => {
      const r = d.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      d.style.setProperty("--rx", -y * 8 + "deg"); d.style.setProperty("--ry", x * 10 + "deg");
      d.style.setProperty("--mx", (x + .5) * 100 + "%"); d.style.setProperty("--my", (y + .5) * 100 + "%");
    });
    d.addEventListener("pointerleave", () => { d.style.setProperty("--rx", "0deg"); d.style.setProperty("--ry", "0deg"); });
    box.appendChild(d);
    const def = enemyDef(R.mob);
    new Sprite($(".sprite", d), def, (def.fw === 32 ? 2.6 : 1.5));
    if (def.foot) $(".sprite", d).style.marginBottom = -def.foot * def.fw * 1.5 + "px";
  });
}

/* ---------------- eşyalar ---------------- */
function items() {
  $("#rarityLadder").innerHTML = RARITY.map(r => `<div class="rar" style="--rc:${r.c}"><div class="gem"></div><b>${r.name}</b><span>${r.en}</span></div>`).join("");

  const TYPES = ["Kılıç", "Yay", "Asa", "Hançer", "Zırh", "Miğfer", "Kolye", "Yüzük", "Eldiven", "Çizme"];
  const PRE = ["Paslı", "Sağlam", "Ay Işığı", "Gölge", "Ejder Pulu", "Kızıl Kor", "Göksel"];
  const LEG = { 5: ["Kök Kalbi", "Derinlik Çekici", "Kül Tacı", "Ayaz Pençesi"], 6: ["Yıldız Kuyusu Tacı", "Astral Kalp", "Yarık Bekçisi"] };
  const chest = $("#chest"), btn = $("#chestBtn"), loot = $("#loot"), area = $(".chest-area"), hist = $("#lootHistory");
  let busy = false, count = 0;
  const open = () => {
    if (busy) return; busy = true; btn.disabled = true;
    chest.classList.remove("open"); loot.classList.remove("show");
    setTimeout(() => chest.classList.add("shake"), 200);
    setTimeout(() => {
      chest.classList.remove("shake");
      count++;
      const i = rollRarity(count % 12 === 0 ? 8 : 1), r = RARITY[i];
      const grade = pick(["Normal", "Orta", "İyi"]);
      const name = LEG[i] && Math.random() < (i === 6 ? .5 : .25) ? pick(LEG[i]) : `${PRE[i]} ${pick(TYPES)}`;
      area.style.setProperty("--rc", r.c);
      $(".loot-name", loot).textContent = name;
      $(".loot-meta", loot).textContent = `${r.name} · ${r.en} · ${grade} kademe · ana stat x${String(r.mul).replace(".", ",")} · ${r.aff} özellik`;
      chest.classList.add("open"); loot.classList.add("show");
      const dot = document.createElement("i"); dot.style.setProperty("--rc", r.c); dot.title = name;
      hist.prepend(dot); if (hist.children.length > 18) hist.lastChild.remove();
      btn.textContent = "Bir Daha Aç"; btn.disabled = false; busy = false;
    }, 800);
  };
  btn.onclick = open; chest.onclick = open;

  // artı basma
  const MUL = [1, 1.10, 1.20, 1.32, 1.45, 1.60, 1.78, 2.0, 2.35, 2.75, 3.25, 3.85, 4.55, 5.4, 6.4, 7.6];
  const CH = [100, 100, 100, 100, 100, 100, 70, 60, 50, 42, 35, 28, 22, 16, 11, 7];
  let lv = 0, pity = 0;
  const item = $("#upgItem"), msg = $("#upgMsg"), ubtn = $("#upgBtn");
  const draw = () => {
    $("#upgPlus").textContent = "+" + lv;
    $("#upgMul").textContent = "x" + MUL[lv].toFixed(2).replace(".", ",");
    $("#upgChance").textContent = lv >= 15 ? "Zirve" : "%" + Math.min(100, CH[lv + 1] + pity);
    $("#upgPity").textContent = "+%" + pity;
    $("#upgBar").style.width = lv / 15 * 100 + "%";
    item.style.boxShadow = lv >= 7 ? `0 0 ${10 + lv * 4}px rgba(255,90,90,${.2 + lv * .04})` : "";
    ubtn.disabled = lv >= 15;
  };
  const say = (t, c = "") => { msg.textContent = t; msg.className = "upg-msg " + c; };
  ubtn.onclick = () => {
    if (lv >= 15) return;
    const ch = Math.min(100, CH[lv + 1] + pity);
    item.classList.remove("ok", "fail"); void item.offsetWidth;
    if (Math.random() * 100 < ch) {
      lv++; pity = 0; item.classList.add("ok");
      say(lv === 15 ? "EFSANE! +15'e ulaştın. Sunucuda adın konuşulur." : lv <= 5 ? `+${lv}! Güvenli bölgedesin, devam.` : `+${lv} tuttu! Güç x${MUL[lv].toFixed(2).replace(".", ",")}`, "good");
    } else {
      pity += 3; item.classList.add("fail");
      say(`Olmadı... Eşya sağlam, şans sayacı +%${pity}. Bir daha?`, "bad");
    }
    draw();
  };
  $("#upgReset").onclick = () => { lv = 0; pity = 0; say("+5'e kadar güvenli. Sonrası cesaret ister."); draw(); };
  draw();
}

/* ---------------- güç ---------------- */
function power() {
  const GS = [["Ekipman", 21], ["Skiller", 21], ["Taş basma", 9], ["Artı", 9], ["Skill seviyesi", 6], ["Efsun", 5], ["Rünler", 5],
    ["Eşya satırları", 4], ["Kamp", 4], ["Petler", 4], ["Yetenek ağacı", 3], ["Kitaplar", 3], ["Diğer", 6]];
  const cols = ["#f5c56b", "#ff9a3c", "#4fa3ff", "#ffe14d", "#ff5d6c", "#b56bff", "#6fd08c", "#9fb3ff", "#ff7a59", "#8fe0a8", "#ffb36b", "#a98bff", "#8a83a8"];
  $("#gsBars").innerHTML = `<h3>Bir kahramanın gücü</h3><p>Oyun sonunda güç kaynaklarının payı</p>` +
    GS.map(([n, v], i) => `<div class="gs"><span>${n}</span><div class="gs-track"><i style="--c1:${cols[i]}88;--c2:${cols[i]}" data-w="${v / 21 * 100}"></i></div><b>%${v}</b></div>`).join("");

  const ico = {
    up: '<path d="M12 3l7 8h-4v9H9v-9H5z"/>',
    spark: '<path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 18 3-18"/>',
    book: '<path d="M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-5a3 3 0 00-3 3"/>',
    tree: '<circle cx="12" cy="4" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/><path d="M12 6L5 10M12 6l7 4M5 14l3 4M19 14l-3 4"/>',
    anvil: '<path d="M3 7h13a5 5 0 01-5 5v3h3v4H6v-4h3v-3H6a3 3 0 01-3-3z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    crown: '<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/>',
  };
  const F = [
    ["up", "#f5c56b", "Artı basma", "Riskli ama adil. Güvenli bölge, yanmayan eşya, biriken şans."],
    ["spark", "#b56bff", "Efsun", "Eşyana rastgele özellikler. Bölgeye karşı efsun bossun zırhını deler."],
    ["gem", "#4fa3ff", "Taş basma", "Bölgelerden düşen seviyeli taşlar. Her yuva yeni bir güç."],
    ["book", "#6fd08c", "Rünler ve kitaplar", "Yeteneklerini dönüştür, nadir kitaplarla yeni kapılar aç."],
    ["tree", "#ff9a3c", "Yetenek ağacı", "Dev pasif ağaç, altın düğümleri, pet yuvalarını açan kol."],
    ["anvil", "#ff5d6c", "Kamp ve üretim", "Kaynak topla, ateşini büyüt, kendi eşyanı üret."],
    ["eye", "#8fe0a8", "Bestiary", "Her türün öldürme eşikleri kalıcı bonus verir, sekiz pet sana katılır."],
    ["crown", "#ffe14d", "Dünya bossu, kule, arena", "MMO ekonomisi: pazar, takas, sıralama. Hiçbir şey boşa birikmez."],
  ];
  $("#features").innerHTML = F.map(([ic, c, h, p], i) => `<div class="feat reveal" data-delay="${i % 2 + 1}" style="--fc:${c}"><div class="feat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">${ico[ic]}</svg></div><h4>${h}</h4><p>${p}</p></div>`).join("");
}

/* ---------------- petler ---------------- */
function pets() {
  const P = [["dog", "Sadık"], ["turtle", "Kabuk"], ["rabbit", "Pamuk"], ["fox", "Sis Tilkisi"], ["frog", "Vırak"], ["cat", "Kor Kedisi"], ["hippo", "Koca"],
    ["crow", "Ayaz Kargası"], ["penguin", "Buzcuk"], ["capybara", "Yıldız Kapibara"], ["deer", "Orman Geyiği"], ["chicken", "Kozmik Tavuk"], ["luckycat", "Şans Kedisi", "shop"],
    ["capy_pink", "Pembe Kapibara", "best"], ["wolf", "Boz Kurt", "best"], ["cat_black", "Gece Kedisi", "best"], ["frog_red", "Bataklık Kurbağası", "best"],
    ["rabbit_black", "Kül Tavşanı", "best"], ["fox_white", "Kar Tilkisi", "best"], ["cat_blue", "Astral Kedi", "best"], ["frog_yellow", "Altın Kurbağa", "best"]];
  const g = $("#petGrid");
  P.forEach(([f, n, t], i) => {
    const d = document.createElement("div");
    d.className = "pet reveal " + (t || ""); d.dataset.delay = (i % 4) + 1;
    d.innerHTML = `<div class="sprite"></div><b>${n}</b><span>${t === "best" ? "BESTIARY" : t === "shop" ? "MAĞAZA" : "MACERA"}</span>`;
    g.appendChild(d);
    const pd = PET(f), s = new Sprite($(".sprite", d), pd, 2.5 * pd.k);
    s.t = Math.random();
  });
}

/* ---------------- genel ---------------- */
const isVisible = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

function ui() {
  const nav = $("#nav"), bg = $(".hero-bg");
  const links = [...document.querySelectorAll(".nav-links a")];
  const secs = links.map(a => $(a.getAttribute("href")));
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle("scrolled", y > 40);
    if (y < innerHeight) bg.style.transform = `translateY(${y * .35}px)`;
    let cur = -1; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * .4) cur = i; });
    links.forEach((a, i) => a.classList.toggle("active", i === cur));
    strips.forEach(s => s.visible = isVisible(s.root));
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  $("#burger").onclick = () => $(".nav-links").classList.toggle("open");
  links.forEach(a => a.onclick = () => $(".nav-links").classList.remove("open"));

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in"); io.unobserve(e.target);
    e.target.querySelectorAll?.("[data-w]").forEach(i => i.style.width = i.dataset.w + "%");
  }), { threshold: .15 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));

  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const to = +e.target.dataset.count, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 1600); e.target.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .5 });
  document.querySelectorAll("[data-count]").forEach(el => cio.observe(el));

  $("#signup").onsubmit = e => { e.preventDefault(); e.target.classList.add("sent"); };
}

document.addEventListener("DOMContentLoaded", () => {
  strips.push(new Strip($("#stripHero"), { cls: "guardian", pet: "capybara" }));
  strips.push(new Strip($("#stripMini"), { cls: "guardian", pet: "fox", hud: false }));
  embers(); classes(); regions(); items(); power(); pets(); ui();
  requestAnimationFrame(loop);
});
addEventListener("load", () => setTimeout(() => $("#loader").classList.add("done"), 400));
