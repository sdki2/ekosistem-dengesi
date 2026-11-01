/**
 * All user-facing text. Add another language by copying `tr` and switching `LANG`.
 * Templates use {name} placeholders, filled by t(key, params).
 */

const tr = {
  app: {
    title: 'Ekosistem Dengesi',
    subtitle: 'Besin zincirini dengede tut!',
  },
  menu: {
    scenario: 'Senaryo',
    scenarioDesc: '8 bölüm, artan zorluk, yıldız topla',
    sandbox: 'Serbest Mod',
    sandboxDesc: 'Sınırsız bütçe, tüm ayarlar açık',
    encyclopedia: 'Ansiklopedi',
    tutorial: 'Nasıl oynanır?',
    back: 'Geri',
    chooseMap: 'Harita seç',
    forest: 'Orman',
    forestDesc: 'Çimenlik ve ağaç kümeleri. Ağaçların gölgesinde bitkiler yavaş büyür.',
    river: 'Nehir',
    riverDesc: 'Kıvrımlı bir nehir. Hayvanlar su içmeli; suya yakın bitkiler hızlı büyür.',
    seed: 'Tohum (harita no)',
    randomSeed: 'Rastgele',
    start: 'Başla',
    seasons: 'Mevsimler',
    randomEvents: 'Rastgele olaylar',
    level: 'Bölüm {n}',
    locked: 'Kilitli',
    stars: '{n}/3 yıldız',
    resetProgress: 'İlerlemeyi sıfırla',
    resetConfirm: 'Tüm bölüm ilerlemesi silinsin mi?',
  },
  hud: {
    day: 'Gün {n}',
    night: 'Gece',
    dayTime: 'Gündüz',
    budget: 'Eko puanı',
    budgetTip: 'Ekosistem puanı: hayvan ve bitki eklemek puan harcar. Biyoçeşitlilik sağlıklıyken puan kendiliğinden birikir.',
    unlimited: 'Sınırsız',
    goal: 'Hedef',
    menu: 'Menü',
    seasonNames: ['İlkbahar', 'Yaz', 'Sonbahar', 'Kış'],
    seasonIcons: ['🌸', '☀️', '🍂', '❄️'],
    noSeasons: 'Mevsimler kapalı',
  },
  controls: {
    play: 'Oynat (Boşluk)',
    pause: 'Duraklat (Boşluk)',
    step: 'Bir adım ilerle (N)',
    speed: 'Hız (T)',
    reset: 'Baştan başlat',
    newMap: 'Yeni harita (rastgele tohum)',
    settings: 'Ayarlar (Serbest mod)',
    sound: 'Ses (M)',
    help: 'Kısayollar (H)',
    follow: 'Kamerayla takip et (F)',
    unfollow: 'Takibi bırak',
    zoomIn: 'Yakınlaş (+)',
    zoomOut: 'Uzaklaş (−)',
    fit: 'Haritayı sığdır (0)',
  },
  tools: {
    plant: 'Bitki ek',
    plantTip: 'Fırçayla bitki ek. Fırça boyutu: [ ve ]. Maliyet: karo başına {cost} puan.',
    rabbit: 'Tavşan yerleştir',
    rabbitTip: 'Tıkla: bir tavşan ekle ({cost} puan). Basılı tutup sürükle: birden fazla.',
    wolf: 'Kurt yerleştir',
    wolfTip: 'Tıkla: bir kurt ekle ({cost} puan).',
    inspect: 'İncele',
    inspectTip: 'Bir hayvana ya da karoya tıklayıp bilgilerini gör. Sürükleyerek haritayı kaydır.',
    remove: 'Kaldır',
    removeTip: 'Fırça alanındaki hayvanları kaldır (ücretsiz).',
    brush: 'Fırça: {n}',
    notEnough: 'Yeterli eko puanı yok!',
    blocked: 'Buraya yerleştirilemez (ağaç ya da su).',
    capReached: 'Hayvan sınırına ulaşıldı ({n}).',
  },
  species: {
    plant: 'Bitki',
    plants: 'Bitkiler',
    rabbit: 'Tavşan',
    rabbits: 'Tavşanlar',
    wolf: 'Kurt',
    wolves: 'Kurtlar',
  },
  states: ['Dolaşıyor', 'Yiyecek arıyor', 'Otluyor', 'Kaçıyor', 'Su arıyor', 'Su içiyor', 'Uyuyor', 'Saklanıyor', 'Avlanıyor', 'Dinleniyor'],
  causes: {
    starved: 'açlık',
    old: 'yaşlılık',
    thirst: 'susuzluk',
    eaten: 'avlanma',
    disease: 'hastalık',
    removed: 'oyuncu kaldırdı',
  },
  tiles: {
    0: 'Çimenlik',
    1: 'Ağaç (geçilmez, gölge yapar)',
    2: 'Su (geçilmez)',
    3: 'Sığ geçit (içilebilir)',
    4: 'Çalılık (tavşanlara saklanma yeri)',
  } as Record<number, string>,
  inspector: {
    title: 'İnceleme',
    energy: 'Enerji',
    age: 'Yaş',
    ageDays: '{n} gün',
    state: 'Durum',
    thirst: 'Susuzluk',
    health: 'Sağlık',
    healthy: 'İyi beslenmiş',
    hungry: 'Aç',
    starving: 'Açlıktan ölmek üzere',
    tile: 'Karo',
    plantAmount: 'Bitki miktarı',
    regrowth: 'Yeniden büyüme hızı',
    waterDist: 'Suya uzaklık',
    tilesAway: '{n} karo',
    none: 'Bir hayvana ya da karoya tıkla.',
    gone: 'Bu hayvan artık yaşamıyor.',
    id: 'No',
  },
  stats: {
    title: 'İstatistikler',
    population: 'Nüfus grafiği',
    last50: 'Son 50 gün',
    all: 'Tümü',
    pyramid: 'Besin piramidi',
    pyramidTip: 'Her basamaktaki toplam biyokütle (canlı kütlesi). Sağlıklı bir ekosistemde üreticiler en geniş, yırtıcılar en dar basamaktır.',
    pyramidInverted: '⚠ Piramit ters döndü! Üst basamak, onu besleyen basamaktan büyük, bu durum sürdürülemez.',
    pyramidWarn: '⚠ Yırtıcı baskısı yüksek.',
    producers: 'Üreticiler (bitki)',
    primary: 'Birincil tüketiciler (tavşan)',
    secondary: 'İkincil tüketiciler (kurt)',
    plantCover: 'Bitki örtüsü',
    birthsToday: 'Bugün doğum',
    deathsToday: 'Bugün ölüm',
    biodiversity: 'Biyoçeşitlilik',
    biodiversityTip:
      'Shannon çeşitlilik indeksi: hem kaç tür olduğunu hem de bireylerin türlere ne kadar dengeli dağıldığını ölçer. 100 = üç grup (bitki kümeleri, tavşanlar, kurtlar) eşit dağılmış; 0 = tek tür kalmış.',
    phase: 'Faz grafiği (tavşan–kurt)',
    phaseTip: 'Yatay eksen tavşan, dikey eksen kurt sayısı. Av–avcı döngüsü burada saat yönünün tersine dönen bir halka çizer.',
    exportCsv: 'CSV indir',
    trendUp: 'artıyor',
    trendDown: 'azalıyor',
    trendFlat: 'sabit',
    perf: '{fps} FPS · tick {ms} ms · {n} hayvan',
    drawer: 'İstatistikler',
  },
  csv: {
    header: 'gun,bitki_ortusu_yuzde,tavsan,kurt,tavsan_dogum,kurt_dogum,tavsan_olum_aclik,tavsan_olum_avlanma,tavsan_olum_yaslilik,tavsan_olum_susuzluk,kurt_olum_aclik,kurt_olum_yaslilik,kurt_olum_susuzluk,biyocesitlilik',
    filename: 'ekosistem-verisi-gun{day}.csv',
  },
  events: {
    drought: {
      title: '☀️ Kuraklık!',
      text: 'Yağmur yağmıyor: bitkiler {days} gün boyunca %70 daha yavaş büyüyecek. Otçullar için yiyecek azalacak, bu da yırtıcıları da etkileyecek.',
    },
    disease: {
      title: '🦠 Salgın hastalık!',
      text: '{species} arasında bir hastalık yayıldı: {n} birey öldü. Kalabalık nüfuslarda hastalıklar daha hızlı yayılır.',
    },
    winter: {
      title: '❄️ Sert kış!',
      text: '{days} gün boyunca dondurucu soğuk: bitkiler neredeyse hiç büyümüyor ve hayvanlar ısınmak için daha çok enerji harcıyor.',
    },
    ended: '{name} sona erdi.',
    names: { drought: 'Kuraklık', disease: 'Salgın', winter: 'Sert kış' },
  },
  collapse: {
    title: 'Ekosistem çöktü!',
    subtitle: 'Bir tür yok oldu. Ne olduğuna birlikte bakalım:',
    retry: 'Baştan dene',
    rewind: '10 gün geri dön',
    rewindNone: '(10 gün önceki kayıt yok)',
    continue: 'Yine de devam et',
    menu: 'Ana menü',
    // narrative pieces
    rabbitPeak: 'Tavşan sayısı {day}. günde {n} ile zirve yaptı.',
    overgrazing: 'Bu kadar çok tavşan bitkileri yenilenebileceklerinden hızlı tüketti: bitki örtüsü {day}. günde %{p:dat} düştü (aşırı otlatma).',
    wolfPeak: 'Kurt sayısı {day}. günde {n:dat} yükseldi.',
    rabbitsGoneEaten: 'Tavşanlar çoğunlukla avlandı ve {day}. günde tükendi.',
    rabbitsGoneStarved: 'Tavşanlar çoğunlukla açlıktan öldü ve {day}. günde tükendi.',
    rabbitsGoneThirst: 'Tavşanlar susuz kaldı ve {day}. günde tükendi.',
    rabbitsGoneOther: 'Tavşanlar {day}. günde tükendi.',
    wolvesGoneStarved: 'Avları azalınca kurtlar açlıktan öldü; son kurt {day}. günde öldü.',
    wolvesGoneOld: 'Kurtlar yeterince çoğalamadı ve yaşlanarak öldü; son kurt {day}. günde öldü.',
    wolvesGoneOther: 'Son kurt {day}. günde öldü.',
    lesson: {
      rabbit: 'Ders: Av türü yok olunca, ona bağlı olan yırtıcı da hayatta kalamaz. Kurtları erken azaltmak ya da bitki ekmek tavşanlara nefes aldırabilirdi.',
      wolf: 'Ders: Yırtıcı olmadan otçullar kontrolsüz çoğalır ve bitkileri bitirir. Az sayıda kurdu dengeli tutmak, tavşanları da korur.',
    },
  },
  levels: {
    goalSurvive: 'Üç türü de {days} gün hayatta tut.',
    goalRecover: '{days}. güne kadar üç türü de yaşat ve son 15 günde bitki örtüsünü ortalama %{cover:gen} üzerinde tut.',
    goalStable: '{days} gün boyunca üç türü yaşat; 20. günden sonra tavşan nüfusunun değişkenliği (CV) {cv:abl} küçük olsun.',
    progress: 'İlerleme: {day}/{days} gün',
    star1: 'Hedefi tamamla',
    star2: 'Ortalama biyoçeşitlilik ≥ {n}',
    star3: 'Bütçenin en fazla %{n:poss} harca',
    list: [
      { title: 'İlk Adımlar', intro: 'Küçük bir orman. Bitkiler, tavşanlar ve kurtlar zaten var. Dengeyi gözlemle; gerekirse küçük dokunuşlar yap.' },
      { title: 'Aşırı Otlatma', intro: 'Bu ormanda hiç yırtıcı yok ve tavşanlar her yeri yiyip bitiriyor. Kurt getirerek bitkileri kurtar!' },
      { title: 'Kuraklık', intro: 'Nehir vadisinde 15. günde bir kuraklık başlayacak. Suya yakın yerler daha dayanıklı. Türleri kuraklıktan sağ çıkar.' },
      { title: 'Denge Döngüsü', intro: 'Av–avcı nüfusları doğal olarak dalgalanır. Dalgalanmaları küçük tut: istikrarlı bir döngü kur.' },
      { title: 'Kısıtlı Bütçe', intro: 'Az sayıda hayvanla ve çok az puanla başlıyorsun. Her hamleni dikkatle seç.' },
      { title: 'Dört Mevsim', intro: 'Mevsimler açık: ilkbaharda bolluk, kışta kıtlık. Ekosistemi iki tam yıl boyunca yaşat.' },
      { title: 'Beklenmedik Olaylar', intro: 'Hastalık, kuraklık ve sert kış her an gelebilir. 30. günde tavşanlar arasında bir salgın bekleniyor.' },
      { title: 'Usta Ekolojist', intro: 'Nehir, mevsimler, rastgele olaylar ve küçük bir bütçe. Gerçek bir ekolog gibi düşün!' },
    ],
  },
  summary: {
    winTitle: 'Bölüm tamamlandı! 🎉',
    good: 'İyi gidenler',
    bad: 'Zorluklar',
    fact: 'Biliyor muydun?',
    next: 'Sonraki bölüm',
    retry: 'Tekrar oyna',
    menu: 'Bölüm listesi',
    goodDiversity: 'Ortalama biyoçeşitlilik {n} ile yüksek kaldı.',
    goodCycle: 'Tavşan nüfusu {n} kez zirve yaptı: gerçek bir av–avcı döngüsü kurdun.',
    goodBudget: 'Bütçenin yalnızca %{n:poss} harcadın: doğa işini kendi yaptı.',
    goodNoSpend: 'Hiç eko puanı harcamadın: doğa işini kendi yaptı.',
    goodPlants: 'Bitki örtüsü hiçbir zaman %{n:gen} altına düşmedi.',
    badPlants: 'Bitki örtüsü {day}. günde %{p:dat} kadar düştü (aşırı otlatma).',
    badWolvesLow: 'Kurt sayısı {day}. günde {n:dat} kadar indi, yok olmaya çok yaklaştı.',
    badRabbitsLow: 'Tavşan sayısı {day}. günde {n:dat} kadar indi.',
    badEvents: '{n} olumsuz olay atlattın.',
    nothingBad: 'Ciddi bir sorun yaşanmadı. Harika!',
  },
  encyclopedia: {
    title: 'Ansiklopedi',
    cards: [
      {
        id: 'chain',
        icon: '🔗',
        title: 'Besin zinciri',
        body:
          'Besin zinciri, enerjinin bir canlıdan onu yiyen canlıya nasıl aktarıldığını gösterir: Güneş → ot (üretici) → tavşan (birincil tüketici) → kurt (ikincil tüketici). Ayrıştırıcılar (bakteriler ve mantarlar) ölü canlıları parçalayarak mineralleri toprağa geri kazandırır. Doğada zincirler birbirine bağlanarak besin ağlarını oluşturur. Bir halka koparsa (örneğin tavşanlar yok olursa) ona bağlı olan bütün halkalar etkilenir.',
      },
      {
        id: 'pyramid',
        icon: '🔺',
        title: 'Besin piramidi',
        body:
          'Bir beslenme basamağından diğerine enerjinin yalnızca yaklaşık %10\'u aktarılır; geri kalanı solunum, hareket ve ısı olarak kaybolur (%10 kuralı). Bu yüzden üreticilerin toplam biyokütlesi en büyük, yırtıcılarınki en küçüktür. Oyundaki piramit "ters dönerse" yani üst basamak alttakinden büyük olursa yırtıcılar avlarını kısa sürede tüketir. Not: Bazı su ekosistemlerinde fitoplankton çok hızlı çoğaldığı için biyokütle piramidi ters görünebilir, ama enerji piramidi hiçbir zaman ters dönmez.',
      },
      {
        id: 'producers',
        icon: '🌱',
        title: 'Üretici ve tüketici',
        body:
          'Üreticiler (bitkiler, algler) fotosentezle güneş enerjisini besine dönüştürür. Tüketiciler besinlerini başka canlılardan alır: otçullar (birincil tüketici) bitki, etçiller (ikincil ya da üçüncül tüketici) hayvan yer, hepçiller ikisini de yer. Ayrıştırıcılar ise ölü maddeyi parçalar. Üreticiler olmadan hiçbir tüketici yaşayamaz.',
      },
      {
        id: 'capacity',
        icon: '📦',
        title: 'Taşıma kapasitesi',
        body:
          'Taşıma kapasitesi (K), bir ortamın besin, su ve alan gibi kaynaklarla uzun süre destekleyebileceği en büyük nüfustur. Nüfus K\'ya yaklaştıkça büyüme yavaşlar (S biçimli, lojistik büyüme). Nüfus K\'yı aşarsa kaynaklar tükenir ve nüfus hızla düşer; buna "aşım ve çöküş" denir. Oyunda tavşanların taşıma kapasitesini bitkiler belirler.',
      },
      {
        id: 'cycle',
        icon: '🔄',
        title: 'Av–avcı döngüsü',
        body:
          'Av bol olduğunda avcılar iyi beslenir ve çoğalır. Avcı arttıkça av azalır; av azalınca avcılar aç kalır ve azalır; avcı azalınca av yeniden çoğalır. Bu döngüyü 1920\'lerde Lotka ve Volterra matematiksel olarak modelledi. Avcı nüfusu, av nüfusunu biraz gecikmeyle izler. Gerçek bir örnek: Kanada\'da kar tavşanı ile vaşak nüfusları yaklaşık 10 yıllık döngüler gösterir (Hudson\'s Bay Company\'nin kürk kayıtları).',
      },
      {
        id: 'biodiversity',
        icon: '🦋',
        title: 'Biyolojik çeşitlilik',
        body:
          'Biyolojik çeşitlilik; tür çeşitliliğini, türlerin içindeki genetik çeşitliliği ve ekosistem çeşitliliğini kapsar. Çeşitli ekosistemler kuraklık ve hastalık gibi bozulmalara karşı daha dirençlidir. Oyundaki Shannon indeksi hem tür sayısını hem de bireylerin türlere ne kadar dengeli dağıldığını ölçer: tek bir tür baskın olursa değer düşer.',
      },
      {
        id: 'overgrazing',
        icon: '🏜️',
        title: 'Aşırı otlatma',
        body:
          'Otçullar bitkileri yenilenebileceklerinden daha hızlı yediğinde aşırı otlatma olur. Toprak çıplak kalır, kökler zayıflar; rüzgâr ve yağmur toprağı taşır (erozyon) ve bölge çölleşebilir. Dünyanın birçok yerinde, Türkiye\'deki bazı meralar da dahil, aşırı otlatma erozyonu hızlandırır. Yırtıcılar otçul nüfusunu sınırlayarak bitki örtüsünü dolaylı yoldan korur.',
      },
      {
        id: 'keystone',
        icon: '🗝️',
        title: 'Anahtar tür',
        body:
          'Anahtar tür, sayısına göre ekosistem üzerinde çok büyük etkisi olan türdür; ortadan kalkarsa ekosistem büyük ölçüde değişir. Ünlü örnek Yellowstone Milli Parkı (ABD): Kurtlar 1920\'lerde bölgeden yok edildi ve geyik (wapiti) sayısı arttı; geyikler söğüt ve kavak fidanlarını aşırı otladı. 1995–1996\'da Kanada\'dan getirilen 31 kurt parka salındı. Geyik sayısı azaldı ve davranışları değişti; bazı bölgelerde söğütler toparlandı ve kunduz kolonileri arttı. Bir yırtıcının bütün besin ağını etkilemesine "trofik kaskad" denir. Etkilerin büyüklüğü bilim insanları arasında hâlâ tartışılıyor.',
      },
    ],
  },
  facts: [
    'Avrupa yaban tavşanı uygun koşullarda yılda birkaç kez, her seferinde 3–7 yavru doğurabilir.',
    '1859\'da Avustralya\'ya salınan 24 yaban tavşanı, birkaç on yılda yüz milyonlarca bireye ulaştı, çünkü orada onları sınırlayacak yırtıcılar yoktu.',
    'Kurt sürüleri genellikle bir üreyen çift ile onların farklı yaşlardaki yavrularından oluşan bir ailedir.',
    'Bitkiler üzerlerine düşen güneş enerjisinin yalnızca yaklaşık %1–2\'sini kimyasal enerjiye dönüştürür.',
    'Kanada\'da kar tavşanı ve vaşak nüfusları yaklaşık 10 yıllık döngülerle birlikte iner çıkar.',
    'Shannon indeksi, aslen 1948\'de Claude Shannon\'ın bilgi kuramından gelir; ekologlar onu çeşitliliği ölçmek için ödünç aldı.',
    'Bir gram verimli toprakta milyonlarca, hatta milyarlarca bakteri bulunabilir; bunlar besin döngüsünün görünmez kahramanlarıdır.',
    'Türkiye\'de yaban kurdu (Canis lupus) hâlâ yaşar ve dağlık, ormanlık bölgelerde önemli bir yırtıcıdır.',
    'Bir besin zincirinde genellikle 4–5\'ten fazla basamak olmaz, çünkü her basamakta enerjinin çoğu kaybolur.',
    'Yellowstone\'da kurtların geri dönüşünden sonra geyikler bazı vadilerde daha az zaman geçirmeye başladı; buna "korku ekolojisi" denir.',
  ],
  tips: {
    pyramid: 'Besin piramidin ters döndü! Yırtıcılar avlarından fazla. Ansiklopedide "Besin piramidi" kartına göz at.',
    overgrazing: 'Bitki örtüsü çok azaldı: aşırı otlatma! Bitki ekebilir ya da otçul sayısını azaltabilirsin.',
    firstWolf: 'Kurtlar bir "anahtar tür" olabilir: otçulları sınırlayarak bitkileri korurlar.',
    cycle: 'Grafiğe bak: tavşan zirvesinden biraz sonra kurtlar zirve yapıyor. Bu bir av–avcı döngüsü!',
    drought: 'Kuraklıkta suya yakın bölgeler daha uzun süre yeşil kalır.',
    readMore: 'Kartı aç',
    dismiss: 'Tamam',
  },
  tutorial: {
    next: 'İleri',
    prev: 'Geri',
    skip: 'Geç',
    done: 'Başla!',
    steps: [
      { title: 'Hoş geldin, ekolog! 🌿', text: 'Bu küçük dünyada bitkiler, tavşanlar ve kurtlar yaşıyor. Görevin: hiçbir tür yok olmasın.' },
      { title: 'Dünya', text: 'Burası ekosistemin. Fareyle sürükleyerek gez, tekerlekle yakınlaş. Yeşil alanlar bol bitki, sarı-kahverengi alanlar otlanmış toprak demek.' },
      { title: 'Araçlar', text: 'Bitki ek, tavşan ya da kurt yerleştir, incele veya kaldır. Kısayollar: 1–5. Her yerleştirme eko puanı harcar.' },
      { title: 'Zaman', text: 'Oynat/duraklat (Boşluk) ve hız düğmeleri. Bir gün 10 saniye sürer; hızlandırarak uzun döngüleri gözlemleyebilirsin.' },
      { title: 'İstatistikler', text: 'Nüfus grafiği, besin piramidi ve biyoçeşitlilik burada. Piramit kırmızıya dönerse dikkat!' },
      { title: 'Ansiklopedi', text: 'Takıldığında 📖 düğmesine bas: besin zinciri, taşıma kapasitesi, anahtar türler ve daha fazlası.' },
    ],
  },
  settings: {
    title: 'Simülasyon ayarları',
    reset: 'Varsayılanlara dön',
    groups: { plant: 'Bitkiler', rabbit: 'Tavşanlar', wolf: 'Kurtlar', world: 'Dünya' },
    regrowMul: 'Bitki büyüme hızı',
    rabbitRepro: 'Tavşan üreme aralığı (gün)',
    rabbitLitter: 'Tavşan en fazla yavru',
    rabbitPlantEnergy: 'Bitkiden kazanılan enerji',
    rabbitLifespan: 'Tavşan ömrü (gün)',
    rabbitVision: 'Tavşan görüş mesafesi',
    rabbitMetabolism: 'Tavşan enerji tüketimi',
    wolfRepro: 'Kurt üreme aralığı (gün)',
    wolfPreyEnergy: 'Avdan kazanılan enerji',
    wolfLifespan: 'Kurt ömrü (gün)',
    wolfVision: 'Kurt görüş mesafesi',
    wolfMetabolism: 'Kurt enerji tüketimi',
    wolfCatch: 'Av yakalama şansı',
    seasons: 'Mevsimler',
    randomEvents: 'Rastgele olaylar',
    triggerEvent: 'Olay başlat',
  },
  help: {
    title: 'Klavye kısayolları',
    rows: [
      ['Boşluk', 'Oynat / duraklat'],
      ['N', 'Bir adım ilerle'],
      ['T', 'Hızı değiştir (1×, 2×, 4×, 8×)'],
      ['1–5', 'Araç seç'],
      ['[  ]', 'Fırça boyutu'],
      ['Ok tuşları', 'Kamerayı kaydır'],
      ['+  −  0', 'Yakınlaş / uzaklaş / sığdır'],
      ['F', 'Seçili hayvanı takip et'],
      ['M', 'Ses aç/kapat'],
      ['E', 'Ansiklopedi'],
      ['Esc', 'Seçimi kaldır / pencereyi kapat'],
    ] as [string, string][],
  },
  misc: {
    close: 'Kapat',
    ok: 'Tamam',
    on: 'Açık',
    off: 'Kapalı',
    loading: 'Yükleniyor…',
    motionReduced: 'Azaltılmış hareket etkin',
  },
};

export type Dict = typeof tr;

export const LANG = 'tr';
export const STR: Dict = tr;

/**
 * Fill {placeholders} in a template string. A Turkish case suffix can follow the
 * name: {n:dat} → "30'a", {n:gen} → "20'nin", {n:abl} → "0,55'ten",
 * {n:poss} → "30'unu" (3rd-person possessive + accusative).
 */
export function fmt(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)(?::(\w+))?\}/g, (_, k: string, suf?: string) => {
    if (!(k in params)) return `{${k}}`;
    const v = String(params[k]);
    return suf ? `${v}'${trSuffix(v, suf as SuffixKind)}` : v;
  });
}

export type SuffixKind = 'dat' | 'gen' | 'acc' | 'abl' | 'loc' | 'poss';

const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

/** the last word said when reading a number aloud in Turkish */
function lastSpokenWord(numStr: string): string {
  const s = numStr.replace(/[^0-9,]/g, '');
  const part = s.includes(',') ? s.split(',').pop()! : s;
  const n = Number(part) || 0;
  if (n === 0) return 'sıfır';
  if (n % 10) return ONES[n % 10]!;
  if (n % 100) return TENS[(n % 100) / 10]!;
  if (n % 1000) return 'yüz';
  if (n % 1000000) return 'bin';
  return 'milyon';
}

/** Turkish case suffix for a number (vowel harmony, buffer letters, hard consonants). */
export function trSuffix(numStr: string, kind: SuffixKind): string {
  const w = lastSpokenWord(numStr);
  const vowels = w.match(/[aıoueiöü]/g) ?? ['e'];
  const last = vowels[vowels.length - 1]!;
  const two = 'aıou'.includes(last) ? 'a' : 'e';
  const four = 'aı'.includes(last) ? 'ı' : 'ei'.includes(last) ? 'i' : 'ou'.includes(last) ? 'u' : 'ü';
  const endsVowel = /[aıoueiöü]$/.test(w);
  const hard = /[fstkçşhp]$/.test(w);
  switch (kind) {
    case 'dat': return (endsVowel ? 'y' : '') + two;
    case 'acc': return (endsVowel ? 'y' : '') + four;
    case 'gen': return (endsVowel ? 'n' : '') + four + 'n';
    case 'abl': return (hard ? 't' : 'd') + two + 'n';
    case 'loc': return (hard ? 't' : 'd') + two;
    case 'poss': return (endsVowel ? 's' : '') + four + 'n' + four;
  }
}

/** Format a number the Turkish way (1.234,5). */
export function num(n: number, digits = 0): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
