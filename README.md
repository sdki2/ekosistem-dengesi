# 🌿 Ekosistem Dengesi

Bitkiler, tavşanlar ve kurtlardan oluşan küçük bir ekosistemi yönettiğin eğitici bir tarayıcı oyunu.
Amaç: besin zincirini dengede tutmak ve hiçbir türün yok olmamasını sağlamak. Oyun; besin zinciri,
besin piramidi, taşıma kapasitesi, av–avcı döngüleri ve biyolojik çeşitlilik konularında sezgi
kazandırmak için tasarlandı (lise düzeyi).

Tamamen çevrimdışı çalışır: sunucu yok, dış görsel ya da ses dosyası yok. Bütün çizimler ve sesler
kodla üretilir. Nunito yazı tipi pakete gömülüdür (`@fontsource/nunito`, açık lisans).

## Çalıştırma

Gerekenler: [Node.js](https://nodejs.org) 18 veya üzeri.

```bash
npm install
npm run dev        # http://localhost:5199 adresinde açılır
```

Diğer komutlar:

| Komut | Ne yapar |
|---|---|
| `npm run build` | Tip denetimi + `dist/` klasörüne üretim derlemesi |
| `npm run preview` | Derlenmiş sürümü yerelde açar |
| `npm test` | Birim testleri + başsız (headless) denge testleri (≈40 sn) |
| `npm run balance` | Ayrıntılı denge raporu: senaryolar, hayatta kalma oranları, performans |
| `npm run typecheck` | Yalnızca TypeScript denetimi (strict) |

Adres çubuğuna `?perf` eklersen FPS ve tick süresi ekranda görünür; `?stress` ise ~1.500 hayvanla
performans testi başlatır (sonuçlar 10 saniyede bir konsola da yazılır).

## Oynanış

- **Senaryo modu:** 8 bölüm. Her bölümün bir hedefi var. Yıldızlar: ⭐ hedefi tamamla, ⭐⭐ ortalama
  biyoçeşitlilik eşiği, ⭐⭐⭐ bütçenin belli bir kısmından azını harca. Bir bölümü bitirince sonraki
  açılır; ilerleme tarayıcıda (localStorage) saklanır.
- **Serbest mod:** Sınırsız bütçe, harita/tohum seçimi, mevsimler ve rastgele olaylar. ⚙️ ayarlar
  panelinde üreme hızı, enerji kazancı, ömür, görüş mesafesi gibi değerler kaydırıcılarla değişir.
  Faz grafiği (tavşan–kurt döngüsü) yalnızca bu modda görünür.
- **Eko puanı:** Hayvan ve bitki eklemek puan harcar. Biyoçeşitlilik sağlıklıyken (≥40) her gün puan
  birikir. Kaldırmak ücretsizdir.
- **Çöküş:** Bir tür yok olursa oyun durur ve kayıtlı verilerden *ne olduğunu* anlatan bir pencere açılır.
  Baştan deneyebilir ya da 10 gün geriye dönebilirsin.

### Kontroller

| Tuş / hareket | İşlev |
|---|---|
| Boşluk | Oynat / duraklat |
| N | Bir adım (tick) ilerle |
| T | Hız: 1× → 2× → 4× → 8× |
| 1–8 | Araçlar: 🌱 Bitki ek · 🐇 Tavşan · 🐺 Kurt · 🔍 İncele · ✋ Kaldır · 🦌 Geyik · 🦊 Tilki · 🐻 Ayı |
| [ ve ] | Fırça boyutu |
| Fare tekerleği / iki parmak (sıkıştır) | Yakınlaş / uzaklaş |
| Sürükle (İncele aracında) · sağ/orta tuşla sürükle · iki parmak | Haritayı kaydır |
| Ok tuşları, + − 0 | Kamera kaydır, yakınlaş, haritayı sığdır |
| F | Seçili hayvanı kamerayla takip et |
| E · H · M · Esc | Ansiklopedi · kısayollar · ses · seçimi/pencereyi kapat |

İncele aracıyla bir hayvana tıklayınca enerjisi, yaşı, durumu ve sağlık rengi (yeşil iyi, sarı aç,
kırmızı açlıktan ölmek üzere; her zaman yazı ve simgeyle birlikte) görünür.

## Ekolojik model

Simülasyon **etmen tabanlıdır** (agent-based): her hayvan kendi kararlarını verir. Zaman sabit
adımlarla (tick) ilerler: 1 oyun günü = 20 tick = 1× hızda 10 saniye. Rastgelelik tohumlu bir sayı
üretecinden gelir, yani aynı tohum ve aynı hamleler her zaman aynı sonucu verir.

- **Bitkiler (üreticiler):** Her karonun %0–100 bitki miktarı vardır. Bitkiler sabit hızla yeniden
  büyür. Hız mevsime (ilkbahar hızlı, kış çok yavaş), ağaç gölgesine (yavaş) ve suya uzaklığa bağlıdır
  (nehrin yanında 2×, uzakta 0,5×). Kökleri zarar görmüş çıplak karolar çok daha yavaş toparlanır;
  aşırı otlatma haritada kahverengi lekeler olarak görünür.
- **Tavşanlar (birincil tüketiciler):** Her tick enerji harcar, otlayarak enerji kazanır. İnce otlu
  yerleri bırakıp daha gür yerlere geçer (optimal beslenme, "vazgeçme yoğunluğu"). Kurdu görünce kaçar
  (kısa süre kurttan hızlıdır, sonra yorulur) ve çalılıklara saklanır. Olgunlaştıktan sonra enerjisi
  yeterliyse yavrular; enerjisini yavrularla paylaşır. Çok kalabalık yuvalarda üremez. Açlık, yaşlılık,
  susuzluk (nehir haritası) ya da avlanma ile ölür.
- **Kurtlar (ikincil tüketiciler):** Daha çok besine ihtiyaç duyar, daha yavaş ve az yavruyla ürer.
  Yalnızca acıktığında avlanır; avdan sonra bir süre dinlenir (doygunluk). Gevşek sürüler hâlinde
  dolaşır; bölgede çok kurt varsa üremez (bölgesellik).

### Denge ayarı nasıl yapıldı?

Saf etmen tabanlı av–avcı modelleri kolayca çöker: kurtlar tavşanları bitirir, sonra kendileri açlıktan
ölür. Tüm sayılar `src/config.ts` içinde, açıklamalarıyla birlikte duruyor. Ayar süreci:

1. Başsız (görüntüsüz) bir test düzeneği yazıldı (`tests/balance/`).
2. Rastgele arama + tepe tırmanma ile parametreler 300 günlük çok sayıda simülasyonda denendi.
3. Ezberlemeyi önlemek için sonuç, aramada hiç kullanılmamış tohumlarla doğrulandı.

Çıkan sonuç ekoloji kuramıyla örtüşüyor (Rosenzweig–MacArthur modeli): **biraz "verimsiz" bir
yırtıcı** (kısa görüş, büyük ama seyrek öğünler) av nüfusunu taşıma kapasitesinin yarısının üzerinde
tutar ve çöküş yerine sönümlü dalgalanmalar oluşur. Diğer dengeleyiciler: bitki taşıma kapasitesi,
kurt doygunluğu, çalılık sığınakları, kurt bölgeselliği ve tavşan yuva kalabalığı.

Sonuçlar (oyuncu hiçbir şey yapmadan, 60 tavşan + 6 kurt, 300 gün; v1.3 öncesi ayarlarla ölçüldü, güncel rakamlar için `npm run balance`):

| Harita | Hayatta kalma | Not |
|---|---|---|
| Orman (Kolay) | %95 (20 tohum; 40 tohumda da %95) | Her koşuda ~4 tavşan zirvesi, döngü ≈ 60–75 gün |
| Nehir | %93 (40 tohum) | Su ihtiyacı ve nehrin böldüğü bölgeler işi zorlaştırır |

Her senaryo bölümü, kurallara göre davranan basit bir "makul oyuncu" betiğiyle de çözülüyor
(`tests/balance/player.ts`): 20 tohumda %90–100 başarı. Zor bölümler oyuncu müdahalesi olmadan
çoğu zaman çöker; bu bilinçli bir tasarım. Güncel raporu görmek için: `npm run balance`.

v1.3 ile tavşanlar daha az ürer: yuva kalabalığı daha geniş bir alanda sayılır, böylece nüfus ~950 yerine
~300–400 civarında zirve yapar. Bu güçlü yoğunluk bağımlılığı av–avcı dalgalarını sönümler ve uzatır (yine
Rosenzweig–MacArthur); test artık her koşuda en az bir belirgin patlama–çöküş istiyor.

**Performans:** ~1.400 hayvanla bir tick ≈ 0,6 ms (komşu aramaları için uzamsal ızgara/hash).
En yüksek hızda (8×, saniyede 160 tick) bile kare başına yaklaşık 2 ms simülasyon süresi düşer.

### Hava durumu ve su

Hava durumu 3. bölümden itibaren (ve Serbest modda isteğe bağlı) açıktır. Tohumlu, ayrı bir rastgele
sayı akışından çıkar: açık, bulutlu, yağmurlu, fırtına, sıcak hava, sis ve kar. Her hava birkaç saat
sürer, hangisinin geleceği mevsime bağlıdır ve sağ paneldeki "Hava ve toprak" kartında bir sonraki
hava önceden görünür. Kuraklık ve sert kış olayları da havayı o yöne iter.

- **Toprak nemi (0–1):** Yağmur ve fırtına nemi artırır; açık ve sıcak hava azaltır (uzun kuru dönemde
  %0'a iner). Bitki büyüme hızı `(0,5 + nem) × havanın kendi çarpanı` ile ölçeklenir: yağmurda hızlı, sıcakta
  ve karda çok yavaş.
- **Su seviyesi:** Nehir ve göller toprak nemini yavaşça izler. Kuraklıkta kıyıdaki sığ karolar çamur
  düzlüğüne dönüşür (nehir daralır, göller küçülür); yağmurlarla yeniden dolar. Taşan sular kıyıdaki
  hayvanları en yakın kuru karaya taşır. Orman haritasında artık iki küçük göl vardır, bu yüzden orada da
  susuzluk ve su arama vardır.
- **Fırtına:** Yıldırım düşer; çevresindeki otlar yanar, açıkta kalan hayvan ölebilir. Tavşanlar ve geyikler
  çalılıkta saklanır, kurtlar avlanmayı bırakır (çok açlarsa hariç).
- **Görüş:** Sis (×0,55) ve fırtına (×0,6) hem avcının hem avın görüşünü kısaltır; yağmur kurtların koku
  takibini azaltır.
- **Sıcak ve soğuk:** Sıcakta hayvanlar daha çok susar, öğle saatlerinde dinlenir (siesta) ve daha çok enerji
  harcar; kar ve fırtına da enerji harcatır.
- Hava kapalıyken kuraklık/yağış etkisi yoktur. Geri sarma, hava ve su seviyesini de geri getirir.

Çizim tarafında yağmur çizgileri, kar taneleri, sis, sıcak parıltı ve simülasyondaki yıldırım düşüşlerine
bağlı şimşek vardır; "hareketi azalt" açıksa yalnızca renk tonları gösterilir.

### Mevsimler

Bir yıl 60 gündür (her mevsim 15 gün). Serbest modda mevsimler varsayılan olarak açıktır; 6., 7. ve 8. bölümlerde
de açıktır.

- **Bitkiler:** İlkbaharda hızlı, yazın normal, sonbaharda yavaş, kışın çok yavaş büyür.
- **Üreme:** Tavşanlar yıl boyu ürer (kışın daha az besinle). Kurtlar kış dışında; geyik, tilki ve ayı yalnızca
  ilkbahar ve yazın yavrular.
- **Kışa uyum:** Tavşanlar kışın çalılıklarda kabuk ve dal kemirir, kalın tüyleri sayesinde daha az enerji harcar.
  Kar üzerindeki izler kurtların çalılıkta saklanan avı bulmasını kolaylaştırır. Ayılar kış boyu uyur
  (kış uykusu); sonbaharda kış için doyasıya yer.
- **Görünüm:** İlkbaharda taze yeşil ve çiçek açan kiraz ağaçları, sonbaharda turuncu-kırmızı yapraklar, kışın
  karla kaplı zemin, yapraksız ağaçlar ve karlı çam dalları.

### Gece ve gündüz

- **Görüş:** Gündüz hayvanları (tavşan, geyik, ayı) gece çok az görür (×0,6). Kurtlar ve tilkiler gece avcısıdır:
  karanlıkta iyi görürler ve gece ile alacakaranlıkta avları daha kolay yakalanır.
- **Davranış:** Tavşanlar şafak ve alacakaranlıkta daha hızlı otlar, gece uyur. Tilkiler gündüz çalılıktaki
  inlerinde uyur, gece avlanır. Ayılar gece uyur. Tok kurtlar gece ve sıcak öğlede dinlenir.
- **Bitkiler:** Fotosentez yalnızca gün ışığında olur: gece bitkiler neredeyse hiç büyümez, gündüz daha hızlı
  büyür (günlük toplam aynı kalır).
- **Görünüm:** Geceler daha karanlıktır, ay ışığı kenarları karartır, kurt ve tilki gözleri karanlıkta parlar.

### Hayvanlar

| Tür | Beslenme | Öne çıkan davranış |
|---|---|---|
| 🐇 Tavşan | Ot (kışın kabuk) | Hızlı ürer; kalabalık yuvalarda üremez, bu yüzden nüfus birkaç yüzde kalır. Avcıdan kaçar, çalılığa saklanır. |
| 🦌 Geyik | Ot ve çalı yaprakları | Büyük, yavaş ürer. Yalnızca avlanan ya da çok yakın avcıdan kaçar. Kurt için zor ama doyurucu av. |
| 🐺 Kurt | Tavşan, geyik | Gevşek sürüler, bölgesellik. Gece avcısı. Ayıdan uzak durur. |
| 🦊 Tilki | Tavşan, fare ve böcek | Yalnız, gece avcısı; gündüz çalılıkta uyur. Kurt ve ayıdan kaçar. |
| 🐻 Ayı | Böğürtlen (çalılık), ot, balık, ara sıra tavşan ya da geyik | Su kenarında balık tutar. Geniş, yalnız bölgeler. Kış uykusuna yatar. |

Oyunun bitmesi için tavşanların ya da kurtların yok olması gerekir; geyik, tilki ve ayının yok olması oyunu
bitirmez. Geyikler 1–8, tilkiler 3–8, ayılar 6–8. bölümlerde vardır.

**Denge (300 gün, oyuncu yok, 20 tohum, mevsimler ve hava açık, 50 tavşan, 5 kurt, 12 geyik, 4 tilki, 2 ayı):**
tavşan ve kurt orman ve nehirde 20/20 hayatta. Geyik ormanda ~17/20, nehirde ~19/20; ayı ~15/20. Tilkiler
nehirde ~16/20, ormanda yalnızca ~6/20 hayatta kalıyor: orman tilkileri sık sık yok oluyor.

### Basitleştirmeler

Bu bir öğretim modeli, gerçek bir ekosistemin tamamı değil:

- Üreme eşeysizdir (eş aranmaz).
- Hayvanların sayısı ve davranışları çok basitleştirilmiştir (ör. fareler ve balıklar ayrı birer canlı değil, yalnızca bir besin şansıdır).
- Biyokütle birimleri soyuttur. Piramit gerçek kilogramları değil, oyundaki göreli oranları gösterir.
- Shannon indeksi için bitkiler "bitki kümeleri" olarak sayılır (her ~8 bitkili karo bir birey).

## Proje yapısı

```
src/
  config.ts          Tüm ayarlanabilir sayılar (açıklamalı) + ekonomi
  sim/               Saf simülasyon (DOM yok): dünya, ızgara, harita üretimi, etmenler,
                     davranışlar, uzamsal hash, RNG, istatistikler
  game/              Oyun kuralları: oturum, bütçe, hedefler, yıldızlar, geri sarma, anlatı, kayıt
  render/            Canvas çizimi: kamera, prosedürel sprite'lar, efektler, gece/gündüz
  ui/                Arayüz: üst çubuk, araçlar, istatistik paneli, grafikler, pencereler,
                     öğretici, ses (Web Audio)
  content/           i18n.ts (tüm metinler), levels.ts (bölümler), palette.ts (renkler)
tests/               Vitest birim testleri + başsız denge testleri
```

Başka bir dil eklemek için `src/content/i18n.ts` içindeki `tr` nesnesini kopyalayıp çevirmen yeterli.

## Erişilebilirlik

- Anlam hiçbir yerde yalnızca renkle verilmez: durumlar simge ve yazıyla da gösterilir, grafikte
  kurt ve bitki çizgileri kesikli çizilir.
- Tüm araçlar ve kontroller klavyeyle kullanılabilir.
- İşletim sisteminde "hareketi azalt" açıksa animasyonlar ve efektler azaltılır.
- Ortam sesleri varsayılan olarak kapalıdır (🔇 düğmesi ya da M tuşu).
