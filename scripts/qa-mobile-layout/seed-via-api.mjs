/**
 * Semeia o ambiente de QA da Onda 0 pelos CONTRATOS REAIS da API.
 *
 * Pressupõe o banco descartável já montado (seedDatabase → prepareTestDatabase →
 * seedExercisesLibrary) e os fixtures `qaDemoFixture --setup` e `qaNutriP1bFixture`.
 * Aqui só entra o que esses fixtures não cobrem e que muda o LAYOUT de verdade:
 *
 *  1. Triagem do aluno (PAR-Q + onboarding) por PATCH /auth/student-compliance —
 *     sem clearance o app trava o registro de treino e mostra "Assinar PAR-Q".
 *  2. Ficha com exercícios reais do catálogo, via API do personal (um UPDATE em
 *     payload_json produz ficha "indisponível" — ver memória qa-mobile-autenticado-local).
 *  3. Dados "de estresse" para o personal: e-mail de convite longo, acordo
 *     financeiro com cobrança vencida. Layout quebra com DADO, não só com viewport.
 *
 * ATENÇÃO: rode UMA vez por banco descartável — conversa, convites e observações se acumulam a cada execução.
 *
 * Uso:
 *   node scripts/qa-mobile-layout/seed-via-api.mjs --creds creds.json [--api http://localhost:3101/api]
 * creds.json: { student:{email,password,id}, personal:{...}, nutri:{...} }
 */
import { apiCall, apiLogin, assertLocalUrl, InfraError, readJson, solidPng } from './common.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const API = arg('api', process.env.QA_API ?? 'http://localhost:3101/api');
const CREDS_FILE = arg('creds', process.env.QA_CREDS_FILE);

async function main() {
  if (!CREDS_FILE) throw new InfraError('Informe --creds <arquivo.json> (ou QA_CREDS_FILE).');
  assertLocalUrl('API', API);
  const creds = readJson(CREDS_FILE);
  const log = (m) => console.log(`[seed] ${m}`);

  // 1. Triagem do aluno ------------------------------------------------------
  const studentToken = await apiLogin(API, creds.student);
  const signature = `data:image/png;base64,${solidPng(64, 24, [20, 20, 20]).toString('base64')}`;
  const compliance = await apiCall(API, '/auth/student-compliance', {
    method: 'PATCH',
    token: studentToken,
    body: {
      healthFlags: {
        sem_historico_hipertensao: true,
        sem_historico_cardiaco: true,
        sem_restricao_medica_exercicio: true,
        apto_para_atividade_fisica: true,
        aceita_responsabilidade_informacoes: true,
      },
      onboardingAnswers: {
        trainingPlace: 'gym',
        timePerDay: '30-45',
        injuries: ['none'],
        surgeryRecent: 'no',
        frequentPain: 'no',
        daysPerWeek: 4,
        bestTime: 'morning',
        intensityPref: 'progressive',
        equipmentPref: 'both',
        wantsCloseFollow: 'yes',
      },
      parqAnswers: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].map((id) => ({ id, yes: false })),
      parqSignatureDataUrl: signature,
    },
  });
  if (compliance.status !== 200) {
    throw new InfraError(`student-compliance HTTP ${compliance.status}: ${JSON.stringify(compliance.json)}`);
  }
  log('triagem do aluno concluída (PAR-Q sem "sim")');

  // 2. Ficha com exercícios reais ---------------------------------------------
  const personalToken = await apiLogin(API, creds.personal);
  const ex = await apiCall(API, '/exercises?limit=14', { token: personalToken });
  const exercises = ex.json?.exercises ?? [];
  if (exercises.length < 8) throw new InfraError(`Catálogo com ${exercises.length} exercícios; esperado >= 8.`);
  const item = (e, i) => ({
    exerciseId: e.id,
    name: e.name,
    sets: '4',
    reps: i % 2 ? '8-12' : '10',
    rest: '90',
    rpe: '8',
  });
  const days = [
    { name: 'Dia A', focus: 'Full body', items: exercises.slice(0, 5).map(item) },
    { name: 'Dia B', focus: 'Inferiores e core', items: exercises.slice(5, 9).map(item) },
  ];
  const plans = await apiCall(API, `/personal/students/${creds.student.id}/workout-plans`, { token: personalToken });
  const existing = (plans.json?.data ?? []).find((p) => p.title === 'Ficha QA Demo');
  const save = existing
    ? await apiCall(API, `/personal/students/${creds.student.id}/workout-plans/${existing.id}`, {
        method: 'PATCH',
        token: personalToken,
        body: { title: 'Ficha QA Demo', weekPreset: '1', days },
      })
    : await apiCall(API, `/personal/students/${creds.student.id}/workout-plans`, {
        method: 'POST',
        token: personalToken,
        body: { title: 'Ficha QA Demo', weekPreset: '1', days },
      });
  if (![200, 201].includes(save.status)) {
    throw new InfraError(`ficha HTTP ${save.status}: ${JSON.stringify(save.json)}`);
  }
  log(`ficha ${existing ? 'atualizada' : 'criada'} com ${days.map((d) => d.items.length).join('+')} exercícios`);

  // 3. Dados de estresse do personal ------------------------------------------
  const invite = await apiCall(API, '/personal/direct-invites', {
    method: 'POST',
    token: personalToken,
    body: {
      invitedEmail: 'aluna.com.nome.muito.longo.para.testar.quebra@dominio-corporativo-extenso.com.br',
      invitedName: 'Maria Aparecida de Souza Albuquerque Figueiredo Neto',
    },
  });
  log(`convite pendente com e-mail longo: HTTP ${invite.status}`);

  const startsOn = new Date(Date.now() - 45 * 86400_000).toISOString().slice(0, 10);
  const finance = await apiCall(API, `/personal/finance/students/${creds.student.id}/plan`, {
    method: 'POST',
    token: personalToken,
    body: { priceCents: 25000, period: 'monthly', dueDay: 5, paymentMethod: 'pix', startsOn, autoRenew: true },
  });
  log(`acordo financeiro com cobranças vencidas: HTTP ${finance.status} ${finance.status >= 400 ? JSON.stringify(finance.json) : ''}`);

  // 4. Conversa longa (rolagem do chat), observações longas (timeline) e uma revisão --------
  const conv = await apiCall(API, '/messages/conversations', { method: 'POST', token: personalToken, body: { studentId: creds.student.id } });
  const convId = conv.json?.data?.id;
  if (!convId) throw new InfraError(`conversa HTTP ${conv.status}: ${JSON.stringify(conv.json)}`);
  const lorem =
    'Combinado, vou ajustar a carga do supino na próxima semana e manter o volume das costas; se sentir qualquer desconforto no ombro, me avise antes do treino para trocarmos o exercício.';
  let sent = 0;
  for (let i = 0; i < 26; i++) {
    const fromPersonal = i % 2 === 0;
    const text = i % 5 === 0 ? lorem : `Mensagem de teste ${i + 1}: ${fromPersonal ? 'bom treino!' : 'ok, valeu'}`;
    const r = await apiCall(API, `/messages/conversations/${convId}/messages`, { method: 'POST', token: fromPersonal ? personalToken : studentToken, body: { text } });
    if (r.status === 201 || r.status === 200) sent++;
  }
  log(`conversa ${convId}: ${sent}/26 mensagens`);

  const obsTexts = [
    'Aluno relatou dificuldade em manter a frequência nos dias úteis; combinar treino curto de 30 minutos e reavaliar a rotina na próxima semana.',
    'Retorno gradual após viagem: reduzir volume em 30% nas duas primeiras sessões e observar a resposta do joelho direito.',
  ];
  for (const note of obsTexts) {
    await apiCall(API, `/personal/students/${creds.student.id}/actions`, { method: 'POST', token: personalToken, body: { actionType: 'observation', payloadJson: { note } } });
  }
  log('2 observações registradas');

  const planId = existing?.id ?? (save.json?.data?.id ?? null);
  const review = await apiCall(API, '/personal/reviews', {
    method: 'POST',
    token: personalToken,
    body: { studentId: creds.student.id, title: 'Revisão da ficha de hipertrofia com ajuste de volume para o aluno QA', goal: 'Hipertrofia', risk: 'medium', priority: 'high', workoutPlanId: planId, internalNotes: 'Verificar histórico de lesão no ombro antes de aprovar.' },
  });
  log(`revisão: HTTP ${review.status}`);

  // 5. Treino retroativo com título longo (histórico do aluno: pill "Registrado retroativamente") --
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const retro = await apiCall(API, '/training/sessions', {
    method: 'POST',
    token: studentToken,
    body: {
      source: 'free',
      status: 'completed',
      title: 'Treino de membros superiores com ênfase em ombros e tríceps realizado na academia do bairro',
      performedAt: yesterday,
      confirmedHonesty: true,
      awardGamification: false,
      sets: [{ name: exercises[0].name, exerciseId: exercises[0].id, setIndex: 1, repsDone: 10, loadDoneKg: 20, status: 'done' }],
    },
  });
  log(`treino retroativo: HTTP ${retro.status}`);

  log('pronto');
}

main().catch((err) => {
  console.error(`[seed] ${err.name}: ${err.message}`);
  process.exit(err instanceof InfraError ? 2 : 1);
});
