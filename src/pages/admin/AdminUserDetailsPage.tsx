import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchAdminUserById,
  changeUserSubscription,
  setUserPassword,
  fetchUserProducts,
  grantUserProduct,
  revokeUserProduct,
  deleteAdminUser,
  PRODUCT_KEYS,
  PRODUCT_LABELS,
  type AdminUserRow,
  type ProductKey,
  type UserProductEntry,
} from "../../services/adminApi";
import { getPlans, type PlanItem } from "../../services/featureApi";
import { COLORS } from "../../styles/colors";

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function ChangePlanModal({
  userId,
  currentTier,
  onClose,
  onSuccess,
}: {
  userId: string;
  currentTier: string | null;
  onClose: () => void;
  onSuccess: (tierName: string) => void;
}) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlans()
      .then((data) => setPlans(data))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await changeUserSubscription(userId, selectedId);
      const chosen = plans.find((p) => p.id === selectedId);
      onSuccess(chosen?.name ?? "Plano atualizado");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao alterar plano.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          padding: 22,
          width: "100%",
          maxWidth: 420,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Alterar plano</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 20, padding: 4 }}
          >
            ×
          </button>
        </div>

        {currentTier && (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            Plano atual: <b style={{ color: COLORS.text }}>{currentTier}</b>
          </div>
        )}

        {loading ? (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Carregando planos...</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedId(plan.id)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${selectedId === plan.id ? COLORS.borderStrong : COLORS.border}`,
                  background: selectedId === plan.id ? COLORS.primarySoft : COLORS.panelSoft,
                  color: COLORS.text,
                  cursor: "pointer",
                  fontWeight: selectedId === plan.id ? 700 : 400,
                }}
              >
                {plan.name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ borderRadius: 12, border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft, padding: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!selectedId || saving}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.borderStrong}`,
              background: !selectedId || saving ? COLORS.panelSoft : "#22C55E",
              color: !selectedId || saving ? COLORS.muted : "#FFFFFF",
              fontWeight: 700,
              cursor: !selectedId || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Salvando..." : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              color: COLORS.text,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function SetPasswordModal({
  userId,
  userName,
  userEmail,
  onClose,
  onSuccess,
}: {
  userId: string;
  userName: string | null;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const isValid = hasLength && hasUpper && hasSymbol;

  async function handleConfirm() {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setUserPassword(userId, password);
      setSuccess(true);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao definir senha.");
    } finally {
      setSaving(false);
    }
  }

  const displayName = userName ?? userEmail;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          padding: 22,
          width: "100%",
          maxWidth: 420,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Definir senha</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 20, padding: 4 }}
          >
            ×
          </button>
        </div>

        {success ? (
          <>
            <div
              style={{
                borderRadius: 12,
                border: `1px solid rgba(34,197,94,.4)`,
                background: "rgba(34,197,94,.08)",
                padding: 14,
                fontSize: 14,
                color: COLORS.text,
                lineHeight: 1.5,
              }}
            >
              Senha definida para <b>{displayName}</b>. Repasse com segurança ao aluno.
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                color: COLORS.text,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Fechar
            </button>
          </>
        ) : (
          <>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>
              Usuário: <b style={{ color: COLORS.text }}>{displayName}</b>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nova senha"
                  style={{
                    width: "100%",
                    padding: "10px 80px 10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    color: COLORS.text,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: COLORS.muted,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "2px 6px",
                  }}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                {[
                  { ok: hasLength, label: "Pelo menos 8 caracteres" },
                  { ok: hasUpper, label: "Uma letra maiuscula (A-Z)" },
                  { ok: hasSymbol, label: "Um simbolo (ex.: ! @ # %)" },
                ].map(({ ok, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: ok ? "#22C55E" : COLORS.border,
                        flexShrink: 0,
                        transition: "background .15s",
                      }}
                    />
                    <span style={{ color: ok ? "#22C55E" : COLORS.muted }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                padding: "10px 12px",
                fontSize: 12,
                color: COLORS.muted,
                lineHeight: 1.5,
              }}
            >
              Anote a senha antes de fechar — ela nao e exibida depois.
            </div>

            {error && (
              <div style={{ borderRadius: 12, border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft, padding: 12, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!isValid || saving}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: !isValid || saving ? COLORS.panelSoft : "#22C55E",
                  color: !isValid || saving ? COLORS.muted : "#FFFFFF",
                  fontWeight: 700,
                  cursor: !isValid || saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Salvando..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.panelSoft,
                  color: COLORS.text,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DeleteUserModal({
  userId,
  userName,
  userEmail,
  onClose,
  onDeleted,
}: {
  userId: string;
  userName: string | null;
  userEmail: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = userName ?? userEmail;
  const isConfirmed = confirmText === "EXCLUIR";

  async function handleDelete() {
    if (!isConfirmed || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAdminUser(userId);
      onDeleted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao excluir usuário.");
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose(); }}
    >
      <div
        style={{
          border: `1px solid ${COLORS.redBorder}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          padding: 22,
          width: "100%",
          maxWidth: 440,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#EF4444" }}>Excluir usuário</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 20, padding: 4 }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            borderRadius: 12,
            border: `1px solid ${COLORS.redBorder}`,
            background: COLORS.redSoft,
            padding: "12px 14px",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          Você está prestes a excluir <b>{displayName}</b> ({userEmail}). Esta ação é permanente.
          <br />
          Histórico relacional e dados comportamentais serão removidos. Fichas e registros de treino são preservados.
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, color: COLORS.muted }}>
            Digite <b style={{ color: COLORS.text, letterSpacing: 1 }}>EXCLUIR</b> para confirmar:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            disabled={deleting}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${isConfirmed ? COLORS.redBorder : COLORS.border}`,
              background: COLORS.panelSoft,
              color: COLORS.text,
              fontSize: 14,
              letterSpacing: 1,
            }}
          />
        </div>

        {error && (
          <div style={{ borderRadius: 10, border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft, padding: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!isConfirmed || deleting}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.redBorder}`,
              background: !isConfirmed || deleting ? COLORS.panelSoft : COLORS.redSoft,
              color: !isConfirmed || deleting ? COLORS.muted : "#EF4444",
              fontWeight: 700,
              cursor: !isConfirmed || deleting ? "not-allowed" : "pointer",
            }}
          >
            {deleting ? "Excluindo..." : "Excluir definitivamente"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              color: COLORS.text,
              fontWeight: 700,
              cursor: deleting ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUserDetailsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUserRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tierName, setTierName] = useState<string | null>(null);
  const [products, setProducts] = useState<UserProductEntry[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productActionKey, setProductActionKey] = useState<ProductKey | null>(null);
  const [productError, setProductError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) { setUser(null); return; }
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
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setProductsLoading(true);
    fetchUserProducts(userId)
      .then((d) => setProducts(d.allProducts))
      .catch(() => setProducts(PRODUCT_KEYS.map((key) => ({ key, active: false }))))
      .finally(() => setProductsLoading(false));
  }, [userId]);

  async function handleProductToggle(key: ProductKey, currentlyActive: boolean) {
    if (!userId || productActionKey) return;
    setProductActionKey(key);
    setProductError(null);
    try {
      if (currentlyActive) {
        await revokeUserProduct(userId, key);
      } else {
        await grantUserProduct(userId, key);
      }
      const updated = await fetchUserProducts(userId);
      setProducts(updated.allProducts);
    } catch (err: unknown) {
      setProductError(err instanceof Error ? err.message : "Falha ao atualizar produto.");
    } finally {
      setProductActionKey(null);
    }
  }

  if (user === undefined && !error) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Carregando aluno...</div>
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
          <div style={{ fontWeight: 700 }}>{error}</div>
          <Link to="/app/admin/users" style={{ color: "#22C55E", marginTop: 8, display: "inline-block" }}>
            Voltar para alunos
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>Aluno não encontrado</div>
        <Link to="/app/admin/users" style={{ color: "#22C55E" }}>
          Voltar para alunos
        </Link>
      </div>
    );
  }

  const profileOk = user.profile_completed;
  const currentTier = tierName ?? user.subscription_tier;

  return (
    <>
      {showChangePlan && userId && (
        <ChangePlanModal
          userId={userId}
          currentTier={currentTier}
          onClose={() => setShowChangePlan(false)}
          onSuccess={(name) => {
            setTierName(name);
            setShowChangePlan(false);
          }}
        />
      )}
      {showSetPassword && userId && user && (
        <SetPasswordModal
          userId={userId}
          userName={user.name ?? null}
          userEmail={user.email}
          onClose={() => setShowSetPassword(false)}
          onSuccess={() => setShowSetPassword(false)}
        />
      )}
      {showDeleteConfirm && userId && user && (
        <DeleteUserModal
          userId={userId}
          userName={user.name ?? null}
          userEmail={user.email}
          onClose={() => setShowDeleteConfirm(false)}
          onDeleted={() => navigate("/app/admin/users")}
        />
      )}

      <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
        <div
          style={{
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: 20,
            background: COLORS.panelDeep,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
            padding: 18,
            display: "grid",
            gap: 8,
          }}
        >
          <Link to="/app/admin/users" style={{ color: "#22C55E", textDecoration: "none", fontWeight: 600, width: "fit-content" }}>
            ← Voltar para alunos
          </Link>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{user.name || "Sem nome"}</div>
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
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
                padding: 16,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}

          {/* Plano com ação de alterar */}
          <div
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 18,
              background: COLORS.panel,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 12 }}>Plano ativo</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{currentTier ?? "Sem assinatura"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowChangePlan(true)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.panelSoft,
                  color: COLORS.text,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  width: "fit-content",
                }}
              >
                Alterar plano
              </button>
              <button
                type="button"
                onClick={() => setShowSetPassword(true)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.panelSoft,
                  color: COLORS.text,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  width: "fit-content",
                }}
              >
                Definir senha
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
            padding: 18,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>Contexto do aluno</div>
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              padding: 14,
              lineHeight: 1.6,
              color: COLORS.muted,
            }}
          >
            {!profileOk
              ? "Perfil incompleto — o aluno pode precisar de lembrete para concluir dados essenciais."
              : currentTier
                ? "Aluno com assinatura ativa e perfil completo. Acompanhe engajamento e retenção."
                : "Sem assinatura ativa. Verifique pagamento ou use 'Alterar plano' para ajustar manualmente."}
          </div>
        </div>

        {/* Produtos */}
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
            padding: 18,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Produtos</div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>Concedidos pelo CoreFit</div>
          </div>

          {productError && (
            <div style={{ borderRadius: 10, border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft, padding: 10, fontSize: 13, color: COLORS.text }}>
              {productError}
            </div>
          )}

          {productsLoading ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Carregando produtos...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {products.map(({ key, active }) => (
                <button
                  key={key}
                  type="button"
                  disabled={productActionKey !== null}
                  onClick={() => void handleProductToggle(key, active)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${active ? "#22C55E" : COLORS.border}`,
                    background: active ? "rgba(34,197,94,.12)" : COLORS.panelSoft,
                    color: active ? "#22C55E" : COLORS.muted,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: productActionKey ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: productActionKey === key ? 0.5 : 1,
                    transition: "all .15s",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#22C55E" : COLORS.border, flexShrink: 0 }} />
                  {PRODUCT_LABELS[key]}
                </button>
              ))}
            </div>
          )}

          <div style={{ color: COLORS.muted, fontSize: 12 }}>
            Clique para ativar ou desativar. Alterações têm efeito no próximo login do usuário.
          </div>
        </div>

        {/* Zona de risco */}
        <div
          style={{
            border: `1px solid ${COLORS.redBorder}`,
            borderRadius: 20,
            background: COLORS.panelDeep,
            padding: 18,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "#EF4444" }}>Zona de risco</div>
          <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
            Excluir remove permanentemente dados relacionais e comportamentais do usuário. Fichas de treino e revisões são preservadas.
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: `1px solid ${COLORS.redBorder}`,
              background: COLORS.redSoft,
              color: "#EF4444",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              width: "fit-content",
            }}
          >
            Excluir usuário
          </button>
        </div>
      </div>
    </>
  );
}
