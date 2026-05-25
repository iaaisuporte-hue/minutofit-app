# Plano Técnico MVP — Rede de Profissionais

## Resumo

Implementar a Rede de Profissionais como uma experiência premium, curada e orientada a acompanhamento metabólico, sem checkout, comissão, ranking público ou aparência de marketplace. O MVP usa solicitação/aprovação de vínculo, credenciais profissionais validadas manualmente, consentimento explícito do usuário e isolamento multi-tenant.

## Fase 0 — Research

- Modelos existentes reutilizados: `users`, `student_professional_requests`, `personal_student_assignments`, `nutri_patient_assignments`, `user_data_consents`, `data_access_audit`, academias/tenants e roles de academia.
- Fluxos existentes reutilizados: `connectionRequestService`, rotas `/api/student/*`, aceite/rejeição/cancelamento/revogação e consentimento granular.
- Segurança existente reutilizada: `authMiddleware`, `roleCheckMiddleware`, `requireProduct`, `tenantContextMiddleware`, `requireTenantPermission`, `adminMiddleware`.
- Design system reutilizado: `COLORS`, cards compactos, modal/sheet, toast, estados vazios e página `MinhaEquipePage`.

## Fase 1 — Data Model e Contratos

- Criada migration `1790700000000_professional-network-mvp.js`.
- Nova tabela `professional_network_profiles` para perfil curado do profissional:
  - `professional_id`, `professional_role`, CREF/CRN em `credential_code`;
  - `credential_status`: `pending_review`, `approved`, `rejected`;
  - `publication_status`: `draft`, `pending_review`, `approved`, `disabled`;
  - `admin_enabled`, disponibilidade, especialidades, foco metabólico, modalidade, cidade/UF, bio e foto.
- Nova tabela `academy_professional_network_policies`:
  - `academy_id`, `mode`: `allow` ou `block`;
  - ausência de linha equivale a `block`;
  - atualização auditada.
- `student_professional_requests.requested_via` passa a aceitar `discovery`.
- Assignments existentes continuam sendo a fonte de vínculo ativo/revogado.
- Índices únicos parciais garantem 1 vínculo ativo por aluno e tipo de profissional.
- Fora do MVP: pagamento, checkout, comissão, ranking, avaliações públicas e ofertas comerciais.

## Fase 2 — Serviços e APIs

- Novo serviço `professionalNetworkService`:
  - lista profissionais elegíveis;
  - bloqueia rede quando academia está em `block`;
  - gerencia perfil próprio do profissional;
  - gerencia revisão manual/admin;
  - gerencia política de academia.
- `connectionRequestService` atualizado para:
  - aceitar `requested_via = discovery`;
  - validar profissional existente e role correta;
  - bloquear profissional indisponível/reprovado/desabilitado quando origem é Rede;
  - impedir solicitação quando já existe vínculo ativo do mesmo tipo;
  - auditar origem da solicitação.
- APIs implementadas:
  - `GET /api/student/professional-network`;
  - `GET /api/student/professional-network/:professionalId`;
  - `POST /api/student/professional-requests` com `requestedVia: discovery`;
  - `GET /api/professional/network-profile`;
  - `PUT /api/professional/network-profile`;
  - `POST /api/professional/network-profile/submit-review`;
  - `PATCH /api/admin/professionals/:professionalId/network-review`;
  - `GET /api/academy/professional-network-policy`;
  - `PUT /api/academy/professional-network-policy`.

## Fase 3 — UI Premium

- `AddProfessionalSheet` agora abre com a Rede de Profissionais curada.
- A busca por e-mail/código permanece como caminho secundário.
- Cards exibem nome, tipo, credencial validada, modalidade, cidade/UF e foco metabólico.
- Modal de confirmação enfatiza consentimento, escopos de dados e revogação posterior.
- Estados vazios cobertos: sem profissionais validados, rede bloqueada pela academia, erro de carregamento, vínculo ativo conflitante e profissional indisponível.
- Linguagem evita marketplace: sem preço, checkout, estrelas, ranking ou CTA comercial.

## Fase 4 — Segurança, QA e Documentação

- Segurança implementada:
  - política de academia padrão `block`;
  - política só alterada com `academy.professionals.write` no tenant ativo;
  - admin MetaCore valida publicação/credencial;
  - profissional edita apenas seu próprio perfil;
  - dados sensíveis continuam protegidos por consentimentos existentes;
  - revogação continua encerrando acesso via fluxo existente.
- Checks executados:
  - `npm run build` em `minutofit-backend`;
  - `npx tsc --noEmit` em `minutofit-app`.

## Assunções Fechadas

- O MVP começa sem monetização transacional.
- Profissionais só aparecem após `credential_status = approved`, `publication_status = approved` e `admin_enabled = true`.
- CREF/CRN são obrigatórios no perfil profissional e validados manualmente por admin.
- Política padrão de academia ausente é bloqueio.
- Mudanças de política não afetam vínculos antigos automaticamente.
- Nome interno/externo: Rede de Profissionais ou Profissionais de Acompanhamento.
- A implementação segue MaaS, multitenancy, consentimento, auditoria e experiência premium da constitution.
