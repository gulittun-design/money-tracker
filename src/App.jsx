import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "money_tracker_v2_full";
const APP_PIN_KEY = "money_tracker_app_pin_v1"; // PIN для входа в приложение (локально)
const APP_PIN_LEN = 4;

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
  { e: "🧠", c: "#a78bfa" },
  { e: "🍣", c: "#fb7185" },
  { e: "🥦", c: "#22c55e" },
  { e: "🧴", c: "#60a5fa" },
  { e: "🎧", c: "#c084fc" },
  { e: "📚", c: "#38bdf8" },
  { e: "🛠️", c: "#f97316" },
  { e: "👶", c: "#f472b6" },
];

const ICONS_INCOME = [
  { e: "💼", c: "#34d399" },
  { e: "💰", c: "#22c55e" },
  { e: "📈", c: "#38bdf8" },
  { e: "🤝", c: "#22d3ee" },
  { e: "🎁", c: "#f472b6" },
  { e: "🏦", c: "#a78bfa" },
  { e: "🪙", c: "#facc15" },
  { e: "🧾", c: "#94a3b8" },
  { e: "🛍️", c: "#60a5fa" },
  { e: "🚀", c: "#fb7185" },
  { e: "🧠", c: "#c084fc" },
  { e: "📦", c: "#f97316" },
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
  return items
    .filter((x) => x.type === type)
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);
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

function safeSave(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function getAppPin() {
  try {
    const v = localStorage.getItem(APP_PIN_KEY);
    return v ? String(v) : "";
  } catch {
    return "";
  }
}
function setAppPin(pin) {
  try {
    localStorage.setItem(APP_PIN_KEY, String(pin));
  } catch {}
}

function formatRuDateTimeMSK(ts) {
  const dt = new Date(ts);
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(dt);
}

function formatTimeMSK(ts) {
  const dt = new Date(ts);
  return (
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(dt) + " МСК"
  );
}

function EditableText({ value, onChange, disabled }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => setTemp(value), [value]);
  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 50);
  }, [editing]);

  if (disabled)
    return (
      <span
        style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {value}
      </span>
    );

  if (!editing) {
    return (
      <span className="editable">
        <span className="editableText">{value}</span>
        <button
          className="pencilBtn"
          onClick={() => setEditing(true)}
          title="Редактировать"
        >
          ✏️
        </button>
      </span>
    );
  }

  return (
    <span className="editable">
      <input
        ref={inputRef}
        className="input"
        style={{ padding: 10, borderRadius: 14, width: 240, maxWidth: "60vw" }}
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
        onClick={() => {
          onChange(temp.trim() || value);
          setEditing(false);
        }}
        title="Сохранить"
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
          <button className="iconbtn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="iconGrid">
          {icons.map((ic, idx) => {
            const active = selected?.e === ic.e && selected?.c === ic.c;
            return (
              <button
                key={idx}
                className={"iconTile" + (active ? " active" : "")}
                onClick={() => {
                  onPick(ic);
                }}
                title="Выбрать"
              >
                <span
                  className="badge"
                  style={{ background: ic.c + "22", borderColor: ic.c + "66" }}
                >
                  {ic.e}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="row"
          style={{ justifyContent: "space-between", marginTop: 12 }}
        >
          <button className="btn" onClick={onClose}>
            Готово
          </button>
          <div className="pill">Листай вниз, чтобы увидеть всё</div>
        </div>
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
          <button className="iconbtn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="catGrid">
          {categories.map((c) => (
            <button
              key={c.id}
              className="catRow"
              onClick={() => {
                onSelect(c.id);
                onClose();
              }}
            >
              <div className="catRowLeft">
                <span
                  className="badge"
                  style={{
                    background: c.color + "22",
                    borderColor: c.color + "66",
                  }}
                >
                  {c.icon}
                </span>
                <div style={{ minWidth: 0, textAlign: "left" }}>
                  <div className="catRowTitle">{c.name}</div>
                  <div className="catRowSub">Нажми, чтобы выбрать</div>
                </div>
              </div>
              <div className="pill">✓</div>
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
    ? `conic-gradient(${stops
        .map(
          (s) =>
            `${s.color} ${Math.round(s.start * 100)}% ${Math.round(
              s.end * 100
            )}%`
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
          <div style={{ color: "rgba(255,255,255,0.65)" }}>
            Нет данных для выбранных фильтров.
          </div>
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
        {parts.length > 10 && (
          <div className="pill">+ ещё {parts.length - 10} категорий</div>
        )}
      </div>
    </div>
  );
}

function PinGate({ onUnlocked }) {
  const [stored, setStored] = useState(() => getAppPin());
  const [mode, setMode] = useState(() => (getAppPin() ? "enter" : "setup")); // enter | setup
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const v = getAppPin();
    setStored(v);
    setMode(v ? "enter" : "setup");
  }, []);

  function onlyDigits(v) {
    return String(v).replace(/\D/g, "").slice(0, APP_PIN_LEN);
  }

  function submitEnter() {
    if (pin.length !== APP_PIN_LEN) return setErr("Введите 4 цифры");
    if (pin !== stored) return setErr("Неверный PIN");
    setErr("");
    setPin("");
    onUnlocked();
  }

  function submitSetup() {
    if (pin.length !== APP_PIN_LEN || pin2.length !== APP_PIN_LEN)
      return setErr("Введите 4 цифры два раза");
    if (pin !== pin2) return setErr("PIN не совпадает");
    setAppPin(pin);
    setStored(pin);
    setErr("");
    setPin("");
    setPin2("");
    setMode("enter");
    onUnlocked();
  }

  return (
    <div className="pinGate">
      <div className="pinCard">
        <div className="pinTitle">🔒 Доступ к приложению</div>
        <div className="pinSub">
          {mode === "setup"
            ? "Создай PIN-код (4 цифры), чтобы защитить данные."
            : "Введи PIN-код, чтобы открыть приложение."}
        </div>

        {mode === "setup" ? (
          <div className="split" style={{ gap: 10 }}>
            <div className="field">
              <div className="label">Новый PIN</div>
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  setErr("");
                  setPin(onlyDigits(e.target.value));
                }}
              />
            </div>
            <div className="field">
              <div className="label">Повтори PIN</div>
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                value={pin2}
                onChange={(e) => {
                  setErr("");
                  setPin2(onlyDigits(e.target.value));
                }}
              />
            </div>
            <button className="btn btn-primary" onClick={submitSetup}>
              Сохранить и войти
            </button>
          </div>
        ) : (
          <div className="split" style={{ gap: 10 }}>
            <div className="field">
              <div className="label">PIN</div>
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  setErr("");
                  setPin(onlyDigits(e.target.value));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitEnter();
                }}
              />
            </div>
            <button className="btn btn-primary" onClick={submitEnter}>
              Войти
            </button>
            <div className="hintSmall">
              Если забыл PIN — сбрось данные в настройках браузера (это удалит
              всё локально).
            </div>
          </div>
        )}

        {err && <div className="pinErr">⚠️ {err}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const todayISO = toISODate();
  const [unlocked, setUnlocked] = useState(false);

  const [tab, setTab] = useState("today"); // today|ops|reports|settings
  const [data, setData] = useState(() => safeLoad());
  const { labels, categories, items } = data;

  // UI: модалки
  const [addOpen, setAddOpen] = useState(false);
  const [catPickOpen, setCatPickOpen] = useState(false);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [iconPickOpen, setIconPickOpen] = useState(false);

  // анимация дохода (увеличили время)
  const [motivate, setMotivate] = useState(false);

  // уведомления
  const [toast, setToast] = useState("");
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  }

  // форма добавления
  const [type, setType] = useState("expense"); // expense|income
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO);
  const [categoryId, setCategoryId] = useState(categories.expense[0]?.id || "");
  const [note, setNote] = useState("");

  // управление категориями
  const [catMode, setCatMode] = useState("expense"); // expense|income
  const [newCatName, setNewCatName] = useState("");
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [pendingIcon, setPendingIcon] = useState(null);

  // фильтры операций
  const [fType, setFType] = useState("all"); // expenses|all|income
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fQueryDraft, setFQueryDraft] = useState("");
  const [fQuery, setFQuery] = useState(""); // применяется кнопкой
  const [fCatIds, setFCatIds] = useState([]);

  // фильтры отчётов
  const [rType, setRType] = useState("all"); // expenses|all|income (как в операциях)
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");
  const [rCatIds, setRCatIds] = useState([]);

  // смена PIN приложения (в настройках)
  const [pinOld, setPinOld] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinNew2, setPinNew2] = useState("");

  // сохраняем всё
  useEffect(() => {
    safeSave(data);
  }, [data]);

  // при открытии формы — сброс
  useEffect(() => {
    if (!addOpen) return;
    const now = toISODate();
    setType("expense");
    setAmount("");
    setDate(now);
    setCategoryId(categories.expense[0]?.id || "");
    setNote("");
  }, [addOpen, categories.expense]);

  // при смене типа в форме — подставляем категорию
  useEffect(() => {
    if (!addOpen) return;
    const list = type === "expense" ? categories.expense : categories.income;
    setCategoryId(list[0]?.id || "");
  }, [type, addOpen, categories.expense, categories.income]);

  // операции за сегодня
  const todayItems = useMemo(
    () => items.filter((x) => x.date === todayISO),
    [items, todayISO]
  );

  const todayIncome = useMemo(() => sum(todayItems, "income"), [todayItems]);
  const todayExpense = useMemo(() => sum(todayItems, "expense"), [todayItems]);
  const todayNet = todayIncome - todayExpense;

  function setLabel(key, value) {
    setData((prev) => ({ ...prev, labels: { ...prev.labels, [key]: value } }));
  }

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
      setTimeout(() => setMotivate(false), 1600); // было 900, увеличили
    }
  }

  function removeTx(id) {
    if (!confirm("Удалить операцию?")) return;
    setData((prev) => ({
      ...prev,
      items: prev.items.filter((x) => x.id !== id),
    }));
  }

  function categoryById(typeKey, id) {
    const list = typeKey === "income" ? categories.income : categories.expense;
    return list.find((c) => c.id === id) || list[0] || null;
  }

  // ---------- Категории: CRUD ----------
  function openManageCats(forceMode) {
    const mode = forceMode || (type === "income" ? "income" : "expense");
    setCatMode(mode);
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
      categories: {
        ...prev.categories,
        [catMode]: [newCat, ...prev.categories[catMode]],
      },
    }));
    setNewCatName("");
    showToast("Категория добавлена ✅");
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
            ? {
                ...c,
                name,
                icon: pendingIcon?.e || c.icon,
                color: pendingIcon?.c || c.color,
              }
            : c
        ),
      },
    }));

    setEditCatId(null);
    setEditCatName("");
    setPendingIcon(null);
    showToast("Изменения сохранены ✅");
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
        if (
          x.type === (catMode === "income" ? "income" : "expense") &&
          x.categoryId === id
        ) {
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

    showToast("Категория удалена 🗑️");
  }

  // ---------- Операции: фильтры ----------
  const catOptionsForFilters = useMemo(() => {
    const exp = categories.expense.map((c) => ({ ...c, type: "expense" }));
    const inc = categories.income.map((c) => ({ ...c, type: "income" }));
    return [...exp, ...inc];
  }, [categories]);

  function applyOpsFilters() {
    setFQuery(fQueryDraft.trim());
  }
  function resetOpsFilters() {
    setFType("all");
    setFFrom("");
    setFTo("");
    setFQueryDraft("");
    setFQuery("");
    setFCatIds([]);
    showToast("Фильтры сброшены");
  }

  const filteredOps = useMemo(() => {
    let arr = [...items];

    if (fType === "expense") arr = arr.filter((x) => x.type === "expense");
    if (fType === "income") arr = arr.filter((x) => x.type === "income");

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
  }, [items, fType, fFrom, fTo, fQuery, fCatIds]);

  // ---------- Отчёты: диапазон дат как в операциях ----------
  function applyReports() {
    // ничего особого — просто пересчитывается useMemo
    if (!rFrom || !rTo) showToast("Выбери диапазон дат");
  }
  function resetReports() {
    setRType("all");
    setRFrom("");
    setRTo("");
    setRCatIds([]);
    showToast("Отчёт сброшен");
  }

  const reportBaseItems = useMemo(() => {
    // пока не задан диапазон — НИЧЕГО НЕ ПОКАЗЫВАЕМ
    if (!rFrom || !rTo) return [];
    let arr = items.filter((x) => x.date >= rFrom && x.date <= rTo);

    if (rType === "expense") arr = arr.filter((x) => x.type === "expense");
    if (rType === "income") arr = arr.filter((x) => x.type === "income");
    if (rCatIds.length) arr = arr.filter((x) => rCatIds.includes(x.categoryId));

    arr.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1;
    });
    return arr;
  }, [items, rFrom, rTo, rType, rCatIds]);

  const reportTotal = useMemo(
    () => reportBaseItems.reduce((s, x) => s + (Number(x.amount) || 0), 0),
    [reportBaseItems]
  );

  const donutParts = useMemo(() => {
    const map = new Map();
    for (const x of reportBaseItems) {
      map.set(
        x.categoryId,
        (map.get(x.categoryId) || 0) + (Number(x.amount) || 0)
      );
    }
    const list = Array.from(map.entries()).map(([catId, amount]) => {
      const cat = categoryById(
        rType === "income"
          ? "income"
          : rType === "expense"
          ? "expense"
          : "expense",
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
  }, [reportBaseItems, rType]); // categoryById зависит от categories, но это ок по UI

  const reportOpsList = useMemo(
    () => reportBaseItems.slice(0, 80),
    [reportBaseItems]
  );

  // ---------- Settings: PIN change ----------
  function onlyDigits(v) {
    return String(v).replace(/\D/g, "").slice(0, APP_PIN_LEN);
  }

  function changeAppPin() {
    const stored = getAppPin();

    if (!stored) {
      alert(
        "PIN ещё не установлен. Перезагрузи приложение — предложит создать."
      );
      return;
    }

    if (pinOld.length !== 4 || pinNew.length !== 4 || pinNew2.length !== 4) {
      alert("PIN должен быть 4 цифры.");
      return;
    }
    if (pinOld !== stored) {
      alert("Старый PIN неверный.");
      return;
    }
    if (pinNew !== pinNew2) {
      alert("Новый PIN не совпадает.");
      return;
    }
    if (pinNew === pinOld) {
      alert("Новый PIN должен отличаться.");
      return;
    }

    setAppPin(pinNew);
    setPinOld("");
    setPinNew("");
    setPinNew2("");
    showToast("PIN изменён ✅");
  }

  function clearAll() {
    if (
      !confirm(
        "Вы точно хотите удалить ВСЕ данные? Это действие нельзя отменить."
      )
    )
      return;
    setData(DEFAULT_DATA);
    showToast("Данные удалены");
  }

  // ---------- UI helpers ----------
  const currentCats =
    type === "income" ? categories.income : categories.expense;
  const pickIconPool = catMode === "income" ? ICONS_INCOME : ICONS_EXPENSE;

  // Топбар без кнопки "+ Добавить" (по твоей правке)
  return (
    <div className="app">
      {!unlocked && <PinGate onUnlocked={() => setUnlocked(true)} />}

      {toast && (
        <div className="toast">
          <div className="toastInner">{toast}</div>
        </div>
      )}

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
                onChange={(v) => setLabel("appName", v)}
                disabled={false}
              />
            </div>
            <div className="brand-sub">
              <EditableText
                value={labels.appTagline}
                onChange={(v) => setLabel("appTagline", v)}
                disabled={false}
              />
            </div>
          </div>

          {/* УБРАЛИ кнопку "+ Добавить" сверху */}
        </div>
      </div>

      <div className="container">
        {/* TODAY */}
        {tab === "today" && (
          <div className="card">
            <div className="card-title">
              <div className="h" style={{ textAlign: "center", width: "100%" }}>
                {formatRuDateTimeMSK(Date.now())}
              </div>
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
                <div className="kpi-value">
                  <span className="pos">+{formatMoney(todayIncome)} ₽</span>
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Расходы</div>
                <div className="kpi-value">
                  <span className="neg">-{formatMoney(todayExpense)} ₽</span>
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Итог</div>
                <div className="kpi-value">
                  <span className={todayNet >= 0 ? "pos" : "neg"}>
                    {todayNet >= 0 ? "+" : ""}
                    {formatMoney(todayNet)} ₽
                  </span>
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />

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
                            <span
                              className="badge"
                              style={{
                                background: (cat?.color || "#94a3b8") + "22",
                                borderColor: (cat?.color || "#94a3b8") + "66",
                              }}
                            >
                              {cat?.icon || "🏷️"}
                            </span>
                            {cat?.name || "Категория"}
                            <span className="pill" style={{ marginLeft: 8 }}>
                              {formatTimeMSK(x.createdAt || Date.now())}
                            </span>
                          </div>
                          <div className="item-sub">
                            {x.note ||
                              (x.type === "income" ? "Доход" : "Расход")}
                          </div>
                        </div>

                        <div className="row">
                          <div
                            className={`amount ${
                              x.type === "income" ? "pos" : "neg"
                            }`}
                          >
                            {x.type === "income" ? "+" : "-"}
                            {formatMoney(x.amount)} ₽
                          </div>
                          <button
                            className="iconbtn"
                            onClick={() => removeTx(x.id)}
                            title="Удалить"
                          >
                            🗑️
                          </button>
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

            {/* Тип: Расходы — Все — Доходы */}
            <div className="seg3" style={{ marginBottom: 12 }}>
              <button
                className={fType === "expense" ? "active" : ""}
                onClick={() => setFType("expense")}
              >
                Расходы
              </button>
              <button
                className={fType === "all" ? "active" : ""}
                onClick={() => setFType("all")}
              >
                Все
              </button>
              <button
                className={fType === "income" ? "active" : ""}
                onClick={() => setFType("income")}
              >
                Доходы
              </button>
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
              </div>

              <div className="field">
                <div className="label">Диапазон дат</div>
                <div className="row" style={{ width: "100%" }}>
                  <input
                    className="input"
                    type="date"
                    value={fFrom}
                    onChange={(e) => setFFrom(e.target.value)}
                  />
                  <input
                    className="input"
                    type="date"
                    value={fTo}
                    onChange={(e) => setFTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <div className="label">
                  Фильтр по категориям (можно несколько)
                </div>
                <div className="chips">
                  {catOptionsForFilters.map((c) => {
                    const active = fCatIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={"chip" + (active ? " active" : "")}
                        onClick={() =>
                          setFCatIds((prev) =>
                            active
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id]
                          )
                        }
                      >
                        <span
                          className="badge"
                          style={{
                            background: c.color + "22",
                            borderColor: c.color + "66",
                          }}
                        >
                          {c.icon}
                        </span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className="row"
              style={{ justifyContent: "space-between", marginTop: 12 }}
            >
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btn-primary" onClick={applyOpsFilters}>
                  Применить
                </button>
                <button className="btn" onClick={resetOpsFilters}>
                  Сброс
                </button>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => openManageCats("expense")}
              >
                ⚙️ Категории
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
                          <span
                            className="badge"
                            style={{
                              background: (cat?.color || "#94a3b8") + "22",
                              borderColor: (cat?.color || "#94a3b8") + "66",
                            }}
                          >
                            {cat?.icon || "🏷️"}
                          </span>
                          {cat?.name || "Категория"}{" "}
                          <span style={{ color: "rgba(255,255,255,0.55)" }}>
                            •
                          </span>{" "}
                          <span style={{ color: "rgba(255,255,255,0.70)" }}>
                            {x.date}
                          </span>
                          <span className="pill" style={{ marginLeft: 8 }}>
                            {formatTimeMSK(x.createdAt || Date.now())}
                          </span>
                        </div>
                        <div className="item-sub">
                          {x.note || (x.type === "income" ? "Доход" : "Расход")}
                        </div>
                      </div>

                      <div className="row">
                        <div
                          className={`amount ${
                            x.type === "income" ? "pos" : "neg"
                          }`}
                        >
                          {x.type === "income" ? "+" : "-"}
                          {formatMoney(x.amount)} ₽
                        </div>
                        <button
                          className="iconbtn"
                          onClick={() => removeTx(x.id)}
                          title="Удалить"
                        >
                          🗑️
                        </button>
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
                {rFrom && rTo ? `${rFrom} → ${rTo}` : "Выбери диапазон"}
              </div>
            </div>

            {/* Тип: Расходы — Все — Доходы */}
            <div className="seg3" style={{ marginBottom: 12 }}>
              <button
                className={rType === "expense" ? "active" : ""}
                onClick={() => setRType("expense")}
              >
                Расходы
              </button>
              <button
                className={rType === "all" ? "active" : ""}
                onClick={() => setRType("all")}
              >
                Все
              </button>
              <button
                className={rType === "income" ? "active" : ""}
                onClick={() => setRType("income")}
              >
                Доходы
              </button>
            </div>

            <div className="split">
              <div className="field">
                <div className="label">Диапазон дат</div>
                <div className="row" style={{ width: "100%" }}>
                  <input
                    className="input"
                    type="date"
                    value={rFrom}
                    onChange={(e) => setRFrom(e.target.value)}
                  />
                  <input
                    className="input"
                    type="date"
                    value={rTo}
                    onChange={(e) => setRTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <div className="label">
                  Фильтр по категориям (можно несколько)
                </div>
                <div className="chips">
                  {(rType === "income"
                    ? categories.income
                    : rType === "expense"
                    ? categories.expense
                    : catOptionsForFilters
                  ).map((c) => {
                    const active = rCatIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        className={"chip" + (active ? " active" : "")}
                        onClick={() =>
                          setRCatIds((prev) =>
                            active
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id]
                          )
                        }
                      >
                        <span
                          className="badge"
                          style={{
                            background: c.color + "22",
                            borderColor: c.color + "66",
                          }}
                        >
                          {c.icon}
                        </span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className="row"
              style={{ justifyContent: "space-between", marginTop: 12 }}
            >
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btn-primary" onClick={applyReports}>
                  Применить
                </button>
                <button className="btn" onClick={resetReports}>
                  Сброс
                </button>
              </div>
              <div className="pill">Операций: {reportBaseItems.length}</div>
            </div>

            <div style={{ height: 14 }} />

            {/* Пока не выбран диапазон — всё ноль и пусто */}
            <Donut
              parts={donutParts}
              totalLabel={`${formatMoney(reportTotal)} ₽`}
              subtitle={
                !rFrom || !rTo
                  ? "Выбери диапазон дат"
                  : rType === "income"
                  ? "Всего доходов"
                  : rType === "expense"
                  ? "Всего расходов"
                  : "Всего (по фильтру)"
              }
            />

            <div style={{ height: 14 }} />

            {/* Список операций прямо в отчётах */}
            <div
              className="card"
              style={{ padding: 14, background: "rgba(255,255,255,0.05)" }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="pill">Операции в отчёте</div>
                <div className="pill">{reportBaseItems.length} шт.</div>
              </div>

              {!rFrom || !rTo ? (
                <div
                  style={{
                    marginTop: 10,
                    color: "rgba(255,255,255,0.70)",
                    lineHeight: 1.5,
                  }}
                >
                  Выбери <b>диапазон дат</b> и нажми <b>Применить</b> — график и
                  список операций появятся.
                </div>
              ) : reportOpsList.length === 0 ? (
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.70)" }}>
                  Нет операций в выбранном периоде.
                </div>
              ) : (
                <div className="list" style={{ marginTop: 12 }}>
                  {reportOpsList.map((x) => {
                    const cat = categoryById(x.type, x.categoryId);
                    return (
                      <div className="item" key={x.id}>
                        <div className="item-left">
                          <div className="item-title">
                            <span
                              className="badge"
                              style={{
                                background: (cat?.color || "#94a3b8") + "22",
                                borderColor: (cat?.color || "#94a3b8") + "66",
                              }}
                            >
                              {cat?.icon || "🏷️"}
                            </span>
                            {cat?.name || "Категория"}
                            <span className="pill" style={{ marginLeft: 8 }}>
                              {x.date}
                            </span>
                            <span className="pill">
                              {formatTimeMSK(x.createdAt || Date.now())}
                            </span>
                          </div>
                          <div className="item-sub">
                            {x.note ||
                              (x.type === "income" ? "Доход" : "Расход")}
                          </div>
                        </div>

                        <div className="row">
                          <div
                            className={`amount ${
                              x.type === "income" ? "pos" : "neg"
                            }`}
                          >
                            {x.type === "income" ? "+" : "-"}
                            {formatMoney(x.amount)} ₽
                          </div>
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
              <div className="pill">v1.0 • 01.02.2026</div>
            </div>

            <div
              className="card"
              style={{ padding: 16, background: "rgba(255,255,255,0.05)" }}
            >
              <div className="h" style={{ marginBottom: 6 }}>
                🔐 Смена PIN-кода приложения
              </div>
              <div style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
                Этот PIN нужен, чтобы при входе в приложение никто не увидел
                твои данные.
              </div>

              <div style={{ height: 12 }} />

              <div className="split">
                <div className="field">
                  <div className="label">Старый PIN</div>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={pinOld}
                    onChange={(e) => setPinOld(onlyDigits(e.target.value))}
                    placeholder="••••"
                  />
                </div>
                <div className="field">
                  <div className="label">Новый PIN</div>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={pinNew}
                    onChange={(e) => setPinNew(onlyDigits(e.target.value))}
                    placeholder="••••"
                  />
                </div>
                <div className="field">
                  <div className="label">Повтори новый PIN</div>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={pinNew2}
                    onChange={(e) => setPinNew2(onlyDigits(e.target.value))}
                    placeholder="••••"
                  />
                </div>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={changeAppPin}>
                  Сменить PIN
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setPinOld("");
                    setPinNew("");
                    setPinNew2("");
                  }}
                >
                  Очистить
                </button>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div
              className="card"
              style={{ padding: 16, background: "rgba(255,255,255,0.05)" }}
            >
              <div className="h" style={{ marginBottom: 6 }}>
                📲 На экран “Домой” (iPhone)
              </div>
              <div style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
                Открой сайт в <b>Safari</b> → <b>Поделиться</b> →{" "}
                <b>На экран “Домой”</b>.
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    alert("Safari → Поделиться → На экран “Домой”")
                  }
                >
                  Показать подсказку
                </button>
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="centerRow">
              <button
                className="btn btn-danger"
                onClick={clearAll}
                style={{ minWidth: 220 }}
              >
                Удалить все данные
              </button>
            </div>

            <div style={{ height: 10 }} />
            <div className="hintSmall" style={{ textAlign: "center" }}>
              Если удалить данные — очистится только локальная часть приложения.
            </div>
          </div>
        )}
      </div>

      {/* Bottom tabs */}
      <div className="tabs">
        <div className="tabs-inner">
          <button
            className={`tab ${tab === "today" ? "active" : ""}`}
            onClick={() => setTab("today")}
          >
            <div>🏠</div>
            <small>{labels.tabToday}</small>
          </button>
          <button
            className={`tab ${tab === "ops" ? "active" : ""}`}
            onClick={() => setTab("ops")}
          >
            <div>📒</div>
            <small>{labels.tabOps}</small>
          </button>
          <button
            className={`tab ${tab === "reports" ? "active" : ""}`}
            onClick={() => setTab("reports")}
          >
            <div>📊</div>
            <small>{labels.tabReports}</small>
          </button>
          <button
            className={`tab ${tab === "settings" ? "active" : ""}`}
            onClick={() => setTab("settings")}
          >
            <div>⚙️</div>
            <small>{labels.tabSettings}</small>
          </button>
        </div>
      </div>

      {/* ADD MODAL */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="h">Добавить операцию</div>
              <button className="iconbtn" onClick={() => setAddOpen(false)}>
                ✕
              </button>
            </div>

            <div className="seg3" style={{ marginBottom: 12 }}>
              <button
                className={type === "expense" ? "active" : ""}
                onClick={() => setType("expense")}
              >
                Расход
              </button>
              <button
                className={type === "income" ? "active" : ""}
                onClick={() => setType("income")}
              >
                Доход
              </button>
              <button
                className="ghost"
                onClick={() =>
                  openManageCats(type === "income" ? "income" : "expense")
                }
                title="Категории"
              >
                ⚙️
              </button>
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
                <input
                  className="input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="field">
                <div className="label">Категория</div>
                <button
                  className="pickBtn"
                  onClick={() => setCatPickOpen(true)}
                >
                  <span className="pickLeft">
                    <span
                      className="badge"
                      style={{
                        background:
                          (currentCats.find((c) => c.id === categoryId)
                            ?.color || "#94a3b8") + "22",
                        borderColor:
                          (currentCats.find((c) => c.id === categoryId)
                            ?.color || "#94a3b8") + "66",
                      }}
                    >
                      {currentCats.find((c) => c.id === categoryId)?.icon ||
                        "🏷️"}
                    </span>
                    <span style={{ minWidth: 0, textAlign: "left" }}>
                      <div className="pickName">
                        {currentCats.find((c) => c.id === categoryId)?.name ||
                          "Категория"}
                      </div>
                      <div className="pickHint">Нажми, чтобы выбрать</div>
                    </span>
                  </span>
                  <span className="pill">выбрать</span>
                </button>

                <div
                  className="row"
                  style={{ marginTop: 10, justifyContent: "space-between" }}
                >
                  <button
                    className="btn"
                    onClick={() =>
                      openManageCats(type === "income" ? "income" : "expense")
                    }
                  >
                    + Добавить категорию
                  </button>
                </div>
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
              style={{
                width: "100%",
                padding: 14,
                fontSize: 16,
                fontWeight: 950,
              }}
              onClick={addTransaction}
            >
              {type === "income" ? "Добавить доход" : "Добавить расход"}
            </button>

            <div style={{ height: 10 }} />
            <div className="hintSmall">
              Данные сохраняются локально. (Под облако Google Drive подключение
              делается отдельно.)
            </div>
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
        <div
          className="modal-backdrop"
          onClick={() => setManageCatsOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="h">Категории</div>
              <button
                className="iconbtn"
                onClick={() => setManageCatsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="seg3" style={{ marginBottom: 12 }}>
              <button
                className={catMode === "expense" ? "active" : ""}
                onClick={() => setCatMode("expense")}
              >
                Расходы
              </button>
              <button
                className={catMode === "income" ? "active" : ""}
                onClick={() => setCatMode("income")}
              >
                Доходы
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setEditCatId(null);
                  setPendingIcon(null);
                }}
                title="Сброс редактирования"
              >
                ↺
              </button>
            </div>

            <div className="field">
              <div className="label">Добавить категорию</div>
              <div className="row" style={{ width: "100%" }}>
                <input
                  className="input"
                  placeholder="Например: Одежда"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <button className="btn btn-primary" onClick={addCategory}>
                  Добавить
                </button>
              </div>
            </div>

            <div style={{ height: 10 }} />

            {editCatId && (
              <div
                className="card"
                style={{ padding: 12, background: "rgba(255,255,255,0.05)" }}
              >
                <div className="h" style={{ marginBottom: 10 }}>
                  Редактирование
                </div>

                <div className="field">
                  <div className="label">Название</div>
                  <input
                    className="input"
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                  />
                </div>

                <div style={{ height: 10 }} />

                <div className="field">
                  <div className="label">Иконка</div>
                  <button
                    className="pickBtn"
                    onClick={() => setIconPickOpen(true)}
                  >
                    <span className="pickLeft">
                      <span
                        className="badge"
                        style={{
                          background: (pendingIcon?.c || "#94a3b8") + "22",
                          borderColor: (pendingIcon?.c || "#94a3b8") + "66",
                        }}
                      >
                        {pendingIcon?.e || "🏷️"}
                      </span>
                      <span style={{ textAlign: "left" }}>
                        <div className="pickName">Выбрать иконку</div>
                        <div className="pickHint">цветные варианты</div>
                      </span>
                    </span>
                    <span className="pill">выбрать</span>
                  </button>
                </div>

                <div style={{ height: 10 }} />

                <div className="row">
                  <button className="btn btn-primary" onClick={saveEditCat}>
                    Сохранить
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setEditCatId(null);
                      setEditCatName("");
                      setPendingIcon(null);
                    }}
                  >
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
                    <span
                      className="badge"
                      style={{
                        background: c.color + "22",
                        borderColor: c.color + "66",
                      }}
                    >
                      {c.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="catRowTitle">{c.name}</div>
                      <div className="catRowSub">
                        Можно редактировать или удалить
                      </div>
                    </div>
                  </div>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <button
                      className="iconbtn"
                      title="Редактировать"
                      onClick={() => startEditCat(c)}
                    >
                      ✏️
                    </button>
                    <button
                      className="iconbtn"
                      title="Удалить"
                      onClick={() => deleteCategory(c.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 10 }} />
            <div className="hintSmall">
              Категории сохраняются. Удалённая категория заменится на первую
              доступную.
            </div>
          </div>
        </div>
      )}

      <IconPicker
        open={iconPickOpen}
        onClose={() => setIconPickOpen(false)}
        icons={pickIconPool}
        selected={pendingIcon}
        onPick={(ic) => {
          setPendingIcon(ic);
          showToast("Иконка выбрана ✅");
        }}
        title="Выбор иконки"
      />
    </div>
  );
}
