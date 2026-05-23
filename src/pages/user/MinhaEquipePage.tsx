import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useProfessionalContext } from "../../features/professionalVoice";
import { MinhaEquipeSection, AcademyCard } from "../../features/team";
import { COLORS } from "../../styles/colors";

const ShieldIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default function MinhaEquipePage() {
  const { activeAcademyId, academies, branding } = useAuth();
  const {
    data: professionalContext,
    loading: professionalLoading,
    refetch: refetchProfessional,
  } = useProfessionalContext();

  const hasAcademy = !!activeAcademyId;
  const academyName =
    branding?.displayName ?? academies?.[0]?.displayName ?? undefined;

  return (
    <div style={{ maxWidth: 720, display: "grid", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "grid", gap: 4, paddingBottom: 4 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: COLORS.muted,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Minha Equipe MetaCore
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
          }}
        >
          Quem cuida do seu metabolismo
        </h1>
        <p
          style={{
            fontSize: 14,
            color: COLORS.muted,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Profissionais e academia que acompanham você no dia a dia. Você decide quem vê seus dados.
        </p>
      </div>

      {/* Profissionais (Personal + Nutri) */}
      <MinhaEquipeSection
        professionalContext={professionalContext}
        contextLoading={professionalLoading}
        hasAcademy={hasAcademy}
        academyName={academyName}
        onConnectionChanged={refetchProfessional}
        embedded
      />

      {/* Academia */}
      <AcademyCard
        academies={academies}
        activeAcademyId={activeAcademyId}
        branding={branding}
      />

      {/* Link trilha LGPD */}
      <Link
        to="/app/user/glossario#consent"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: COLORS.muted,
          textDecoration: "none",
          padding: "8px 4px",
        }}
      >
        <ShieldIcon />
        Suas escolhas de privacidade são registradas em uma trilha de auditoria.
      </Link>
    </div>
  );
}
