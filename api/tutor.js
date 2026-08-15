// Vercel Serverless Function — proxy ke Google Gemini API supaya API key
// tidak pernah terekspos ke browser. Wajib set GEMINI_API_KEY di Vercel
// (Project Settings -> Environment Variables) dan juga di .env.local
// untuk pengetesan lokal (pakai `vercel dev`, bukan `npm run dev`, supaya
// folder api/ ini ikut berjalan).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { message, context, history } = req.body || {};
  if (!message || !message.trim()) {
    res.status(400).json({ error: "Pesan tidak boleh kosong." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY belum di-set di server." });
    return;
  }

  // Gemini pakai format contents dengan role "user"/"model" (bukan "assistant")
  const contents = [
    ...((history || []).slice(-8).map((h) => ({
      role: h.role === "ai" ? "model" : "user",
      parts: [{ text: h.text }],
    }))),
    { role: "user", parts: [{ text: message }] },
  ];

  const systemInstruction = {
    parts: [{
      text:
        "Kamu adalah tutor matematika untuk siswa SMP/SMA di Indonesia, khusus membantu memahami materi " +
        "Eksponensial (Definisi Eksponen, Sifat Perkalian, Sifat Pembagian, Pangkat dari Pangkat, Distribusi Pangkat, " +
        "Eksponen Nol, Eksponen Negatif, Pangkat Pecahan & Bentuk Akar, Operasi Aljabar Bentuk Akar, Fungsi & Model Eksponensial, Persamaan Eksponen). " +
        "Konteks pembelajaran siswa saat ini: " + (context || "materi eksponen secara umum") + ". " +
        "GAYA MENGAJAR (WAJIB DIIKUTI): Kamu TIDAK langsung menjelaskan konsep atau memberi jawaban, walau siswa " +
        "memintanya secara langsung. Peranmu adalah PENGARAH, bukan penjelas pengganti materi. Setiap kali siswa " +
        "bertanya soal suatu konsep atau soal, langkah kamu: " +
        "(1) Tanyakan dulu bagian mana yang menurut siswa masih membingungkan dari materi yang sudah dibaca, atau apakah dia sudah membaca materinya. " +
        "(2) Arahkan dia untuk membuka/membaca ulang bagian materi terkait di tab 'Materi' sebelum lanjut (sebutkan nama sub-materinya). " +
        "(3) Beri clue/petunjuk kecil dan pertanyaan pemandu (bukan penjelasan penuh atau jawaban akhir) supaya siswa berpikir sendiri. " +
        "(4) Hanya kalau siswa sudah mencoba membaca ulang dan masih benar-benar bingung setelah 2-3 kali bertanya di topik yang sama, " +
        "baru boleh memberi penjelasan singkat sebagai upaya terakhir — dan tetap jangan langsung berikan jawaban akhir dari soal latihan manapun. " +
        "Jawab dalam Bahasa Indonesia, singkat (maksimal beberapa kalimat), dengan nada suportif dan tidak menggurui. " +
        "PENTING soal format angka: tulis pangkat dengan tanda ^ (contoh: 2^3, a^(m/n)), tulis akar dengan √( ) (contoh: √(16), ³√(8)), " +
        "dan pecahan sederhana cukup ditulis biasa seperti 1/2 — supaya bisa dirender rapi oleh sistem. " +
        "Jangan gunakan format markdown seperti tanda bintang ganda (**) untuk cetak tebal atau simbol markdown lainnya.",
    }],
  };

  // Urutan model cadangan: kalau model pertama sibuk/gagal, otomatis coba model berikutnya.
  const MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];

  async function callGemini(model) {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction,
          // Tanpa batas maxOutputTokens - Gemini akan pakai batas maksimal modelnya sendiri
        }),
      }
    );
  }

  try {
    let response = null;
    let lastErrStatus = null;
    let lastErrText = "";
    let usedModel = null;

    for (const model of MODELS) {
      try {
        response = await callGemini(model);
      } catch (e) {
        continue; // gagal koneksi ke model ini -> langsung coba model berikutnya
      }
      if (response.ok) { usedModel = model; break; }

      lastErrStatus = response.status;
      // Kalau model sedang sibuk/limit, kasih satu kali kesempatan retry cepat pada model YANG SAMA
      // sebelum pindah ke model cadangan berikutnya (kadang cukup untuk lolos).
      if (response.status === 503 || response.status === 429) {
        await new Promise((r) => setTimeout(r, 600));
        try {
          response = await callGemini(model);
          if (response.ok) { usedModel = model; break; }
          lastErrStatus = response.status;
        } catch (e) {}
      }
      lastErrText = await response.text().catch(() => "");
      // lanjut coba model cadangan berikutnya
    }

    if (!usedModel) {
      if (lastErrStatus === 503) {
        res.status(200).json({ reply: "Maaf, semua server AI sedang sibuk banget nih (lagi banyak yang pakai). Coba tanya lagi sebentar lagi ya 🙏" });
        return;
      }
      if (lastErrStatus === 429) {
        res.status(200).json({ reply: "Wah, kuota AI Tutor untuk saat ini sudah penuh. Coba lagi beberapa saat lagi ya." });
        return;
      }
      res.status(200).json({ reply: "Maaf, ada gangguan saat menghubungi AI. Coba tanya lagi ya. (kode: " + lastErrStatus + ")" });
      // eslint-disable-next-line no-console
      console.error("Gemini error semua model:", lastErrStatus, lastErrText.slice(0, 300));
      return;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim();
    res.status(200).json({ reply: text || "Maaf, aku belum bisa menjawab itu. Coba tanya dengan cara lain ya." });
  } catch (e) {
    res.status(200).json({ reply: "Maaf, koneksi ke AI Tutor sedang bermasalah. Coba lagi sebentar ya." });
  }
}
