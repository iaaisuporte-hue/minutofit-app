import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addStudentDirect,
  fetchPlans,
  inviteStudent,
  type AcademyPlan,
} from "../../../services/academyApi";

interface FormState {
  mode: "direct" | "invite";
  name: string;
  email: string;
  cpf: string;
  phone: string;
  birthDate: string;
  planId: string;
  paymentMethod: string;
  medicalRestrictions: string;
  acceptedTerms: boolean;
  acceptedLgpd: boolean;
  giveAppBonus: boolean;
}

const DEFAULT_FORM: FormState = {
  mode: "direct",
  name: "",
  email: "",
  cpf: "",
  phone: "",
  birthDate: "",
  planId: "",
  paymentMethod: "",
  medicalRestrictions: "",
  acceptedTerms: false,
  acceptedLgpd: false,
  giveAppBonus: true,
};

export default function RecepcaoNovoAlunoPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<AcademyPlan[]>([]);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ tempPassword?: string; inviteUrl?: string } | null>(null);

  useEffect(() => {
    fetchPlans().then(setPlans).catch((err: unknown) => {
      console.warn('[recepcao] fetchPlans failed', err);
    });
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (form.mode === "direct" && (!form.acceptedTerms || !form.acceptedLgpd)) {
      setError("Termos e LGPD são obrigatórios para cadastro direto.");
      return;
    }

    setLoading(true);
    try {
      if (form.mode === "invite") {
        const response = await inviteStudent({ email: form.email });
        setResult({ inviteUrl: response.inviteUrl });
      } else {
        const response = await addStudentDirect({
          name: form.name,
          email: form.email,
          cpf: form.cpf || undefined,
          phone: form.phone || undefined,
          birthDate: form.birthDate || undefined,
          planId: form.planId ? Number(form.planId) : undefined,
          paymentMethod: form.paymentMethod || undefined,
          medicalRestrictions: form.medicalRestrictions || undefined,
          acceptedTerms: form.acceptedTerms,
          acceptedLgpd: form.acceptedLgpd,
          giveAppBonus: form.giveAppBonus,
        });
        setResult({ tempPassword: response.tempPassword });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">Recepção</div>
          <h1 className="page-title">Cadastro rápido</h1>
          <p className="dash-hero-meta">Fluxo em três passos para não travar o balcão.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate("/app/academy/recepcao")}>Voltar</button>
      </div>

      <div className="section-card">
        <div className="mode-toggle">
          <button
            className={`mode-toggle__btn${form.mode === "direct" ? " mode-toggle__btn--active" : ""}`}
            onClick={() => setField("mode", "direct")}
            type="button"
          >
            Cadastro direto
          </button>
          <button
            className={`mode-toggle__btn${form.mode === "invite" ? " mode-toggle__btn--active" : ""}`}
            onClick={() => setField("mode", "invite")}
            type="button"
          >
            Enviar convite
          </button>
        </div>

        {result ? (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div className="banner-success">
              {result.tempPassword ? "Aluno cadastrado com sucesso." : "Convite gerado com sucesso."}
            </div>
            {result.tempPassword && (
              <input className="input" readOnly value={`Senha temporária: ${result.tempPassword}`} />
            )}
            {result.inviteUrl && (
              <input className="input" readOnly value={result.inviteUrl} />
            )}
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button className="btn btn-primary" onClick={() => { setForm(DEFAULT_FORM); setResult(null); setStep(1); }}>
                Novo cadastro
              </button>
              <button className="btn btn-ghost" onClick={() => navigate("/app/academy/recepcao/checkin")}>
                Ir para check-in
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="form-grid">
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {["Identidade", "Plano", "Aceites"].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`btn btn-sm ${step === index + 1 ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setStep(index + 1)}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </div>

            {form.mode === "invite" ? (
              <div className="field">
                <label className="label">E-mail do aluno</label>
                <input className="input" type="email" required value={form.email} onChange={(event) => setField("email", event.target.value)} />
                <span className="field-hint">O aluno preenche dados e senha pelo link seguro.</span>
              </div>
            ) : (
              <>
                {step === 1 && (
                  <div className="form-grid">
                    <div className="field">
                      <label className="label">Nome completo</label>
                      <input className="input" required value={form.name} onChange={(event) => setField("name", event.target.value)} />
                    </div>
                    <div className="form-grid form-grid--2col">
                      <div className="field">
                        <label className="label">CPF</label>
                        <input className="input" value={form.cpf} onChange={(event) => setField("cpf", event.target.value)} />
                      </div>
                      <div className="field">
                        <label className="label">Nascimento</label>
                        <input className="input" type="date" value={form.birthDate} onChange={(event) => setField("birthDate", event.target.value)} />
                      </div>
                    </div>
                    <div className="form-grid form-grid--2col">
                      <div className="field">
                        <label className="label">Telefone</label>
                        <input className="input" value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
                      </div>
                      <div className="field">
                        <label className="label">E-mail</label>
                        <input className="input" type="email" required value={form.email} onChange={(event) => setField("email", event.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="form-grid">
                    <div className="field">
                      <label className="label">Plano contratado</label>
                      <select className="input" value={form.planId} onChange={(event) => setField("planId", event.target.value)}>
                        <option value="">Sem plano agora</option>
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} — R$ {Number(plan.monthlyPrice).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label">Forma de pagamento</label>
                      <select className="input" value={form.paymentMethod} onChange={(event) => setField("paymentMethod", event.target.value)}>
                        <option value="">Selecionar</option>
                        <option value="pix_monthly">PIX mensal</option>
                        <option value="cash_monthly">Dinheiro mensal</option>
                        <option value="card_monthly">Cartão mensal</option>
                        <option value="bank_slip">Boleto</option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="label">Restrições médicas</label>
                      <textarea className="input" rows={3} value={form.medicalRestrictions} onChange={(event) => setField("medicalRestrictions", event.target.value)} />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="form-grid">
                    <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                      <input type="checkbox" checked={form.acceptedTerms} onChange={(event) => setField("acceptedTerms", event.target.checked)} />
                      <span className="small">Aluno aceitou os Termos de Uso da academia.</span>
                    </label>
                    <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                      <input type="checkbox" checked={form.acceptedLgpd} onChange={(event) => setField("acceptedLgpd", event.target.checked)} />
                      <span className="small">Aluno autorizou tratamento de dados conforme LGPD.</span>
                    </label>
                    <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                      <input type="checkbox" checked={form.giveAppBonus} onChange={(event) => setField("giveAppBonus", event.target.checked)} />
                      <span className="small">
                        Conceder acesso ao App CoreFit como bônus (recomendado). Se a academia cancelar o vínculo, o aluno mantém o App por 30 dias para optar pela assinatura standalone.
                      </span>
                    </label>
                  </div>
                )}
              </>
            )}

            {error && <p className="field-error">{error}</p>}

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              {form.mode === "direct" && step < 3 ? (
                <button type="button" className="btn btn-primary" onClick={() => setStep((current) => current + 1)}>
                  Próximo
                </button>
              ) : (
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? "Salvando..." : form.mode === "invite" ? "Enviar convite" : "Cadastrar aluno"}
                </button>
              )}
              {form.mode === "direct" && step > 1 && (
                <button type="button" className="btn btn-ghost" onClick={() => setStep((current) => current - 1)}>
                  Voltar
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
