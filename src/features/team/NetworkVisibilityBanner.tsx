import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyNetworkProfile, type NetworkProfile } from "../../services/professionalNetworkApi";

/**
 * Avisa o profissional quando ele NÃO está visível na busca do aluno.
 *
 * Existe porque publicar o perfil é ato exclusivo do profissional — o admin não
 * consegue publicar por ele (`reviewNetworkProfile` dá 404 sem perfil). Sem esse
 * aviso, um personal cadastrado e com produto ativo simplesmente não aparecia na
 * curadoria e ninguém no time descobria: o aluno via lista vazia e desistia.
 *
 * Espelha os predicados de `listAvailableProfessionals` no backend.
 */
export function NetworkVisibilityBanner({ role }: { role: "personal" | "nutri" }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<NetworkProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getMyNetworkProfile()
      .then((p) => { if (active) setProfile(p); })
      .catch(() => { if (active) setProfile(null); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  if (!loaded) return null;

  const visible =
    profile !== null &&
    profile.publicationStatus === "approved" &&
    profile.credentialStatus === "approved" &&
    profile.adminEnabled &&
    ["available", "limited"].includes(profile.availabilityStatus);

  if (visible) return null;

  const { title, description } = describe(profile);

  return (
    <div
      className="net-visibility-banner"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 14px",
        borderRadius: 10,
        background: "rgba(251,191,36,0.08)",
        border: "1px solid rgba(251,191,36,0.3)",
        marginTop: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2, lineHeight: 1.45 }}>
          {description}
        </div>
      </div>
      <button
        type="button"
        className="pp-btn pp-btn--sm"
        onClick={() => navigate(`/app/${role}/meu-perfil`)}
        /* `.pp-btn { flex: 1 1 auto }` (≤720px) fazia este botão crescer e
           espremer o texto para ~180px em 360 — o título quebrava em quatro
           linhas de uma palavra. */
        style={{ whiteSpace: "nowrap", flex: "0 0 auto" }}
      >
        {profile ? "Revisar perfil" : "Criar perfil"}
      </button>
    </div>
  );
}

function describe(profile: NetworkProfile | null): { title: string; description: string } {
  if (!profile) {
    return {
      title: "Alunos ainda não conseguem te encontrar",
      description: "Você não tem perfil na Rede de Profissionais. Crie e publique o seu para aparecer na busca do aluno.",
    };
  }
  if (profile.availabilityStatus === "unavailable") {
    return {
      title: "Você está marcado como sem vagas",
      description: "Enquanto a disponibilidade estiver em “sem vagas”, seu perfil não aparece na busca do aluno.",
    };
  }
  if (profile.credentialStatus === "rejected" || !profile.adminEnabled) {
    return {
      title: "Seu perfil está desabilitado na Rede",
      description: "A credencial não está aprovada. Revise o registro profissional e reenvie para conferência.",
    };
  }
  return {
    title: "Seu perfil não está publicado",
    description: "Ele está salvo, mas não aparece na busca do aluno até você publicar.",
  };
}
