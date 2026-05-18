type Props = {
  count?: number;
};

export function ProtocolUsageBadge({ count = 0 }: Props) {
  const label = count > 0 ? `${count} aluno${count === 1 ? "" : "s"} usando` : "Sem uso atual";
  return <span className={`protocolUsageBadge ${count > 0 ? "protocolUsageBadge--active" : ""}`}>{label}</span>;
}
