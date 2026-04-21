import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminUsers, type AdminUserRow } from "../../services/adminApi";
import { COLORS } from "../../styles/colors";

const PAGE_SIZE = 20;

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers({
        role: "user",
        search: searchApplied || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setUsers(data?.users ?? []);
      setTotal(data?.pagination?.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao carregar alunos.");
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, searchApplied]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setSearchApplied(searchDraft.trim());
  }

  const pageEnd = Math.min(offset + users.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

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
        <div style={{ fontSize: 28, fontWeight: 700 }}>Alunos</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 780 }}>
          Lista operacional com dados reais do servidor: plano ativo, perfil completo e cadastro. Use a busca e a paginação
          para navegar bases grandes.
        </div>

        <form
          onSubmit={handleSearchSubmit}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
        >
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar alunos"
            style={{
              flex: "1 1 220px",
              minWidth: 200,
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(8,14,11,.78)",
              color: COLORS.text,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "12px 18px",
              borderRadius: 14,
              border: `1px solid ${COLORS.borderStrong}`,
              background: "#22C55E",
              color: "#FFFFFF",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Buscar
          </button>
        </form>
      </div>

      {loading && (
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            padding: 18,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>Carregando alunos...</div>
          <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 13 }}>Consultando o banco de dados.</div>
        </div>
      )}

      {error && (
        <div
          style={{
            border: `1px solid ${COLORS.redBorder}`,
            borderRadius: 20,
            background: COLORS.redSoft,
            padding: 18,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>Não foi possível carregar a lista</div>
          <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 13 }}>{error}</div>
          <button
            type="button"
            onClick={() => void load()}
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${COLORS.redBorder}`,
              background: "#F9FAFB",
              color: COLORS.text,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            padding: 18,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>Nenhum aluno encontrado</div>
          <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 13 }}>
            Ajuste o termo de busca ou verifique se existem usuários com perfil &quot;aluno&quot; no sistema.
          </div>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              color: COLORS.muted,
              fontSize: 13,
            }}
          >
            <span>
              Mostrando {offset + 1}–{pageEnd} de {total}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: hasPrev ? COLORS.panelSoft : "transparent",
                  color: hasPrev ? COLORS.text : COLORS.muted,
                  fontWeight: 600,
                  cursor: hasPrev ? "pointer" : "not-allowed",
                }}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: hasNext ? COLORS.panelSoft : "transparent",
                  color: hasNext ? COLORS.text : COLORS.muted,
                  fontWeight: 600,
                  cursor: hasNext ? "pointer" : "not-allowed",
                }}
              >
                Próxima
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {users.map((student) => {
              const profileOk = student.profile_completed;
              return (
                <div
                  key={student.id}
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 20,
                    background: COLORS.panel,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
                    padding: 18,
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{student.name || "Sem nome"}</div>
                      <div style={{ color: COLORS.muted }}>{student.email}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <div
                        style={{
                          borderRadius: 999,
                          padding: "8px 12px",
                          border: `1px solid ${profileOk ? "rgba(34,197,94,.28)" : "rgba(255,200,80,.28)"}`,
                          background: profileOk ? "rgba(34,197,94,.14)" : "rgba(255,200,80,.14)",
                          color: profileOk ? "#22C55E" : "#FFD36C",
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        {profileOk ? "Perfil completo" : "Perfil pendente"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {[
                      { label: "Plano ativo", value: student.subscription_tier ?? "Sem assinatura ativa" },
                      { label: "Cadastro", value: formatDate(student.created_at) },
                      { label: "ID", value: String(student.id) },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          borderRadius: 16,
                          border: `1px solid ${COLORS.border}`,
                          background: COLORS.panelSoft,
                          padding: 12,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</div>
                        <div style={{ fontWeight: 600 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link
                      to={`/app/admin/users/${student.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: `1px solid ${COLORS.borderStrong}`,
                        background: "#22C55E",
                        color: "#FFFFFF",
                        fontWeight: 700,
                        textDecoration: "none",
                        width: "fit-content",
                      }}
                    >
                      Ver detalhe do aluno
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
