import React, { useState, useMemo, useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  GraduationCap, LayoutDashboard, BookOpen, PenLine, TrendingUp, User,
  Lightbulb, CheckCircle2, XCircle, AlertTriangle, ArrowRight, ArrowLeft, LogOut, Database, Users,
  Mail, Lock, Loader2, RefreshCw, MessageCircle, Sparkles, ClipboardList, Lock as LockIcon,
  ZoomIn, ZoomOut, Send, Clock, Trophy, Award,
} from "lucide-react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, arrayUnion, serverTimestamp,
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
  E10: { name: "Pertumbuhan & Peluruhan Eksponensial", short: "Nₜ=N₀(1±p)ᵗ", prereq: ["E1", "E2"] },
  E11: { name: "Persamaan Eksponen",            short: "aˣ=aʸ",     prereq: ["E1", "E2", "E3", "E4", "E6", "E7"] },
};
const CONCEPT_ORDER = ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10", "E11"];
const EMPTY_ATTEMPTS = Object.fromEntries(CONCEPT_ORDER.map((c) => [c, []]));
const EMPTY_POOLIDX = Object.fromEntries(CONCEPT_ORDER.map((c) => [c, 0]));

const MATERI = {
  E1: {
    formula: ["a^n = \\underbrace{a \\times a \\times \\cdots \\times a}_{n\\ \\text{faktor}}"],
    penjelasan: "Eksponen (pangkat) adalah cara ringkas menuliskan perkalian berulang suatu bilangan (basis) dengan dirinya sendiri sebanyak $n$ kali (pangkat/eksponen). Kesalahan paling umum: mengira $a^n$ berarti $a \\times n$ (padahal itu perkalian biasa, bukan perpangkatan).",
    contoh: ["2^4 = 2\\times2\\times2\\times2 = 16", "5^3 = 5\\times5\\times5 = 125", "(-3)^2 = (-3)\\times(-3) = 9,\\quad\\text{tapi}\\quad -3^2 = -(3\\times3) = -9"],
  },
  E2: {
    formula: ["a^m \\times a^n = a^{m+n}"],
    penjelasan: "Jika dua bilangan berpangkat memiliki basis yang sama dan dikalikan, pangkatnya cukup dijumlahkan sementara basisnya tetap sama — tidak ikut dikalikan. Sifat ini HANYA berlaku jika basisnya sama; $2^3 \\times 3^2$ tidak bisa disederhanakan dengan cara ini.",
    contoh: ["3^2 \\times 3^3 = 3^{2+3} = 3^5 = 243", "x^4 \\times x = x^4 \\times x^1 = x^5", "2^3 \\times 2^{-1} = 2^{3+(-1)} = 2^2 = 4"],
  },
  E3: {
    formula: ["a^m \\div a^n = a^{m-n} \\quad (a \\neq 0)"],
    penjelasan: "Jika dua bilangan berpangkat dengan basis sama dibagi, pangkatnya dikurangkan (pangkat pembilang dikurangi pangkat penyebut), basis tetap sama. Kalau hasil pengurangan pangkatnya negatif atau nol, itu wajar — nanti mengarah ke konsep eksponen nol dan negatif.",
    contoh: ["5^6 \\div 5^2 = 5^{6-2} = 5^4 = 625", "a^7 \\div a^7 = a^{7-7} = a^0", "2^3 \\div 2^5 = 2^{3-5} = 2^{-2}"],
  },
  E4: {
    formula: ["(a^m)^n = a^{m\\times n}"],
    penjelasan: "Pangkat yang dipangkatkan lagi hasilnya adalah basis yang sama dipangkatkan dengan hasil kali kedua pangkatnya. Berbeda dengan sifat perkalian eksponen ($a^m \\times a^n = a^{m+n}$) — di sini pangkatnya DIKALIKAN, bukan dijumlahkan.",
    contoh: ["(2^3)^2 = 2^{3\\times2} = 2^6 = 64", "(x^2)^5 = x^{10}", "(a^3)^0 = a^0 = 1"],
  },
  E5: {
    formula: ["(a\\times b)^n = a^n\\times b^n", "\\left(\\dfrac{a}{b}\\right)^{\\!n} = \\dfrac{a^n}{b^n}\\quad (b\\neq0)"],
    penjelasan: "Jika perkalian atau pembagian dua bilangan dipangkatkan, pangkat itu bisa dibagikan ke masing-masing bilangan di dalam kurung. Sifat ini TIDAK berlaku untuk penjumlahan/pengurangan — $(a+b)^n \\neq a^n + b^n$.",
    contoh: ["(2\\times3)^2 = 2^2\\times3^2 = 4\\times9 = 36", "\\left(\\dfrac{x}{y}\\right)^{\\!3} = \\dfrac{x^3}{y^3}", "(2+3)^2 = 5^2 = 25,\\quad\\text{TAPI}\\quad 2^2+3^2 = 4+9 = 13\\ (\\text{tidak sama!})"],
  },
  E6: {
    formula: ["a^0 = 1 \\quad (a \\neq 0)"],
    penjelasan: "Bilangan apa pun (kecuali 0) yang dipangkatkan nol hasilnya selalu 1. Bisa dibuktikan dari sifat pembagian: $a^n \\div a^n = a^{n-n} = a^0$, padahal jelas sama dengan 1 (bilangan dibagi dirinya sendiri). Catatan: $0^0$ tidak didefinisikan.",
    contoh: ["7^0 = 1", "100^0 = 1", "(-5)^0 = 1 \\quad (\\text{bukan } 0 \\text{ dan bukan } -5)"],
  },
  E7: {
    formula: ["a^{-n} = \\dfrac{1}{a^n} \\quad (a \\neq 0)"],
    penjelasan: "Pangkat negatif berarti kebalikan (pecahan 1 per basis-pangkat-positifnya) — BUKAN tanda minus di depan hasil akhir. Kesalahan tersering: menganggap $2^{-2} = -4$ (padahal yang benar $2^{-2} = \\tfrac14$).",
    contoh: ["2^{-2} = \\dfrac{1}{2^2} = \\dfrac{1}{4}", "5^{-1} = \\dfrac{1}{5}", "3^{-3} = \\dfrac{1}{3^3} = \\dfrac{1}{27}"],
  },
  E8: {
    formula: ["a^{\\frac{m}{n}} = \\sqrt[n]{a^{m}} \\quad (a > 0)"],
    penjelasan: "Pangkat pecahan menghubungkan eksponen dan bentuk akar: pembilang pecahan ($m$) menjadi pangkat di dalam akar, penyebutnya ($n$) menjadi indeks/tingkat akarnya. Kasus khusus: $a^{1/n} = \\sqrt[n]{a}$.",
    contoh: ["8^{\\frac13} = \\sqrt[3]{8} = 2", "16^{\\frac12} = \\sqrt{16} = 4", "4^{\\frac32} = \\sqrt{4^3} = \\sqrt{64} = 8"],
  },
  E9: {
    formula: ["\\sqrt{a}\\times\\sqrt{b} = \\sqrt{ab}", "a\\sqrt{c} \\pm b\\sqrt{c} = (a\\pm b)\\sqrt{c}"],
    penjelasan: "Bentuk akar bisa dioperasikan seperti aljabar biasa: perkalian akar boleh digabung di bawah satu akar; penjumlahan/pengurangan akar HANYA bisa digabung kalau sejenis (sama bilangan di dalam akarnya); untuk merasionalkan penyebut berbentuk akar, kalikan pembilang & penyebut dengan bentuk sekawannya.",
    contoh: ["\\sqrt{2}\\times\\sqrt{8} = \\sqrt{16} = 4", "3\\sqrt{5} + 2\\sqrt{5} = 5\\sqrt{5}", "\\dfrac{1}{\\sqrt{2}} = \\dfrac{1\\times\\sqrt2}{\\sqrt2\\times\\sqrt2} = \\dfrac{\\sqrt2}{2}"],
  },
  E10: {
    formula: [
      "\\begin{gathered} N_t = N_0(1+p)^{t} \\\\[6pt] \\footnotesize\\text{PERTUMBUHAN — }p>0\\text{ (laju pertambahan, bentuk desimal)} \\end{gathered}",
      "\\begin{gathered} M_t = M_0(1-p)^{t} \\\\[6pt] \\footnotesize\\text{PELURUHAN — }0<p<1\\text{ (laju penyusutan, bentuk desimal)} \\end{gathered}",
    ],
    penjelasan: "Jika suatu besaran bertambah dengan laju TETAP $p$ (desimal, $p>0$) setiap periode/waktu, nilai awal $N_0$ berubah menjadi $N_1=N_0+p\\cdot N_0=N_0(1+p)$ setelah 1 periode. Periode kedua nilai itu dikalikan $(1+p)$ lagi: $N_2=N_1(1+p)=N_0(1+p)^2$. Polanya berulang, sehingga setelah $t$ periode: $N_t=N_0(1+p)^t$. Kalau besarannya BERKURANG dengan laju tetap $p$ ($0<p<1$) setiap periode, logikanya sama tapi mengurangkan: $M_1=M_0-p\\cdot M_0=M_0(1-p)$, sehingga $M_t=M_0(1-p)^t$.",
    contoh: [
      "\\begin{gathered}\\footnotesize\\text{Bakteri awal 500 sel, bertambah }20\\%\\text{ tiap jam}\\\\[6pt] N(t)=500(1{,}2)^t \\to N(3)=500(1{,}2)^3=864\\text{ sel}\\end{gathered}",
      "\\begin{gathered}\\footnotesize\\text{Investasi Rp1.000.000, bertumbuh }8\\%\\text{ per tahun}\\\\[6pt] M(t)=1.000.000(1{,}08)^t \\to M(5)\\approx\\text{Rp1.469.300}\\end{gathered}",
      "\\begin{gathered}\\footnotesize\\text{Zat radioaktif 800 gram, meluruh }50\\%\\text{ tiap periode}\\\\[6pt] M_t=800(1-0{,}5)^t \\to M(3)=800(0{,}5)^3=100\\text{ gram}\\end{gathered}",
      "\\begin{gathered}\\footnotesize\\text{Motor Rp15.000.000, menyusut }15\\%\\text{ per tahun}\\\\[6pt] M(t)=15.000.000(0{,}85)^t \\to M(2)=\\text{Rp10.837.500}\\end{gathered}",
    ],
  },
  E11: {
    formula: [
      "a^{f(x)} = a^{P}",
      "a^{f(x)} = a^{g(x)} (a>0) ⇒ f(x)=g(x)",
      "a^{h(x)} = b^{h(x)} (a,b>0, a\\ne b) ⇒ h(x)=0",
      "P(a^x)^2 + Qa^x + R = 0 ⇒ u=a^x ⇒ Pu^2+Qu+R=0",
    ],
    penjelasan: "Bentuk paling dasar: kalau basis kedua ruas sudah sama dan pangkat di ruas kanan sudah berupa bilangan konstan $P$ (bukan fungsi), maka pangkat di ruas kiri langsung disamakan dengan konstanta itu: $f(x)=P$. Ini kasus khusus dari aturan umum — kalau basis kedua ruas SUDAH sama (atau bisa disamakan dengan sifat eksponen), langsung samakan pangkatnya: $f(x)=g(x)$. Kalau basisnya berbeda tapi pangkatnya sudah sama persis di kedua ruas, satu-satunya cara persamaan itu benar adalah pangkatnya $=0$ (karena $a^0=b^0=1$). Untuk bentuk yang menyerupai persamaan kuadrat (ada $a^{2x}$ dan $a^x$ dalam satu persamaan), misalkan $u=a^x$ dulu supaya jadi $Pu^2+Qu+R=0$, selesaikan $u$ dengan pemfaktoran/rumus ABC, baru kembalikan $a^x=u$ untuk mencari $x$ (nilai $u$ harus positif karena $a^x>0$).",
    contoh: [
      "3^{5x-9}=3^{2x+3} ⇒ 5x-9=2x+3 ⇒ 3x=12 ⇒ x=4",
      "8^{x+2}=32^{x-1} ⇒ (2^3)^{x+2}=(2^5)^{x-1} ⇒ 3x+6=5x-5 ⇒ x=\\frac{11}{2}",
      "4^x-5\\cdot2^x+4=0 ⇒ u=2^x ⇒ u^2-5u+4=0 ⇒ (u-1)(u-4)=0 ⇒ u=1\\text{ atau }u=4 ⇒ x=0\\text{ atau }x=2",
    ],
  }
};
const HINTS = {
  E1: { t1: "Ingat: $a^n$ berarti $a$ dikalikan dengan dirinya sendiri sebanyak $n$ kali — bukan $a \\times n$.", t2: "Tulis dulu perkaliannya secara lengkap sebelum dihitung, misalnya $2^4 = 2\\times2\\times2\\times2$, baru kalikan satu per satu.", full: "$2^4$ artinya 2 dikalikan sebanyak 4 kali: $2\\times2\\times2\\times2=16$. Hati-hati juga dengan tanda kurung: $(-2)^2=4$, tapi $-2^2=-4$." },
  E2: { t1: "Basis harus sama dulu baru pangkatnya bisa dijumlahkan — basisnya sendiri TIDAK ikut dikalikan atau berubah.", t2: "Contoh: $2^3\\times2^2 = 2^{3+2} = 2^5$ (bukan $4^5$, dan bukan $2^6$).", full: "$a^m\\times a^n = a^{m+n}$. Basis ($a$) tetap sama, hanya pangkatnya ($m$ dan $n$) yang dijumlahkan." },
  E3: { t1: "Basis harus sama dulu baru pangkatnya bisa dikurangkan — pangkat pembilang dikurangi pangkat penyebut.", t2: "Contoh: $5^4 \\div 5^2 = 5^{4-2} = 5^2$.", full: "$a^m \\div a^n = a^{m-n}$. Kalau hasil pengurangan pangkatnya negatif, itu wajar — hasilnya akan berbentuk pecahan (pangkat negatif)." },
  E4: { t1: "Pangkat berpangkat berarti kedua pangkatnya DIKALIKAN, bukan dijumlahkan seperti pada perkalian eksponen biasa.", t2: "Contoh: $(3^2)^3 = 3^{2\\times3} = 3^6$ (bukan $3^5$).", full: "$(a^m)^n = a^{m\\times n}$. Jangan tertukar dengan $a^m\\times a^n=a^{m+n}$ — perhatikan apakah ada tanda kurung pangkat berpangkat atau tanda kali antar dua bilangan berpangkat." },
  E5: { t1: "Sifat ini hanya berlaku untuk PERKALIAN atau PEMBAGIAN di dalam kurung, tidak berlaku untuk penjumlahan/pengurangan.", t2: "Contoh: $(2\\times3)^2 = 2^2\\times3^2 = 36$, tapi $(2+3)^2 = 5^2 = 25$ (bukan $2^2+3^2=13$).", full: "$(a\\times b)^n=a^n\\times b^n$ dan $(a\\div b)^n=a^n\\div b^n$. Pangkat di luar kurung dibagikan ke setiap faktor di dalamnya — tapi tidak berlaku kalau di dalam kurung ada tanda tambah/kurang." },
  E6: { t1: "Ingat: $a^0=1$ berlaku untuk semua $a\\neq0$ — hasilnya bukan 0, dan bukan $a$ itu sendiri.", t2: "Contoh: $9^0=1$, sama seperti $250^0=1$ — berapa pun basisnya (asal bukan 0), hasilnya tetap 1.", full: "Ini bisa dibuktikan lewat sifat pembagian: $a^n\\div a^n = a^{n-n}=a^0$, padahal $a^n\\div a^n$ pasti $=1$. Jadi $a^0=1$." },
  E7: { t1: "Pangkat negatif berarti KEBALIKAN (1 per basis-pangkat-positifnya) — bukan tanda minus di depan hasil.", t2: "Contoh: $4^{-1} = \\dfrac{1}{4^1} = \\dfrac14$ (bukan $-4$).", full: "$a^{-n}=\\dfrac{1}{a^n}$. Jadi $3^{-2}=\\dfrac{1}{3^2}=\\dfrac19$ — bukan $-9$ dan bukan $-\\dfrac19$." },
  E8: { t1: "Ingat: pangkat pecahan berarti bentuk akar — $a^{m/n}$ = akar pangkat $n$ dari $a^m$, bukan $a$ dibagi $n$.", t2: "Contoh: $27^{1/3}$ = akar pangkat 3 dari 27 = 3 (bukan $27/3=9$).", full: "$a^{m/n}=\\sqrt[n]{a^m}$. Pembilang pangkat ($m$) masuk ke dalam akar, penyebut pangkat ($n$) jadi indeks/tingkat akarnya." },
  E9: { t1: "Penjumlahan/pengurangan bentuk akar hanya bisa digabung kalau bilangan di dalam akarnya SAMA (sejenis).", t2: "Contoh: $2\\sqrt3+5\\sqrt3=7\\sqrt3$ (sejenis, boleh), tapi $2\\sqrt3+5\\sqrt2$ tidak bisa disederhanakan (tidak sejenis).", full: "Untuk perkalian, $\\sqrt a\\times\\sqrt b=\\sqrt{ab}$ selalu boleh digabung. Untuk merasionalkan penyebut berbentuk akar, kalikan pembilang & penyebut dengan bentuk yang sama supaya akar di penyebut hilang." },
  E10: { t1: "Cari dulu nilai $p$ (laju perubahan dalam desimal, misalnya 20% = 0,2), lalu tentukan apakah besarannya BERTAMBAH (pakai $1+p$) atau BERKURANG (pakai $1-p$).", t2: "Rumusnya berasal dari perkalian berulang: tiap periode nilainya dikalikan $(1+p)$ atau $(1-p)$ lagi, sehingga setelah $t$ periode faktor itu dipangkatkan $t$.", full: "Pertumbuhan: $N_t=N_0(1+p)^t$. Peluruhan: $M_t=M_0(1-p)^t$. $N_0$/$M_0$ = nilai awal (saat $t=0$), $p$ = persentase perubahan dalam bentuk desimal, $t$ = banyak periode." },
  E11: { t1: "Kalau basis kedua ruas sudah sama (atau bisa disamakan), langsung samakan pangkatnya: $f(x)=g(x)$.", t2: "Kalau ada $a^{2x}$ DAN $a^x$ dalam satu persamaan, itu tandanya bentuk kuadrat tersamar — misalkan $u=a^x$ dulu, selesaikan $u$, baru cari $x$.", full: "Basis sama → samakan pangkat: $a^{f(x)}=a^{g(x)}\\Rightarrow f(x)=g(x)$. Basis beda tapi pangkat sama di kedua ruas → pangkatnya harus 0. Bentuk kuadrat tersamar → substitusi $u=a^x$, selesaikan $Pu^2+Qu+R=0$, lalu kembalikan ke $a^x=u$ (ingat $u$ harus $>0$)." },
};
const PRACTICE_POOL = {
  E1: [
    { text: "$2^3 = ?$", options: [{ text: "6", tag: "Mengira pangkat = basis dikali pangkat (2×3)" }, { text: "5", tag: "Mengira pangkat = basis ditambah pangkat (2+3)" }, { text: "8", correct: true }, { text: "9", tag: "Menghitung 3² alih-alih 2³" }, { text: "12", tag: "Salah hitung perkalian berulang" }] },
    { text: "$5^2 = ?$", options: [{ text: "10", tag: "Mengira pangkat = basis dikali pangkat (5×2)" }, { text: "25", correct: true }, { text: "7", tag: "Mengira pangkat = basis ditambah pangkat (5+2)" }, { text: "15", tag: "Salah hitung, menganggap 5×3" }, { text: "20", tag: "Salah hitung perkalian berulang" }] },
    { text: "$(-2)^3 = ?$", options: [{ text: "8", tag: "Mengira pangkat ganjil dari bilangan negatif hasilnya tetap positif" }, { text: "-6", tag: "Mengira pangkat = basis dikali pangkat (-2×3)" }, { text: "6", tag: "Salah tanda dan salah hitung" }, { text: "-8", correct: true }, { text: "-2", tag: "Lupa mengalikan berulang, hanya menulis basisnya" }] },
    { text: "$(-4)^2 = ?$", options: [{ text: "-16", tag: "Lupa bahwa pangkat genap dari bilangan negatif hasilnya positif" }, { text: "-8", tag: "Mengira pangkat = basis dikali pangkat (-4×2)" }, { text: "8", tag: "Salah hitung, hanya setengah dari hasil sebenarnya" }, { text: "32", tag: "Salah hitung perkalian berulang" }, { text: "16", correct: true }] },
    { text: "$-3^2 = ?$ (tanpa tanda kurung di depan angka 3)", options: [{ text: "-9", correct: true }, { text: "9", tag: "Keliru menganggap tanda minus ikut dipangkatkan padahal tidak ada kurung" }, { text: "-6", tag: "Mengira pangkat = basis dikali pangkat (-3×2)" }, { text: "6", tag: "Salah tanda dan salah hitung" }, { text: "3", tag: "Hanya menuliskan basisnya" }] },
    { text: "$(0{,}5)^3 = ?$", options: [{ text: "1,5", tag: "Mengira pangkat = basis dikali pangkat (0,5×3)" }, { text: "0,125", correct: true }, { text: "0,5", tag: "Mengira pangkat 3 tidak mengubah nilai pecahan" }, { text: "1", tag: "Salah hitung, pembulatan keliru" }, { text: "0,15", tag: "Salah hitung perkalian berulang bilangan desimal" }] },
    { text: "Volume kubus dengan panjang rusuk 5 cm adalah $s^3$. Berapa volumenya?", options: [{ text: "15 cm³", tag: "Mengira pangkat 3 berarti dikali 3" }, { text: "25 cm³", tag: "Hanya menghitung s² (luas alas), lupa dikali satu s lagi" }, { text: "125 cm³", correct: true }, { text: "10 cm³", tag: "Mengira pangkat = basis ditambah basis" }, { text: "75 cm³", tag: "Salah hitung perkalian berulang" }] },
    { text: "$(2/3)^2 = ?$", options: [{ text: "4/3", tag: "Hanya memangkatkan pembilang, penyebut tidak ikut dipangkatkan" }, { text: "2/9", tag: "Hanya memangkatkan penyebut, pembilang tidak ikut dipangkatkan" }, { text: "2/3", tag: "Mengira pangkat 2 tidak mengubah nilai pecahan" }, { text: "4/9", correct: true }, { text: "6/9", tag: "Salah hitung, menjumlahkan alih-alih memangkatkan" }] },
    { text: "$(-1)^7 = ?$", options: [{ text: "1", tag: "Lupa bahwa pangkat ganjil dari bilangan negatif tetap negatif" }, { text: "7", tag: "Mengira pangkat = basis dikali pangkat" }, { text: "-7", tag: "Mengira pangkat = basis dikali pangkat, tanda dipertahankan" }, { text: "0", tag: "Mengira bilangan negatif berpangkat menjadi nol" }, { text: "-1", correct: true }] },
    { text: "Jika $s^3 = 343$, panjang rusuk kubus $s = ?$", options: [{ text: "114,3 cm", tag: "Mengira akar pangkat 3 sama dengan dibagi 3" }, { text: "7 cm", correct: true }, { text: "49 cm", tag: "Menghitung akar pangkat 2, bukan akar pangkat 3" }, { text: "171,5 cm", tag: "Mengira akar pangkat 3 sama dengan dibagi 2" }, { text: "343 cm", tag: "Tidak memahami operasi kebalikan dari pemangkatan" }] },
  ],
  E2: [
    { text: "$2^2 \\times 2^3 = ?$", options: [{ text: "$2^6 = 64$", tag: "Mengira pangkat harus dikalikan (2×3), bukan dijumlahkan" }, { text: "$4^5 = 1024$", tag: "Ikut mengalikan basisnya padahal basis tetap sama" }, { text: "$2^5 = 32$", correct: true }, { text: "$2^1 = 2$", tag: "Mengurangkan pangkat alih-alih menjumlahkan" }, { text: "$4^6$", tag: "Basis dan pangkat sama-sama diubah, salah total" }] },
    { text: "$3^2 \\times 3^3 = ?$", options: [{ text: "$3^5 = 243$", correct: true }, { text: "$3^6 = 729$", tag: "Mengira pangkat harus dikalikan (2×3), bukan dijumlahkan" }, { text: "$9^5$", tag: "Ikut mengalikan basisnya padahal basis tetap sama" }, { text: "$3^1 = 3$", tag: "Mengurangkan pangkat alih-alih menjumlahkan" }, { text: "$6^5$", tag: "Menjumlahkan basis, bukan mempertahankannya" }] },
    { text: "$x^4 \\times x^3 \\times x = ?$", options: [{ text: "$x^{12}$", tag: "Mengira pangkat harus dikalikan semua (4×3×1)" }, { text: "$x^7$", tag: "Lupa menghitung x tunggal sebagai x pangkat 1" }, { text: "$3x^8$", tag: "Menambahkan koefisien yang tidak seharusnya ada" }, { text: "$x^8$", correct: true }, { text: "$x^{34}$", tag: "Menggabungkan angka-angka pangkat menjadi satu bilangan, bukan menjumlahkannya" }] },
    { text: "$2^3 \\times 2^{-1} = ?$", options: [{ text: "$2^4 = 16$", tag: "Salah menjumlahkan pangkat negatif, menganggap -1 jadi +1" }, { text: "$2^2 = 4$", correct: true }, { text: "$2^{-3} = 1/8$", tag: "Salah tanda saat menjumlahkan pangkat" }, { text: "$2^{-4}$", tag: "Mengurangkan pangkat alih-alih menjumlahkan" }, { text: "$4^2=16$", tag: "Basis ikut berubah padahal seharusnya tetap" }] },
    { text: "$5^2 \\times 5^3 \\times 5^{-2} = ?$", options: [{ text: "$5^7 = 78125$", tag: "Salah menjumlahkan, tidak memperhitungkan pangkat negatif dengan benar" }, { text: "$5^{-1} = 1/5$", tag: "Salah hitung penjumlahan pangkat" }, { text: "$5^{-3}$", tag: "Salah tanda saat menjumlahkan pangkat negatif" }, { text: "$25^3$", tag: "Basis ikut dikalikan, padahal seharusnya tetap" }, { text: "$5^3 = 125$", correct: true }] },
    { text: "$a^{-3} \\times a^5 \\times a^{-1} = ?$", options: [{ text: "$a$", correct: true }, { text: "$a^{9}$", tag: "Menjumlahkan seolah semua pangkat positif, mengabaikan tanda negatif" }, { text: "$a^{-9}$", tag: "Salah tanda total saat menjumlahkan" }, { text: "$a^{7}$", tag: "Salah menjumlahkan pangkat, kurang teliti pada tanda" }, { text: "$a^{-1}$", tag: "Kurang satu suku saat menjumlahkan pangkat" }] },
    { text: "$2x^3 \\times 3x^4 = ?$", options: [{ text: "$5x^7$", tag: "Menjumlahkan koefisien, padahal seharusnya dikalikan" }, { text: "$6x^{12}$", tag: "Mengalikan pangkat, bukan menjumlahkan" }, { text: "$6x^7$", correct: true }, { text: "$5x^{12}$", tag: "Salah pada koefisien maupun pangkat" }, { text: "$6x^3$", tag: "Lupa menjumlahkan salah satu pangkat" }] },
    { text: "$4^2 \\times 4^{-5} \\times 4^3 = ?$", options: [{ text: "0", tag: "Mengira $a^0$ hasilnya 0, bukan 1" }, { text: "4", tag: "Mengira pangkat nol tidak mengubah basis, ditulis basisnya langsung" }, { text: "$4^{10}$", tag: "Menjumlahkan semua pangkat sebagai bilangan positif, mengabaikan tanda negatif" }, { text: "1", correct: true }, { text: "$4^{-10}$", tag: "Salah tanda total saat menjumlahkan pangkat" }] },
    { text: "Bentuk sederhana dari $2^5 \\times 2^3 \\times 2^{-4}$ adalah...?", options: [{ text: "$2^{12}=4096$", tag: "Mengalikan seluruh pangkat, bukan menjumlah dan mengurangkan" }, { text: "$2^4 = 16$", correct: true }, { text: "$2^2 = 4$", tag: "Salah hitung penjumlahan/pengurangan pangkat" }, { text: "$2^{-4}$", tag: "Salah tanda hasil akhir" }, { text: "$2^{8}=256$", tag: "Mengabaikan pangkat negatif dalam perhitungan" }] },
    { text: "$3x^2y^3 \\times 2x^4y^{-1} = ?$", options: [{ text: "$5x^6y^2$", tag: "Menjumlahkan koefisien, padahal seharusnya dikalikan" }, { text: "$6x^8y^3$", tag: "Mengalikan pangkat x, bukan menjumlahkan" }, { text: "$6x^6y^{-2}$", tag: "Salah tanda saat menjumlahkan pangkat y" }, { text: "$6x^6y^4$", tag: "Salah menjumlahkan pangkat y, mengabaikan tanda negatif" }, { text: "$6x^6y^2$", correct: true }] },
  ],
  E3: [
    { text: "$7^6 \\div 7^2 = ?$", options: [{ text: "$7^3$", tag: "Salah hitung pengurangan pangkat (6-2 dihitung keliru)" }, { text: "$1^4$", tag: "Basisnya ikut dibagi/hilang, padahal basis tetap sama" }, { text: "$7^4$", correct: true }, { text: "$7^8$", tag: "Menjumlahkan pangkat, bukan mengurangkan" }, { text: "$7^{12}$", tag: "Mengalikan pangkat, bukan mengurangkan" }] },
    { text: "$x^5 \\div x^8 = ?$", options: [{ text: "$x^{-3}$", correct: true }, { text: "$x^3$", tag: "Lupa memperhatikan urutan pengurangan (5-8, bukan 8-5)" }, { text: "$x^{-13}$", tag: "Menjumlahkan pangkat, bukan mengurangkan" }, { text: "$x^{13}$", tag: "Salah total, menjumlahkan lalu salah tanda" }, { text: "$x^{40}$", tag: "Mengalikan pangkat, bukan mengurangkan" }] },
    { text: "$(4^5 \\times 4^2) \\div 4^3 = ?$", options: [{ text: "$4^{10}$", tag: "Salah urutan operasi, langsung mengalikan semua pangkat" }, { text: "$4^4$", correct: true }, { text: "$4^{-4}$", tag: "Salah tanda saat mengurangkan pangkat total" }, { text: "$4^{7}$", tag: "Lupa mengurangkan pangkat penyebut" }, { text: "$4^{0}=1$", tag: "Salah hitung total pangkat" }] },
    { text: "$10^3 \\div 10^7 = ?$", options: [{ text: "$10^4$", tag: "Lupa memperhatikan urutan pengurangan (3-7, bukan 7-3)" }, { text: "$10^{10}$", tag: "Menjumlahkan pangkat, bukan mengurangkan" }, { text: "$10^{21}$", tag: "Mengalikan pangkat, bukan mengurangkan" }, { text: "$10^{-4}$", correct: true }, { text: "$1^{-4}$", tag: "Basisnya ikut hilang/berubah, padahal seharusnya tetap" }] },
    { text: "$\\dfrac{y^6}{y^2 \\times y}= ?$", options: [{ text: "$y^9$", tag: "Menjumlahkan semua pangkat alih-alih mengurangkan" }, { text: "$y^4$", tag: "Salah hitung, lupa mengurangkan salah satu pangkat penyebut" }, { text: "$y^{12}$", tag: "Mengalikan pangkat penyebut, bukan menjumlahkan lalu mengurangkan" }, { text: "$y^{-3}$", tag: "Salah tanda hasil akhir" }, { text: "$y^3$", correct: true }] },
    { text: "$\\dfrac{12x^7}{4x^3} = ?$", options: [{ text: "$3x^4$", correct: true }, { text: "$8x^4$", tag: "Mengurangkan koefisien, padahal seharusnya dibagi" }, { text: "$3x^{2{,}33}$", tag: "Salah membagi pangkat alih-alih mengurangkan" }, { text: "$3x^{10}$", tag: "Menjumlahkan pangkat, bukan mengurangkan" }, { text: "$48x^{10}$", tag: "Mengalikan koefisien dan pangkat, seharusnya dibagi dan dikurangkan" }] },
    { text: "$\\dfrac{2^{-3}}{2^{2}} = ?$", options: [{ text: "$2^{-1}$", tag: "Salah tanda saat mengurangkan pangkat" }, { text: "$2^{1}$", tag: "Mengabaikan tanda negatif pada pembilang" }, { text: "$2^{-5}$", correct: true }, { text: "$2^{5}$", tag: "Salah tanda hasil akhir" }, { text: "$2^{-6}$", tag: "Salah hitung pengurangan pangkat" }] },
    { text: "$\\dfrac{a^3b^5}{a^6b^2}= ?$", options: [{ text: "$a^3b^3$", tag: "Salah tanda pada pangkat a, mengabaikan bahwa pembagi lebih besar" }, { text: "$a^{-3}b^3$", correct: true }, { text: "$a^{-3}b^{-3}$", tag: "Salah tanda pada pangkat b juga" }, { text: "$a^{9}b^{7}$", tag: "Menjumlahkan pangkat, bukan mengurangkan" }, { text: "$a^{3}b^{-3}$", tag: "Salah tanda pada pangkat a maupun b, tertukar" }] },
    { text: "$\\dfrac{5^8 \\div 5^3}{5^2} = ?$", options: [{ text: "$5^9$", tag: "Menjumlahkan seluruh pangkat, bukan mengurangkan" }, { text: "$5^{13}$", tag: "Salah total, menjumlahkan alih-alih mengurangkan berurutan" }, { text: "$5^{7}$", tag: "Lupa mengurangkan salah satu pangkat penyebut" }, { text: "$5^3$", correct: true }, { text: "$5^{-3}$", tag: "Salah tanda hasil akhir" }] },
    { text: "Populasi bakteri berkurang menjadi $\\dfrac{3^{10}}{3^{6}}$ kali populasi awal. Bentuk sederhananya adalah...?", options: [{ text: "$3^{16}$", tag: "Menjumlahkan pangkat, bukan mengurangkan" }, { text: "$3^{-4}$", tag: "Salah tanda hasil pengurangan pangkat" }, { text: "$3^{1{,}67}$", tag: "Salah membagi pangkat alih-alih mengurangkan" }, { text: "$3^{60}$", tag: "Mengalikan pangkat, bukan mengurangkan" }, { text: "$3^4 = 81$", correct: true }] },
  ],
  E4: [
    { text: "$(2^3)^2 = ?$", options: [{ text: "$2^5 = 32$", tag: "Mengira pangkat berpangkat dijumlahkan (3+2), bukan dikalikan" }, { text: "$2^9 = 512$", tag: "Salah kalikan pangkat, hasil dikalikan basisnya juga" }, { text: "$2^6 = 64$", correct: true }, { text: "$4^6$", tag: "Basis ikut berubah, padahal seharusnya tetap" }, { text: "$2^{9}=512$ (dari $3^2$)", tag: "Salah urutan operasi pangkat berpangkat" }] },
    { text: "$(x^4)^3 = ?$", options: [{ text: "$x^{12}$", correct: true }, { text: "$x^7$", tag: "Menjumlahkan pangkat seperti sifat perkalian eksponen" }, { text: "$x^{64}$", tag: "Salah hitung, memangkatkan pangkat bukan mengalikan" }, { text: "$x^{81}$", tag: "Menghitung $4^3$ dan menerapkannya sebagai pangkat baru" }, { text: "$3x^4$", tag: "Menambahkan koefisien yang tidak seharusnya ada" }] },
    { text: "$((3^2)^2)^2 = ?$", options: [{ text: "$3^6 = 729$", tag: "Salah mengalikan ketiga pangkat berturut-turut" }, { text: "$3^4 = 81$", tag: "Hanya menghitung satu tingkat pangkat, mengabaikan tingkat lainnya" }, { text: "$3^{10}$", tag: "Menjumlahkan pangkat-pangkat, bukan mengalikan" }, { text: "$3^{12}$", tag: "Salah kalikan, menghitung 2×2×3 alih-alih 2×2×2" }, { text: "$3^8 = 6561$", correct: true }] },
    { text: "$(a^2b^3)^2 = ?$", options: [{ text: "$a^4b^5$", tag: "Hanya memangkatkan salah satu variabel dengan benar" }, { text: "$a^4b^6$", correct: true }, { text: "$a^2b^3 \\times 2$", tag: "Mengalikan pangkat luar seperti perkalian biasa, bukan diterapkan ke tiap variabel" }, { text: "$a^6b^9$", tag: "Salah kalikan pangkat, hasil dikali 3 bukan 2" }, { text: "$a^8b^9$", tag: "Salah kalikan pangkat pada masing-masing variabel" }] },
    { text: "$(5^{-2})^3 = ?$", options: [{ text: "$5^{-5}$", tag: "Menjumlahkan pangkat, bukan mengalikan" }, { text: "$5^{6}$", tag: "Mengabaikan tanda negatif pada pangkat" }, { text: "$5^{-1}$", tag: "Salah hitung hasil perkalian pangkat" }, { text: "$5^{-6}$", correct: true }, { text: "$5^{1}$", tag: "Salah tanda dan salah hitung sekaligus" }] },
    { text: "$(2x^3)^4 = ?$", options: [{ text: "$2x^{12}$", tag: "Lupa memangkatkan koefisien angka di depan" }, { text: "$8x^{12}$", tag: "Salah menghitung koefisien: $2^4$ dihitung sebagai $2\\times4$" }, { text: "$16x^{12}$", correct: true }, { text: "$16x^7$", tag: "Menjumlahkan pangkat, bukan mengalikan" }, { text: "$8x^7$", tag: "Salah pada koefisien maupun pangkat" }] },
    { text: "$((-2)^3)^2 = ?$", options: [{ text: "64", correct: true }, { text: "-64", tag: "Lupa bahwa hasil akhir dipangkatkan genap sehingga menjadi positif" }, { text: "-36", tag: "Salah menghitung kombinasi tanda dan nilai" }, { text: "36", tag: "Salah kalikan pangkat, lalu salah hitung basis" }, { text: "-8", tag: "Hanya menghitung tingkat pangkat pertama, lupa memangkatkan lagi" }] },
    { text: "$\\dfrac{(a^3)^4}{a^5} = ?$", options: [{ text: "$a^{12}$", tag: "Lupa membagi dengan penyebut, hanya menghitung pembilang" }, { text: "$a^{17}$", tag: "Menjumlahkan pangkat pembilang dan penyebut, bukan mengurangkan" }, { text: "$a^{2{,}4}$", tag: "Salah membagi pangkat alih-alih mengurangkan setelah dikalikan" }, { text: "$a^{-2}$", tag: "Salah kalikan pangkat pembilang sebelum dikurangkan" }, { text: "$a^7$", correct: true }] },
    { text: "$(2^2)^3 \\times (2^3)^2 = ?$", options: [{ text: "$2^{10}$", tag: "Salah menghitung salah satu suku sebelum dijumlahkan" }, { text: "$2^{12}$", correct: true }, { text: "$2^{72}$", tag: "Mengalikan seluruh pangkat, bukan menjumlahkan hasil akhir" }, { text: "$2^{5}$", tag: "Hanya menjumlahkan pangkat luar (3+2), mengabaikan pangkat dalam" }, { text: "$4^{12}$", tag: "Basis ikut berubah, padahal seharusnya tetap 2" }] },
    { text: "Luas permukaan kubus dengan rusuk $x^2$ dihitung dengan $6(x^2)^2$. Bentuk sederhananya adalah...?", options: [{ text: "$6x^2$", tag: "Lupa memangkatkan $x^2$ dengan pangkat luar" }, { text: "$12x^4$", tag: "Ikut mengalikan koefisien 6 dengan pangkat luar, padahal seharusnya tidak" }, { text: "$6x^{16}$", tag: "Salah menghitung pangkat, menganggap $2^2=16$ bukan 4" }, { text: "$6x^4$", correct: true }, { text: "$36x^4$", tag: "Ikut memangkatkan koefisien 6, padahal koefisien tidak berada di dalam kurung pangkat" }] },
  ],
  E5: [
    { text: "$(2 \\times 5)^3 = ?$", options: [{ text: "$2 \\times 5^3 = 250$", tag: "Hanya memangkatkan salah satu faktor, bukan keduanya" }, { text: "$2^3 \\times 5 = 40$", tag: "Hanya memangkatkan salah satu faktor" }, { text: "$2^3 \\times 5^3 = 1000$", correct: true }, { text: "$2^3 + 5^3 = 133$", tag: "Menjumlahkan hasil pemangkatan, bukan mengalikan" }, { text: "$10^3 \\div 3$", tag: "Salah total dalam menerapkan sifat distribusi" }] },
    { text: "$(x/y)^4 = ?$", options: [{ text: "$x^4/y^4$", correct: true }, { text: "$x^4/y$", tag: "Hanya memangkatkan pembilang, penyebut tidak ikut dipangkatkan" }, { text: "$x/y^4$", tag: "Hanya memangkatkan penyebut, pembilang tidak ikut dipangkatkan" }, { text: "$4x/4y$", tag: "Mengalikan pangkat dengan pembilang dan penyebut, bukan memangkatkannya" }, { text: "$x^4 \\times y^4$", tag: "Mengubah tanda bagi menjadi kali" }] },
    { text: "$(3 + 4)^2$ sama dengan...?", options: [{ text: "$3^2 + 4^2 = 25$", tag: "Keliru menerapkan sifat distribusi pangkat pada penjumlahan (tidak berlaku)" }, { text: "49 (bukan $3^2+4^2$)", correct: true }, { text: "$3^2 \\times 4^2 = 144$", tag: "Keliru mengira penjumlahan berubah jadi perkalian" }, { text: "$3+4^2=19$", tag: "Hanya memangkatkan salah satu suku" }, { text: "$3^2+4=13$", tag: "Hanya memangkatkan salah satu suku" }] },
    { text: "$(2a)^3 = ?$", options: [{ text: "$2a^3$", tag: "Lupa memangkatkan koefisien 2" }, { text: "$6a^3$", tag: "Salah menghitung koefisien: $2^3$ dihitung sebagai $2\\times3$" }, { text: "$8a$", tag: "Lupa memangkatkan variabelnya, hanya koefisien yang dipangkatkan" }, { text: "$8a^3$", correct: true }, { text: "$6a$", tag: "Salah pada koefisien maupun variabel" }] },
    { text: "$(3x/2y)^2 = ?$", options: [{ text: "$3x^2/2y^2$", tag: "Lupa memangkatkan koefisien pembilang" }, { text: "$9x/4y$", tag: "Lupa memangkatkan variabelnya, hanya koefisien yang dipangkatkan" }, { text: "$6x^2/4y^2$", tag: "Salah menghitung koefisien pembilang: dikali bukan dipangkatkan" }, { text: "$9x^2/2y^2$", tag: "Lupa memangkatkan koefisien penyebut" }, { text: "$9x^2/4y^2$", correct: true }] },
    { text: "$(2xy)^3 = ?$", options: [{ text: "$2x^3y^3$", tag: "Lupa memangkatkan koefisien 2" }, { text: "$6xy^3$", tag: "Hanya memangkatkan salah satu variabel dan salah menghitung koefisien" }, { text: "$8x^3y^3$", correct: true }, { text: "$8xy$", tag: "Lupa memangkatkan variabelnya" }, { text: "$6x^3y^3$", tag: "Salah menghitung koefisien: $2^3$ dianggap $2\\times3$" }] },
    { text: "$(a/b)^{-2} = ?$", options: [{ text: "$a^2/b^2$", tag: "Mengabaikan tanda negatif pada pangkat" }, { text: "$b^2/a^2$", correct: true }, { text: "$-a^2/b^2$", tag: "Mengira pangkat negatif membuat hasil menjadi negatif" }, { text: "$a^{-2}/b^{-2}$", tag: "Tidak menyelesaikan pangkat negatifnya, hanya menerapkan distribusi" }, { text: "$-b^2/a^2$", tag: "Salah tanda meski sudah membalik pecahan" }] },
    { text: "$(2x^2)^3 \\times (3x)^2 = ?$", options: [{ text: "$72x^8$", correct: true }, { text: "$72x^7$", tag: "Salah menjumlahkan pangkat x setelah kedua suku disederhanakan" }, { text: "$36x^8$", tag: "Salah menghitung koefisien, seharusnya dikalikan bukan dijumlahkan" }, { text: "$36x^8$ (dari $6x^6 \\times 6x^2$)", tag: "Salah menghitung koefisien pada masing-masing suku" }, { text: "$8x^6+9x^2$", tag: "Menjumlahkan kedua suku, padahal seharusnya dikalikan" }] },
    { text: "Sebuah persegi dengan sisi $3p$ cm memiliki luas $(3p)^2$. Bentuk sederhana luasnya adalah...?", options: [{ text: "$3p^2$", tag: "Lupa memangkatkan koefisien 3" }, { text: "$6p^2$", tag: "Salah menghitung koefisien: $3^2$ dianggap $3\\times2$" }, { text: "$9p$", tag: "Lupa memangkatkan variabelnya" }, { text: "$9p^2$", correct: true }, { text: "$3p$", tag: "Tidak menerapkan pemangkatan sama sekali" }] },
    { text: "$\\left(\\dfrac{2a^2}{b}\\right)^{-3} = ?$", options: [{ text: "$8a^6/b^3$", tag: "Mengabaikan tanda negatif pada pangkat" }, { text: "$b^3/2a^6$", tag: "Lupa memangkatkan koefisien 2 pada pembilang asal" }, { text: "$b^3/8a^6$", correct: true }, { text: "$-b^3/8a^6$", tag: "Mengira pangkat negatif membuat hasil menjadi negatif" }, { text: "$8a^{-6}/b^{-3}$", tag: "Tidak menyelesaikan pangkat negatif, hanya membalik posisi" }] },
  ],
  E6: [
    { text: "$15^0 = ?$", options: [{ text: "1", correct: true }, { text: "0", tag: "Mengira pangkat nol membuat bilangan menjadi nol" }, { text: "15", tag: "Mengira pangkat nol tidak mengubah apa-apa pada basis" }, { text: "-1", tag: "Mengira hasil pangkat nol bisa negatif" }, { text: "150", tag: "Salah menafsirkan pangkat nol sebagai penambahan nol di belakang" }] },
    { text: "$(-8)^0 = ?$", options: [{ text: "-1", tag: "Mengira tanda negatif basis ikut memengaruhi hasil pangkat nol" }, { text: "0", tag: "Mengira pangkat nol membuat bilangan menjadi nol" }, { text: "-8", tag: "Mengira pangkat nol tidak mengubah apa-apa pada basis" }, { text: "8", tag: "Mengira tanda negatif hilang tapi angkanya tetap sama" }, { text: "1", correct: true }] },
    { text: "$5x^0 = ?$ (untuk $x \\neq 0$)", options: [{ text: "0", tag: "Mengira $x^0$ membuat seluruh suku menjadi nol" }, { text: "5", correct: true }, { text: "5x", tag: "Mengabaikan bahwa $x^0=1$, bukan $x$" }, { text: "1", tag: "Mengabaikan koefisien 5 di depan, hanya menghitung $x^0$" }, { text: "$0^5$", tag: "Menukar posisi basis dan pangkat" }] },
    { text: "$(3x^2y)^0 = ?$ (untuk $x,y \\neq 0$)", options: [{ text: "0", tag: "Mengira pangkat nol membuat seluruh bentuk menjadi nol" }, { text: "$3x^2y$", tag: "Mengira pangkat nol tidak mengubah apa-apa pada bentuk aljabar" }, { text: "1", correct: true }, { text: "3", tag: "Mengira hanya variabel yang menjadi 1, koefisien tetap" }, { text: "$x^2y$", tag: "Mengira hanya koefisien yang hilang" }] },
    { text: "$7^0 + 3^0 = ?$", options: [{ text: "0", tag: "Mengira setiap suku berpangkat nol hasilnya nol" }, { text: "10", tag: "Menjumlahkan basisnya (7+3), mengabaikan pangkat nol" }, { text: "1", tag: "Hanya menghitung salah satu suku sebagai 1, lupa menjumlahkan" }, { text: "2", correct: true }, { text: "21", tag: "Mengalikan basis (7×3), mengabaikan pangkat nol" }] },
    { text: "$\\dfrac{9^4}{9^4} = 9^0$. Berapa nilai $9^0$?", options: [{ text: "1", correct: true }, { text: "0", tag: "Mengira pembagian bilangan sama dengan dirinya sendiri hasilnya 0" }, { text: "9", tag: "Mengira pangkat nol menyisakan basisnya" }, { text: "$9^4$", tag: "Tidak menyelesaikan pembagian sama sekali" }, { text: "81", tag: "Salah menghitung, mengalikan basis dengan dirinya sendiri" }] },
    { text: "$(-5)^0 \\times (-5)^2 = ?$", options: [{ text: "0", tag: "Mengira suku pertama ($(-5)^0$) membuat seluruh hasil nol" }, { text: "25", correct: true }, { text: "-25", tag: "Lupa bahwa pangkat genap dari bilangan negatif hasilnya positif" }, { text: "-5", tag: "Salah total, hanya menghitung basisnya" }, { text: "125", tag: "Salah menjumlahkan pangkat lalu salah menghitung basisnya" }] },
    { text: "$(2/7)^0 = ?$", options: [{ text: "0", tag: "Mengira pangkat nol membuat pecahan menjadi nol" }, { text: "2/7", tag: "Mengira pangkat nol tidak mengubah nilai pecahan" }, { text: "7/2", tag: "Membalik pecahan, mengira itu aturan pangkat nol" }, { text: "-1", tag: "Mengira hasil pangkat nol bisa negatif" }, { text: "1", correct: true }] },
    { text: "$\\dfrac{a^3}{a^3} \\times b^0 = ?$ (untuk $a,b \\neq 0$)", options: [{ text: "$a^3$", tag: "Lupa menyelesaikan pembagian $a^3/a^3$ menjadi 1" }, { text: "0", tag: "Mengira salah satu suku berpangkat nol membuat semuanya nol" }, { text: "1", correct: true }, { text: "$a^3b^0$", tag: "Tidak menyelesaikan operasi sama sekali" }, { text: "$b$", tag: "Salah mengira $b^0=b$" }] },
    { text: "Suatu barisan geometri memiliki suku ke-$n$: $U_n = 4 \\cdot 3^{n-1}$. Berapa nilai $U_1$ (saat $n=1$, sehingga pangkatnya menjadi $3^0$)?", options: [{ text: "0", tag: "Mengira $3^0$ membuat seluruh suku menjadi nol" }, { text: "3", tag: "Mengira $3^0$ hasilnya sama dengan basisnya" }, { text: "12", tag: "Mengalikan 4 dengan basis 3, mengabaikan bahwa $3^0=1$" }, { text: "4", correct: true }, { text: "1", tag: "Mengabaikan koefisien 4 di depan" }] },
  ],
  E7: [
    { text: "$4^{-2} = ?$", options: [{ text: "-16", tag: "Mengira pangkat negatif berarti hasilnya jadi negatif" }, { text: "-8", tag: "Salah menghitung, mencampur tanda negatif dengan perkalian" }, { text: "$1/16$", correct: true }, { text: "$-1/16$", tag: "Sudah paham bentuk pecahan tapi salah menambahkan tanda minus" }, { text: "16", tag: "Mengabaikan tanda negatif pada pangkat sepenuhnya" }] },
    { text: "$2^{-3} = ?$", options: [{ text: "$1/8$", correct: true }, { text: "-8", tag: "Mengira pangkat negatif membuat hasil akhirnya negatif" }, { text: "$-1/8$", tag: "Sudah paham bentuk pecahan tapi salah menambahkan tanda minus" }, { text: "8", tag: "Mengabaikan tanda negatif pada pangkat sepenuhnya" }, { text: "$1/6$", tag: "Salah menghitung perkalian berulang di penyebut" }] },
    { text: "$(1/3)^{-2} = ?$", options: [{ text: "$1/9$", tag: "Lupa bahwa pangkat negatif pada pecahan membalik pecahannya" }, { text: "9", correct: true }, { text: "-9", tag: "Mengira hasil pangkat negatif harus negatif" }, { text: "$-1/9$", tag: "Lupa membalik pecahan dan salah tanda sekaligus" }, { text: "6", tag: "Salah menghitung, menganggap pangkat negatif berarti dikali -2" }] },
    { text: "$3x^{-2} = ?$ (untuk $x \\neq 0$)", options: [{ text: "$-3x^2$", tag: "Mengira pangkat negatif membuat koefisien jadi negatif" }, { text: "$3/x$", tag: "Salah menuliskan pangkat penyebut, seharusnya tetap 2" }, { text: "$1/3x^2$", tag: "Ikut membalik koefisien 3 padahal seharusnya hanya variabelnya" }, { text: "$3/x^2$", correct: true }, { text: "$-3/x^2$", tag: "Menambahkan tanda negatif yang tidak seharusnya ada" }] },
    { text: "$(2/5)^{-1} = ?$", options: [{ text: "$2/5$", tag: "Mengira pangkat negatif tidak mengubah pecahan" }, { text: "$-5/2$", tag: "Mengira hasil pangkat negatif harus negatif" }, { text: "$-2/5$", tag: "Salah tanda meski sudah paham membalik pecahan" }, { text: "10", tag: "Salah total, mengalikan pembilang dan penyebut" }, { text: "$5/2$", correct: true }] },
    { text: "$a^3 \\times a^{-5} = ?$", options: [{ text: "$1/a^2$", correct: true }, { text: "$a^2$", tag: "Mengabaikan tanda negatif pada hasil akhir" }, { text: "$a^{-15}$", tag: "Mengalikan pangkat, bukan menjumlahkan" }, { text: "$a^8$", tag: "Menjumlahkan pangkat sebagai bilangan positif semua" }, { text: "$-a^2$", tag: "Mengira pangkat negatif membuat hasilnya bertanda minus" }] },
    { text: "$(3/4)^{-3} = ?$", options: [{ text: "$27/64$", tag: "Lupa membalik pecahan sebelum memangkatkan" }, { text: "$-64/27$", tag: "Mengira hasil pangkat negatif harus negatif" }, { text: "$64/27$", correct: true }, { text: "$9/16$", tag: "Salah menghitung pangkat, menggunakan pangkat 2 bukan 3" }, { text: "$-27/64$", tag: "Lupa membalik pecahan dan salah tanda sekaligus" }] },
    { text: "Bentuk sederhana (tanpa pangkat negatif) dari $\\dfrac{x^{-2}}{y^{-3}}$ adalah...?", options: [{ text: "$x^2/y^3$", tag: "Membalik posisi pangkat negatif dengan arah yang salah" }, { text: "$y^3/x^2$", correct: true }, { text: "$1/x^2y^3$", tag: "Membalik keduanya ke penyebut, padahal seharusnya salah satu berpindah ke pembilang" }, { text: "$x^2y^3$", tag: "Mengabaikan tanda negatif pada kedua pangkat" }, { text: "$-y^3/x^2$", tag: "Sudah benar membalik posisi tapi salah menambahkan tanda minus" }] },
    { text: "Sebuah zat meluruh menjadi $2^{-4}$ kali massa awal. Berapa bagian massa yang tersisa?", options: [{ text: "-8 bagian", tag: "Mengira pangkat negatif membuat hasil menjadi negatif" }, { text: "16 bagian", tag: "Mengabaikan tanda negatif pada pangkat" }, { text: "8 bagian", tag: "Salah menghitung perkalian berulang" }, { text: "$1/16$ bagian", correct: true }, { text: "$-1/16$ bagian", tag: "Sudah paham bentuk pecahan tapi salah menambahkan tanda minus" }] },
    { text: "$\\left(\\dfrac{2x^{-1}}{y^2}\\right)^{-2} = ?$", options: [{ text: "$4x^{-2}/y^4$", tag: "Mengabaikan tanda negatif pada pangkat luar sepenuhnya" }, { text: "$x^2/4y^4$", tag: "Lupa memangkatkan koefisien 2 dengan benar" }, { text: "$4/x^2y^4$", tag: "Salah membalik posisi variabel y, seharusnya y berpindah ke pembilang" }, { text: "$-x^2y^4/4$", tag: "Mengira pangkat negatif membuat hasil akhirnya bertanda minus" }, { text: "$x^2y^4/4$", correct: true }] },
  ],
  E8: [
    { text: "$27^{1/3} = ?$", options: [{ text: "9", tag: "Mengira $a^{1/n} = a/n$ (dibagi n), bukan akar pangkat n" }, { text: "3", correct: true }, { text: "24", tag: "Salah operasi, mengurangkan alih-alih mengakarkan" }, { text: "81", tag: "Salah menghitung, mengalikan 27×3" }, { text: "1/3", tag: "Menukar posisi pangkat dan hasil" }] },
    { text: "$16^{3/4} = ?$", options: [{ text: "12", tag: "Mengira pangkat pecahan dihitung dengan perkalian langsung (16×3/4)" }, { text: "64", tag: "Hanya menghitung $16^3$ tanpa mengakarkan pangkat 4" }, { text: "8", correct: true }, { text: "4", tag: "Hanya menghitung akar pangkat 4 tanpa memangkatkan dulu dengan 3" }, { text: "2", tag: "Salah total, hanya menghitung akar pangkat 4 dari 16 lalu dibagi lagi" }] },
    { text: "$9^{1/2} = ?$", options: [{ text: "3", correct: true }, { text: "4,5", tag: "Mengira $a^{1/2}=a/2$ (dibagi 2), bukan akar kuadrat" }, { text: "18", tag: "Salah operasi, mengalikan bukan mengakarkan" }, { text: "81", tag: "Mengira pangkat 1/2 berarti dikuadratkan" }, { text: "1/3", tag: "Menukar posisi hasil dan pangkatnya" }] },
    { text: "$8^{2/3} = ?$", options: [{ text: "16/3", tag: "Mengira pangkat pecahan dihitung dengan perkalian langsung (8×2/3)" }, { text: "64", tag: "Hanya menghitung $8^2$ tanpa mengakarkan pangkat 3" }, { text: "2", tag: "Hanya menghitung akar pangkat 3 dari 8 tanpa memangkatkan dulu dengan 2" }, { text: "4", correct: true }, { text: "6", tag: "Salah hitung total" }] },
    { text: "$32^{1/5} = ?$", options: [{ text: "6,4", tag: "Mengira $a^{1/n}=a/n$ (dibagi n), bukan akar pangkat n" }, { text: "160", tag: "Salah operasi, mengalikan alih-alih mengakarkan" }, { text: "5", tag: "Menukar posisi basis dan indeks akar" }, { text: "27", tag: "Salah menghitung, mengurangkan basis dengan indeks" }, { text: "2", correct: true }] },
    { text: "Bentuk akar dari $a^{2/5}$ adalah...?", options: [{ text: "$\\sqrt[2]{a^5}$", tag: "Menukar posisi pembilang dan penyebut pangkat" }, { text: "$\\sqrt[5]{a^2}$", correct: true }, { text: "$\\sqrt{a}^{2/5}$", tag: "Tidak mengubah bentuk sepenuhnya menjadi akar" }, { text: "$a^{5/2}$", tag: "Membalik posisi pembilang dan penyebut tanpa mengubah ke bentuk akar" }, { text: "$\\sqrt[2/5]{a}$", tag: "Menempatkan pecahan sebagai indeks akar secara langsung, salah bentuk" }] },
    { text: "$4 \\cdot 25^{1/2} = ?$", options: [{ text: "12,5", tag: "Mengira $25^{1/2}=25/2$, bukan akar kuadrat" }, { text: "50", tag: "Salah menghitung akar kuadrat dari 25 lalu salah mengalikan" }, { text: "20", correct: true }, { text: "100", tag: "Mengalikan 4 dan 25 langsung, mengabaikan pangkat 1/2" }, { text: "10", tag: "Salah menghitung akar kuadrat 25 sebagai 2,5" }] },
    { text: "$16^{-1/4} = ?$", options: [{ text: "1/2", correct: true }, { text: "-2", tag: "Mengira pangkat negatif membuat hasil menjadi negatif" }, { text: "2", tag: "Mengabaikan tanda negatif pada pangkat" }, { text: "-1/2", tag: "Sudah membalik dengan benar tapi salah menambahkan tanda minus" }, { text: "1/4", tag: "Salah menghitung akar pangkat 4 dari 16" }] },
    { text: "Bentuk sederhana dari $x^{1/2} \\times x^{1/3}$ adalah...?", options: [{ text: "$x^{1/6}$", tag: "Mengurangkan pangkat pecahan, bukan menjumlahkan" }, { text: "$x^{1/5}$", tag: "Salah menjumlahkan pecahan, hanya menjumlahkan penyebutnya saja" }, { text: "$x^{2/5}$", tag: "Menjumlahkan pembilang dan penyebut secara terpisah tanpa menyamakan penyebut" }, { text: "$x^{5/6}$", correct: true }, { text: "$x$", tag: "Mengira hasil penjumlahan pangkat pecahan otomatis menjadi 1" }] },
    { text: "Debit air dinyatakan sebagai $V^{2/3}$ dengan $V=64$ liter. Berapa hasilnya?", options: [{ text: "42,67", tag: "Mengira pangkat pecahan dihitung dengan perkalian langsung (64×2/3)" }, { text: "16", correct: true }, { text: "4096", tag: "Hanya menghitung $64^2$ tanpa mengakarkan pangkat 3" }, { text: "4", tag: "Hanya menghitung akar pangkat 3 dari 64 tanpa memangkatkan dulu dengan 2" }, { text: "8", tag: "Salah hitung total, hanya setengah dari hasil sebenarnya" }] },
  ],
  E9: [
    { text: "$3\\sqrt2 + 5\\sqrt2 = ?$", options: [{ text: "$8\\sqrt4$", tag: "Ikut menjumlahkan angka di dalam akar padahal seharusnya tetap" }, { text: "$15\\sqrt2$", tag: "Mengalikan koefisien alih-alih menjumlahkan" }, { text: "$8\\sqrt2$", correct: true }, { text: "$8\\sqrt0$", tag: "Salah total, mengurangkan angka di dalam akar" }, { text: "$2\\sqrt8$", tag: "Menukar posisi koefisien dan bilangan di dalam akar" }] },
    { text: "$\\sqrt3 \\times \\sqrt{12} = ?$", options: [{ text: "6", correct: true }, { text: "$\\sqrt{15}$", tag: "Menjumlahkan angka di dalam akar, padahal seharusnya dikalikan" }, { text: "36", tag: "Lupa mengakarkan hasil akhir setelah perkalian di dalam akar" }, { text: "3", tag: "Salah mengalikan angka di dalam akar (3×12 dihitung keliru)" }, { text: "$4\\sqrt3$", tag: "Salah menyederhanakan hasil perkalian di dalam akar" }] },
    { text: "$7\\sqrt5 - 2\\sqrt5 = ?$", options: [{ text: "$5\\sqrt0$", tag: "Ikut mengurangkan angka di dalam akar" }, { text: "$5\\sqrt5$", correct: true }, { text: "$9\\sqrt5$", tag: "Menjumlahkan alih-alih mengurangkan koefisien" }, { text: "$14\\sqrt5$", tag: "Mengalikan koefisien alih-alih mengurangkan" }, { text: "$5\\sqrt{10}$", tag: "Ikut mengurangkan lalu salah menggabungkan angka di dalam akar" }] },
    { text: "$\\sqrt{8} + \\sqrt{18} = ?$", options: [{ text: "$\\sqrt{26}$", tag: "Langsung menjumlahkan angka di dalam akar tanpa menyederhanakan dulu" }, { text: "$2\\sqrt{13}$", tag: "Salah menyederhanakan kedua akar sebelum dijumlahkan" }, { text: "$10\\sqrt2$", tag: "Salah menghitung koefisien hasil penyederhanaan" }, { text: "$5\\sqrt2$", correct: true }, { text: "12", tag: "Mengalikan kedua bilangan di dalam akar alih-alih menjumlahkan bentuknya" }] },
    { text: "$\\sqrt6 \\times \\sqrt{24} = ?$", options: [{ text: "$\\sqrt{30}$", tag: "Menjumlahkan angka di dalam akar, padahal seharusnya dikalikan" }, { text: "144", tag: "Lupa mengakarkan hasil akhir setelah perkalian di dalam akar" }, { text: "$6\\sqrt{24}$", tag: "Tidak menyelesaikan perkalian di dalam akar sama sekali" }, { text: "6", tag: "Salah menyederhanakan hasil akhir, kurang teliti mengakarkan" }, { text: "12", correct: true }] },
    { text: "Bentuk rasional dari $\\dfrac{1}{\\sqrt3}$ adalah...?", options: [{ text: "$\\sqrt3/3$", correct: true }, { text: "$1/3$", tag: "Menghilangkan akar tanpa mengalikan pembilang, hanya membagi angka di dalam akar" }, { text: "$3/\\sqrt3$", tag: "Salah arah, mengalikan penyebut ke pembilang tanpa menyederhanakan" }, { text: "$\\sqrt3$", tag: "Mengabaikan penyebut sepenuhnya" }, { text: "$3\\sqrt3$", tag: "Salah mengalikan pembilang dan penyebut dengan $\\sqrt3$" }] },
    { text: "Bentuk rasional dari $\\dfrac{6}{\\sqrt2}$ adalah...?", options: [{ text: "$6\\sqrt2$", tag: "Lupa membagi hasil perkalian dengan angka di dalam akar setelah dirasionalkan" }, { text: "$3\\sqrt2$", correct: true }, { text: "3", tag: "Menghilangkan akar tanpa proses rasionalisasi yang benar" }, { text: "$2\\sqrt6$", tag: "Menukar posisi koefisien dan bilangan di dalam akar" }, { text: "$\\sqrt{12}$", tag: "Salah menggabungkan bentuk akar dan koefisien" }] },
    { text: "$2\\sqrt3 \\times 3\\sqrt3 = ?$", options: [{ text: "$6\\sqrt3$", tag: "Lupa menyelesaikan perkalian $\\sqrt3 \\times \\sqrt3$ menjadi 3" }, { text: "$6\\sqrt9$", tag: "Salah cara menggabungkan angka di dalam akar" }, { text: "18", correct: true }, { text: "$5\\sqrt3$", tag: "Menjumlahkan koefisien, padahal seharusnya dikalikan" }, { text: "9", tag: "Lupa mengalikan koefisien 2 dan 3 di depan" }] },
    { text: "Panjang diagonal persegi dengan sisi $\\sqrt2$ cm dihitung dengan $\\sqrt2 \\times \\sqrt2$. Berapa hasilnya?", options: [{ text: "$2\\sqrt2$", tag: "Menjumlahkan angka di dalam akar, padahal seharusnya dikalikan" }, { text: "4", tag: "Salah mengalikan, menghitung $2\\times2$ alih-alih $\\sqrt2\\times\\sqrt2$" }, { text: "$\\sqrt2$", tag: "Tidak menyelesaikan perkalian di dalam akar sama sekali" }, { text: "2", correct: true }, { text: "8", tag: "Salah menggabungkan hasil perkalian di dalam akar" }] },
    { text: "Bentuk sederhana dari $\\dfrac{10}{\\sqrt5} + \\sqrt5$ adalah...?", options: [{ text: "$\\sqrt5$", tag: "Salah menyederhanakan suku pertama sehingga hasilnya hilang" }, { text: "$11\\sqrt5$", tag: "Salah menghitung penyederhanaan suku pertama sebelum dijumlahkan" }, { text: "$2\\sqrt{10}$", tag: "Menggabungkan kedua suku secara langsung tanpa merasionalkan dulu" }, { text: "$15/\\sqrt5$", tag: "Menjumlahkan pembilang secara langsung tanpa merasionalkan" }, { text: "$3\\sqrt5$", correct: true }] },
  ],
  E10: [
    { text: "Sebuah fungsi $y = 50 \\cdot (1{,}2)^x$ menggambarkan...?", options: [{ text: "Pertumbuhan, karena faktor pengalinya (1,2) lebih dari 1", correct: true }, { text: "Peluruhan, karena angka 1,2 dianggap kecil", tag: "Tidak memahami syarat b>1 untuk pertumbuhan" }, { text: "Tidak bisa ditentukan tanpa tahu nilai x", tag: "Tidak memahami bahwa sifat naik/turun ditentukan oleh nilai b, bukan x" }, { text: "Peluruhan, karena nilai awalnya (50) kecil", tag: "Salah fokus pada nilai a, bukan nilai b" }, { text: "Pertumbuhan hanya jika $x$ bernilai negatif", tag: "Tidak memahami bahwa jenis fungsi ditentukan oleh b, berlaku untuk semua x" }] },
    { text: "Fungsi $y = 200 \\cdot (0{,}85)^x$ menggambarkan peluruhan. Berapa nilai $y$ saat $x=0$?", options: [{ text: "0", tag: "Mengira nilai awal fungsi eksponensial selalu 0" }, { text: "200", correct: true }, { text: "170", tag: "Salah menghitung, mengira x=0 berarti dikalikan langsung dengan 0,85" }, { text: "0,85", tag: "Menjawab dengan nilai faktor pengali, bukan nilai awal fungsi" }, { text: "1", tag: "Mengira $b^0=1$ berarti seluruh fungsi bernilai 1, mengabaikan koefisien a" }] },
    { text: "Manakah yang merupakan CIRI grafik fungsi eksponensial peluruhan?", options: [{ text: "Grafik berupa garis lurus yang menurun", tag: "Tertukar dengan ciri grafik fungsi linear" }, { text: "Grafik menyentuh sumbu-x lalu berbalik naik", tag: "Tidak memahami konsep asimtot pada fungsi eksponensial" }, { text: "Grafik menurun mendekati sumbu-x tapi tidak pernah menyentuhnya", correct: true }, { text: "Grafik berbentuk parabola yang terbuka ke bawah", tag: "Tertukar dengan ciri grafik fungsi kuadrat" }, { text: "Grafik menurun lalu berhenti tepat di sumbu-x", tag: "Tidak memahami bahwa grafik eksponensial tidak pernah menyentuh sumbu-x" }] },
    { text: "Populasi bakteri mengikuti $N(t) = 100 \\cdot 2^t$. Berapa populasi saat $t=3$?", options: [{ text: "600", tag: "Mengira pertumbuhan bersifat linear, salah menghitung perkalian berulang" }, { text: "300", tag: "Menjumlahkan alih-alih memangkatkan" }, { text: "106", tag: "Menjumlahkan 100 dengan $2^3$ alih-alih mengalikan" }, { text: "800", correct: true }, { text: "200", tag: "Hanya menghitung $2^1$, mengabaikan bahwa $t=3$" }] },
    { text: "Nilai suatu barang menyusut mengikuti $V(t)=10.000.000 \\cdot (0{,}8)^t$ (rupiah). Berapa nilainya saat $t=2$ tahun?", options: [{ text: "Rp8.000.000", tag: "Hanya menghitung satu tahun penyusutan, mengabaikan tahun kedua" }, { text: "Rp8.400.000", tag: "Mengira penyusutan bersifat linear (dikurangi tetap tiap tahun)" }, { text: "Rp10.000.000", tag: "Mengabaikan faktor peluruhan sama sekali" }, { text: "Rp1.600.000", tag: "Salah menghitung pangkat, seharusnya dikalikan bukan dikurangkan berulang" }, { text: "Rp6.400.000", correct: true }] },
    { text: "Dari fungsi $y = 25 \\cdot (1{,}5)^x$, berapa nilai $a$ dan $b$?", options: [{ text: "$a=25, b=1{,}5$", correct: true }, { text: "$a=1{,}5, b=25$", tag: "Menukar posisi nilai a dan b" }, { text: "$a=25, b=x$", tag: "Mengira variabel x adalah bagian dari nilai b" }, { text: "$a=1, b=25$", tag: "Salah total dalam mengidentifikasi kedua nilai konstanta" }, { text: "$a=25\\times1{,}5, b=1$", tag: "Menggabungkan kedua konstanta menjadi satu nilai a" }] },
    { text: "Manakah fungsi berikut yang mengalami pertumbuhan PALING CEPAT untuk $x$ yang besar?", options: [{ text: "$y=1{,}5^x$", tag: "Tidak membandingkan nilai b dengan fungsi lain yang b-nya lebih besar" }, { text: "$y=2^x$", correct: true }, { text: "$y=1{,}1^x$", tag: "Memilih fungsi dengan nilai b yang justru kecil" }, { text: "$y=(0{,}9)^x$", tag: "Tidak memahami bahwa $0<b<1$ berarti peluruhan, bukan pertumbuhan" }, { text: "$y=(1{,}05)^x$", tag: "Memilih fungsi dengan pertumbuhan paling lambat karena b mendekati 1" }] },
    { text: "Jika $N(t)=50\\cdot2^t$, pada $t$ berapa populasi mencapai 400?", options: [{ text: "$t=4$", tag: "Salah menghitung, hasil terlalu besar (melebihi 400)" }, { text: "$t=8$", tag: "Mengira 400 harus dibagi 50 lalu langsung dijadikan nilai t" }, { text: "$t=3$", correct: true }, { text: "$t=350$", tag: "Mengurangkan nilai awal dari target, bukan menyelesaikan persamaan eksponen" }, { text: "$t=2$", tag: "Kurang satu langkah perhitungan, populasi belum mencapai 400" }] },
    { text: "Fungsi $y = 500 \\cdot (0{,}75)^x$ menyatakan peluruhan. Berapa persen nilai yang berkurang setiap satu langkah $x$?", options: [{ text: "75%", tag: "Mengira nilai faktor pengali (0,75) langsung sama dengan persentase pengurangan" }, { text: "50%", tag: "Salah menghitung, tidak menghubungkan faktor pengali dengan persentase sisa" }, { text: "0,75%", tag: "Salah menafsirkan bentuk desimal sebagai persen tanpa dikalikan 100" }, { text: "25%", correct: true }, { text: "125%", tag: "Salah tanda, menganggap nilainya bertambah bukan berkurang" }] },
    { text: "Sebuah investasi awal Rp2.000.000 bertumbuh 10% setiap tahun. Manakah model fungsi yang tepat untuk nilai investasi setelah $t$ tahun?", options: [{ text: "$y=2.000.000 \\cdot (0{,}1)^t$", tag: "Menggunakan nilai persentase pertumbuhan langsung sebagai faktor pengali" }, { text: "$y=2.000.000+0{,}1t$", tag: "Menganggap pertumbuhan bersifat linear, bukan eksponensial" }, { text: "$y=2.000.000 \\cdot (0{,}9)^t$", tag: "Salah arah, menggunakan rumus peluruhan bukan pertumbuhan" }, { text: "$y=2.000.000 \\cdot t^{1{,}1}$", tag: "Menukar posisi basis dan variabel pangkat" }, { text: "$y=2.000.000 \\cdot (1{,}1)^t$", correct: true }] },
  ],
  E11: [
    { text: "$2^x = 32$, $x = ?$", options: [{ text: "16", tag: "Salah mengubah 32 menjadi bentuk pangkat basis 2" }, { text: "5", correct: true }, { text: "30", tag: "Mengurangkan basis dari hasil, bukan menyamakan pangkat" }, { text: "4", tag: "Salah menghitung pangkat dari 32 sebagai basis 2" }, { text: "6", tag: "Salah menghitung, satu langkah lebih dari seharusnya" }] },
    { text: "$3^{2x} = 81$, $x = ?$", options: [{ text: "2", correct: true }, { text: "4", tag: "Lupa membagi 2 setelah menyamakan pangkat (2x=4, bukan x=4)" }, { text: "8", tag: "Salah mengubah 81 menjadi bentuk pangkat basis 3" }, { text: "1", tag: "Salah membagi hasil penyamaan pangkat" }, { text: "16", tag: "Mengalikan hasil penyamaan pangkat, bukan membagi" }] },
    { text: "$5^{x-1} = 125$, $x = ?$", options: [{ text: "3", tag: "Lupa menambahkan 1 kembali setelah menyamakan pangkat" }, { text: "2", tag: "Salah mengubah 125 menjadi bentuk pangkat basis 5" }, { text: "4", correct: true }, { text: "5", tag: "Salah menghitung, tidak mengurangkan 1 dengan benar" }, { text: "-2", tag: "Salah tanda saat menyelesaikan persamaan linear hasil penyamaan pangkat" }] },
    { text: "$4^x = 8^{x-1}$, $x = ?$ (petunjuk: ubah kedua ruas ke basis 2)", options: [{ text: "1", tag: "Tidak menyamakan basis terlebih dahulu sebelum menyamakan pangkat" }, { text: "-3", tag: "Salah tanda saat menyelesaikan persamaan linear hasil penyamaan pangkat" }, { text: "6", tag: "Salah menyamakan basis, keliru mengubah 8 menjadi $2^4$" }, { text: "3", correct: true }, { text: "2", tag: "Salah menyelesaikan persamaan linear setelah pangkat disamakan" }] },
    { text: "$2^{x+1} = 16$, $x = ?$", options: [{ text: "4", tag: "Lupa mengurangkan 1 setelah menyamakan pangkat" }, { text: "5", tag: "Salah mengubah 16 menjadi bentuk pangkat basis 2" }, { text: "8", tag: "Mengurangkan basis dari hasil, bukan menyamakan pangkat" }, { text: "2", tag: "Salah menghitung, kurang satu langkah" }, { text: "3", correct: true }] },
    { text: "$9^x = 27$, $x = ?$", options: [{ text: "3", tag: "Tidak menyamakan basis (9 dan 27) ke bentuk basis 3 terlebih dahulu" }, { text: "3/2", correct: true }, { text: "2/3", tag: "Menukar posisi pembilang dan penyebut hasil pembagian pangkat" }, { text: "6", tag: "Menjumlahkan pangkat kedua ruas, bukan menyamakan basis" }, { text: "9", tag: "Salah total, tidak memahami cara menyamakan basis" }] },
    { text: "$3^x = 1/9$, $x = ?$", options: [{ text: "2", tag: "Mengabaikan tanda negatif, hanya mengubah 1/9 menjadi $3^2$" }, { text: "1/2", tag: "Salah menafsirkan pangkat sebagai bentuk pecahan, bukan bilangan bulat negatif" }, { text: "-2", correct: true }, { text: "-9", tag: "Salah mengubah 1/9 menjadi bentuk pangkat basis 3" }, { text: "9", tag: "Mengabaikan tanda negatif dan bentuk pecahannya sekaligus" }] },
    { text: "$25^{x} = 5^{x+3}$, $x = ?$", options: [{ text: "3", correct: true }, { text: "1", tag: "Salah menyamakan basis 25 menjadi $5^2$, tidak dikalikan dengan pangkat x" }, { text: "6", tag: "Salah menyelesaikan persamaan linear setelah basis disamakan" }, { text: "-3", tag: "Salah tanda saat menyelesaikan persamaan linear" }, { text: "9", tag: "Tidak menyamakan basis kedua ruas dengan benar sebelum menyamakan pangkat" }] },
    { text: "Populasi menyusut mengikuti $200\\cdot(0{,}5)^t = 25$. Berapa nilai $t$?", options: [{ text: "8", tag: "Mengira 25 harus dibagi langsung ke 200 lalu dijadikan nilai t" }, { text: "175", tag: "Mengurangkan 25 dari 200, tidak menyelesaikan persamaan eksponen" }, { text: "4", tag: "Kurang teliti menghitung, satu langkah lebih dari seharusnya" }, { text: "3", correct: true }, { text: "2", tag: "Kurang satu langkah perhitungan, populasi belum mencapai 25" }] },
    { text: "$2 \\cdot 3^{x} = 54$, $x = ?$", options: [{ text: "6", tag: "Tidak membagi kedua ruas dengan koefisien 2 sebelum menyamakan basis" }, { text: "9", tag: "Salah mengubah hasil bagi (27) menjadi bentuk pangkat basis 3" }, { text: "27", tag: "Lupa menyelesaikan persamaan eksponen, hanya menuliskan hasil bagi" }, { text: "1", tag: "Salah menyamakan basis, keliru mengubah 27 menjadi $3^1$" }, { text: "3", correct: true }] },
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
const GURU_PALETTE = { strong: "#F472B6", mid: "#C4B5FD", soft: "#A78BFA", pale: "#F5F3FF" };
function formatDuration(sec) {
  if (sec === null || sec === undefined || isNaN(sec)) return "-";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} detik`;
  return `${m} menit ${r} detik`;
}

// ---------------- Komponen: MathText — merender notasi LaTeX asli pakai KaTeX ----------------
function sanitizeMathTex(tex) {
  return String(tex || '')
    .replace(/≠/g, '\\ne ')
    .replace(/≥/g, '\\ge ')
    .replace(/≤/g, '\\le ')
    .replace(/\s*§\s*/g, ' ⇒ ')
    .replace(/\\qquad/g, ' ')
    .replace(/\\quad/g, ' ')
    .trim();
}

function normalizeDisplayMath(tex) {
  const raw = sanitizeMathTex(tex);
  if (/\\begin\{(aligned|alignedat|gathered|array|cases|split)\}/.test(raw)) return raw;
  const parts = raw.split(/\s*(?:\\Rightarrow|\\to|→|⇒)\s*/).filter(Boolean);
  if (parts.length <= 1) return raw;
  return `\\begin{gathered}${parts.map((part, i) => `${i === 0 ? '' : '⇒\\,'}${part.trim()}`).join('\\\\[5pt]')}\\end{gathered}`;
}

function KaTeXSpan({ tex, block = false, className = '' }) {
  let html;
  try {
    const cleanTex = sanitizeMathTex(tex);
    const displayTex = block ? normalizeDisplayMath(cleanTex) : cleanTex;
    html = katex.renderToString(displayTex, { throwOnError: false, displayMode: block, strict: 'ignore' });
  } catch (e) {
    html = String(tex || '');
  }
  if (!block) return <span className={`math-inline ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
  return <div className={`math-block-wrap ${className}`.trim()} aria-label="Persamaan matematika"><span className="math-block" dangerouslySetInnerHTML={{ __html: html }} /></div>;
}

function MathText({ text, className = '' }) {
  if (text === null || text === undefined || text === '') return null;
  const raw = Array.isArray(text) ? text.join("\n") : String(text);
  if (!raw) return null;
  const looksLikeMath = !raw.includes('$') && (/\\[a-zA-Z]/.test(raw) || /[\^_=]|[≠≥≤]|§|⇒|→/.test(raw));
  if (looksLikeMath) return <KaTeXSpan tex={raw} block className={className} />;
  const parts = raw.split(/(\$[^$]+\$)/g);
  return <span className={className}>{parts.map((part, i) => part.startsWith('$') && part.endsWith('$') && part.length > 1 ? <KaTeXSpan key={i} tex={part.slice(1, -1)} /> : <span key={i}>{part}</span>)}</span>;
}
// ---------------- Komponen: grafik contoh pertumbuhan & peluruhan eksponensial (untuk materi E10) ----------------
const EXP_GROWTH_DATA = Array.from({ length: 7 }, (_, t) => ({ x: t, y: Math.round(500 * Math.pow(1.2, t) * 10) / 10 }));
const EXP_DECAY_DATA = Array.from({ length: 7 }, (_, t) => ({ x: t, y: Math.round(800 * Math.pow(0.5, t) * 10) / 10 }));
function ExpFunctionCharts() {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
      <div className="card" style={{ flex: "1 1 260px", minWidth: 240 }}>
        <div className="tag-eyebrow" style={{ marginBottom: 8 }}>Grafik Pertumbuhan (p &gt; 0) · Nₜ = 500(1,2)ᵗ</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={EXP_GROWTH_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [v, "y"]} labelFormatter={(l) => `x = ${l}`} />
            <Line type="monotone" dataKey="y" stroke={GURU_PALETTE.strong} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Grafik naik semakin cepat — nilai (1+p) lebih dari 1.</p>
      </div>
      <div className="card" style={{ flex: "1 1 260px", minWidth: 240 }}>
        <div className="tag-eyebrow" style={{ marginBottom: 8 }}>Grafik Peluruhan (0 &lt; p &lt; 1) · Mₜ = 800(0,5)ᵗ</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={EXP_DECAY_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [v, "y"]} labelFormatter={(l) => `x = ${l}`} />
            <Line type="monotone" dataKey="y" stroke={GURU_PALETTE.soft} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Grafik turun mendekati nol — nilai (1-p) antara 0 dan 1.</p>
      </div>
    </div>
  );
}
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

// ---------------- Refleksi: saran pengembangan aplikasi berdasarkan pengalaman siswa ----------------
const REFLECTION_QUESTIONS = [
  { id: "r1", label: "Kemudahan Penggunaan", text: "Menurutmu, apakah aplikasi ini mudah digunakan? Bagian atau menu mana yang menurutmu masih membingungkan?" },
  { id: "r2", label: "Fitur Paling Membantu", text: "Fitur apa (misalnya Tutor AI, Latihan, Ujian, Komik, dll.) yang paling membantu kamu belajar, dan kenapa?" },
  { id: "r3", label: "Kendala Teknis", text: "Apakah kamu pernah mengalami error, aplikasi lambat/lag, atau bagian yang tidak berfungsi dengan baik? Jelaskan kapan dan di menu apa." },
  { id: "r4", label: "Pengalaman di HP vs Laptop", text: "Bagaimana pengalamanmu menggunakan aplikasi ini di HP (mobile) dibandingkan di laptop/komputer?" },
  { id: "r5", label: "Saran Pengembangan", text: "Apa saran atau fitur baru yang kamu usulkan supaya aplikasi ini lebih baik ke depannya?" },
];

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
            <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: 10, fontSize: 13.5, maxWidth: "85%", lineHeight: 1.5, background: m.role === "user" ? "var(--brand)" : "var(--paper-2)", color: m.role === "user" ? "white" : "var(--ink)" }}><MathText text={m.text} /></span>
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

// ---------- Persistensi posisi halaman terakhir (agar refresh tidak kembali ke Dashboard) ----------
// Hanya layar "aman" (tidak punya state sementara seperti jawaban ujian yg sedang diisi / diagnosis
// yg belum tersimpan) yang disimpan & dipulihkan. Layar transien (diagnosis, hint, ujianSoal, dst.)
// sengaja tidak disimpan supaya tidak memulihkan ke state yang tidak konsisten setelah refresh.
const NAV_RESTORABLE_SCREENS = new Set([
  "dashboard", "materiList", "materi", "latihanList", "latihan",
  "ujian", "progress", "leaderboard", "badges", "profil", "tutorAI",
  "komikList", "komikChapter", "refleksi",
]);
function navStorageKey(uid) {
  return "acits_lastScreen_" + uid;
}
function saveNavState(uid, state) {
  if (!uid) return;
  try {
    localStorage.setItem(navStorageKey(uid), JSON.stringify(state));
  } catch (e) {}
}
function loadNavState(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(navStorageKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function clearNavState(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(navStorageKey(uid));
  } catch (e) {}
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
  const [authKelasAjar, setAuthKelasAjar] = useState("");
  const [authKodeAkses, setAuthKodeAkses] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // ---------- Konten materi & soal (bisa ditimpa guru, tersimpan di Firestore) ----------
  const [contentOverrides, setContentOverrides] = useState({});
  const [contentLoaded, setContentLoaded] = useState(false);
  useEffect(() => {
    async function loadContentOverrides() {
      try {
        const snap = await getDocs(collection(db, "contentOverrides"));
        const obj = {};
        snap.docs.forEach((d) => { obj[d.id] = d.data(); });
        setContentOverrides(obj);
      } catch (e) {}
      setContentLoaded(true);
    }
    loadContentOverrides();
  }, []);
  const EFFECTIVE_MATERI = useMemo(() => {
    const out = {};
    CONCEPT_ORDER.forEach((c) => {
      const ov = contentOverrides[c];
      out[c] = {
        formula: ov?.formula && ov.formula.length ? ov.formula : MATERI[c].formula,
        penjelasan: ov?.penjelasan || MATERI[c].penjelasan,
        contoh: ov?.contoh && ov.contoh.length ? ov.contoh : MATERI[c].contoh,
      };
    });
    return out;
  }, [contentOverrides]);
  const EFFECTIVE_POOL = useMemo(() => {
    const out = {};
    CONCEPT_ORDER.forEach((c) => {
      const ov = contentOverrides[c];
      out[c] = ov?.questions && ov.questions.length ? ov.questions : PRACTICE_POOL[c];
    });
    return out;
  }, [contentOverrides]);

  // ---------- Progress siswa: latihan konsep (tersimpan di Firestore) ----------
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [attempts, setAttempts] = useState(EMPTY_ATTEMPTS);
  const [misconceptions, setMisconceptions] = useState([]);
  const [poolIndex, setPoolIndex] = useState(EMPTY_POOLIDX);
  const [completedQ, setCompletedQ] = useState({});
  const [wrongQ, setWrongQ] = useState({}); // {concept: [idx, ...]} — soal yg diselesaikan lewat jalur salah (3x salah berturut-turut), ditandai silang merah
  const [streak, setStreak] = useState(0);
  const [lastActiveDate, setLastActiveDate] = useState(null);
  const streakCheckedRef = useRef(false);
  const [leaderboardStudents, setLeaderboardStudents] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingProfil, setEditingProfil] = useState(false);
  const [tutorMessages, setTutorMessages] = useState([]);
  const [tutorFocusConcept, setTutorFocusConcept] = useState(null);

  const [reflectionLoaded, setReflectionLoaded] = useState(false);
  const [reflectionAnswers, setReflectionAnswers] = useState({});
  const [reflectionSubmitting, setReflectionSubmitting] = useState(false);
  const [reflectionSavedAt, setReflectionSavedAt] = useState(null);
  const [reflectionError, setReflectionError] = useState("");
  const [guruReflections, setGuruReflections] = useState([]);
  const [guruReflectionsLoading, setGuruReflectionsLoading] = useState(false);
  const tutorGreetedRef = useRef(false);
  const [editName, setEditName] = useState("");
  const [editKelas, setEditKelas] = useState("");
  const [editSekolah, setEditSekolah] = useState("");
  const [editKelasAjar, setEditKelasAjar] = useState("");
  const [editAvatarColor, setEditAvatarColor] = useState(0);
  const [savingProfil, setSavingProfil] = useState(false);

  // ---------- Ujian: tes 15 soal acak, murni mengukur kemampuan (tidak memengaruhi mastery/attempts) ----------
  const [examQuestions, setExamQuestions] = useState([]);
  const [examAnswers, setExamAnswers] = useState([]);
  const [examSaved, setExamSaved] = useState([]);
  const [examCurrent, setExamCurrent] = useState(0);
  const [examResult, setExamResult] = useState(null);
  const [examHistory, setExamHistory] = useState([]);
  const [examStartTime, setExamStartTime] = useState(null);
  const [examLocked, setExamLocked] = useState(false);
  const [examLeaveWarning, setExamLeaveWarning] = useState(false);
  const [examViolations, setExamViolations] = useState(0);
  const [latihanLocked, setLatihanLocked] = useState(false);
  const [latihanLeaveWarning, setLatihanLeaveWarning] = useState(false);
  const [latihanViolations, setLatihanViolations] = useState(0);
  const EXAM_LENGTH = 15;
  const [examEssayConfirmed, setExamEssayConfirmed] = useState(false);

  // ---------- Form Esai (Google Form milik guru, per sekolah) ----------
  // Menggantikan mekanisme lama (siswa tempel link Drive pribadi). Sekarang siswa mengunggah
  // jawaban esai lewat Google Form yang dibuat & dimiliki guru (file masuk ke Drive guru,
  // siswa lain tidak bisa melihat file siswa lain). Guru juga menyimpan link folder Drive
  // tempat file hasil unggahan itu tersimpan, supaya guru bisa langsung membuka & mengecek
  // jawaban siswa tanpa perlu membuka Form/spreadsheet respons satu per satu.
  const [essayFormUrl, setEssayFormUrl] = useState("");
  const [essayFormUrlInput, setEssayFormUrlInput] = useState("");
  const [essayDriveFolderUrl, setEssayDriveFolderUrl] = useState("");
  const [essayDriveFolderUrlInput, setEssayDriveFolderUrlInput] = useState("");
  const [essayFormSaving, setEssayFormSaving] = useState(false);
  const [essayFormMsg, setEssayFormMsg] = useState("");

  // ---------- Navigasi ----------
  const [screen, setScreen] = useState("dashboard"); // dashboard | materi | latihan | diagnosis | hint | ujian | ujianSoal | ujianHasil | progress | profil | komikList | komikChapter
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
  const [guruSelectedAttempt, setGuruSelectedAttempt] = useState(null);

  // ---------- Admin: Kode Akses Guru ----------
  const [accessCodes, setAccessCodes] = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [newKodeSekolah, setNewKodeSekolah] = useState("");
  const [newKodeMapelNama, setNewKodeMapelNama] = useState("");
  const [newKodeMapelSingkat, setNewKodeMapelSingkat] = useState("");
  const [newKodeNomor, setNewKodeNomor] = useState("");
  const [kodeError, setKodeError] = useState("");

  // ---------- Guru: Kelola Materi & Soal ----------
  const [ccSelectedConcept, setCcSelectedConcept] = useState("E1");
  const [ccFormula, setCcFormula] = useState("");
  const [ccPenjelasan, setCcPenjelasan] = useState("");
  const [ccContoh, setCcContoh] = useState("");
  const [ccSaving, setCcSaving] = useState(false);
  const [ccMsg, setCcMsg] = useState("");
  const [ccEditingIdx, setCcEditingIdx] = useState(null); // null | "new" | angka indeks
  const [ccQDifficulty, setCcQDifficulty] = useState("sedang");
  const [ccQText, setCcQText] = useState("");
  const [ccQOptions, setCcQOptions] = useState(["", "", "", "", ""]);
  const [ccQCorrect, setCcQCorrect] = useState(0);
  const [ccQTags, setCcQTags] = useState(["", "", "", "", ""]);

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
            // Pulihkan halaman terakhir yang dibuka siswa/guru ini sebelum refresh, supaya tidak
            // selalu kembali ke Dashboard. Kalau tidak ada riwayat tersimpan (atau layarnya transien),
            // tetap default ke Dashboard seperti sebelumnya.
            const saved = loadNavState(u.uid);
            if (saved && NAV_RESTORABLE_SCREENS.has(saved.screen)) {
              setScreen(saved.screen);
              if (saved.activeConcept && CONCEPTS[saved.activeConcept]) setActiveConcept(saved.activeConcept);
              if (saved.guruTab) setGuruTab(saved.guruTab);
            } else {
              setScreen("dashboard");
            }
          } else {
            await signOut(auth);
          }
        } else {
          setProfile(null);
          setAttempts(EMPTY_ATTEMPTS);
          setMisconceptions([]);
          setPoolIndex(EMPTY_POOLIDX);
          setTutorMessages([]);
          setExamHistory([]);
          setExamQuestions([]);
          setExamAnswers([]);
          setExamResult(null);
          setExamLocked(false);
          setExamLeaveWarning(false);
          setExamStartTime(null);
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
          setCompletedQ(d.completedQ || {});
          setWrongQ(d.wrongQ || {});
          setTutorMessages(d.tutorMessages || []);
          setExamHistory(d.examHistory || []);
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
    setDoc(doc(db, "progress", authUser.uid), { attempts, misconceptions, poolIndex, completedQ, wrongQ, streak, lastActiveDate, tutorMessages: tutorMessages.slice(-30), examHistory: examHistory.slice(0, 10) }, { merge: true }).catch(() => {});
  }, [attempts, misconceptions, poolIndex, completedQ, wrongQ, streak, lastActiveDate, tutorMessages, examHistory, authUser, profile, progressLoaded]);

  // ---------- Refleksi siswa: muat jawaban tersimpan (kalau pernah mengisi sebelumnya) ----------
  useEffect(() => {
    async function loadReflection() {
      if (!authUser || !profile || profile.role !== "siswa") return;
      try {
        const snap = await getDoc(doc(db, "reflections", authUser.uid));
        if (snap.exists()) {
          const d = snap.data();
          setReflectionAnswers(d.answers || {});
          setReflectionSavedAt(d.updatedAt || null);
        }
      } catch (e) {
        // Gagal memuat refleksi tersimpan -> lanjutkan dengan form kosong.
      } finally {
        setReflectionLoaded(true);
      }
    }
    loadReflection();
  }, [authUser, profile]);

  async function submitReflection() {
    if (!authUser || !profile) return;
    const filled = REFLECTION_QUESTIONS.every((q) => (reflectionAnswers[q.id] || "").trim());
    if (!filled) {
      setReflectionError("Mohon isi semua pertanyaan sebelum mengirim refleksi.");
      return;
    }
    setReflectionError("");
    setReflectionSubmitting(true);
    try {
      await setDoc(doc(db, "reflections", authUser.uid), {
        name: profile.name || "Siswa",
        kelas: profile.kelas || "",
        sekolah: profile.sekolah || "",
        answers: reflectionAnswers,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setReflectionSavedAt(new Date().toISOString());
    } catch (e) {
      setReflectionError("Gagal mengirim refleksi. Periksa koneksi internet kamu dan coba lagi.");
    } finally {
      setReflectionSubmitting(false);
    }
  }

  async function loadGuruReflections() {
    setGuruReflectionsLoading(true);
    try {
      const guruSekolah = (profile?.sekolah || "").trim();
      if (!guruSekolah) {
        setGuruReflections([]);
        setGuruReflectionsLoading(false);
        return;
      }
      const snap = await getDocs(query(collection(db, "reflections"), where("sekolah", "==", guruSekolah)));
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setGuruReflections(list);
    } catch (e) {}
    setGuruReflectionsLoading(false);
  }

  useEffect(() => {
    if (mode === "app" && profile?.role === "guru" && guruTab === "refleksi") loadGuruReflections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile, guruTab]);

  // Simpan posisi halaman terakhir (screen aktif) ke localStorage supaya kalau halaman di-refresh,
  // siswa/guru tetap berada di halaman yang sama, bukan kembali ke Dashboard. Layar transien
  // (diagnosis, hint, ujianSoal, dll.) sengaja dilewati — lihat NAV_RESTORABLE_SCREENS.
  useEffect(() => {
    if (!authUser || !profile) return;
    if (!NAV_RESTORABLE_SCREENS.has(screen)) return;
    saveNavState(authUser.uid, { screen, activeConcept, guruTab });
  }, [screen, activeConcept, guruTab, authUser, profile]);

  // ---------- Kunci laman ujian & latihan: mencegah siswa keluar/berpindah selama pengerjaan berlangsung ----------
  useEffect(() => {
    const locked = examLocked || latihanLocked;
    if (!locked) return;
    const markViolation = () => { if (examLocked) setExamViolations((v) => v + 1); else setLatihanViolations((v) => v + 1); };
    const showWarning = () => { if (examLocked) setExamLeaveWarning(true); else setLatihanLeaveWarning(true); };

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = examLocked ? "Ujian sedang berlangsung. Yakin ingin meninggalkan halaman ini?" : "Latihan sedang berlangsung. Yakin ingin meninggalkan halaman ini?";
      return e.returnValue;
    };
    const handleVisibility = () => {
      if (document.hidden) { markViolation(); showWarning(); }
    };
    const handleBlur = () => { showWarning(); };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) { markViolation(); showWarning(); }
    };
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase();
      // Blokir shortcut umum untuk keluar/refresh/buka tab baru (sebatas yang bisa dicegah browser via JS)
      if (
        k === "f5" ||
        k === "f11" ||
        ((e.ctrlKey || e.metaKey) && ["r", "w", "t", "n"].includes(k))
      ) {
        e.preventDefault();
      }
    };
    // Trik agar tombol "kembali" browser tidak langsung membawa siswa keluar dari halaman ujian/latihan
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      showWarning();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [examLocked, latihanLocked]);

  function resumeExamAfterWarning() {
    setExamLeaveWarning(false);
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } catch (e) {}
  }

  function resumeLatihanAfterWarning() {
    setLatihanLeaveWarning(false);
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } catch (e) {}
  }

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
    const pool = EFFECTIVE_POOL[next] || [];
    const doneCount = (completedQ[next] || []).length;
    if (pool.length > 0 && doneCount < pool.length) {
      setLatihanLocked(true);
      setLatihanLeaveWarning(false);
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      } catch (e) {}
    }
  }

  function openLatihanFor(concept) {
    setActiveConcept(concept);
    setSelected(null);
    setDiag(null);
    setConsecWrong(0);
    setHintTier(0);
    setScreen("latihan");
    const pool = EFFECTIVE_POOL[concept] || [];
    const doneCount = (completedQ[concept] || []).length;
    if (pool.length > 0 && doneCount < pool.length) {
      setLatihanLocked(true);
      setLatihanLeaveWarning(false);
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      } catch (e) {}
    }
  }

  function currentQ() {
    const pool = EFFECTIVE_POOL[activeConcept] || [];
    if (pool.length === 0) return { text: "Soal untuk konsep ini belum tersedia.", options: [] };
    const idx = (poolIndex[activeConcept] || 0) % pool.length;
    return pool[idx];
  }

  function jumpToQuestion(idx) {
    const done = (completedQ[activeConcept] || []).includes(idx);
    if (done) return; // soal ini sudah dijawab & terkunci, tidak bisa dibuka untuk diedit lagi
    setPoolIndex((p) => ({ ...p, [activeConcept]: idx }));
    setSelected(null);
    setDiag(null);
    setConsecWrong(0);
    setHintTier(0);
    setScreen("latihan");
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
    // Tetap di materi (activeConcept) yang sama — lanjut ke soal berikutnya yang belum
    // dijawab dalam pool yang sama, tidak lompat ke materi lain, supaya latihan fokus
    // per sub-materi. Soal yang baru diselesaikan dikunci agar tidak bisa diubah lagi.
    const pool = EFFECTIVE_POOL[activeConcept] || [];
    const finishedIdx = pool.length ? (poolIndex[activeConcept] || 0) % pool.length : 0;
    const doneSoFar = completedQ[activeConcept] || [];
    const newDone = doneSoFar.includes(finishedIdx) ? doneSoFar : [...doneSoFar, finishedIdx];
    setCompletedQ((c) => ({ ...c, [activeConcept]: newDone }));
    // soal ini terselesaikan lewat jalur salah (3x salah berturut-turut) kalau diag.correct eksplisit false —
    // tandai supaya ditampilkan silang merah, bukan centang hijau, pada peta lompat soal
    const isWrongPath = diag && diag.correct === false;
    if (isWrongPath) {
      setWrongQ((w) => {
        const cur = w[activeConcept] || [];
        return cur.includes(finishedIdx) ? w : { ...w, [activeConcept]: [...cur, finishedIdx] };
      });
    }
    // cari soal berikutnya yang belum dijawab (urut dari setelah soal ini, lalu putar dari awal)
    let nextIdx = null;
    for (let step = 1; step <= pool.length; step++) {
      const cand = (finishedIdx + step) % pool.length;
      if (!newDone.includes(cand)) { nextIdx = cand; break; }
    }
    setPoolIndex((p) => ({ ...p, [activeConcept]: nextIdx !== null ? nextIdx : finishedIdx }));
    setSelected(null);
    setDiag(null);
    setConsecWrong(0);
    setHintTier(0);
    setScreen("latihan");
    if (nextIdx === null) {
      // seluruh soal pada konsep ini sudah terjawab & terkunci — lepaskan kunci sesi latihan
      setLatihanLocked(false);
      setLatihanLeaveWarning(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      } catch (e) {}
    }
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

  function generateExam() {
    // Ambil 1 soal acak dari tiap sub-materi dulu supaya cakupannya merata,
    // baru tambahkan sisanya secara acak dari seluruh bank soal sampai genap 15.
    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
    const onePerConcept = shuffle(
      CONCEPT_ORDER.map((c) => {
        const pool = EFFECTIVE_POOL[c] || [];
        if (pool.length === 0) return null;
        const q = pool[Math.floor(Math.random() * pool.length)];
        return { concept: c, ...q };
      }).filter(Boolean)
    );
    let picked = onePerConcept.slice(0, EXAM_LENGTH);
    if (picked.length < EXAM_LENGTH) {
      const used = new Set(picked.map((q) => q.concept + "|" + q.text));
      const rest = shuffle(
        CONCEPT_ORDER.flatMap((c) => (EFFECTIVE_POOL[c] || []).map((q) => ({ concept: c, ...q }))).filter(
          (q) => !used.has(q.concept + "|" + q.text)
        )
      );
      picked = [...picked, ...rest.slice(0, EXAM_LENGTH - picked.length)];
    }
    picked = shuffle(picked);
    setExamQuestions(picked);
    setExamAnswers(new Array(picked.length).fill(null));
    setExamSaved(new Array(picked.length).fill(false));
    setExamCurrent(0);
    setExamResult(null);
    setExamStartTime(Date.now());
    setExamViolations(0);
    setExamLeaveWarning(false);
    setExamLocked(true);
    setScreen("ujianSoal");
    // Minta mode layar penuh (butuh gestur pengguna, klik tombol "Mulai Ujian" ini memenuhi syarat itu)
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } catch (e) {}
  }

  function selectExamAnswer(i) {
    if (examSaved[examCurrent]) return; // sudah disimpan & dikunci, tidak bisa diubah lagi
    setExamAnswers((a) => { const next = [...a]; next[examCurrent] = i; return next; });
  }

  function saveExamAnswer() {
    if (examAnswers[examCurrent] === null || examAnswers[examCurrent] === undefined) return;
    setExamSaved((s) => { const next = [...s]; next[examCurrent] = true; return next; });
  }

  function examPrev() {
    if (examCurrent > 0) setExamCurrent((c) => c - 1);
  }

  function examNext() {
    if (examCurrent < examQuestions.length - 1) setExamCurrent((c) => c + 1);
    else setScreen("ujianEsai");
  }

  function jumpToExamQuestion(idx) {
    setExamCurrent(idx);
  }

  function finishExam(essaySubmitted) {
    let correct = 0;
    const details = examQuestions.map((q, i) => {
      const ansIdx = examAnswers[i];
      const isCorrect = ansIdx !== null && ansIdx !== undefined && !!q.options[ansIdx]?.correct;
      if (isCorrect) correct++;
      return { concept: q.concept, text: q.text, options: q.options, selected: ansIdx, correct: isCorrect };
    });
    const total = examQuestions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const durationSec = examStartTime ? Math.round((Date.now() - examStartTime) / 1000) : null;
    const result = {
      score, correct, total, date: new Date().toISOString(), details, durationSec, violations: examViolations,
      essaySubmitted: !!essaySubmitted,
    };
    setExamResult(result);
    setExamHistory((h) => [result, ...h].slice(0, 10));
    setExamLocked(false);
    setExamLeaveWarning(false);
    setExamStartTime(null);
    setExamEssayConfirmed(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    } catch (e) {}
    setScreen("ujianHasil");
  }

  function submitExamEssayAndFinish() {
    finishExam(true);
  }

  async function logout() {
    clearNavState(authUser?.uid);
    await signOut(auth);
    setScreen("dashboard");
    setGuruStudents([]);
    setGuruSelectedAttempt(null);
  }

  function startEditProfil() {
    setEditName(profile.name || "");
    setEditKelas(profile.kelas || "");
    setEditSekolah(profile.sekolah || "");
    setEditKelasAjar((profile.kelasAjar || []).join(", "));
    setEditAvatarColor(profile.avatarColor || 0);
    setEditingProfil(true);
  }

  async function saveProfil() {
    if (!editName.trim() || !authUser) return;
    setSavingProfil(true);
    try {
      const updates = { name: editName.trim(), avatarColor: editAvatarColor };
      if (profile.role === "siswa") updates.kelas = editKelas.trim();
      if (profile.role === "guru") {
        updates.sekolah = editSekolah.trim();
        updates.kelasAjar = editKelasAjar.split(",").map((k) => k.trim()).filter(Boolean);
      }
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
      text: `Halo! Berdasarkan progres belajarmu, kamu masih perlu penguatan di konsep "${CONCEPTS[c].name}". ${EFFECTIVE_MATERI[c].penjelasan} Ada bagian yang membingungkan atau mau coba contoh soal bareng?`,
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
    const missingBase = !authEmail.trim() || !authPassword.trim() || (authTab === "daftar" && !authName.trim());
    const missingSiswaFields = authTab === "daftar" && authRole === "siswa" && (!authKelas.trim() || !authSekolah.trim());
    const missingGuruFields = authTab === "daftar" && authRole === "guru" && !authKodeAkses.trim();
    if (missingBase || missingSiswaFields || missingGuruFields) {
      setAuthError("Lengkapi semua kolom terlebih dahulu.");
      return;
    }
    if (authTab === "daftar" && authPassword !== authPassword2) {
      setAuthError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setAuthSubmitting(true);
    try {
      let kodeData = null;
      let kodeNormalized = "";
      if (authTab === "daftar" && authRole === "guru") {
        // Validasi kode akses sekolah SEBELUM membuat akun, supaya guru
        // tanpa kode yang benar tidak bisa mendaftar & tidak ada akun "yatim".
        kodeNormalized = authKodeAkses.trim().toUpperCase();
        const codeSnap = await getDoc(doc(db, "accessCodes", kodeNormalized));
        if (!codeSnap.exists()) {
          setAuthError("Kode akses tidak ditemukan. Periksa kembali kode dari admin sekolah kamu.");
          setAuthSubmitting(false);
          return;
        }
        kodeData = codeSnap.data();
        if (kodeData.active === false) {
          setAuthError("Kode akses ini sudah tidak aktif. Hubungi admin sekolah kamu.");
          setAuthSubmitting(false);
          return;
        }
      }
      if (authTab === "daftar") {
        const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        const uid = cred.user.uid;
        const profileData = { name: authName.trim(), role: authRole, email: authEmail.trim() };
        if (authRole === "siswa") { profileData.kelas = authKelas.trim(); profileData.sekolah = authSekolah.trim(); }
        if (authRole === "guru") {
          // Sekolah & mata pelajaran diambil dari kode akses (bukan diketik bebas),
          // supaya guru hanya bisa terdaftar pada sekolah & mapel sesuai kodenya.
          profileData.sekolah = kodeData.sekolah;
          profileData.mapel = kodeData.mapel;
          profileData.kodeAkses = kodeNormalized;
          profileData.kelasAjar = authKelasAjar.split(",").map((k) => k.trim()).filter(Boolean);
        }
        await setDoc(doc(db, "users", uid), profileData);
        if (authRole === "siswa") {
          await setDoc(doc(db, "progress", uid), { attempts: EMPTY_ATTEMPTS, misconceptions: [], poolIndex: EMPTY_POOLIDX });
        }
        if (authRole === "guru") {
          await updateDoc(doc(db, "accessCodes", kodeNormalized), { usedBy: arrayUnion(uid) });
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
      const guruSekolah = (profile?.sekolah || "").trim();
      const guruKelasAjar = profile?.kelasAjar || [];
      if (!guruSekolah) {
        setGuruStudents([]);
        setGuruLoading(false);
        return;
      }
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "siswa"), where("sekolah", "==", guruSekolah)));
      const list = [];
      for (const uDoc of usersSnap.docs) {
        const u = uDoc.data();
        if (guruKelasAjar.length > 0 && !guruKelasAjar.includes(u.kelas)) continue;
        const progSnap = await getDoc(doc(db, "progress", uDoc.id));
        const prog = progSnap.exists() ? progSnap.data() : { attempts: EMPTY_ATTEMPTS, misconceptions: [], examHistory: [] };
        list.push({ uid: uDoc.id, name: u.name || "Siswa", kelas: u.kelas, sekolah: u.sekolah, attempts: prog.attempts || EMPTY_ATTEMPTS, misconceptions: prog.misconceptions || [], examHistory: prog.examHistory || [] });
      }
      setGuruStudents(list);
    } catch (e) {}
    setGuruLoading(false);
  }

  useEffect(() => {
    if (mode === "app" && profile?.role === "guru") loadGuruData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile]);

  async function loadAccessCodes() {
    setCodesLoading(true);
    try {
      const snap = await getDocs(collection(db, "accessCodes"));
      const list = snap.docs.map((d) => ({ code: d.id, ...d.data() }));
      list.sort((a, b) => a.code.localeCompare(b.code));
      setAccessCodes(list);
    } catch (e) {}
    setCodesLoading(false);
  }

  useEffect(() => {
    if (mode === "app" && profile?.role === "guru" && profile?.isAdmin && guruTab === "kodeAkses") loadAccessCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile, guruTab]);

  // ---------- Form Esai: slug sekolah dipakai sebagai ID dokumen settings ----------
  function sekolahSlug(s) {
    return (s || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function isValidGoogleFormLink(link) {
    return /^https:\/\/docs\.google\.com\/forms\//.test(link.trim());
  }

  function isValidDriveFolderLink(link) {
    return /^https:\/\/drive\.google\.com\//.test(link.trim());
  }

  async function loadEssayFormUrl(sekolahName) {
    const slug = sekolahSlug(sekolahName);
    if (!slug) return;
    try {
      const snap = await getDoc(doc(db, "essayFormSettings", slug));
      const data = snap.exists() ? snap.data() : {};
      const url = data.formUrl || "";
      const folderUrl = data.driveFolderUrl || "";
      setEssayFormUrl(url);
      setEssayFormUrlInput(url);
      setEssayDriveFolderUrl(folderUrl);
      setEssayDriveFolderUrlInput(folderUrl);
    } catch (e) {
      // Gagal memuat pengaturan Form -> biarkan kosong
    }
  }

  useEffect(() => {
    if (mode === "app" && profile?.sekolah) loadEssayFormUrl(profile.sekolah);
  }, [mode, profile]);

  async function saveEssayFormUrl() {
    setEssayFormMsg("");
    const url = essayFormUrlInput.trim();
    const folderUrl = essayDriveFolderUrlInput.trim();
    if (url && !isValidGoogleFormLink(url)) {
      setEssayFormMsg("Link Form harus berupa link Google Form yang valid (diawali https://docs.google.com/forms/).");
      return;
    }
    if (folderUrl && !isValidDriveFolderLink(folderUrl)) {
      setEssayFormMsg("Link folder harus berupa link Google Drive yang valid (diawali https://drive.google.com/).");
      return;
    }
    const slug = sekolahSlug(profile?.sekolah);
    if (!slug) {
      setEssayFormMsg("Lengkapi data sekolah di profil kamu terlebih dahulu sebelum mengatur Form.");
      return;
    }
    setEssayFormSaving(true);
    try {
      await setDoc(doc(db, "essayFormSettings", slug), { formUrl: url, driveFolderUrl: folderUrl, sekolah: profile.sekolah, updatedAt: serverTimestamp() }, { merge: true });
      setEssayFormUrl(url);
      setEssayDriveFolderUrl(folderUrl);
      setEssayFormMsg("Pengaturan tersimpan.");
    } catch (e) {
      setEssayFormMsg("Gagal menyimpan. Coba lagi.");
    } finally {
      setEssayFormSaving(false);
    }
  }

  async function createAccessCode() {
    setKodeError("");
    const sekolahSlug = newKodeSekolah.trim().toUpperCase().replace(/\s+/g, "");
    const mapelSlug = newKodeMapelSingkat.trim().toUpperCase().replace(/\s+/g, "");
    const nomor = newKodeNomor.trim();
    if (!sekolahSlug || !mapelSlug || !nomor || !newKodeMapelNama.trim()) {
      setKodeError("Lengkapi semua kolom terlebih dahulu.");
      return;
    }
    const code = `${sekolahSlug}-${mapelSlug}-${nomor}`;
    try {
      const existing = await getDoc(doc(db, "accessCodes", code));
      if (existing.exists()) {
        setKodeError("Kode ini sudah ada. Gunakan nomor kode yang berbeda.");
        return;
      }
      await setDoc(doc(db, "accessCodes", code), {
        sekolah: newKodeSekolah.trim(),
        mapel: newKodeMapelNama.trim(),
        mapelSingkat: mapelSlug,
        kodeMapel: nomor,
        active: true,
        createdAt: serverTimestamp(),
        usedBy: [],
      });
      setNewKodeSekolah(""); setNewKodeMapelNama(""); setNewKodeMapelSingkat(""); setNewKodeNomor("");
      loadAccessCodes();
    } catch (e) {
      setKodeError("Gagal membuat kode akses. Coba lagi.");
    }
  }

  async function toggleAccessCode(code, currentActive) {
    try {
      await updateDoc(doc(db, "accessCodes", code), { active: !currentActive });
      loadAccessCodes();
    } catch (e) {}
  }

  function loadConceptEditor(c) {
    setCcSelectedConcept(c);
    const m = EFFECTIVE_MATERI[c];
    setCcFormula((m.formula || []).join("\n"));
    setCcPenjelasan(m.penjelasan || "");
    setCcContoh((m.contoh || []).join("\n"));
    setCcEditingIdx(null);
    setCcMsg("");
  }

  async function saveConceptMateri() {
    setCcSaving(true);
    setCcMsg("");
    const payload = {
      formula: ccFormula.split("\n").map((s) => s.trim()).filter(Boolean),
      penjelasan: ccPenjelasan.trim(),
      contoh: ccContoh.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    try {
      await setDoc(doc(db, "contentOverrides", ccSelectedConcept), payload, { merge: true });
      setContentOverrides((o) => ({ ...o, [ccSelectedConcept]: { ...o[ccSelectedConcept], ...payload } }));
      setCcMsg("Materi tersimpan.");
    } catch (e) {
      setCcMsg("Gagal menyimpan materi. Coba lagi.");
    }
    setCcSaving(false);
  }

  function startAddQuestion() {
    setCcEditingIdx("new");
    setCcQDifficulty("sedang");
    setCcQText("");
    setCcQOptions(["", "", "", "", ""]);
    setCcQCorrect(0);
    setCcQTags(["", "", "", "", ""]);
    setCcMsg("");
  }

  function startEditQuestion(idx) {
    const q = (EFFECTIVE_POOL[ccSelectedConcept] || [])[idx];
    if (!q) return;
    setCcEditingIdx(idx);
    setCcQDifficulty(q.difficulty || "sedang");
    setCcQText(q.text || "");
    setCcQOptions(q.options.map((o) => o.text || ""));
    const correctIdx = q.options.findIndex((o) => o.correct);
    setCcQCorrect(correctIdx >= 0 ? correctIdx : 0);
    setCcQTags(q.options.map((o) => o.tag || ""));
    setCcMsg("");
  }

  async function saveQuestion() {
    if (!ccQText.trim() || ccQOptions.some((o) => !o.trim())) {
      setCcMsg("Lengkapi teks soal dan kelima pilihan jawaban terlebih dahulu.");
      return;
    }
    const newQ = {
      difficulty: ccQDifficulty,
      text: ccQText.trim(),
      options: ccQOptions.map((t, i) =>
        i === ccQCorrect ? { text: t.trim(), correct: true } : { text: t.trim(), tag: (ccQTags[i] || "").trim() || "Jawaban kurang tepat." }
      ),
    };
    const currentList = [...(EFFECTIVE_POOL[ccSelectedConcept] || [])];
    if (ccEditingIdx === "new") currentList.push(newQ);
    else currentList[ccEditingIdx] = newQ;
    setCcSaving(true);
    setCcMsg("");
    try {
      await setDoc(doc(db, "contentOverrides", ccSelectedConcept), { questions: currentList }, { merge: true });
      setContentOverrides((o) => ({ ...o, [ccSelectedConcept]: { ...o[ccSelectedConcept], questions: currentList } }));
      setCcEditingIdx(null);
      setCcMsg("Soal tersimpan.");
    } catch (e) {
      setCcMsg("Gagal menyimpan soal. Coba lagi.");
    }
    setCcSaving(false);
  }

  async function deleteQuestion(idx) {
    const currentList = [...(EFFECTIVE_POOL[ccSelectedConcept] || [])];
    currentList.splice(idx, 1);
    setCcSaving(true);
    setCcMsg("");
    try {
      await setDoc(doc(db, "contentOverrides", ccSelectedConcept), { questions: currentList }, { merge: true });
      setContentOverrides((o) => ({ ...o, [ccSelectedConcept]: { ...o[ccSelectedConcept], questions: currentList } }));
      setCcMsg("Soal dihapus.");
    } catch (e) {
      setCcMsg("Gagal menghapus soal. Coba lagi.");
    }
    setCcSaving(false);
  }

  useEffect(() => {
    if (mode === "app" && profile?.role === "guru" && contentLoaded) loadConceptEditor(ccSelectedConcept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile, contentLoaded]);

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
  const guruChartData = useMemo(() => (
    CONCEPT_ORDER.map((c) => {
      const m = guruConceptMastery(c);
      return { name: CONCEPTS[c].short, fullName: CONCEPTS[c].name, pct: m !== null ? Math.round(m * 100) : 0, hasData: m !== null };
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [guruFilteredStudents]);
  const guruDistribusi = useMemo(() => {
    let baik = 0, cukup = 0, kurang = 0, belum = 0;
    CONCEPT_ORDER.forEach((c) => {
      const m = guruConceptMastery(c);
      if (m === null) belum++;
      else if (m * 100 >= 75) baik++;
      else if (m * 100 >= 40) cukup++;
      else kurang++;
    });
    return [
      { name: "Baik (≥75%)", value: baik, color: GURU_PALETTE.strong },
      { name: "Cukup (40–74%)", value: cukup, color: GURU_PALETTE.mid },
      { name: "Kurang (<40%)", value: kurang, color: GURU_PALETTE.soft },
      { name: "Belum diuji", value: belum, color: GURU_PALETTE.pale },
    ].filter((d) => d.value > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guruFilteredStudents]);
  const allMisconceptions = useMemo(
    () => guruFilteredStudents.flatMap((s) => (s.misconceptions || []).map((m) => ({ ...m, student: s.name }))),
    [guruFilteredStudents]
  );
  const guruExamAttempts = useMemo(
    () =>
      guruFilteredStudents
        .flatMap((s) => (s.examHistory || []).map((h) => ({ ...h, student: s.name, kelas: s.kelas })))
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [guruFilteredStudents]
  );
  const guruAvgDurationSec = useMemo(() => {
    const withDuration = guruExamAttempts.filter((h) => h.durationSec !== null && h.durationSec !== undefined);
    if (withDuration.length === 0) return null;
    return Math.round(withDuration.reduce((a, h) => a + h.durationSec, 0) / withDuration.length);
  }, [guruExamAttempts]);

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

      {((examLocked && examLeaveWarning) || (latihanLocked && latihanLeaveWarning)) && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(30,27,51,0.92)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div className="card" style={{ maxWidth: 380, textAlign: "center" }}>
            <AlertTriangle size={30} style={{ color: "var(--rose)", marginBottom: 10 }} />
            <h2 className="disp" style={{ fontSize: 17, marginBottom: 8 }}>{examLocked ? "Ujian Sedang Berlangsung" : "Latihan Sedang Berlangsung"}</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              Terdeteksi kamu mencoba meninggalkan atau berpindah dari laman {examLocked ? "ujian" : "latihan"}. Laman ini terkunci sampai kamu menyelesaikan seluruh soal. Klik tombol di bawah untuk kembali mengerjakan.
            </p>
            <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={examLocked ? resumeExamAfterWarning : resumeLatihanAfterWarning}>
              Kembali Mengerjakan <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {profile?.role === "guru" && guruSelectedAttempt && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(30,27,51,0.72)", zIndex: 9998,
          display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "30px 16px", overflowY: "auto",
        }} onClick={(e) => { if (e.target === e.currentTarget) setGuruSelectedAttempt(null); }}>
          <div className="card" style={{ maxWidth: 640, width: "100%", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
              <div>
                <div className="tag-eyebrow">Jawaban Ujian — {guruSelectedAttempt.student}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {guruSelectedAttempt.kelas ? `Kelas ${guruSelectedAttempt.kelas} · ` : ""}
                  {new Date(guruSelectedAttempt.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <button className="btn-ghost" style={{ padding: 7 }} onClick={() => setGuruSelectedAttempt(null)} title="Tutup">✕</button>
            </div>

            <div className="hero-card" style={{ margin: "14px 0 18px", textAlign: "center" }}>
              <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>Skor</div>
              <div className="disp" style={{ fontSize: 34, margin: "6px 0" }}>{guruSelectedAttempt.score}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                {guruSelectedAttempt.correct} dari {guruSelectedAttempt.total} soal benar · Waktu pengerjaan: {formatDuration(guruSelectedAttempt.durationSec)}
              </div>
            </div>

            {guruSelectedAttempt.essaySubmitted && (
              <div className="card" style={{ marginBottom: 16, background: "var(--brand-light)", border: "1px solid var(--brand)" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: "var(--brand-dark)" }}>Jawaban Esai Dikirim via Google Form</div>
                <div style={{ fontSize: 12, color: "var(--brand-dark)", marginBottom: essayDriveFolderUrl ? 10 : 0 }}>
                  Siswa mengonfirmasi sudah mengunggah jawaban esai. Cari file-nya berdasarkan nama siswa &amp; tanggal ujian.
                </div>
                {essayDriveFolderUrl && (
                  <a href={essayDriveFolderUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: "inline-flex" }}>
                    Buka Folder Drive Jawaban <ArrowRight size={15} />
                  </a>
                )}
              </div>
            )}

            <div className="tag-eyebrow" style={{ marginBottom: 8 }}>Rincian Jawaban</div>
            {guruSelectedAttempt.details.map((d, i) => (
              <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < guruSelectedAttempt.details.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }} className="mono">Soal {i + 1} · {CONCEPTS[d.concept].name}</div>
                <div style={{ fontSize: 15, marginBottom: 10 }}><MathText text={d.text} /></div>
                {d.options.map((opt, oi) => {
                  const isCorrectOpt = !!opt.correct;
                  const isSelected = d.selected === oi;
                  const style = isCorrectOpt
                    ? { borderColor: "var(--teal)", background: "var(--teal-light)" }
                    : isSelected
                    ? { borderColor: "var(--rose)", background: "var(--rose-light)" }
                    : {};
                  return (
                    <div key={oi} className="opt" style={{ ...style, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <MathText text={opt.text} />
                      {isCorrectOpt && <CheckCircle2 size={15} style={{ color: "var(--teal)", flexShrink: 0 }} />}
                      {isSelected && !isCorrectOpt && <AlertTriangle size={15} style={{ color: "var(--rose)", flexShrink: 0 }} />}
                    </div>
                  );
                })}
                {(d.selected === null || d.selected === undefined) && <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 2 }}>Tidak dijawab.</div>}
              </div>
            ))}

            <button className="btn-primary" onClick={() => setGuruSelectedAttempt(null)}>Tutup</button>
          </div>
        </div>
      )}

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
                {authRole === "guru" && (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <input
                        type="text"
                        placeholder="Kode akses (contoh: SMAN5-MAT-003)"
                        value={authKodeAkses}
                        onChange={(e) => setAuthKodeAkses(e.target.value.toUpperCase())}
                        style={{ textTransform: "uppercase" }}
                      />
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
                      Kode akses didapat dari admin sekolah kamu. Kode ini menentukan sekolah &amp; mata pelajaran akunmu secara otomatis.
                    </div>
                    <div style={{ marginBottom: 4 }}><input type="text" placeholder="Kelas yang diajar, pisahkan koma (contoh: X-A, X-B)" value={authKelasAjar} onChange={(e) => setAuthKelasAjar(e.target.value)} /></div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>Kosongkan jika ingin melihat semua kelas di sekolah ini.</div>
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
          <aside className="sidebar" style={(examLocked || latihanLocked) ? { pointerEvents: "none", opacity: 0.45 } : undefined}>
            <div className="sidebar-brand brand"><GraduationCap size={20} /> AC-ITS</div>

            {profile.role === "siswa" && (
              <nav className="sidebar-nav">
                <button className={"sidebar-navbtn" + (screen === "dashboard" ? " active" : "")} onClick={() => setScreen("dashboard")}><LayoutDashboard size={17} />Dashboard</button>
                <button className={"sidebar-navbtn" + (screen === "tutorAI" ? " active" : "")} onClick={() => { setTutorFocusConcept(null); setScreen("tutorAI"); }}><MessageCircle size={17} />Tutor AI</button>
                <button className={"sidebar-navbtn" + (screen === "materiList" || screen === "materi" ? " active" : "")} onClick={() => setScreen("materiList")}><BookOpen size={17} />Materi</button>
                <button className={"sidebar-navbtn" + (screen === "latihanList" || screen === "latihan" || screen === "diagnosis" || screen === "hint" ? " active" : "")} onClick={() => setScreen("latihanList")}><PenLine size={17} />Latihan</button>
                <button className={"sidebar-navbtn" + (screen === "ujian" || screen === "ujianSoal" || screen === "ujianEsai" || screen === "ujianHasil" ? " active" : "")} onClick={() => setScreen("ujian")}><ClipboardList size={17} />Ujian</button>
                <button className={"sidebar-navbtn" + (screen === "progress" ? " active" : "")} onClick={() => setScreen("progress")}><TrendingUp size={17} />Progress</button>
                <button className={"sidebar-navbtn" + (screen === "leaderboard" ? " active" : "")} onClick={() => setScreen("leaderboard")}><Trophy size={17} />Peringkat</button>
                <button className={"sidebar-navbtn" + (screen === "badges" ? " active" : "")} onClick={() => setScreen("badges")}><Award size={17} />Koleksi Badge</button>
                <button className={"sidebar-navbtn" + (screen === "refleksi" ? " active" : "")} onClick={() => setScreen("refleksi")}><MessageCircle size={17} />Refleksi</button>
                <button className={"sidebar-navbtn" + (screen === "profil" ? " active" : "")} onClick={() => setScreen("profil")}><User size={17} />Profil</button>
              </nav>
            )}

            {profile.role === "guru" && (
              <nav className="sidebar-nav">
                <button className={"sidebar-navbtn" + (guruTab === "beranda" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("beranda"); setScreen("dashboard"); }}><LayoutDashboard size={17} />Beranda</button>
                <button className={"sidebar-navbtn" + (guruTab === "analitik" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("analitik"); setScreen("dashboard"); }}><TrendingUp size={17} />Analitik</button>
                <button className={"sidebar-navbtn" + (guruTab === "ujian" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("ujian"); setGuruSelectedAttempt(null); setScreen("dashboard"); }}><Clock size={17} />Jawaban &amp; Waktu Ujian</button>
                <button className={"sidebar-navbtn" + (guruTab === "materi" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("materi"); setScreen("dashboard"); }}><Database size={17} />Knowledge Base</button>
                <button className={"sidebar-navbtn" + (guruTab === "kelolaKonten" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("kelolaKonten"); setScreen("dashboard"); }}><PenLine size={17} />Kelola Materi &amp; Soal</button>
                <button className={"sidebar-navbtn" + (guruTab === "refleksi" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("refleksi"); setScreen("dashboard"); }}><MessageCircle size={17} />Refleksi Siswa</button>
                {profile.isAdmin && (
                  <button className={"sidebar-navbtn" + (guruTab === "kodeAkses" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("kodeAkses"); setScreen("dashboard"); }}><LockIcon size={17} />Kode Akses</button>
                )}
                <button className={"sidebar-navbtn" + (screen === "profil" ? " active" : "")} onClick={() => { setScreen("profil"); startEditProfil(); }}><User size={17} />Profil</button>
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
            <nav className="floating-nav" style={(examLocked || latihanLocked) ? { pointerEvents: "none", opacity: 0.45 } : undefined}>
              <button className={"sidebar-navbtn" + (screen === "dashboard" ? " active" : "")} onClick={() => setScreen("dashboard")}><LayoutDashboard size={17} />Home</button>
              <button className={"sidebar-navbtn" + (screen === "tutorAI" ? " active" : "")} onClick={() => { setTutorFocusConcept(null); setScreen("tutorAI"); }}><MessageCircle size={17} />Tutor</button>
              <button className={"sidebar-navbtn" + (screen === "materiList" || screen === "materi" ? " active" : "")} onClick={() => setScreen("materiList")}><BookOpen size={17} />Materi</button>
              <button className={"sidebar-navbtn" + (screen === "latihanList" || screen === "latihan" || screen === "diagnosis" || screen === "hint" ? " active" : "")} onClick={() => setScreen("latihanList")}><PenLine size={17} />Latihan</button>
              <button className={"sidebar-navbtn" + (screen === "ujian" || screen === "ujianSoal" || screen === "ujianEsai" || screen === "ujianHasil" ? " active" : "")} onClick={() => setScreen("ujian")}><ClipboardList size={17} />Ujian</button>
              <button className={"sidebar-navbtn" + (screen === "progress" ? " active" : "")} onClick={() => setScreen("progress")}><TrendingUp size={17} />Progress</button>
              <button className={"sidebar-navbtn" + (screen === "leaderboard" ? " active" : "")} onClick={() => setScreen("leaderboard")}><Trophy size={17} />Rank</button>
              <button className={"sidebar-navbtn" + (screen === "badges" ? " active" : "")} onClick={() => setScreen("badges")}><Award size={17} />Badge</button>
              <button className={"sidebar-navbtn" + (screen === "refleksi" ? " active" : "")} onClick={() => setScreen("refleksi")}><MessageCircle size={17} />Refleksi</button>
              <button className={"sidebar-navbtn" + (screen === "profil" ? " active" : "")} onClick={() => setScreen("profil")}><User size={17} />Profil</button>
            </nav>
          )}
          {profile.role === "guru" && (
            <nav className="floating-nav">
              <button className={"sidebar-navbtn" + (guruTab === "beranda" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("beranda"); setScreen("dashboard"); }}><LayoutDashboard size={17} />Beranda</button>
              <button className={"sidebar-navbtn" + (guruTab === "analitik" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("analitik"); setScreen("dashboard"); }}><TrendingUp size={17} />Analitik</button>
              <button className={"sidebar-navbtn" + (guruTab === "ujian" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("ujian"); setGuruSelectedAttempt(null); setScreen("dashboard"); }}><Clock size={17} />Jawaban</button>
              <button className={"sidebar-navbtn" + (guruTab === "materi" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("materi"); setScreen("dashboard"); }}><Database size={17} />KB</button>
              <button className={"sidebar-navbtn" + (guruTab === "kelolaKonten" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("kelolaKonten"); setScreen("dashboard"); }}><PenLine size={17} />Kelola Konten</button>
              <button className={"sidebar-navbtn" + (guruTab === "refleksi" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("refleksi"); setScreen("dashboard"); }}><MessageCircle size={17} />Refleksi</button>
              {profile.isAdmin && (
                <button className={"sidebar-navbtn" + (guruTab === "kodeAkses" && screen !== "profil" ? " active" : "")} onClick={() => { setGuruTab("kodeAkses"); setScreen("dashboard"); }}><LockIcon size={17} />Kode Akses</button>
              )}
              <button className={"sidebar-navbtn" + (screen === "profil" ? " active" : "")} onClick={() => { setScreen("profil"); startEditProfil(); }}><User size={17} />Profil</button>
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
                          ? "Siswa sedang butuh pendalaman khusus pada konsep: " + CONCEPTS[tutorFocusConcept].name + " (" + EFFECTIVE_MATERI[tutorFocusConcept].penjelasan + "). Fokuskan bantuanmu ke konsep ini."
                          : "Saat ini siswa sedang fokus pada konsep: " + CONCEPTS[activeConcept].name + " (" + EFFECTIVE_MATERI[activeConcept].penjelasan + ").")
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
                    {activeConcept === "E11" ? (
                      <>
                        <div className="basic-formula-box">
                          <div className="basic-label">BENTUK DASAR</div>
                          <MathText text="a^{f(x)} = a^{P}" />
                          <div className="basic-condition">(a &gt; 0, P konstanta)</div>
                          <div className="basic-result"><MathText text="⇒ f(x)=P" /></div>
                        </div>
                        <div className="qtext">
                          {EFFECTIVE_MATERI[activeConcept].formula.slice(1).map((f, i) => <MathText key={i} text={f} />)}
                        </div>
                      </>
                    ) : (
                      <div className="qtext">
                        {EFFECTIVE_MATERI[activeConcept].formula.map((f, i) => <MathText key={i} text={f} />)}
                      </div>
                    )}
                    <p style={{ fontSize: 14, lineHeight: 1.6 }}><MathText text={EFFECTIVE_MATERI[activeConcept].penjelasan} /></p>
                    <div style={{ marginTop: 14 }}>
                      <div className="tag-eyebrow" style={{ marginBottom: 8 }}>Contoh</div>
                      {EFFECTIVE_MATERI[activeConcept].contoh.map((line, i) => (
                        <div key={i} className="math-box"><MathText text={line} /></div>
                      ))}
                    </div>
                    {activeConcept === "E10" && <ExpFunctionCharts />}
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
                        <button key={c} onClick={() => { setRedirectNote(null); openLatihanFor(c); }}
                          style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: 14, borderRadius: 14, border: "1.5px solid var(--line)", marginBottom: 10, background: "white" }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--brand-light)", color: "var(--brand-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: 12.5 }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{CONCEPTS[c].name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)" }} className="mono">{CONCEPTS[c].short} · {EFFECTIVE_POOL[c].length} soal tersedia</div>
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

                    {(EFFECTIVE_POOL[activeConcept] || []).length > 1 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 7 }}>
                          Lompat ke soal yang belum dijawab — <span style={{ color: "#0F7A56" }}>hijau = benar &amp; terkunci</span>, <span style={{ color: "var(--rose)" }}>merah = salah 3x &amp; terkunci</span>:
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {EFFECTIVE_POOL[activeConcept].map((_, i) => {
                            const isCurrent = (poolIndex[activeConcept] || 0) % EFFECTIVE_POOL[activeConcept].length === i;
                            const isDone = (completedQ[activeConcept] || []).includes(i);
                            const isWrong = isDone && (wrongQ[activeConcept] || []).includes(i);
                            return (
                              <button key={i} onClick={() => jumpToQuestion(i)} disabled={isDone}
                                style={{
                                  width: 30, height: 30, borderRadius: 9, fontSize: 12.5, fontWeight: 700,
                                  border: isCurrent ? "1.5px solid var(--brand)" : isWrong ? "1.5px solid var(--rose)" : isDone ? "1.5px solid var(--teal)" : "1.5px solid var(--line)",
                                  background: isCurrent ? "var(--brand)" : isWrong ? "var(--rose-light)" : isDone ? "var(--teal-light)" : "white",
                                  color: isCurrent ? "white" : isWrong ? "var(--rose)" : isDone ? "#0F7A56" : "var(--ink)",
                                  cursor: isDone ? "not-allowed" : "pointer",
                                }}>
                                {isWrong ? <XCircle size={14} /> : isDone ? <CheckCircle2 size={14} /> : i + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(completedQ[activeConcept] || []).length >= (EFFECTIVE_POOL[activeConcept] || []).length && (EFFECTIVE_POOL[activeConcept] || []).length > 0 ? (
                      <div className="ok-box"><CheckCircle2 size={18} /> Semua soal pada sub-materi ini sudah kamu selesaikan &amp; terkunci. Pilih sub-materi lain di menu Latihan.</div>
                    ) : (
                      <>
                        <div className="qtext"><MathText text={currentQ().text} /></div>
                        {currentQ().options.map((opt, i) => (
                          <button key={i} className={"opt" + (selected === i ? " picked" : "")} onClick={() => setSelected(i)}><MathText text={opt.text} /></button>
                        ))}
                        <div style={{ marginTop: 14 }}><button className="btn-primary" disabled={selected === null} onClick={submitAnswer}>Periksa Jawaban <ArrowRight size={15} /></button></div>
                      </>
                    )}
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
                        <div style={{ fontSize: 13.5, marginBottom: 6 }}><b>Diagnosis sistem:</b> {diag.tag ? <>Terdeteksi kemungkinan miskonsepsi "<MathText text={diag.tag} />".</> : "Jawaban belum tepat, belum ada pola miskonsepsi spesifik yang cocok."}</div>
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
                        {hintTier === 1 && <MathText text={HINTS[activeConcept].t1} />}
                        {hintTier === 2 && <MathText text={HINTS[activeConcept].t2} />}
                        {hintTier === 3 && <MathText text={HINTS[activeConcept].full} />}
                        {hintTier === 3 && <div style={{ marginTop: 8, fontWeight: 600 }}>Konsep ini ditandai butuh remedial.</div>}
                      </div>
                    </div>
                    <button className="btn-primary" onClick={afterHint}>{hintTier === 3 ? "Mengerti, Lanjut" : "Mengerti, Coba Lagi"} <ArrowRight size={15} /></button>
                  </div>
                )}

                {progressLoaded && screen === "ujian" && (
                  <div className="card">
                    <div className="tag-eyebrow">Ujian</div>
                    <h2 className="disp" style={{ fontSize: 19, marginBottom: 4 }}>Uji Kemampuanmu</h2>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>
                      {EXAM_LENGTH} soal pilihan ganda diambil acak dari seluruh sub-materi eksponen. Tanpa hint atau petunjuk — murni untuk mengetes kemampuanmu. Hasil lengkap muncul di akhir dan tidak memengaruhi progress belajar di menu Latihan.
                    </p>
                    <button className="btn-primary" onClick={generateExam}><ClipboardList size={15} /> Mulai Ujian ({EXAM_LENGTH} Soal)</button>

                    {examHistory.length > 0 && (
                      <div style={{ marginTop: 22 }}>
                        <div className="tag-eyebrow">Riwayat Ujian</div>
                        {examHistory.map((h, i) => {
                          const tone = h.score >= 75 ? "good" : h.score >= 50 ? "warn" : "bad";
                          return (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < examHistory.length - 1 ? "1px solid var(--line)" : "none" }}>
                              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                                {new Date(h.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="pill" style={{ background: toneColor[tone] + "22", color: toneColor[tone] }}>{h.correct}/{h.total} · {h.score}%</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {progressLoaded && screen === "ujianSoal" && examQuestions.length > 0 && (
                  <div className="card">
                    <div className="tag-eyebrow">Ujian · Soal {examCurrent + 1} dari {examQuestions.length} · Tersimpan: {examSaved.filter(Boolean).length}/{examQuestions.length}</div>
                    <div className="bar-track" style={{ marginBottom: 14 }}><div className="bar-fill" style={{ width: `${(examSaved.filter(Boolean).length / examQuestions.length) * 100}%` }} /></div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 7 }}>
                        Lompat ke soal — <span style={{ color: "#0F7A56" }}>hijau = tersimpan &amp; terkunci</span>, <span style={{ color: "#B87A0B" }}>kuning = sudah dipilih, belum disimpan</span>:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {examQuestions.map((_, i) => {
                          const isCurrent = examCurrent === i;
                          const isSaved = !!examSaved[i];
                          const isPicked = examAnswers[i] !== null && examAnswers[i] !== undefined;
                          const bg = isSaved ? "var(--teal-light)" : isPicked ? "var(--amber-light)" : "white";
                          const color = isSaved ? "#0F7A56" : isPicked ? "#B87A0B" : "var(--ink)";
                          const border = isCurrent ? "1.5px solid var(--brand)" : isSaved ? "1.5px solid var(--teal)" : isPicked ? "1.5px solid var(--amber)" : "1.5px solid var(--line)";
                          return (
                            <button key={i} onClick={() => jumpToExamQuestion(i)}
                              style={{ width: 30, height: 30, borderRadius: 9, fontSize: 12.5, fontWeight: 700, border, background: isCurrent ? "var(--brand)" : bg, color: isCurrent ? "white" : color }}>
                              {i + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="qtext"><MathText text={examQuestions[examCurrent].text} /></div>
                    {examQuestions[examCurrent].options.map((opt, i) => (
                      <button
                        key={i}
                        className={"opt" + (examAnswers[examCurrent] === i ? " picked" : "")}
                        onClick={() => selectExamAnswer(i)}
                        disabled={!!examSaved[examCurrent]}
                        style={examSaved[examCurrent] ? { opacity: examAnswers[examCurrent] === i ? 1 : 0.5, cursor: "not-allowed" } : undefined}
                      >
                        <MathText text={opt.text} />
                      </button>
                    ))}

                    {examSaved[examCurrent] ? (
                      <div style={{ fontSize: 12.5, color: "#0F7A56", fontWeight: 600, margin: "6px 0 4px" }}><CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> Jawaban tersimpan &amp; terkunci, tidak bisa diubah lagi.</div>
                    ) : (
                      <div style={{ marginTop: 10 }}>
                        <button className="btn-primary" disabled={examAnswers[examCurrent] === null || examAnswers[examCurrent] === undefined} onClick={saveExamAnswer}>
                          <CheckCircle2 size={15} /> Simpan Jawaban
                        </button>
                      </div>
                    )}

                    {examCurrent === examQuestions.length - 1 && examSaved.filter(Boolean).length < examQuestions.length && (
                      <div style={{ fontSize: 12.5, color: "#B87A0B", marginTop: 10 }}>
                        <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Masih ada {examQuestions.length - examSaved.filter(Boolean).length} soal yang belum disimpan.
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      <button className="btn-ghost" disabled={examCurrent === 0} onClick={examPrev}><ArrowLeft size={15} /> Kembali</button>
                      <button className="btn-primary" onClick={examNext}>
                        {examCurrent === examQuestions.length - 1 ? <>Lanjut Kirim Jawaban <ArrowRight size={15} /></> : <>Selanjutnya <ArrowRight size={15} /></>}
                      </button>
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "ujianEsai" && (
                  <div className="card">
                    <div className="tag-eyebrow">Kirim Jawaban Tulis Tangan (Wajib)</div>
                    <h2 className="disp" style={{ fontSize: 17, marginBottom: 8 }}>Unggah jawaban tulis tangan kamu</h2>
                    {essayFormUrl ? (
                      <>
                        <p style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 14 }}>
                          Kerjakan soal esai/uraian di kertas, foto/scan hasilnya, lalu unggah lewat Google Form di bawah ini (bukan Drive pribadimu) — jawabanmu langsung masuk ke Drive guru dan siswa lain tidak bisa melihat jawabanmu. Ujian belum bisa diselesaikan sebelum kamu mengunggah jawaban lewat Form ini.
                        </p>
                        <div style={{ marginBottom: 14 }}>
                          <a href={essayFormUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: "inline-flex" }}>
                            Buka Form &amp; Unggah Jawaban <ArrowRight size={15} />
                          </a>
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
                          <input type="checkbox" checked={examEssayConfirmed} onChange={(e) => setExamEssayConfirmed(e.target.checked)} style={{ width: "auto" }} />
                          Saya sudah mengunggah jawaban tulis tangan lewat Form tersebut.
                        </label>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button className="btn-primary" disabled={!examEssayConfirmed} onClick={submitExamEssayAndFinish}>
                            Selesaikan Ujian <ArrowRight size={15} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="err-box"><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> Gurumu belum mengatur link Google Form untuk unggah jawaban tulis tangan. Ujian belum bisa diselesaikan — hubungi gurumu supaya link Form ini segera diatur.</div>
                      </>
                    )}
                  </div>
                )}

                {progressLoaded && screen === "ujianHasil" && examResult && (
                  <div className="card">
                    <div className="tag-eyebrow">Hasil Ujian</div>
                    <div className="hero-card" style={{ marginBottom: 18, textAlign: "center" }}>
                      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>Skor Kamu</div>
                      <div className="disp" style={{ fontSize: 42, margin: "6px 0" }}>{examResult.score}</div>
                      <div style={{ fontSize: 13.5, opacity: 0.9 }}>{examResult.correct} dari {examResult.total} soal benar</div>
                    </div>

                    <div className="tag-eyebrow" style={{ marginBottom: 8 }}>Pembahasan</div>
                    {examResult.details.map((d, i) => (
                      <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < examResult.details.length - 1 ? "1px solid var(--line)" : "none" }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }} className="mono">Soal {i + 1} · {CONCEPTS[d.concept].name}</div>
                        <div style={{ fontSize: 15, marginBottom: 10 }}><MathText text={d.text} /></div>
                        {d.options.map((opt, oi) => {
                          const isCorrectOpt = !!opt.correct;
                          const isSelected = d.selected === oi;
                          const style = isCorrectOpt
                            ? { borderColor: "var(--teal)", background: "var(--teal-light)" }
                            : isSelected
                            ? { borderColor: "var(--rose)", background: "var(--rose-light)" }
                            : {};
                          return (
                            <div key={oi} className="opt" style={{ ...style, cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <MathText text={opt.text} />
                              {isCorrectOpt && <CheckCircle2 size={15} style={{ color: "var(--teal)", flexShrink: 0 }} />}
                              {isSelected && !isCorrectOpt && <AlertTriangle size={15} style={{ color: "var(--rose)", flexShrink: 0 }} />}
                            </div>
                          );
                        })}
                        {(d.selected === null || d.selected === undefined) && <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 2 }}>Tidak dijawab.</div>}
                      </div>
                    ))}

                    <button className="btn-primary" onClick={() => setScreen("ujian")}><ArrowLeft size={15} /> Kembali ke Ujian</button>
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
                        {misconceptions.map((m, i) => <div className="misc-item" key={i}>{CONCEPTS[m.concept].name}: <MathText text={m.tag} /></div>)}
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

                {progressLoaded && screen === "refleksi" && (
                  <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
                    <div className="tag-eyebrow">Refleksi &amp; Saran Pengembangan</div>
                    <h2 className="disp" style={{ fontSize: 19, marginBottom: 4 }}>Ceritakan pengalamanmu</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                      Jawabanmu akan dibaca oleh guru untuk membantu pengembangan aplikasi ini ke depannya. Isi dengan jujur ya!
                    </p>

                    {!reflectionLoaded && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13.5 }}><Loader2 size={15} className="spin" /> Memuat...</div>
                    )}

                    {reflectionLoaded && (
                      <>
                        {reflectionSavedAt && (
                          <div className="ok-box" style={{ marginBottom: 16 }}>
                            <CheckCircle2 size={17} /> Refleksi kamu sudah tersimpan. Kamu boleh mengubah jawaban dan mengirim ulang kapan saja.
                          </div>
                        )}
                        {reflectionError && <div className="err-box">{reflectionError}</div>}

                        {REFLECTION_QUESTIONS.map((q) => (
                          <div key={q.id} style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 4 }}>{q.label}</label>
                            <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>{q.text}</p>
                            <textarea
                              rows={3}
                              placeholder="Tulis jawabanmu di sini..."
                              value={reflectionAnswers[q.id] || ""}
                              onChange={(e) => setReflectionAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                              style={{ width: "100%", fontSize: 13.5 }}
                            />
                          </div>
                        ))}

                        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={reflectionSubmitting} onClick={submitReflection}>
                          {reflectionSubmitting ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Kirim Refleksi
                        </button>
                      </>
                    )}
                  </div>
                )}

                {progressLoaded && screen === "profil" && !editingProfil && (
                  <div className="card" style={{ textAlign: "center" }}>
                    <div className="avatar avatar-lg" style={{ margin: "0 auto 14px", background: AVATAR_GRADIENTS[profile.avatarColor || 0] }}>{(profile.name || "?").trim().charAt(0).toUpperCase()}</div>
                    <h2 className="disp" style={{ fontSize: 19 }}>{profile.name || "Siswa"}</h2>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "8px 0 14px", flexWrap: "wrap" }}>
                      {profile.kelas && <span className="pill" style={{ background: "var(--brand-light)", color: "var(--brand-dark)" }}>Kelas {profile.kelas}</span>}
                      {profile.sekolah && <span className="pill" style={{ background: "var(--paper-2)", color: "var(--muted)" }}>{profile.sekolah}</span>}
                      {profile.mapel && <span className="pill" style={{ background: "var(--paper-2)", color: "var(--muted)" }}>{profile.mapel}</span>}
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

                    {profile.role === "guru" && (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, fontWeight: 600 }}>Asal Sekolah</div>
                          <input type="text" value={editSekolah} onChange={(e) => setEditSekolah(e.target.value)} placeholder="contoh: SMA Negeri 1" />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, fontWeight: 600 }}>Kelas yang Diajar</div>
                          <input type="text" value={editKelasAjar} onChange={(e) => setEditKelasAjar(e.target.value)} placeholder="pisahkan koma, contoh: X-A, X-B" />
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Kosongkan untuk melihat semua kelas di sekolah ini.</div>
                        </div>
                      </>
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
                {screen === "profil" ? (
                  <div className="card" style={{ maxWidth: 420 }}>
                    <div className="tag-eyebrow">Profil Guru</div>
                    <div style={{ marginBottom: 14, textAlign: "center" }}>
                      <div className="avatar avatar-lg" style={{ margin: "0 auto 10px", background: AVATAR_GRADIENTS[editAvatarColor] }}>{(editName || profile.name || "?").trim().charAt(0).toUpperCase()}</div>
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
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, fontWeight: 600 }}>Asal Sekolah</div>
                      <input type="text" value={editSekolah} onChange={(e) => setEditSekolah(e.target.value)} placeholder="contoh: SMA Negeri 1" />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, fontWeight: 600 }}>Kelas yang Diajar</div>
                      <input type="text" value={editKelasAjar} onChange={(e) => setEditKelasAjar(e.target.value)} placeholder="pisahkan koma, contoh: X-A, X-B" />
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Kosongkan untuk melihat semua kelas di sekolah ini.</div>
                    </div>
                    <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={!editName.trim() || savingProfil} onClick={saveProfil}>
                      {savingProfil ? <Loader2 size={15} className="spin" /> : "Simpan Perubahan"}
                    </button>
                  </div>
                ) : (
                  <>
                {!profile.sekolah && (
                  <div className="card" style={{ marginBottom: 16, borderColor: "var(--amber)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <AlertTriangle size={18} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Lengkapi data sekolah kamu</div>
                        <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
                          Isi asal sekolah (dan kelas yang diajar, opsional) supaya kamu hanya melihat data siswa dari sekolah dan kelas yang kamu ajar.
                        </p>
                        <button className="btn-primary" style={{ padding: "7px 14px", fontSize: 12.5 }} onClick={() => { setScreen("profil"); startEditProfil(); }}>Lengkapi Sekarang</button>
                      </div>
                    </div>
                  </div>
                )}
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
                    {guruFilteredStudents.length > 0 && (
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
                        <div className="card" style={{ flex: "1 1 260px", minWidth: 260 }}>
                          <div className="tag-eyebrow" style={{ marginBottom: 10 }}>Sebaran Penguasaan Konsep</div>
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie data={guruDistribusi} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                                {guruDistribusi.map((d, i) => <Cell key={i} fill={d.color} />)}
                              </Pie>
                              <Tooltip />
                              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11.5 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="card" style={{ flex: "2 1 380px", minWidth: 300 }}>
                          <div className="tag-eyebrow" style={{ marginBottom: 10 }}>Penguasaan per Konsep (%)</div>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={guruChartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" tick={{ fontSize: 10.5 }} interval={0} angle={-25} textAnchor="end" height={45} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(v, n, p) => [`${v}%`, p.payload.fullName]} />
                              <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                                {guruChartData.map((d, i) => (
                                  <Cell key={i} fill={!d.hasData ? GURU_PALETTE.pale : d.pct >= 75 ? GURU_PALETTE.strong : d.pct >= 40 ? GURU_PALETTE.mid : GURU_PALETTE.soft} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    {CONCEPT_ORDER.map((c) => {
                      const m = guruConceptMastery(c); const pct = m ? Math.round(m * 100) : 0;
                      const barColor = m === null ? GURU_PALETTE.pale : pct >= 75 ? GURU_PALETTE.strong : pct >= 40 ? GURU_PALETTE.mid : GURU_PALETTE.soft;
                      return (
                        <div key={c} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{CONCEPTS[c].name}</span><span>{m !== null ? pct + "%" : "–"}</span></div>
                          <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%", background: barColor }} /></div>
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

                {guruTab === "ujian" && (
                  <div className="card">
                    <div className="tag-eyebrow">Jawaban &amp; Waktu Pengerjaan Ujian Siswa</div>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
                      Data waktu pengerjaan dan rincian jawaban hanya ditampilkan di laman guru dan tidak terlihat oleh siswa.
                    </p>

                    <div className="card" style={{ marginBottom: 18, background: "var(--paper-2)" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Unggah Jawaban Esai — Google Form &amp; Folder Drive</div>
                      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                        Buat 1 Google Form dengan pertanyaan tipe "Upload file" di akun Google-mu. Secara default, Form akan otomatis membuat 1 folder di Drive-mu (biasanya bernama sama dengan nama Form) untuk menampung semua file yang diunggah siswa — file itu masuk ke Drive-mu sendiri, bukan Drive siswa, dan siswa lain tidak bisa saling melihat file. Tempel link Form (untuk dibagikan ke siswa) dan link folder Drive tempat file itu tersimpan (untuk kamu membuka &amp; mengecek jawaban) di bawah ini. Berlaku untuk semua siswa di sekolah <b>{profile?.sekolah || "-"}</b>.
                      </p>
                      {essayFormMsg && <div style={{ fontSize: 12, color: essayFormMsg.startsWith("Gagal") || essayFormMsg.startsWith("Link Form harus") || essayFormMsg.startsWith("Link folder harus") || essayFormMsg.startsWith("Lengkapi") ? "var(--rose)" : "#0F7A56", marginBottom: 8 }}>{essayFormMsg}</div>}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Link Google Form (dibagikan ke siswa)</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input
                            type="text"
                            style={{ flex: 1, minWidth: 220 }}
                            placeholder="https://docs.google.com/forms/d/e/..../viewform"
                            value={essayFormUrlInput}
                            onChange={(e) => { setEssayFormUrlInput(e.target.value); setEssayFormMsg(""); }}
                          />
                          {essayFormUrl && (
                            <a href={essayFormUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ display: "inline-flex" }}>Buka Form</a>
                          )}
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Link Folder Google Drive (tempat jawaban siswa tersimpan, khusus untukmu)</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input
                            type="text"
                            style={{ flex: 1, minWidth: 220 }}
                            placeholder="https://drive.google.com/drive/folders/..."
                            value={essayDriveFolderUrlInput}
                            onChange={(e) => { setEssayDriveFolderUrlInput(e.target.value); setEssayFormMsg(""); }}
                          />
                          {essayDriveFolderUrl && (
                            <a href={essayDriveFolderUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ display: "inline-flex" }}>Buka Folder Drive</a>
                          )}
                        </div>
                      </div>
                      <button className="btn-primary" disabled={essayFormSaving} onClick={saveEssayFormUrl}>
                        {essayFormSaving ? <Loader2 size={14} className="spin" /> : null} Simpan Pengaturan
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
                      <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Total percobaan ujian</div><div className="disp" style={{ fontSize: 22 }}>{guruExamAttempts.length}</div></div>
                      <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Rata-rata waktu pengerjaan</div><div className="disp" style={{ fontSize: 18 }}>{formatDuration(guruAvgDurationSec)}</div></div>
                    </div>
                    {guruExamAttempts.length === 0 && <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Belum ada siswa yang mengerjakan ujian.</p>}
                    {guruExamAttempts.length > 0 && (
                      <table>
                        <thead><tr><th>Nama</th><th>Kelas</th><th>Tanggal</th><th>Skor</th><th>Waktu Pengerjaan</th><th>Esai</th><th>Aksi</th></tr></thead>
                        <tbody>
                          {guruExamAttempts.map((h, i) => (
                            <tr key={i}>
                              <td>{h.student}</td>
                              <td>{h.kelas || "-"}</td>
                              <td>{new Date(h.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                              <td>{h.correct}/{h.total} · {h.score}%</td>
                              <td className="mono">{formatDuration(h.durationSec)}</td>
                              <td>{h.essaySubmitted ? <span className="pill" style={{ background: "var(--brand-light)", color: "var(--brand-dark)" }}>Ada</span> : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>-</span>}</td>
                              <td>
                                {h.details && h.details.length > 0 ? (
                                  <button className="btn-ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => setGuruSelectedAttempt(h)}>Lihat Jawaban</button>
                                ) : (
                                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {guruTab === "materi" && (
                  <div className="card">
                    <div className="tag-eyebrow">Knowledge Base — contoh entri</div>
                    <table>
                      <thead><tr><th>ID</th><th>Nama konsep</th><th>Deskripsi</th><th>Prasyarat</th><th>Status</th></tr></thead>
                      <tbody>{KB_ROWS.map((r) => (<tr key={r.id}><td className="mono">{r.id}</td><td>{r.nama}</td><td><MathText text={r.deskripsi} /></td><td className="mono">{r.prereq}</td><td>{r.status}</td></tr>))}</tbody>
                    </table>
                  </div>
                )}

                {guruTab === "kelolaKonten" && (
                  <div className="card">
                    <div className="tag-eyebrow">Kelola Materi &amp; Soal</div>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
                      Perubahan di sini langsung berlaku untuk semua siswa (menu Materi, Latihan, dan Ujian) begitu disimpan.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                      <select value={ccSelectedConcept} onChange={(e) => loadConceptEditor(e.target.value)}>
                        {CONCEPT_ORDER.map((c) => (<option key={c} value={c}>{CONCEPTS[c].name}</option>))}
                      </select>
                    </div>
                    {ccMsg && <div style={{ fontSize: 12.5, color: ccMsg.startsWith("Gagal") ? "var(--rose)" : "#0F7A56", fontWeight: 600, marginBottom: 10 }}>{ccMsg}</div>}

                    <div className="tag-eyebrow" style={{ marginTop: 4 }}>Materi</div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>Rumus (satu baris = satu rumus, format LaTeX seperti $a^n$)</label>
                      <textarea rows={3} value={ccFormula} onChange={(e) => setCcFormula(e.target.value)} style={{ width: "100%", fontFamily: "'IBM Plex Mono'", fontSize: 13 }} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>Penjelasan</label>
                      <textarea rows={4} value={ccPenjelasan} onChange={(e) => setCcPenjelasan(e.target.value)} style={{ width: "100%", fontSize: 13.5 }} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>Contoh (satu baris = satu contoh)</label>
                      <textarea rows={3} value={ccContoh} onChange={(e) => setCcContoh(e.target.value)} style={{ width: "100%", fontFamily: "'IBM Plex Mono'", fontSize: 13 }} />
                    </div>
                    <button className="btn-primary" disabled={ccSaving} onClick={saveConceptMateri}>
                      {ccSaving ? <Loader2 size={15} className="spin" /> : "Simpan Materi"}
                    </button>

                    <div className="tag-eyebrow" style={{ marginTop: 26 }}>Soal Latihan &amp; Ujian ({(EFFECTIVE_POOL[ccSelectedConcept] || []).length} soal)</div>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Bank soal ini dipakai bersama oleh menu Latihan dan Ujian.</p>

                    {(EFFECTIVE_POOL[ccSelectedConcept] || []).map((q, i) => (
                      <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginBottom: 8, fontSize: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>#{i + 1} · {q.difficulty || "-"}</span>
                            <div><MathText text={q.text} /></div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => startEditQuestion(i)}>Edit</button>
                            <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--rose)" }} onClick={() => deleteQuestion(i)}>Hapus</button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {ccEditingIdx === null && (
                      <button className="btn-ghost" onClick={startAddQuestion}>+ Tambah Soal Baru</button>
                    )}

                    {ccEditingIdx !== null && (
                      <div style={{ border: "1.5px solid var(--brand)", borderRadius: 12, padding: 14, marginTop: 10, background: "var(--brand-light)" }}>
                        <div className="tag-eyebrow" style={{ marginBottom: 8 }}>{ccEditingIdx === "new" ? "Tambah Soal Baru" : `Edit Soal #${ccEditingIdx + 1}`}</div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>Tingkat kesulitan</label>
                          <select value={ccQDifficulty} onChange={(e) => setCcQDifficulty(e.target.value)}>
                            <option value="mudah">Mudah</option>
                            <option value="sedang">Sedang</option>
                            <option value="sulit">Sulit</option>
                          </select>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>Teks soal (boleh pakai LaTeX, contoh: $2^3 = ?$)</label>
                          <input type="text" value={ccQText} onChange={(e) => setCcQText(e.target.value)} style={{ width: "100%" }} />
                        </div>
                        <label style={{ fontSize: 11.5, color: "var(--muted)", display: "block", marginBottom: 4 }}>5 pilihan jawaban — tandai lingkaran di kiri sebagai jawaban benar</label>
                        {ccQOptions.map((optText, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <input type="radio" name="ccQCorrect" checked={ccQCorrect === i} onChange={() => setCcQCorrect(i)} />
                            <input
                              type="text"
                              placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                              value={optText}
                              onChange={(e) => setCcQOptions((arr) => { const n = [...arr]; n[i] = e.target.value; return n; })}
                              style={{ flex: 1 }}
                            />
                            {ccQCorrect !== i && (
                              <input
                                type="text"
                                placeholder="Tag miskonsepsi (opsional)"
                                value={ccQTags[i]}
                                onChange={(e) => setCcQTags((arr) => { const n = [...arr]; n[i] = e.target.value; return n; })}
                                style={{ flex: 1, fontSize: 12 }}
                              />
                            )}
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button className="btn-ghost" disabled={ccSaving} onClick={() => setCcEditingIdx(null)}>Batal</button>
                          <button className="btn-primary" disabled={ccSaving} onClick={saveQuestion}>
                            {ccSaving ? <Loader2 size={15} className="spin" /> : "Simpan Soal"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {guruTab === "refleksi" && (
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
                      <div className="tag-eyebrow" style={{ marginBottom: 0 }}>Refleksi &amp; Saran Pengembangan Siswa</div>
                      <button className="btn-ghost" onClick={loadGuruReflections} disabled={guruReflectionsLoading}>{guruReflectionsLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Muat ulang</button>
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
                      Rangkuman jawaban refleksi siswa tentang pengalaman menggunakan aplikasi ini, sebagai masukan untuk pengembangan.
                    </p>
                    {guruReflectionsLoading && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13.5 }}><Loader2 size={15} className="spin" /> Memuat refleksi...</div>}
                    {!guruReflectionsLoading && guruReflections.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13.5 }}>Belum ada siswa yang mengisi refleksi.</p>}
                    {!guruReflectionsLoading && guruReflections.map((r) => (
                      <div key={r.uid} className="card" style={{ marginBottom: 12, background: "var(--paper-2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                          <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{(r.name || "?").trim().charAt(0).toUpperCase()}</div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.name || "Siswa"}</div>
                          {r.kelas && <span className="pill" style={{ background: "var(--brand-light)", color: "var(--brand-dark)" }}>Kelas {r.kelas}</span>}
                        </div>
                        {REFLECTION_QUESTIONS.map((q) => (
                          (r.answers?.[q.id]) ? (
                            <div key={q.id} style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 2 }}>{q.label}</div>
                              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r.answers[q.id]}</div>
                            </div>
                          ) : null
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {guruTab === "kodeAkses" && profile.isAdmin && (
                  <div className="card">
                    <div className="tag-eyebrow">Buat kode akses guru baru</div>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
                      Kode dipakai guru saat mendaftar, formatnya <span className="mono">SEKOLAH-MAPEL-NOMOR</span> (contoh: <span className="mono">SMAN5-MAT-003</span>). Sekolah &amp; mata pelajaran pada akun guru akan otomatis mengikuti kode ini.
                    </p>
                    {kodeError && <div className="err-box"><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {kodeError}</div>}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <input type="text" placeholder="Nama sekolah (contoh: SMAN 5)" value={newKodeSekolah} onChange={(e) => setNewKodeSekolah(e.target.value)} style={{ flex: "1 1 200px" }} />
                      <input type="text" placeholder="Nama mata pelajaran (contoh: Matematika)" value={newKodeMapelNama} onChange={(e) => setNewKodeMapelNama(e.target.value)} style={{ flex: "1 1 200px" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <input type="text" placeholder="Singkatan mapel (contoh: Mat)" value={newKodeMapelSingkat} onChange={(e) => setNewKodeMapelSingkat(e.target.value)} style={{ flex: "1 1 160px" }} />
                      <input type="text" placeholder="Nomor kode (contoh: 003)" value={newKodeNomor} onChange={(e) => setNewKodeNomor(e.target.value)} style={{ flex: "1 1 160px" }} />
                    </div>
                    {(newKodeSekolah.trim() || newKodeMapelSingkat.trim() || newKodeNomor.trim()) && (
                      <div style={{ fontSize: 13, marginBottom: 12 }}>
                        Pratinjau kode: <span className="mono" style={{ fontWeight: 700 }}>
                          {newKodeSekolah.trim().toUpperCase().replace(/\s+/g, "") || "SEKOLAH"}-{newKodeMapelSingkat.trim().toUpperCase().replace(/\s+/g, "") || "MAPEL"}-{newKodeNomor.trim() || "NOMOR"}
                        </span>
                      </div>
                    )}
                    <button className="btn-primary" onClick={createAccessCode}>Buat Kode Akses</button>

                    <div className="tag-eyebrow" style={{ marginTop: 24 }}>Daftar kode akses</div>
                    {codesLoading && <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Memuat...</p>}
                    {!codesLoading && accessCodes.length === 0 && <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Belum ada kode akses dibuat.</p>}
                    {accessCodes.length > 0 && (
                      <table>
                        <thead><tr><th>Kode</th><th>Sekolah</th><th>Mapel</th><th>Guru terdaftar</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                          {accessCodes.map((c) => (
                            <tr key={c.code}>
                              <td className="mono">{c.code}</td>
                              <td>{c.sekolah}</td>
                              <td>{c.mapel}</td>
                              <td>{(c.usedBy || []).length}</td>
                              <td>{c.active === false ? "Nonaktif" : "Aktif"}</td>
                              <td>
                                <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => toggleAccessCode(c.code, c.active !== false)}>
                                  {c.active === false ? "Aktifkan" : "Nonaktifkan"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
                  </>
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
        input[type=text],input[type=password],input[type=email],textarea,select { width:100%; padding:11px 13px; border-radius:12px; border:1.5px solid var(--line); font-size:14px; box-sizing:border-box; background:white; font-family:inherit; }
        textarea { resize:vertical; }
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
        .qtext { font-family:'STIX Two Math','Cambria Math',serif; font-size:clamp(13px,2.0vw,15.5px); margin:14px 0 20px; padding:18px 20px; background:var(--paper-2); border-radius:14px; border:1px solid var(--line); text-align:center; min-width:0; }
        .qtext .katex-display { margin:8px 0; padding:2px 0; }
        .qtext .katex-display:not(:last-child) { margin-bottom:18px; }
        .math-box { font-family:'STIX Two Math','Cambria Math',serif; font-size:clamp(12px,1.9vw,14px); padding:14px 16px; background:var(--paper-2); border-radius:12px; border:1px solid var(--line); margin-bottom:8px; text-align:center; min-width:0; }
        .math-box .katex-display { margin:0; padding:2px 0; }
        .math-block-wrap { width:100%; max-width:100%; display:flex; justify-content:center; align-items:flex-start; min-width:0; box-sizing:border-box; }
        .math-block { display:block; max-width:100%; min-width:0; }
        .math-block .katex-display { margin:0; }
        .math-block .katex-display > .katex { max-width:none; }
        .math-block .katex { font-size:0.95em; max-width:100%; }
        .math-block .katex { max-width:100%; }
        .math-inline { max-width:100%; }
        .basic-formula-box { background:var(--paper-2); border:1px solid var(--line); border-radius:14px; padding:16px 16px; margin:14px 0 10px; text-align:center; }
        .basic-formula-box .basic-label { font-family:Inter,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; color:var(--muted); margin-bottom:10px; }
        .basic-formula-box .math-block-wrap { margin:0; }
        .basic-formula-box .math-block .katex { font-size:0.95em; max-width:100%; }
        .basic-condition { margin-top:6px; font-size:13px; color:var(--muted); font-family:Inter,sans-serif; }
        .basic-result { margin-top:5px; font-size:0.9em; }
        .math-sup { vertical-align:super; font-size:0.68em; line-height:0; }
        .math-radical { display:inline-flex; align-items:flex-start; white-space:nowrap; }
        .math-radical-idx { font-size:0.58em; margin-right:-3px; margin-top:-3px; }
        .math-radical-sign { font-size:1.1em; margin-right:1px; }
        .math-radical-body { border-top:1.4px solid currentColor; padding:0 4px; }
        .math-frac { display:inline-flex; flex-direction:column; vertical-align:middle; text-align:center; font-size:0.82em; line-height:1.1; margin:0 3px; position:relative; top:0.1em; }
        .math-frac-num { padding:0 3px 2px; border-bottom:1.3px solid currentColor; }
        .math-frac-den { padding:2px 3px 0; }
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
