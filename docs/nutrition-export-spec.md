# Spesifikasi Struktur Ekspor — AtletikPro → Nutrition Engine

Struktur data (bukan implementasi) untuk mengekspor data atlet dari aplikasi latihan (atletik & renang) ke Nutrition Engine. Dirancang generik lintas cabang — field `category`/`event` bebas format, disesuaikan konvensi sistem sumber masing-masing.

## Isi Paket

| File | Isi |
|---|---|
| `nutrition-export-schema.json` | JSON Schema formal (draft-07) — bisa dipakai validasi otomatis di pipeline Anda |
| `example-athletics.json` | Contoh nyata: Sprint 200m + Lompat Tinggi |
| `example-swimming.json` | Contoh nyata: Freestyle Sprint + Freestyle Distance, termasuk pola sesi ganda (pagi+sore) |
| `energy.js`, `carbohydrate.js`, `protein-fat-safety.js`, `index.js` | Salinan nutrition-engine (dari paket sebelumnya) untuk referensi/pengujian integrasi |

**Sudah diuji langsung**: kedua contoh (`example-athletics.json`, `example-swimming.json`) tervalidasi terhadap skema DAN berhasil diproses `computeDailyNutritionTargets()` tanpa transformasi tambahan apa pun — 4 atlet lintas cabang, semua berhasil.

## Prinsip Desain

1. **`profile` PERSIS = `AthleteProfile` di nutrition-engine.** Nama & tipe field harus sama persis (`sex`, `age`, `weightKg`, `heightCm`, `bodyFatPercent`, `sport`, `event`) — supaya bisa langsung dioper ke `computeDailyNutritionTargets(profile, dayContext)` tanpa mapping ulang.

2. **Tiap elemen `weeklySessions[]` PERSIS = `DayContext`** (plus field kontekstual `day`/`sessionName`/`sourceRPE` untuk tampilan/audit, yang diabaikan nutrition-engine). Ambil field `trainingDurationMin`/`trainingIntensity`/`intensityPositionInPhase`/`isCarbLoading` dari satu sesi, oper langsung sebagai `dayContext`.

3. **`category`/`event` sengaja TIDAK dibatasi ke daftar tetap.** Nutrition-engine tidak memakainya untuk perhitungan (hanya `sport: 'atletik'|'renang'` yang berpengaruh, lewat penyesuaian termal air). Field ini murni untuk konteks/pelaporan — pakai konvensi apa pun yang sudah Anda kembangkan untuk renang (nama gaya, kategori jarak, dst).

4. **`sport` adalah satu-satunya field yang menentukan logika berbeda** di nutrition-engine (`applySwimmingThermalAdjustment`, clamp rentang karbohidrat renang). Pastikan field ini akurat.

5. **`bodyFatPercent` krusial, boleh null.** Kalau ada → formula Cunningham + guardrail REDs aktif. Kalau null → fallback Mifflin-St Jeor + status REDs `'unknown'` (bukan diam-diam `'ok'`). Lihat hasil uji: 2 dari 4 atlet contoh sengaja tanpa data ini, untuk membuktikan fallback bekerja mulus.

## Cara Pakai di Kode Anda

```js
const { computeDailyNutritionTargets } = require('./nutrition-engine');
const exportedData = JSON.parse(fs.readFileSync('hasil-ekspor-dari-atletikpro.json'));

exportedData.athletes.forEach(athlete => {
  athlete.weeklySessions.forEach(session => {
    const dayContext = {
      trainingDurationMin: session.trainingDurationMin,
      trainingIntensity: session.trainingIntensity,
      intensityPositionInPhase: session.intensityPositionInPhase,
      isCarbLoading: session.isCarbLoading,
    };
    const target = computeDailyNutritionTargets(athlete.profile, dayContext);
    // ... simpan/tampilkan target per hari
  });
});
```

## Validasi Otomatis (opsional, disarankan)

```bash
npm install ajv ajv-formats
```
```js
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const validate = ajv.compile(require('./nutrition-export-schema.json'));
if (!validate(dataEksporAnda)) console.error(validate.errors);
```

## Catatan Desain yang Perlu Diputuskan di Sisi Anda

- **`weeklySessions` merepresentasikan minggu BERJALAN**, bukan proyeksi 6 minggu ke depan — hanya kondisi sekarang yang relevan untuk target nutrisi harian. Kalau sistem Anda menyimpan program multi-minggu, ekstrak minggu yang sedang aktif saja.
- **`intensityPositionInPhase`** idealnya diturunkan dari kurva intensitas periodisasi latihan yang sudah Anda hitung (kalau ada) — bukan angka statis. Kalau sistem renang Anda tidak punya konsep ini, `0.5` (nilai tengah) adalah default yang aman & sudah dipakai contoh atlet fase Umum.
- **Field `limitations`** di level atas WAJIB diisi jujur (bukan kosmetik) — beri tahu penerima data apa yang estimasi vs pengukuran nyata, field apa yang belum terkumpul, dst. Lihat pola di kedua contoh.
