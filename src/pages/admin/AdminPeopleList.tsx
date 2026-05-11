import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminUsers, type AdminUserRow } from "../../services/adminApi";
import { COLORS } from "../../styles/colors";

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

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
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
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          padding: 18,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{title}</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 720, fontSize: 14 }}>{subtitle}</div>
          </div>
          {showCreate && createPath && createLabel && (
            <Link
              to={createPath}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "#22C55E",
                color: "#FFFFFF",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
            >
              {createLabel}
            </Link>
          )}
        </div>

        <form
          onSubmit={handleSearchSubmit}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
        >
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            style={{
              flex: 1,
              minWidth: 200,
              padding: "10px 12px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(8,14,11,.6)",
              color: COLORS.text,
              outline: "none",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.borderStrong}`,
              background: "#22C55E",
              color: "#FFFFFF",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Buscar
          </button>
          {searchApplied && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchApplied(""); setPage(0); }}
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                color: COLORS.text,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Limpar
            </button>
          )}
        </form>
      </div>

      {loading && (
        <div style={{ padding: 24, color: COLORS.muted, textAlign: "center" }}>Carregando...</div>
      )}

      {error && (
        <div
          style={{
            border: `1px solid ${COLORS.redBorder}`,
            borderRadius: 16,
            background: COLORS.redSoft,
            padding: 16,
            color: COLORS.text,
          }}
        >
          <div style={{ fontWeight: 700 }}>Não foi possível carregar</div>
          <div style={{ marginTop: 4, fontSize: 13, color: COLORS.muted }}>{error}</div>
        </div>
      )}

      {!loading && !error && people.length === 0 && (
        <div style={{ padding: 24, color: COLORS.muted, textAlign: "center" }}>
          {searchApplied ? `Nenhum resultado para "${searchApplied}".` : `Nenhum ${role === "user" ? "aluno" : role} cadastrado ainda.`}
        </div>
      )}

      {!loading && !error && people.length > 0 && (
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) 80px",
              gap: 8,
              padding: "10px 18px",
              borderBottom: `1px solid ${COLORS.border}`,
              color: COLORS.muted,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            <div>Nome</div>
            <div>E-mail</div>
            <div>Plano</div>
            <div>Cadastro</div>
            <div />
          </div>

          {people.map((person, idx) => (
            <div
              key={person.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) 80px",
                gap: 8,
                padding: "13px 18px",
                borderBottom: idx < people.length - 1 ? `1px solid ${COLORS.border}` : undefined,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {person.name || "—"}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {person.email}
              </div>
              <div style={{ fontSize: 13 }}>
                {person.subscription_tier ?? <span style={{ color: COLORS.muted }}>—</span>}
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted }}>{formatDate(person.created_at)}</div>
              <div>
                <Link
                  to={`${detailBasePath}/${person.id}`}
                  style={{
                    display: "inline-flex",
                    padding: "7px 10px",
                    borderRadius: 10,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    color: COLORS.text,
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  Abrir
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            {showingFrom}–{showingTo} de {total}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                color: page === 0 ? COLORS.muted : COLORS.text,
                fontWeight: 600,
                cursor: page === 0 ? "default" : "pointer",
                fontSize: 13,
              }}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                color: page >= totalPages - 1 ? COLORS.muted : COLORS.text,
                fontWeight: 600,
                cursor: page >= totalPages - 1 ? "default" : "pointer",
                fontSize: 13,
              }}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
