// ==============================
// 英単語帳アプリ
// ==============================
// PC側：ここで単語を登録 → 「JSONで書き出し」→ words.json を
//        GitHubリポジトリのルートにアップロード（上書き）
// iPhone側：閲覧専用。words.json をfetchして表示するだけ。
//
// データの優先順位（起動時）:
//   1. このブラウザのlocalStorageに編集履歴があればそれを使う（PCでの継続編集用）
//   2. なければ words.json をfetchして使う（iPhoneなど閲覧専用端末はここ）
//   3. それも無ければ初期サンプルを使う

const STORAGE_KEY = "enVocabWords";
const JSON_FILE = "words.json";

// 初期サンプル（words.jsonもlocalStorageも無い、初回起動時だけ使う）
const SEED_WORDS = [
  { id: crypto.randomUUID(), word: "delicious", pronounce: "dɪˈlɪʃəs", meaning: "おいしい、うまい", known: false },
  { id: crypto.randomUUID(), word: "negotiate", pronounce: "nɪˈɡoʊʃieɪt", meaning: "交渉する", known: false },
  { id: crypto.randomUUID(), word: "reliable", pronounce: "rɪˈlaɪəbl", meaning: "信頼できる、頼りになる", known: false },
  { id: crypto.randomUUID(), word: "postpone", pronounce: "poʊstˈpoʊn", meaning: "延期する", known: false },
  { id: crypto.randomUUID(), word: "efficient", pronounce: "ɪˈfɪʃənt", meaning: "効率的な、能率のよい", known: false },
];

// ------------------------------
// 状態管理
// ------------------------------
let words = [];
let studyQueue = [];
let currentIndex = 0;

async function initWords() {
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      words = JSON.parse(local);
      setSourceBadge("このブラウザに保存されたデータを表示中（編集OK）");
      return;
    } catch (e) {
      console.warn("localStorageの読み込みに失敗", e);
    }
  }

  // localStorageが無い場合は words.json を試す
  try {
    const res = await fetch(JSON_FILE, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // words.jsonにidが無い場合があるので、無ければ振る
        words = data.map((w) => ({ id: w.id || crypto.randomUUID(), ...w }));
        setSourceBadge("words.json を読み込み中（閲覧用）");
        return;
      }
    }
  } catch (e) {
    // words.jsonが無い・読めない場合は初期サンプルへフォールバック
  }

  words = structuredClone(SEED_WORDS);
  setSourceBadge("初期サンプルを表示中");
}

function setSourceBadge(text) {
  const el = document.getElementById("sourceBadge");
  if (el) el.textContent = text;
}

function saveWords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  setSourceBadge("このブラウザに保存されたデータを表示中（編集OK）");
}

// ------------------------------
// タブ切り替え
// ------------------------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "manage") renderTable();
  });
});

// ------------------------------
// 学習キューの構築
// ------------------------------
const orderSelect = document.getElementById("orderSelect");

function buildQueue() {
  const order = orderSelect.value;
  let list = [...words];

  if (order === "shuffle") {
    list = shuffle(list);
  } else if (order === "unknownFirst") {
    list = list.sort((a, b) => Number(a.known) - Number(b.known));
  }

  studyQueue = list;
  currentIndex = 0;
  showCard();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

orderSelect.addEventListener("change", buildQueue);

// ------------------------------
// カード表示
// ------------------------------
const flashcard = document.getElementById("flashcard");
const frontText = document.getElementById("frontText");
const backPronounce = document.getElementById("backPronounce");
const backMeaning = document.getElementById("backMeaning");
const progressText = document.getElementById("progressText");

function showCard() {
  flashcard.classList.remove("flipped");

  if (studyQueue.length === 0) {
    frontText.textContent = "単語がありません。「単語管理」タブから追加してな";
    backPronounce.textContent = "";
    backMeaning.textContent = "";
    progressText.textContent = "0 / 0";
    return;
  }

  const w = studyQueue[currentIndex];
  frontText.textContent = w.word;
  backPronounce.textContent = w.pronounce ? "🔊 " + w.pronounce : "";
  backMeaning.textContent = w.meaning;

  progressText.textContent = `${currentIndex + 1} / ${studyQueue.length}`;
}

flashcard.addEventListener("click", () => {
  flashcard.classList.toggle("flipped");
});

document.getElementById("btnNext").addEventListener("click", () => {
  if (studyQueue.length === 0) return;
  currentIndex = (currentIndex + 1) % studyQueue.length;
  showCard();
});

document.getElementById("btnPrev").addEventListener("click", () => {
  if (studyQueue.length === 0) return;
  currentIndex = (currentIndex - 1 + studyQueue.length) % studyQueue.length;
  showCard();
});

// ------------------------------
// 判定（わかった / もう一回）
// ------------------------------
document.getElementById("btnKnown").addEventListener("click", () => judge(true));
document.getElementById("btnUnknown").addEventListener("click", () => judge(false));

function judge(known) {
  if (studyQueue.length === 0) return;
  const w = studyQueue[currentIndex];
  const target = words.find((x) => x.id === w.id);
  if (target) target.known = known;
  saveWords();
  updateStats();

  currentIndex = (currentIndex + 1) % studyQueue.length;
  showCard();
}

// ------------------------------
// 統計
// ------------------------------
function updateStats() {
  document.getElementById("statTotal").textContent = words.length;
  document.getElementById("statKnown").textContent = words.filter((w) => w.known).length;
}

// ------------------------------
// 単語管理タブ：追加フォーム
// ------------------------------
document.getElementById("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const word = document.getElementById("inputWord").value.trim().slice(0, 50);
  const pronounce = document.getElementById("inputPronounce").value.trim().slice(0, 50);
  const meaning = document.getElementById("inputMeaning").value.trim().slice(0, 1000);

  if (!word || !meaning) return;

  words.push({ id: crypto.randomUUID(), word, pronounce, meaning, known: false });
  saveWords();

  e.target.reset();
  renderTable();
  updateStats();
  buildQueue();
});

// ------------------------------
// 単語管理タブ：一覧テーブル
// ------------------------------
function renderTable() {
  const tbody = document.getElementById("wordTableBody");
  tbody.innerHTML = "";

  words.forEach((w) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(w.word)}</td>
      <td>${escapeHtml(w.pronounce || "")}</td>
      <td>${escapeHtml(w.meaning)}</td>
      <td><span class="badge ${w.known ? "badge-known" : "badge-unknown"}">${w.known ? "覚えた" : "未習得"}</span></td>
      <td><button class="delete-btn" data-id="${w.id}">削除</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("wordCount").textContent = words.length;

  tbody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      words = words.filter((w) => w.id !== btn.dataset.id);
      saveWords();
      renderTable();
      updateStats();
      buildQueue();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ------------------------------
// 書き出し・リセット
// ------------------------------
document.getElementById("btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(words, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = JSON_FILE;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btnResetProgress").addEventListener("click", () => {
  if (!confirm("全単語の「覚えた」状態をリセットするで。ええか？")) return;
  words.forEach((w) => (w.known = false));
  saveWords();
  renderTable();
  updateStats();
  buildQueue();
});

// ------------------------------
// 初期化
// ------------------------------
initWords().then(() => {
  updateStats();
  renderTable();
  buildQueue();
});