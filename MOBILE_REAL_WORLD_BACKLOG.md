# MOBILE_REAL_WORLD_BACKLOG — achados de uso real

**Criado em:** 03 set 2026, no fechamento da trilha (§17).
**Propósito:** receber o que o QA em aparelho real encontrar. **Está vazio de propósito** —
nenhum uso real aconteceu ainda.

## Como usar

Cada achado entra como um item com severidade. **Nada aqui é implementado automaticamente**
(§17/§18): apenas **BLOCKER**, **P0** e **regressões** são corrigidos direto; P1 e P2 passam
por avaliação antes.

| Severidade | Critério |
|---|---|
| **BLOCKER** | Impede o uso. O treino não acontece, o app fecha, o dado se perde |
| **P0** | Problema grave. Funciona, mas machuca — ação principal inacessível, dado errado na tela |
| **P1** | Atrito real de UX. Custa toques, exige precisão, confunde |
| **P2** | Melhoria desejável |
| **FUTURE** | Ideia de produto surgida do uso |

Modelo de item:

```
### [SEVERIDADE] Título curto
**Aparelho:** Pixel 7 / Android 14
**Cenário:** §11 academia · §12 compartilhamento · §13 uma mão · §14 interrupções · §15 rede · §16 crash
**O que aconteceu:** …
**Esperado:** …
**Reproduz sempre?** …
```

---

## Cenários a executar

Da SPEC de fechamento. Nenhum foi executado — os quatro exigem aparelho físico.

### §11 · Academia, treino completo
Quantos toques · botões acessíveis · texto legível · timer · alterar carga · substituir
exercício · treino livre · rede ruim · perda de estado.

### §12 · Compartilhamento
Tirar foto · foto de fundo · gerar card · Story/Feed · Instagram e WhatsApp · salvar.
Observar crop, legibilidade, velocidade, qualidade, permissões.

### §13 · Uma mão
Registrar qualquer ação que exija precisão excessiva, esteja muito no topo, tenha botão
pequeno ou exija vários passos.

> A medição em navegador diz que a ação principal ("CONCLUIR SÉRIE") fica na zona do polegar
> nos 6 viewports, com 44px nos steppers. **Isso é geometria, não ergonomia** — só a mão
> confirma.

### §14 · Interrupções
Bloquear tela · WhatsApp · notificação · chamada · minimizar · retornar.

> Verificado em navegador (visibilitychange e recarga total). **Chamada telefônica e pressão
> de memória do sistema não têm equivalente ali.**

### §15 · Rede
Iniciar conectado · desligar dados · registrar séries · finalizar · restaurar.

> Verificado com a API bloqueada no navegador. Falta o comportamento real de rede móvel
> instável — que é diferente de rede ausente.

### §16 · Crash / restart
Iniciar · registrar · encerrar app · reabrir.

> Verificado com contexto novo sobre o mesmo storage. Falta o `am kill` de verdade e a morte
> por pressão de memória.

---

## Achados

*(vazio — nenhum uso real ainda)*

---

## O que já sabemos que vai aparecer

Não são achados, são **hipóteses** do fechamento. Registradas para não serem confundidas com
descobertas quando aparecerem:

- **Tracking com a tela apagada não funciona.** Limitação da camada web, não bug. Vai aparecer
  como "a corrida parou sozinha".
- **Notificação de descanso pode atrasar alguns minutos** em Doze profundo. Escolha
  consciente: alarme exato exigiria permissão que a Play reserva a apps de relógio.
- **Faixa atrás das barras do sistema** pode destoar no tema escuro (Android 15+).
- **Primeiro treino de um grupo mostra "0%" de recuperação** no Readiness — se ele estiver
  ligado para o testador.
