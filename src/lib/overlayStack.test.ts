import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __limparOverlays, fecharTopo, overlaysAbertos, registrarOverlay,
} from "./overlayStack";

beforeEach(() => __limparOverlays());

describe("pilha de overlays — o back do Android precisa de certeza, não de palpite", () => {
  it("sem overlay, fecharTopo devolve false — e é esse false que libera a navegação", () => {
    expect(fecharTopo()).toBe(false);
  });

  it("fecha o do topo e devolve true", () => {
    const fechar = vi.fn();
    registrarOverlay(fechar);
    expect(fecharTopo()).toBe(true);
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it("LIFO: com uma confirmação sobre uma folha, o back fecha a confirmação", () => {
    const folha = vi.fn();
    const confirmacao = vi.fn();
    registrarOverlay(folha);
    registrarOverlay(confirmacao);
    fecharTopo();
    expect(confirmacao).toHaveBeenCalled();
    expect(folha).not.toHaveBeenCalled();
  });

  it("desmontar remove da pilha, mesmo fora de ordem", () => {
    const a = vi.fn(), bb = vi.fn();
    const removerA = registrarOverlay(a);
    registrarOverlay(bb);
    removerA(); // o de baixo saiu primeiro (rota trocou, por exemplo)
    expect(overlaysAbertos()).toBe(1);
    fecharTopo();
    expect(bb).toHaveBeenCalled();
    expect(a).not.toHaveBeenCalled();
  });

  it("remover duas vezes não quebra nem apaga o overlay de outro", () => {
    const a = vi.fn();
    const remover = registrarOverlay(a);
    remover();
    remover();
    expect(overlaysAbertos()).toBe(0);
  });

  it("o defeito original: overlay que só existe no DOM não conta como fechável", () => {
    // Antes, qualquer `[role=dialog]` fazia o back devolver `true` e engolir o
    // gesto. Aqui só conta quem se registrou de fato.
    document.body.innerHTML = '<div role="dialog">um diálogo que não escuta nada</div>';
    expect(fecharTopo()).toBe(false);
    document.body.innerHTML = "";
  });
});
