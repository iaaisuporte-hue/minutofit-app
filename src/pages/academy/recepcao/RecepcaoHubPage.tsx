import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchReceptionDashboard,
  fetchStudents,
  registerReceptionCheckin,
  registerReceptionDenied,
  registerReceptionException,
  registerReceptionVisitor,
  searchReceptionStudents,
  type ReceptionAccessEvent,
  type ReceptionDashboard,
  type ReceptionDashboardStudent,
  type ReceptionStudent,
  type Student,
} from "../../../services/academyApi";
import { ExceptionReasonDialog } from "./ExceptionReasonDialog";
import { initials, statusBadge, statusLabel, timeLabel } from "./recepcaoUtils";
import "./recepcao.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const PANEL_PAGE_SIZE = 10;
const REFRESH_INTERVAL = 30_000;

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

function studentToReceptionDashboardStudent(s: Student): ReceptionDashboardStudent {
  return {
    userId: s.userId,
    name: s.name,
    email: s.email,
    phone: s.phone ?? null,
    birthDate: s.birthDate ? new Date(`${s.birthDate}T12:00:00`).toISOString() : null,
    studentStatus: s.studentStatus,
    joinedAt: s.joinedAt,
    activePlan: s.activePlan
      ? { id: s.activePlan.id, name: s.activePlan.name, monthlyPrice: s.activePlan.monthlyPrice }
      : null,
    lastAccessAt: null,
  };
}

async function enrichReceptionDashboard(data: ReceptionDashboard): Promise<ReceptionDashboard> {
  const base = data.related;
  const merged = {
    occupancyNow: base?.occupancyNow ?? [],
    accessToday: base?.accessToday ?? [],
    exceptionsToday: base?.exceptionsToday ?? [],
    deniedToday: base?.deniedToday ?? [],
    overdueStudents: [...(base?.overdueStudents ?? [])],
    newStudents7d: [...(base?.newStudents7d ?? [])],
    birthdaysToday: [...(base?.birthdaysToday ?? [])],
  };

  if (data.kpis.overdueStudents > 0 && merged.overdueStudents.length === 0) {
    try {
      const { students } = await fetchStudents({ status: "overdue", pageSize: 100 });
      merged.overdueStudents = students.filter((s) => s.isActive).map(studentToReceptionDashboardStudent);
    } catch { /* opcional */ }
  }

  if (data.kpis.newStudents7d > 0 && merged.newStudents7d.length === 0) {
    try {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const { students } = await fetchStudents({ pageSize: 200 });
      merged.newStudents7d = students
        .filter((s) => s.isActive && s.joinedAt && new Date(s.joinedAt).getTime() >= cutoff)
        .map(studentToReceptionDashboardStudent);
    } catch { /* opcional */ }
  }

  if (data.kpis.birthdaysToday > 0 && merged.birthdaysToday.length === 0) {
    try {
      const today = new Date();
      const { students } = await fetchStudents({ pageSize: 400 });
      merged.birthdaysToday = students
        .filter((s) => {
          if (!s.isActive || !s.birthDate) return false;
          const bd = new Date(`${s.birthDate}T12:00:00`);
          return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
        })
        .map(studentToReceptionDashboardStudent);
    } catch { /* opcional */ }
  }

  return { ...data, related: merged };
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

function buildPanel(key: PanelKey, data: ReceptionDashboard): DetailPanel {
  const r = data.related;
  if (key === "occupancyNow")
    return { title: "Lotação agora", description: "Entradas nos últimos 90 minutos.", total: data.kpis.occupancyNow, rows: (r?.occupancyNow ?? data.recentEvents).map(eventRow), emptyTitle: "Nenhuma entrada recente." };
  if (key === "accessToday")
    return { title: "Acessos hoje", description: "Registros do dia.", total: data.kpis.accessToday, rows: (r?.accessToday ?? data.recentEvents).map(eventRow), emptyTitle: "Nenhum acesso hoje." };
  if (key === "overdueStudents")
    return { title: "Pendências", description: "Alunos com situação financeira ou operacional pendente.", total: data.kpis.overdueStudents, rows: (r?.overdueStudents ?? []).map((s) => studentRow(s, "pending")), emptyTitle: "Nenhuma pendência." };
  if (key === "birthdaysToday")
    return { title: "Aniversariantes", description: "Alunos que fazem aniversário hoje.", total: data.kpis.birthdaysToday, rows: (r?.birthdaysToday ?? []).map((s) => studentRow(s, "birthday")), emptyTitle: "Nenhum aniversariante hoje." };
  if (key === "exceptionsToday")
    return { title: "Exceções hoje", description: "Entradas com justificativa auditada.", total: data.kpis.exceptionsToday, rows: (r?.exceptionsToday ?? data.exceptions).map(eventRow), emptyTitle: "Nenhuma exceção hoje." };
  if (key === "deniedToday")
    return { title: "Bloqueios hoje", description: "Entradas negadas com auditoria.", total: data.kpis.deniedToday, rows: (r?.deniedToday ?? data.exceptions.filter((e) => e.eventType === "denied")).map(eventRow), emptyTitle: "Nenhum bloqueio hoje." };
  if (key === "newStudents7d")
    return { title: "Novos alunos 7d", description: "Alunos cadastrados na última semana.", total: data.kpis.newStudents7d, rows: (r?.newStudents7d ?? []).map((s) => studentRow(s, "new")), emptyTitle: "Nenhum novo aluno nos últimos 7 dias." };
  return {
    title: "Catraca — Observability",
    description: "Estado atual das integrações de acesso.",
    total: 3,
    rows: [
      { id: "catraca", title: "Catraca", subtitle: data.status.catraca === "manual_only" ? "Operação manual — sem controle remoto" : data.status.catraca, badge: "Manual", badgeClass: "badge badge-info" },
      { id: "facial", title: "Facial", subtitle: data.status.facial === "planned" ? "Integração planejada (V2)" : data.status.facial, badge: "Planejado", badgeClass: "badge" },
      { id: "partners", title: "Wellhub / TotalPass", subtitle: data.status.partners === "planned" ? "Integração planejada (V2)" : data.status.partners, badge: "Planejado", badgeClass: "badge" },
    ],
    emptyTitle: "Sem status disponível.",
  };
}

function buildAlerts(data: ReceptionDashboard): AlertItem[] {
  const items: AlertItem[] = [];
  if (data.kpis.overdueStudents > 0)
    items.push({ label: `${data.kpis.overdueStudents} aluno${data.kpis.overdueStudents > 1 ? "s" : ""} com pendência`, sub: "Verificar antes de liberar acesso", tone: "warn", icon: "!", panelKey: "overdueStudents" });
  if (data.kpis.deniedToday > 0)
    items.push({ label: `${data.kpis.deniedToday} bloqueio${data.kpis.deniedToday > 1 ? "s" : ""} hoje`, sub: "Entradas negadas com auditoria", tone: "danger", icon: "✕", panelKey: "deniedToday" });
  if (data.status.catraca === "manual_only")
    items.push({ label: "Catraca em modo manual", sub: "Operação V1 — sem controle remoto", tone: "info", icon: "i", panelKey: "observability" });
  return items;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecepcaoHubPage() {
  const navigate = useNavigate();

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
  const [checkinMsg, setCheckinMsg] = useState("");
  const [checkinErr, setCheckinErr] = useState("");
  const [dialogMode, setDialogMode] = useState<"exception" | "deny" | null>(null);

  // Visitor form
  const [showVisitor, setShowVisitor] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorDoc, setVisitorDoc] = useState("");
  const [visitorType, setVisitorType] = useState<"visitor" | "external_personal">("visitor");

  // KPI panels
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [panelPage, setPanelPage] = useState(1);

  // Clock
  const [now, setNow] = useState(new Date());

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<number>(0);

  // ── Load dashboard ───────────────────────────────────────────────
  const loadDashboard = useCallback(() => {
    fetchReceptionDashboard()
      .then((data) => enrichReceptionDashboard(data))
      .then((data) => { setDashboard(data); setError(""); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDashboard();
    const id = setInterval(loadDashboard, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [loadDashboard]);

  // ── Clock ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Search debounce ──────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimer.current = window.setTimeout(() => {
      searchReceptionStudents(trimmed)
        .then((rows) => { setSearchResults(rows); setShowResults(true); })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 180);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  // ── Actions ──────────────────────────────────────────────────────
  function selectStudent(s: ReceptionStudent) {
    setSelected(s);
    setQuery("");
    setSearchResults([]);
    setShowResults(false);
    setCheckinMsg("");
    setCheckinErr("");
  }

  function clearSelected() {
    setSelected(null);
    setCheckinMsg("");
    setCheckinErr("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function runCheckin(action: () => Promise<unknown>, successMsg: string) {
    setCheckinLoading(true);
    setCheckinErr("");
    setCheckinMsg("");
    try {
      await action();
      setCheckinMsg(successMsg);
      setSelected(null);
      loadDashboard();
    } catch (err: unknown) {
      setCheckinErr((err as Error).message ?? "Erro desconhecido.");
    } finally {
      setCheckinLoading(false);
    }
  }

  function resetVisitor() {
    setVisitorName(""); setVisitorDoc(""); setVisitorType("visitor"); setShowVisitor(false);
  }

  function openPanel(key: PanelKey) { setActivePanel(key); setPanelPage(1); }

  // ── Derived ──────────────────────────────────────────────────────
  const kpis = dashboard?.kpis;
  const alerts = dashboard ? buildAlerts(dashboard) : [];
  const isBlocked = selected
    ? ["overdue", "paused", "cancelled"].includes(selected.studentStatus ?? "")
    : false;

  const panel = dashboard && activePanel ? buildPanel(activePanel, dashboard) : null;
  const totalPages = panel ? Math.max(1, Math.ceil(panel.rows.length / PANEL_PAGE_SIZE)) : 1;
  const pagedRows = panel ? panel.rows.slice((panelPage - 1) * PANEL_PAGE_SIZE, panelPage * PANEL_PAGE_SIZE) : [];

  const clockLabel = now.toLocaleString("pt-BR", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="rec-hub">

      {/* ── Header ── */}
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
          <button className="btn btn-sm btn-secondary" onClick={() => navigate("/app/academy/recepcao/novo-aluno")}>
            Novo aluno
          </button>
        </div>
      </header>

      {error && <div className="banner-error">{error}</div>}

      {/* ── Search hero ── */}
      <div className="rec-search-wrap">
        <div className="rec-search-field">
          <svg className="rec-search-icon" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            autoFocus
            className="rec-search-input"
            placeholder="Buscar aluno, CPF, QR ou facial..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => query.trim().length >= 2 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Buscar aluno"
          />
        </div>
        <div className="rec-search-hint">Nome, CPF, e-mail ou telefone · mín. 2 caracteres · auto-refresh {REFRESH_INTERVAL / 1000}s</div>

        {showResults && (searchLoading || searchResults.length > 0 || query.trim().length >= 2) && (
          <div className="rec-results" role="listbox">
            {searchLoading ? (
              <div className="rec-results-status">Buscando...</div>
            ) : searchResults.length > 0 ? searchResults.map((s) => (
              <button
                key={s.userId}
                role="option"
                aria-selected="false"
                className="rec-result-item"
                onMouseDown={() => selectStudent(s)}
              >
                {s.avatarUrl
                  ? <img src={s.avatarUrl} alt={s.name} className="rec-result-avatar" />
                  : <div className="rec-result-initials">{initials(s.name || s.email)}</div>
                }
                <div className="rec-result-info">
                  <div className="rec-result-name">{s.name || s.email}</div>
                  <div className="rec-result-sub">
                    {s.email} · {s.activePlan?.name ?? "Sem plano"} · {timeLabel(s.lastAccessAt)}
                  </div>
                </div>
                <span className={statusBadge(s.studentStatus)}>{statusLabel(s.studentStatus)}</span>
              </button>
            )) : (
              <div className="rec-results-status">Nenhum aluno encontrado neste tenant.</div>
            )}
          </div>
        )}
      </div>

      {/* ── Feedback ── */}
      {checkinMsg && <div className="rec-feedback rec-feedback--ok">{checkinMsg}</div>}
      {checkinErr && <div className="rec-feedback rec-feedback--err">{checkinErr}</div>}

      {/* ── Inline checkin card ── */}
      {selected && (
        <div className="rec-checkin-card">
          <div className="rec-checkin-header">
            <div className="rec-checkin-student">
              {selected.avatarUrl
                ? <img src={selected.avatarUrl} alt={selected.name} className="rec-checkin-avatar" />
                : <div className="rec-checkin-initials">{initials(selected.name || selected.email)}</div>
              }
              <div>
                <h2 className="rec-checkin-name">{selected.name || selected.email}</h2>
                <div className="rec-checkin-sub">{selected.email} · {selected.phone ?? "sem telefone"}</div>
              </div>
            </div>
            <div className="rec-checkin-badge-row">
              <span className={statusBadge(selected.studentStatus)}>{statusLabel(selected.studentStatus)}</span>
              <button className="btn btn-sm btn-ghost" onClick={clearSelected}>Trocar</button>
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

          <div className={`rec-checkin-banner ${isBlocked ? "rec-checkin-banner--blocked" : "rec-checkin-banner--ok"}`}>
            {isBlocked
              ? "Atenção: status exige revisão antes do acesso. Liberar apenas com exceção auditada."
              : "Acesso operacional liberado — clique em Liberar entrada para registrar."}
          </div>

          <div className="rec-checkin-actions">
            <button
              className="btn btn-primary"
              onClick={() => runCheckin(() => registerReceptionCheckin(selected.userId), "Entrada liberada e registrada.")}
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

      {/* ── Exception dialog ── */}
      {dialogMode === "exception" && selected && (
        <ExceptionReasonDialog
          title="Liberar com exceção"
          description="Pendência, status em revisão ou autorização pontual do gestor."
          confirmLabel="Liberar com exceção"
          onCancel={() => setDialogMode(null)}
          onConfirm={(reason) => {
            setDialogMode(null);
            runCheckin(() => registerReceptionException(selected.userId, reason), "Exceção registrada e entrada liberada.");
          }}
        />
      )}

      {/* ── Deny dialog ── */}
      {dialogMode === "deny" && selected && (
        <ExceptionReasonDialog
          title="Registrar bloqueio"
          description="Registra que a entrada foi negada e salva o motivo na auditoria."
          confirmLabel="Registrar bloqueio"
          onCancel={() => setDialogMode(null)}
          onConfirm={(reason) => {
            setDialogMode(null);
            runCheckin(() => registerReceptionDenied(selected.userId, reason), "Bloqueio registrado na auditoria.");
          }}
        />
      )}

      {/* ── Main content ── */}
      {loading ? (
        <div className="dash-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dash-skeleton-bar" style={{ height: 52 }} />
          ))}
        </div>
      ) : dashboard && (
        <>
          <div className="rec-main">
            {/* ── Feed ── */}
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
                    Nenhum acesso registrado ainda.<br />
                    O feed atualiza automaticamente a cada {REFRESH_INTERVAL / 1000}s.
                  </div>
                ) : dashboard.recentEvents.map((event) => (
                  <div key={event.id} className="rec-feed-event">
                    <span className={`rec-feed-dot rec-feed-dot--${event.eventType}`} aria-hidden="true" />
                    <div className="rec-feed-info">
                      <div className="rec-feed-name">{eventTitle(event)}</div>
                      <div className="rec-feed-time">{timeLabel(event.createdAt)} · {event.actorName ?? "sistema"}</div>
                    </div>
                    <span className={`${eventBadge(event)}`} style={{ fontSize: 11 }}>{eventLabel(event)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Sidebar ── */}
            <div className="rec-sidebar">
              {/* Quick actions */}
              <div className="rec-quick-card">
                <div className="rec-quick-label">Ações rápidas</div>
                <div className="rec-quick-grid">
                  <button className="rec-quick-btn" onClick={() => navigate("/app/academy/recepcao/novo-aluno")}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    Novo aluno
                  </button>
                  <button className="rec-quick-btn" onClick={() => setShowVisitor(true)}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                    Visitante
                  </button>
                  <button className="rec-quick-btn" onClick={() => navigate("/app/academy/recepcao/checkin")}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-4" /><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                    Check-in
                  </button>
                  <button
                    className="rec-quick-btn"
                    onClick={() => kpis?.birthdaysToday && openPanel("birthdaysToday")}
                    disabled={!kpis?.birthdaysToday}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /></svg>
                    Aniversários{kpis?.birthdaysToday ? ` (${kpis.birthdaysToday})` : ""}
                  </button>
                  <button
                    className="rec-quick-btn"
                    onClick={() => kpis?.overdueStudents && openPanel("overdueStudents")}
                    disabled={!kpis?.overdueStudents}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4m0 4h.01" /></svg>
                    Pendências{kpis?.overdueStudents ? ` (${kpis.overdueStudents})` : ""}
                  </button>
                  <button className="rec-quick-btn" onClick={() => openPanel("observability")}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-7.5-1.5 1.5m-9 9-1.5 1.5m0-12 1.5 1.5m9 9 1.5 1.5" /></svg>
                    Catraca
                  </button>
                </div>
              </div>

              {/* Alerts */}
              <div className="rec-alerts-card">
                <div className="rec-alerts-head">
                  <div className="rec-alerts-label">Prioridades</div>
                  {alerts.length > 0 && <span className="rec-alerts-badge">{alerts.length}</span>}
                </div>
                {alerts.length === 0 ? (
                  <div className="rec-alerts-ok">Nenhuma pendência crítica no momento.</div>
                ) : alerts.map((alert, i) => (
                  <button key={i} className="rec-alert-item" onClick={() => openPanel(alert.panelKey)}>
                    <div className={`rec-alert-icon rec-alert-icon--${alert.tone}`}>{alert.icon}</div>
                    <div className="rec-alert-info">
                      <div className="rec-alert-name">{alert.label}</div>
                      <div className="rec-alert-sub">{alert.sub}</div>
                    </div>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── KPI strip ── */}
          <div className="rec-kpi-strip">
            {[
              { key: "occupancyNow" as const, label: "Lotação", value: kpis?.occupancyNow ?? 0, tone: "" },
              { key: "accessToday" as const, label: "Acessos hoje", value: kpis?.accessToday ?? 0, tone: "rec-kpi-chip-value--ok" },
              { key: "overdueStudents" as const, label: "Pendências", value: kpis?.overdueStudents ?? 0, tone: "rec-kpi-chip-value--warn" },
              { key: "birthdaysToday" as const, label: "Aniversários", value: kpis?.birthdaysToday ?? 0, tone: "" },
              { key: "exceptionsToday" as const, label: "Exceções", value: kpis?.exceptionsToday ?? 0, tone: "" },
              { key: "deniedToday" as const, label: "Bloqueios", value: kpis?.deniedToday ?? 0, tone: (kpis?.deniedToday ?? 0) > 0 ? "rec-kpi-chip-value--warn" : "" },
              { key: "newStudents7d" as const, label: "Novos 7d", value: kpis?.newStudents7d ?? 0, tone: "" },
            ].map((item) => (
              <button key={item.key} className="rec-kpi-chip" onClick={() => openPanel(item.key)}>
                <span className={`rec-kpi-chip-value ${item.tone}`}>{item.value}</span>
                <span className="rec-kpi-chip-label">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Visitor drawer ── */}
      {showVisitor && (
        <div className="drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) resetVisitor(); }}>
          <div className="drawer-panel" style={{ maxWidth: 520 }}>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                const reason = visitorType === "external_personal" ? "Personal externo autorizado" : "Visitante liberado";
                runCheckin(
                  () => registerReceptionVisitor({ name: visitorName, document: visitorDoc || undefined, visitorType, reason }),
                  "Visitante registrado e entrada liberada."
                );
                resetVisitor();
              }}
            >
              <div>
                <div className="dash-eyebrow">Acesso temporário</div>
                <h2 style={{ margin: "4px 0 0", fontSize: "var(--text-lg)" }}>Visitante / personal externo</h2>
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
                <label className="label">Tipo</label>
                <select className="input" value={visitorType} onChange={(e) => setVisitorType(e.target.value as "visitor" | "external_personal")}>
                  <option value="visitor">Visitante</option>
                  <option value="external_personal">Personal externo</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button className="btn btn-primary" type="submit" disabled={checkinLoading}>Liberar acesso</button>
                <button className="btn btn-ghost" type="button" onClick={resetVisitor}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── KPI detail modal ── */}
      {panel && (
        <div
          className="recepcao-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setActivePanel(null); }}
        >
          <div className="recepcao-modal-panel" role="dialog" aria-modal="true" aria-labelledby="rec-panel-title">
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div className="section-card__header" style={{ marginBottom: 0 }}>
                <div>
                  <div className="dash-eyebrow">Dados relacionados</div>
                  <h2 id="rec-panel-title" style={{ margin: "4px 0 0", fontSize: "var(--text-lg)" }}>{panel.title}</h2>
                  <p className="small muted" style={{ margin: "var(--space-2) 0 0" }}>
                    {panel.description} Total: {panel.total}.
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setActivePanel(null)}>Fechar</button>
              </div>

              {panel.rows.length === 0 && panel.total > 0 ? (
                <div className="banner-error">
                  Total indica {panel.total} registro(s) mas a lista não pôde ser carregada. Recarregue a página.
                </div>
              ) : panel.rows.length === 0 ? (
                <div className="banner-success">{panel.emptyTitle}</div>
              ) : (
                <>
                  <div className="table-wrapper" style={{ boxShadow: "none" }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Registro</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <div className="identity-row__name">{row.title}</div>
                              <div className="identity-row__sub">{row.subtitle}</div>
                            </td>
                            <td>
                              {row.badge && <span className={row.badgeClass ?? "badge"}>{row.badge}</span>}
                            </td>
                            <td>
                              {row.userId && (
                                <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/app/academy/students/${row.userId}`)}>
                                  Ver perfil
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    <span className="small muted">
                      {pagedRows.length} de {panel.rows.length} registros · {PANEL_PAGE_SIZE} por página
                    </span>
                    {totalPages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setPanelPage((p) => Math.max(1, p - 1))} disabled={panelPage === 1}>Anterior</button>
                        <span className="small muted">Página {panelPage} de {totalPages}</span>
                        <button className="btn btn-sm btn-ghost" onClick={() => setPanelPage((p) => Math.min(totalPages, p + 1))} disabled={panelPage === totalPages}>Próxima</button>
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
