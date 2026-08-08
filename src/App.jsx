import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  GraduationCap, LayoutDashboard, BookOpen, PenLine, TrendingUp, User,
  Lightbulb, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, LogOut, Database, Users,
  Mail, Lock, Loader2, RefreshCw, MessageCircle, Sparkles, ClipboardList, Lock as LockIcon,
  ZoomIn, ZoomOut, Send, Clock, Trophy, Award,
} from "lucide-react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs,
} from "firebase/firestore";

// ---------------- DATA: Peta konsep (sesuai Knowledge Base) ----------------
// ---------------- DATA: Peta konsep Eksponen (disesuaikan ATP Bab 1 - Kurikulum Merdeka, Fase E) ----------------
const CONCEPTS = {
  E1:  { name: "Definisi Eksponen",            short: "aⁿ",        prereq: [] },
  E2:  { name: "Sifat Perkalian Eksponen",      short: "aᵐ·aⁿ",     prereq: ["E1"] },
  E3:  { name: "Sifat Pembagian Eksponen",      short: "aᵐ÷aⁿ",     prereq: ["E1"] },
  E4:  { name: "Sifat Pangkat dari Pangkat",    short: "(aᵐ)ⁿ",     prereq: ["E1"] },
  E5:  { name: "Sifat Distribusi Pangkat",      short: "(ab)ⁿ",     prereq: ["E1"] },
  E6:  { name: "Eksponen Nol",                  short: "a⁰",        prereq: ["E3"] },
  E7:  { name: "Eksponen Negatif",              short: "a⁻ⁿ",       prereq: ["E3", "E6"] },
  E8:  { name: "Pangkat Pecahan & Bentuk Akar", short: "a^(m/n)",   prereq: ["E1", "E4"] },
  E9:  { name: "Operasi Aljabar Bentuk Akar",   short: "√a ± √b",   prereq: ["E8"] },
  E10: { name: "Fungsi & Model Eksponensial",   short: "y=a·bˣ",    prereq: ["E1", "E2"] },
  E11: { name: "Persamaan Eksponen",            short: "aˣ=aʸ",     prereq: ["E1", "E2", "E3", "E4", "E6", "E7"] },
};
const CONCEPT_ORDER = ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10", "E11"];
const EMPTY_ATTEMPTS = Object.fromEntries(CONCEPT_ORDER.map((c) => [c, []]));
const EMPTY_POOLIDX = Object.fromEntries(CONCEPT_ORDER.map((c) => [c, 0]));

const MATERI = {
  E1: {
    formula: "aⁿ = a × a × a × ... × a  (sebanyak n faktor)",
    penjelasan: "Eksponen (pangkat) adalah cara ringkas menuliskan perkalian berulang suatu bilangan (disebut basis) dengan dirinya sendiri sebanyak n kali (disebut pangkat atau eksponen). Bentuk umumnya ditulis aⁿ, dengan a sebagai basis dan n sebagai pangkat, di mana n adalah bilangan asli. Kesalahan paling umum adalah mengira aⁿ berarti a dikalikan n (padahal itu perkalian biasa, bukan perpangkatan).",
    contoh: "2⁴ = 2 × 2 × 2 × 2 = 16\n5³ = 5 × 5 × 5 = 125\n(-3)² = (-3) × (-3) = 9, tapi -3² = -(3×3) = -9 (perhatikan letak tanda kurung!)",
  },
  E2: {
    formula: "aᵐ × aⁿ = aᵐ⁺ⁿ",
    penjelasan: "Jika dua bilangan berpangkat memiliki basis yang sama dan dikalikan, pangkatnya cukup dijumlahkan sementara basisnya tetap sama — tidak ikut dikalikan. Sifat ini berlaku karena aᵐ × aⁿ pada dasarnya menggabungkan (m+n) faktor a yang dikalikan berturut-turut. Sifat ini HANYA berlaku jika basisnya sama; 2³ × 3² TIDAK bisa disederhanakan dengan cara ini.",
    contoh: "3² × 3³ = 3⁽²⁺³⁾ = 3⁵ = 243\nx⁴ × x = x⁴ × x¹ = x⁵\n2³ × 2⁻¹ = 2⁽³⁺⁽⁻¹⁾⁾ = 2² = 4",
  },
  E3: {
    formula: "aᵐ ÷ aⁿ = aᵐ⁻ⁿ  (a ≠ 0)",
    penjelasan: "Jika dua bilangan berpangkat dengan basis sama dibagi, pangkatnya dikurangkan (pangkat pembilang dikurangi pangkat penyebut), basis tetap sama. Sifat ini adalah kebalikan dari sifat perkalian eksponen. Kalau hasil pengurangan pangkatnya negatif atau nol, itu wajar — nanti akan menuntun ke konsep eksponen nol dan eksponen negatif.",
    contoh: "5⁶ ÷ 5² = 5⁽⁶⁻²⁾ = 5⁴ = 625\na⁷ ÷ a⁷ = a⁽⁷⁻⁷⁾ = a⁰\n2³ ÷ 2⁵ = 2⁽³⁻⁵⁾ = 2⁻²",
  },
  E4: {
    formula: "(aᵐ)ⁿ = aᵐˣⁿ",
    penjelasan: "Pangkat yang dipangkatkan lagi (pangkat berpangkat) hasilnya adalah basis yang sama dipangkatkan dengan hasil kali kedua pangkatnya. Ini berbeda dengan sifat perkalian eksponen (aᵐ × aⁿ = aᵐ⁺ⁿ) — di sini pangkatnya DIKALIKAN, bukan dijumlahkan, karena (aᵐ)ⁿ berarti aᵐ dikalikan sebanyak n kali dengan dirinya sendiri.",
    contoh: "(2³)² = 2⁽³ˣ²⁾ = 2⁶ = 64\n(x²)⁵ = x¹⁰\n(a³)⁰ = a⁰ = 1 (apa pun pangkat luar-nya, kalau pangkat dalamnya 0 hasilnya tetap terkait sifat eksponen nol)",
  },
  E5: {
    formula: "(a × b)ⁿ = aⁿ × bⁿ   dan   (a ÷ b)ⁿ = aⁿ ÷ bⁿ  (b ≠ 0)",
    penjelasan: "Jika perkalian atau pembagian dua bilangan dipangkatkan, pangkat itu bisa 'dibagikan' ke masing-masing bilangan di dalam kurung secara terpisah. Sifat ini sering keliru diterapkan pada penjumlahan/pengurangan — (a+b)ⁿ TIDAK SAMA DENGAN aⁿ + bⁿ, sifat distribusi pangkat ini hanya berlaku untuk perkalian dan pembagian di dalam kurung.",
    contoh: "(2 × 3)² = 2² × 3² = 4 × 9 = 36\n(x/y)³ = x³/y³\n(2 + 3)² = 5² = 25, TAPI 2² + 3² = 4 + 9 = 13 (tidak sama! sifat ini tidak berlaku untuk penjumlahan)",
  },
  E6: {
    formula: "a⁰ = 1   (a ≠ 0)",
    penjelasan: "Bilangan apa pun (kecuali 0) yang dipangkatkan nol hasilnya selalu 1. Ini bisa dibuktikan dari sifat pembagian eksponen: aⁿ ÷ aⁿ = aⁿ⁻ⁿ = a⁰, padahal aⁿ ÷ aⁿ jelas sama dengan 1 (bilangan dibagi dirinya sendiri), sehingga a⁰ harus sama dengan 1. Catatan: 0⁰ tidak didefinisikan dalam matematika dasar.",
    contoh: "7⁰ = 1\n100⁰ = 1\n(-5)⁰ = 1, tapi hasilnya BUKAN 0 dan BUKAN -5 — banyak yang keliru mengira pangkat nol membuat bilangannya hilang jadi 0",
  },
  E7: {
    formula: "a⁻ⁿ = 1 / aⁿ   (a ≠ 0)",
    penjelasan: "Pangkat negatif berarti kebalikan (pecahan 1 per basis-pangkat-positifnya) — BUKAN tanda minus di depan hasil akhir. Ini juga bisa diturunkan dari sifat pembagian: a⁰ ÷ aⁿ = a⁰⁻ⁿ = a⁻ⁿ, padahal a⁰ ÷ aⁿ = 1 ÷ aⁿ. Kesalahan paling sering: menganggap 2⁻² = -4 (padahal yang benar 2⁻² = 1/4).",
    contoh: "2⁻² = 1/2² = 1/4\n5⁻¹ = 1/5\n3⁻³ = 1/3³ = 1/27 (bukan -27, bukan -9)",
  },
  E8: {
    formula: "a^(m/n) = ⁿ√(aᵐ)   (a > 0)",
    penjelasan: "Pangkat pecahan menghubungkan konsep eksponen dan bentuk akar (radikal): pembilang pecahan (m) menjadi pangkat di dalam tanda akar, sedangkan penyebutnya (n) menjadi indeks/tingkat akarnya. Kasus khusus yang penting: a^(1/n) = ⁿ√a (akar pangkat n biasa, tanpa pangkat tambahan di dalam).",
    contoh: "8^(1/3) = ³√8 = 2\n16^(1/2) = √16 = 4\n4^(3/2) = √(4³) = √64 = 8, atau bisa juga (√4)³ = 2³ = 8 (hasilnya sama)",
  },
  E9: {
    formula: "√a × √b = √(ab)     a√c ± b√c = (a±b)√c     rasionalkan: kalikan pembilang & penyebut dengan bentuk sekawan",
    penjelasan: "Bentuk akar bisa dioperasikan seperti aljabar biasa dengan aturan tersendiri: (1) perkalian akar boleh digabung di bawah satu akar (√a × √b = √(ab)), (2) penjumlahan/pengurangan akar HANYA bisa digabung kalau bentuk akarnya sudah sejenis (sama bilangan di dalam akarnya) — mirip menjumlahkan suku sejenis pada aljabar, (3) untuk 'merasionalkan' penyebut yang mengandung akar, kalikan pembilang dan penyebut dengan bentuk sekawannya supaya akar di penyebut hilang.",
    contoh: "√2 × √8 = √16 = 4\n3√5 + 2√5 = 5√5 (sejenis, boleh dijumlahkan langsung)\n√3 + √5 TIDAK BISA disederhanakan lagi (tidak sejenis)\nMerasionalkan 1/√2 = (1×√2)/(√2×√2) = √2/2",
  },
  E10: {
    formula: "y = a · bˣ   (a = nilai awal, b = faktor pertumbuhan/peluruhan, b > 0, b ≠ 1)",
    penjelasan: "Fungsi eksponensial memodelkan fenomena yang berubah dengan laju berlipat (bukan bertambah tetap seperti fungsi linear). Jika b > 1, fungsi menggambarkan PERTUMBUHAN (grafik naik semakin curam) — contoh: perkembangbiakan bakteri, bunga majemuk. Jika 0 < b < 1, fungsi menggambarkan PELURUHAN (grafik turun mendekati nol) — contoh: peluruhan zat radioaktif, penyusutan nilai barang. Grafik fungsi eksponensial selalu memotong sumbu-y di titik (0, a) dan tidak pernah menyentuh sumbu-x (mendekati nol tapi tidak pernah 0), disebut asimtot datar.",
    contoh: "Populasi bakteri awal 100, berlipat 2 kali tiap jam: N(t) = 100 · 2ᵗ → pertumbuhan (b=2>1)\nNilai motor Rp20 juta menyusut 10% tiap tahun: V(t) = 20.000.000 · (0,9)ᵗ → peluruhan (b=0,9, antara 0 dan 1)",
  },
  E11: {
    formula: "Jika aˣ = aʸ (basis sama, a > 0, a ≠ 1), maka x = y",
    penjelasan: "Untuk menyelesaikan persamaan eksponen aˣ = b, langkah utamanya adalah menyamakan dulu basis di kedua ruas (ubah b menjadi bentuk pangkat dari a), baru pangkat kedua ruas bisa langsung disamakan menjadi persamaan biasa yang lebih sederhana untuk dicari x-nya. Kadang perlu menggunakan sifat-sifat eksponen sebelumnya (perkalian, pembagian, pangkat berpangkat) untuk menyederhanakan salah satu ruas terlebih dahulu sebelum basisnya bisa disamakan.",
    contoh: "2ˣ = 8 → 2ˣ = 2³ → x = 3\n3^(2x) = 81 → 3^(2x) = 3⁴ → 2x = 4 → x = 2\n5^(x+1) = 125 → 5^(x+1) = 5³ → x+1 = 3 → x = 2",
  },
};

const HINTS = {
  E1: {
    t1: "Ingat: aⁿ berarti a dikalikan dengan dirinya sendiri sebanyak n kali — bukan a dikali n.",
    t2: "Tulis dulu perkaliannya secara lengkap sebelum dihitung, misalnya 2⁴ = 2 × 2 × 2 × 2, baru kalikan satu per satu.",
    full: "2⁴ artinya 2 dikalikan sebanyak 4 kali: 2 × 2 × 2 × 2 = 16. Hati-hati juga dengan tanda kurung: (-2)² = 4, tapi -2² = -4.",
  },
  E2: {
    t1: "Basis harus sama dulu baru pangkatnya bisa dijumlahkan — basisnya sendiri TIDAK ikut dikalikan atau berubah.",
    t2: "Contoh: 2³ × 2² = 2⁽³⁺²⁾ = 2⁵ (bukan 4⁵, dan bukan 2⁶).",
    full: "aᵐ × aⁿ = aᵐ⁺ⁿ. Basis (a) tetap sama, hanya pangkatnya (m dan n) yang dijumlahkan.",
  },
  E3: {
    t1: "Basis harus sama dulu baru pangkatnya bisa dikurangkan — pangkat pembilang dikurangi pangkat penyebut.",
    t2: "Contoh: 5⁴ ÷ 5² = 5⁽⁴⁻²⁾ = 5² (bukan 5², eh maksudnya bukan hasil pembagian biasa 5/5=1 dulu baru dipangkatkan).",
    full: "aᵐ ÷ aⁿ = aᵐ⁻ⁿ. Kalau hasil pengurangan pangkatnya negatif, itu wajar — hasilnya akan berbentuk pecahan (pangkat negatif).",
  },
  E4: {
    t1: "Pangkat berpangkat berarti kedua pangkatnya DIKALIKAN, bukan dijumlahkan seperti pada perkalian eksponen biasa.",
    t2: "Contoh: (3²)³ = 3⁽²ˣ³⁾ = 3⁶ (bukan 3⁵).",
    full: "(aᵐ)ⁿ = aᵐˣⁿ. Jangan tertukar dengan aᵐ × aⁿ = aᵐ⁺ⁿ — perhatikan apakah ada tanda kurung pangkat berpangkat atau tanda kali antar dua bilangan berpangkat.",
  },
  E5: {
    t1: "Sifat ini hanya berlaku untuk PERKALIAN atau PEMBAGIAN di dalam kurung, tidak berlaku untuk penjumlahan/pengurangan.",
    t2: "Contoh: (2×3)² = 2²×3² = 36, tapi (2+3)² = 5² = 25 (BUKAN 2²+3²=13).",
    full: "(a×b)ⁿ = aⁿ×bⁿ dan (a÷b)ⁿ = aⁿ÷bⁿ. Pangkat di luar kurung dibagikan ke setiap faktor yang dikalikan/dibagi di dalamnya — tapi tidak berlaku kalau di dalam kurung ada tanda tambah atau kurang.",
  },
  E6: {
    t1: "Ingat: a⁰ = 1 berlaku untuk semua a ≠ 0 — hasilnya bukan 0, dan bukan a itu sendiri.",
    t2: "Contoh: 9⁰ = 1, sama seperti 250⁰ = 1 — berapa pun basisnya (asal bukan 0), hasilnya tetap 1.",
    full: "Ini bisa dibuktikan lewat sifat pembagian: aⁿ÷aⁿ = aⁿ⁻ⁿ = a⁰, padahal aⁿ÷aⁿ pasti = 1 (bilangan dibagi dirinya sendiri). Jadi a⁰ = 1.",
  },
  E7: {
    t1: "Pangkat negatif berarti KEBALIKAN (1 per basis-pangkat-positifnya) — bukan tanda minus di depan hasil.",
    t2: "Contoh: 4⁻¹ = 1/4¹ = 1/4 (bukan -4).",
    full: "a⁻ⁿ = 1/aⁿ. Jadi 3⁻² = 1/3² = 1/9 — bukan -9 dan bukan -1/9.",
  },
  E8: {
    t1: "Ingat: pangkat pecahan berarti bentuk akar — a^(m/n) = akar pangkat n dari aᵐ, bukan a dibagi n.",
    t2: "Contoh: 27^(1/3) = akar pangkat 3 dari 27 = 3 (bukan 27/3 = 9).",
    full: "a^(m/n) = ⁿ√(aᵐ). Pembilang pangkat (m) masuk ke dalam akar, penyebut pangkat (n) jadi indeks/tingkat akarnya.",
  },
  E9: {
    t1: "Penjumlahan/pengurangan bentuk akar hanya bisa digabung kalau bilangan di dalam akarnya SAMA (sejenis).",
    t2: "Contoh: 2√3 + 5√3 = 7√3 (sejenis, boleh), tapi 2√3 + 5√2 tidak bisa disederhanakan (tidak sejenis).",
    full: "Untuk perkalian, √a×√b = √(ab) selalu boleh digabung. Untuk merasionalkan penyebut berbentuk akar, kalikan pembilang & penyebut dengan bentuk yang sama supaya akar di penyebut hilang.",
  },
  E10: {
    t1: "Perhatikan nilai b (faktor pengali): kalau b > 1 itu pertumbuhan (naik), kalau 0 < b < 1 itu peluruhan (turun).",
    t2: "Nilai awal (saat x=0) selalu sama dengan a, karena bˣ menjadi b⁰=1 sehingga y = a×1 = a.",
    full: "y = a·bˣ. Grafik selalu mendekati sumbu-x tapi tidak pernah menyentuhnya (asimtot). Growth: b>1, Decay: 0<b<1.",
  },
  E11: {
    t1: "Untuk menyelesaikan aˣ = b, samakan dulu basis kedua ruas (ubah b jadi bentuk pangkat dari a).",
    t2: "Contoh: 2ˣ = 16 → ubah 16 jadi 2⁴ → 2ˣ = 2⁴ → x = 4.",
    full: "Kalau basis kedua ruas sudah sama, pangkatnya pasti sama juga, sehingga x bisa langsung dibaca. Kadang perlu sifat eksponen lain dulu untuk menyederhanakan salah satu ruas.",
  },
};

const PRACTICE_POOL = {
  E1: [
    { text: "2⁵ = ?", options: [{ text: "32", correct: true }, { text: "10", tag: "Mengira pangkat = basis dikali pangkat (2×5)" }, { text: "7", tag: "Mengira pangkat = basis ditambah pangkat (2+5)" }] },
    { text: "(-3)⁴ = ?", options: [{ text: "81", correct: true }, { text: "-81", tag: "Lupa bahwa pangkat genap dari bilangan negatif hasilnya positif" }, { text: "-12", tag: "Mengira pangkat = basis dikali pangkat" }] },
    { text: "-2⁴ = ? (tanpa kurung di depan angka 2)", options: [{ text: "-16", correct: true }, { text: "16", tag: "Keliru menganggap tanda minus ikut dipangkatkan padahal tidak ada kurung" }, { text: "-8", tag: "Salah hitung perkalian berulang" }] },
    { text: "Volume kubus dengan panjang rusuk 6 cm adalah s³. Berapa volumenya?", options: [{ text: "216 cm³", correct: true }, { text: "18 cm³", tag: "Mengira pangkat 3 berarti dikali 3" }, { text: "36 cm³", tag: "Hanya menghitung s² (luas alas), lupa dikali satu s lagi" }] },
  ],
  E2: [
    { text: "3² × 3³ = ?", options: [{ text: "3⁵", correct: true }, { text: "3⁶", tag: "Mengira pangkat harus dikalikan (2×3), bukan dijumlahkan" }, { text: "9⁵", tag: "Ikut mengalikan basisnya padahal basis tetap sama" }] },
    { text: "x⁴ × x³ × x = ?", options: [{ text: "x⁸", correct: true }, { text: "x¹²", tag: "Mengira pangkat harus dikalikan semua (4×3×1)" }, { text: "x⁷", tag: "Lupa menghitung x tunggal sebagai x pangkat 1" }] },
    { text: "2³ × 2⁻¹ = ?", options: [{ text: "2² = 4", correct: true }, { text: "2⁴ = 16", tag: "Salah menjumlahkan pangkat negatif, menganggap -1 jadi +1" }, { text: "2⁻³ = 1/8", tag: "Salah tanda saat menjumlahkan pangkat" }] },
    { text: "5² × 5³ × 5⁻² = ?", options: [{ text: "5³ = 125", correct: true }, { text: "5⁷ = 78125", tag: "Salah menjumlahkan, tidak memperhitungkan pangkat negatif dengan benar" }, { text: "5⁻¹ = 1/5", tag: "Salah hitung penjumlahan pangkat" }] },
  ],
  E3: [
    { text: "7⁶ ÷ 7² = ?", options: [{ text: "7⁴", correct: true }, { text: "7³", tag: "Salah hitung pengurangan pangkat (6-2 dihitung keliru)" }, { text: "1⁴", tag: "Basisnya ikut dibagi/hilang, padahal basis tetap sama" }] },
    { text: "x⁵ ÷ x⁸ = ?", options: [{ text: "x⁻³", correct: true }, { text: "x³", tag: "Lupa memperhatikan urutan pengurangan (5-8, bukan 8-5)" }, { text: "x⁻¹³", tag: "Menjumlahkan pangkat, bukan mengurangkan" }] },
    { text: "(4⁵ × 4²) ÷ 4³ = ?", options: [{ text: "4⁴", correct: true }, { text: "4¹⁰", tag: "Salah urutan operasi, langsung mengalikan semua pangkat" }, { text: "4⁻⁴", tag: "Salah tanda saat mengurangkan pangkat total" }] },
  ],
  E4: [
    { text: "(2³)² = ?", options: [{ text: "2⁶ = 64", correct: true }, { text: "2⁵ = 32", tag: "Mengira pangkat berpangkat dijumlahkan (3+2), bukan dikalikan" }, { text: "2⁹ = 512", tag: "Salah kalikan pangkat, hasil dikalikan basisnya juga" }] },
    { text: "(x⁴)³ = ?", options: [{ text: "x¹²", correct: true }, { text: "x⁷", tag: "Menjumlahkan pangkat seperti sifat perkalian eksponen" }, { text: "x⁶⁴", tag: "Salah hitung, memangkatkan pangkat bukan mengalikan" }] },
    { text: "((3²)²)² = ?", options: [{ text: "3⁸ = 6561", correct: true }, { text: "3⁶ = 729", tag: "Salah mengalikan ketiga pangkat berturut-turut" }, { text: "3⁴ = 81", tag: "Hanya menghitung satu tingkat pangkat, mengabaikan tingkat lainnya" }] },
  ],
  E5: [
    { text: "(2 × 5)³ = ?", options: [{ text: "2³ × 5³ = 1000", correct: true }, { text: "2 × 5³ = 250", tag: "Hanya memangkatkan salah satu faktor, bukan keduanya" }, { text: "2³ × 5 = 40", tag: "Hanya memangkatkan salah satu faktor" }] },
    { text: "(x/y)⁴ = ?", options: [{ text: "x⁴/y⁴", correct: true }, { text: "x⁴/y", tag: "Hanya memangkatkan pembilang, penyebut tidak ikut dipangkatkan" }, { text: "x/y⁴", tag: "Hanya memangkatkan penyebut, pembilang tidak ikut dipangkatkan" }] },
    { text: "(3 + 4)² sama dengan...?", options: [{ text: "49 (bukan 3²+4²)", correct: true }, { text: "3² + 4² = 25", tag: "Keliru menerapkan sifat distribusi pangkat pada penjumlahan (tidak berlaku)" }, { text: "3² × 4² = 144", tag: "Keliru mengira penjumlahan berubah jadi perkalian" }] },
  ],
  E6: [
    { text: "15⁰ = ?", options: [{ text: "1", correct: true }, { text: "0", tag: "Mengira pangkat nol membuat bilangan menjadi nol" }, { text: "15", tag: "Mengira pangkat nol tidak mengubah apa-apa pada basis" }] },
    { text: "(-8)⁰ = ?", options: [{ text: "1", correct: true }, { text: "-1", tag: "Mengira tanda negatif basis ikut memengaruhi hasil pangkat nol" }, { text: "0", tag: "Mengira pangkat nol membuat bilangan menjadi nol" }] },
    { text: "5x⁰ = ? (untuk x ≠ 0)", options: [{ text: "5", correct: true }, { text: "0", tag: "Mengira x⁰ membuat seluruh suku menjadi nol" }, { text: "5x", tag: "Mengabaikan bahwa x⁰ = 1, bukan x" }] },
  ],
  E7: [
    { text: "4⁻² = ?", options: [{ text: "1/16", correct: true }, { text: "-16", tag: "Mengira pangkat negatif berarti hasilnya jadi negatif" }, { text: "-8", tag: "Salah menghitung, mencampur tanda negatif dengan perkalian" }] },
    { text: "2⁻³ = ?", options: [{ text: "1/8", correct: true }, { text: "-8", tag: "Mengira pangkat negatif membuat hasil akhirnya negatif" }, { text: "-1/8", tag: "Sudah paham bentuk pecahan tapi salah menambahkan tanda minus" }] },
    { text: "(1/3)⁻² = ?", options: [{ text: "9", correct: true }, { text: "1/9", tag: "Lupa bahwa pangkat negatif pada pecahan membalik pecahannya" }, { text: "-9", tag: "Mengira hasil pangkat negatif harus negatif" }] },
  ],
  E8: [
    { text: "27^(1/3) = ?", options: [{ text: "3", correct: true }, { text: "9", tag: "Mengira a^(1/n) = a/n (dibagi n), bukan akar pangkat n" }, { text: "24", tag: "Salah operasi, mengurangkan alih-alih mengakarkan" }] },
    { text: "16^(3/4) = ?", options: [{ text: "8", correct: true }, { text: "12", tag: "Mengira pangkat pecahan dihitung dengan perkalian langsung (16×3/4)" }, { text: "64", tag: "Hanya menghitung 16³ tanpa mengakarkan pangkat 4" }] },
    { text: "9^(1/2) = ?", options: [{ text: "3", correct: true }, { text: "4,5", tag: "Mengira a^(1/2) = a/2 (dibagi 2), bukan akar kuadrat" }, { text: "18", tag: "Salah operasi, mengalikan bukan mengakarkan" }] },
  ],
  E9: [
    { text: "3√2 + 5√2 = ?", options: [{ text: "8√2", correct: true }, { text: "8√4", tag: "Ikut menjumlahkan angka di dalam akar padahal seharusnya tetap" }, { text: "15√2", tag: "Mengalikan koefisien alih-alih menjumlahkan" }] },
    { text: "√3 × √12 = ?", options: [{ text: "6", correct: true }, { text: "√15", tag: "Menjumlahkan angka di dalam akar, padahal seharusnya dikalikan" }, { text: "36", tag: "Lupa mengakarkan hasil akhir setelah perkalian di dalam akar" }] },
    { text: "7√5 - 2√5 = ?", options: [{ text: "5√5", correct: true }, { text: "5√0", tag: "Ikut mengurangkan angka di dalam akar" }, { text: "9√5", tag: "Menjumlahkan alih-alih mengurangkan koefisien" }] },
  ],
  E10: [
    { text: "Sebuah fungsi y = 50 · (1,2)ˣ menggambarkan...?", options: [{ text: "Pertumbuhan, karena faktor pengalinya (1,2) lebih dari 1", correct: true }, { text: "Peluruhan, karena angka 1,2 dianggap kecil", tag: "Tidak memahami syarat b>1 untuk pertumbuhan" }, { text: "Tidak bisa ditentukan tanpa tahu nilai x", tag: "Tidak memahami bahwa sifat naik/turun ditentukan oleh nilai b, bukan x" }] },
    { text: "Fungsi y = 200 · (0,85)ˣ menggambarkan peluruhan. Berapa nilai y saat x = 0?", options: [{ text: "200", correct: true }, { text: "0", tag: "Mengira nilai awal fungsi eksponensial selalu 0" }, { text: "170", tag: "Salah menghitung, mengira x=0 berarti dikalikan langsung dengan 0,85" }] },
    { text: "Manakah yang merupakan CIRI grafik fungsi eksponensial peluruhan?", options: [{ text: "Grafik menurun mendekati sumbu-x tapi tidak pernah menyentuhnya", correct: true }, { text: "Grafik berupa garis lurus yang menurun", tag: "Tertukar dengan ciri grafik fungsi linear" }, { text: "Grafik menyentuh sumbu-x lalu berbalik naik", tag: "Tidak memahami konsep asimtot pada fungsi eksponensial" }] },
  ],
  E11: [
    { text: "2ˣ = 32, x = ?", options: [{ text: "5", correct: true }, { text: "16", tag: "Salah mengubah 32 menjadi bentuk pangkat basis 2" }, { text: "30", tag: "Mengurangkan basis dari hasil, bukan menyamakan pangkat" }] },
    { text: "3^(2x) = 81, x = ?", options: [{ text: "2", correct: true }, { text: "4", tag: "Lupa membagi 2 setelah menyamakan pangkat (2x=4, bukan x=4)" }, { text: "8", tag: "Salah mengubah 81 menjadi bentuk pangkat basis 3" }] },
    { text: "5^(x-1) = 125, x = ?", options: [{ text: "4", correct: true }, { text: "3", tag: "Lupa menambahkan 1 kembali setelah menyamakan pangkat" }, { text: "2", tag: "Salah mengubah 125 menjadi bentuk pangkat basis 5" }] },
    { text: "4^x = 8^(x-1), x = ? (petunjuk: ubah kedua ruas ke basis 2)", options: [{ text: "3", correct: true }, { text: "1", tag: "Tidak menyamakan basis terlebih dahulu sebelum menyamakan pangkat" }, { text: "-3", tag: "Salah tanda saat menyelesaikan persamaan linear hasil penyamaan pangkat" }] },
  ],
};

const KB_ROWS = CONCEPT_ORDER.map((c) => ({
  id: c, nama: `${CONCEPTS[c].name} (${CONCEPTS[c].short})`,
  deskripsi: MATERI[c].penjelasan, prereq: CONCEPTS[c].prereq.join(", ") || "–", status: "Aktif",
}));

const WEIGHTS = [0.4, 0.3, 0.15, 0.1, 0.05];
function computeMastery(attempts) {
  if (!attempts || attempts.length === 0) return null;
  const used = attempts.slice(-5).reverse();
  const w = WEIGHTS.slice(0, used.length);
  const sumW = w.reduce((a, b) => a + b, 0);
  return used.reduce((acc, s, i) => acc + s * w[i], 0) / sumW;
}
function statusOf(attempts) {
  const m = computeMastery(attempts);
  if (m === null) return { label: "Belum diuji", tone: "neutral" };
  if (m >= 0.75 && attempts.length >= 3) return { label: "Dikuasai", tone: "good" };
  if (attempts.length >= 5 && m < 0.75) return { label: "Butuh remedial", tone: "bad" };
  return { label: "Dalam proses", tone: "warn" };
}
function overallPctOf(attempts) {
  const tested = CONCEPT_ORDER.map((c) => computeMastery(attempts[c])).filter((m) => m !== null);
  if (tested.length === 0) return 0;
  return Math.round((tested.reduce((a, b) => a + b, 0) / CONCEPT_ORDER.length) * 100);
}
const toneColor = { good: "var(--teal)", warn: "var(--amber)", bad: "var(--rose)", neutral: "var(--muted)" };
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#7C5CFC,#F472B6)",
  "linear-gradient(135deg,#1FAE7F,#38BDF8)",
  "linear-gradient(135deg,#F5A524,#F0466E)",
  "linear-gradient(135deg,#8B5CF6,#38BDF8)",
  "linear-gradient(135deg,#F0466E,#F5A524)",
  "linear-gradient(135deg,#0EA5E9,#7C5CFC)",
];

// ---------------- Gamifikasi: XP, Level, Badge (dihitung otomatis dari data yang ada) ----------------
function computeXp(attempts) {
  let xp = 0;
  CONCEPT_ORDER.forEach((c) => {
    (attempts[c] || []).forEach((score) => { xp += Math.round(score * 10); });
  });
  return xp;
}
function computeLevel(xp) {
  const perLevel = 200;
  const level = Math.floor(xp / perLevel) + 1;
  const xpInLevel = xp % perLevel;
  return { level, xpInLevel, xpTarget: perLevel };
}
const BADGES = [
  { id: "first_correct", nama: "Langkah Pertama", desc: "Menjawab 1 soal latihan dengan benar", icon: "✅", check: (s) => s.correctCount >= 1 },
  { id: "ten_correct", nama: "Latihan 10", desc: "Menjawab 10 soal latihan dengan benar", icon: "🎯", check: (s) => s.correctCount >= 10 },
  { id: "twentyfive_correct", nama: "Latihan 25", desc: "Menjawab 25 soal latihan dengan benar", icon: "💯", check: (s) => s.correctCount >= 25 },
  { id: "one_mastered", nama: "Penakluk Konsep", desc: "Menguasai 1 konsep eksponen", icon: "⭐", check: (s) => s.masteredCount >= 1 },
  { id: "three_mastered", nama: "Setengah Jalan", desc: "Menguasai 3 konsep eksponen", icon: "🌟", check: (s) => s.masteredCount >= 3 },
  { id: "all_mastered", nama: "Master Eksponen", desc: "Menguasai semua konsep eksponen", icon: "🏆", check: (s) => s.masteredCount >= CONCEPT_ORDER.length },
  { id: "streak_3", nama: "Streak 3 Hari", desc: "Belajar 3 hari berturut-turut", icon: "🔥", check: (s) => s.streak >= 3 },
  { id: "streak_7", nama: "Streak 7 Hari", desc: "Belajar 7 hari berturut-turut", icon: "💪", check: (s) => s.streak >= 7 },
];
function computeBadgeStats(attempts, statuses, streak) {
  const correctCount = CONCEPT_ORDER.reduce((sum, c) => sum + (attempts[c] || []).filter((s) => s >= 0.4).length, 0);
  const masteredCount = CONCEPT_ORDER.filter((c) => statuses[c]?.label === "Dikuasai").length;
  return { correctCount, masteredCount, streak: streak || 0 };
}

// ---------------- Komponen: AI Tutor (chat) ----------------
function AiTutor({ context, getPageImage, messages, setMessages, onClearHistory }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    const nextHistory = [...messages, { role: "user", text }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      let image = null;
      if (getPageImage) {
        const dataUrl = getPageImage();
        if (dataUrl && dataUrl.includes(",")) image = dataUrl.split(",")[1];
      }
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context, history: messages, image, imageMime: "image/jpeg" }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "ai", text: data.reply || data.error || "Maaf, terjadi kesalahan." }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Gagal terhubung ke server AI Tutor." }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 480 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        {messages.length > 0 && (
          <button className="btn-ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={onClearHistory}>Hapus Riwayat</button>
        )}
      </div>
      <div ref={boxRef} style={{ flex: 1, overflowY: "auto", padding: 6 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, marginTop: 40 }}>
            <MessageCircle size={26} style={{ marginBottom: 8 }} /><br />
            Tanyakan apa saja tentang materi Eksponen!
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: 10, fontSize: 13.5, maxWidth: "85%", lineHeight: 1.5, background: m.role === "user" ? "var(--brand)" : "var(--paper-2)", color: m.role === "user" ? "white" : "var(--ink)" }}>{m.text}</span>
          </div>
        ))}
        {loading && <div style={{ fontSize: 12, color: "var(--muted)", padding: "0 4px" }}>AI Tutor sedang mengetik...</div>}
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        <input type="text" placeholder="Tanya tutor AI..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn-primary" onClick={() => send()} disabled={loading}><Send size={15} /></button>
      </div>
    </div>
  );
}

function AppInner() {
  // ---------- Auth & profil ----------
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [profile, setProfile] = useState(null); // { name, role, kelas, sekolah }
  const [mode, setMode] = useState("landing"); // landing | auth | app
  const [authTab, setAuthTab] = useState("login"); // login | daftar
  const [authRole, setAuthRole] = useState("siswa");
  const [authName, setAuthName] = useState("");
  const [authKelas, setAuthKelas] = useState("");
  const [authSekolah, setAuthSekolah] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // ---------- Progress siswa: latihan konsep (tersimpan di Firestore) ----------
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [attempts, setAttempts] = useState(EMPTY_ATTEMPTS);
  const [misconceptions, setMisconceptions] = useState([]);
  const [poolIndex, setPoolIndex] = useState(EMPTY_POOLIDX);
  const [streak, setStreak] = useState(0);
  const [lastActiveDate, setLastActiveDate] = useState(null);
  const streakCheckedRef = useRef(false);
  const [leaderboardStudents, setLeaderboardStudents] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingProfil, setEditingProfil] = useState(false);
  const [tutorMessages, setTutorMessages] = useState([]);
  const [tutorFocusConcept, setTutorFocusConcept] = useState(null);
  const tutorGreetedRef = useRef(false);
  const [editName, setEditName] = useState("");
  const [editKelas, setEditKelas] = useState("");
  const [editAvatarColor, setEditAvatarColor] = useState(0);
  const [savingProfil, setSavingProfil] = useState(false);

  // ---------- Navigasi ----------
  const [screen, setScreen] = useState("dashboard"); // dashboard | materi | latihan | diagnosis | hint | progress | profil | komikList | komikChapter
  const [activeConcept, setActiveConcept] = useState("E1");
  const [consecWrong, setConsecWrong] = useState(0);
  const [hintTier, setHintTier] = useState(0);
  const [selected, setSelected] = useState(null);
  const [diag, setDiag] = useState(null);
  const [redirectNote, setRedirectNote] = useState(null);

  // ---------- Guru ----------
  const [guruTab, setGuruTab] = useState("beranda");
  const [guruStudents, setGuruStudents] = useState([]);
  const [guruKelasFilter, setGuruKelasFilter] = useState("semua");
  const [guruLoading, setGuruLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAuthTimedOut(true), 12000);
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      try {
        if (u) {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            setProfile(snap.data());
            setMode("app");
            setScreen("dashboard");
          } else {
            await signOut(auth);
          }
        } else {
          setProfile(null);
          setAttempts(EMPTY_ATTEMPTS);
          setMisconceptions([]);
          setPoolIndex(EMPTY_POOLIDX);
          setTutorMessages([]);
          setProgressLoaded(false);
          setMode("landing");
        }
      } catch (e) {
        // Gagal mengambil data profil (jaringan lambat/bermasalah) -> tetap lanjutkan,
        // supaya tidak macet selamanya di layar "Memuat...".
      } finally {
        clearTimeout(t);
        setAuthLoading(false);
      }
    });
    return () => { unsub(); clearTimeout(t); };
  }, []);

  useEffect(() => {
    async function loadProgress() {
      if (!authUser || !profile || profile.role !== "siswa") return;
      try {
        const snap = await getDoc(doc(db, "progress", authUser.uid));
        let loadedStreak = 0;
        let loadedLastActive = null;
        if (snap.exists()) {
          const d = snap.data();
          setAttempts({ ...EMPTY_ATTEMPTS, ...(d.attempts || {}) });
          setMisconceptions(d.misconceptions || []);
          setPoolIndex({ ...EMPTY_POOLIDX, ...(d.poolIndex || {}) });
          setTutorMessages(d.tutorMessages || []);
          loadedStreak = d.streak || 0;
          loadedLastActive = d.lastActiveDate || null;
        }
        // Hitung streak harian: lanjut kalau aktif kemarin, reset kalau lewat 1 hari, tetap kalau sudah aktif hari ini
        if (!streakCheckedRef.current) {
          streakCheckedRef.current = true;
          const today = new Date().toISOString().slice(0, 10);
          if (loadedLastActive === today) {
            loadedStreak = loadedStreak || 1;
          } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            loadedStreak = loadedLastActive === yesterday ? (loadedStreak || 0) + 1 : 1;
            loadedLastActive = today;
          }
          setStreak(loadedStreak);
          setLastActiveDate(loadedLastActive);
        }
      } catch (e) {
        // Gagal memuat progress (jaringan bermasalah) -> tetap lanjutkan dengan data kosong
        // supaya tidak macet selamanya.
      } finally {
        setProgressLoaded(true);
      }
    }
    loadProgress();
  }, [authUser, profile]);

  useEffect(() => {
    if (!authUser || !profile || profile.role !== "siswa" || !progressLoaded) return;
    setDoc(doc(db, "progress", authUser.uid), { attempts, misconceptions, poolIndex, streak, lastActiveDate, tutorMessages: tutorMessages.slice(-30) }, { merge: true }).catch(() => {});
  }, [attempts, misconceptions, poolIndex, streak, lastActiveDate, tutorMessages, authUser, profile, progressLoaded]);

  const statuses = useMemo(() => {
    const s = {};
    CONCEPT_ORDER.forEach((c) => (s[c] = statusOf(attempts[c])));
    return s;
  }, [attempts]);

  function pickNextConcept() {
    // Berurutan sesuai kurikulum (CONCEPT_ORDER) — tidak lompat ke konsep lain berdasarkan skor terendah,
    // supaya alur belajar terasa runtut: baca materi konsep X, langsung latihan konsep X yang sama.
    const target = CONCEPT_ORDER.find((c) => statuses[c].label !== "Dikuasai");
    if (!target) return null;
    setRedirectNote(null);
    return target;
  }

  function goStudy() {
    const next = pickNextConcept();
    if (!next) { setScreen("progress"); return; }
    setActiveConcept(next);
    setSelected(null);
    setDiag(null);
    setConsecWrong(0);
    setHintTier(0);
    setScreen("latihan");
  }

  function openLatihanFor(concept) {
    setActiveConcept(concept);
    setSelected(null);
    setDiag(null);
    setConsecWrong(0);
    setHintTier(0);
    setScreen("latihan");
  }

  function currentQ() {
    const pool = PRACTICE_POOL[activeConcept] || [];
    if (pool.length === 0) return { text: "Soal untuk konsep ini belum tersedia.", options: [] };
    const idx = (poolIndex[activeConcept] || 0) % pool.length;
    return pool[idx];
  }

  function submitAnswer() {
    const q = currentQ();
    const opt = q.options[selected];
    if (opt.correct) {
      const score = hintTier === 0 ? 1.0 : hintTier === 1 ? 0.7 : hintTier === 2 ? 0.4 : 0.1;
      setAttempts((a) => ({ ...a, [activeConcept]: [...a[activeConcept], score] }));
      setDiag({ correct: true, msg: "Jawabanmu tepat.", score });
    } else {
      const nw = consecWrong + 1;
      setConsecWrong(nw);
      setDiag({ correct: false, tag: opt.tag || null, tier: nw >= 3 ? 3 : nw, resolved: nw >= 3 });
      if (nw >= 3) {
        setAttempts((a) => ({ ...a, [activeConcept]: [...a[activeConcept], 0.1] }));
      }
      if (opt.tag) setMisconceptions((m) => [...m, { concept: activeConcept, tag: opt.tag }]);
    }
    setScreen("diagnosis");
  }

  function afterDiagnosisCorrectOrResolved() {
    setPoolIndex((p) => ({ ...p, [activeConcept]: p[activeConcept] + 1 }));
    setSelected(null);
    setDiag(null);
    setConsecWrong(0);
    setHintTier(0);
    goStudy();
  }

  function goToHint() {
    setHintTier(diag.tier);
    setScreen("hint");
  }

  function afterHint() {
    if (diag.resolved) {
      afterDiagnosisCorrectOrResolved();
    } else {
      setSelected(null);
      setDiag(null);
      setScreen("latihan");
    }
  }

  async function logout() {
    await signOut(auth);
    setScreen("dashboard");
    setGuruStudents([]);
  }

  function startEditProfil() {
    setEditName(profile.name || "");
    setEditKelas(profile.kelas || "");
    setEditAvatarColor(profile.avatarColor || 0);
    setEditingProfil(true);
  }

  async function saveProfil() {
    if (!editName.trim() || !authUser) return;
    setSavingProfil(true);
    try {
      const updates = { name: editName.trim(), avatarColor: editAvatarColor };
      if (profile.role === "siswa") updates.kelas = editKelas.trim();
      await setDoc(doc(db, "users", authUser.uid), updates, { merge: true });
      setProfile((p) => ({ ...p, ...updates }));
      setEditingProfil(false);
    } catch (e) {}
    setSavingProfil(false);
  }

  const overallPct = useMemo(() => overallPctOf(attempts), [attempts]);

  // Evaluasi progres: cari konsep dengan status "Butuh remedial" (prioritas utama),
  // kalau tidak ada, cari konsep dengan penguasaan terendah yang sudah pernah dicoba.
  const weakestConcept = useMemo(() => {
    const remedial = CONCEPT_ORDER.find((c) => statuses[c]?.label === "Butuh remedial");
    if (remedial) return remedial;
    const tried = CONCEPT_ORDER.filter((c) => (attempts[c] || []).length > 0 && statuses[c]?.label !== "Dikuasai");
    if (tried.length === 0) return null;
    tried.sort((a, b) => (computeMastery(attempts[a]) ?? 0) - (computeMastery(attempts[b]) ?? 0));
    return tried[0];
  }, [attempts, statuses]);

  function openTutorForConcept(conceptId) {
    setTutorFocusConcept(conceptId);
    setScreen("tutorAI");
  }

  async function clearTutorHistory() {
    setTutorMessages([]);
    setTutorFocusConcept(null);
    tutorGreetedRef.current = false;
  }

  useEffect(() => {
    if (screen !== "tutorAI" || !tutorFocusConcept || tutorGreetedRef.current) return;
    tutorGreetedRef.current = true;
    const c = tutorFocusConcept;
    const greet = {
      role: "ai",
      text: `Halo! Berdasarkan progres belajarmu, kamu masih perlu penguatan di konsep "${CONCEPTS[c].name}". ${MATERI[c].penjelasan} Ada bagian yang membingungkan atau mau coba contoh soal bareng?`,
    };
    setTutorMessages((m) => [...m, greet]);
  }, [screen, tutorFocusConcept]);
  useEffect(() => { if (screen !== "profil") setEditingProfil(false); }, [screen]);
  const xp = useMemo(() => computeXp(attempts), [attempts]);
  const { level, xpInLevel, xpTarget } = useMemo(() => computeLevel(xp), [xp]);
  const badgeStats = useMemo(() => computeBadgeStats(attempts, statuses, streak), [attempts, statuses, streak]);
  const earnedBadges = useMemo(() => BADGES.filter((b) => b.check(badgeStats)), [badgeStats]);

  async function loadLeaderboard() {
    setLeaderboardLoading(true);
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "siswa")));
      const list = [];
      for (const uDoc of usersSnap.docs) {
        const u = uDoc.data();
        const progSnap = await getDoc(doc(db, "progress", uDoc.id));
        const prog = progSnap.exists() ? progSnap.data() : {};
        const sXp = computeXp(prog.attempts || EMPTY_ATTEMPTS);
        list.push({ uid: uDoc.id, name: u.name || "Siswa", xp: sXp, streak: prog.streak || 0, level: computeLevel(sXp).level });
      }
      list.sort((a, b) => b.xp - a.xp);
      setLeaderboardStudents(list);
    } catch (e) {}
    setLeaderboardLoading(false);
  }

  async function submitAuth() {
    setAuthError("");
    if (!authEmail.trim() || !authPassword.trim() || (authTab === "daftar" && (!authName.trim() || !authKelas.trim() || !authSekolah.trim()))) {
      setAuthError("Lengkapi semua kolom terlebih dahulu.");
      return;
    }
    if (authTab === "daftar" && authPassword !== authPassword2) {
      setAuthError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setAuthSubmitting(true);
    try {
      if (authTab === "daftar") {
        const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        const uid = cred.user.uid;
        const profileData = { name: authName.trim(), role: authRole, email: authEmail.trim() };
        if (authRole === "siswa") { profileData.kelas = authKelas.trim(); profileData.sekolah = authSekolah.trim(); }
        await setDoc(doc(db, "users", uid), profileData);
        if (authRole === "siswa") {
          await setDoc(doc(db, "progress", uid), { attempts: EMPTY_ATTEMPTS, misconceptions: [], poolIndex: EMPTY_POOLIDX });
        }
      } else {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      }
    } catch (e) {
      const map = {
        "auth/email-already-in-use": "Email ini sudah terdaftar. Coba login.",
        "auth/invalid-email": "Format email tidak valid.",
        "auth/weak-password": "Kata sandi minimal 6 karakter.",
        "auth/invalid-credential": "Email atau kata sandi salah.",
        "auth/user-not-found": "Akun tidak ditemukan.",
        "auth/wrong-password": "Kata sandi salah.",
      };
      setAuthError(map[e.code] || "Terjadi kesalahan. Coba lagi.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function loadGuruData() {
    setGuruLoading(true);
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "siswa")));
      const list = [];
      for (const uDoc of usersSnap.docs) {
        const u = uDoc.data();
        const progSnap = await getDoc(doc(db, "progress", uDoc.id));
        const prog = progSnap.exists() ? progSnap.data() : { attempts: EMPTY_ATTEMPTS, misconceptions: [] };
        list.push({ uid: uDoc.id, name: u.name || "Siswa", kelas: u.kelas, sekolah: u.sekolah, attempts: prog.attempts || EMPTY_ATTEMPTS, misconceptions: prog.misconceptions || [] });
      }
      setGuruStudents(list);
    } catch (e) {}
    setGuruLoading(false);
  }

  useEffect(() => {
    if (mode === "app" && profile?.role === "guru") loadGuruData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile]);

  useEffect(() => {
    if (mode === "app" && profile?.role === "siswa" && screen === "leaderboard") loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile, screen]);

  const guruClasses = useMemo(() => {
    const set = new Set(guruStudents.map((s) => s.kelas).filter(Boolean));
    return Array.from(set).sort();
  }, [guruStudents]);
  const guruFilteredStudents = useMemo(() => {
    if (guruKelasFilter === "semua") return guruStudents;
    return guruStudents.filter((s) => s.kelas === guruKelasFilter);
  }, [guruStudents, guruKelasFilter]);

  const guruAvgPct = useMemo(() => {
    if (guruFilteredStudents.length === 0) return 0;
    const sum = guruFilteredStudents.reduce((a, s) => a + overallPctOf(s.attempts), 0);
    return Math.round(sum / guruFilteredStudents.length);
  }, [guruFilteredStudents]);

  function guruConceptMastery(c) {
    const ms = guruFilteredStudents.map((s) => computeMastery(s.attempts[c] || [])).filter((m) => m !== null);
    if (ms.length === 0) return null;
    return ms.reduce((a, b) => a + b, 0) / ms.length;
  }
  const guruHardestConcept = useMemo(() => {
    const withData = CONCEPT_ORDER.filter((c) => guruConceptMastery(c) !== null);
    if (withData.length === 0) return "Belum ada data";
    const worst = withData.sort((a, b) => guruConceptMastery(a) - guruConceptMastery(b))[0];
    return CONCEPTS[worst].name;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guruFilteredStudents]);
  const allMisconceptions = useMemo(
    () => guruFilteredStudents.flatMap((s) => (s.misconceptions || []).map((m) => ({ ...m, student: s.name }))),
    [guruFilteredStudents]
  );

  async function exportGuruExcel() {
    const XLSX = await import("xlsx");
    const rows = guruFilteredStudents.map((s) => {
      const row = { Nama: s.name, Kelas: s.kelas || "-", "Asal Sekolah": s.sekolah || "-" };
      CONCEPT_ORDER.forEach((c) => {
        const m = computeMastery(s.attempts[c] || []);
        row[CONCEPTS[c].name] = m !== null ? Math.round(m * 100) + "%" : "Belum diuji";
      });
      row["Progress Keseluruhan"] = overallPctOf(s.attempts) + "%";
      row["Jumlah Miskonsepsi Tercatat"] = (s.misconceptions || []).length;
      return row;
    });
    if (rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kemampuan Siswa");
    const namaFile = guruKelasFilter === "semua" ? "laporan-semua-kelas.xlsx" : `laporan-kelas-${guruKelasFilter}.xlsx`;
    XLSX.writeFile(wb, namaFile);
  }

  if (authLoading) {
    return (
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <GlobalStyle />
        {!authTimedOut ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}><Loader2 size={18} className="spin" /> Memuat...</div>
        ) : (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 12 }}>Koneksi lambat atau bermasalah. Coba muat ulang halaman.</p>
            <button className="btn-primary" onClick={() => window.location.reload()}><RefreshCw size={15} /> Muat Ulang</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wrap">
      <GlobalStyle />

      {mode === "landing" && (
        <div className="body-area">
          <div className="hero-card" style={{ textAlign: "center" }}>
            <div className="brand" style={{ justifyContent: "center", marginBottom: 10, color: "white" }}><GraduationCap size={22} /> AC-ITS</div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", opacity: 0.85, fontWeight: 700, marginBottom: 6 }}>Adaptive Concept-Based Intelligent Tutoring System</div>
            <h1 className="disp" style={{ fontSize: 27, margin: "10px 0" }}>Belajar Matematika Lebih Cerdas</h1>
            <p style={{ opacity: 0.92, fontSize: 14, maxWidth: 420, margin: "0 auto 22px" }}>
              Sistem pembelajaran adaptif materi Eksponensial — lewat komik interaktif, AI Tutor, dan latihan yang menyesuaikan dirimu.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn-primary" style={{ background: "white", color: "var(--brand-dark)", boxShadow: "none" }} onClick={() => { setMode("auth"); setAuthTab("login"); setAuthRole("siswa"); setAuthError(""); }}><User size={15} /> Saya Siswa</button>
              <button className="btn-ghost" style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.4)" }} onClick={() => { setMode("auth"); setAuthTab("login"); setAuthRole("guru"); setAuthError(""); }}><Users size={15} /> Saya Guru</button>
            </div>
          </div>
        </div>
      )}

      {mode === "auth" && (
        <div className="body-area">
          <div className="card" style={{ maxWidth: 400, margin: "0 auto" }}>
            <div className="tag-eyebrow">{authTab === "login" ? "Login" : "Daftar Akun"}</div>
            <h2 className="disp" style={{ fontSize: 19, marginBottom: 14 }}>{authTab === "login" ? "Selamat datang kembali" : "Buat akun baru"}</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button className="btn-ghost" style={{ flex: 1, justifyContent: "center", ...(authTab === "login" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }} onClick={() => { setAuthTab("login"); setAuthError(""); }}>Login</button>
              <button className="btn-ghost" style={{ flex: 1, justifyContent: "center", ...(authTab === "daftar" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }} onClick={() => { setAuthTab("daftar"); setAuthError(""); }}>Daftar</button>
            </div>

            {authError && <div className="err-box"><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {authError}</div>}

            {authTab === "daftar" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>Daftar sebagai</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-ghost" style={{ flex: 1, justifyContent: "center", ...(authRole === "siswa" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }} onClick={() => setAuthRole("siswa")}><User size={14} /> Siswa</button>
                    <button className="btn-ghost" style={{ flex: 1, justifyContent: "center", ...(authRole === "guru" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }} onClick={() => setAuthRole("guru")}><Users size={14} /> Guru</button>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}><input type="text" placeholder="Nama lengkap" value={authName} onChange={(e) => setAuthName(e.target.value)} /></div>
                {authRole === "siswa" && (
                  <>
                    <div style={{ marginBottom: 10 }}><input type="text" placeholder="Kelas (contoh: 9A, IX-A)" value={authKelas} onChange={(e) => setAuthKelas(e.target.value)} /></div>
                    <div style={{ marginBottom: 10 }}><input type="text" placeholder="Asal sekolah" value={authSekolah} onChange={(e) => setAuthSekolah(e.target.value)} /></div>
                  </>
                )}
              </>
            )}

            <div style={{ marginBottom: 10 }} className="inputwrap"><Mail size={15} /><input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} /></div>
            <div style={{ marginBottom: authTab === "daftar" ? 10 : 16 }} className="inputwrap"><Lock size={15} /><input type="password" placeholder="Kata sandi (min. 6 karakter)" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} /></div>
            {authTab === "daftar" && (
              <div style={{ marginBottom: 16 }} className="inputwrap"><Lock size={15} /><input type="password" placeholder="Ulangi kata sandi" value={authPassword2} onChange={(e) => setAuthPassword2(e.target.value)} /></div>
            )}

            <button className="btn-primary" disabled={authSubmitting} onClick={submitAuth} style={{ width: "100%", justifyContent: "center" }}>
              {authSubmitting ? <Loader2 size={15} className="spin" /> : (authTab === "login" ? <>Login <ArrowRight size={15} /></> : <>Daftar &amp; Mulai Belajar <ArrowRight size={15} /></>)}
            </button>
          </div>
        </div>
      )}

      {mode === "app" && profile && (
        <div className="app-shell">
          <aside className="sidebar">
            <div className="sidebar-brand brand"><GraduationCap size={20} /> AC-ITS</div>

            {profile.role === "siswa" && (
              <nav className="sidebar-nav">
                <button className={"sidebar-navbtn" + (screen === "dashboard" ? " active" : "")} onClick={() => setScreen("dashboard")}><LayoutDashboard size={17} />Dashboard</button>
                <button className={"sidebar-navbtn" + (screen === "tutorAI" ? " active" : "")} onClick={() => { setTutorFocusConcept(null); setScreen("tutorAI"); }}><MessageCircle size={17} />Tutor AI</button>
                <button className={"sidebar-navbtn" + (screen === "materiList" || screen === "materi" ? " active" : "")} onClick={() => setScreen("materiList")}><BookOpen size={17} />Materi</button>
                <button className={"sidebar-navbtn" + (screen === "latihanList" || screen === "latihan" || screen === "diagnosis" || screen === "hint" ? " active" : "")} onClick={() => setScreen("latihanList")}><PenLine size={17} />Latihan</button>
                <button className={"sidebar-navbtn" + (screen === "progress" ? " active" : "")} onClick={() => setScreen("progress")}><TrendingUp size={17} />Progress</button>
                <button className={"sidebar-navbtn" + (screen === "leaderboard" ? " active" : "")} onClick={() => setScreen("leaderboard")}><Trophy size={17} />Peringkat</button>
                <button className={"sidebar-navbtn" + (screen === "badges" ? " active" : "")} onClick={() => setScreen("badges")}><Award size={17} />Koleksi Badge</button>
                <button className={"sidebar-navbtn" + (screen === "profil" ? " active" : "")} onClick={() => setScreen("profil")}><User size={17} />Profil</button>
              </nav>
            )}

            {profile.role === "guru" && (
              <nav className="sidebar-nav">
                <button className={"sidebar-navbtn" + (guruTab === "beranda" ? " active" : "")} onClick={() => setGuruTab("beranda")}><LayoutDashboard size={17} />Beranda</button>
                <button className={"sidebar-navbtn" + (guruTab === "analitik" ? " active" : "")} onClick={() => setGuruTab("analitik")}><TrendingUp size={17} />Analitik</button>
                <button className={"sidebar-navbtn" + (guruTab === "materi" ? " active" : "")} onClick={() => setGuruTab("materi")}><Database size={17} />Knowledge Base</button>
              </nav>
            )}

            <div className="sidebar-profile-card">
              <div className="avatar" style={{ background: AVATAR_GRADIENTS[profile.avatarColor || 0] }}>{(profile.name || "?").trim().charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name || "Pengguna"}</div>
                <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{profile.role === "siswa" ? "Siswa" : "Guru"}</div>
              </div>
              <button className="btn-ghost" style={{ padding: 7 }} onClick={logout} title="Keluar"><LogOut size={13} /></button>
            </div>
          </aside>

          {profile.role === "siswa" && (
            <nav className="floating-nav">
              <button className={"sidebar-navbtn" + (screen === "dashboard" ? " active" : "")} onClick={() => setScreen("dashboard")}><LayoutDashboard size={17} />Home</button>
              <button className={"sidebar-navbtn" + (screen === "tutorAI" ? " active" : "")} onClick={() => { setTutorFocusConcept(null); setScreen("tutorAI"); }}><MessageCircle size={17} />Tutor</button>
              <button className={"sidebar-navbtn" + (screen === "materiList" || screen === "materi" ? " active" : "")} onClick={() => setScreen("materiList")}><BookOpen size={17} />Materi</button>
              <button className={"sidebar-navbtn" + (screen === "latihanList" || screen === "latihan" || screen === "diagnosis" || screen === "hint" ? " active" : "")} onClick={() => setScreen("latihanList")}><PenLine size={17} />Latihan</button>
              <button className={"sidebar-navbtn" + (screen === "progress" ? " active" : "")} onClick={() => setScreen("progress")}><TrendingUp size={17} />Progress</button>
              <button className={"sidebar-navbtn" + (screen === "leaderboard" ? " active" : "")} onClick={() => setScreen("leaderboard")}><Trophy size={17} />Rank</button>
              <button className={"sidebar-navbtn" + (screen === "badges" ? " active" : "")} onClick={() => setScreen("badges")}><Award size={17} />Badge</button>
              <button className={"sidebar-navbtn" + (screen === "profil" ? " active" : "")} onClick={() => setScreen("profil")}><User size={17} />Profil</button>
            </nav>
          )}
          {profile.role === "guru" && (
            <nav className="floating-nav">
              <button className={"sidebar-navbtn" + (guruTab === "beranda" ? " active" : "")} onClick={() => setGuruTab("beranda")}><LayoutDashboard size={17} />Beranda</button>
              <button className={"sidebar-navbtn" + (guruTab === "analitik" ? " active" : "")} onClick={() => setGuruTab("analitik")}><TrendingUp size={17} />Analitik</button>
              <button className={"sidebar-navbtn" + (guruTab === "materi" ? " active" : "")} onClick={() => setGuruTab("materi")}><Database size={17} />KB</button>
              <button className="sidebar-navbtn" onClick={logout}><LogOut size={17} />Keluar</button>
            </nav>
          )}

          <div className="app-main-scroll" style={{ display: "flex", flexDirection: "column" }}>
            {profile.role === "siswa" && (
              <div className="body-area">
                {!progressLoaded && (
                  <div className="card" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}><Loader2 size={16} className="spin" /> Memuat progress belajarmu...</div>
                )}

                {progressLoaded && screen !== "komikChapter" && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    <span className="streak-chip">🔥 Streak {streak} hari</span>
                    <span className="xp-chip">⭐ Level {level} · {xpInLevel}/{xpTarget} XP</span>
                    <span className="pill" style={{ background: "var(--teal-light)", color: "#0F7A56" }}>🏅 {earnedBadges.length}/{BADGES.length} Badge</span>
                  </div>
                )}

                {progressLoaded && screen === "dashboard" && (
                  <>
                    {weakestConcept && (
                      <div className="card" style={{ marginBottom: 16, borderColor: "var(--amber)", background: "var(--amber-light)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <Sparkles size={18} style={{ color: "#9A6414" }} />
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: "#9A6414" }}>Rekomendasi AI</div>
                        </div>
                        <p style={{ fontSize: 13, color: "#6b4d10", marginBottom: 10 }}>
                          Berdasarkan progresmu, kamu masih perlu penguatan di konsep <b>{CONCEPTS[weakestConcept].name}</b>. Mau dibantu Tutor AI mendalami bagian ini?
                        </p>
                        <button className="btn-primary" style={{ background: "#9A6414", boxShadow: "none" }} onClick={() => openTutorForConcept(weakestConcept)}><MessageCircle size={14} /> Tanya Tutor soal ini</button>
                      </div>
                    )}
                    <div className="hero-card" style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>Halo, {profile.name || "Siswa"} 👋</div>
                      <h2 className="disp" style={{ fontSize: 22, margin: "6px 0 4px" }}>Semangat belajar hari ini!</h2>
                      <p style={{ opacity: 0.9, fontSize: 13, marginBottom: 16 }}>Progress latihan konsep kamu sejauh ini</p>
                      <div className="bar-track"><div className="bar-fill" style={{ width: overallPct + "%" }} /></div>
                      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6, marginBottom: 18, fontWeight: 700 }}>{overallPct}% selesai</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="btn-primary" style={{ background: "white", color: "var(--brand-dark)", boxShadow: "none" }} onClick={() => setScreen("materiList")}><BookOpen size={15} /> Baca Materi</button>
                        <button className="btn-ghost" style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.4)" }} onClick={goStudy}>Latihan Konsep <ArrowRight size={15} /></button>
                        <button className="btn-ghost" style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.4)" }} onClick={() => { setTutorFocusConcept(null); setScreen("tutorAI"); }}><MessageCircle size={15} /> Tanya Tutor</button>
                      </div>
                    </div>
                    <div className="card">
                      <div className="tag-eyebrow">Progress per konsep</div>
                      {CONCEPT_ORDER.map((c) => {
                        const st = statuses[c]; const m = computeMastery(attempts[c]);
                        return (
                          <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                            <span style={{ fontWeight: 600 }}>{CONCEPTS[c].name}</span>
                            <span className="pill" style={{ background: toneColor[st.tone] + "22", color: toneColor[st.tone] }}>{st.label}{m !== null && ` · ${Math.round(m * 100)}%`}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {progressLoaded && screen === "tutorAI" && (
                  <div className="card" style={{ padding: 16 }}>
                    <div className="tag-eyebrow">Tutor AI</div>
                    <h2 className="disp" style={{ fontSize: 18, marginBottom: 4 }}>
                      {tutorFocusConcept ? `Pendalaman: ${CONCEPTS[tutorFocusConcept].name}` : "Tanya apa saja soal materi Eksponen"}
                    </h2>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Riwayat percakapanmu tersimpan otomatis, tidak akan hilang saat pindah halaman.</p>
                    <AiTutor
                      messages={tutorMessages}
                      setMessages={setTutorMessages}
                      onClearHistory={clearTutorHistory}
                      context={
                        "Materi yang dipelajari siswa: Eksponensial, mencakup konsep " +
                        CONCEPT_ORDER.map((c) => CONCEPTS[c].name).join(", ") + ". " +
                        (tutorFocusConcept
                          ? "Siswa sedang butuh pendalaman khusus pada konsep: " + CONCEPTS[tutorFocusConcept].name + " (" + MATERI[tutorFocusConcept].penjelasan + "). Fokuskan bantuanmu ke konsep ini."
                          : "Saat ini siswa sedang fokus pada konsep: " + CONCEPTS[activeConcept].name + " (" + MATERI[activeConcept].penjelasan + ").")
                      }
                    />
                  </div>
                )}

                {progressLoaded && screen === "materiList" && (
                  <div className="card">
                    <div className="tag-eyebrow">Materi Ajar</div>
                    <h2 className="disp" style={{ fontSize: 19, marginBottom: 14 }}>Eksponensial · {CONCEPT_ORDER.length} sub-materi</h2>
                    {CONCEPT_ORDER.map((c, i) => {
                      const st = statuses[c];
                      return (
                        <button key={c} onClick={() => { setActiveConcept(c); setSelected(null); setDiag(null); setConsecWrong(0); setHintTier(0); setScreen("materi"); }}
                          style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: 14, borderRadius: 14, border: "1.5px solid var(--line)", marginBottom: 10, background: "white" }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--brand-light)", color: "var(--brand-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: 12.5 }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{CONCEPTS[c].name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)" }} className="mono">{CONCEPTS[c].short}</div>
                          </div>
                          <span className="pill" style={{ background: toneColor[st.tone] + "22", color: toneColor[st.tone] }}>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {progressLoaded && screen === "materi" && (
                  <div className="card">
                    {redirectNote && <div className="misc-item" style={{ marginBottom: 12 }}>↳ {redirectNote}</div>}
                    <div className="tag-eyebrow">Materi · {CONCEPTS[activeConcept].name}</div>
                    <div className="qtext">{MATERI[activeConcept].formula}</div>
                    <p style={{ fontSize: 14, lineHeight: 1.6 }}>{MATERI[activeConcept].penjelasan}</p>
                    <div style={{ background: "var(--paper-2)", borderRadius: 10, padding: 14, marginTop: 10, fontFamily: "'IBM Plex Mono'", fontSize: 13.5, whiteSpace: "pre-line", lineHeight: 1.8 }}>Contoh:
{MATERI[activeConcept].contoh}</div>
                    <div style={{ marginTop: 18 }}>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>Sudah paham? Lanjutkan ke:</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="btn-ghost" onClick={() => setScreen("materiList")}><ArrowLeft size={14} /> Daftar Materi</button>
                        <button className="btn-primary" onClick={() => { setSelected(null); setDiag(null); setConsecWrong(0); setHintTier(0); setScreen("latihan"); }}><PenLine size={15} /> Latihan Materi Ini</button>
                        {CONCEPT_ORDER.indexOf(activeConcept) < CONCEPT_ORDER.length - 1 && (
                          <button className="btn-ghost" onClick={() => setActiveConcept(CONCEPT_ORDER[CONCEPT_ORDER.indexOf(activeConcept) + 1])}>Materi Berikutnya <ArrowRight size={15} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "latihanList" && (
                  <div className="card">
                    <div className="tag-eyebrow">Latihan Soal</div>
                    <h2 className="disp" style={{ fontSize: 19, marginBottom: 4 }}>Pilih sub-materi untuk dilatih</h2>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>Soal latihan akan sesuai dengan sub-materi yang kamu pilih di bawah ini.</p>
                    {CONCEPT_ORDER.map((c, i) => {
                      const st = statuses[c];
                      return (
                        <button key={c} onClick={() => { setActiveConcept(c); setSelected(null); setDiag(null); setConsecWrong(0); setHintTier(0); setRedirectNote(null); setScreen("latihan"); }}
                          style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: 14, borderRadius: 14, border: "1.5px solid var(--line)", marginBottom: 10, background: "white" }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--brand-light)", color: "var(--brand-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: 12.5 }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{CONCEPTS[c].name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)" }} className="mono">{CONCEPTS[c].short} · {PRACTICE_POOL[c].length} soal tersedia</div>
                          </div>
                          <span className="pill" style={{ background: toneColor[st.tone] + "22", color: toneColor[st.tone] }}>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {progressLoaded && screen === "latihan" && (
                  <div className="card">
                    <div className="tag-eyebrow">Latihan · {CONCEPTS[activeConcept].name} · Salah berturut-turut: {consecWrong}</div>
                    <div className="qtext">{currentQ().text}</div>
                    {currentQ().options.map((opt, i) => (
                      <button key={i} className={"opt" + (selected === i ? " picked" : "")} onClick={() => setSelected(i)}>{opt.text}</button>
                    ))}
                    <div style={{ marginTop: 14 }}><button className="btn-primary" disabled={selected === null} onClick={submitAnswer}>Periksa Jawaban <ArrowRight size={15} /></button></div>
                  </div>
                )}

                {progressLoaded && screen === "diagnosis" && diag && (
                  <div className="card">
                    <div className="tag-eyebrow">Diagnosis &amp; Feedback</div>
                    {diag.correct ? (
                      <div className="ok-box"><CheckCircle2 size={18} /> Tepat! Skor percobaan ini: {diag.score.toFixed(1)}</div>
                    ) : (
                      <>
                        <div className="hint-box hint-t3"><AlertTriangle size={18} /> Belum tepat.</div>
                        <div style={{ fontSize: 13.5, marginBottom: 6 }}><b>Diagnosis sistem:</b> {diag.tag ? `Terdeteksi kemungkinan miskonsepsi "${diag.tag}".` : "Jawaban belum tepat, belum ada pola miskonsepsi spesifik yang cocok."}</div>
                        <div style={{ fontSize: 13.5, color: "var(--muted)" }}>Rekomendasi: coba pahami kembali konsep ini dengan bantuan hint.</div>
                      </>
                    )}
                    <div style={{ marginTop: 16 }}>
                      {diag.correct ? <button className="btn-primary" onClick={afterDiagnosisCorrectOrResolved}>Lanjut <ArrowRight size={15} /></button> : <button className="btn-primary" onClick={goToHint}><Lightbulb size={15} /> Lihat Hint</button>}
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "hint" && diag && (
                  <div className="card">
                    <div className="tag-eyebrow">Hint Adaptif · Tingkat {hintTier}</div>
                    <div className={"hint-box " + (hintTier === 1 ? "hint-t1" : hintTier === 2 ? "hint-t2" : "hint-t3")}>
                      <Lightbulb size={18} />
                      <div>
                        {hintTier === 1 && HINTS[activeConcept].t1}
                        {hintTier === 2 && HINTS[activeConcept].t2}
                        {hintTier === 3 && HINTS[activeConcept].full}
                        {hintTier === 3 && <div style={{ marginTop: 8, fontWeight: 600 }}>Konsep ini ditandai butuh remedial.</div>}
                      </div>
                    </div>
                    <button className="btn-primary" onClick={afterHint}>{hintTier === 3 ? "Mengerti, Lanjut" : "Mengerti, Coba Lagi"} <ArrowRight size={15} /></button>
                  </div>
                )}

                {progressLoaded && screen === "progress" && (
                  <div className="card">
                    <div className="tag-eyebrow">Progress Konsep</div>
                    {CONCEPT_ORDER.map((c) => {
                      const m = computeMastery(attempts[c]); const st = statuses[c]; const pct = m ? Math.round(m * 100) : 0;
                      return (
                        <div key={c} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                            <span style={{ fontWeight: 600 }}>{CONCEPTS[c].name}</span>
                            <span className="pill" style={{ background: toneColor[st.tone] + "22", color: toneColor[st.tone] }}>{st.label} {m !== null && `· ${pct}%`}</span>
                          </div>
                          <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%", background: toneColor[st.tone] }} /></div>
                        </div>
                      );
                    })}
                    {misconceptions.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div className="tag-eyebrow">Log miskonsepsi</div>
                        {misconceptions.map((m, i) => <div className="misc-item" key={i}>{CONCEPTS[m.concept].name}: {m.tag}</div>)}
                      </div>
                    )}
                  </div>
                )}

                {progressLoaded && screen === "leaderboard" && (
                  <div className="card">
                    <div className="tag-eyebrow">Peringkat Siswa</div>
                    <h2 className="disp" style={{ fontSize: 19, marginBottom: 14 }}>Papan Peringkat</h2>
                    {leaderboardLoading && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13.5 }}><Loader2 size={15} className="spin" /> Memuat peringkat...</div>}
                    {!leaderboardLoading && leaderboardStudents.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13.5 }}>Belum ada data siswa lain.</p>}
                    {!leaderboardLoading && leaderboardStudents.map((s, i) => (
                      <div key={s.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderBottom: "1px solid var(--line)", background: s.uid === authUser?.uid ? "var(--brand-light)" : "transparent", borderRadius: 10 }}>
                        <div style={{ width: 26, textAlign: "center", fontWeight: 700, color: i < 3 ? "var(--amber)" : "var(--muted)" }}>{i + 1}</div>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{s.name.trim().charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{s.name}{s.uid === authUser?.uid && " (Kamu)"}</div>
                        <span className="streak-chip">🔥 {s.streak}</span>
                        <span className="xp-chip">⭐ {s.xp} XP</span>
                      </div>
                    ))}
                  </div>
                )}

                {progressLoaded && screen === "badges" && (
                  <div className="card">
                    <div className="tag-eyebrow">Koleksi Badge</div>
                    <h2 className="disp" style={{ fontSize: 19, marginBottom: 4 }}>{earnedBadges.length} dari {BADGES.length} badge terkumpul</h2>
                    <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>Kumpulkan badge dengan aktif belajar dan membaca komik.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
                      {BADGES.map((b) => {
                        const earned = b.check(badgeStats);
                        return (
                          <div key={b.id} className={"badge-card " + (earned ? "earned" : "locked")}>
                            <div style={{ fontSize: 30, marginBottom: 6 }}>{b.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: 12.5 }}>{b.nama}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{b.desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "profil" && !editingProfil && (
                  <div className="card" style={{ textAlign: "center" }}>
                    <div className="avatar avatar-lg" style={{ margin: "0 auto 14px", background: AVATAR_GRADIENTS[profile.avatarColor || 0] }}>{(profile.name || "?").trim().charAt(0).toUpperCase()}</div>
                    <h2 className="disp" style={{ fontSize: 19 }}>{profile.name || "Siswa"}</h2>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "8px 0 14px", flexWrap: "wrap" }}>
                      {profile.kelas && <span className="pill" style={{ background: "var(--brand-light)", color: "var(--brand-dark)" }}>Kelas {profile.kelas}</span>}
                      {profile.sekolah && <span className="pill" style={{ background: "var(--paper-2)", color: "var(--muted)" }}>{profile.sekolah}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
                      <span className="streak-chip">🔥 Streak {streak} hari</span>
                      <span className="xp-chip">⭐ Level {level}</span>
                      <span className="pill" style={{ background: "var(--teal-light)", color: "#0F7A56" }}>🏅 {earnedBadges.length} Badge</span>
                    </div>
                    <div className="stat-chip" style={{ justifyContent: "center", margin: "0 auto 16px", maxWidth: 220 }}>
                      <TrendingUp size={15} style={{ color: "var(--brand)" }} /> Progress: {overallPct}%
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                      <button className="btn-primary" onClick={startEditProfil}>Edit Profil</button>
                      <button className="btn-ghost" onClick={logout}><LogOut size={14} /> Keluar</button>
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "profil" && !editingProfil && weakestConcept && (
                  <div className="card" style={{ marginTop: 16, borderColor: "var(--amber)", background: "var(--amber-light)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <Sparkles size={18} style={{ color: "#9A6414" }} />
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#9A6414" }}>Evaluasi AI</div>
                    </div>
                    <p style={{ fontSize: 13, color: "#6b4d10", marginBottom: 10 }}>
                      Kamu masih perlu penguatan di konsep <b>{CONCEPTS[weakestConcept].name}</b>.
                    </p>
                    <button className="btn-primary" style={{ background: "#9A6414", boxShadow: "none" }} onClick={() => openTutorForConcept(weakestConcept)}><MessageCircle size={14} /> Tanya Tutor soal ini</button>
                  </div>
                )}

                {progressLoaded && screen === "profil" && editingProfil && (
                  <div className="card" style={{ maxWidth: 380, margin: "0 auto" }}>
                    <div className="tag-eyebrow">Edit Profil</div>
                    <h2 className="disp" style={{ fontSize: 18, marginBottom: 14 }}>Ubah data kamu</h2>

                    <div style={{ marginBottom: 14, textAlign: "center" }}>
                      <div className="avatar avatar-lg" style={{ margin: "0 auto 10px", background: AVATAR_GRADIENTS[editAvatarColor] }}>{(editName || "?").trim().charAt(0).toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600 }}>Pilih warna avatar</div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        {AVATAR_GRADIENTS.map((g, i) => (
                          <button key={i} className={"avatar-btn" + (editAvatarColor === i ? " picked" : "")} onClick={() => setEditAvatarColor(i)}
                            style={{ width: 30, height: 30, borderRadius: "50%", background: g, padding: 0 }} />
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, fontWeight: 600 }}>Nama Lengkap</div>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>

                    {profile.role === "siswa" && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, fontWeight: 600 }}>Kelas</div>
                        <input type="text" value={editKelas} onChange={(e) => setEditKelas(e.target.value)} placeholder="contoh: X-A" />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="btn-ghost" onClick={() => setEditingProfil(false)}>Batal</button>
                      <button className="btn-primary" disabled={!editName.trim() || savingProfil} onClick={saveProfil}>
                        {savingProfil ? <Loader2 size={15} className="spin" /> : "Simpan Perubahan"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {profile.role === "guru" && (
              <div className="body-area">
                <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Kelas:</span>
                    <select value={guruKelasFilter} onChange={(e) => setGuruKelasFilter(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid var(--line)", fontSize: 13, background: "white" }}>
                      <option value="semua">Semua Kelas ({guruStudents.length} siswa)</option>
                      {guruClasses.map((k) => (
                        <option key={k} value={k}>{k} ({guruStudents.filter((s) => s.kelas === k).length} siswa)</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-ghost" onClick={exportGuruExcel} disabled={guruFilteredStudents.length === 0}><Database size={14} /> Export Excel</button>
                    <button className="btn-ghost" onClick={loadGuruData} disabled={guruLoading}>{guruLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Muat ulang</button>
                  </div>
                </div>

                {guruTab === "beranda" && (
                  <div className="card">
                    <div className="tag-eyebrow">Dashboard Guru — {guruKelasFilter === "semua" ? "Semua Kelas" : `Kelas ${guruKelasFilter}`}</div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, marginBottom: 18 }}>
                      <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Total siswa</div><div className="disp" style={{ fontSize: 22 }}>{guruFilteredStudents.length}</div></div>
                      <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Rata-rata penguasaan</div><div className="disp" style={{ fontSize: 22 }}>{guruAvgPct}%</div></div>
                      <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Konsep tersulit</div><div className="disp" style={{ fontSize: 16 }}>{guruHardestConcept}</div></div>
                    </div>
                    {guruFilteredStudents.length === 0 && !guruLoading && <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Belum ada siswa pada kelas ini, atau belum ada aktivitas belajar.</p>}
                    {CONCEPT_ORDER.map((c) => {
                      const m = guruConceptMastery(c); const pct = m ? Math.round(m * 100) : 0;
                      const st = m === null ? { tone: "neutral" } : (pct >= 75 ? { tone: "good" } : pct >= 40 ? { tone: "warn" } : { tone: "bad" });
                      return (
                        <div key={c} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{CONCEPTS[c].name}</span><span>{m !== null ? pct + "%" : "–"}</span></div>
                          <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%", background: toneColor[st.tone] }} /></div>
                        </div>
                      );
                    })}
                    {guruFilteredStudents.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <div className="tag-eyebrow">Daftar siswa</div>
                        <table>
                          <thead><tr><th>Nama</th><th>Kelas</th><th>Sekolah</th><th>Progress</th></tr></thead>
                          <tbody>{guruFilteredStudents.map((s) => (<tr key={s.uid}><td>{s.name}</td><td>{s.kelas || "-"}</td><td>{s.sekolah || "-"}</td><td>{overallPctOf(s.attempts)}%</td></tr>))}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {guruTab === "analitik" && (
                  <div className="card">
                    <div className="tag-eyebrow">Heatmap miskonsepsi (seluruh siswa)</div>
                    {allMisconceptions.length === 0 && <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Belum ada miskonsepsi terdeteksi.</p>}
                    {CONCEPT_ORDER.map((c) => {
                      const items = allMisconceptions.filter((m) => m.concept === c);
                      if (items.length === 0) return null;
                      const counts = {};
                      items.forEach((m) => { counts[m.tag] = (counts[m.tag] || 0) + 1; });
                      return (
                        <div key={c} style={{ marginBottom: 12 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>{CONCEPTS[c].name}</div>
                          {Object.entries(counts).map(([tag, n]) => (<div className="misc-item" key={tag} style={{ display: "inline-block", marginRight: 6 }}>{tag} × {n}</div>))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {guruTab === "materi" && (
                  <div className="card">
                    <div className="tag-eyebrow">Knowledge Base — contoh entri</div>
                    <table>
                      <thead><tr><th>ID</th><th>Nama konsep</th><th>Deskripsi</th><th>Prasyarat</th><th>Status</th></tr></thead>
                      <tbody>{KB_ROWS.map((r) => (<tr key={r.id}><td className="mono">{r.id}</td><td>{r.nama}</td><td>{r.deskripsi}</td><td className="mono">{r.prereq}</td><td>{r.status}</td></tr>))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalStyle() {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      <style>{`
        :root {
          --paper:#F6F5FC; --paper-2:#EFEDFB; --ink:#1E1B33; --muted:#7A768E;
          --teal:#1FAE7F; --teal-light:#DDF6EC; --amber:#F5A524; --amber-light:#FEF1DA;
          --plum:#8B5CF6; --plum-light:#EDE6FE; --rose:#F0466E; --rose-light:#FDE3EA;
          --line:#E6E3F5; --brand:#7C5CFC; --brand-light:#EEE9FF; --brand-dark:#6238E0;
        }
        .wrap { font-family:'Inter',sans-serif; background:var(--paper); color:var(--ink); border-radius:20px; padding:0; min-height:100%; overflow:visible; }
        .disp { font-family:'Baloo 2',sans-serif; font-weight:700; }
        .mono { font-family:'IBM Plex Mono',monospace; }
        button { font-family:'Inter'; cursor:pointer; }
        .btn-primary { background:linear-gradient(135deg,var(--brand),var(--brand-dark)); color:white; border:none; padding:11px 20px; border-radius:12px; font-weight:600; font-size:14px; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 14px rgba(124,92,252,0.35); }
        .btn-primary:disabled { opacity:0.35; cursor:not-allowed; box-shadow:none; }
        .btn-ghost { background:white; border:1px solid var(--line); color:var(--ink); padding:9px 16px; border-radius:12px; font-size:13.5px; display:inline-flex; align-items:center; gap:6px; }
        input[type=text],input[type=password],input[type=email] { width:100%; padding:11px 13px; border-radius:12px; border:1.5px solid var(--line); font-size:14px; box-sizing:border-box; background:white; }
        textarea { font-family:'Inter'; border-radius:12px; }
        .card { background:white; border:1px solid var(--line); border-radius:18px; padding:22px; box-shadow:0 2px 10px rgba(90,70,190,0.05); }
        .hero-card { background:linear-gradient(135deg,var(--brand) 0%,#A78BFA 55%,#F472B6 130%); color:white; border-radius:20px; padding:24px; box-shadow:0 10px 30px rgba(124,92,252,0.35); }
        .hero-card .bar-track { background:rgba(255,255,255,0.3); }
        .hero-card .bar-fill { background:white; }
        .avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,var(--brand),#F472B6); color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; font-family:'Baloo 2',sans-serif; flex-shrink:0; }
        .avatar-lg { width:76px; height:76px; font-size:26px; }
        .pill { font-size:11.5px; padding:4px 11px; border-radius:999px; font-weight:700; }
        .stat-chip { background:white; border:1px solid var(--line); border-radius:14px; padding:10px 14px; display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; }
        .opt { display:block; width:100%; text-align:left; padding:13px 14px; border-radius:12px; border:1.5px solid var(--line); background:var(--paper-2); margin-bottom:9px; font-size:14.5px; font-family:'IBM Plex Mono'; transition:border-color .15s; }
        .opt.picked { border-color:var(--brand); background:var(--brand-light); }
        .qtext { font-family:'IBM Plex Mono'; font-size:22px; margin:14px 0 20px; }
        .bar-track { background:var(--paper-2); border-radius:999px; height:9px; overflow:hidden; margin-top:6px; }
        .bar-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--brand),#C084FC); }
        .tag-eyebrow { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; font-weight:700; }
        .hint-box { display:flex; gap:10px; padding:14px; border-radius:14px; margin:14px 0; font-size:13.5px; line-height:1.5; }
        .hint-t1 { background:var(--plum-light); color:var(--plum); }
        .hint-t2 { background:var(--amber-light); color:#9A6414; }
        .hint-t3 { background:var(--rose-light); color:var(--rose); }
        .ok-box { background:var(--teal-light); color:#0F7A56; padding:14px; border-radius:14px; margin:14px 0; font-size:13.5px; display:flex; gap:10px; align-items:center; font-weight:600; }
        .err-box { background:var(--rose-light); color:var(--rose); padding:11px 14px; border-radius:12px; margin-bottom:14px; font-size:13px; font-weight:600; }
        .topbar { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; border-bottom:1px solid var(--line); background:white; }
        .brand { display:flex; align-items:center; gap:8px; font-weight:700; color:var(--brand-dark); font-size:17px; font-family:'Baloo 2',sans-serif; }
        .body-area { padding:20px; }
        .bottomnav { display:flex; gap:4px; padding:10px 12px; background:white; border-top:1px solid var(--line); }
        .navbtn { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:8px 0; font-size:10.5px; color:var(--muted); background:none; border:none; border-radius:12px; font-weight:600; }
        .navbtn.active { color:var(--brand-dark); background:var(--brand-light); }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th,td { text-align:left; padding:9px 10px; border-bottom:1px solid var(--line); }
        th { color:var(--muted); font-weight:700; font-size:11.5px; text-transform:uppercase; letter-spacing:.03em; }
        .tabbtn { padding:8px 14px; border-radius:12px; border:1.5px solid var(--line); background:white; font-size:13px; margin-right:8px; margin-bottom:6px; font-weight:600; color:var(--ink); }
        .tabbtn.active { background:var(--brand); color:white; border-color:var(--brand); }
        .misc-item { font-size:12.5px; color:#9A6414; background:var(--amber-light); padding:7px 11px; border-radius:10px; margin-top:6px; font-weight:600; }
        .inputwrap { position:relative; }
        .inputwrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); }
        .inputwrap input { padding-left:36px; }
        .app-shell { display:flex; align-items:flex-start; min-height:100vh; }
        .sidebar { width:216px; flex-shrink:0; background:white; border-right:1px solid var(--line); padding:18px 14px; display:flex; flex-direction:column; position:sticky; top:0; align-self:flex-start; height:100vh; overflow-y:auto; }
        .app-main-scroll { flex:1; min-width:0; }
        .sidebar-nav { display:flex; flex-direction:column; gap:3px; margin-top:18px; flex:1; }
        .sidebar-navbtn { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; border:none; background:none; color:var(--muted); font-size:13.5px; font-weight:600; text-align:left; width:100%; }
        .sidebar-navbtn.active { background:var(--brand-light); color:var(--brand-dark); }
        .sidebar-profile-card { display:flex; align-items:center; gap:10px; padding:10px; border-radius:14px; background:var(--paper-2); margin-top:auto; }
        .badge-card { border:1.5px solid var(--line); border-radius:16px; padding:16px; text-align:center; }
        .badge-card.earned { border-color:var(--amber); background:var(--amber-light); }
        .badge-card.locked { opacity:0.45; }
        .streak-chip { display:inline-flex; align-items:center; gap:5px; background:var(--amber-light); color:#9A6414; padding:5px 12px; border-radius:999px; font-size:12.5px; font-weight:700; }
        .xp-chip { display:inline-flex; align-items:center; gap:5px; background:var(--plum-light); color:var(--plum); padding:5px 12px; border-radius:999px; font-size:12.5px; font-weight:700; }
        .floating-nav { display:none; }
        .avatar-btn { cursor:pointer; border:2px solid transparent; }
        .avatar-btn.picked { border-color:var(--brand); }
        @media (max-width:680px) {
          .app-shell { flex-direction:column; align-items:stretch; min-height:auto; }
          .sidebar { display:none; }
          .app-main-scroll { padding-bottom:86px; }
          .floating-nav {
            display:flex; position:fixed; left:50%; bottom:16px; transform:translateX(-50%);
            background:white; border-radius:999px; box-shadow:0 8px 28px rgba(90,70,190,0.25);
            padding:8px 10px; gap:2px; z-index:50; max-width:94vw; overflow-x:auto;
          }
          .floating-nav .sidebar-navbtn { flex-direction:column; gap:2px; font-size:9.5px; padding:8px 9px; white-space:nowrap; border-radius:14px; }
        }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: (error && error.message) || "Terjadi kesalahan tak terduga." };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("App crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ fontFamily: "sans-serif", padding: 30, textAlign: "center", background: "#F6F5FC", minHeight: "100vh", boxSizing: "border-box" }}>
          <h2 style={{ color: "#1E1B33" }}>Ups, terjadi kesalahan</h2>
          <p style={{ color: "#7A768E", fontSize: 13.5, marginBottom: 6 }}>Halaman mengalami error dan tidak bisa lanjut menampilkan konten.</p>
          <p style={{ color: "#B23", fontSize: 12, marginBottom: 16, fontFamily: "monospace" }}>{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#7C5CFC", color: "white", border: "none", padding: "10px 20px", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
