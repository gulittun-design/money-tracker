import { useEffect, useMemo, useRef, useState } from "react";

/**
 * =========================
 *   ОБЛАКО (Apps Script)
 * =========================
 * Если у тебя ссылка другая — замени ТОЛЬКО ЭТУ строку:
 */
const API_URL =
  "https://script.google.com/macros/s/AKfycbyfyPWd_nFRv0ttoTC1yUXL3cBUFRLGyzzsDxzk5Ju2_YUDMwq_LkFeo52I0xzcr1y4/exec";

const STORAGE_KEY_LOCAL = "money_tracker_v4_local";
const SESSION_PIN_KEY = "money_tracker_session_pin";

/**
 * =========================
 *   ИКОНКИ
 * =========================
 */
const ICONS_EXPENSE = [
  { e: "🍔", c: "#f59e0b" },
  { e: "🛒", c: "#22c55e" },
  { e: "🚕", c: "#fbbf24" },
  { e: "🚇", c: "#60a5fa" },
  { e: "⛽️", c: "#fb7185" },
  { e: "🏠", c: "#a78bfa" },
  { e: "📱", c: "#38bdf8" },
  { e: "💊", c: "#34d399" },
  { e: "👕", c: "#f472b6" },
  { e: "🎮", c: "#c084fc" },
  { e: "🎬", c: "#fda4af" },
  { e: "🎁", c: "#fb7185" },
  { e: "📦", c: "#f97316" },
  { e: "💡", c: "#facc15" },
  { e: "🧾", c: "#94a3b8" },
  { e: "✈️", c: "#22d3ee" },
  { e: "🐶", c: "#fda4af" },
  { e: "🏋️", c: "#34d399" },
  { e: "☕️", c: "#f59e0b" },
  { e: "🍎", c: "#fb7185" },
  { e: "🍫", c: "#f97316" },
  { e: "🍞", c: "#fbbf24" },
  { e: "🥦", c: "#22c55e" },
  { e: "🍣", c: "#38bdf8" },
  { e: "🍕", c: "#f472b6" },
  { e: "🧴", c: "#a78bfa" },
  { e: "🧹", c: "#60a5fa" },
  { e: "🪑", c: "#facc15" },
  { e: "🧰", c: "#94a3b8" },
  { e: "🎓", c: "#22d3ee" },
  { e: "📚", c: "#34d399" },
  { e: "👶", c: "#fda4af" },
  { e: "🐱", c: "#f97316" },
  { e: "🩺", c: "#38bdf8" },
  { e: "🧿", c: "#a78bfa" },
  { e: "🎉", c: "#f59e0b" },
  { e: "🧃", c: "#22c55e" },
  { e: "🧁", c: "#f472b6" },
  { e: "🎧", c: "#60a5fa" },
  { e: "🧸", c: "#fb7185" },
];

const ICONS_INCOME = [
  { e: "💼", c: "#34d399" },
  { e: "💰", c: "#22c55e" },
  { e: "📈", c: "#38bdf8" },
  { e: "🤝", c: "#22d3ee" },
  { e: "🎁", c: "#f472b6" },
  { e: "🏦", c: "#a78bfa" },
  { e: "🧾", c: "#94a3b8" },
  { e: "💳", c: "#60a5fa" },
  { e: "🪙", c: "#facc15" },
  { e: "🛠️", c: "#f97316" },
  { e: "🧠", c: "#c084fc" },
  { e: "🚀", c: "#fb7185" },
];

const DEFAULT_DATA = {
  labels: {
    appName: "Мой бюджет",
    appTagline: "Фиксируй доходы и расходы — смотри отчёты",
    tabHome: "Дом",
    tabOps: "Операции",
    tabReports: "Отчёты",
    tabSettings: "Настройки",
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

function safeLoadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_DATA;
    return {
      labels: { ...DEFAULT_DATA.labels, ...(parsed.labels || {}) },
      categories: {
        expense: Array.isArray(parsed.categories?.expense)
          ? parsed.categories.expense
          : DEFAULT_DATA.categories.expense,
        income: Array.isArray(parsed.categories?.income)
          ? parsed.categories.income
          : DEFAULT_DATA.categories.income,
      },
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return DEFAULT_DATA;
  }
}

function safeSaveLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY_LOCAL, JSON.stringify(data));
  } catch {}
}

function formatMoney(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function toISODate(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function sum(items, type) {
  return items
    .filter((x) => x.type === type)
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);
}

function formatDateTimeMSK(ts) {
  try {
    return new Date(ts).toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return new Date(ts).toLocaleString("ru-RU");
  }
}

function monthKey(dateISO) {
  return dateISO.slice(0, 7);
}

function addMonths(year, month1to12, delta) {
  const d = new Date(Date.UTC(year, month1to12 - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function monthStartISO(y, m1to12) {
  const d = new Date(Date.UTC(y, m1to12 - 1, 1));
  return d.toISOString().slice(0, 10);
}
function monthEndISO(y, m1to12) {
  const d = new Date(Date.UTC(y, m1to12, 0));
  return d.toISOString().slice(0, 10);
}

function pctChange(curr, prev) {
  if (!isFinite(prev) || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

/**
 * =========================
 *   UI COMPONENTS
 * =========================
 */
function Toast({ open, text }) {
  if (!open) return null;
  return (
    <div className="toast">
      <div className="toastInner">{text}</div>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop solid" onClick={onClose}>
      <div className="modal solid" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="h">{title}</div>
          <button className="iconbtn" onClick={onClose} title="Закрыть">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditableText({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const ref = useRef(null);

  useEffect(() => setTemp(value), [value]);
  useEffect(() => {
    if (editing) setTimeout(() => ref.current?.focus(), 50);
  }, [editing]);

  if (!editing) {
    return (
      <span className="editable">
        <span className="editableText">{value}</span>
        <button className="iconbtn" onClick={() => setEditing(true)} title="Редактировать">
          ✏️
        </button>
      </span>
    );
  }

  return (
    <span className="editable">
      <input
        ref={ref}
        className="input"
        style={{ width: 260, maxWidth: "65vw" }}
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
        className="btn btn-primary"
        onClick={() => {
          onChange(temp.trim() || value);
          setEditing(false);
        }}
      >
        Сохранить
      </button>
    </span>
  );
}

function Seg3({ value, onChange, left, center, right }) {
  return (
    <div className="seg3">
      <button className={value === left.value ? "active" : ""} onClick={() => onChange(left.value)}>
        {left.label}
      </button>
      <button className={value === center.value ? "active" : ""} onClick={() => onChange(center.value)}>
        {center.label}
      </button>
      <button className={value === right.value ? "active" : ""} onClick={() => onChange(right.value)}>
        {right.label}
      </button>
    </div>
  );
}

function CategorySelectModal({ open, onClose, categories, onSelect }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop solid" onClick={onClose}>
      <div className="modal solid" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="h">Выбор категории</div>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>

        <div className="catGrid">
          {categories.map((c) => (
            <button
              key={c.id}
              className="catRowBtn"
              onClick={() => { onSelect(c.id); onClose(); }}
            >
              <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "88" }}>
                {c.icon}
              </span>
              <span className="catRowText">
                <span className="catRowTitle">{c.name}</span>
                <span className="catRowSub">Нажми, чтобы выбрать</span>
              </span>
              <span className="pill">✓</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IconPicker({ open, onClose, icons, selected, onPick, title }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop solid" onClick={onClose}>
      <div className="modal solid" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="h">{title}</div>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>

        <div className="iconPicker">
          {icons.map((ic, idx) => {
            const active = selected?.e === ic.e && selected?.c === ic.c;
            return (
              <button
                key={idx}
                className={"iconCell" + (active ? " active" : "")}
                onClick={() => { onPick(ic); onClose(); }}
              >
                <span className="badge" style={{ background: ic.c + "22", borderColor: ic.c + "88" }}>
                  {ic.e}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ height: 10 }} />
        <div className="hint">Прокручивай вниз — на iPhone всё видно и выбирается.</div>
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
    ? `conic-gradient(${stops
        .map(
          (s) =>
            `${s.color} ${Math.round(s.start * 100)}% ${Math.round(s.end * 100)}%`
        )
        .join(", ")})`
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
          <div style={{ color: "rgba(255,255,255,0.65)" }}>Нет данных.</div>
        ) : (
          parts.slice(0, 10).map((p, i) => (
            <div key={i} className="legRow">
              <div className="legLeft">
                <span className="dot" style={{ background: p.color }} />
                <span>{p.label}</span>
              </div>
              <div className="legAmt">{formatMoney(p.value)} ₽</div>
            </div>
          ))
        )}
        {parts.length > 10 && <div className="pill">+ ещё {parts.length - 10}</div>}
      </div>
    </div>
  );
}

/**
 * iPhone-style wheel (месяц/год)
 * - Месяца “по кругу”
 * - Года до 2090 (и старт с 1990)
 */
function MonthYearWheel({ open, onClose, onApply }) {
  if (!open) return null;

  const MONTHS = [
    "Январь","Февраль","Март","Апрель","Май","Июнь",
    "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
  ];

  const YEARS = [];
  for (let y = 1990; y <= 2090; y++) YEARS.push(y);

  const monthsLoop = [...MONTHS, ...MONTHS, ...MONTHS];
  const baseMonthOffset = MONTHS.length; // центральный блок
  const itemH = 44;

  const now = new Date();
  const [monthIndex, setMonthIndex] = useState(now.getMonth()); // 0..11
  const [yearIndex, setYearIndex] = useState(() => Math.max(0, YEARS.indexOf(now.getFullYear())));

  const monthRef = useRef(null);
  const yearRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      if (monthRef.current) monthRef.current.scrollTop = (baseMonthOffset + monthIndex) * itemH;
      if (yearRef.current) yearRef.current.scrollTop = yearIndex * itemH;
    }, 30);
  }, []);

  function snapMonth() {
    const el = monthRef.current;
    if (!el) return;

    const idx = Math.round(el.scrollTop / itemH);

    let normalized = idx;
    if (idx < MONTHS.length) {
      normalized = idx + MONTHS.length;
      el.scrollTop = normalized * itemH;
    } else if (idx >= MONTHS.length * 2) {
      normalized = idx - MONTHS.length;
      el.scrollTop = normalized * itemH;
    }

    const m = (normalized - baseMonthOffset) % 12;
    setMonthIndex((m + 12) % 12);
  }

  function snapYear() {
    const el = yearRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemH);
    const clamped = Math.max(0, Math.min(YEARS.length - 1, idx));
    el.scrollTop = clamped * itemH;
    setYearIndex(clamped);
  }

  const selYear = YEARS[yearIndex];
  const selMonth = monthIndex + 1;

  return (
    <div className="modal-backdrop solid" onClick={onClose}>
      <div className="modal solid" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="h">Выбор месяца и года</div>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>

        <div className="wheelWrap">
          <div className="wheelCol">
            <div
              className="wheel"
              ref={monthRef}
              onTouchEnd={snapMonth}
              onMouseUp={snapMonth}
              onScroll={() => {}}
            >
              {monthsLoop.map((m, i) => (
                <div className="wheelItem" key={i}>{m}</div>
              ))}
            </div>
            <div className="wheelLine" />
            <div className="wheelLabel">Месяц</div>
          </div>

          <div className="wheelCol">
            <div
              className="wheel"
              ref={yearRef}
              onTouchEnd={snapYear}
              onMouseUp={snapYear}
              onScroll={() => {}}
            >
              {YEARS.map((y) => (
                <div className="wheelItem" key={y}>{y}</div>
              ))}
            </div>
            <div className="wheelLine" />
            <div className="wheelLabel">Год</div>
          </div>
        </div>

        <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
          <button className="btn btn-primary" onClick={() => { onApply(selYear, selMonth); onClose(); }}>
            Применить
          </button>
          <button className="btn" onClick={onClose}>Закрыть</button>
        </div>

        <div className="hint" style={{ marginTop: 10 }}>
          Прокрутка как в будильнике iPhone. Месяца по кругу, годы до 2090.
        </div>
      </div>
    </div>
  );
}

/**
 * =========================
 *   MAIN APP
 * =========================
 */
export default function App() {
  // PIN / Cloud session
  const [pin, setPin] = useState(() => sessionStorage.getItem(SESSION_PIN_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [cloudOk, setCloudOk] = useState(false);
  const [cloudMsg, setCloudMsg] = useState("");

  // Data
  const [data, setData] = useState(() => safeLoadLocal());
  const { labels, categories, items } = data;

  // UI
  const [tab, setTab] = useState("home"); // home|ops|reports|settings

  const [toastOpen, setToastOpen] = useState(false);
  const [toastText, setToastText] = useState("");
  const toastTimer = useRef(null);
  function showToast(text) {
    setToastText(text);
    setToastOpen(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOpen(false), 1400);
  }

  // Motivate (увеличено время)
  const [motivate, setMotivate] = useState(false);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [catPickOpen, setCatPickOpen] = useState(false);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [iconPickOpen, setIconPickOpen] = useState(false);

  // Add form
  const todayISO = toISODate();
  const [type, setType] = useState("expense"); // expense|income
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO);
  const [categoryId, setCategoryId] = useState(categories.expense[0]?.id || "");
  const [note, setNote] = useState("");

  // Categories manage
  const [catMode, setCatMode] = useState("expense");
  const [newCatName, setNewCatName] = useState("");
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [pendingIcon, setPendingIcon] = useState(null);

  // Operations filters (draft + applied)
  const [opsType, setOpsType] = useState("all"); // expense|all|income

  const [opsFromDraft, setOpsFromDraft] = useState("");
  const [opsToDraft, setOpsToDraft] = useState("");
  const [opsQueryDraft, setOpsQueryDraft] = useState("");
  const [opsCatIds, setOpsCatIds] = useState([]);

  const [opsFrom, setOpsFrom] = useState("");
  const [opsTo, setOpsTo] = useState("");
  const [opsQuery, setOpsQuery] = useState("");

  // Reports: type + month/year picker + range apply/reset
  const [repType, setRepType] = useState("all"); // expense|all|income
  const [repWheelOpen, setRepWheelOpen] = useState(false);

  const [repFrom, setRepFrom] = useState("");
  const [repTo, setRepTo] = useState("");

  // Settings: change pin
  const [pinOld, setPinOld] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinNew2, setPinNew2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  // Save local
  useEffect(() => safeSaveLocal(data), [data]);

  // Live time MSK on Home
  const [nowMSK, setNowMSK] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMSK(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reset daily filters at midnight
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const ms = nextMidnight.getTime() - now.getTime();

    const t = setTimeout(() => {
      setOpsType("all");
      setOpsFrom("");
      setOpsTo("");
      setOpsQuery("");
      setOpsFromDraft("");
      setOpsToDraft("");
      setOpsQueryDraft("");
      setOpsCatIds([]);
      showToast("Фильтры сброшены (новый день)");
    }, ms);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO]);

  // Init add form when open
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
    const list = type === "expense" ? categories.expense : categories.income;
    setCategoryId(list[0]?.id || "");
  }, [type, addOpen, categories.expense, categories.income]);

  // Helpers
  function setLabel(key, value) {
    setData((prev) => ({ ...prev, labels: { ...prev.labels, [key]: value } }));
  }
  function categoryById(typeKey, id) {
    const list = typeKey === "income" ? categories.income : categories.expense;
    return list.find((c) => c.id === id) || list[0] || null;
  }

  // Cloud fetch helpers
  async function cloudGet(p) {
    const url = `${API_URL}?pin=${encodeURIComponent(p)}`;
    const res = await fetch(url, { method: "GET" });
    const json = await res.json();
    if (json && json.ok === false) throw new Error(json.error || "cloud error");
    return json;
  }
  async function cloudPost(p, payload) {
    const url = `${API_URL}?pin=${encodeURIComponent(p)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (json && json.ok === false) throw new Error(json.error || "cloud error");
    return json;
  }

  async function tryLogin() {
    setAuthErr("");
    setCloudMsg("Подключаюсь к облаку...");
    try {
      if (!/^\d{4}$/.test(pin)) {
        setAuthErr("PIN должен быть 4 цифры");
        setCloudMsg("");
        return;
      }

      const cloudData = await cloudGet(pin);

      const merged = {
        labels: { ...DEFAULT_DATA.labels, ...(cloudData.labels || {}) },
        categories: {
          expense: Array.isArray(cloudData.categories?.expense)
            ? cloudData.categories.expense
            : DEFAULT_DATA.categories.expense,
          income: Array.isArray(cloudData.categories?.income)
            ? cloudData.categories.income
            : DEFAULT_DATA.categories.income,
        },
        items: Array.isArray(cloudData.items) ? cloudData.items : [],
      };

      const isCloudEmpty =
        merged.items.length === 0 &&
        merged.categories.expense.length === 0 &&
        merged.categories.income.length === 0 &&
        Object.keys(merged.labels || {}).length === 0;

      if (isCloudEmpty) {
        await cloudPost(pin, data);
        setCloudOk(true);
        setCloudMsg("Облако подключено (загружены локальные данные)");
      } else {
        setData(merged);
        setCloudOk(true);
        setCloudMsg("Облако подключено");
      }

      setAuthed(true);
      sessionStorage.setItem(SESSION_PIN_KEY, pin);
      setTimeout(() => setCloudMsg(""), 1200);
    } catch {
      setCloudOk(false);
      setCloudMsg("");
      setAuthErr("Не удалось подключиться: проверь PIN и доступ Web App (Anyone)");
    }
  }

  function logout() {
    setAuthed(false);
    setCloudOk(false);
    setCloudMsg("");
    setAuthErr("");
    sessionStorage.removeItem(SESSION_PIN_KEY);
    setPin("");
  }

  // Autologin if session pin exists
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_PIN_KEY);
    if (saved && saved === pin && !authed) {
      tryLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cloud autosync
  const syncTimer = useRef(null);
  useEffect(() => {
    if (!authed || !cloudOk || !pin) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(async () => {
      try {
        await cloudPost(pin, data);
        setCloudMsg("Синхронизировано ✓");
        setTimeout(() => setCloudMsg(""), 900);
      } catch {
        setCloudMsg("Облако: ошибка синхронизации ⚠️");
      }
    }, 450);

    return () => syncTimer.current && clearTimeout(syncTimer.current);
  }, [data, authed, cloudOk, pin]);

  // Home stats
  const todayItems = useMemo(
    () => items.filter((x) => x.date === todayISO),
    [items, todayISO]
  );
  const todayIncome = useMemo(() => sum(todayItems, "income"), [todayItems]);
  const todayExpense = useMemo(() => sum(todayItems, "expense"), [todayItems]);
  const todayNet = todayIncome - todayExpense;

  // Add transaction
  function addTransaction() {
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0) {
      showToast("Введите сумму больше 0");
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
      setTimeout(() => setMotivate(false), 1800); // увеличено время
    }
  }

  function removeTx(id) {
    if (!confirm("Удалить операцию?")) return;
    setData((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== id) }));
  }

  // Category CRUD
  function openManageCats(mode) {
    setCatMode(mode);
    setManageCatsOpen(true);
    setNewCatName("");
    setEditCatId(null);
    setEditCatName("");
    setPendingIcon(null);
  }

  function addCategory() {
    const name = newCatName.trim();
    if (!name) {
      showToast("Введите название категории");
      return;
    }

    const pool = catMode === "income" ? ICONS_INCOME : ICONS_EXPENSE;
    const picked = pool[Math.floor(Math.random() * pool.length)];

    const newCat = { id: uid(), name, icon: picked.e, color: picked.c };

    setData((prev) => ({
      ...prev,
      categories: { ...prev.categories, [catMode]: [newCat, ...prev.categories[catMode]] },
    }));

    setNewCatName("");
    showToast("Категория успешно добавлена ✅");
  }

  function startEditCat(c) {
    setEditCatId(c.id);
    setEditCatName(c.name);
    setPendingIcon({ e: c.icon, c: c.color });
  }

  function saveEditCat() {
    if (!editCatId) return;
    const name = editCatName.trim();
    if (!name) {
      showToast("Название не может быть пустым");
      return;
    }

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
    showToast("Категория обновлена ✅");
  }

  function deleteCategory(id) {
    const list = categories[catMode];
    if (list.length <= 1) {
      showToast("Нельзя удалить последнюю категорию");
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

    showToast("Категория удалена");
  }

  // Ops filters
  const catOptionsForFilters = useMemo(() => {
    const exp = categories.expense.map((c) => ({ ...c, type: "expense" }));
    const inc = categories.income.map((c) => ({ ...c, type: "income" }));
    return [...exp, ...inc];
  }, [categories]);

  function applyOpsFilters() {
    setOpsFrom(opsFromDraft);
    setOpsTo(opsToDraft);
    setOpsQuery(opsQueryDraft.trim());
    showToast("Фильтр применён");
  }

  function resetOpsFilters() {
    setOpsType("all");
    setOpsFrom("");
    setOpsTo("");
    setOpsQuery("");
    setOpsFromDraft("");
    setOpsToDraft("");
    setOpsQueryDraft("");
    setOpsCatIds([]);
    showToast("Фильтры сброшены");
  }

  const filteredOps = useMemo(() => {
    let arr = [...items];

    if (opsType !== "all") arr = arr.filter((x) => x.type === opsType);
    if (opsFrom) arr = arr.filter((x) => x.date >= opsFrom);
    if (opsTo) arr = arr.filter((x) => x.date <= opsTo);
    if (opsQuery) {
      const q = opsQuery.toLowerCase();
      arr = arr.filter((x) => (x.note || "").toLowerCase().includes(q));
    }
    if (opsCatIds.length) arr = arr.filter((x) => opsCatIds.includes(x.categoryId));

    arr.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1;
    });

    return arr;
  }, [items, opsType, opsFrom, opsTo, opsQuery, opsCatIds]);

  // Reports apply/reset
  function applyReportRange(from, to) {
    setRepFrom(from);
    setRepTo(to);
    showToast("Период применён");
  }
  function resetReportRange() {
    setRepFrom("");
    setRepTo("");
    showToast("Период сброшен");
  }

  function applyReportMonthYear(year, month1to12) {
    const from = monthStartISO(year, month1to12);
    const to = monthEndISO(year, month1to12);
    applyReportRange(from, to);
  }

  const reportHasRange = Boolean(repFrom && repTo);

  const reportItemsAll = useMemo(() => {
    if (!reportHasRange) return [];
    let arr = items.filter((x) => x.date >= repFrom && x.date <= repTo);
    if (repType !== "all") arr = arr.filter((x) => x.type === repType);
    arr.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1;
    });
    return arr;
  }, [items, repFrom, repTo, repType, reportHasRange]);

  const reportTotalIncome = useMemo(() => sum(reportItemsAll, "income"), [reportItemsAll]);
  const reportTotalExpense = useMemo(() => sum(reportItemsAll, "expense"), [reportItemsAll]);

  // Donut parts (expense/income separately if "all", else only one)
  function buildDonutParts(typeKey) {
    const base = reportItemsAll.filter((x) => x.type === typeKey);
    const map = new Map();
    for (const x of base) map.set(x.categoryId, (map.get(x.categoryId) || 0) + (Number(x.amount) || 0));
    const list = Array.from(map.entries()).map(([catId, amount]) => {
      const cat = categoryById(typeKey, catId);
      return {
        label: `${cat?.icon || "🏷️"} ${cat?.name || "Категория"}`,
        value: amount,
        color: cat?.color || "#94a3b8",
      };
    });
    list.sort((a, b) => b.value - a.value);
    return list;
  }

  const donutExpense = useMemo(() => (reportHasRange ? buildDonutParts("expense") : []), [reportHasRange, reportItemsAll]);
  const donutIncome = useMemo(() => (reportHasRange ? buildDonutParts("income") : []), [reportHasRange, reportItemsAll]);

  // Month compare only previous month (по твоему требованию)
  const compareInfo = useMemo(() => {
    if (!reportHasRange) return null;

    // сравнение только если диапазон — это ровно месяц (YYYY-MM-01 .. YYYY-MM-last)
    const rk = monthKey(repFrom);
    const isSameMonth = monthKey(repTo) === rk;

    const dFromDay = Number(repFrom.slice(8, 10));
    const dTo = new Date(repTo + "T00:00:00Z");
    const lastDay = new Date(Date.UTC(dTo.getUTCFullYear(), dTo.getUTCMonth() + 1, 0)).getUTCDate();

    const looksLikeFullMonth = isSameMonth && dFromDay === 1 && Number(repTo.slice(8, 10)) === lastDay;
    if (!looksLikeFullMonth) return null;

    const y = Number(repFrom.slice(0, 4));
    const m = Number(repFrom.slice(5, 7));

    const prev = addMonths(y, m, -1);
    const prevFrom = monthStartISO(prev.y, prev.m);
    const prevTo = monthEndISO(prev.y, prev.m);

    const currItems = items.filter((x) => x.date >= repFrom && x.date <= repTo);
    const prevItems = items.filter((x) => x.date >= prevFrom && x.date <= prevTo);

    const currIncome = sum(currItems, "income");
    const currExpense = sum(currItems, "expense");
    const prevIncome = sum(prevItems, "income");
    const prevExpense = sum(prevItems, "expense");

    return {
      prevLabel: `${prevFrom} — ${prevTo}`,
      currIncome, currExpense, prevIncome, prevExpense,
      diffIncome: currIncome - prevIncome,
      diffExpense: currExpense - prevExpense,
      pctIncome: pctChange(currIncome, prevIncome),
      pctExpense: pctChange(currExpense, prevExpense),
    };
  }, [reportHasRange, repFrom, repTo, items]);

  // Settings actions
  async function changePin() {
    if (pinBusy) return;
    if (!/^\d{4}$/.test(pinOld) || !/^\d{4}$/.test(pinNew) || !/^\d{4}$/.test(pinNew2)) {
      showToast("PIN должен быть 4 цифры");
      return;
    }
    if (pinNew !== pinNew2) {
      showToast("Новый PIN не совпадает");
      return;
    }
    if (pinNew === pinOld) {
      showToast("Новый PIN должен отличаться");
      return;
    }

    setPinBusy(true);
    try {
      // action setPin — как в твоём Apps Script
      const res = await fetch(`${API_URL}?pin=${encodeURIComponent(pinOld)}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "setPin", oldPin: pinOld, newPin: pinNew }),
      });
      const json = await res.json();
      if (json && json.ok === false) throw new Error(json.error || "bad");

      // если смена успешна — обновляем pin в приложении
      setPin(pinNew);
      sessionStorage.setItem(SESSION_PIN_KEY, pinNew);
      showToast("PIN изменён ✅");
      setPinOld("");
      setPinNew("");
      setPinNew2("");
    } catch {
      showToast("Не удалось сменить PIN (проверь старый PIN и доступ Apps Script)");
    } finally {
      setPinBusy(false);
    }
  }

  async function manualSync() {
    if (!authed || !pin) return;
    try {
      await cloudPost(pin, data);
      showToast("Синхронизировано ✅");
    } catch {
      showToast("Ошибка синхронизации ⚠️");
    }
  }

  function clearAll() {
    if (!confirm("Вы точно хотите удалить ВСЕ данные? Это действие нельзя отменить.")) return;
    setData(DEFAULT_DATA);
    showToast("Все данные удалены ✅");
  }

  // Login screen — только ввод PIN, без создания
  if (!authed) {
    return (
      <div className="loginWrap">
        <div className="loginCard">
          <div className="loginTitle">🔒 Вход</div>
          <div className="loginSub">
            Введите PIN (4 цифры). Без правильного PIN доступ закрыт.
          </div>

          <input
            className="input"
            type="password"
            inputMode="numeric"
            pattern="\d*"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />

          {cloudMsg ? <div className="pill" style={{ marginTop: 10 }}>{cloudMsg}</div> : null}
          {authErr ? <div className="error">{authErr}</div> : null}

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={tryLogin}>
            Войти
          </button>

          <div className="loginHint" style={{ marginTop: 10 }}>
            Если не подключается — в Apps Script деплой Web App должен быть <b>Anyone</b>.
          </div>
        </div>
      </div>
    );
  }

  const currentCats = type === "income" ? categories.income : categories.expense;
  const pickIconPool = catMode === "income" ? ICONS_INCOME : ICONS_EXPENSE;

  return (
    <div className="app">
      <Toast open={toastOpen} text={toastText} />

      {motivate && (
        <div className="motivate">
          <div className="pop">🎉 Доход добавлен! Так держать! 💪</div>
        </div>
      )}

      {/* Topbar: без кнопки +Добавить (как ты просил) */}
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
        {tab === "home" && (
          <div className="card">
            <div className="card-title">
              <div className="h">📅 {formatDateTimeMSK(nowMSK)}</div>
              <div className="pill">{todayISO}</div>
            </div>

            <div className="bigAddWrap">
              <button className="bigAdd" onClick={() => setAddOpen(true)}>
                ✨ Добавить операцию
              </button>
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

            <div style={{ height: 18 }} />

            <div className="card-title">
              <div className="h">Операции за сегодня</div>
              <div className="pill">{todayItems.length} шт.</div>
            </div>

            {todayItems.length === 0 ? (
              <div className="mutedText">
                Пока пусто. Нажми <b>«Добавить операцию»</b>.
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
                            <span className="badge" style={{ background: (cat?.color || "#94a3b8") + "22", borderColor: (cat?.color || "#94a3b8") + "88" }}>
                              {cat?.icon || "🏷️"}
                            </span>
                            {cat?.name || "Категория"}
                          </div>
                          <div className="item-sub">
                            {x.note || (x.type === "income" ? "Доход" : "Расход")}
                            <span style={{ color: "rgba(255,255,255,0.50)" }}> • {formatDateTimeMSK(x.createdAt || Date.now())}</span>
                          </div>
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

        {/* OPERATIONS */}
        {tab === "ops" && (
          <div className="card">
            <div className="card-title">
              <div className="h">Все операции</div>
              <div className="pill">{filteredOps.length} шт.</div>
            </div>

            <Seg3
              value={opsType}
              onChange={setOpsType}
              left={{ value: "expense", label: "Расходы" }}
              center={{ value: "all", label: "Все" }}
              right={{ value: "income", label: "Доходы" }}
            />

            <div style={{ height: 12 }} />

            <div className="split">
              <div className="field">
                <div className="label">Поиск по комментарию</div>
                <input className="input" placeholder="Например: помидор" value={opsQueryDraft} onChange={(e) => setOpsQueryDraft(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">Диапазон дат</div>
                <div className="row" style={{ width: "100%" }}>
                  <input className="input" type="date" value={opsFromDraft} onChange={(e) => setOpsFromDraft(e.target.value)} />
                  <input className="input" type="date" value={opsToDraft} onChange={(e) => setOpsToDraft(e.target.value)} />
                </div>
              </div>

              <div className="field">
                <div className="label">Фильтр по категориям (можно несколько)</div>
                <div className="chips">
                  {catOptionsForFilters.map((c) => {
                    const active = opsCatIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={"chip" + (active ? " active" : "")}
                        onClick={() =>
                          setOpsCatIds((prev) => active ? prev.filter((id) => id !== c.id) : [...prev, c.id])
                        }
                      >
                        <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "88" }}>{c.icon}</span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="row" style={{ justifyContent: "space-between" }}>
                <button className="btn btn-primary" onClick={applyOpsFilters}>Применить</button>
                <button className="btn" onClick={resetOpsFilters}>Сброс</button>
                <button className="btn btn-primary" onClick={() => openManageCats("expense")}>⚙️ Категории</button>
              </div>
            </div>

            <div style={{ height: 14 }} />

            {filteredOps.length === 0 ? (
              <div className="mutedText">Ничего не найдено по фильтрам.</div>
            ) : (
              <div className="list">
                {filteredOps.map((x) => {
                  const cat = categoryById(x.type, x.categoryId);
                  return (
                    <div className="item" key={x.id}>
                      <div className="item-left">
                        <div className="item-title">
                          <span className="badge" style={{ background: (cat?.color || "#94a3b8") + "22", borderColor: (cat?.color || "#94a3b8") + "88" }}>
                            {cat?.icon || "🏷️"}
                          </span>
                          {cat?.name || "Категория"}{" "}
                          <span style={{ color: "rgba(255,255,255,0.60)" }}>• {x.date}</span>
                        </div>
                        <div className="item-sub">
                          {x.note || (x.type === "income" ? "Доход" : "Расход")}
                          <span style={{ color: "rgba(255,255,255,0.50)" }}> • {formatDateTimeMSK(x.createdAt || Date.now())}</span>
                        </div>
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
              <div className="h">Отчёты</div>
              <div className="pill">{reportHasRange ? `${repFrom} — ${repTo}` : "Выбери период"}</div>
            </div>

            <Seg3
              value={repType}
              onChange={setRepType}
              left={{ value: "expense", label: "Расходы" }}
              center={{ value: "all", label: "Все" }}
              right={{ value: "income", label: "Доходы" }}
            />

            <div style={{ height: 12 }} />

            <div className="split">
              <div className="field">
                <div className="label">Диапазон дат</div>
                <div className="row" style={{ width: "100%" }}>
                  <input className="input" type="date" value={repFrom} onChange={(e) => setRepFrom(e.target.value)} />
                  <input className="input" type="date" value={repTo} onChange={(e) => setRepTo(e.target.value)} />
                </div>
              </div>

              <div className="row" style={{ justifyContent: "space-between" }}>
                <button className="btn btn-primary" onClick={() => applyReportRange(repFrom, repTo)}>
                  Применить
                </button>
                <button className="btn" onClick={resetReportRange}>
                  Сброс
                </button>
                <button className="btn btn-primary" onClick={() => setRepWheelOpen(true)}>
                  🗓️ Месяц/год
                </button>
              </div>
            </div>

            <div style={{ height: 14 }} />

            {!reportHasRange ? (
              <div className="mutedText">
                В отчётах ничего не показывается, пока ты не выберешь период и не нажмёшь <b>«Применить»</b>.
              </div>
            ) : (
              <>
                {/* Итоги */}
                <div className="kpis" style={{ marginBottom: 14 }}>
                  <div className="kpi">
                    <div className="kpi-label">Доходы</div>
                    <div className="kpi-value"><span className="pos">+{formatMoney(reportTotalIncome)} ₽</span></div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">Расходы</div>
                    <div className="kpi-value"><span className="neg">-{formatMoney(reportTotalExpense)} ₽</span></div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">Итог</div>
                    <div className="kpi-value">
                      <span className={(reportTotalIncome - reportTotalExpense) >= 0 ? "pos" : "neg"}>
                        {(reportTotalIncome - reportTotalExpense) >= 0 ? "+" : ""}
                        {formatMoney(reportTotalIncome - reportTotalExpense)} ₽
                      </span>
                    </div>
                  </div>
                </div>

                {/* Donut */}
                {repType === "expense" && (
                  <Donut parts={donutExpense} totalLabel={`${formatMoney(reportTotalExpense)} ₽`} subtitle="Всего расходов" />
                )}
                {repType === "income" && (
                  <Donut parts={donutIncome} totalLabel={`${formatMoney(reportTotalIncome)} ₽`} subtitle="Всего доходов" />
                )}
                {repType === "all" && (
                  <>
                    <div className="card miniCard" style={{ marginBottom: 12 }}>
                      <div className="h">Расходы</div>
                      <div style={{ height: 10 }} />
                      <Donut parts={donutExpense} totalLabel={`${formatMoney(reportTotalExpense)} ₽`} subtitle="Всего расходов" />
                    </div>
                    <div className="card miniCard">
                      <div className="h">Доходы</div>
                      <div style={{ height: 10 }} />
                      <Donut parts={donutIncome} totalLabel={`${formatMoney(reportTotalIncome)} ₽`} subtitle="Всего доходов" />
                    </div>
                  </>
                )}

                {/* Сравнение с прошлым месяцем (только предыдущий месяц) */}
                {compareInfo && (
                  <div className="card miniCard" style={{ marginTop: 14 }}>
                    <div className="h">Сравнение с предыдущим месяцем</div>
                    <div className="mutedText" style={{ marginTop: 6 }}>
                      Предыдущий месяц: {compareInfo.prevLabel}
                    </div>
                    <div style={{ height: 10 }} />
                    <div className="compareGrid">
                      <div className="compareBox">
                        <div className="label">Доход</div>
                        <div className="bigLine pos">
                          {compareInfo.diffIncome >= 0 ? "+" : ""}{formatMoney(compareInfo.diffIncome)} ₽
                        </div>
                        <div className="mutedText">
                          {compareInfo.pctIncome === null ? "нет базы для %" : `${compareInfo.pctIncome >= 0 ? "+" : ""}${compareInfo.pctIncome.toFixed(1)}%`}
                        </div>
                      </div>

                      <div className="compareBox">
                        <div className="label">Расход</div>
                        <div className="bigLine neg">
                          {compareInfo.diffExpense >= 0 ? "+" : ""}{formatMoney(compareInfo.diffExpense)} ₽
                        </div>
                        <div className="mutedText">
                          {compareInfo.pctExpense === null ? "нет базы для %" : `${compareInfo.pctExpense >= 0 ? "+" : ""}${compareInfo.pctExpense.toFixed(1)}%`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Операции в отчётах (ниже графика) */}
                <div style={{ height: 16 }} />
                <div className="card-title">
                  <div className="h">Операции за период</div>
                  <div className="pill">{reportItemsAll.length} шт.</div>
                </div>

                {reportItemsAll.length === 0 ? (
                  <div className="mutedText">Нет операций в выбранном периоде.</div>
                ) : (
                  <div className="list">
                    {reportItemsAll.map((x) => {
                      const cat = categoryById(x.type, x.categoryId);
                      return (
                        <div className="item" key={x.id}>
                          <div className="item-left">
                            <div className="item-title">
                              <span className="badge" style={{ background: (cat?.color || "#94a3b8") + "22", borderColor: (cat?.color || "#94a3b8") + "88" }}>
                                {cat?.icon || "🏷️"}
                              </span>
                              {cat?.name || "Категория"}{" "}
                              <span style={{ color: "rgba(255,255,255,0.60)" }}>• {x.date}</span>
                            </div>
                            <div className="item-sub">
                              {x.note || (x.type === "income" ? "Доход" : "Расход")}
                              <span style={{ color: "rgba(255,255,255,0.50)" }}> • {formatDateTimeMSK(x.createdAt || Date.now())}</span>
                            </div>
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
              </>
            )}

            <MonthYearWheel
              open={repWheelOpen}
              onClose={() => setRepWheelOpen(false)}
              onApply={applyReportMonthYear}
            />
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div className="card">
            <div className="card-title">
              <div className="h">Настройки</div>
              <div className="pill">{cloudMsg || (cloudOk ? "Облако подключено" : "Облако не подключено")}</div>
            </div>

            <div className="card miniCard">
              <div className="h">📲 Добавить на экран “Домой” (iPhone)</div>
              <div className="mutedText" style={{ marginTop: 8, lineHeight: 1.5 }}>
                Открой сайт в <b>Safari</b> → нажми <b>Поделиться</b> → <b>На экран “Домой”</b>.
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={() => alert("Safari → Поделиться → На экран “Домой”")}>
                  Показать подсказку
                </button>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="card miniCard">
              <div className="h">🔐 Смена PIN</div>
              <div className="mutedText" style={{ marginTop: 6 }}>
                PIN хранится в Apps Script. Новый PIN начнёт действовать сразу.
              </div>

              <div style={{ height: 10 }} />

              <div className="field">
                <div className="label">Старый PIN</div>
                <input className="input" type="password" inputMode="numeric" maxLength={4} value={pinOld} onChange={(e) => setPinOld(e.target.value.replace(/\D/g, ""))} />
              </div>

              <div className="field">
                <div className="label">Новый PIN</div>
                <input className="input" type="password" inputMode="numeric" maxLength={4} value={pinNew} onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ""))} />
              </div>

              <div className="field">
                <div className="label">Повтори новый PIN</div>
                <input className="input" type="password" inputMode="numeric" maxLength={4} value={pinNew2} onChange={(e) => setPinNew2(e.target.value.replace(/\D/g, ""))} />
              </div>

              <div style={{ height: 10 }} />
              <button className="btn btn-primary" onClick={changePin} disabled={pinBusy}>
                {pinBusy ? "Подожди..." : "Сменить PIN"}
              </button>
            </div>

            <div style={{ height: 12 }} />

            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-primary" onClick={manualSync}>Синхронизировать</button>
              <button className="btn" onClick={logout}>Выйти</button>
            </div>

            <div style={{ height: 16 }} />

            {/* Удалить данные — по центру */}
            <div className="centerRow">
              <button className="btn btn-danger" onClick={clearAll}>Удалить все данные</button>
            </div>

            <div style={{ height: 10 }} />
            <div className="centerRow">
              <div className="pill">v1.0 • 01.02.2026</div>
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
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Добавить операцию">
        <div className="seg2" style={{ marginBottom: 12 }}>
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
            <button className="pickBtn" onClick={() => setCatPickOpen(true)}>
              <span className="pickLeft">
                <span className="badge" style={{
                  background: (categoryById(type, categoryId)?.color || "#94a3b8") + "22",
                  borderColor: (categoryById(type, categoryId)?.color || "#94a3b8") + "88",
                }}>
                  {categoryById(type, categoryId)?.icon || "🏷️"}
                </span>
                <span style={{ minWidth: 0 }}>
                  <div className="pickName">{categoryById(type, categoryId)?.name || "Категория"}</div>
                  <div className="pickHint">Нажми, чтобы выбрать</div>
                </span>
              </span>

              <span className="row" style={{ gap: 8 }}>
                <span className="pill">выбрать</span>
                <button className="iconbtn" title="Управлять категориями" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openManageCats(type === "income" ? "income" : "expense"); }}>
                  ⚙️
                </button>
              </span>
            </button>
          </div>

          <div className="field">
            <div className="label">Комментарий (необязательно)</div>
            <textarea className="textarea" placeholder="Например: продукты / подработка / заказ" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div style={{ height: 12 }} />
        <button className={`btn ${type === "income" ? "btn-green" : "btn-red"}`} style={{ width: "100%", padding: 12, fontSize: 16, fontWeight: 950 }} onClick={addTransaction}>
          {type === "income" ? "Добавить доход" : "Добавить расход"}
        </button>
      </Modal>

      <CategorySelectModal open={catPickOpen} onClose={() => setCatPickOpen(false)} categories={currentCats} onSelect={(id) => setCategoryId(id)} />

      {/* Manage categories */}
      <Modal open={manageCatsOpen} onClose={() => setManageCatsOpen(false)} title="Категории">
        <div className="seg2" style={{ marginBottom: 12 }}>
          <button className={catMode === "expense" ? "active" : ""} onClick={() => setCatMode("expense")}>Расходы</button>
          <button className={catMode === "income" ? "active" : ""} onClick={() => setCatMode("income")}>Доходы</button>
        </div>

        <div className="field">
          <div className="label">Добавить категорию</div>
          <div className="row" style={{ width: "100%" }}>
            <input className="input" placeholder="Например: Одежда" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
            <button className="btn btn-primary" onClick={addCategory}>Добавить</button>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {editCatId && (
          <div className="card miniCard">
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
                  <span className="badge" style={{ background: (pendingIcon?.c || "#94a3b8") + "22", borderColor: (pendingIcon?.c || "#94a3b8") + "88" }}>
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
              <button className="btn btn-primary" onClick={saveEditCat}>Сохранить</button>
              <button className="btn" onClick={() => { setEditCatId(null); setEditCatName(""); setPendingIcon(null); }}>Отмена</button>
            </div>
          </div>
        )}

        <div style={{ height: 12 }} />

        <div className="catGrid">
          {categories[catMode].map((c) => (
            <div className="catRow" key={c.id}>
              <div className="catRowLeft">
                <span className="badge" style={{ background: c.color + "22", borderColor: c.color + "88" }}>{c.icon}</span>
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
        <div className="hint">
          Категории сохраняются. Удалённая категория заменится на первую доступную.
        </div>
      </Modal>

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
