import React, { useEffect, useMemo, useState } from "react";

/**
 * Bug Calibration App — TaskBoard
 * Intentional bugs inside:
 * - stale state update when adding items
 * - unstable sorting + mutating state
 * - wrong memo dependencies
 * - incorrect list keys
 * - checkbox toggles wrong item sometimes
 * - fetch + abort handling bug
 * - derived state drift (stats)
 * - input validation edge case
 */

const seed = [
  { id: 1, title: "Write spec", done: false, priority: 2, createdAt: Date.now() - 100000 },
  { id: 2, title: "Fix UI", done: true, priority: 1, createdAt: Date.now() - 90000 },
  { id: 3, title: "Add tests", done: false, priority: 3, createdAt: Date.now() - 80000 },
];

function fakeFetchTasks(signal) {
  // Simulate network delay + occasional failure
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      if (Math.random() < 0.2) reject(new Error("Random network error"));
      else resolve(seed);
    }, 600);

    // BUG: abort listener clears timeout but still resolves/rejects sometimes due to missing guard
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("all"); // all | open | done
  const [sortBy, setSortBy] = useState("createdAt"); // createdAt | priority | title
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Derived stats (BUG: can drift)
  const [stats, setStats] = useState({ total: 0, done: 0 });

  useEffect(() => {
    setLoading(true);
    setError("");
    const ac = new AbortController();

    fakeFetchTasks(ac.signal)
      .then((data) => {
        setTasks(data);
        setStats({ total: data.length, done: data.filter((t) => t.done).length }); // BUG: derived state stored
      })
      .catch((e) => {
        // BUG: AbortError treated as real error -> shows error flash
        setError(e?.message || "Unknown error");
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, []);

  function addTask() {
    // BUG: validation misses whitespace-only titles
    if (title.length === 0) return;

    const newTask = {
      id: Date.now(), // OK-ish
      title,
      done: false,
      priority: 2,
      createdAt: Date.now(),
    };

    // BUG: stale state update (if multiple quick adds) + stats drift
    setTasks(tasks.concat(newTask));
    setStats({ total: stats.total + 1, done: stats.done });

    setTitle("");
  }

  function toggleDone(id) {
    // BUG: mutates task object in-place (can break memo + renders)
    const next = tasks.map((t) => {
      if (t.id === id) {
        t.done = !t.done; // mutation bug
      }
      return t;
    });
    setTasks(next);

    // BUG: stats can become wrong (uses old tasks + wrong calc)
    setStats({ total: stats.total, done: next.filter((t) => t.done).length + 1 });
  }

  function removeTask(id) {
    const next = tasks.filter((t) => t.id !== id);
    setTasks(next);

    // BUG: stats total decremented even if id not found, and done not recomputed
    setStats({ total: stats.total - 1, done: stats.done });
  }

  const visibleTasks = useMemo(() => {
    let list = tasks;

    if (filter === "open") list = list.filter((t) => !t.done);
    if (filter === "done") list = list.filter((t) => t.done);

    // BUG: sort mutates original array (tasks) because list references tasks
    // BUG: unstable compare for title (case) + priority
    list.sort((a, b) => {
      if (sortBy === "createdAt") return b.createdAt - a.createdAt;
      if (sortBy === "priority") return a.priority > b.priority ? 1 : -1;
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return 0;
    });

    return list;
    // BUG: missing dependency on sortBy/filter -> memo can go stale
  }, [tasks]);

  const donePct = useMemo(() => {
    // BUG: division by zero not handled; also uses derived stats (can drift)
    return Math.round((stats.done / stats.total) * 100);
  }, [stats.done]); // BUG: missing stats.total dep

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={{ margin: 0 }}>TaskBoard (Calibration)</h1>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          Mini app con bug intenzionali per testare diagnosi/fix del tuo autonomous AI.
        </p>

        <div style={styles.row}>
          <input
            style={styles.input}
            value={title}
            placeholder="Add a task…"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTask();
            }}
          />
          <button style={styles.btn} onClick={addTask}>
            Add
          </button>
        </div>

        <div style={styles.row}>
          <label style={styles.label}>
            Filter:
            <select style={styles.select} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="done">Done</option>
            </select>
          </label>

          <label style={styles.label}>
            Sort:
            <select style={styles.select} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="createdAt">Newest</option>
              <option value="priority">Priority</option>
              <option value="title">Title</option>
            </select>
          </label>

          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontWeight: 600 }}>
              Progress: {donePct}% {/* might show NaN */}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              total: {stats.total} • done: {stats.done}
            </div>
          </div>
        </div>

        {loading && <div style={styles.info}>Loading…</div>}
        {error && <div style={styles.error}>Error: {error}</div>}

        <ul style={styles.list}>
          {visibleTasks.map((t, index) => (
            // BUG: key uses index -> causes wrong item toggling after sort/filter
            <li key={index} style={styles.item}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleDone(t.id)}
                style={{ marginRight: 10 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ textDecoration: t.done ? "line-through" : "none", fontWeight: 600 }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  priority: {t.priority} • created: {new Date(t.createdAt).toLocaleTimeString()}
                </div>
              </div>

              <button style={styles.smallBtn} onClick={() => removeTask(t.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          Suggerimento: prova a filtrare/ordinare e poi togglare checkbox — vedrai comportamenti “strani”.
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "#0b1020",
  },
  card: {
    width: "min(760px, 100%)",
    borderRadius: 16,
    padding: 18,
    background: "white",
    boxShadow: "0 10px 30px rgba(0,0,0,.25)",
  },
  row: { display: "flex", gap: 10, alignItems: "center", marginTop: 12 },
  input: { flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" },
  btn: { padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "#f6f6f6" },
  smallBtn: { padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" },
  label: { display: "flex", gap: 8, alignItems: "center" },
  select: { padding: 8, borderRadius: 10, border: "1px solid #ddd" },
  list: { listStyle: "none", padding: 0, margin: "14px 0 0 0" },
  item: {
    display: "flex",
    alignItems: "center",
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 12,
    marginTop: 10,
    background: "#fafafa",
  },
  info: { marginTop: 12, padding: 10, borderRadius: 10, background: "#eef6ff" },
  error: { marginTop: 12, padding: 10, borderRadius: 10, background: "#ffecec", color: "#8b0000" },
};
