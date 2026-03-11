"use client";

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import { daysBetweenInclusive, getCalendarRange, isDateKey, toDateKey } from "@/lib/dates";
import type { Country, Holiday, Task } from "@/lib/types";

import DayCell from "./DayCell";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function debounceMs() {
  return 250;
}

export default function CalendarPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [query, setQuery] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [countries, setCountries] = useState<Country[]>([]);

  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authFieldErrors, setAuthFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [authBusy, setAuthBusy] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, Holiday[]>>({});
  const [holidayError, setHolidayError] = useState<string | null>(null);

  const dndEnabled = query.trim().length === 0;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const { gridStart, gridEnd } = useMemo(() => getCalendarRange(month, 0), [month]);
  const days = useMemo(() => daysBetweenInclusive(gridStart, gridEnd), [gridStart, gridEnd]);

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const bucket = map.get(t.date) || [];
      bucket.push(t);
      map.set(t.date, bucket);
    }
    for (const [k, bucket] of map) {
      bucket.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
      map.set(k, bucket);
    }
    return map;
  }, [tasks]);

  // Countries list (for "worldwide" holiday selection).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/countries");
        const data = (await res.json()) as { countries?: Country[] };
        const list = (data.countries || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setCountries(list);
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Theme
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const next = stored === "dark" ? "dark" : "light";
      setTheme(next);
      document.documentElement.dataset.theme = next;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Load current user session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as { user: { id: string; email: string } | null };
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist selected country.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("countryCode");
      if (stored && /^[A-Z]{2}$/.test(stored)) setCountryCode(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("countryCode", countryCode);
    } catch {
      // ignore
    }
  }, [countryCode]);

  // Holidays for the year of the current month.
  useEffect(() => {
    let cancelled = false;
    setHolidayError(null);
    (async () => {
      try {
        const year = String(month.getFullYear());
        const res = await fetch(`/api/holidays?year=${year}&countryCode=${countryCode}`);
        const data = (await res.json()) as { holidays?: Holiday[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load holidays");

        const map: Record<string, Holiday[]> = {};
        for (const h of data.holidays || []) {
          (map[h.date] ||= []).push(h);
        }
        if (!cancelled) setHolidaysByDate(map);
      } catch (e) {
        if (!cancelled) setHolidayError(e instanceof Error ? e.message : "Failed to load holidays");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [month, countryCode]);

  // Tasks for the visible grid.
  const pendingTaskFetch = useRef<number | null>(null);
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoadingTasks(false);
      setTaskError(null);
      return;
    }

    if (pendingTaskFetch.current) window.clearTimeout(pendingTaskFetch.current);

    let cancelled = false;
    pendingTaskFetch.current = window.setTimeout(() => {
      (async () => {
        setLoadingTasks(true);
        setTaskError(null);
        try {
          const from = toDateKey(gridStart);
          const to = toDateKey(gridEnd);
          const q = query.trim();
          const res = await fetch(
            `/api/tasks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${
              q ? `&q=${encodeURIComponent(q)}` : ""
            }`,
          );
          const data = (await res.json()) as { tasks?: Task[]; error?: string };
          if (res.status === 401) {
            if (!cancelled) setUser(null);
            return;
          }
          if (!res.ok) throw new Error(data.error || "Failed to load tasks");
          if (!cancelled) setTasks(data.tasks || []);
        } catch (e) {
          if (!cancelled) setTaskError(e instanceof Error ? e.message : "Failed to load tasks");
        } finally {
          if (!cancelled) setLoadingTasks(false);
        }
      })();
    }, debounceMs());

    return () => {
      cancelled = true;
      if (pendingTaskFetch.current) window.clearTimeout(pendingTaskFetch.current);
    };
  }, [gridStart, gridEnd, query, user]);

  async function createTask(date: string, title: string) {
    if (!user) throw new Error("Unauthorized");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, title }),
    });
    const data = (await res.json()) as { task?: Task; error?: string };
    if (res.status === 401) {
      setUser(null);
      throw new Error("Unauthorized");
    }
    const task = data.task;
    if (!res.ok || !task) throw new Error(data.error || "Failed to create task");
    setTasks((prev) => prev.concat(task));
  }

  async function patchTask(id: string, patch: Partial<Pick<Task, "title" | "description" | "date" | "order">>) {
    if (!user) throw new Error("Unauthorized");
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { task?: Task; error?: string };
    if (res.status === 401) {
      setUser(null);
      throw new Error("Unauthorized");
    }
    if (!res.ok || !data.task) throw new Error(data.error || "Failed to update task");
    setTasks((prev) => prev.map((t) => (t.id === id ? data.task! : t)));
  }

  async function deleteTask(id: string) {
    if (!user) throw new Error("Unauthorized");
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status === 401) {
      setUser(null);
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Failed to delete task");
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function persistReorder(updates: Array<{ id: string; date: string; order: number }>) {
    if (!user) throw new Error("Unauthorized");
    const res = await fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    if (res.status === 401) {
      setUser(null);
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Failed to reorder tasks");
    }
  }

  function moveMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!dndEnabled || !user) return;

    const active = event.active?.id;
    const over = event.over?.id;
    if (!active || !over) return;

    const activeTask = tasksById.get(String(active));
    if (!activeTask) return;

    const overId = String(over);
    const sourceDate = activeTask.date;
    const targetDate = isDateKey(overId) ? overId : tasksById.get(overId)?.date;
    if (!targetDate) return;

    const sourceList = (tasksByDate.get(sourceDate) || []).slice();
    const targetList = sourceDate === targetDate ? sourceList : (tasksByDate.get(targetDate) || []).slice();

    const activeIndex = sourceList.findIndex((t) => t.id === activeTask.id);
    if (activeIndex === -1) return;

    const overIndexInTarget = isDateKey(overId)
      ? targetList.length
      : targetList.findIndex((t) => t.id === overId);
    const insertIndex = overIndexInTarget === -1 ? targetList.length : overIndexInTarget;

    let nextSource = sourceList;
    let nextTarget = targetList;

    if (sourceDate === targetDate) {
      const overTaskIndex = isDateKey(overId) ? nextSource.length - 1 : nextSource.findIndex((t) => t.id === overId);
      if (overTaskIndex === -1) return;
      if (activeIndex === overTaskIndex) return;
      nextSource = arrayMove(nextSource, activeIndex, overTaskIndex);
      nextTarget = nextSource;
    } else {
      const [moved] = nextSource.splice(activeIndex, 1);
      nextTarget.splice(insertIndex, 0, { ...moved, date: targetDate });
    }

    const updates: Array<{ id: string; date: string; order: number }> = [];
    const touchedIds = new Set<string>();

    function applyList(date: string, list: Task[]) {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        touchedIds.add(t.id);
        updates.push({ id: t.id, date, order: i });
      }
    }

    applyList(sourceDate, nextSource);
    if (targetDate !== sourceDate) applyList(targetDate, nextTarget);

    setTasks((prev) =>
      prev.map((t) => {
        if (!touchedIds.has(t.id)) return t;
        const u = updates.find((x) => x.id === t.id);
        return u ? { ...t, date: u.date, order: u.order } : t;
      }),
    );

    persistReorder(updates).catch((e) => {
      // keep UI responsive; next fetch will reconcile
      console.error(e);
    });
  }

  return (
    <App>
      <AppHeader>
        <Brand>Editorial Calendar</Brand>
        <HeaderRight>
          <HeaderBtn
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </HeaderBtn>
          {user ? (
            <HeaderAccountHover>
              <HeaderUser title={user.email}>{user.email}</HeaderUser>
              <HeaderLogoutBtn
                onClick={() => {
                  fetch("/api/auth/logout", { method: "POST" })
                    .catch(() => undefined)
                    .finally(() => setUser(null));
                }}
              >
                Log out
              </HeaderLogoutBtn>
            </HeaderAccountHover>
          ) : (
            <HeaderHint>Sign in to add cards</HeaderHint>
          )}
        </HeaderRight>
      </AppHeader>

      <Wrap>
        <TopBar>
          <Controls>
            <LeftControls>
              <MonthNav aria-label="Month navigation">
                <NavBtn onClick={() => moveMonth(-1)} aria-label="Previous month">
                  {"<"}
                </NavBtn>
                <MonthLabel>{monthLabel(month)}</MonthLabel>
                <NavBtn onClick={() => moveMonth(1)} aria-label="Next month">
                  {">"}
                </NavBtn>
              </MonthNav>
            </LeftControls>

            <CenterControls>
              <Search
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter tasks by text..."
                aria-label="Search tasks"
              />
            </CenterControls>

            <RightControls>
              <ControlGroup>
                <Label>Holidays</Label>
                <Select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  aria-label="Country code"
                >
                  {countries.length > 0 ? (
                    countries.map((c) => (
                      <option key={c.countryCode} value={c.countryCode}>
                        {c.name} ({c.countryCode})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="US">United States (US)</option>
                      <option value="UA">Ukraine (UA)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="DE">Germany (DE)</option>
                    </>
                  )}
                </Select>
              </ControlGroup>
            </RightControls>
          </Controls>
        </TopBar>

        {!user ? (
          <AuthCard>
            <AuthHeader>
              <AuthTitle>{authMode === "login" ? "Log in" : "Create account"}</AuthTitle>
              <AuthSub>
                {authMode === "login" ? (
                  <>
                    No account?{" "}
                    <AuthLinkBtn onClick={() => setAuthMode("register")}>Register</AuthLinkBtn>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <AuthLinkBtn onClick={() => setAuthMode("login")}>Log in</AuthLinkBtn>
                  </>
                )}
              </AuthSub>
            </AuthHeader>

            <AuthForm
              onSubmit={(e) => {
                e.preventDefault();
                setAuthBusy(true);
                setAuthError(null);
                setAuthFieldErrors({});
                (async () => {
                  const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
                  const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ email: authEmail, password: authPassword }),
                  });
                  const data = (await res.json().catch(() => ({}))) as {
                    user?: { id: string; email: string };
                    error?: string;
                    details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
                  };
                  if (!res.ok || !data.user) {
                    const fieldErrors = data.details?.fieldErrors || {};
                    setAuthFieldErrors({
                      email: fieldErrors.email?.[0],
                      password: fieldErrors.password?.[0],
                    });
                    const generic = (data.error || "").trim();
                    const genericIsUseless = generic.toLowerCase() === "invalid body";
                    const message =
                      data.details?.formErrors?.[0] ||
                      fieldErrors.email?.[0] ||
                      fieldErrors.password?.[0] ||
                      (genericIsUseless ? "" : generic) ||
                      "Auth failed";
                    throw new Error(message);
                  }
                  setUser(data.user);
                  setAuthPassword("");
                })()
                  .catch((err) => setAuthError(err instanceof Error ? err.message : "Auth failed"))
                  .finally(() => setAuthBusy(false));
              }}
            >
              <AuthInput
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                inputMode="email"
                disabled={authBusy}
              />
              {authFieldErrors.email ? <AuthFieldError>{authFieldErrors.email}</AuthFieldError> : null}
              <AuthInput
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                type="password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                disabled={authBusy}
              />
              {authFieldErrors.password ? <AuthFieldError>{authFieldErrors.password}</AuthFieldError> : null}
              {authError ? <AuthError>{authError}</AuthError> : null}
              <AuthBtn type="submit" disabled={authBusy || !authEmail.trim() || authPassword.length < 1}>
                {authBusy ? "..." : authMode === "login" ? "Log in" : "Register"}
              </AuthBtn>
            </AuthForm>
          </AuthCard>
        ) : null}

      <StatusRow>
        <Status>
          {!user
            ? "Log in to create and organize tasks."
            : !dndEnabled
              ? "Drag-and-drop disabled while search is active."
              : "Drag tasks between days or reorder inside a day."}
        </Status>
        <StatusRight>
          {loadingTasks ? "Loading tasks..." : taskError ? `Tasks error: ${taskError}` : null}
          {holidayError ? `Holidays error: ${holidayError}` : null}
        </StatusRight>
      </StatusRow>

      <WeekHeader>
        {WEEKDAY_LABELS.map((d) => (
          <Weekday key={d}>{d}</Weekday>
        ))}
      </WeekHeader>

      {dndEnabled && !!user ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
        >
          <Grid>
            {days.map((d) => {
              const key = toDateKey(d);
              const inMonth = d.getMonth() === month.getMonth();
              const holiday = holidaysByDate[key];
              const list = tasksByDate.get(key) || [];
              return (
                <DayCell
                  key={key}
                  dateKey={key}
                  date={d}
                  inMonth={inMonth}
                  holiday={holiday}
                  tasks={list}
                  dndEnabled={dndEnabled}
                  editable={!!user}
                  onCreate={createTask}
                  onPatch={patchTask}
                  onDelete={deleteTask}
                />
              );
            })}
          </Grid>
          <DragOverlay>
            {activeId && tasksById.get(activeId) ? <Ghost>{tasksById.get(activeId)!.title}</Ghost> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Grid>
          {days.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const holiday = holidaysByDate[key];
            const list = tasksByDate.get(key) || [];
            return (
              <DayCell
                key={key}
                dateKey={key}
                date={d}
                inMonth={inMonth}
                holiday={holiday}
                tasks={list}
                dndEnabled={false}
                editable={!!user}
                onCreate={createTask}
                onPatch={patchTask}
                onDelete={deleteTask}
              />
            );
          })}
        </Grid>
      )}
      </Wrap>
    </App>
  );
}

const App = styled.main`
  min-height: 100vh;
  --header-h: 54px;
`;

const AppHeader = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  color: #fff;
  background: linear-gradient(135deg, #f59f00, #f76707);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.14);
`;

const Brand = styled.div`
  font-weight: 700;
  letter-spacing: 0.2px;
`;

const HeaderRight = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const HeaderBtn = styled.button`
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  cursor: pointer;

  &:hover {
    background: rgba(0, 0, 0, 0.2);
  }
`;

const HeaderUser = styled.div`
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
`;

const HeaderAccountHover = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const HeaderLogoutBtn = styled.button`
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-2px);
  transition: opacity 120ms ease, transform 120ms ease, background 120ms ease;

  ${HeaderAccountHover}:hover & {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  @media (hover: none) {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.2);
  }
`;

const HeaderHint = styled.div`
  font-size: 12px;
  opacity: 0.9;
`;

const Wrap = styled.main`
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0 18px 34px;
`;

const AuthCard = styled.section`
  max-width: 520px;
  margin: 14px auto 14px;
  border-radius: 14px;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  padding: 18px;
`;

const AuthHeader = styled.div`
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
`;

const AuthTitle = styled.h2`
  margin: 0;
  font-size: 18px;
`;

const AuthSub = styled.div`
  font-size: 12px;
  color: var(--muted);
`;

const AuthLinkBtn = styled.button`
  background: transparent;
  border: none;
  padding: 0;
  color: #d9480f;
  cursor: pointer;
`;

const AuthForm = styled.form`
  display: grid;
  gap: 10px;
`;

const AuthInput = styled.input`
  height: 40px;
  border-radius: 12px;
  padding: 0 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  outline: none;

  &:focus {
    border-color: rgba(240, 140, 0, 0.55);
    box-shadow: 0 0 0 3px rgba(240, 140, 0, 0.18);
  }
`;

const AuthError = styled.div`
  color: var(--danger);
  font-size: 12px;
`;

const AuthFieldError = styled.div`
  color: rgba(240, 140, 0, 0.95);
  font-size: 12px;
`;

const AuthBtn = styled.button`
  height: 40px;
  border-radius: 12px;
  background: #f08c00;
  border: 1px solid rgba(0, 0, 0, 0.12);
  color: white;
  cursor: pointer;

  &:hover:enabled {
    background: #e67700;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TopBar = styled.div`
  position: sticky;
  top: var(--header-h);
  z-index: 5;
  display: flex;
  align-items: center;
  padding: 10px 18px 12px;
  margin: 0 -18px 8px;
  margin-bottom: 8px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
`;

const Controls = styled.div`
  display: grid;
  grid-template-columns: auto minmax(240px, 1fr) auto;
  gap: 12px;
  width: 100%;
  align-items: center;

  @media (max-width: 920px) {
    grid-template-columns: 1fr;
  }
`;

const LeftControls = styled.div`
  display: flex;
  align-items: center;
`;

const CenterControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const RightControls = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

const ControlGroup = styled.div`
  display: grid;
  gap: 6px;
`;

const Label = styled.div`
  font-size: 12px;
  color: var(--faint);
`;

const Btn = styled.button`
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);

  &:hover {
    background: var(--panel-2);
  }
`;

const MonthLabel = styled.div`
  min-width: 170px;
  text-align: center;
  height: 36px;
  display: grid;
  place-items: center;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--panel);
  border: 1px solid var(--border);
  font-weight: 600;
`;

const NavBtn = styled(Btn)`
  width: 36px;
  height: 36px;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 20px;
  line-height: 1;
`;

const MonthNav = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Select = styled.select`
  height: 36px;
  border-radius: 8px;
  padding: 0 10px;
  background: var(--panel);
  border: 1px solid var(--border);
`;

const Search = styled.input`
  height: 44px;
  width: 100%;
  max-width: 920px;
  border-radius: 10px;
  padding: 0 14px;
  background: var(--panel);
  border: 1px solid var(--border);
  outline: none;
  font-size: 15px;

  &:focus {
    border-color: rgba(240, 140, 0, 0.55);
    box-shadow: 0 0 0 3px rgba(240, 140, 0, 0.18);
  }
`;

const StatusRow = styled.div`
  display: flex;
  gap: 10px;
  justify-content: space-between;
  flex-wrap: wrap;
  margin: 10px 0 14px;
`;

const Status = styled.div`
  color: var(--muted);
  font-size: 12px;
`;

const StatusRight = styled.div`
  color: rgba(224, 49, 49, 0.9);
  font-size: 12px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const WeekHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0;
  border: 1px solid var(--border);
  border-bottom: none;
  width: 100%;
`;

const Weekday = styled.div`
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--faint);
  padding: 10px 12px;
  background: var(--panel-2);
  border-right: 1px solid var(--border);

  &:last-child {
    border-right: none;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0;
  border: 1px solid var(--border);
  border-top: none;
  width: 100%;
`;

const Ghost = styled.div`
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
