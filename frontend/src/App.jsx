import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const STATUSES = ["Pending", "In Progress", "Completed"];
const PRIORITIES = ["Low", "Medium", "High"];

const EMPTY_FORM = {
  title: "",
  description: "",
  status: "Pending",
  priority: "Medium",
  due_date: "",
};

const EMPTY_STATS = {
  total: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
  highPriority: 0,
};

async function getErrorMessage(response) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    return `Request failed (${response.status})`;
  }

  const { detail, message } = body || {};

  if (Array.isArray(detail)) {
    return (
      detail
        .map((item) => (typeof item === "string" ? item : item?.msg))
        .filter(Boolean)
        .join(", ") || `Request failed (${response.status})`
    );
  }

  if (typeof detail === "string" && detail) return detail;
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  if (typeof message === "string" && message) return message;

  return `Request failed (${response.status})`;
}

function formatDate(value) {
  if (!value) return "Not set";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCreatedAt(value) {
  if (!value) return "Not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not available";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const [viewingTask, setViewingTask] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");

  const noticeTimer = useRef(null);

  // Auto-dismiss success notices after a short delay.
  useEffect(() => {
    if (!notice) return undefined;
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4500);
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [notice]);

  const showNotice = useCallback((msg) => setNotice(msg), []);

  // Fetch unfiltered tasks and compute global counts for the stat cards.
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch("/tasks/");
      if (!response.ok) return;
      const all = await response.json();
      setStats({
        total: all.length,
        pending: all.filter((t) => t.status === "Pending").length,
        inProgress: all.filter((t) => t.status === "In Progress").length,
        completed: all.filter((t) => t.status === "Completed").length,
        highPriority: all.filter((t) => t.priority === "High").length,
      });
    } catch {
      // Non-critical; keep previous stats if the request fails.
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (priorityFilter !== "All") params.set("priority", priorityFilter);

      const query = params.toString();
      const response = await fetch(`/tasks/${query ? `?${query}` : ""}`);

      if (!response.ok) throw new Error(await getErrorMessage(response));
      setTasks(await response.json());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load tasks. Check whether the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter]);

  // Load global stats once on mount.
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Debounced fetch for the filtered task list.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadTasks();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadTasks]);

  async function refreshAll() {
    await Promise.all([loadTasks(), loadStats()]);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError("");
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
  }

  function startEditing(task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
    });
    setFormError("");
    document.getElementById("task-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setNotice("");

    if (!form.title.trim()) {
      setFormError("Please enter a task title.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
    };

    setSaving(true);

    try {
      const response = await fetch(
        editingId === null ? "/tasks/" : `/tasks/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error(await getErrorMessage(response));

      const wasEditing = editingId !== null;
      resetForm();
      showNotice(
        wasEditing ? "Task updated successfully." : "Task created successfully."
      );

      await refreshAll();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not save the task."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(task, newStatus) {
    if (newStatus === task.status) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch(`/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response));

      showNotice(`Status updated for "${task.title}".`);
      await refreshAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update status."
      );
    }
  }

  async function handleDelete(task) {
    const confirmed = window.confirm(
      `Delete "${task.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch(`/tasks/${task.id}`, { method: "DELETE" });

      if (!response.ok) throw new Error(await getErrorMessage(response));

      if (editingId === task.id) resetForm();
      if (viewingTask?.id === task.id) closeTaskDetail();

      showNotice("Task deleted successfully.");
      await refreshAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete the task."
      );
    }
  }

  async function openTaskDetail(task) {
    setViewingTask(task);
    setViewError("");
    setViewLoading(true);

    try {
      const response = await fetch(`/tasks/${task.id}`);
      if (!response.ok) throw new Error(await getErrorMessage(response));
      setViewingTask(await response.json());
    } catch (err) {
      setViewError(
        err instanceof Error ? err.message : "Could not load task details."
      );
    } finally {
      setViewLoading(false);
    }
  }

  function closeTaskDetail() {
    setViewingTask(null);
    setViewError("");
    setViewLoading(false);
  }

  // Close the detail modal when the user presses Escape.
  useEffect(() => {
    if (!viewingTask) return undefined;
    function onKey(e) {
      if (e.key === "Escape") closeTaskDetail();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewingTask]);

  const hasFilters =
    Boolean(search.trim()) ||
    statusFilter !== "All" ||
    priorityFilter !== "All";

  function clearFilters() {
    setSearch("");
    setStatusFilter("All");
    setPriorityFilter("All");
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">PERSONAL PRODUCTIVITY</p>
          <h1>Task Management System</h1>
          <p className="page-subtitle">
            Organise your work, prioritise what matters, and track your progress.
          </p>
        </div>

        <div className="header-tag">
          <span className="online-dot" />
          API connected through local proxy
        </div>
      </header>

      <section className="stats-grid" aria-label="Task summaries">
        <article className="stat-card stat-card--total">
          <span className="stat-label">Total tasks</span>
          <strong>{stats.total}</strong>
          <span className="stat-note">Across all filters</span>
        </article>

        <article className="stat-card stat-card--pending">
          <span className="stat-label">Pending</span>
          <strong>{stats.pending}</strong>
          <span className="stat-note">Waiting to start</span>
        </article>

        <article className="stat-card stat-card--progress">
          <span className="stat-label">In progress</span>
          <strong>{stats.inProgress}</strong>
          <span className="stat-note">Currently being worked on</span>
        </article>

        <article className="stat-card stat-card--completed">
          <span className="stat-label">Completed</span>
          <strong>{stats.completed}</strong>
          <span className="stat-note">
            {stats.highPriority} high-priority task
            {stats.highPriority === 1 ? "" : "s"}
          </span>
        </article>
      </section>

      <section className="content-grid">
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {editingId === null ? "NEW ENTRY" : `EDIT TASK #${editingId}`}
              </p>
              <h2>{editingId === null ? "Create a task" : "Update task"}</h2>
            </div>

            {editingId !== null && (
              <button
                className="button button-light"
                onClick={resetForm}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>

          <form id="task-form" onSubmit={handleSubmit}>
            <label htmlFor="title">
              Task title <span className="required">*</span>
            </label>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handleFormChange}
              placeholder="e.g. Prepare project documentation"
              maxLength={200}
              required
            />

            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleFormChange}
              placeholder="Add useful details..."
              rows={3}
            />

            <div className="field-row">
              <div>
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleFormChange}
                >
                  {STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  name="priority"
                  value={form.priority}
                  onChange={handleFormChange}
                >
                  {PRIORITIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label htmlFor="due_date">Due date</label>
            <input
              id="due_date"
              name="due_date"
              type="date"
              value={form.due_date}
              onChange={handleFormChange}
            />

            {formError && <p className="message error-message">{formError}</p>}

            <button
              className="button button-primary submit-button"
              disabled={saving}
              type="submit"
            >
              {saving
                ? "Saving..."
                : editingId === null
                  ? "Create task"
                  : "Save changes"}
            </button>
          </form>
        </section>

        <section className="panel task-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h2>
                Tasks <span className="count-pill">{tasks.length}</span>
              </h2>
            </div>

            <button
              className="button button-light"
              onClick={refreshAll}
              disabled={loading}
              type="button"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="filters">
            <div className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search tasks by title"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search task titles..."
              />
            </div>

            <div className="filter-row">
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All statuses</option>
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by priority"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="All">All priorities</option>
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasFilters && (
            <div className="active-filters">
              <span>Active filters:</span>
              {search.trim() && (
                <span className="chip">Search: "{search.trim()}"</span>
              )}
              {statusFilter !== "All" && (
                <span className="chip">Status: {statusFilter}</span>
              )}
              {priorityFilter !== "All" && (
                <span className="chip">Priority: {priorityFilter}</span>
              )}
              <button
                className="text-button"
                onClick={clearFilters}
                type="button"
              >
                Clear all
              </button>
            </div>
          )}

          {notice && <p className="message success-message toast">{notice}</p>}

          {error && (
            <div className="message error-message">
              <span>{error}</span>
              <button
                className="text-button"
                onClick={refreshAll}
                type="button"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <div className="spinner" />
              <p>Loading tasks...</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <p>Tasks could not be loaded.</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <h3>No tasks found</h3>
              <p>
                {hasFilters
                  ? "No tasks match your current filters."
                  : "Create your first task using the form on the left."}
              </p>
              {hasFilters && (
                <button
                  className="button button-light"
                  onClick={clearFilters}
                  type="button"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="task-list">
              {tasks.map((task) => (
                <article
                  className={`task-card task-card--${task.priority.toLowerCase()}`}
                  key={task.id}
                >
                  <div className="task-card-top">
                    <div className="task-title-block">
                      <span
                        className={`priority-dot priority-${task.priority.toLowerCase()}`}
                      />
                      <h3>{task.title}</h3>
                    </div>

                    <span
                      className={`priority-badge priority-badge-${task.priority.toLowerCase()}`}
                    >
                      {task.priority}
                    </span>
                  </div>

                  {task.description && (
                    <p className="task-description">{task.description}</p>
                  )}

                  <div className="task-meta">
                    <span>Due: {formatDate(task.due_date)}</span>
                    <span>Created: {formatCreatedAt(task.created_at)}</span>
                  </div>

                  <div className="task-actions">
                    <select
                      aria-label={`Status for ${task.title}`}
                      className={`status-select status-${task.status
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                      value={task.status}
                      onChange={(event) =>
                        handleStatusChange(task, event.target.value)
                      }
                    >
                      {STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <div className="action-buttons">
                      <button
                        className="button button-light"
                        onClick={() => openTaskDetail(task)}
                        type="button"
                      >
                        View
                      </button>
                      <button
                        className="button button-light"
                        onClick={() => startEditing(task)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="button button-danger"
                        onClick={() => handleDelete(task)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <footer className="page-footer">
        <span>Task Management System</span>
        <span>React · FastAPI · SQLAlchemy · SQLite</span>
      </footer>

      {viewingTask && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-detail-title"
          onClick={closeTaskDetail}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">TASK DETAILS</p>
                <h2 id="task-detail-title">{viewingTask.title}</h2>
              </div>
              <button
                className="icon-button"
                onClick={closeTaskDetail}
                aria-label="Close task details"
                type="button"
              >
                ×
              </button>
            </div>

            {viewLoading ? (
              <div className="empty-state">
                <div className="spinner" />
                <p>Loading task details...</p>
              </div>
            ) : viewError ? (
              <p className="message error-message">{viewError}</p>
            ) : (
              <>
                <div className="modal-badges">
                  <span
                    className={`priority-badge priority-badge-${viewingTask.priority.toLowerCase()}`}
                  >
                    {viewingTask.priority} priority
                  </span>
                  <span
                    className={`status-badge status-badge-${viewingTask.status
                      .toLowerCase()
                      .replaceAll(" ", "-")}`}
                  >
                    {viewingTask.status}
                  </span>
                </div>

                <dl className="detail-grid">
                  <div>
                    <dt>Task ID</dt>
                    <dd>#{viewingTask.id}</dd>
                  </div>
                  <div>
                    <dt>Due date</dt>
                    <dd>{formatDate(viewingTask.due_date)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatCreatedAt(viewingTask.created_at)}</dd>
                  </div>
                </dl>

                <div className="detail-description">
                  <h3>Description</h3>
                  <p>
                    {viewingTask.description
                      ? viewingTask.description
                      : "No description provided."}
                  </p>
                </div>

                <div className="modal-actions">
                  <button
                    className="button button-light"
                    onClick={() => {
                      startEditing(viewingTask);
                      closeTaskDetail();
                    }}
                    type="button"
                  >
                    Edit task
                  </button>
                  <button
                    className="button button-primary"
                    onClick={closeTaskDetail}
                    type="button"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default App;