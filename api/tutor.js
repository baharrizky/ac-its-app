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
        "PENTING: jangan gunakan format markdown seperti tanda bintang ganda (**) untuk cetak tebal atau simbol markdown lainnya — tulis dengan teks biasa saja karena akan ditampilkan apa adanya.",
    }],
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
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

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: "Gagal menghubungi AI: " + errText.slice(0, 200) });
      return;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim();
    res.status(200).json({ reply: text || "Maaf, aku belum bisa menjawab itu. Coba tanya dengan cara lain ya." });
  } catch (e) {
    res.status(500).json({ error: "Terjadi kesalahan menghubungi server AI." });
  }
}
