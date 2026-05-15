import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminUsers, type AdminUserRow } from "../../services/adminApi";
import { COLORS } from "../../styles/colors";
import { EmptyState } from "../../components/EmptyState";
import { Banner } from "../../components/Banner";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import "../personal/personalPremium.css";

type Props = {
  role: "user" | "personal" | "nutri";
  title: string;
  subtitle: string;
  detailBasePath: string;
  createPath?: string;
  createLabel?: string;
  showCreate?: boolean;
};

const PAGE_SIZE = 20;

const ROLE_KICKER: Record<Props["role"], string> = {
  user: "Base de alunos",
  personal: "Profissionais — Personais",
  nutri: "Profissionais — Nutricionistas",
};

const ROLE_EMPTY_LABEL: Record<Props["role"], string> = {
  user: "aluno",
  personal: "personal",
  nutri: "nutricionista",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function AdminPeopleList({
  role,
  title,
  subtitle,
  detailBasePath,
  createPath,
  createLabel,
  showCreate = false,
}: Props) {
  const [people, setPeople] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const offset = page * PAGE_SIZE;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAdminUsers({
      role,
      search: searchApplied || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((data) => {
        if (cancelled) return;
        setPeople(data?.users ?? []);
        setTotal(Number(data?.pagination?.total ?? 0));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [role, searchApplied, offset]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearchApplied(search);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="pp-page" style={{ padding: 16 }}>
      {/* Hero */}
      <div className="pp-hero" style={{ alignItems: "flex-end" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div className="pp-kicker">{ROLE_KICKER[role]}</div>
          <h2 className="pp-title" style={{ fontSize: 24 }}>{title}</h2>
          <div className="pp-meta">
            Total: <b style={{ color: COLORS.text }}>{total}</b> registro(s)
          </div>
          <div className="pp-subtitle" style={{ maxWidth: 620 }}>
            {subtitle}
          </div>
        </div>

        <div className="pp-actions">
          <form
            onSubmit={handleSearchSubmit}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
          >
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="pp-input"
              style={{ minWidth: 240 }}
            />
            <button type="submit" className="pp-btn pp-btn--primary pp-btn--sm">
              Buscar
            </button>
            {searchApplied && (
              <button
                type="button"
                className="pp-btn pp-btn--quiet pp-btn--sm"
                onClick={() => { setSearch(""); setSearchApplied(""); setPage(0); }}
              >
                Limpar
              </button>
            )}
          </form>

          {showCreate && createPath && createLabel && (
            <Link to={createPath} className="pp-btn pp-btn--primary pp-btn--sm" style={{ textDecoration: "none" }}>
              {createLabel}
            </Link>
          )}
        </div>
      </div>

      {loading && <LoadingSkeleton variant="list" lines={4} />}

      {error && (
        <Banner variant="error" title="Não foi possível carregar" description={error} />
      )}

      {!loading && !error && people.length === 0 && (
        searchApplied ? (
          <EmptyState
            variant="info"
            title={`Nenhum resultado para "${searchApplied}"`}
            description="Tente outros termos ou limpe o filtro para ver todos os registros."
          />
        ) : (
          <EmptyState
            title={`Nenhum ${ROLE_EMPTY_LABEL[role]} cadastrado ainda`}
            description="Os registros aparecerão aqui assim que os primeiros usuários forem criados ou convidados."
          />
        )
      )}

      {/* List */}
      {!loading && !error && people.length > 0 && (
        <div className="pp-panel">
          <div className="pp-panel__body" style={{ display: "grid" }}>
            {people.map((person) => (
              <div
                key={person.id}
                className="pp-student-row"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = COLORS.cardHover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                <div className="pp-student-main">
                  <div className="pp-inline">
                    <Link
                      to={`${detailBasePath}/${person.id}`}
                      className="pp-name"
                      style={{ textDecoration: "none" }}
                    >
                      {person.name || "—"}
                    </Link>
                    {person.subscription_tier && (
                      <span
                        style={{
                          padding: "5px 9px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 650,
                          border: `1px solid ${COLORS.borderStrong}`,
                          background: COLORS.primarySoft,
                          color: COLORS.text,
                          letterSpacing: 0.2,
                          lineHeight: "12px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {person.subscription_tier}
                      </span>
                    )}
                  </div>

                  <div className="pp-meta">
                    <b style={{ color: COLORS.text }}>{person.email}</b>
                    {" • "}Entrou em <b style={{ color: COLORS.text }}>{formatDate(person.created_at)}</b>
                    {!person.profile_completed && (
                      <> {" • "}<span style={{ color: COLORS.muted }}>perfil incompleto</span></>
                    )}
                  </div>
                </div>

                <div className="pp-actions">
                  <Link
                    to={`${detailBasePath}/${person.id}`}
                    className="pp-btn pp-btn--quiet pp-btn--sm"
                    style={{ textDecoration: "none" }}
                  >
                    Abrir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            paddingTop: 4,
          }}
        >
          <div className="pp-meta">
            <b style={{ color: COLORS.text }}>{showingFrom}–{showingTo}</b> de {total}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="pp-btn pp-btn--quiet pp-btn--sm"
              style={{ opacity: page === 0 ? 0.45 : 1, cursor: page === 0 ? "default" : "pointer" }}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="pp-btn pp-btn--quiet pp-btn--sm"
              style={{ opacity: page >= totalPages - 1 ? 0.45 : 1, cursor: page >= totalPages - 1 ? "default" : "pointer" }}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
