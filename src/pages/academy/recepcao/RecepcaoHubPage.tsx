import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { useAdaptivePolling } from "../../../hooks/useAdaptivePolling";
import { useReceptionStream } from "../../../hooks/useReceptionStream";
import {
  fetchReceptionDashboard,
  fetchReceptionPanel,
  fetchReceptionStudentContext,
  postReceptionStudentNotesAudit,
  registerReceptionCheckin,
  registerReceptionDenied,
  registerReceptionException,
  registerReceptionVisitor,
  searchReceptionStudents,
  type ReceptionAccessEvent,
  type ReceptionDashboard,
  type ReceptionDashboardStudent,
  type ReceptionPanelApiKey,
  type ReceptionStudent,
  type ReceptionStudentContext,
} from "../../../services/academyApi";
import { ExceptionReasonDialog } from "./ExceptionReasonDialog";
import { LotacaoChart } from "./LotacaoChart";
import { MyExceptionsCard } from "./MyExceptionsCard";
import { initials, statusBadge, statusLabel, timeLabel } from "./recepcaoUtils";
import "./recepcao.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const PANEL_PAGE_SIZE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelKey =
  | "occupancyNow"
  | "accessToday"
  | "overdueStudents"
  | "birthdaysToday"
  | "exceptionsToday"
  | "deniedToday"
  | "newStudents7d"
  | "observability";

interface PanelRow {
  id: string | number;
  title: string;
  subtitle: string;
  badge?: string;
  badgeClass?: string;
  userId?: number | null;
}

interface DetailPanel {
  title: string;
  description: string;
  total: number;
  rows: PanelRow[];
  emptyTitle: string;
}

interface AlertItem {
  label: string;
  sub: string;
  tone: "warn" | "danger" | "info";
  icon: string;
  panelKey: PanelKey;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function eventTitle(event: ReceptionAccessEvent) {
  if (event.visitor.name) return event.visitor.name;
  return event.student.name ?? event.student.email ?? "Registro operacional";
}

function eventLabel(event: ReceptionAccessEvent) {
  if (event.eventType === "checkin") return "Entrada";
  if (event.eventType === "exception") return "Exceção";
  if (event.eventType === "denied") return "Bloqueio";
  return event.visitor.type === "external_personal" ? "Personal" : "Visitante";
}

function eventBadge(event: ReceptionAccessEvent) {
  if (event.eventType === "checkin") return "badge badge-success";
  if (event.eventType === "exception") return "badge badge-warn";
  if (event.eventType === "denied") return "badge badge-danger";
  return "badge badge-info";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function eventRow(event: ReceptionAccessEvent): PanelRow {
  return {
    id: `event-${event.id}`,
    title: eventTitle(event),
    subtitle: [event.reason, timeLabel(event.createdAt), event.actorName ?? "sistema"]
      .filter(Boolean)
      .join(" · "),
    badge: eventLabel(event),
    badgeClass: eventBadge(event),
    userId: event.student.userId,
  };
}

function studentRow(student: ReceptionDashboardStudent, context: "pending" | "new" | "birthday"): PanelRow {
  const plan = student.activePlan?.name ?? "Sem plano";
  const contextLabel = {
    pending: `Último acesso: ${timeLabel(student.lastAccessAt)}`,
    new: `Entrada: ${formatDate(student.joinedAt)}`,
    birthday: `Nasc: ${formatDate(student.birthDate)}`,
  }[context];
  return {
    id: `student-${student.userId}`,
    title: student.name || student.email,
    subtitle: `${student.email} · ${student.phone ?? "s/ tel"} · ${plan} · ${contextLabel}`,
    badge: statusLabel(student.studentStatus),
    badgeClass: statusBadge(student.studentStatus),
    userId: student.userId,
  };
}

function panelStudentContext(k: PanelKey): "pending" | "new" | "birthday" {
  if (k === "overdueStudents") return "pending";
  if (k === "newStudents7d") return "new";
  return "birthday";
}

function buildPanel(key: PanelKey, data: ReceptionDashboard): DetailPanel {
  const r = data.related;
  if (key === "occupancyNow")
    return {
      title: "Lotação agora",
      description: "Entradas nos últimos 90 minutos.",
      total: data.kpis.occupancyNow,
      rows: (r?.occupancyNow ?? data.recentEvents).map(eventRow),
      emptyTitle: "Nenhuma entrada recente.",
    };
  if (key === "accessToday")
    return {
      title: "Acessos hoje",
      description: "Registros do dia.",
      total: data.kpis.accessToday,
      rows: (r?.accessToday ?? data.recentEvents).map(eventRow),
      emptyTitle: "Nenhum acesso hoje.",
    };
  if (key === "overdueStudents")
    return {
      title: "Pendências",
      description: "Alunos com situação financeira ou operacional pendente.",
      total: data.kpis.overdueStudents,
      rows: (r?.overdueStudents ?? []).map((s) => studentRow(s, "pending")),
      emptyTitle: "Nenhuma pendência.",
    };
  if (key === "birthdaysToday")
    return {
      title: "Aniversariantes",
      description: "Alunos que fazem aniversário hoje.",
      total: data.kpis.birthdaysToday,
      rows: (r?.birthdaysToday ?? []).map((s) => studentRow(s, "birthday")),
      emptyTitle: "Nenhum aniversariante hoje.",
    };
  if (key === "exceptionsToday")
    return {
      title: "Exceções hoje",
      description: "Entradas com justificativa auditada.",
      total: data.kpis.exceptionsToday,
      rows: (r?.exceptionsToday ?? data.exceptions).map(eventRow),
      emptyTitle: "Nenhuma exceção hoje.",
    };
  if (key === "deniedToday")
    return {
      title: "Bloqueios hoje",
      description: "Entradas negadas com auditoria.",
      total: data.kpis.deniedToday,
      rows: (r?.deniedToday ?? data.exceptions.filter((e) => e.eventType === "denied")).map(eventRow),
      emptyTitle: "Nenhum bloqueio hoje.",
    };
  if (key === "newStudents7d")
    return {
      title: "Novos alunos 7d",
      description: "Alunos cadastrados na última semana.",
      total: data.kpis.newStudents7d,
      rows: (r?.newStudents7d ?? []).map((s) => studentRow(s, "new")),
      emptyTitle: "Nenhum novo aluno nos últimos 7 dias.",
    };
  return {
    title: "Catraca — Observability",
    description: "Estado atual das integrações de acesso.",
    total: 3,
    rows: [
      {
        id: "catraca",
        title: "Catraca",
        subtitle:
          data.status.catraca === "manual_only" ? "Operação manual — sem controle remoto" : data.status.catraca,
        badge: "Manual",
        badgeClass: "badge badge-info",
      },
      {
        id: "facial",
        title: "Facial",
        subtitle: data.status.facial === "planned" ? "Integração planejada (V2)" : data.status.facial,
        badge: "Planejado",
        badgeClass: "badge",
      },
      {
        id: "partners",
        title: "Wellhub / TotalPass",
        subtitle: data.status.partners === "planned" ? "Integração planejada (V2)" : data.status.partners,
        badge: "Planejado",
        badgeClass: "badge",
      },
    ],
    emptyTitle: "Sem status disponível.",
  };
}

function buildAlerts(data: ReceptionDashboard): AlertItem[] {
  const items: AlertItem[] = [];
  if (data.kpis.overdueStudents > 0)
    items.push({
      label: `${data.kpis.overdueStudents} aluno${data.kpis.overdueStudents > 1 ? "s" : ""} com pendência`,
      sub: "Verificar antes de liberar acesso",
      tone: "warn",
      icon: "!",
      panelKey: "overdueStudents",
    });
  if (data.kpis.deniedToday > 0)
    items.push({
      label: `${data.kpis.deniedToday} bloqueio${data.kpis.deniedToday > 1 ? "s" : ""} hoje`,
      sub: "Entradas negadas com auditoria",
      tone: "danger",
      icon: "✕",
      panelKey: "deniedToday",
    });
  if (data.status.catraca === "manual_only")
    items.push({
      label: "Catraca em modo manual",
      sub: "Operação V1 — sem controle remoto",
      tone: "info",
      icon: "i",
      panelKey: "observability",
    });
  return items;
}

function relativeStaffPt(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

function blockedBannerCopy(sel: ReceptionStudent): string {
  const bits: string[] = [];
  if (sel.daysOverdue != null && sel.daysOverdue > 0) {
    bits.push(`${sel.daysOverdue} dia${sel.daysOverdue > 1 ? "s" : ""} em atraso`);
  }
  if (sel.lastStaffNote?.preview) {
    bits.push(
      `Recado de ${sel.lastStaffNote.from} (${relativeStaffPt(sel.lastStaffNote.sentAt)}): ${sel.lastStaffNote.preview}`
    );
  }
  if (bits.length === 0) {
    return "Atenção: status exige revisão antes do acesso. Liberar apenas com exceção auditada.";
  }
  return `${bits.join(" · ")}. Liberar apenas com exceção auditada.`;
}

function endOfTodayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysSinceWorkout(iso: string | null): string | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "há 1d";
  return `há ${d}d`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecepcaoHubPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const actorUserId = auth.user?.id ?? (auth.id ? Number(auth.id) : null);

  // Dashboard
  const [dashboard, setDashboard] = useState<ReceptionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ReceptionStudent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Selected student + checkin
  const [selected, setSelected] = useState<ReceptionStudent | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinErr, setCheckinErr] = useState("");
  const [dialogMode, setDialogMode] = useState<"exception" | "deny" | null>(null);

  const [studentCtx, setStudentCtx] = useState<ReceptionStudentContext | null>(null);
  const [studentCtxLoading, setStudentCtxLoading] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Visitor form
  const [showVisitor, setShowVisitor] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorDoc, setVisitorDoc] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorReferredBy, setVisitorReferredBy] = useState("");
  const [visitorValidUntil, setVisitorValidUntil] = useState(endOfTodayDateInput());
  const [visitorType, setVisitorType] = useState<"visitor" | "external_personal" | "prospect" | "trial_class">(
    "visitor"
  );

  // KPI panels
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [panelPage, setPanelPage] = useState(1);
  const [panelFilterInput, setPanelFilterInput] = useState("");
  const [debouncedPanelFilter, setDebouncedPanelFilter] = useState("");
  const [panelRemoteRows, setPanelRemoteRows] = useState<PanelRow[]>([]);
  const [panelRemoteTotal, setPanelRemoteTotal] = useState(0);
  const [panelRemoteLoading, setPanelRemoteLoading] = useState(false);
  const [panelRemoteErr, setPanelRemoteErr] = useState("");

  // Toast
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "info" } | null>(null);

  // Clock
  const [now, setNow] = useState(new Date());

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<number>(0);

  const loadDashboard = useCallback(() => {
    fetchReceptionDashboard()
      .then((data) => {
        setDashboard(data);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const { bumpInteraction } = useAdaptivePolling(loadDashboard);
  useReceptionStream(loadDashboard, true);

  const selectStudent = useCallback((s: ReceptionStudent) => {
    bumpInteraction();
    setSelected(s);
    setQuery("");
    setSearchResults([]);
    setShowResults(false);
    setCheckinErr("");
  }, [bumpInteraction]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedPanelFilter(panelFilterInput.trim()), 350);
    return () => clearTimeout(t);
  }, [panelFilterInput]);

  useEffect(() => {
    setPanelPage(1);
  }, [debouncedPanelFilter, activePanel]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!selected) {
      setStudentCtx(null);
      setNotesOpen(false);
      return;
    }
    let cancelled = false;
    setStudentCtxLoading(true);
    fetchReceptionStudentContext(selected.userId)
      .then((ctx) => {
        if (!cancelled) setStudentCtx(ctx);
      })
      .catch(() => {
        if (!cancelled) setStudentCtx(null);
      })
      .finally(() => {
        if (!cancelled) setStudentCtxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    if (!notesOpen || !selected) return;
    void postReceptionStudentNotesAudit(selected.userId).catch((err: unknown) => {
      console.warn('[recepcao] audit notes_viewed failed', err);
    });
  }, [notesOpen, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(t?.isContentEditable);

      if (e.key === "/") {
        const ae = document.activeElement;
        const isBare = ae === document.body || ae === document.documentElement;
        if (isBare) {
          e.preventDefault();
          inputRef.current?.focus();
          bumpInteraction();
        }
      }

      if (e.key === "Escape") {
        if (selected) {
          setSelected(null);
          setCheckinErr("");
        } else {
          setQuery("");
          setSearchResults([]);
        }
        inputRef.current?.focus();
        bumpInteraction();
      }

      if (e.key === "Enter" && showResults && searchResults.length > 0) {
        const ae = document.activeElement;
        if (ae === inputRef.current || (!inField && ae === document.body)) {
          e.preventDefault();
          selectStudent(searchResults[0]);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bumpInteraction, searchResults, selectStudent, selected, showResults]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = window.setTimeout(() => {
      searchReceptionStudents(trimmed)
        .then((rows) => {
          setSearchResults(rows);
          setShowResults(true);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 180);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  useEffect(() => {
    if (!activePanel || !dashboard) return;
    if (activePanel === "observability") {
      setPanelRemoteRows([]);
      setPanelRemoteTotal(0);
      setPanelRemoteLoading(false);
      setPanelRemoteErr("");
      return;
    }
    let cancelled = false;
    setPanelRemoteRows([]);
    setPanelRemoteTotal(0);
    setPanelRemoteLoading(true);
    setPanelRemoteErr("");
    fetchReceptionPanel(activePanel as ReceptionPanelApiKey, panelPage, PANEL_PAGE_SIZE, debouncedPanelFilter || undefined)
      .then((data) => {
        if (cancelled) return;
        const ctx = panelStudentContext(activePanel);
        const rows =
          data.events.length > 0 ? data.events.map(eventRow) : data.students.map((s) => studentRow(s, ctx));
        setPanelRemoteRows(rows);
        setPanelRemoteTotal(data.total);
      })
      .catch((err: Error) => {
        if (!cancelled) setPanelRemoteErr(err.message);
      })
      .finally(() => {
        if (!cancelled) setPanelRemoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePanel, dashboard, debouncedPanelFilter, panelPage]);

  function showToast(message: string, tone: "ok" | "info") {
    setToast({ message, tone });
  }

  // ── Actions ──────────────────────────────────────────────────────
  function clearSelected() {
    setSelected(null);
    setCheckinErr("");
    setTimeout(() => inputRef.current?.focus(), 50);
    bumpInteraction();
  }

  async function runCheckin(
    action: () => Promise<{ duplicate?: boolean; event?: { createdAt: string } }>,
    successMsg: string,
    duplicateMsgBuilder?: (createdAt: string) => string
  ) {
    setCheckinLoading(true);
    setCheckinErr("");
    try {
      const result = await action();
      if (result?.duplicate && result.event?.createdAt) {
        const sec = Math.max(
          0,
          Math.round((Date.now() - new Date(result.event.createdAt).getTime()) / 1000)
        );
        const msg =
          duplicateMsgBuilder?.(result.event.createdAt) ??
          `Já registrado há ${sec}s (mesmo tipo de evento).`;
        showToast(msg, "info");
        loadDashboard();
        bumpInteraction();
      } else if (result?.duplicate) {
        showToast("Registro duplicado em menos de 60s.", "info");
        loadDashboard();
        bumpInteraction();
      } else {
        showToast(successMsg, "ok");
        setSelected(null);
        loadDashboard();
        bumpInteraction();
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch (err: unknown) {
      setCheckinErr((err as Error).message ?? "Erro desconhecido.");
    } finally {
      setCheckinLoading(false);
    }
  }

  function resetVisitor() {
    setVisitorName("");
    setVisitorDoc("");
    setVisitorPhone("");
    setVisitorReferredBy("");
    setVisitorValidUntil(endOfTodayDateInput());
    setVisitorType("visitor");
    setShowVisitor(false);
  }

  function openPanel(key: PanelKey) {
    bumpInteraction();
    setActivePanel(key);
    setPanelPage(1);
    setPanelFilterInput("");
    setDebouncedPanelFilter("");
  }

  const kpis = dashboard?.kpis;
  const alerts = dashboard ? buildAlerts(dashboard) : [];
  const isBlocked = selected
    ? ["overdue", "paused", "cancelled"].includes(selected.studentStatus ?? "")
    : false;

  const observPanel = useMemo(() => {
    if (!dashboard || activePanel !== "observability") return null;
    return buildPanel("observability", dashboard);
  }, [activePanel, dashboard]);

  const filteredObservRows = useMemo(() => {
    if (!observPanel) return [];
    const q = panelFilterInput.trim().toLowerCase();
    if (!q) return observPanel.rows;
    return observPanel.rows.filter(
      (r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
    );
  }, [observPanel, panelFilterInput]);

  const panelBase = dashboard && activePanel ? buildPanel(activePanel, dashboard) : null;

  const displayPanel: DetailPanel | null = useMemo(() => {
    if (!activePanel || !panelBase) return null;
    if (activePanel === "observability") {
      return {
        ...panelBase,
        total: filteredObservRows.length,
        rows: filteredObservRows,
      };
    }
    return {
      ...panelBase,
      total: panelRemoteTotal,
      rows: panelRemoteRows,
    };
  }, [activePanel, filteredObservRows, panelBase, panelRemoteRows, panelRemoteTotal]);

  const totalForPaging =
    activePanel === "observability" ? filteredObservRows.length : panelRemoteTotal;
  const totalPages = displayPanel ? Math.max(1, Math.ceil(totalForPaging / PANEL_PAGE_SIZE)) : 1;

  const pagedRows =
    displayPanel && activePanel === "observability"
      ? filteredObservRows.slice((panelPage - 1) * PANEL_PAGE_SIZE, panelPage * PANEL_PAGE_SIZE)
      : displayPanel?.rows ?? [];

  const clockLabel = now.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lastWorkoutLabel = daysSinceWorkout(studentCtx?.lastWorkoutAt ?? null);

  return (
    <div className="rec-hub">
      <header className="rec-header">
        <div className="rec-header-left">
          <div className="rec-eyebrow">Recepção</div>
          <h1 className="rec-title">Operação da entrada</h1>
          <div className="rec-time">{clockLabel}</div>
        </div>
        <div className="rec-header-actions">
          <button className="btn btn-sm btn-ghost" onClick={() => navigate("/app/academy/recepcao/checkin")}>
            Check-in completo
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate("/app/academy/recepcao/display")}>
            Modo display
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate("/app/academy/recepcao/novo-aluno")}>
            Novo aluno
          </button>
        </div>
      </header>

      {error && <div className="banner-error">{error}</div>}

      {toast && (
        <div className={`rec-toast ${toast.tone === "info" ? "rec-toast--info" : "rec-toast--ok"}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="rec-search-wrap">
        <div className="rec-search-field">
          <svg
            className="rec-search-icon"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            autoFocus
            className="rec-search-input"
            placeholder="Buscar aluno por nome, e-mail ou telefone..."
            value={query}
            onChange={(e) => {
              bumpInteraction();
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => query.trim().length >= 2 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Buscar aluno"
          />
        </div>
        <div className="rec-search-hint">
          Mínimo 2 chars · Enter seleciona primeiro · / foca busca · Esc limpa · atualização adaptativa (5s / 15s / 60s)
        </div>

        {showResults && (searchLoading || searchResults.length > 0 || query.trim().length >= 2) && (
          <div className="rec-results" role="listbox">
            {searchLoading ? (
              <div className="rec-results-status">Buscando...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map((s) => (
                <button
                  key={s.userId}
                  role="option"
                  aria-selected="false"
                  className="rec-result-item"
                  onMouseDown={() => selectStudent(s)}
                >
                  {s.avatarUrl ? (
                    <img src={s.avatarUrl} alt={s.name} className="rec-result-avatar" />
                  ) : (
                    <div className="rec-result-initials">{initials(s.name || s.email)}</div>
                  )}
                  <div className="rec-result-info">
                    <div className="rec-result-name">{s.name || s.email}</div>
                    <div className="rec-result-sub">
                      {s.email} · {s.activePlan?.name ?? "Sem plano"} · {timeLabel(s.lastAccessAt)}
                    </div>
                  </div>
                  <span className={statusBadge(s.studentStatus)}>{statusLabel(s.studentStatus)}</span>
                </button>
              ))
            ) : (
              <div className="rec-results-status">Nenhum aluno encontrado neste tenant.</div>
            )}
          </div>
        )}
      </div>

      {checkinErr && <div className="rec-feedback rec-feedback--err">{checkinErr}</div>}

      {selected && (
        <div className="rec-checkin-card">
          {studentCtx?.welcomeContext && <p className="rec-welcome-context">{studentCtx.welcomeContext}</p>}
          <div className="rec-checkin-header">
            <div className="rec-checkin-student">
              {selected.avatarUrl ? (
                <img src={selected.avatarUrl} alt={selected.name} className="rec-checkin-avatar" />
              ) : (
                <div className="rec-checkin-initials">{initials(selected.name || selected.email)}</div>
              )}
              <div>
                <h2 className="rec-checkin-name">{selected.name || selected.email}</h2>
                <div className="rec-checkin-sub">{selected.email} · {selected.phone ?? "sem telefone"}</div>
              </div>
            </div>
            <div className="rec-checkin-badge-row">
              <span className={statusBadge(selected.studentStatus)}>{statusLabel(selected.studentStatus)}</span>
              <button className="btn btn-sm btn-ghost" onClick={clearSelected}>
                Trocar
              </button>
            </div>
          </div>

          <div className="rec-checkin-meta">
            <div className="rec-checkin-meta-item">
              <div className="rec-checkin-meta-label">Plano</div>
              <div className="rec-checkin-meta-value">{selected.activePlan?.name ?? "Sem plano"}</div>
            </div>
            <div className="rec-checkin-meta-item">
              <div className="rec-checkin-meta-label">Último acesso</div>
              <div className="rec-checkin-meta-value">{timeLabel(selected.lastAccessAt)}</div>
            </div>
            {selected.activePlan && (
              <div className="rec-checkin-meta-item">
                <div className="rec-checkin-meta-label">Mensalidade</div>
                <div className="rec-checkin-meta-value">R$ {Number(selected.activePlan.monthlyPrice).toFixed(2)}</div>
              </div>
            )}
          </div>

          {studentCtxLoading && <div className="small muted">Carregando contexto MetaCore…</div>}
          {studentCtx && !studentCtxLoading && (
            <div className="rec-metacore-band">
              <span className="rec-metacore-metric">Aderência {studentCtx.adherence7dPct}%</span>
              <span className="rec-metacore-dot">·</span>
              <span className="rec-metacore-metric">Streak {studentCtx.streakDays}d</span>
              <span className="rec-metacore-dot">·</span>
              <span className="rec-metacore-metric">
                Último treino {lastWorkoutLabel ?? "—"}
              </span>
              {studentCtx.productMaaSActive && (
                <>
                  <span className="rec-metacore-dot">·</span>
                  <span className="badge badge-success" style={{ fontSize: 10 }}>
                    MaaS ativo
                  </span>
                </>
              )}
              <span className="rec-metacore-dot">·</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setNotesOpen(true)}>
                Recados ({studentCtx.unreadStaffMessageCount})
              </button>
            </div>
          )}

          <div
            className={`rec-checkin-banner ${isBlocked ? "rec-checkin-banner--blocked" : "rec-checkin-banner--ok"}`}
            title={isBlocked && selected.lastStaffNote ? selected.lastStaffNote.preview : undefined}
          >
            {isBlocked ? blockedBannerCopy(selected) : "Acesso operacional liberado — clique em Liberar entrada para registrar."}
          </div>

          <div className="rec-checkin-actions">
            <button
              className="btn btn-primary"
              onClick={() =>
                runCheckin(() => registerReceptionCheckin(selected.userId), "Entrada liberada e registrada.")
              }
              disabled={checkinLoading || isBlocked}
            >
              {checkinLoading ? "Aguarde..." : "Liberar entrada"}
            </button>
            <button className="btn btn-secondary" onClick={() => setDialogMode("exception")} disabled={checkinLoading}>
              Exceção
            </button>
            <button className="btn btn-ghost" onClick={() => setDialogMode("deny")} disabled={checkinLoading}>
              Bloquear
            </button>
          </div>
        </div>
      )}

      {dialogMode === "exception" && selected && (
        <ExceptionReasonDialog
          title="Liberar com exceção"
          description="Pendência, status em revisão ou autorização pontual do gestor."
          confirmLabel="Liberar com exceção"
          onCancel={() => setDialogMode(null)}
          onConfirm={(reason) => {
            setDialogMode(null);
            void runCheckin(
              () => registerReceptionException(selected.userId, reason),
              "Exceção registrada e entrada liberada."
            );
          }}
        />
      )}

      {dialogMode === "deny" && selected && (
        <ExceptionReasonDialog
          title="Registrar bloqueio"
          description="Registra que a entrada foi negada e salva o motivo na auditoria."
          confirmLabel="Registrar bloqueio"
          onCancel={() => setDialogMode(null)}
          onConfirm={(reason) => {
            setDialogMode(null);
            void runCheckin(
              () => registerReceptionDenied(selected.userId, reason),
              "Bloqueio registrado na auditoria."
            );
          }}
        />
      )}

      {notesOpen && selected && studentCtx && (
        <div
          className="recepcao-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNotesOpen(false);
          }}
        >
          <div className="recepcao-modal-panel" role="dialog" aria-modal="true" aria-labelledby="rec-notes-title">
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div className="section-card__header" style={{ marginBottom: 0 }}>
                <div>
                  <div className="dash-eyebrow">Somente leitura</div>
                  <h2 id="rec-notes-title" style={{ margin: "4px 0 0", fontSize: "var(--text-lg)" }}>
                    Recados da equipe
                  </h2>
                  <p className="small muted" style={{ margin: "var(--space-2) 0 0" }}>
                    Mensagens de personal ou administração. Conteúdo clínico (nutri) não aparece aqui.
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setNotesOpen(false)}>
                  Fechar
                </button>
              </div>
              <div className="rec-notes-list">
                {studentCtx.staffMessages.length === 0 ? (
                  <div className="small muted">Sem mensagens recentes.</div>
                ) : (
                  studentCtx.staffMessages.map((m) => (
                    <article key={m.id} className="rec-notes-item">
                      <div className="rec-notes-from">
                        {m.fromName} · {m.senderRole}
                      </div>
                      <div className="rec-notes-time">{timeLabel(m.createdAt)}</div>
                      <div className="rec-notes-text">{m.text}</div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="dash-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dash-skeleton-bar" style={{ height: 52 }} />
          ))}
        </div>
      ) : (
        dashboard && (
          <>
            <LotacaoChart occupancyNow={dashboard.kpis.occupancyNow} />

            <div className="rec-main">
              <div className="rec-feed-card">
                <div className="rec-feed-header">
                  <h2 className="rec-feed-title">
                    <span className="rec-live-dot" aria-hidden="true" />
                    Feed operacional
                  </h2>
                  <button className="btn btn-sm btn-ghost" onClick={() => navigate("/app/academy/recepcao/checkin")}>
                    Registrar
                  </button>
                </div>
                <div className="rec-feed-body">
                  {dashboard.recentEvents.length === 0 ? (
                    <div className="rec-feed-empty">
                      Nenhum acesso registrado ainda.
                      <br />
                      O feed atualiza com polling adaptativo (aba visível e em uso = mais frequente).
                    </div>
                  ) : (
                    dashboard.recentEvents.map((event) => (
                      <div key={event.id} className="rec-feed-event">
                        <span className={`rec-feed-dot rec-feed-dot--${event.eventType}`} aria-hidden="true" />
                        <div className="rec-feed-info">
                          <div className="rec-feed-name">{eventTitle(event)}</div>
                          <div className="rec-feed-time">
                            {timeLabel(event.createdAt)} · {event.actorName ?? "sistema"}
                          </div>
                        </div>
                        <span className={`${eventBadge(event)}`} style={{ fontSize: 11 }}>
                          {eventLabel(event)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rec-sidebar">
                <div className="rec-quick-card">
                  <div className="rec-quick-label">Ações rápidas</div>
                  <div className="rec-quick-grid">
                    <button className="rec-quick-btn" onClick={() => navigate("/app/academy/recepcao/novo-aluno")}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Novo aluno
                    </button>
                    <button
                      className="rec-quick-btn"
                      onClick={() => {
                        bumpInteraction();
                        setShowVisitor(true);
                      }}
                    >
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                      </svg>
                      Visitante
                    </button>
                    <button className="rec-quick-btn" onClick={() => navigate("/app/academy/recepcao/checkin")}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 12l2 2 4-4" />
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                      Check-in
                    </button>
                    <button
                      className="rec-quick-btn"
                      onClick={() => kpis?.birthdaysToday && openPanel("birthdaysToday")}
                      disabled={!kpis?.birthdaysToday}
                    >
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
                      </svg>
                      Aniversários{kpis?.birthdaysToday ? ` (${kpis.birthdaysToday})` : ""}
                    </button>
                    <button
                      className="rec-quick-btn"
                      onClick={() => kpis?.overdueStudents && openPanel("overdueStudents")}
                      disabled={!kpis?.overdueStudents}
                    >
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <path d="M12 9v4m0 4h.01" />
                      </svg>
                      Pendências{kpis?.overdueStudents ? ` (${kpis.overdueStudents})` : ""}
                    </button>
                    <button className="rec-quick-btn" onClick={() => openPanel("observability")}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-7.5-1.5 1.5m-9 9-1.5 1.5m0-12 1.5 1.5m9 9 1.5 1.5" />
                      </svg>
                      Catraca
                    </button>
                  </div>
                </div>

                <MyExceptionsCard actorUserId={actorUserId} />

                <div className="rec-alerts-card">
                  <div className="rec-alerts-head">
                    <div className="rec-alerts-label">Prioridades</div>
                    {alerts.length > 0 && <span className="rec-alerts-badge">{alerts.length}</span>}
                  </div>
                  {alerts.length === 0 ? (
                    <div className="rec-alerts-ok">Nenhuma pendência crítica no momento.</div>
                  ) : (
                    alerts.map((alert, i) => (
                      <button key={i} className="rec-alert-item" onClick={() => openPanel(alert.panelKey)}>
                        <div className={`rec-alert-icon rec-alert-icon--${alert.tone}`}>{alert.icon}</div>
                        <div className="rec-alert-info">
                          <div className="rec-alert-name">{alert.label}</div>
                          <div className="rec-alert-sub">{alert.sub}</div>
                        </div>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rec-kpi-strip">
              {[
                { key: "occupancyNow" as const, label: "Lotação", value: kpis?.occupancyNow ?? 0, tone: "" },
                { key: "accessToday" as const, label: "Acessos hoje", value: kpis?.accessToday ?? 0, tone: "rec-kpi-chip-value--ok" },
                { key: "overdueStudents" as const, label: "Pendências", value: kpis?.overdueStudents ?? 0, tone: "rec-kpi-chip-value--warn" },
                { key: "birthdaysToday" as const, label: "Aniversários", value: kpis?.birthdaysToday ?? 0, tone: "" },
                { key: "exceptionsToday" as const, label: "Exceções", value: kpis?.exceptionsToday ?? 0, tone: "" },
                {
                  key: "deniedToday" as const,
                  label: "Bloqueios",
                  value: kpis?.deniedToday ?? 0,
                  tone: (kpis?.deniedToday ?? 0) > 0 ? "rec-kpi-chip-value--warn" : "",
                },
                { key: "newStudents7d" as const, label: "Novos 7d", value: kpis?.newStudents7d ?? 0, tone: "" },
              ].map((item) => (
                <button key={item.key} className="rec-kpi-chip" onClick={() => openPanel(item.key)}>
                  <span className={`rec-kpi-chip-value ${item.tone}`}>{item.value}</span>
                  <span className="rec-kpi-chip-label">{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )
      )}

      {showVisitor && (
        <div
          className="drawer-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetVisitor();
          }}
        >
          <div className="drawer-panel" style={{ maxWidth: 520 }}>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                const baseReason =
                  visitorType === "external_personal"
                    ? "Personal externo autorizado"
                    : visitorType === "prospect"
                      ? "Prospect — lead comercial"
                      : visitorType === "trial_class"
                        ? "Aula experimental — lead comercial"
                        : "Visitante liberado";
                void (async () => {
                  setCheckinLoading(true);
                  setCheckinErr("");
                  try {
                    const res = await registerReceptionVisitor({
                      name: visitorName,
                      document: visitorDoc || undefined,
                      visitorType,
                      phone: visitorPhone.trim() || undefined,
                      referredBy: visitorReferredBy.trim() || undefined,
                      validUntil: visitorValidUntil ? `${visitorValidUntil}T23:59:59` : undefined,
                      reason: baseReason,
                    });
                    if (res.duplicate) {
                      showToast("Já registrado há instantes (mesmo nome em menos de 60s).", "info");
                    } else {
                      showToast("Visitante registrado e entrada liberada.", "ok");
                    }
                    loadDashboard();
                    bumpInteraction();
                    resetVisitor();
                  } catch (err: unknown) {
                    setCheckinErr((err as Error).message ?? "Erro ao registrar visitante.");
                  } finally {
                    setCheckinLoading(false);
                  }
                })();
              }}
            >
              <div>
                <div className="dash-eyebrow">Acesso temporário</div>
                <h2 style={{ margin: "4px 0 0", fontSize: "var(--text-lg)" }}>Visitante · lead comercial</h2>
                <p className="small muted" style={{ marginTop: "var(--space-2)" }}>
                  Prospect e aula experimental geram lead comercial; inclua telefone e indicação quando possível.
                </p>
              </div>
              <div className="field">
                <label className="label">Nome</label>
                <input autoFocus className="input" required value={visitorName} onChange={(e) => setVisitorName(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Documento (opcional)</label>
                <input className="input" value={visitorDoc} onChange={(e) => setVisitorDoc(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Telefone (opcional)</label>
                <input className="input" value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)} placeholder="+55…" />
              </div>
              <div className="field">
                <label className="label">Indicação / quem indicou (opcional)</label>
                <input className="input" value={visitorReferredBy} onChange={(e) => setVisitorReferredBy(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Válido até</label>
                <input className="input" type="date" value={visitorValidUntil} onChange={(e) => setVisitorValidUntil(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Tipo</label>
                <select className="input" value={visitorType} onChange={(e) => setVisitorType(e.target.value as typeof visitorType)}>
                  <option value="visitor">Visitante</option>
                  <option value="external_personal">Personal externo</option>
                  <option value="prospect">Prospect</option>
                  <option value="trial_class">Aula experimental</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button className="btn btn-primary" type="submit" disabled={checkinLoading}>
                  Liberar acesso
                </button>
                <button className="btn btn-ghost" type="button" onClick={resetVisitor}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {displayPanel && activePanel && (
        <div
          className="recepcao-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActivePanel(null);
          }}
        >
          <div className="recepcao-modal-panel" role="dialog" aria-modal="true" aria-labelledby="rec-panel-title">
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div className="section-card__header" style={{ marginBottom: 0 }}>
                <div>
                  <div className="dash-eyebrow">Dados relacionados</div>
                  <h2 id="rec-panel-title" style={{ margin: "4px 0 0", fontSize: "var(--text-lg)" }}>
                    {displayPanel.title}
                  </h2>
                  <p className="small muted" style={{ margin: "var(--space-2) 0 0" }}>
                    {displayPanel.description} Total: {displayPanel.total}.
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setActivePanel(null)}>
                  Fechar
                </button>
              </div>

              {activePanel !== "observability" && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label" htmlFor="rec-panel-filter">
                    Filtrar lista
                  </label>
                  <input
                    id="rec-panel-filter"
                    className="input rec-panel-filter"
                    placeholder="Nome, e-mail, motivo…"
                    value={panelFilterInput}
                    onChange={(e) => setPanelFilterInput(e.target.value)}
                  />
                </div>
              )}

              {activePanel === "observability" && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label" htmlFor="rec-panel-filter-obs">
                    Filtrar
                  </label>
                  <input
                    id="rec-panel-filter-obs"
                    className="input rec-panel-filter"
                    placeholder="Integração…"
                    value={panelFilterInput}
                    onChange={(e) => setPanelFilterInput(e.target.value)}
                  />
                </div>
              )}

              {panelRemoteErr && activePanel !== "observability" && <div className="banner-error">{panelRemoteErr}</div>}

              {activePanel !== "observability" && panelRemoteLoading ? (
                <div className="small muted">Carregando página…</div>
              ) : displayPanel.rows.length === 0 &&
                displayPanel.total === 0 &&
                (activePanel === "observability" || !panelRemoteLoading) ? (
                <div className="banner-success">{displayPanel.emptyTitle}</div>
              ) : displayPanel.rows.length === 0 && displayPanel.total > 0 ? (
                <div className="banner-error">Total indica {displayPanel.total} registro(s) mas a lista não pôde ser carregada.</div>
              ) : (
                <>
                  <div className="rec-drill-grid">
                    {pagedRows.map((row) => (
                      <div key={row.id} className="rec-drill-card">
                        <div className="rec-drill-card-head">
                          {typeof row.userId === "number" && row.title ? (
                            <div className="rec-drill-initials">{initials(row.title)}</div>
                          ) : (
                            <div className="rec-drill-initials">#</div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <h3 className="rec-drill-title">{row.title}</h3>
                            <div className="rec-drill-sub">{row.subtitle}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          {row.badge && <span className={row.badgeClass ?? "badge"}>{row.badge}</span>}
                          {row.userId ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={() => navigate(`/app/academy/students/${row.userId}`)}
                            >
                              Ver perfil
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="small muted">
                      {activePanel === "observability"
                        ? `${pagedRows.length} de ${filteredObservRows.length} · ${PANEL_PAGE_SIZE} por página`
                        : `${pagedRows.length} nesta página · total ${panelRemoteTotal}`}
                    </span>
                    {totalPages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setPanelPage((p) => Math.max(1, p - 1))}
                          disabled={panelPage === 1}
                        >
                          Anterior
                        </button>
                        <span className="small muted">
                          Página {panelPage} de {totalPages}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setPanelPage((p) => Math.min(totalPages, p + 1))}
                          disabled={panelPage === totalPages}
                        >
                          Próxima
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
