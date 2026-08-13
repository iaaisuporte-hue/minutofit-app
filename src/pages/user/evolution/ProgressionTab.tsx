import { ProgressionPanel } from '../../../features/performance/ProgressionPanel';

/**
 * Aba Progressão (Spec 033, P2).
 *
 * O conteúdo vive em `features/performance` porque a mesma leitura vai ser
 * reaproveitada pelo cockpit do personal na P5 — a aba é só o ponto de entrada.
 */
export default function ProgressionTab() {
  return <ProgressionPanel />;
}
