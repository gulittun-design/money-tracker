import { useEffect, useMemo, useRef, useState } from "react";

/** =======================
 *  CONFIG / HELPERS
 *  ======================= */
const STORAGE_KEY = "money_tracker_v2_stable_fixed";
const MSK_TZ = "Europe/Moscow";

const ICONS_EXPENSE = [
  { e: "🍔", c: "#f59e0b" }, { e: "🛒", c: "#22c55e" }, { e: "🚕", c: "#fbbf24" },
  { e: "🚇", c: "#60a5fa" }, { e: "⛽️", c: "#fb7185" }, { e: "🏠", c: "#a78bfa" },
  { e: "📱", c: "#38bdf8" }, { e: "💊", c: "#34d399" }, { e: "👕", c: "#f472b6" },
  { e: "🎮", c: "#c084fc" }, { e: "🎬", c: "#fda4af" }, { e: "🎁", c: "#fb7185" },
  { e: "📦", c: "#f97316" }, { e: "💡", c: "#facc15" }, { e: "🧾", c: "#94a3b8" },
  { e: "✈️", c: "#22d3ee" }, { e: "🏋️", c: "#34d399" }, { e: "☕️", c: "#f59e0b" },
  { e: "🍕", c: "#fb7185" }, { e: "🍣", c: "#60a5fa" }, { e: "🥦", c: "#22c55e" },
  { e: "🍰", c: "#f472b6" }, { e: "🧴", c: "#38bdf8" }, { e: "💄", c: "#fb7185" },
  { e: "📚", c: "#a78bfa" }, { e: "🎵", c: "#38bdf8" }, { e: "🏖️", c: "#22d3ee" },
  { e: "🚗", c: "#60a5fa" }, { e: "🛠️", c: "#f97316" }, { e: "🪑", c: "#f97316" }
];

const ICONS_INCOME = [
  { e: "💼", c: "#34d399" }, { e: "💰", c: "#22c55e" }, { e: "📈", c: "#38bdf8" },
  { e: "🤝", c: "#22d3ee" }, { e: "🎁", c: "#f472b6" }, { e: "🏦", c: "#60a5fa" },
  { e: "🪙", c: "#facc15" }, { e: "💳", c: "#94a3b8" }, { e: "🧾", c: "#f97316" },
  { e: "🧑‍💻", c: "#38bdf8" }, { e: "📦", c: "#22c55e" }, { e: "🧠", c: "#a78bfa" }
];

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

function safeLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_DATA;
    return {
      labels: { ...DEFAULT_DATA.labels, ...(parsed.labels || {}) },
      categories: {
        expense: Array.isArray(parsed.categories?.expense) ? parsed.categories.expense : DEFAULT_DATA.categories.expense,
        income: Array.isArray(parsed.categories?.income) ? parsed.categories.income : DEFAULT_DATA.categories.income,
      },
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return DEFAULT_DATA;
  }
}

function safeSave(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function formatMoney(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function sum(items, type) {
  return items.filter(x => x.type === type).reduce((s, x) => s + (Number(x.amount) || 0), 0);
}

function mskISODate(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MSK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find(p => p.type === "year")?.value || "1970";
  const m = parts.find(p => p.type === "month")?.value || "01";
  const day = parts.find(p => p.type === "day")?.value || "01";
  return `${y}-${m}-${day}`;
}

function mskDateLong(d = new Date()) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MSK_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function mskTimeWithSeconds(d = new Date()) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MSK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function mskTimeFromTs(ts) {
  if (!ts) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MSK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}

function daysInMonth(year, month1to12) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}
function monthRangeISO(year, month1to12) {
  const m = String(month1to12).padStart(2, "0");
  const from = `${year}-${m}-01`;
  const last = daysInMonth(year, month1to12);
  const to = `${year}-${m}-${String(last).padStart(2, "0")}`;
  return { from, to };
}
function prevMonth(year, month1to12) {
  if (month1to12 === 1) return { year: year - 1, month: 12 };
  return { year, month: month1to12 - 1 };
}
function inRange(iso, from, to) {
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}
function pctChange(cur, prev) {
  if (prev <= 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

/** =======================
 *  UI COMPONENTS
 *  ======================= */
function Toast({ toast }) {
  if (!toast?.open) return null;
  return (
    <div className="toastWrap">
      <div className={"toast " + (toast.kind || "")}>{toast.text}</div>
    </div>
  );
}

function EditableText({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => setTemp(value), [value]);
  useEffect(() => { if (editing) setTimeout(() => inputRef.current?.focus(), 40); }, [editing]);

  if (!editing) {
    return (
      <span className="editable">
        <span className="editableText">{value}</span>
        <button className="pencilBtn" type="button" title="Редактировать" onClick={() => setEditing(true)}>✏️</button>
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
          if (e.key === "Enter") { onChange((temp || "").trim() || value); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button className="btn btn-primary" type="button" onClick={() => { onChange((temp || "").trim() || value); setEditing(false); }}>
        OK
      </button>
    </span>
  );
}

function IconPicker({ open, onClose, icons, selected, onPick, title }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-solid" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="h">{title}</div>
          <button className="iconbtn" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="iconPickerScroll">
          <div className="iconGrid">
            {icons.map((ic, idx) => {
              const active = selected?.e === ic.e && selected?.c === ic.c;
              return (
                <button
                  key={idx}
                  type="button"
                  className={"iconPick " + (active ? "active" : "")}
                  onClick={() => { onPick(ic); onClose(); }}
                  title="Выбрать"
                >
                  <span className="badge big" style={{ background: ic.c + "26", borderColor: ic.c + "70" }}>
                    {ic.e}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hintSmall">Прокрути вниз и выбери иконку.</div>
      </div>
    </div>
  );
}

function CategoryPicker({ value, categories, onPick, onManage }) {
  const cur = categories.find(c => c.id === value) || categories[0];
  return (
    <button className="pickBtn" type="button" onClick={onPick}>
      <span className="pickLeft">
        <span className="badge" style={{ background: (cur?.color || "#8b94a7") + "22", borderColor: (cur?.color || "#8b94a7") + "55" }}>
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
          type="button"
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
      <div className="modal modal-solid" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="h">Выбор категории</div>
          <button className="iconbtn" type="button" onClick={onClose}>✕</button>
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
    ? `conic-gradient(${stops.map(s => `${s.color} ${Math.round(s.start*100)}% ${Math.round(s.end*100)}%`).join(", ")})`
    : `conic-gradient(#2b3446 0% 100%)`;

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

/** iOS-like Wheel */
function WheelPicker({ label, items, value, onChange, height = 210, itemHeight = 44, loop = false }) {
  const ref = useRef(null);
  const base = items;

  const repeated = useMemo(() => (loop ? [...base, ...base, ...base] : base), [loop, base]);
  const baseLen = base.length;

  function idxForValue(v) {
    const i = base.findIndex(x => x.value === v);
    if (i < 0) return loop ? baseLen : 0;
    return loop ? baseLen + i : i;
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = idxForValue(value);
    el.scrollTo({ top: idx * itemHeight, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, itemHeight]);

  function nearestIndex() {
    const el = ref.current;
    if (!el) return 0;
    const idx = Math.round(el.scrollTop / itemHeight);
    return Math.max(0, Math.min(repeated.length - 1, idx));
  }

  function normalizeLoop() {
    if (!loop) return;
    const el = ref.current;
    if (!el) return;
    const idx = nearestIndex();
    if (idx < baseLen * 0.5) el.scrollTo({ top: (idx + baseLen) * itemHeight, behavior: "auto" });
    if (idx > baseLen * 2.5) el.scrollTo({ top: (idx - baseLen) * itemHeight, behavior: "auto" });
  }

  function pickFromScroll() {
    const idx = nearestIndex();
    const picked = repeated[idx];
    if (picked && picked.value !== value) onChange(picked.value);
    normalizeLoop();
  }

  function snap() {
    const el = ref.current;
    if (!el) return;
    const idx = nearestIndex();
    el.scrollTo({ top: idx * itemHeight, behavior: "smooth" });
    const picked = repeated[idx];
    if (picked && picked.value !== value) onChange(picked.value);
    setTimeout(normalizeLoop, 260);
  }

  return (
    <div className="wheelBlock">
      <div className="label">{label}</div>
      <div className="wheelWrap" style={{ height }}>
        <div
          ref={ref}
          className="wheel"
          style={{ height, paddingTop: itemHeight * 2, paddingBottom: itemHeight * 2 }}
          onScroll={pickFromScroll}
          onTouchEnd={snap}
          onPointerUp={snap}
          onMouseUp={snap}
        >
          {repeated.map((it, i) => {
            const active = it.value === value;
            return (
              <div
                key={`${String(it.value)}_${i}`}
                className={"wheelItem" + (active ? " active" : "")}
                style={{ height: itemHeight }}
                onClick={() => onChange(it.value)}
              >
                {it.text}
              </div>
            );
          })}
        </div>
        <div className="wheelSelectLines" style={{ height: itemHeight }} />
      </div>
    </div>
  );
}

/** =======================
 *  APP
 *  ======================= */
export default function App() {
  const [tick, setTick] = useState(() => Date.now());
  const todayISO = useMemo(() => mskISODate(new Date(tick)), [tick]);

  const [tab, setTab] = useState("today");
  const [data, setData] = useState(() => safeLoad());
  const { labels, categories, items } = data;

  useEffect(() => { safeSave(data); }, [data]);

  const lastDayRef = useRef(todayISO);
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setTick(now);
      const dayNow = mskISODate(new Date(now));
      if (dayNow !== lastDayRef.current) {
        lastDayRef.current = dayNow;
        resetOpsFilters();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [toast, setToast] = useState({ open: false, text: "", kind: "" });
  function showToast(text, kind = "") {
    setToast({ open: true, text, kind });
    setTimeout(() => setToast({ open: false, text: "", kind: "" }), 2200);
  }

  const [motivate, setMotivate] = useState(false);
  const [motivateText, setMotivateText] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [catPickOpen, setCatPickOpen] = useState(false);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [iconPickOpen, setIconPickOpen] = useState(false);

  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO);
  const [categoryId, setCategoryId] = useState(categories.expense[0]?.id || "");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!addOpen) return;
    setType("expense");
    setAmount("");
    setDate(todayISO);
    setCategoryId(categories.expense[0]?.id || "");
    setNote("");
  }, [addOpen, todayISO, categories.expense]);

  useEffect(() => {
    if (!addOpen) return;
    const list = type === "income" ? categories.income : categories.expense;
    setCategoryId(list[0]?.id || "");
  }, [type, addOpen, categories.income, categories.expense]);

  const [catMode, setCatMode] = useState("expense");
  const [newCatName, setNewCatName] = useState("");
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [pendingIcon, setPendingIcon] = useState(null);

  const currentCats = type === "income" ? categories.income : categories.expense;
  const pickIconPool = catMode === "income" ? ICONS_INCOME : ICONS_EXPENSE;

  function categoryById(typeKey, id) {
    const list = typeKey === "income" ? categories.income : categories.expense;
    return list.find((c) => c.id === id) || list[0] || null;
  }

  function addTransaction() {
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0) { showToast("Введите сумму больше 0", "warn"); return; }

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
      const phrases = [
        "🎉 Доход добавлен! Так держать! 💪",
        "🚀 Отлично! Ты усиливаешь свой бюджет!",
        "📈 Записано! Хороший шаг к контролю финансов!",
      ];
      setMotivateText(phrases[Math.floor(Math.random() * phrases.length)]);
      setMotivate(true);
      setTimeout(() => setMotivate(false), 3000);
    }
  }

  function removeTx(id) {
    if (!confirm("Удалить операцию?")) return;
    setData((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== id) }));
  }

  function addCategory() {
    const name = newCatName.trim();
    if (!name) { showToast("Введите название категории", "warn"); return; }

    const pool = catMode === "income" ? ICONS_INCOME : ICONS_EXPENSE;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const newCat = { id: uid(), name, icon: picked.e, color: picked.c };

    setData((prev) => ({
      ...prev,
      categories: { ...prev.categories, [catMode]: [newCat, ...prev.categories[catMode]] },
    }));

    setNewCatName("");
    showToast("Категория успешно добавлена ✅", "ok");
  }

  function startEditCat(c) {
    setEditCatId(c.id);
    setEditCatName(c.name);
    setPendingIcon({ e: c.icon, c: c.color });
  }

  function saveEditCat() {
    if (!editCatId) return;
    const name = editCatName.trim();
    if (!name) { showToast("Название не может быть пустым", "warn"); return; }

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
    showToast("Категория сохранена ✅", "ok");
  }

  function deleteCategory(id) {
    const list = categories[catMode];
    if (list.length <= 1) { showToast("Нельзя удалить последнюю категорию", "warn"); return; }
    if (!confirm("Удалить категорию?")) return;

    setData((prev) => {
      const nextCats = prev.categories[catMode].filter((c) => c.id !== id);
      const fallbackId = nextCats[0]?.id || "";
      const nextItems = prev.items.map((x) => {
        const typeMatch = x.type === (catMode === "income" ? "income" : "expense");
        if (typeMatch && x.categoryId === id) return { ...x, categoryId: fallbackId };
        return x;
      });
      return { ...prev, categories: { ...prev.categories, [catMode]: nextCats }, items: nextItems };
    });

    showToast("Категория удалена 🗑️", "ok");
  }

  /** HOME */
  const todayItems = useMemo(() => items.filter((x) => x.date === todayISO), [items, todayISO]);
  const todayIncome = useMemo(() => sum(todayItems, "income"), [todayItems]);
  const todayExpense = useMemo(() => sum(todayItems, "expense"), [todayItems]);
  const todayNet = todayIncome - todayExpense;

  /** OPS */
  const catOptionsForFilters = useMemo(() => {
    const exp = categories.expense.map(c => ({ ...c, type: "expense" }));
    const inc = categories.income.map(c => ({ ...c, type: "income" }));
    return [...exp, ...inc];
  }, [categories]);

  const [opsMode, setOpsMode] = useState("all");
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [dQuery, setDQuery] = useState("");
  const [dCatIds, setDCatIds] = useState([]);

  const [aMode, setAMode] = useState("all");
  const [aFrom, setAFrom] = useState("");
  const [aTo, setATo] = useState("");
  const [aQuery, setAQuery] = useState("");
  const [aCatIds, setACatIds] = useState([]);

  function applyOpsFilters() {
    setAMode(opsMode);
    setAFrom(dFrom);
    setATo(dTo);
    setAQuery(dQuery);
    setACatIds(dCatIds);
    showToast("Фильтр применён ✅", "ok");
  }

  function resetOpsFilters() {
    setOpsMode("all");
    setDFrom("");
    setDTo("");
    setDQuery("");
    setDCatIds([]);

    setAMode("all");
    setAFrom("");
    setATo("");
    setAQuery("");
    setACatIds([]);
  }

  const filteredOps = useMemo(() => {
    let arr = [...items];
    if (aMode !== "all") arr = arr.filter(x => x.type === aMode);
    if (aFrom) arr = arr.filter(x => x.date >= aFrom);
    if (aTo) arr = arr.filter(x => x.date <= aTo);
    if (aQuery.trim()) {
      const q = aQuery.trim().toLowerCase();
      arr = arr.filter(x => (x.note || "").toLowerCase().includes(q));
    }
    if (aCatIds.length) arr = arr.filter(x => aCatIds.includes(x.categoryId));

    arr.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1;
    });
    return arr;
  }, [items, aMode, aFrom, aTo, aQuery, aCatIds]);

  /** REPORTS */
  const nowYear = Number(todayISO.slice(0, 4));
  const nowMonth = Number(todayISO.slice(5, 7));

  const [reportType, setReportType] = useState("expense");
  const [reportCatIds, setReportCatIds] = useState([]);

  const [tmpMonth, setTmpMonth] = useState(nowMonth);
  const [tmpYear, setTmpYear] = useState(nowYear);

  const [appliedMonth, setAppliedMonth] = useState(null);
  const [appliedYear, setAppliedYear] = useState(null);

  const monthItems = useMemo(() => ([
    { value: 1, text: "Январь" }, { value: 2, text: "Февраль" }, { value: 3, text: "Март" }, { value: 4, text: "Апрель" },
    { value: 5, text: "Май" }, { value: 6, text: "Июнь" }, { value: 7, text: "Июль" }, { value: 8, text: "Август" },
    { value: 9, text: "Сентябрь" }, { value: 10, text: "Октябрь" }, { value: 11, text: "Ноябрь" }, { value: 12, text: "Декабрь" },
  ]), []);

  // ✅ ВАЖНО: годы до 2090
  const yearItems = useMemo(() => {
    // нижняя граница: либо самый ранний год в данных, либо текущий-5 (чтобы можно было назад),
    // но не ниже 1970 (безопасный минимум)
    let minY = nowYear;
    for (const it of items) {
      const y = Number(it?.date?.slice(0, 4));
      if (!y) continue;
      minY = Math.min(minY, y);
    }
    minY = Math.max(1970, minY - 5);

    // верхняя граница: ВСЕГДА 2090 (как ты попросил)
    const maxY = 2090;

    const list = [];
    for (let y = minY; y <= maxY; y++) list.push({ value: y, text: String(y) });
    return list;
  }, [items, nowYear]);

  function applyReport() {
    setAppliedMonth(tmpMonth);
    setAppliedYear(tmpYear);
    showToast("Отчёт применён ✅", "ok");
  }

  function resetReport() {
    setAppliedMonth(null);
    setAppliedYear(null);
    setReportCatIds([]);
    setTmpMonth(nowMonth);
    setTmpYear(nowYear);
    showToast("Отчёт сброшен ✅", "ok");
  }

  const activeReportRange = useMemo(() => {
    if (appliedYear && appliedMonth) return monthRangeISO(Number(appliedYear), Number(appliedMonth));
    return null;
  }, [appliedYear, appliedMonth]);

  const reportRangeItems = useMemo(() => {
    if (!activeReportRange) return [];
    return items.filter(x => inRange(x.date, activeReportRange.from, activeReportRange.to));
  }, [items, activeReportRange]);

  const reportItems = useMemo(() => {
    let arr = reportRangeItems.filter(x => x.type === reportType);
    if (reportCatIds.length) arr = arr.filter(x => reportCatIds.includes(x.categoryId));
    arr.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1;
    });
    return arr;
  }, [reportRangeItems, reportType, reportCatIds]);

  const reportTotal = useMemo(() => reportItems.reduce((s, x) => s + (Number(x.amount) || 0), 0), [reportItems]);

  const donutParts = useMemo(() => {
    if (!activeReportRange) return [];
    const map = new Map();
    for (const x of reportItems) map.set(x.categoryId, (map.get(x.categoryId) || 0) + (Number(x.amount) || 0));
    const list = Array.from(map.entries()).map(([catId, amount]) => {
      const cat = categoryById(reportType === "income" ? "income" : "expense", catId);
      return { label: `${cat?.icon || "🏷️"} ${cat?.name || "Категория"}`, value: amount, color: cat?.color || "#8b94a7" };
    });
    list.sort((a, b) => b.value - a.value);
    return list;
  }, [reportItems, reportType, activeReportRange]);

  const monthComparison = useMemo(() => {
    if (!(appliedYear && appliedMonth)) return null;

    const cur = monthRangeISO(Number(appliedYear), Number(appliedMonth));
    const pm = prevMonth(Number(appliedYear), Number(appliedMonth));
    const prevR = monthRangeISO(pm.year, pm.month);

    const curTotal = items
      .filter(x => x.type === reportType)
      .filter(x => inRange(x.date, cur.from, cur.to))
      .reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const prevTotal = items
      .filter(x => x.type === reportType)
      .filter(x => inRange(x.date, prevR.from, prevR.to))
      .reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const diff = curTotal - prevTotal;
    const pct = pctChange(curTotal, prevTotal);

    return { curTotal, prevTotal, diff, pct };
  }, [items, reportType, appliedYear, appliedMonth]);

  /** SETTINGS */
  function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `money-tracker-backup-${todayISO}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (!parsed || typeof parsed !== "object") throw new Error("bad");
        const next = {
          labels: { ...DEFAULT_DATA.labels, ...(parsed.labels || {}) },
          categories: {
            expense: Array.isArray(parsed.categories?.expense) ? parsed.categories.expense : DEFAULT_DATA.categories.expense,
            income: Array.isArray(parsed.categories?.income) ? parsed.categories.income : DEFAULT_DATA.categories.income,
          },
          items: Array.isArray(parsed.items) ? parsed.items : [],
        };
        if (!confirm("Импортировать данные и заменить текущие?")) return;
        setData(next);
        showToast("Импорт выполнен ✅", "ok");
      } catch {
        showToast("Не удалось импортировать файл", "warn");
      }
    };
    reader.readAsText(file);
  }

  function clearAll() {
    if (!confirm("Вы точно хотите удалить ВСЕ данные? Это действие нельзя отменить.")) return;
    setData(DEFAULT_DATA);
    alert("✅ Все данные полностью удалены!");
  }

  function setLabel(key, value) {
    setData((prev) => ({ ...prev, labels: { ...prev.labels, [key]: value } }));
  }

  return (
    <div className="app">
      <Toast toast={toast} />

      {motivate && (
        <div className="motivate">
          <div className="pop">{motivateText}</div>
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
        {/* HOME */}
        {tab === "today" && (
          <div className="card">
            <div className="homeDateTime">
              <div className="homeDate">{mskDateLong(new Date(tick))}</div>
              <div className="homeTime">{mskTimeWithSeconds(new Date(tick))} МСК</div>
            </div>

            <div className="bigAddWrap">
              <button className="bigAdd" type="button" onClick={() => setAddOpen(true)}>
                ✨ Добавить операцию
              </button>
            </div>

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
                            <span className="badge" style={{ background: (cat?.color || "#8b94a7") + "22", borderColor: (cat?.color || "#8b94a7") + "55" }}>
                              {cat?.icon || "🏷️"}
                            </span>
                            {cat?.name || "Категория"}
                            <span className="pill smallPill">{mskTimeFromTs(x.createdAt)} МСК</span>
                          </div>
                          <div className="item-sub">{x.note || (x.type === "income" ? "Доход" : "Расход")}</div>
                        </div>

                        <div className="row">
                          <div className={`amount ${x.type === "income" ? "pos" : "neg"}`}>
                            {x.type === "income" ? "+" : "-"}{formatMoney(x.amount)} ₽
                          </div>
                          <button className="iconbtn" type="button" onClick={() => removeTx(x.id)} title="Удалить">🗑️</button>
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

            <div className="triTabs">
              <button className={opsMode === "expense" ? "active" : ""} type="button" onClick={() => setOpsMode("expense")}>Расходы</button>
              <button className={opsMode === "all" ? "active" : ""} type="button" onClick={() => setOpsMode("all")}>Все</button>
              <button className={opsMode === "income" ? "active" : ""} type="button" onClick={() => setOpsMode("income")}>Доходы</button>
            </div>

            <div style={{ height: 12 }} />

            <div className="split">
              <div className="field">
                <div className="label">Поиск по комментарию</div>
                <div className="row" style={{ width: "100%" }}>
                  <input
                    className="input"
                    placeholder="Например: помидор"
                    value={dQuery}
                    onChange={(e) => setDQuery(e.target.value)}
                  />
                  <button className="btn btn-primary" type="button" onClick={applyOpsFilters}>Применить</button>
                </div>
              </div>

              <div className="field">
                <div className="label">Диапазон дат</div>
                <div className="row" style={{ width: "100%" }}>
                  <input className="input" type="date" value={dFrom} onChange={(e) => setDFrom(e.target.value)} />
                  <input className="input" type="date" value={dTo} onChange={(e) => setDTo(e.target.value)} />
                  <button className="btn btn-primary" type="button" onClick={applyOpsFilters}>Применить</button>
                </div>
              </div>

              <div className="field">
                <div className="label">Фильтр по категориям (можно несколько)</div>
                <div className="chips">
                  {catOptionsForFilters.map((c) => {
                    const active = dCatIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={"chip" + (active ? " active" : "")}
                        onClick={() => setDCatIds((prev) => active ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                      >
                        <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "55" }}>{c.icon}</span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>

                <div style={{ height: 10 }} />
                <div className="row">
                  <button className="btn" type="button" onClick={() => { resetOpsFilters(); showToast("Фильтры сброшены ✅", "ok"); }}>
                    Сброс
                  </button>
                  <button className="btn btn-primary" type="button" onClick={applyOpsFilters}>
                    Применить
                  </button>
                </div>
              </div>
            </div>

            <div style={{ height: 14 }} />

            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="pill">Категории</div>
              <button className="btn btn-primary" type="button" onClick={() => { setCatMode("expense"); setManageCatsOpen(true); }}>
                ⚙️ Управлять
              </button>
            </div>

            <div style={{ height: 12 }} />

            {filteredOps.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.65)" }}>
                Ничего не найдено по фильтрам.
              </div>
            ) : (
              <div className="list">
                {filteredOps.map((x) => {
                  const cat = categoryById(x.type, x.categoryId);
                  return (
                    <div className="item" key={x.id}>
                      <div className="item-left">
                        <div className="item-title">
                          <span className="badge" style={{ background: (cat?.color || "#8b94a7") + "22", borderColor: (cat?.color || "#8b94a7") + "55" }}>
                            {cat?.icon || "🏷️"}
                          </span>
                          {cat?.name || "Категория"}{" "}
                          <span style={{ color: "rgba(255,255,255,0.55)" }}>•</span>{" "}
                          <span style={{ color: "rgba(255,255,255,0.75)" }}>{x.date}</span>
                          <span className="pill smallPill">{mskTimeFromTs(x.createdAt)} МСК</span>
                        </div>
                        <div className="item-sub">{x.note || (x.type === "income" ? "Доход" : "Расход")}</div>
                      </div>

                      <div className="row">
                        <div className={`amount ${x.type === "income" ? "pos" : "neg"}`}>
                          {x.type === "income" ? "+" : "-"}{formatMoney(x.amount)} ₽
                        </div>
                        <button className="iconbtn" type="button" onClick={() => removeTx(x.id)} title="Удалить">🗑️</button>
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
                {activeReportRange ? `${activeReportRange.from} → ${activeReportRange.to}` : "Выбери месяц+год и нажми Применить"}
              </div>
            </div>

            <div className="seg2">
              <button className={reportType === "expense" ? "active" : ""} type="button" onClick={() => setReportType("expense")}>Расходы</button>
              <button className={reportType === "income" ? "active" : ""} type="button" onClick={() => setReportType("income")}>Доходы</button>
            </div>

            <div style={{ height: 12 }} />

            <div className="wheelRow">
              <WheelPicker label="Месяц" items={monthItems} value={tmpMonth} onChange={setTmpMonth} loop={true} />
              <WheelPicker label="Год" items={yearItems} value={tmpYear} onChange={setTmpYear} loop={false} />
            </div>

            <div style={{ height: 10 }} />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" type="button" onClick={resetReport}>Сброс</button>
              <button className="btn btn-primary" type="button" onClick={applyReport}>Применить</button>
            </div>

            <div style={{ height: 14 }} />

            {!activeReportRange ? (
              <div className="emptyReports">
                <div className="emptyTitle">Отчёты пустые</div>
                <div className="emptySub">
                  Выбери <b>месяц</b> и <b>год</b> и нажми <b>Применить</b>.
                </div>
              </div>
            ) : (
              <>
                <div className="field">
                  <div className="label">Фильтр по категориям (можно несколько)</div>
                  <div className="chips">
                    {(reportType === "expense" ? categories.expense : categories.income).map((c) => {
                      const active = reportCatIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={"chip" + (active ? " active" : "")}
                          onClick={() => setReportCatIds((prev) => active ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                        >
                          <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "55" }}>{c.icon}</span>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ height: 14 }} />

                <Donut
                  parts={donutParts}
                  totalLabel={`${formatMoney(reportTotal)} ₽`}
                  subtitle={reportType === "income" ? "Всего доходов" : "Всего расходов"}
                />

                <div style={{ height: 14 }} />

                <div className="card innerCard">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div className="pill">Сравнение с прошлым месяцем</div>
                    <div className="pill">{appliedMonth}.{appliedYear}</div>
                  </div>

                  <div className="compareText">
                    <div className="compareBig">
                      {reportType === "income" ? "Доход" : "Расход"} за месяц: {formatMoney(monthComparison?.curTotal || 0)} ₽
                    </div>

                    {(monthComparison?.prevTotal || 0) > 0 ? (
                      <div className="compareSmall">
                        {monthComparison.diff >= 0
                          ? `В этом месяце ${reportType === "income" ? "заработано" : "потрачено"} больше на +${formatMoney(Math.abs(monthComparison.diff))} ₽`
                          : `В этом месяце ${reportType === "income" ? "заработано" : "потрачено"} меньше на -${formatMoney(Math.abs(monthComparison.diff))} ₽`
                        }
                        {" "}({(monthComparison.diff >= 0 ? "+" : "-")}{Math.abs(monthComparison.pct).toFixed(1)}%).
                      </div>
                    ) : (
                      <div className="compareSmall">В прошлом месяце нет данных — сравнение недоступно.</div>
                    )}
                  </div>
                </div>

                <div style={{ height: 14 }} />

                <div className="card innerCard">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div className="pill">Операции за период</div>
                    <div className="pill">{reportItems.length} шт.</div>
                  </div>

                  <div style={{ height: 10 }} />

                  {reportItems.length === 0 ? (
                    <div style={{ color: "rgba(255,255,255,0.65)" }}>Нет операций под выбранные фильтры.</div>
                  ) : (
                    <div className="list">
                      {reportItems.slice(0, 80).map((x) => {
                        const cat = categoryById(x.type, x.categoryId);
                        return (
                          <div className="item" key={x.id}>
                            <div className="item-left">
                              <div className="item-title">
                                <span className="badge" style={{ background: (cat?.color || "#8b94a7") + "22", borderColor: (cat?.color || "#8b94a7") + "55" }}>
                                  {cat?.icon || "🏷️"}
                                </span>
                                {cat?.name || "Категория"}{" "}
                                <span style={{ color: "rgba(255,255,255,0.55)" }}>•</span>{" "}
                                <span style={{ color: "rgba(255,255,255,0.78)" }}>{x.date}</span>
                                <span className="pill smallPill">{mskTimeFromTs(x.createdAt)} МСК</span>
                              </div>
                              <div className="item-sub">{x.note || (x.type === "income" ? "Доход" : "Расход")}</div>
                            </div>

                            <div className="row">
                              <div className={`amount ${x.type === "income" ? "pos" : "neg"}`}>
                                {x.type === "income" ? "+" : "-"}{formatMoney(x.amount)} ₽
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
              <div className="h">Настройки</div>
            </div>

            <div className="card innerCard" style={{ padding: 16 }}>
              <div className="h" style={{ marginBottom: 6 }}>📲 Иконка на экран “Домой” (iPhone)</div>
              <div className="settingsText">
                Открой сайт в <b>Safari</b> → <b>Поделиться</b> → <b>На экран Домой</b>.
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-primary" type="button" onClick={() => alert("Safari → Поделиться → На экран Домой")}>
                  Показать подсказку
                </button>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="split">
              <button className="btn btn-primary" type="button" onClick={exportJSON}>Экспорт (бэкап JSON)</button>
              <label className="btn" style={{ textAlign: "center" }}>
                Импорт (JSON)
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importJSON(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            <div style={{ height: 16 }} />

            <div className="centerRow">
              <button className="btn btn-danger" type="button" onClick={() => {
                if (!confirm("Вы точно хотите удалить ВСЕ данные? Это действие нельзя отменить.")) return;
                setData(DEFAULT_DATA);
                alert("✅ Все данные полностью удалены!");
              }} style={{ minWidth: 240 }}>
                Удалить все данные
              </button>
            </div>

            <div style={{ height: 14 }} />
            <div className="versionLine">v1.0 • 01.02.2026</div>
          </div>
        )}
      </div>

      {/* TABS */}
      <div className="tabs">
        <div className="tabs-inner">
          <button className={`tab ${tab === "today" ? "active" : ""}`} type="button" onClick={() => setTab("today")}>
            <div>🏠</div><small>{labels.tabToday}</small>
          </button>
          <button className={`tab ${tab === "ops" ? "active" : ""}`} type="button" onClick={() => setTab("ops")}>
            <div>📒</div><small>{labels.tabOps}</small>
          </button>
          <button className={`tab ${tab === "reports" ? "active" : ""}`} type="button" onClick={() => setTab("reports")}>
            <div>📊</div><small>{labels.tabReports}</small>
          </button>
          <button className={`tab ${tab === "settings" ? "active" : ""}`} type="button" onClick={() => setTab("settings")}>
            <div>⚙️</div><small>{labels.tabSettings}</small>
          </button>
        </div>
      </div>

      {/* ADD MODAL */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal modal-solid" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="h">Добавить операцию</div>
              <button className="iconbtn" type="button" onClick={() => setAddOpen(false)}>✕</button>
            </div>

            <div className="seg2" style={{ marginBottom: 12 }}>
              <button className={type === "expense" ? "active" : ""} type="button" onClick={() => setType("expense")}>Расход</button>
              <button className={type === "income" ? "active" : ""} type="button" onClick={() => setType("income")}>Доход</button>
            </div>

            <div className="split">
              <div className="field">
                <div className="label">Сумма</div>
                <input className="input" inputMode="decimal" placeholder="Например: 500" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">Дата (МСК)</div>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">Категория</div>
                <CategoryPicker
                  value={categoryId}
                  categories={currentCats}
                  onPick={() => setCatPickOpen(true)}
                  onManage={() => { setCatMode(type === "income" ? "income" : "expense"); setManageCatsOpen(true); }}
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
              type="button"
              style={{ width: "100%", padding: 12, fontSize: 16, fontWeight: 900 }}
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

      {manageCatsOpen && (
        <div className="modal-backdrop" onClick={() => setManageCatsOpen(false)}>
          <div className="modal modal-solid" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="h">Категории</div>
              <button className="iconbtn" type="button" onClick={() => setManageCatsOpen(false)}>✕</button>
            </div>

            <div className="seg2" style={{ marginBottom: 12 }}>
              <button className={catMode === "expense" ? "active" : ""} type="button" onClick={() => setCatMode("expense")}>Расходы</button>
              <button className={catMode === "income" ? "active" : ""} type="button" onClick={() => setCatMode("income")}>Доходы</button>
            </div>

            <div className="field">
              <div className="label">Добавить категорию</div>
              <div className="row" style={{ width: "100%" }}>
                <input className="input" placeholder="Например: Одежда" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                <button className="btn btn-primary" type="button" onClick={addCategory}>Добавить</button>
              </div>
            </div>

            {editCatId && (
              <>
                <div style={{ height: 12 }} />
                <div className="card innerCard" style={{ padding: 12 }}>
                  <div className="h" style={{ marginBottom: 10 }}>Редактирование</div>

                  <div className="field">
                    <div className="label">Название</div>
                    <input className="input" value={editCatName} onChange={(e) => setEditCatName(e.target.value)} />
                  </div>

                  <div style={{ height: 10 }} />

                  <div className="field">
                    <div className="label">Иконка</div>
                    <button className="pickBtn" type="button" onClick={() => setIconPickOpen(true)}>
                      <span className="pickLeft">
                        <span className="badge" style={{ background: (pendingIcon?.c || "#8b94a7") + "22", borderColor: (pendingIcon?.c || "#8b94a7") + "55" }}>
                          {pendingIcon?.e || "🏷️"}
                        </span>
                        <span>
                          <div className="pickName">Выбрать иконку</div>
                          <div className="pickHint">цветные варианты</div>
                        </span>
                      </span>
                      <span className="pill">выбрать</span>
                    </button>
                  </div>

                  <div style={{ height: 10 }} />

                  <div className="row">
                    <button className="btn btn-primary" type="button" onClick={saveEditCat}>Сохранить</button>
                    <button className="btn" type="button" onClick={() => { setEditCatId(null); setEditCatName(""); setPendingIcon(null); }}>
                      Отмена
                    </button>
                  </div>
                </div>
              </>
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
                    <button className="iconbtn" type="button" title="Редактировать" onClick={() => startEditCat(c)}>✏️</button>
                    <button className="iconbtn" type="button" title="Удалить" onClick={() => deleteCategory(c.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 10 }} />
            <div className="hintSmall">
              Категории сохраняются. Удалённая категория заменится на первую доступную.
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
