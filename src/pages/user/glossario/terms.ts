export type GlossaryTerm = {
  id: string;
  titulo: string;
  resumo: string;
  impacto: string;
};

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: "estado-metabolico",
    titulo: "Estado metabólico",
    resumo:
      "Uma leitura de quão ativo seu corpo está neste momento — considera sono, treino recente, alimentação e estresse.",
    impacto:
      "Quando está baixo, o app sugere recuperação ou treino leve. Quando está alto, sugere mais intensidade.",
  },
  {
    id: "score",
    titulo: "Score (pontuação)",
    resumo:
      "Número de 0 a 100 que representa seu estado metabólico atual. Não é uma nota — é uma bússola.",
    impacto:
      "Sobe quando você treina, dorme bem e mantém consistência. Cai com inatividade prolongada ou sono ruim.",
  },
  {
    id: "dormindo",
    titulo: "Estado: Dormindo",
    resumo:
      "Seu metabolismo está em repouso profundo — poucas atividades recentes, recovery baixo.",
    impacto: "Mesmo 10 minutos de movimento mudam esse estado. Comece leve.",
  },
  {
    id: "aquecendo",
    titulo: "Estado: Aquecendo",
    resumo:
      "Você está saindo do repouso. O corpo já responde ao estímulo, mas ainda está ganhando ritmo.",
    impacto:
      "Treino moderado hoje tem alto retorno — o score responde bem a esse estado.",
  },
  {
    id: "ativo",
    titulo: "Estado: Ativo",
    resumo: "Bom estado. Seu metabolismo está funcionando de forma consistente.",
    impacto:
      "Manter a atividade hoje pode elevar você para o estado Pico.",
  },
  {
    id: "pico",
    titulo: "Estado: Pico",
    resumo:
      "O estado mais produtivo do ciclo — sono, treino e alimentação estão alinhados.",
    impacto:
      "Aproveite para uma sessão de maior intensidade. É o melhor momento.",
  },
  {
    id: "checkin-metabolico",
    titulo: "Check-in metabólico",
    resumo:
      "Um registro rápido (peso, medidas ou como você está se sentindo) que alimenta a inteligência do app.",
    impacto:
      "Quanto mais check-ins, mais precisa fica a leitura do seu estado e mais personalizadas ficam as sugestões.",
  },
  {
    id: "rpe",
    titulo: "Esforço (RPE)",
    resumo:
      "Escala de 1 a 10 que indica a intensidade percebida do exercício. 1 = muito fácil, 10 = esforço máximo.",
    impacto:
      "Seu personal usa esse número para calibrar a carga sem precisar medir peso na hora.",
  },
  {
    id: "cadencia",
    titulo: "Ritmo (cadência)",
    resumo:
      "A velocidade de execução de cada repetição, geralmente expressa como segundos de descida / pausa / subida.",
    impacto:
      "Ritmo mais lento aumenta a tensão no músculo. Ritmo mais rápido desenvolve potência.",
  },
  {
    id: "pausa-descanso",
    titulo: "Pausa-descanso (Rest-pause)",
    resumo:
      "Técnica em que você faz algumas repetições, descansa 10–15 segundos e retoma a série sem trocar o peso.",
    impacto:
      "Permite fazer mais volume com cargas pesadas. Indicado para quem já tem experiência.",
  },
  {
    id: "drop-set",
    titulo: "Série em queda (Drop set)",
    resumo:
      "Você chega ao limite em uma carga, reduz o peso imediatamente e continua sem parar.",
    impacto:
      "Técnica avançada para fadiga muscular máxima. Só indicada quando prescrita pelo personal.",
  },
  {
    id: "bi-set",
    titulo: "Par-conjunto (Bi-set)",
    resumo:
      "Dois exercícios executados em sequência, sem descanso entre eles.",
    impacto:
      "Economiza tempo e aumenta intensidade. O par é escolhido pelo personal para não sobrecarregar o mesmo músculo.",
  },
  {
    id: "ficha",
    titulo: "Meu plano (ficha de treino)",
    resumo:
      "O plano de treino criado pelo seu personal trainer — com exercícios, séries, cargas e anotações específicas para você.",
    impacto:
      "Diferente de um treino genérico, a ficha é prescrita para o seu histórico, objetivo e limitações.",
  },
  {
    id: "streakstreak",
    titulo: "Sequência (streak)",
    resumo:
      "Quantos dias seguidos você registrou alguma atividade ou check-in no app.",
    impacto:
      "Manter a sequência alta é um dos fatores que mais impacta positivamente o score metabólico.",
  },
  {
    id: "espelho",
    titulo: "Espelho de movimento",
    resumo:
      "Recurso que usa a câmera do celular para analisar sua postura e técnica em tempo real durante exercícios.",
    impacto:
      "Ajuda a corrigir erros de execução antes que virem lesão. Não precisa de personal na frente.",
  },
];
