import { useEffect, useMemo, useRef, useState } from "react";

/**
 * ВАЖНО: твоя ссылка Apps Script (Web App /exec)
 * (я уже вставил ту, что ты прислал)
 */
const API_URL =
  "https://script.google.com/macros/s/AKfycbyfyPWd_nFRv0ttoTC1yUXL3cBUFRLGyzzsDxzk5Ju2_YUDMwq_LkFeo52I0xzcr1y4/exec";

/**
 * PIN нигде не создаём. Всегда только ВВОД.
 * PIN хранится только в облаке (Apps Script). Здесь — только в sessionStorage для удобства.
 */
const PIN_SESSION_KEY = "mt_pin_session";

const ICONS_EXPENSE = [
  { e: "🍔", c: "#f59e0b" }, { e: "🛒", c: "#22c55e" }, { e: "🚕", c: "#fbbf24" },
  { e: "🚇", c: "#60a5fa" }, { e: "⛽️", c: "#fb7185" }, { e: "🏠", c: "#a78bfa" },
  { e: "📱", c: "#38bdf8" }, { e: "💊", c: "#34d399" }, { e: "👕", c: "#f472b6" },
  { e: "🎮", c: "#c084fc" }, { e: "🎬", c: "#fda4af" }, { e: "🎁", c: "#fb7185" },
  { e: "📦", c: "#f97316" }, { e: "💡", c: "#facc15" }, { e: "🧾", c: "#94a3b8" },
  { e: "✈️", c: "#22d3ee" }, { e: "🐶", c: "#fda4af" }, { e: "🏋️", c: "#34d399" },
  { e: "☕️", c: "#f59e0b" }, { e: "🍷", c: "#fb7185" }, { e: "🎓", c: "#60a5fa" },
  { e: "🧴", c: "#34d399" }, { e: "🧰", c: "#a78bfa" }, { e: "🧃", c: "#f97316" },
  { e: "🍫", c: "#f59e0b" }, { e: "🐱", c: "#fda4af" }, { e: "🧑‍⚕️", c: "#34d399" },
  { e: "🧑‍💻", c: "#38bdf8" }, { e: "📚", c: "#a78bfa" }, { e: "🧸", c: "#f472b6" }
];

const ICONS_INCOME = [
  { e: "💼", c: "#34d399" }, { e: "💰", c: "#22c55e" }, { e: "📈", c: "#38bdf8" },
  { e: "🤝", c: "#22d3ee" }, { e: "🎁", c: "#f472b6" }, { e: "🏦", c: "#60a5fa" },
  { e: "🧾", c: "#94a3b8" }, { e: "🪙", c: "#facc15" }, { e: "🚀", c: "#a78bfa" },
  { e: "🎯", c: "#fb7185" }, { e: "💳", c: "#38bdf8" }, { e: "🛠️", c: "#34d399" }
];

const DEFAULT_DATA = {
  labels: {
    appName: "Мой бюджет",
    appTagline: "Фиксируй доходы и расходы — смотри отчёты",
    tabHome: "Дом",
    tabOps: "Операции",
    tabReports: "Отчёты",
    tabSettings: "Настройки",
    homeOpsTitle: "Операции за сегодня",
    opsTitle: "Все операции",
    reportsTitle: "Отчёты",
    settingsTitle: "Настройки",
  },
  categories: {
    expense: [
      { id: "e_food", name: "Еда", icon: "🍔", color: "#f59e0b" },
      { id: "e_taxi", name: "Такси", icon: "🚕", color: "#fbbf24" },
      { id: "e_shop", name: "Покупки", icon: "🛒", color: "#22c55e" },
    ],
    income: [
      { id: "i_salary", name: "Зарплата", icon: "💼", color: "#34d399" },
      { id: "i_side", name: "Подработка", icon: "🤝", color: "#22d3ee" },
    ],
  },
  items: [],
};

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toISODate(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function formatMoney(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function sum(items, type) {
  return items.filter((x) => x.type === type).reduce((s, x) => s + (Number(x.amount) || 0), 0);
}

function fmtMskDateTime(ts) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString("ru-RU");
  }
}

async function apiGet(pin) {
  const res = await fetch(`${API_URL}?pin=${encodeURIComponent(pin)}`, { method: "GET" });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (!res.ok) throw new Error("cloud not ok");
  if (parsed && parsed.ok === false) throw new Error(parsed.error || "bad pin");
  // если вернулся сам data.json без ok — это норм
  return parsed || DEFAULT_DATA;
}

async function apiSave(pin, data) {
  const res = await fetch(`${API_URL}?pin=${encodeURIComponent(pin)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (!res.ok) throw new Error("cloud save failed");
  if (parsed && parsed.ok === false) throw new Error(parsed.error || "save error");
  return true;
}

async function apiSetPin(oldPin, newPin) {
  const res = await fetch(`${API_URL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setPin", oldPin, newPin }),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (!res.ok) throw new Error("setPin failed");
  if (parsed && parsed.ok === false) throw new Error(parsed.error || "setPin error");
  return true;
}

function EditableText({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => setTemp(value), [value]);
  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 30);
  }, [editing]);

  if (!editing) {
    return (
      <span className="editable">
        <span className="editableText">{value}</span>
        <button className="iconbtn" title="Изменить" onClick={() => setEditing(true)}>✏️</button>
      </span>
    );
  }

  return (
    <span className="editable">
      <input
        ref={inputRef}
        className="input"
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onChange(temp.trim() || value); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button className="iconbtn" title="Сохранить" onClick={() => { onChange(temp.trim() || value); setEditing(false); }}>
        ✅
      </button>
    </span>
  );
}

function IconPicker({ open, onClose, icons, selected, onPick, title }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="h">{title}</div>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>

        <div className="iconGrid">
          {icons.map((ic, idx) => {
            const active = selected?.e === ic.e && selected?.c === ic.c;
            return (
              <button
                key={idx}
                className={"iconCell" + (active ? " active" : "")}
                onClick={() => { onPick(ic); onClose(); }}
                title="Выбрать"
              >
                <span className="badge" style={{ background: ic.c + "22", borderColor: ic.c + "55" }}>{ic.e}</span>
              </button>
            );
          })}
        </div>

        <div className="hintSmall">Прокручивай вниз и выбирай иконку — на телефоне всё видно.</div>
      </div>
    </div>
  );
}

function CategorySelectModal({ open, onClose, categories, onSelect }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="h">Выбор категории</div>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>

        <div className="catGrid">
          {categories.map((c) => (
            <button key={c.id} className="catRow" onClick={() => { onSelect(c.id); onClose(); }}>
              <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "55" }}>{c.icon}</span>
              <span className="catRowTitle">{c.name}</span>
              <span className="pill">✓</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Donut({ parts, totalLabel, subtitle }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const ratios = parts.map((p) => (total ? p.value / total : 0));
  const stops = [];
  let acc = 0;

  for (let i = 0; i < parts.length; i++) {
    const start = acc;
    acc += ratios[i];
    stops.push({ start, end: acc, color: parts[i].color });
  }

  const gradient = stops.length
    ? `conic-gradient(${stops.map(s => `${s.color} ${Math.round(s.start * 100)}% ${Math.round(s.end * 100)}%`).join(", ")})`
    : `conic-gradient(#334155 0% 100%)`;

  return (
    <div className="donutWrap">
      <div className="donut" style={{ background: gradient }}>
        <div className="donutCenter">
          <div className="big">{totalLabel}</div>
          <div className="small">{subtitle}</div>
        </div>
      </div>

      <div className="legend">
        {parts.length === 0 ? (
          <div className="muted">Нет данных для выбранных фильтров.</div>
        ) : (
          parts.slice(0, 9).map((p, i) => (
            <div key={i} className="legRow">
              <div className="legLeft">
                <span className="dot" style={{ background: p.color }} />
                <span>{p.label}</span>
              </div>
              <div className="legAmt">{formatMoney(p.value)} ₽</div>
            </div>
          ))
        )}
        {parts.length > 9 && <div className="pill">+ ещё {parts.length - 9}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const todayISO = toISODate();

  // AUTH
  const [pinInput, setPinInput] = useState("");
  const [pin, setPin] = useState(() => sessionStorage.getItem(PIN_SESSION_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [cloudMsg, setCloudMsg] = useState("Облако: не подключено");

  // DATA
  const [data, setData] = useState(DEFAULT_DATA);
  const { labels, categories, items } = data;

  // UI tabs
  const [tab, setTab] = useState("home"); // home|ops|reports|settings

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [catPickOpen, setCatPickOpen] = useState(false);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [iconPickOpen, setIconPickOpen] = useState(false);

  // motivate
  const [motivate, setMotivate] = useState(false);

  // add form
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO);
  const [categoryId, setCategoryId] = useState(categories.expense[0]?.id || "");
  const [note, setNote] = useState("");

  // categories manage
  const [catMode, setCatMode] = useState("expense");
  const [newCatName, setNewCatName] = useState("");
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [pendingIcon, setPendingIcon] = useState(null);
  const [toast, setToast] = useState("");

  // ops filters (apply)
  const [opsTab, setOpsTab] = useState("all"); // expense|all|income
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fQueryDraft, setFQueryDraft] = useState("");
  const [fQuery, setFQuery] = useState("");
  const [fCatIds, setFCatIds] = useState([]);

  // reports filters (month/year wheel not тут — делаем проще и стабильно: диапазон дат как ты просил раньше)
  const [rType, setRType] = useState("all"); // expense|all|income
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");
  const [rCatIds, setRCatIds] = useState([]);

  // settings: change pin
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");

  // toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto login if session pin exists
  useEffect(() => {
    if (!pin) return;
    (async () => {
      try {
        setCloudMsg("Облако: подключение…");
        const cloud = await apiGet(pin);
        setData(mergeCloud(cloud));
        setAuthed(true);
        setCloudMsg("Облако: подключено ✅");
      } catch (e) {
        sessionStorage.removeItem(PIN_SESSION_KEY);
        setPin("");
        setAuthed(false);
        setCloudMsg("Облако: не подключено");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mergeCloud(cloud) {
    // мягко доклеиваем labels/структуру
    return {
      labels: { ...DEFAULT_DATA.labels, ...(cloud.labels || {}) },
      categories: {
        expense: Array.isArray(cloud.categories?.expense) && cloud.categories.expense.length
          ? cloud.categories.expense
          : DEFAULT_DATA.categories.expense,
        income: Array.isArray(cloud.categories?.income) && cloud.categories.income.length
          ? cloud.categories.income
          : DEFAULT_DATA.categories.income,
      },
      items: Array.isArray(cloud.items) ? cloud.items : [],
    };
  }

  async function tryLogin(pinTry) {
    const p = String(pinTry || "").trim();
    if (!/^\d{4}$/.test(p)) {
      setToast("PIN должен быть 4 цифры");
      return;
    }
    try {
      setCloudMsg("Облако: подключение…");
      const cloud = await apiGet(p);
      setData(mergeCloud(cloud));
      setPin(p);
      sessionStorage.setItem(PIN_SESSION_KEY, p);
      setAuthed(true);
      setCloudMsg("Облако: подключено ✅");
      setPinInput("");
    } catch (e) {
      setAuthed(false);
      setCloudMsg("Облако: не подключено");
      setToast("PIN неверный или нет доступа");
    }
  }

  function logout() {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    setPin("");
    setAuthed(false);
    setTab("home");
    setToast("Вы вышли");
  }

  // cloud autosave (debounce)
  useEffect(() => {
    if (!authed || !pin) return;
    const t = setTimeout(async () => {
      try {
        await apiSave(pin, data);
        setCloudMsg("Облако: синхронизировано ✅");
      } catch (e) {
        setCloudMsg("Облако: ошибка синхронизации ⚠️");
      }
    }, 450);
    return () => clearTimeout(t);
  }, [data, authed, pin]);

  // Add modal reset
  useEffect(() => {
    if (!addOpen) return;
    const now = toISODate();
    setType("expense");
    setAmount("");
    setDate(now);
    setCategoryId(categories.expense[0]?.id || "");
    setNote("");
  }, [addOpen, categories.expense]);

  // Change category when type changed
  useEffect(() => {
    if (!addOpen) return;
    const list = type === "income" ? categories.income : categories.expense;
    setCategoryId(list[0]?.id || "");
  }, [type, addOpen, categories.expense, categories.income]);

  function categoryById(typeKey, id) {
    const list = typeKey === "income" ? categories.income : categories.expense;
    return list.find((c) => c.id === id) || list[0] || null;
  }

  // HOME computed
  const todayItems = useMemo(() => items.filter((x) => x.date === todayISO), [items, todayISO]);
  const todayIncome = useMemo(() => sum(todayItems, "income"), [todayItems]);
  const todayExpense = useMemo(() => sum(todayItems, "expense"), [todayItems]);
  const todayNet = todayIncome - todayExpense;

  // add tx
  function addTransaction() {
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0) { setToast("Введите сумму больше 0"); return; }

    const tx = {
      id: uid(),
      type: type === "income" ? "income" : "expense",
      amount: value,
      date: date || todayISO,
      categoryId: categoryId || "",
      note: (note || "").trim(),
      createdAt: Date.now(),
    };

    setData((prev) => ({ ...prev, items: [...prev.items, tx] }));
    setAddOpen(false);

    if (tx.type === "income") {
      setMotivate(true);
      setTimeout(() => setMotivate(false), 1800); // УВЕЛИЧИЛ время мотивации
    }
  }

  function removeTx(id) {
    if (!confirm("Удалить операцию?")) return;
    setData((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== id) }));
  }

  // categories CRUD
  function openManageCats(mode = "expense") {
    setCatMode(mode);
    setManageCatsOpen(true);
    setNewCatName("");
    setEditCatId(null);
    setEditCatName("");
    setPendingIcon(null);
  }

  function addCategory() {
    const name = newCatName.trim();
    if (!name) { setToast("Введите название категории"); return; }

    const pool = catMode === "income" ? ICONS_INCOME : ICONS_EXPENSE;
    const picked = pool[Math.floor(Math.random() * pool.length)];

    const newCat = { id: uid(), name, icon: picked.e, color: picked.c };

    setData((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catMode]: [newCat, ...prev.categories[catMode]],
      },
    }));

    setNewCatName("");
    setToast("Категория добавлена ✅");
  }

  function startEditCat(c) {
    setEditCatId(c.id);
    setEditCatName(c.name);
    setPendingIcon({ e: c.icon, c: c.color });
  }

  function saveEditCat() {
    if (!editCatId) return;
    const name = editCatName.trim();
    if (!name) { setToast("Название не может быть пустым"); return; }

    setData((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catMode]: prev.categories[catMode].map((c) =>
          c.id === editCatId
            ? { ...c, name, icon: pendingIcon?.e || c.icon, color: pendingIcon?.c || c.color }
            : c
        ),
      },
    }));

    setEditCatId(null);
    setEditCatName("");
    setPendingIcon(null);
    setToast("Сохранено ✅");
  }

  function deleteCategory(id) {
    const list = categories[catMode];
    if (list.length <= 1) { setToast("Нельзя удалить последнюю категорию"); return; }
    if (!confirm("Удалить категорию?")) return;

    setData((prev) => {
      const nextCats = prev.categories[catMode].filter((c) => c.id !== id);
      const fallbackId = nextCats[0]?.id || "";
      const nextItems = prev.items.map((x) => {
        if (x.type === (catMode === "income" ? "income" : "expense") && x.categoryId === id) {
          return { ...x, categoryId: fallbackId };
        }
        return x;
      });
      return {
        ...prev,
        categories: { ...prev.categories, [catMode]: nextCats },
        items: nextItems,
      };
    });
  }

  // Ops apply filters
  function applyOpsFilters() {
    setFQuery(fQueryDraft);
    setToast("Фильтры применены ✅");
  }

  function resetOpsFilters() {
    setOpsTab("all");
    setFFrom("");
    setFTo("");
    setFQueryDraft("");
    setFQuery("");
    setFCatIds([]);
    setToast("Сброс ✅");
  }

  const catOptionsForFilters = useMemo(() => {
    const exp = categories.expense.map((c) => ({ ...c, type: "expense" }));
    const inc = categories.income.map((c) => ({ ...c, type: "income" }));
    return [...exp, ...inc];
  }, [categories]);

  const filteredOps = useMemo(() => {
    let arr = [...items];

    if (opsTab !== "all") arr = arr.filter((x) => x.type === opsTab);
    if (fFrom) arr = arr.filter((x) => x.date >= fFrom);
    if (fTo) arr = arr.filter((x) => x.date <= fTo);
    if (fQuery.trim()) {
      const q = fQuery.trim().toLowerCase();
      arr = arr.filter((x) => (x.note || "").toLowerCase().includes(q));
    }
    if (fCatIds.length) arr = arr.filter((x) => fCatIds.includes(x.categoryId));

    arr.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1;
    });

    return arr;
  }, [items, opsTab, fFrom, fTo, fQuery, fCatIds]);

  // Reports — показываем НОЛЬ пока не выбран диапазон дат
  const reportReady = Boolean(rFrom && rTo);

  const reportItems = useMemo(() => {
    if (!reportReady) return [];
    let arr = items.filter((x) => x.date >= rFrom && x.date <= rTo);
    if (rType !== "all") arr = arr.filter((x) => x.type === rType);
    if (rCatIds.length) arr = arr.filter((x) => rCatIds.includes(x.categoryId));
    arr.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1;
    });
    return arr;
  }, [items, rFrom, rTo, rType, rCatIds, reportReady]);

  const reportTotal = useMemo(
    () => reportItems.reduce((s, x) => s + (Number(x.amount) || 0), 0),
    [reportItems]
  );

  const donutParts = useMemo(() => {
    if (!reportReady) return [];
    const map = new Map();
    for (const x of reportItems) {
      map.set(x.categoryId, (map.get(x.categoryId) || 0) + (Number(x.amount) || 0));
    }
    const list = Array.from(map.entries()).map(([catId, amount]) => {
      const cat = categoryById(
        (rType === "income" ? "income" : rType === "expense" ? "expense" : (categoryById("income", catId) ? "income" : "expense")),
        catId
      );
      return {
        label: `${cat?.icon || "🏷️"} ${cat?.name || "Категория"}`,
        value: amount,
        color: cat?.color || "#94a3b8",
      };
    });
    list.sort((a, b) => b.value - a.value);
    return list;
  }, [reportItems, reportReady, rType]);

  function resetReports() {
    setRFrom("");
    setRTo("");
    setRType("all");
    setRCatIds([]);
    setToast("Сброс ✅");
  }

  async function changePin() {
    const o = String(oldPin).trim();
    const n = String(newPin).trim();
    if (!/^\d{4}$/.test(o) || !/^\d{4}$/.test(n)) { setToast("PIN должен быть 4 цифры"); return; }
    try {
      await apiSetPin(o, n);
      setToast("PIN изменён ✅");
      setOldPin("");
      setNewPin("");
      // если текущий pin = старый, обновим сессию
      if (pin === o) {
        setPin(n);
        sessionStorage.setItem(PIN_SESSION_KEY, n);
      }
    } catch (e) {
      setToast("Не удалось сменить PIN");
    }
  }

  // LOGIN SCREEN (ONLY INPUT, no creation)
  if (!authed) {
    return (
      <div className="app">
        {toast && <div className="toast">{toast}</div>}
        <div className="container">
          <div className="card">
            <div className="card-title">
              <div className="h">🔒 Вход</div>
              <div className="pill">облако</div>
            </div>

            <div className="muted" style={{ lineHeight: 1.55 }}>
              Введите PIN (4 цифры), чтобы открыть приложение.
            </div>

            <div style={{ height: 14 }} />

            <div className="field">
              <div className="label">PIN</div>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                onKeyDown={(e) => { if (e.key === "Enter") tryLogin(pinInput); }}
              />
            </div>

            <div style={{ height: 12 }} />
            <button className="btn btn-primary bigBtn" onClick={() => tryLogin(pinInput)}>
              Войти
            </button>

            <div style={{ height: 10 }} />
            <div className="hintSmall">
              На новом устройстве всегда будет только ввод PIN (без создания).
            </div>

            <div style={{ height: 10 }} />
            <div className="pill">{cloudMsg}</div>
          </div>
        </div>
      </div>
    );
  }

  const currentCats = type === "income" ? categories.income : categories.expense;
  const pickIconPool = catMode === "income" ? ICONS_INCOME : ICONS_EXPENSE;

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {motivate && (
        <div className="motivate">
          <div className="pop">🎉 Доход добавлен! Так держать! 💪</div>
        </div>
      )}

      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-title">
              <EditableText
                value={labels.appName}
                onChange={(v) => setData((p) => ({ ...p, labels: { ...p.labels, appName: v } }))}
              />
            </div>
            <div className="brand-sub">
              <EditableText
                value={labels.appTagline}
                onChange={(v) => setData((p) => ({ ...p, labels: { ...p.labels, appTagline: v } }))}
              />
            </div>
          </div>

          {/* КНОПКУ +Добавить в правом верхнем углу УБРАЛИ по твоей правке */}
        </div>
      </div>

      <div className="container">
        {/* HOME */}
        {tab === "home" && (
          <div className="card">
            <div className="centerDate">
              <div className="centerDateBig">
                {new Intl.DateTimeFormat("ru-RU", {
                  timeZone: "Europe/Moscow",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date())}
              </div>
              <div className="centerDateSmall">
                {new Intl.DateTimeFormat("ru-RU", {
                  timeZone: "Europe/Moscow",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }).format(new Date())}{" "}
                МСК
              </div>
            </div>

            <div className="bigAddWrap">
              <button className="bigAdd" onClick={() => setAddOpen(true)}>
                ✨ Добавить операцию
              </button>
            </div>

            <div style={{ height: 12 }} />

            <div className="kpis">
              <div className="kpi">
                <div className="kpi-label">Доходы</div>
                <div className="kpi-value"><span className="pos">+{formatMoney(todayIncome)} ₽</span></div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Расходы</div>
                <div className="kpi-value"><span className="neg">-{formatMoney(todayExpense)} ₽</span></div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Итог</div>
                <div className="kpi-value">
                  <span className={todayNet >= 0 ? "pos" : "neg"}>
                    {todayNet >= 0 ? "+" : ""}{formatMoney(todayNet)} ₽
                  </span>
                </div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="card-title">
              <div className="h">{labels.homeOpsTitle}</div>
              <div className="pill">{todayItems.length} шт.</div>
            </div>

            {todayItems.length === 0 ? (
              <div className="muted">Пока пусто. Нажми “Добавить операцию”.</div>
            ) : (
              <div className="list">
                {todayItems
                  .slice()
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                  .map((x) => {
                    const cat = categoryById(x.type, x.categoryId);
                    return (
                      <div className="item" key={x.id}>
                        <div className="item-left">
                          <div className="item-title">
                            <span className="badge" style={{ background: (cat?.color || "#94a3b8") + "22", borderColor: (cat?.color || "#94a3b8") + "55" }}>
                              {cat?.icon || "🏷️"}
                            </span>
                            {cat?.name || "Категория"}
                            <span className="pill smallPill">{fmtMskDateTime(x.createdAt)}</span>
                          </div>
                          <div className="item-sub">{x.note || (x.type === "income" ? "Доход" : "Расход")}</div>
                        </div>

                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          <div className={`amount ${x.type === "income" ? "pos" : "neg"}`}>
                            {x.type === "income" ? "+" : "-"}{formatMoney(x.amount)} ₽
                          </div>
                          <button className="iconbtn" onClick={() => removeTx(x.id)} title="Удалить">🗑️</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* OPS */}
        {tab === "ops" && (
          <div className="card">
            <div className="card-title">
              <div className="h">{labels.opsTitle}</div>
              <div className="pill">{filteredOps.length} шт.</div>
            </div>

            {/* Расходы - Все - Доходы */}
            <div className="seg3" style={{ marginBottom: 12 }}>
              <button className={opsTab === "expense" ? "active" : ""} onClick={() => setOpsTab("expense")}>Расходы</button>
              <button className={opsTab === "all" ? "active" : ""} onClick={() => setOpsTab("all")}>Все</button>
              <button className={opsTab === "income" ? "active" : ""} onClick={() => setOpsTab("income")}>Доходы</button>
            </div>

            <div className="split">
              <div className="field">
                <div className="label">Поиск по комментарию</div>
                <input
                  className="input"
                  placeholder="Например: помидор"
                  value={fQueryDraft}
                  onChange={(e) => setFQueryDraft(e.target.value)}
                />
                <div className="row">
                  <button className="btn btn-primary" onClick={applyOpsFilters}>Применить</button>
                  <button className="btn" onClick={resetOpsFilters}>Сброс</button>
                </div>
              </div>

              <div className="field">
                <div className="label">Диапазон дат</div>
                <div className="row" style={{ width: "100%" }}>
                  <input className="input" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
                  <input className="input" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
                </div>
                <div className="row">
                  <button className="btn btn-primary" onClick={applyOpsFilters}>Применить</button>
                  <button className="btn" onClick={resetOpsFilters}>Сброс</button>
                </div>
              </div>

              <div className="field">
                <div className="label">Категории (можно несколько)</div>
                <div className="chips">
                  {catOptionsForFilters.map((c) => {
                    const active = fCatIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={"chip" + (active ? " active" : "")}
                        onClick={() => setFCatIds((prev) => active ? prev.filter((id) => id !== c.id) : [...prev, c.id])}
                      >
                        <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "55" }}>{c.icon}</span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn btn-primary" onClick={applyOpsFilters}>Применить</button>
                  <button className="btn" onClick={() => { setFCatIds([]); setToast("Категории очищены"); }}>Очистить категории</button>
                </div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="pill">{cloudMsg}</div>
              <button className="btn btn-primary" onClick={() => openManageCats("expense")}>
                ⚙️ Категории
              </button>
            </div>

            <div style={{ height: 12 }} />

            {filteredOps.length === 0 ? (
              <div className="muted">Ничего не найдено по фильтрам.</div>
            ) : (
              <div className="list">
                {filteredOps.map((x) => {
                  const cat = categoryById(x.type, x.categoryId);
                  return (
                    <div className="item" key={x.id}>
                      <div className="item-left">
                        <div className="item-title">
                          <span className="badge" style={{ background: (cat?.color || "#94a3b8") + "22", borderColor: (cat?.color || "#94a3b8") + "55" }}>
                            {cat?.icon || "🏷️"}
                          </span>
                          {cat?.name || "Категория"}{" "}
                          <span className="pill smallPill">{x.date}</span>
                          <span className="pill smallPill">{fmtMskDateTime(x.createdAt)}</span>
                        </div>
                        <div className="item-sub">{x.note || (x.type === "income" ? "Доход" : "Расход")}</div>
                      </div>

                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <div className={`amount ${x.type === "income" ? "pos" : "neg"}`}>
                          {x.type === "income" ? "+" : "-"}{formatMoney(x.amount)} ₽
                        </div>
                        <button className="iconbtn" onClick={() => removeTx(x.id)} title="Удалить">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* REPORTS */}
        {tab === "reports" && (
          <div className="card">
            <div className="card-title">
              <div className="h">{labels.reportsTitle}</div>
              <div className="pill">{reportReady ? "Период выбран" : "Выбери период"}</div>
            </div>

            {/* Расходы - Все - Доходы */}
            <div className="seg3" style={{ marginBottom: 12 }}>
              <button className={rType === "expense" ? "active" : ""} onClick={() => setRType("expense")}>Расходы</button>
              <button className={rType === "all" ? "active" : ""} onClick={() => setRType("all")}>Все</button>
              <button className={rType === "income" ? "active" : ""} onClick={() => setRType("income")}>Доходы</button>
            </div>

            <div className="split">
              <div className="field">
                <div className="label">Диапазон дат</div>
                <div className="row" style={{ width: "100%" }}>
                  <input className="input" type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} />
                  <input className="input" type="date" value={rTo} onChange={(e) => setRTo(e.target.value)} />
                </div>
                <div className="row">
                  <button className="btn btn-primary" onClick={() => setToast("Период применён ✅")}>Применить</button>
                  <button className="btn" onClick={resetReports}>Сброс</button>
                </div>
              </div>

              <div className="field">
                <div className="label">Категории (можно несколько)</div>
                <div className="chips">
                  {(rType === "income" ? categories.income : rType === "expense" ? categories.expense : catOptionsForFilters).map((c) => {
                    const active = rCatIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={"chip" + (active ? " active" : "")}
                        onClick={() => setRCatIds((prev) => active ? prev.filter((id) => id !== c.id) : [...prev, c.id])}
                      >
                        <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "55" }}>{c.icon}</span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ height: 14 }} />

            {!reportReady ? (
              <div className="muted">
                Пока не выбран диапазон дат — отчёты обнулены.
              </div>
            ) : (
              <>
                <Donut
                  parts={donutParts}
                  totalLabel={`${formatMoney(reportTotal)} ₽`}
                  subtitle={rType === "income" ? "Всего доходов" : rType === "expense" ? "Всего расходов" : "Итого"}
                />

                <div style={{ height: 14 }} />

                {/* Список операций прямо в отчетах */}
                <div className="card" style={{ padding: 14, background: "rgba(255,255,255,0.05)" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div className="pill">Операции в периоде</div>
                    <div className="pill">{reportItems.length} шт.</div>
                  </div>

                  <div style={{ height: 10 }} />

                  {reportItems.length === 0 ? (
                    <div className="muted">Нет операций в выбранном диапазоне.</div>
                  ) : (
                    <div className="list">
                      {reportItems.slice(0, 60).map((x) => {
                        const cat = categoryById(x.type, x.categoryId);
                        return (
                          <div className="item" key={x.id}>
                            <div className="item-left">
                              <div className="item-title">
                                <span className="badge" style={{ background: (cat?.color || "#94a3b8") + "22", borderColor: (cat?.color || "#94a3b8") + "55" }}>
                                  {cat?.icon || "🏷️"}
                                </span>
                                {cat?.name || "Категория"}{" "}
                                <span className="pill smallPill">{x.date}</span>
                              </div>
                              <div className="item-sub">{x.note || (x.type === "income" ? "Доход" : "Расход")}</div>
                            </div>

                            <div className={`amount ${x.type === "income" ? "pos" : "neg"}`}>
                              {x.type === "income" ? "+" : "-"}{formatMoney(x.amount)} ₽
                            </div>
                          </div>
                        );
                      })}
                      {reportItems.length > 60 && <div className="pill">Показаны первые 60 операций</div>}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div className="card">
            <div className="card-title">
              <div className="h">{labels.settingsTitle}</div>
              <div className="pill">v1.0 • 01.02.2026</div>
            </div>

            <div className="card" style={{ padding: 16, background: "rgba(255,255,255,0.05)" }}>
              <div className="h" style={{ marginBottom: 8 }}>🔐 Смена PIN</div>
              <div className="split">
                <div className="field">
                  <div className="label">Старый PIN</div>
                  <input className="input" type="password" inputMode="numeric" placeholder="••••"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                  />
                </div>
                <div className="field">
                  <div className="label">Новый PIN</div>
                  <input className="input" type="password" inputMode="numeric" placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                  />
                </div>
              </div>
              <div style={{ height: 10 }} />
              <button className="btn btn-primary" onClick={changePin}>Сменить PIN</button>
              <div style={{ height: 10 }} />
              <div className="muted">PIN хранится в облаке. На новых устройствах будет только ввод PIN.</div>
            </div>

            <div style={{ height: 12 }} />

            <div className="card" style={{ padding: 16, background: "rgba(255,255,255,0.05)" }}>
              <div className="h" style={{ marginBottom: 8 }}>📲 На экран “Домой” (iPhone)</div>
              <div className="muted" style={{ lineHeight: 1.5 }}>
                Открой сайт в <b>Safari</b> → нажми <b>Поделиться</b> → <b>На экран “Домой”</b>.
              </div>
              <div style={{ height: 10 }} />
              <button className="btn btn-primary" onClick={() => alert("Safari → Поделиться → На экран “Домой”")}>
                Показать подсказку
              </button>
            </div>

            <div style={{ height: 12 }} />

            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="pill">{cloudMsg}</div>
              <button className="btn" onClick={logout}>Выйти</button>
            </div>

            <div style={{ height: 14 }} />

            <div className="centerRow">
              <button
                className="btn btn-danger"
                onClick={() => alert("Удаление данных делается через облако. Если нужно — добавим отдельную кнопку с подтверждением.")}
              >
                Удалить данные
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom tabs */}
      <div className="tabs">
        <div className="tabs-inner">
          <button className={`tab ${tab === "home" ? "active" : ""}`} onClick={() => setTab("home")}>
            <div>🏠</div><small>{labels.tabHome}</small>
          </button>
          <button className={`tab ${tab === "ops" ? "active" : ""}`} onClick={() => setTab("ops")}>
            <div>📒</div><small>{labels.tabOps}</small>
          </button>
          <button className={`tab ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}>
            <div>📊</div><small>{labels.tabReports}</small>
          </button>
          <button className={`tab ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
            <div>⚙️</div><small>{labels.tabSettings}</small>
          </button>
        </div>
      </div>

      {/* ADD MODAL */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal modalCenter" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="h">Добавить операцию</div>
              <button className="iconbtn" onClick={() => setAddOpen(false)}>✕</button>
            </div>

            <div className="seg" style={{ marginBottom: 12 }}>
              <button className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>Расход</button>
              <button className={type === "income" ? "active" : ""} onClick={() => setType("income")}>Доход</button>
            </div>

            <div className="split">
              <div className="field">
                <div className="label">Сумма</div>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="Например: 500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="field">
                <div className="label">Дата</div>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">Категория</div>
                <button className="pickBtn" onClick={() => setCatPickOpen(true)}>
                  <span className="pickLeft">
                    {(() => {
                      const cur = currentCats.find(c => c.id === categoryId) || currentCats[0];
                      return (
                        <>
                          <span className="badge" style={{ background: (cur?.color || "#94a3b8") + "22", borderColor: (cur?.color || "#94a3b8") + "55" }}>
                            {cur?.icon || "🏷️"}
                          </span>
                          <span className="pickName">{cur?.name || "Категория"}</span>
                        </>
                      );
                    })()}
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <span className="pill">выбрать</span>
                    <button className="iconbtn" title="Категории" onClick={(e) => { e.stopPropagation(); openManageCats(type === "income" ? "income" : "expense"); }}>
                      ⚙️
                    </button>
                  </span>
                </button>
              </div>

              <div className="field">
                <div className="label">Комментарий (необязательно)</div>
                <textarea
                  className="textarea"
                  placeholder="Например: продукты / заказ / подработка"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div style={{ height: 12 }} />

            <button
              className={`btn ${type === "income" ? "btn-green" : "btn-red"}`}
              style={{ width: "100%", padding: 12, fontSize: 16, fontWeight: 950 }}
              onClick={addTransaction}
            >
              {type === "income" ? "Добавить доход" : "Добавить расход"}
            </button>

            <div style={{ height: 10 }} />
            <div className="hintSmall">Данные пишутся в Google Drive через Apps Script.</div>
          </div>
        </div>
      )}

      <CategorySelectModal
        open={catPickOpen}
        onClose={() => setCatPickOpen(false)}
        categories={currentCats}
        onSelect={(id) => setCategoryId(id)}
      />

      {/* Manage categories modal */}
      {manageCatsOpen && (
        <div className="modal-backdrop" onClick={() => setManageCatsOpen(false)}>
          <div className="modal modalCenter" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="h">Категории</div>
              <button className="iconbtn" onClick={() => setManageCatsOpen(false)}>✕</button>
            </div>

            <div className="seg" style={{ marginBottom: 12 }}>
              <button className={catMode === "expense" ? "active" : ""} onClick={() => setCatMode("expense")}>Расходы</button>
              <button className={catMode === "income" ? "active" : ""} onClick={() => setCatMode("income")}>Доходы</button>
            </div>

            <div className="field">
              <div className="label">Добавить категорию</div>
              <div className="row" style={{ width: "100%" }}>
                <input className="input" placeholder="Например: Связь" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                <button className="btn btn-primary" onClick={addCategory}>Добавить</button>
              </div>
            </div>

            <div style={{ height: 12 }} />

            {editCatId && (
              <div className="card" style={{ padding: 12, background: "rgba(255,255,255,0.05)" }}>
                <div className="h" style={{ marginBottom: 10 }}>Редактирование</div>

                <div className="field">
                  <div className="label">Название</div>
                  <input className="input" value={editCatName} onChange={(e) => setEditCatName(e.target.value)} />
                </div>

                <div style={{ height: 10 }} />

                <div className="field">
                  <div className="label">Иконка</div>
                  <button className="pickBtn" onClick={() => setIconPickOpen(true)}>
                    <span className="pickLeft">
                      <span className="badge" style={{ background: (pendingIcon?.c || "#94a3b8") + "22", borderColor: (pendingIcon?.c || "#94a3b8") + "55" }}>
                        {pendingIcon?.e || "🏷️"}
                      </span>
                      <span className="pickName">Выбрать иконку</span>
                    </span>
                    <span className="pill">выбрать</span>
                  </button>
                </div>

                <div style={{ height: 10 }} />
                <div className="row">
                  <button className="btn btn-primary" onClick={saveEditCat}>Сохранить</button>
                  <button className="btn" onClick={() => { setEditCatId(null); setEditCatName(""); setPendingIcon(null); }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}

            <div style={{ height: 12 }} />

            <div className="catGrid">
              {categories[catMode].map((c) => (
                <div className="catRow" key={c.id}>
                  <div className="catRowLeft">
                    <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "55" }}>{c.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="catRowTitle">{c.name}</div>
                      <div className="catRowSub">Можно редактировать или удалить</div>
                    </div>
                  </div>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <button className="iconbtn" title="Редактировать" onClick={() => startEditCat(c)}>✏️</button>
                    <button className="iconbtn" title="Удалить" onClick={() => deleteCategory(c.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 10 }} />
            <div className="hintSmall">Удалённая категория автоматически заменится на первую доступную.</div>
          </div>
        </div>
      )}

      <IconPicker
        open={iconPickOpen}
        onClose={() => setIconPickOpen(false)}
        icons={pickIconPool}
        selected={pendingIcon}
        onPick={(ic) => setPendingIcon(ic)}
        title="Выбор иконки"
      />
    </div>
  );
}
