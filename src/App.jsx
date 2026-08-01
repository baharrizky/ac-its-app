import React, { useState, useMemo, useEffect } from "react";
import {
  GraduationCap, LayoutDashboard, BookOpen, PenLine, TrendingUp, User,
  Lightbulb, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, LogOut, Database, Users,
  Mail, Lock, Loader2, RefreshCw
} from "lucide-react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs,
} from "firebase/firestore";

// ---------------- DATA: Peta konsep (sesuai Knowledge Base) ----------------
const CONCEPTS = {
  E1: { name: "Pangkat Positif", short: "aⁿ", prereq: [] },
  E2: { name: "Pangkat Nol", short: "a⁰", prereq: ["E1"] },
  E3: { name: "Pangkat Negatif", short: "a⁻ⁿ", prereq: ["E1"] },
  E4: { name: "Pangkat Pecahan", short: "a^(m/n)", prereq: ["E1", "E2"] },
  E5: { name: "Perkalian Pangkat Sama Basis", short: "aᵐ·aⁿ", prereq: ["E1"] },
  E6: { name: "Persamaan Eksponen", short: "aˣ=b", prereq: ["E1", "E2", "E3", "E4", "E5"] },
};
const CONCEPT_ORDER = ["E1", "E2", "E3", "E4", "E5", "E6"];
const EMPTY_ATTEMPTS = { E1: [], E2: [], E3: [], E4: [], E5: [], E6: [] };
const EMPTY_POOLIDX = { E1: 0, E2: 0, E3: 0, E4: 0, E5: 0, E6: 0 };

const MATERI = {
  E1: { formula: "aⁿ = a × a × ... (n kali)", penjelasan: "Pangkat positif berarti basis dikalikan dengan dirinya sendiri sebanyak n kali.", contoh: "2³ = 2 × 2 × 2 = 8" },
  E2: { formula: "a⁰ = 1", penjelasan: "Bilangan apa pun (kecuali 0) yang dipangkatkan nol hasilnya selalu 1.", contoh: "7⁰ = 1" },
  E3: { formula: "a⁻ⁿ = 1/aⁿ", penjelasan: "Pangkat negatif berarti kebalikan dari pangkat positifnya — bukan tanda minus di depan hasil.", contoh: "2⁻² = 1/2² = 1/4" },
  E4: { formula: "a^(m/n) = ⁿ√aᵐ", penjelasan: "Pangkat pecahan berarti bentuk akar: pembilang jadi pangkat di dalam akar, penyebut jadi indeks akarnya.", contoh: "8^(1/3) = ³√8 = 2" },
  E5: { formula: "aᵐ × aⁿ = aᵐ⁺ⁿ", penjelasan: "Kalau basisnya sama, cukup jumlahkan pangkatnya. Basisnya sendiri tidak berubah.", contoh: "3² × 3³ = 3⁵ = 243" },
  E6: { formula: "aˣ = b", penjelasan: "Untuk mencari x, samakan dulu basis kedua ruas, baru samakan pangkatnya.", contoh: "2ˣ = 8 → 2ˣ = 2³ → x = 3" },
};

const HINTS = {
  E1: { t1: "Ingat: pangkat berarti basis dikalikan dengan dirinya sendiri sebanyak pangkatnya — bukan basis dikali pangkat.", t2: "Contoh: 2³ = 2 × 2 × 2 = 8 (bukan 2 × 3 = 6).", full: "2³ artinya 2 dikalikan 3 kali berturut-turut: 2 × 2 × 2 = 8." },
  E2: { t1: "Ingat: a⁰ = 1 berlaku untuk semua a ≠ 0 — hasilnya bukan 0, dan bukan a itu sendiri.", t2: "Contoh: 4⁰ = 1, sama seperti 100⁰ = 1.", full: "Berapa pun basisnya (asal bukan 0), pangkat nol selalu sama dengan 1." },
  E3: { t1: "Pangkat negatif berarti kebalikan (1 per basis-pangkat-positifnya), bukan tanda minus di depan hasil.", t2: "Contoh: 3⁻² = 1/3² = 1/9.", full: "a⁻ⁿ = 1/aⁿ. Jadi 2⁻² = 1/2² = 1/4 — bukan −4 dan bukan 4." },
  E4: { t1: "Ingat: pangkat pecahan berarti bentuk akar — a^(m/n) = akar pangkat n dari aᵐ, bukan a dibagi n.", t2: "Contoh: 8^(1/3) = akar pangkat 3 dari 8 = 2 (bukan 8/3).", full: "a^(m/n) = ⁿ√(aᵐ). Ubah dulu ke bentuk akar sebelum menghitung." },
  E5: { t1: "Kalau basisnya sama, pangkatnya dijumlahkan — basisnya sendiri tidak berubah dan tidak ikut dikalikan.", t2: "Contoh: 3² × 3³ = 3⁽²⁺³⁾ = 3⁵ = 243.", full: "aᵐ × aⁿ = aᵐ⁺ⁿ. Basis tetap sama, hanya pangkatnya yang dijumlahkan." },
  E6: { t1: "Untuk menyelesaikan aˣ = b, samakan dulu basis kedua ruas, baru samakan pangkatnya.", t2: "Contoh: 2ˣ = 8 → 2ˣ = 2³ → x = 3.", full: "Kalau basis kedua ruas bisa disamakan, pangkatnya pasti sama, sehingga x bisa langsung dibaca dari situ." },
};

const PRACTICE_POOL = {
  E1: [{ text: "2⁴ = ?", options: [{ text: "16", correct: true }, { text: "8" }, { text: "6" }] }, { text: "5³ = ?", options: [{ text: "125", correct: true }, { text: "15" }, { text: "8" }] }],
  E2: [{ text: "12⁰ = ?", options: [{ text: "1", correct: true }, { text: "0" }, { text: "12" }] }, { text: "9⁰ = ?", options: [{ text: "1", correct: true }, { text: "0" }, { text: "9" }] }],
  E3: [{ text: "3⁻² = ?", options: [{ text: "1/9", correct: true }, { text: "−9" }, { text: "9" }] }, { text: "5⁻¹ = ?", options: [{ text: "1/5", correct: true }, { text: "−5" }, { text: "5" }] }],
  E4: [{ text: "27^(1/3) = ?", options: [{ text: "3", correct: true }, { text: "9" }, { text: "24" }] }, { text: "16^(1/2) = ?", options: [{ text: "4", correct: true }, { text: "8" }, { text: "256" }] }],
  E5: [{ text: "3² × 3³ = ?", options: [{ text: "3⁵ (=243)", correct: true }, { text: "3⁶" }, { text: "9⁵" }] }, { text: "5 × 5² = ?", options: [{ text: "5³ (=125)", correct: true }, { text: "5²" }, { text: "25²" }] }],
  E6: [{ text: "3ˣ = 9, x = ?", options: [{ text: "2", correct: true }, { text: "3" }, { text: "9" }] }, { text: "5ˣ = 125, x = ?", options: [{ text: "3", correct: true }, { text: "5" }, { text: "25" }] }],
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

export default function App() {
  // ---------- Auth & profil ----------
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null); // { name, role }
  const [mode, setMode] = useState("landing"); // landing | auth | app
  const [authTab, setAuthTab] = useState("login"); // login | daftar
  const [authRole, setAuthRole] = useState("siswa"); // role dipilih saat daftar
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // ---------- Progress siswa (tersimpan di Firestore) ----------
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [attempts, setAttempts] = useState(EMPTY_ATTEMPTS);
  const [misconceptions, setMisconceptions] = useState([]);
  const [poolIndex, setPoolIndex] = useState(EMPTY_POOLIDX);

  // ---------- Navigasi & latihan ----------
  const [screen, setScreen] = useState("dashboard");
  const [activeConcept, setActiveConcept] = useState("E1");
  const [consecWrong, setConsecWrong] = useState(0);
  const [hintTier, setHintTier] = useState(0);
  const [selected, setSelected] = useState(null);
  const [diag, setDiag] = useState(null);
  const [redirectNote, setRedirectNote] = useState(null);

  // ---------- Guru ----------
  const [guruTab, setGuruTab] = useState("beranda");
  const [guruStudents, setGuruStudents] = useState([]);
  const [guruLoading, setGuruLoading] = useState(false);

  // Pantau status login Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          setProfile(snap.data());
          setMode("app");
          setScreen("dashboard");
        } else {
          // profil belum ada (harusnya tidak terjadi) -> paksa logout
          await signOut(auth);
        }
      } else {
        setProfile(null);
        setAttempts(EMPTY_ATTEMPTS);
        setMisconceptions([]);
        setPoolIndex(EMPTY_POOLIDX);
        setProgressLoaded(false);
        setMode("landing");
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Ambil progress siswa dari Firestore setelah profil diketahui
  useEffect(() => {
    async function loadProgress() {
      if (!authUser || !profile || profile.role !== "siswa") return;
      const snap = await getDoc(doc(db, "progress", authUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        setAttempts(d.attempts || EMPTY_ATTEMPTS);
        setMisconceptions(d.misconceptions || []);
        setPoolIndex(d.poolIndex || EMPTY_POOLIDX);
      }
      setProgressLoaded(true);
    }
    loadProgress();
  }, [authUser, profile]);

  // Simpan progress siswa ke Firestore setiap kali berubah (setelah data awal termuat)
  useEffect(() => {
    if (!authUser || !profile || profile.role !== "siswa" || !progressLoaded) return;
    setDoc(doc(db, "progress", authUser.uid), { attempts, misconceptions, poolIndex }, { merge: true }).catch(() => {});
  }, [attempts, misconceptions, poolIndex, authUser, profile, progressLoaded]);

  const statuses = useMemo(() => {
    const s = {};
    CONCEPT_ORDER.forEach((c) => (s[c] = statusOf(attempts[c])));
    return s;
  }, [attempts]);

  function pickNextConcept() {
    const remaining = CONCEPT_ORDER.filter((c) => statuses[c].label !== "Dikuasai");
    if (remaining.length === 0) return null;
    remaining.sort((a, b) => (computeMastery(attempts[a]) ?? 0) - (computeMastery(attempts[b]) ?? 0));
    let target = remaining[0];
    const weakPrereq = CONCEPTS[target].prereq.find((p) => (computeMastery(attempts[p]) ?? 0) < 0.5 && statuses[p].label !== "Dikuasai");
    if (weakPrereq) {
      setRedirectNote(`Kamu belum kuat di ${CONCEPTS[weakPrereq].name} (prasyarat ${CONCEPTS[target].name}) — diarahkan ke sana dulu.`);
      target = weakPrereq;
    } else {
      setRedirectNote(null);
    }
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
    setScreen("materi");
  }

  function currentQ() {
    const idx = poolIndex[activeConcept] % PRACTICE_POOL[activeConcept].length;
    return PRACTICE_POOL[activeConcept][idx];
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

  const overallPct = useMemo(() => overallPctOf(attempts), [attempts]);

  // ---------- Auth: submit login / daftar ----------
  async function submitAuth() {
    setAuthError("");
    if (!authEmail.trim() || !authPassword.trim() || (authTab === "daftar" && !authName.trim())) {
      setAuthError("Lengkapi semua kolom terlebih dahulu.");
      return;
    }
    setAuthSubmitting(true);
    try {
      if (authTab === "daftar") {
        const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        const uid = cred.user.uid;
        await setDoc(doc(db, "users", uid), { name: authName.trim(), role: authRole, email: authEmail.trim() });
        if (authRole === "siswa") {
          await setDoc(doc(db, "progress", uid), { attempts: EMPTY_ATTEMPTS, misconceptions: [], poolIndex: EMPTY_POOLIDX });
        }
        // onAuthStateChanged akan otomatis memuat profil & masuk ke app
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

  // ---------- Guru: ambil data semua siswa dari Firestore ----------
  async function loadGuruData() {
    setGuruLoading(true);
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "siswa")));
      const list = [];
      for (const uDoc of usersSnap.docs) {
        const u = uDoc.data();
        const progSnap = await getDoc(doc(db, "progress", uDoc.id));
        const prog = progSnap.exists() ? progSnap.data() : { attempts: EMPTY_ATTEMPTS, misconceptions: [] };
        list.push({ uid: uDoc.id, name: u.name || "Siswa", attempts: prog.attempts || EMPTY_ATTEMPTS, misconceptions: prog.misconceptions || [] });
      }
      setGuruStudents(list);
    } catch (e) {
      // biarkan list kosong kalau gagal, tampilkan tombol coba lagi
    }
    setGuruLoading(false);
  }

  useEffect(() => {
    if (mode === "app" && profile?.role === "guru") {
      loadGuruData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile]);

  const guruAvgPct = useMemo(() => {
    if (guruStudents.length === 0) return 0;
    const sum = guruStudents.reduce((a, s) => a + overallPctOf(s.attempts), 0);
    return Math.round(sum / guruStudents.length);
  }, [guruStudents]);

  function guruConceptMastery(c) {
    const ms = guruStudents.map((s) => computeMastery(s.attempts[c] || [])).filter((m) => m !== null);
    if (ms.length === 0) return null;
    return ms.reduce((a, b) => a + b, 0) / ms.length;
  }

  const guruHardestConcept = useMemo(() => {
    const withData = CONCEPT_ORDER.filter((c) => guruConceptMastery(c) !== null);
    if (withData.length === 0) return "Belum ada data";
    const worst = withData.sort((a, b) => guruConceptMastery(a) - guruConceptMastery(b))[0];
    return CONCEPTS[worst].name;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guruStudents]);

  const allMisconceptions = useMemo(
    () => guruStudents.flatMap((s) => (s.misconceptions || []).map((m) => ({ ...m, student: s.name }))),
    [guruStudents]
  );

  // ---------- Tampilan loading awal ----------
  if (authLoading) {
    return (
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
        <style>{`
          :root {
            --paper:#F3F6F1; --paper-2:#EAEFE6; --ink:#1F2A24; --muted:#6B7A70;
            --teal:#2F6F5E; --teal-light:#D7E8E1; --amber:#C97A2B; --amber-light:#F5E3CE;
            --plum:#6B4E71; --plum-light:#E8DEEA; --rose:#B5495B; --rose-light:#F3DEE1;
            --line:#D8DED4; --brand:#44519C; --brand-light:#E3E6F4;
          }
          .wrap { font-family:'Inter',sans-serif; background:var(--paper); color:var(--ink); border-radius:16px; min-height:100%; }
        `}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}>
          <Loader2 size={18} className="spin" /> Memuat...
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      <style>{`
        :root {
          --paper:#F3F6F1; --paper-2:#EAEFE6; --ink:#1F2A24; --muted:#6B7A70;
          --teal:#2F6F5E; --teal-light:#D7E8E1; --amber:#C97A2B; --amber-light:#F5E3CE;
          --plum:#6B4E71; --plum-light:#E8DEEA; --rose:#B5495B; --rose-light:#F3DEE1;
          --line:#D8DED4; --brand:#44519C; --brand-light:#E3E6F4;
        }
        .wrap { font-family:'Inter',sans-serif; background:var(--paper); color:var(--ink); border-radius:16px; padding:0; min-height:100%; overflow:hidden; }
        .disp { font-family:'Fraunces',serif; }
        .mono { font-family:'IBM Plex Mono',monospace; }
        button { font-family:'Inter'; cursor:pointer; }
        .btn-primary { background:var(--brand); color:white; border:none; padding:11px 20px; border-radius:8px; font-weight:500; font-size:14px; display:inline-flex; align-items:center; gap:6px; }
        .btn-primary:disabled { opacity:0.35; cursor:not-allowed; }
        .btn-ghost { background:transparent; border:1px solid var(--line); color:var(--ink); padding:9px 16px; border-radius:8px; font-size:13.5px; display:inline-flex; align-items:center; gap:6px; }
        input[type=text],input[type=password],input[type=email] { width:100%; padding:11px 13px; border-radius:8px; border:1px solid var(--line); font-size:14px; box-sizing:border-box; }
        .card { background:white; border:1px solid var(--line); border-radius:14px; padding:22px; }
        .pill { font-size:11.5px; padding:3px 10px; border-radius:999px; font-weight:600; }
        .opt { display:block; width:100%; text-align:left; padding:12px 14px; border-radius:9px; border:1px solid var(--line); background:var(--paper-2); margin-bottom:9px; font-size:14.5px; font-family:'IBM Plex Mono'; }
        .opt.picked { border-color:var(--brand); background:var(--brand-light); }
        .qtext { font-family:'IBM Plex Mono'; font-size:22px; margin:14px 0 20px; }
        .bar-track { background:var(--paper-2); border-radius:999px; height:8px; overflow:hidden; margin-top:6px; }
        .bar-fill { height:100%; border-radius:999px; }
        .tag-eyebrow { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
        .hint-box { display:flex; gap:10px; padding:14px; border-radius:10px; margin:14px 0; font-size:13.5px; line-height:1.5; }
        .hint-t1 { background:var(--plum-light); color:var(--plum); }
        .hint-t2 { background:var(--amber-light); color:var(--amber); }
        .hint-t3 { background:var(--rose-light); color:var(--rose); }
        .ok-box { background:var(--teal-light); color:var(--teal); padding:14px; border-radius:10px; margin:14px 0; font-size:13.5px; display:flex; gap:10px; align-items:center; }
        .err-box { background:var(--rose-light); color:var(--rose); padding:11px 14px; border-radius:9px; margin-bottom:14px; font-size:13px; }
        .topbar { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; border-bottom:1px solid var(--line); background:white; }
        .brand { display:flex; align-items:center; gap:8px; font-weight:700; color:var(--brand); font-size:16px; }
        .body-area { padding:22px; }
        .bottomnav { display:flex; border-top:1px solid var(--line); background:white; }
        .navbtn { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:10px 0; font-size:11px; color:var(--muted); background:none; border:none; }
        .navbtn.active { color:var(--brand); font-weight:600; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); }
        th { color:var(--muted); font-weight:500; font-size:11.5px; text-transform:uppercase; letter-spacing:.03em; }
        .tabbtn { padding:8px 14px; border-radius:8px; border:1px solid var(--line); background:white; font-size:13px; margin-right:8px; }
        .tabbtn.active { background:var(--brand); color:white; border-color:var(--brand); }
        .misc-item { font-size:12.5px; color:var(--amber); background:var(--amber-light); padding:6px 10px; border-radius:7px; margin-top:6px; }
        .inputwrap { position:relative; }
        .inputwrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); }
        .inputwrap input { padding-left:36px; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {mode === "landing" && (
        <div className="body-area">
          <div className="card" style={{ textAlign: "center" }}>
            <div className="brand" style={{ justifyContent: "center", marginBottom: 10 }}><GraduationCap size={22} /> AC-ITS</div>
            <div className="tag-eyebrow">Adaptive Concept-Based Intelligent Tutoring System</div>
            <h1 className="disp" style={{ fontSize: 26, margin: "10px 0" }}>Belajar Matematika Lebih Cerdas</h1>
            <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 420, margin: "0 auto 20px" }}>
              Sistem pembelajaran adaptif materi Eksponensial — mendiagnosis pemahamanmu, memberi hint bertingkat, dan menyesuaikan jalur belajar secara personal.
            </p>
            <button className="btn-primary" onClick={() => { setMode("auth"); setAuthTab("login"); setAuthError(""); }}>Mulai Belajar <ArrowRight size={15} /></button>
          </div>
        </div>
      )}

      {mode === "auth" && (
        <div className="body-area">
          <div className="card" style={{ maxWidth: 380, margin: "0 auto" }}>
            <div className="tag-eyebrow">{authTab === "login" ? "Login" : "Daftar Akun"}</div>
            <h2 className="disp" style={{ fontSize: 19, marginBottom: 14 }}>
              {authTab === "login" ? "Selamat datang kembali" : "Buat akun baru"}
            </h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                className="btn-ghost"
                style={{ flex: 1, justifyContent: "center", ...(authTab === "login" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }}
                onClick={() => { setAuthTab("login"); setAuthError(""); }}
              >
                Login
              </button>
              <button
                className="btn-ghost"
                style={{ flex: 1, justifyContent: "center", ...(authTab === "daftar" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }}
                onClick={() => { setAuthTab("daftar"); setAuthError(""); }}
              >
                Daftar
              </button>
            </div>

            {authError && <div className="err-box"><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {authError}</div>}

            {authTab === "daftar" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>Daftar sebagai</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-ghost"
                      style={{ flex: 1, justifyContent: "center", ...(authRole === "siswa" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }}
                      onClick={() => setAuthRole("siswa")}
                    >
                      <User size={14} /> Siswa
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ flex: 1, justifyContent: "center", ...(authRole === "guru" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }}
                      onClick={() => setAuthRole("guru")}
                    >
                      <Users size={14} /> Guru
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input type="text" placeholder="Nama lengkap" value={authName} onChange={(e) => setAuthName(e.target.value)} />
                </div>
              </>
            )}

            <div style={{ marginBottom: 10 }} className="inputwrap">
              <Mail size={15} />
              <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }} className="inputwrap">
              <Lock size={15} />
              <input type="password" placeholder="Kata sandi (min. 6 karakter)" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            </div>

            <button className="btn-primary" disabled={authSubmitting} onClick={submitAuth} style={{ width: "100%", justifyContent: "center" }}>
              {authSubmitting ? <Loader2 size={15} className="spin" /> : (authTab === "login" ? <>Login <ArrowRight size={15} /></> : <>Daftar <ArrowRight size={15} /></>)}
            </button>
          </div>
        </div>
      )}

      {mode === "app" && profile && (
        <>
          <div className="topbar">
            <div className="brand"><GraduationCap size={20} /> AC-ITS</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="pill" style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
                {profile.role === "siswa" ? <><User size={12} style={{ verticalAlign: -1 }} /> Siswa</> : <><Users size={12} style={{ verticalAlign: -1 }} /> Guru</>}
                {profile.name && ` · ${profile.name}`}
              </span>
              <button className="btn-ghost" onClick={logout}><LogOut size={14} /> Keluar</button>
            </div>
          </div>

          {profile.role === "siswa" && (
            <>
              <div className="body-area">
                {!progressLoaded && (
                  <div className="card" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}>
                    <Loader2 size={16} className="spin" /> Memuat progress belajarmu...
                  </div>
                )}

                {progressLoaded && screen === "dashboard" && (
                  <div className="card">
                    <div className="tag-eyebrow">Dashboard Siswa</div>
                    <h2 className="disp" style={{ fontSize: 19 }}>Halo, {profile.name || "Siswa"} 👋</h2>
                    <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 14 }}>Semangat belajar hari ini.</p>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Progress keseluruhan</div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: overallPct + "%", background: "var(--brand)" }} /></div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 18 }}>{overallPct}%</div>
                    {CONCEPT_ORDER.map((c) => {
                      const st = statuses[c]; const m = computeMastery(attempts[c]);
                      return (
                        <div key={c} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                          <span>{CONCEPTS[c].name}</span>
                          <span className="pill" style={{ background: toneColor[st.tone] + "22", color: toneColor[st.tone] }}>{st.label}{m !== null && ` · ${Math.round(m * 100)}%`}</span>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 18 }}>
                      <button className="btn-primary" onClick={goStudy}>Lanjut Belajar <ArrowRight size={15} /></button>
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "materi" && (
                  <div className="card">
                    {redirectNote && <div className="misc-item" style={{ marginBottom: 12 }}>↳ {redirectNote}</div>}
                    <div className="tag-eyebrow">Materi · {CONCEPTS[activeConcept].name}</div>
                    <div className="qtext">{MATERI[activeConcept].formula}</div>
                    <p style={{ fontSize: 14, lineHeight: 1.6 }}>{MATERI[activeConcept].penjelasan}</p>
                    <div style={{ background: "var(--paper-2)", borderRadius: 10, padding: 14, marginTop: 10, fontFamily: "'IBM Plex Mono'", fontSize: 14 }}>
                      Contoh: {MATERI[activeConcept].contoh}
                    </div>
                    <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                      <button className="btn-ghost" onClick={() => setScreen("dashboard")}><ArrowLeft size={14} /> Kembali</button>
                      <button className="btn-primary" onClick={() => setScreen("latihan")}>Latihan <ArrowRight size={15} /></button>
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "latihan" && (
                  <div className="card">
                    <div className="tag-eyebrow">Latihan · {CONCEPTS[activeConcept].name} · Salah berturut-turut: {consecWrong}</div>
                    <div className="qtext">{currentQ().text}</div>
                    {currentQ().options.map((opt, i) => (
                      <button key={i} className={"opt" + (selected === i ? " picked" : "")} onClick={() => setSelected(i)}>{opt.text}</button>
                    ))}
                    <div style={{ marginTop: 14 }}>
                      <button className="btn-primary" disabled={selected === null} onClick={submitAnswer}>Periksa Jawaban <ArrowRight size={15} /></button>
                    </div>
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
                      {diag.correct ? (
                        <button className="btn-primary" onClick={afterDiagnosisCorrectOrResolved}>Lanjut <ArrowRight size={15} /></button>
                      ) : (
                        <button className="btn-primary" onClick={goToHint}><Lightbulb size={15} /> Lihat Hint</button>
                      )}
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

                {progressLoaded && screen === "profil" && (
                  <div className="card">
                    <div className="tag-eyebrow">Profil</div>
                    <h2 className="disp" style={{ fontSize: 19 }}>{profile.name || "Siswa"}</h2>
                    <p style={{ color: "var(--muted)", fontSize: 13.5 }}>Progress keseluruhan: {overallPct}%</p>
                    <button className="btn-ghost" onClick={logout} style={{ marginTop: 10 }}><LogOut size={14} /> Keluar</button>
                  </div>
                )}
              </div>

              <div className="bottomnav">
                <button className={"navbtn" + (screen === "dashboard" ? " active" : "")} onClick={() => setScreen("dashboard")}><LayoutDashboard size={18} />Dashboard</button>
                <button className={"navbtn" + (screen === "materi" ? " active" : "")} onClick={goStudy}><BookOpen size={18} />Belajar</button>
                <button className={"navbtn" + (screen === "latihan" || screen === "diagnosis" || screen === "hint" ? " active" : "")} onClick={() => setScreen("latihan")}><PenLine size={18} />Latihan</button>
                <button className={"navbtn" + (screen === "progress" ? " active" : "")} onClick={() => setScreen("progress")}><TrendingUp size={18} />Progress</button>
                <button className={"navbtn" + (screen === "profil" ? " active" : "")} onClick={() => setScreen("profil")}><User size={18} />Profil</button>
              </div>
            </>
          )}

          {profile.role === "guru" && (
            <div className="body-area">
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <button className={"tabbtn" + (guruTab === "beranda" ? " active" : "")} onClick={() => setGuruTab("beranda")}><Users size={13} style={{ verticalAlign: -2 }} /> Beranda</button>
                  <button className={"tabbtn" + (guruTab === "analitik" ? " active" : "")} onClick={() => setGuruTab("analitik")}><TrendingUp size={13} style={{ verticalAlign: -2 }} /> Analitik</button>
                  <button className={"tabbtn" + (guruTab === "materi" ? " active" : "")} onClick={() => setGuruTab("materi")}><Database size={13} style={{ verticalAlign: -2 }} /> Materi (Knowledge Base)</button>
                </div>
                <button className="btn-ghost" onClick={loadGuruData} disabled={guruLoading}>
                  {guruLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Muat ulang data
                </button>
              </div>

              {guruTab === "beranda" && (
                <div className="card">
                  <div className="tag-eyebrow">Dashboard Guru — data siswa dari database</div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, marginBottom: 18 }}>
                    <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Total siswa</div><div className="disp" style={{ fontSize: 22 }}>{guruStudents.length}</div></div>
                    <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Rata-rata penguasaan</div><div className="disp" style={{ fontSize: 22 }}>{guruAvgPct}%</div></div>
                    <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Konsep tersulit</div><div className="disp" style={{ fontSize: 16 }}>{guruHardestConcept}</div></div>
                  </div>
                  {guruStudents.length === 0 && !guruLoading && (
                    <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Belum ada siswa yang terdaftar, atau belum ada aktivitas belajar.</p>
                  )}
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

                  {guruStudents.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div className="tag-eyebrow">Daftar siswa</div>
                      <table>
                        <thead><tr><th>Nama</th><th>Progress</th></tr></thead>
                        <tbody>
                          {guruStudents.map((s) => (
                            <tr key={s.uid}><td>{s.name}</td><td>{overallPctOf(s.attempts)}%</td></tr>
                          ))}
                        </tbody>
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
                        {Object.entries(counts).map(([tag, n]) => (
                          <div className="misc-item" key={tag} style={{ display: "inline-block", marginRight: 6 }}>{tag} × {n}</div>
                        ))}
                      </div>
                    );
                  })}
                  <div className="tag-eyebrow" style={{ marginTop: 14 }}>Catatan</div>
                  <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Data diagregasi langsung dari akun-akun siswa yang tersimpan di database.</p>
                </div>
              )}

              {guruTab === "materi" && (
                <div className="card">
                  <div className="tag-eyebrow">Knowledge Base — contoh entri</div>
                  <table>
                    <thead><tr><th>ID</th><th>Nama konsep</th><th>Deskripsi</th><th>Prasyarat</th><th>Status</th></tr></thead>
                    <tbody>
                      {KB_ROWS.map((r) => (
                        <tr key={r.id}><td className="mono">{r.id}</td><td>{r.nama}</td><td>{r.deskripsi}</td><td className="mono">{r.prereq}</td><td>{r.status}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
