import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { fetchReceptionDashboard, type ReceptionAccessEvent, type ReceptionDashboard } from "../../../services/academyApi";
import { useAdaptivePolling } from "../../../hooks/useAdaptivePolling";
import { useReceptionStream } from "../../../hooks/useReceptionStream";
import { initials, timeLabel } from "./recepcaoUtils";
import "./recepcao.css";

function eventTitle(event: ReceptionAccessEvent) {
  if (event.visitor.name) return event.visitor.name;
  return event.student.name ?? event.student.email ?? "Registro operacional";
}

export default function RecepcaoDisplayPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [dashboard, setDashboard] = useState<ReceptionDashboard | null>(null);
  const [err, setErr] = useState("");
  const [heroKey, setHeroKey] = useState(0);

  const load = useCallback(() => {
    fetchReceptionDashboard()
      .then((d) => {
        setDashboard(d);
        setErr("");
        setHeroKey((k) => k + 1);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  const { bumpInteraction: bumpPoll } = useAdaptivePolling(load);
  useReceptionStream(load, true);

  useEffect(() => {
    load();
  }, [load]);

  const brand =
    auth.branding?.displayName ??
    auth.academies?.find((a) => a.id === auth.activeAcademyId)?.displayName ??
    "Academia";

  const recent = dashboard?.recentEvents ?? [];
  const hero = recent[0];
  const next = recent.slice(1, 4);

  function goHub() {
    navigate("/app/academy/recepcao");
  }

  async function goFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
      bumpPoll();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rec-display-root">
      <div className="rec-display-top">
        <div className="rec-display-brand">{brand}</div>
        <div className="rec-display-actions">
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => { bumpPoll(); load(); }}>
            Atualizar
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={goFullscreen}>
            Tela cheia
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={goHub}>
            Voltar ao hub
          </button>
        </div>
      </div>

      {err && <div className="banner-error" style={{ maxWidth: 720, margin: "0 auto" }}>{err}</div>}

      <div className="rec-display-hero">
        {!hero ? (
          <div className="rec-display-empty">Aguardando primeiro check-in do dia…</div>
        ) : (
          <div key={heroKey} className="rec-display-hero-card">
            {hero.student.avatarUrl ? (
              <img src={hero.student.avatarUrl} alt="" className="rec-display-avatar" />
            ) : (
              <div className="rec-display-initials">{initials(eventTitle(hero))}</div>
            )}
            <h1 className="rec-display-name">{eventTitle(hero)}</h1>
            <div className="rec-display-sub">
              Sessão registrada às{" "}
              {new Date(hero.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {hero.actorName ?? "Recepção"}
            </div>
          </div>
        )}
      </div>

      {next.length > 0 && (
        <div>
          <div className="rec-display-next-label" style={{ textAlign: "center", marginBottom: "var(--space-2)" }}>
            Próximos acessos
          </div>
          <div className="rec-display-carousel">
            {next.map((ev) => (
              <div key={ev.id} className="rec-display-next">
                <div className="rec-display-next-label">{timeLabel(ev.createdAt)}</div>
                <div className="rec-display-next-name">{eventTitle(ev)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
