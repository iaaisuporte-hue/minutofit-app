import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAdminUserById, type AdminUserRow } from "../../services/adminApi";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
  redSoft: "rgba(255,110,110,.10)",
  redBorder: "rgba(255,110,110,.28)",
};

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function AdminUserDetailsPage() {
  const { userId } = useParams();
  const [user, setUser] = useState<AdminUserRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setUser(null);
        return;
      }
      setError(null);
      setUser(undefined);
      try {
        const data = await fetchAdminUserById(userId);
        if (!cancelled) setUser(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar.");
          setUser(null);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (user === undefined && !error) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 18, fontWeight: 1000 }}>Carregando aluno...</div>
        <div style={{ color: COLORS.muted }}>Buscando dados no servidor.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div
          style={{
            border: `1px solid ${COLORS.redBorder}`,
            borderRadius: 16,
            background: COLORS.redSoft,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 1000 }}>{error}</div>
          <Link to="/app/admin/users" style={{ color: "#7CFF6B", marginTop: 8, display: "inline-block" }}>
            Voltar para alunos
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 24, fontWeight: 1000 }}>Aluno não encontrado</div>
        <Link to="/app/admin/users" style={{ color: "#7CFF6B" }}>
          Voltar para alunos
        </Link>
      </div>
    );
  }

  const profileOk = user.profile_completed;

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <Link to="/app/admin/users" style={{ color: "#7CFF6B", textDecoration: "none", fontWeight: 900, width: "fit-content" }}>
          ← Voltar para alunos
        </Link>
        <div style={{ fontSize: 30, fontWeight: 1000 }}>{user.name || "Sem nome"}</div>
        <div style={{ color: COLORS.muted }}>{user.email}</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {[
          { label: "Plano ativo", value: user.subscription_tier ?? "Sem assinatura ativa" },
          { label: "Perfil", value: profileOk ? "Completo" : "Pendente" },
          { label: "Papel", value: user.role },
          { label: "Cadastro", value: formatDate(user.created_at) },
          { label: "ID", value: String(user.id) },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 18,
              background: COLORS.panel,
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 1000 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 14 }}>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 18px 44px rgba(0,0,0,.45)",
            padding: 18,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Leitura administrativa</div>
          <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
            Dados reais do cadastro e da assinatura ativa. Use esta visão para suporte, retenção e ajuste de plano quando o
            fluxo de gestão estiver disponível.
          </div>
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              padding: 14,
              lineHeight: 1.6,
            }}
          >
            {!profileOk
              ? "Perfil incompleto: o aluno pode precisar de lembrete para concluir dados essenciais."
              : user.subscription_tier
                ? "Aluno com assinatura ativa e perfil completo. Próximos passos: acompanhar engajamento e retenção."
                : "Sem assinatura ativa no momento. Verifique pagamento ou upgrade de plano."}
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 18px 44px rgba(0,0,0,.45)",
            padding: 18,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Próximas ações</div>
          {[
            "Revisar necessidade de completar perfil.",
            "Confirmar plano e cobrança no painel financeiro quando integrado.",
            "Usar ID do aluno para suporte e ajustes administrativos.",
          ].map((action) => (
            <div
              key={action}
              style={{
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                padding: 12,
                lineHeight: 1.5,
              }}
            >
              {action}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
