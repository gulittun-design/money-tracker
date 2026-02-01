import { useEffect, useMemo, useRef, useState } from "react";

/** =========================
 *  НАСТРОЙКИ ОБЛАКА (ГОТОВО)
 *  ========================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbyfyPWd_nFRv0ttoTC1yUXL3cBUFRLGyzzsDxzk5Ju2_YUDMwq_LkFeo52I0xzcr1y4/exec";

// PIN по умолчанию
const DEFAULT_PIN = "9191";

// где на устройстве хранить только PIN (НЕ данные)
const PIN_STORAGE_KEY = "money_tracker_pin_v1";

/** =========================
 *  ИКОНКИ
 *  ========================= */
const ICONS_EXPENSE = [
  { e: "🍔", c: "#f59e0b" }, { e: "🛒", c: "#22c55e" }, { e: "🚕", c: "#fbbf24" },
  { e: "🚇", c: "#60a5fa" }, { e: "⛽️", c: "#fb7185" }, { e: "🏠", c: "#a78bfa" },
  { e: "📱", c: "#38bdf8" }, { e: "💊", c: "#34d399" }, { e: "👕", c: "#f472b6" },
  { e: "🎮", c: "#c084fc" }, { e: "🎬", c: "#fda4af" }, { e: "🎁", c: "#fb7185" },
  { e: "📦", c: "#f97316" }, { e: "💡", c: "#facc15" }, { e: "🧾", c: "#94a3b8" },
  { e: "✈️", c: "#22d3ee" }, { e: "🐶", c: "#fda4af" }, { e: "🏋️", c: "#34d399" },
  { e: "☕️", c: "#f59e0b" }, { e: "🍕", c: "#fb7185" }, { e: "🥦", c: "#22c55e" },
  { e: "🧴", c: "#60a5fa" }, { e: "🧽", c: "#fbbf24" }, { e: "🧰", c: "#a78bfa" },
  { e: "🎓", c: "#38bdf8" }, { e: "🩺", c: "#34d399" }, { e: "🐾", c: "#f472b6" },
  { e: "🏖️", c: "#22d3ee" }, { e: "🚗", c: "#94a3b8" },
];

const ICONS_INCOME = [
  { e: "💼", c: "#34d399" }, { e: "💰", c: "#22c55e" }, { e: "📈", c: "#38bdf8" },
  { e: "🧠", c: "#a78bfa" }, { e: "🎁", c: "#f472b6" }, { e: "🤝", c: "#22d3ee" },
  { e: "🏦", c: "#60a5fa" }, { e: "🪙", c: "#facc15" }, { e: "🧾", c: "#94a3b8" },
  { e: "🛍️", c: "#fb7185" }, { e: "🎯", c: "#c084fc" }, { e: "🚀", c: "#22d3ee" },
];

/** =========================
 *  ДЕФОЛТНЫЕ ДАННЫЕ
 *  ========================= */
const DEFAULT_DATA = {
  labels: {
    appName: "Мой бюджет",
    appTagline: "Фиксируй доходы и расходы — смотри отчёты",
    tabToday: "Дом",
    tabOps: "Операции",
    tabReports: "Отчёты",
    tabSettings: "Настройки",
    todayOpsTitle: "Операции за сегодня",
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

/** =========================
 *  API к Apps Script
 *  ========================= */
async function apiGet(pin) {
  const url = `${API_URL}?pin=${encodeURIComponent(pin)}`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Облако вернуло не JSON");
  }
}

async function apiSave(pin, data) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, pin }),
  });
  const out = await res.json().catch(() => ({}));
  if (out && out.ok === false) throw new Error(out.error || "save failed");
  return out;
}

async function apiSetPin(oldPin, newPin) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setPin", oldPin, newPin }),
  });
  const out = await res.json().catch(() => ({}));
  if (!out || out.ok === false) throw new Error(out.error || "setPin failed");
  return out;
}

/** =========================
 *  UI
 *  ========================= */
function EditableText({ value, onChange, style, disabled }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setTemp(value); }, [value]);
  useEffect(() => { if (editing) setTimeout(() => inputRef.current?.focus(), 50); }, [editing]);

  if (disabled) {
    return (
      <span className="editable" style={style}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value}
        </span>
      </span>
    );
  }

  if (!editing) {
    return (
      <span className="editable" style={style}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value}
        </span>
        <span className="pencil" title="Редактировать" onClick={() => setEditing(true)}>✏️</span>
      </span>
    );
  }

  return (
    <span className="editable" style={style}>
      <input
        ref={inputRef}
        className="input"
        style={{ padding: 8, borderRadius: 12, width: 220, maxWidth: "55vw" }}
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(temp.trim() || value);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        className="iconbtn"
        title="Сохранить"
        onClick={() => { onChange(temp.trim() || value); setEditing(false); }}
      >
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

        <div className="card" style={{ padding: 12, background: "rgba(255,255,255,0.05)", maxHeight: "60vh", overflow: "auto" }}>
          <div className="chips">
            {icons.map((ic, idx) => {
              const active = selected?.e === ic.e && selected?.c === ic.c;
              return (
                <button
                  key={idx}
                  className={"chip" + (active ? " active" : "")}
                  onClick={() => { onPick(ic); onClose(); }}
                  title="Выбрать"
                >
                  <span className="badge" style={{ background: ic.c + "22", borderColor: ic.c + "55" }}>{ic.e}</span>
                  <span style={{ color: "rgba(255,255,255,0.85)" }}>выбрать</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryPicker({ value, categories, onPick, onManage }) {
  const cur = categories.find(c => c.id === value) || categories[0];

  return (
    <button className="pickBtn" onClick={onPick}>
      <span className="pickLeft">
        <span className="badge" style={{ background: (cur?.color || "#ffffff") + "22", borderColor: (cur?.color || "#fff") + "55" }}>
          {cur?.icon || "🏷️"}
        </span>
        <span style={{ minWidth: 0 }}>
          <div className="pickName">{cur?.name || "Категория"}</div>
          <div className="pickHint">Нажми, чтобы выбрать</div>
        </span>
      </span>

      <span className="row" style={{ gap: 8 }}>
        <span className="pill">выбрать</span>
        <button
          className="iconbtn"
          title="Управлять категориями"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onManage(); }}
        >
          ⚙️
        </button>
      </span>
    </button>
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
            <div key={c.id} className="catRow" onClick={() => { onSelect(c.id); onClose(); }}>
              <div className="catRowLeft">
                <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "55" }}>{c.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="catRowTitle">{c.name}</div>
                  <div className="catRowSub">Нажми, чтобы выбрать</div>
                </div>
              </div>
              <div className="pill">✓</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Donut({ parts, totalLabel, subtitle }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const ratios = parts.map(p => (total ? (p.value / total) : 0));
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
          <div style={{ color: "rgba(255,255,255,0.65)" }}>Нет данных для выбранных фильтров.</div>
        ) : (
          parts.slice(0, 7).map((p, i) => (
            <div key={i} className="legRow">
              <div className="legLeft">
                <span className="dot" style={{ background: p.color }} />
                <span>{p.label}</span>
              </div>
              <div className="legAmt">{formatMoney(p.value)} ₽</div>
            </div>
          ))
        )}
        {parts.length > 7 && <div className="pill">+ ещё {parts.length - 7} категорий</div>}
      </div>
    </div>
  );
}

/** =========================
 *  APP
 *  ========================= */
export default function App() {
  const todayISO = toISODate();
  const [tab, setTab] = useState("today"); // today|ops|reports|settings

  // PIN & авторизация
  const [pin, setPin] = useState(() => localStorage.getItem(PIN_STORAGE_KEY) || "");
  const [pinInput, setPinInput] = useState("");
  const [authOk, setAuthOk] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [cloudStatus, setCloudStatus] = useState("disconnected"); // disconnected|connecting|ok|error

  const [data, setData] = useState(DEFAULT_DATA);
  const { labels, categories, items } = data;

  // UI
  const [addOpen, setAddOpen] = useState(false);
  const [catPickOpen, setCatPickOpen] = useState(false);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [iconPickOpen, setIconPickOpen] = useState(false);

  // мотивационное окно (увеличено время)
  const [motivate, setMotivate] = useState(false);

  // форма
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO);
  const [categoryId, setCategoryId] = useState(categories.expense[0]?.id || "");
  const [note, setNote] = useState("");

  // категории
  const [catMode, setCatMode] = useState("expense");
  const [newCatName, setNewCatName] = useState("");
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [pendingIcon, setPendingIcon] = useState(null);

  // фильтры операций
  const [fType, setFType] = useState("all"); // all|expense|income
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fQueryInput, setFQueryInput] = useState("");
  const [fQueryApplied, setFQueryApplied] = useState("");
  const [fCatIds, setFCatIds] = useState([]);

  // отчёты
  const [reportRange, setReportRange] = useState("month"); // day|week|month|year
  const [reportType, setReportType] = useState("expense"); // expense|income
  const [reportCatIds, setReportCatIds] = useState([]);

  // смена PIN
  const [pinOld, setPinOld] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  /** ====== ЛОГИН: только ввод, без создания ====== */
  async function tryLogin(withPin) {
    const p = String(withPin || "").trim();
    setAuthErr("");
    setPinMsg("");
    if (!/^\d{4}$/.test(p)) {
      setAuthErr("Введите 4 цифры");
      return;
    }

    setCloudStatus("connecting");
    try {
      const cloudData = await apiGet(p);
      if (cloudData?.ok === false) throw new Error(cloudData.error || "bad pin");

      const next = {
        labels: { ...DEFAULT_DATA.labels, ...(cloudData.labels || {}) },
        categories: {
          expense: Array.isArray(cloudData.categories?.expense) && cloudData.categories.expense.length
            ? cloudData.categories.expense
            : DEFAULT_DATA.categories.expense,
          income: Array.isArray(cloudData.categories?.income) && cloudData.categories.income.length
            ? cloudData.categories.income
            : DEFAULT_DATA.categories.income,
        },
        items: Array.isArray(cloudData.items) ? cloudData.items : [],
      };

      setData(next);
      setPin(p);
      localStorage.setItem(PIN_STORAGE_KEY, p);
      setAuthOk(true);
      setCloudStatus("ok");
    } catch (e) {
      setCloudStatus("error");
      setAuthOk(false);
      setAuthErr("Неверный PIN или нет доступа к облаку");
    }
  }

  // автологин если PIN уже сохранён на этом устройстве
  useEffect(() => {
    if (authOk) return;
    const saved = localStorage.getItem(PIN_STORAGE_KEY);
    if (saved && /^\d{4}$/.test(saved)) {
      tryLogin(saved);
    } else {
      setCloudStatus("disconnected");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ====== Сохранение в облако ====== */
  useEffect(() => {
    if (!authOk || cloudStatus !== "ok") return;
    const t = setTimeout(() => {
      apiSave(pin, data).catch(() => setCloudStatus("error"));
    }, 450);
    return () => clearTimeout(t);
  }, [data, authOk, cloudStatus, pin]);

  /** ====== Today ====== */
  const todayItems = useMemo(() => items.filter((x) => x.date === todayISO), [items, todayISO]);
  const todayIncome = useMemo(() => sum(todayItems, "income"), [todayItems]);
  const todayExpense = useMemo(() => sum(todayItems, "expense"), [todayItems]);
  const todayNet = todayIncome - todayExpense;

  function setLabel(key, value) {
    setData((prev) => ({ ...prev, labels: { ...prev.labels, [key]: value } }));
  }

  function openAdd() { setAddOpen(true); }
  function closeAdd() { setAddOpen(false); }

  useEffect(() => {
    if (!addOpen) return;
    const now = toISODate();
    setType("expense");
    setAmount("");
    setDate(now);
    setCategoryId((categories.expense[0]?.id) || "");
    setNote("");
  }, [addOpen, categories.expense]);

  useEffect(() => {
    if (!addOpen) return;
    const list = type === "expense" ? categories.expense : categories.income;
    setCategoryId(list[0]?.id || "");
  }, [type, addOpen, categories.expense, categories.income]);

  function addTransaction() {
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0) {
      alert("Введите сумму больше 0");
      return;
    }

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
      setTimeout(() => setMotivate(false), 1600);
    }
  }

  function removeTx(id) {
    if (!confirm("Удалить операцию?")) return;
    setData((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== id) }));
  }

  function categoryById(typeKey, id) {
    const list = typeKey === "income" ? categories.income : categories.expense;
    return list.find((c) => c.id === id) || list[0] || null;
  }

  /** ====== Категории ====== */
  function openManageCats() {
    setCatMode(type === "income" ? "income" : "expense");
    setManageCatsOpen(true);
    setNewCatName("");
    setEditCatId(null);
    setEditCatName("");
    setPendingIcon(null);
  }

  function addCategory() {
    const name = newCatName.trim();
    if (!name) return;

    const pool = catMode === "income" ? ICONS_INCOME : ICONS_EXPENSE;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const newCat = { id: uid(), name, icon: picked.e, color: picked.c };

    setData((prev) => ({
      ...prev,
      categories: { ...prev.categories, [catMode]: [newCat, ...prev.categories[catMode]] },
    }));
    setNewCatName("");
    alert("Категория успешно добавлена ✅");
  }

  function startEditCat(c) {
    setEditCatId(c.id);
    setEditCatName(c.name);
    setPendingIcon({ e: c.icon, c: c.color });
  }

  function saveEditCat() {
    if (!editCatId) return;
    const name = editCatName.trim();
    if (!name) return;

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
  }

  function deleteCategory(id) {
    const list = categories[catMode];
    if (list.length <= 1) {
      alert("Нельзя удалить последнюю категорию.");
      return;
    }
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
      return { ...prev, categories: { ...prev.categories, [catMode]: nextCats }, items: nextItems };
    });
  }

  /** ====== Фильтры операций ====== */
  const catOptionsForFilters = useMemo(() => {
    const exp = categories.expense.map(c => ({ ...c, type: "expense" }));
    const inc = categories.income.map(c => ({ ...c, type: "income" }));
    return [...exp, ...inc];
  }, [categories]);

  const filteredOps = useMemo(() => {
    let arr = [...items];

    if (fType !== "all") arr = arr.filter(x => x.type === fType);
    if (fFrom) arr = arr.filter(x => x.date >= fFrom);
    if (fTo) arr = arr.filter(x => x.date <= fTo);

    if (fQueryApplied.trim()) {
      const q = fQueryApplied.trim().toLowerCase();
      arr = arr.filter(x => (x.note || "").toLowerCase().includes(q));
    }

    if (fCatIds.length) arr = arr.filter(x => fCatIds.includes(x.categoryId));

    arr.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1;
    });
    return arr;
  }, [items, fType, fFrom, fTo, fQueryApplied, fCatIds]);

  function applyOpsFilters() { setFQueryApplied(fQueryInput); }
  function resetOpsFilters() {
    setFType("all");
    setFFrom("");
    setFTo("");
    setFQueryInput("");
    setFQueryApplied("");
    setFCatIds([]);
  }

  /** ====== Отчёты ====== */
  const rangeItems = useMemo(() => {
    const base = todayISO;
    if (reportRange === "day") return items.filter(x => x.date === base);

    // week/month/year: упрощённо — для графика
    if (reportRange === "week") {
      const d = new Date(base + "T00:00:00");
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      const start = toISODate(d);
      d.setDate(d.getDate() + 7);
      const end = toISODate(d);
      return items.filter(x => x.date >= start && x.date < end);
    }

    if (reportRange === "month") {
      const m = base.slice(0, 7);
      return items.filter(x => x.date.slice(0, 7) === m);
    }

    const y = base.slice(0, 4);
    return items.filter(x => x.date.slice(0, 4) === y);
  }, [items, reportRange, todayISO]);

  const reportItems = useMemo(() => {
    let arr = rangeItems.filter(x => x.type === reportType);
    if (reportCatIds.length) arr = arr.filter(x => reportCatIds.includes(x.categoryId));
    return arr;
  }, [rangeItems, reportType, reportCatIds]);

  const reportTotal = useMemo(
    () => reportItems.reduce((s, x) => s + (Number(x.amount) || 0), 0),
    [reportItems]
  );

  const donutParts = useMemo(() => {
    const map = new Map();
    for (const x of reportItems) {
      map.set(x.categoryId, (map.get(x.categoryId) || 0) + (Number(x.amount) || 0));
    }
    const list = Array.from(map.entries()).map(([catId, amount]) => {
      const cat = categoryById(reportType === "income" ? "income" : "expense", catId);
      return {
        label: `${cat?.icon || "🏷️"} ${cat?.name || "Категория"}`,
        value: amount,
        color: cat?.color || "#94a3b8",
      };
    });
    list.sort((a, b) => b.value - a.value);
    return list;
  }, [reportItems, reportType]);

  /** ====== Смена PIN ====== */
  async function changePin() {
    const oldP = String(pinOld || "").trim();
    const newP = String(pinNew || "").trim();

    setPinMsg("");
    if (!/^\d{4}$/.test(oldP)) { setPinMsg("Старый PIN должен быть 4 цифры"); return; }
    if (!/^\d{4}$/.test(newP)) { setPinMsg("Новый PIN должен быть 4 цифры"); return; }

    try {
      await apiSetPin(oldP, newP);
      setPin(newP);
      localStorage.setItem(PIN_STORAGE_KEY, newP);
      setPinOld("");
      setPinNew("");
      setPinMsg("PIN успешно изменён ✅");
    } catch {
      setPinMsg("Не удалось сменить PIN (проверь старый PIN и доступ)");
    }
  }

  function clearAll() {
    if (!confirm("Вы точно хотите удалить ВСЕ данные? Это действие нельзя отменить.")) return;
    setData(DEFAULT_DATA);
    alert("Все данные полностью удалены ✅");
  }

  const currentCats = type === "income" ? categories.income : categories.expense;
  const pickIconPool = catMode === "income" ? ICONS_INCOME : ICONS_EXPENSE;

  /** =========================
   *  ЭКРАН ЛОГИНА
   *  ========================= */
  if (!authOk) {
    return (
      <div className="app">
        <div className="container">
          <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
            <div className="card-title">
              <div className="h">🔒 Вход</div>
              <div className="pill">{cloudStatus === "connecting" ? "подключаюсь..." : "облако"}</div>
            </div>

            <div style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
              Введите PIN (4 цифры), чтобы открыть приложение.
            </div>

            <div style={{ height: 12 }} />

            <div className="field">
              <div className="label">PIN</div>
              <input
                className="input"
                inputMode="numeric"
                placeholder={DEFAULT_PIN}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                onKeyDown={(e) => { if (e.key === "Enter") tryLogin(pinInput); }}
              />
            </div>

            {authErr && <div style={{ marginTop: 10, color: "#ffe4e6" }}>{authErr}</div>}

            <div style={{ height: 12 }} />

            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: 12, fontSize: 16, fontWeight: 950 }}
              onClick={() => tryLogin(pinInput)}
            >
              Войти
            </button>

            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.60)", fontSize: 12, lineHeight: 1.4 }}>
              На новом устройстве всегда будет только ввод PIN (без создания).
            </div>
          </div>
        </div>
      </div>
    );
  }

  /** =========================
   *  ОСНОВНОЕ ПРИЛОЖЕНИЕ
   *  ========================= */
  return (
    <div className="app">
      {motivate && (
        <div className="motivate">
          <div className="pop">🎉 Доход добавлен! Так держать! 💪</div>
        </div>
      )}

      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-title">
              <EditableText value={labels.appName} onChange={(v) => setLabel("appName", v)} />
            </div>
            <div className="brand-sub">
              <EditableText value={labels.appTagline} onChange={(v) => setLabel("appTagline", v)} />
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        {/* TODAY */}
        {tab === "today" && (
          <div className="card">
            <div className="card-title">
              <div className="h" style={{ textAlign: "center", width: "100%" }}>
                {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>
                  {new Date().toLocaleTimeString("ru-RU")}
                </div>
              </div>
            </div>

            <div className="bigAddWrap">
              <button className="bigAdd" onClick={() => setAddOpen(true)}>✨ Добавить операцию</button>
            </div>

            <div style={{ height: 14 }} />

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

            <div style={{ height: 14 }} />

            <div className="card-title">
              <div className="h">{labels.todayOpsTitle}</div>
              <div className="pill">{todayItems.length} шт.</div>
            </div>

            {todayItems.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.65)" }}>
                Пока пусто. Нажми <b>“Добавить операцию”</b>.
              </div>
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
                            <span className="pill" style={{ marginLeft: 6 }}>
                              {new Date(x.createdAt || Date.now()).toLocaleTimeString("ru-RU")}
                            </span>
                          </div>
                          <div className="item-sub">{x.note || (x.type === "income" ? "Доход" : "Расход")}</div>
                        </div>

                        <div className="row">
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

        {/* OPERATIONS */}
        {tab === "ops" && (
          <div className="card">
            <div className="card-title">
              <div className="h">{labels.opsTitle}</div>
              <div className="pill">{filteredOps.length} шт.</div>
            </div>

            <div className="seg" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 12 }}>
              <button className={fType === "expense" ? "active" : ""} onClick={() => setFType("expense")}>Расходы</button>
              <button className={fType === "all" ? "active" : ""} onClick={() => setFType("all")}>Все</button>
              <button className={fType === "income" ? "active" : ""} onClick={() => setFType("income")}>Доходы</button>
            </div>

            <div className="split">
              <div className="field">
                <div className="label">Поиск по комментарию</div>
                <input
                  className="input"
                  placeholder="Например: помидор"
                  value={fQueryInput}
                  onChange={(e) => setFQueryInput(e.target.value)}
                />
                <div className="row" style={{ marginTop: 10 }}>
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
              </div>

              <div className="field">
                <div className="label">Фильтр по категориям</div>
                <div className="chips">
                  {catOptionsForFilters.map((c) => {
                    const active = fCatIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={"chip" + (active ? " active" : "")}
                        onClick={() => setFCatIds((prev) => active ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                      >
                        <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "55" }}>{c.icon}</span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                {fCatIds.length > 0 && (
                  <button className="btn" onClick={() => setFCatIds([])} style={{ marginTop: 10 }}>
                    Очистить категории
                  </button>
                )}
              </div>
            </div>

            <div style={{ height: 14 }} />

            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="pill">Категории</div>
              <button className="btn btn-primary" onClick={openManageCats}>⚙️ Категории</button>
            </div>

            <div style={{ height: 12 }} />

            {filteredOps.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.65)" }}>Ничего не найдено по фильтрам.</div>
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
                          <span className="pill">{x.date}</span>
                          <span className="pill">{new Date(x.createdAt || Date.now()).toLocaleTimeString("ru-RU")}</span>
                        </div>
                        <div className="item-sub">{x.note || (x.type === "income" ? "Доход" : "Расход")}</div>
                      </div>

                      <div className="row">
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
              <div className="pill">
                {reportRange === "day" && "День"}
                {reportRange === "week" && "Неделя"}
                {reportRange === "month" && "Месяц"}
                {reportRange === "year" && "Год"}
              </div>
            </div>

            <div className="seg" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
              <button className={reportType === "expense" ? "active" : ""} onClick={() => setReportType("expense")}>Расходы</button>
              <button className={reportType === "income" ? "active" : ""} onClick={() => setReportType("income")}>Доходы</button>
            </div>

            <div className="seg" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", marginBottom: 12 }}>
              <button className={reportRange === "day" ? "active" : ""} onClick={() => setReportRange("day")}>День</button>
              <button className={reportRange === "week" ? "active" : ""} onClick={() => setReportRange("week")}>Неделя</button>
              <button className={reportRange === "month" ? "active" : ""} onClick={() => setReportRange("month")}>Месяц</button>
              <button className={reportRange === "year" ? "active" : ""} onClick={() => setReportRange("year")}>Год</button>
            </div>

            <div className="field">
              <div className="label">Фильтр по категориям</div>
              <div className="chips">
                {(reportType === "expense" ? categories.expense : categories.income).map((c) => {
                  const active = reportCatIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      className={"chip" + (active ? " active" : "")}
                      onClick={() => setReportCatIds((prev) => active ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                    >
                      <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "55" }}>{c.icon}</span>
                      {c.name}
                    </button>
                  );
                })}
              </div>
              {reportCatIds.length > 0 && (
                <button className="btn" onClick={() => setReportCatIds([])} style={{ marginTop: 10 }}>
                  Показать все категории
                </button>
              )}
            </div>

            <div style={{ height: 14 }} />

            <Donut
              parts={donutParts}
              totalLabel={`${formatMoney(reportTotal)} ₽`}
              subtitle={reportType === "income" ? "Всего доходов" : "Всего расходов"}
            />

            <div style={{ height: 14 }} />

            <div className="card" style={{ padding: 14, background: "rgba(255,255,255,0.05)" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="pill">Операции в этом отчёте</div>
                <div className="pill">{reportItems.length} шт.</div>
              </div>

              <div style={{ height: 10 }} />

              {reportItems.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.65)" }}>Нет операций в выбранном периоде.</div>
              ) : (
                <div className="list">
                  {reportItems
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
                              {cat?.name || "Категория"}{" "}
                              <span className="pill">{x.date}</span>
                              <span className="pill">{new Date(x.createdAt || Date.now()).toLocaleTimeString("ru-RU")}</span>
                            </div>
                            <div className="item-sub">{x.note || (x.type === "income" ? "Доход" : "Расход")}</div>
                          </div>

                          <div className={`amount ${x.type === "income" ? "pos" : "neg"}`}>
                            {x.type === "income" ? "+" : "-"}{formatMoney(x.amount)} ₽
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div className="card">
            <div className="card-title">
              <div className="h">{labels.settingsTitle}</div>
              <div className="pill">{cloudStatus === "ok" ? "облако OK" : "облако"}</div>
            </div>

            <div className="card" style={{ padding: 16, background: "rgba(255,255,255,0.05)" }}>
              <div className="h" style={{ marginBottom: 10 }}>🔑 Сменить PIN</div>

              <div className="split">
                <div className="field">
                  <div className="label">Старый PIN</div>
                  <input className="input" inputMode="numeric" value={pinOld} onChange={(e) => setPinOld(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} />
                </div>
                <div className="field">
                  <div className="label">Новый PIN</div>
                  <input className="input" inputMode="numeric" value={pinNew} onChange={(e) => setPinNew(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} />
                </div>
              </div>

              <div style={{ height: 10 }} />

              <button className="btn btn-primary" onClick={changePin}>Изменить PIN</button>

              {pinMsg && (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.80)" }}>
                  {pinMsg}
                </div>
              )}
            </div>

            <div style={{ height: 14 }} />

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button className="btn btn-danger" onClick={clearAll} style={{ minWidth: 260 }}>
                Удалить все данные
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom tabs */}
      <div className="tabs">
        <div className="tabs-inner">
          <button className={`tab ${tab === "today" ? "active" : ""}`} onClick={() => setTab("today")}>
            <div>🏠</div><small>{labels.tabToday}</small>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
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
                <input className="input" inputMode="decimal" placeholder="Например: 500" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">Дата</div>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">Категория</div>
                <CategoryPicker
                  value={categoryId}
                  categories={currentCats}
                  onPick={() => setCatPickOpen(true)}
                  onManage={() => openManageCats()}
                />
              </div>

              <div className="field">
                <div className="label">Комментарий (необязательно)</div>
                <textarea className="textarea" placeholder="Например: продукты / заказ / подработка" value={note} onChange={(e) => setNote(e.target.value)} />
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
          </div>
        </div>
      )}

      <CategorySelectModal
        open={catPickOpen}
        onClose={() => setCatPickOpen(false)}
        categories={currentCats}
        onSelect={(id) => setCategoryId(id)}
      />

      {/* Manage categories */}
      {manageCatsOpen && (
        <div className="modal-backdrop" onClick={() => setManageCatsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="h">Категории</div>
              <button className="iconbtn" onClick={() => setManageCatsOpen(false)}>✕</button>
            </div>

            <div className="seg" style={{ marginBottom: 12 }}>
              <button className={catMode === "expense" ? "active" : ""} onClick={() => setCatMode("expense")}>Расходы</button>
              <button className={catMode === "income" ? "active" : ""} onClick={() => setCatMode("income")}>Доходы</button>
            </div>

            <div className="split">
              <div className="field">
                <div className="label">Добавить категорию</div>
                <div className="row" style={{ width: "100%" }}>
                  <input className="input" placeholder="Например: Одежда" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                  <button className="btn btn-primary" onClick={addCategory}>Добавить</button>
                </div>
              </div>

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
                        <span>
                          <div className="pickName">Выбрать иконку</div>
                          <div className="pickHint">листай вниз на телефоне</div>
                        </span>
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
            </div>

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
            <div style={{ color: "rgba(255,255,255,0.60)", fontSize: 12, lineHeight: 1.4 }}>
              Категории сохраняются. Удалённая категория автоматически заменится на первую доступную.
            </div>
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
