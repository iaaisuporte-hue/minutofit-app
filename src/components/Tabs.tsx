import { useId, useRef, type KeyboardEvent } from "react";

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onSelect: (id: string) => void;
  /** Prefixo dos `id`/`aria-controls` gerados — default `useId()`. Informe um
   * valor estável se precisar referenciar o painel de outro componente. */
  idPrefix?: string;
}

/**
 * Navegação por abas ACESSÍVEL — primitivo global (SPEC 036).
 *
 * Substitui o padrão anterior de cada tela montar `role="tablist"` /
 * `role="tab"` / `aria-selected` à mão (era o que o Personal já fazia em
 * `StudentProfileModal`, e o que o Nutri não fazia — 8 botões sem nenhuma
 * semântica de aba). Aqui a semântica ARIA completa — incluindo
 * `aria-controls`, `id` do painel e navegação por seta/Home/End do padrão
 * WAI-ARIA de tablist — vem de graça para quem usa o componente, em vez de
 * ser reimplementada (ou esquecida) tela a tela.
 *
 * O painel correspondente deve usar `tabPanelProps(tabs, id)` para o
 * `id`/`role`/`aria-labelledby` baterem com o botão.
 */
export function Tabs({ tabs, active, onSelect, idPrefix }: TabsProps) {
  const autoId = useId();
  const prefix = idPrefix ?? autoId;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const nextTab = tabs[nextIndex];
    onSelect(nextTab.id);
    refs.current[nextTab.id]?.focus();
  }

  return (
    <div className="tabs" role="tablist">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[t.id] = el; }}
          type="button"
          role="tab"
          id={`${prefix}-tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`${prefix}-panel-${t.id}`}
          tabIndex={active === t.id ? 0 : -1}
          className="tab"
          onClick={() => onSelect(t.id)}
          onKeyDown={(e) => handleKeyDown(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Props do painel associado a uma aba — usar em conjunto com `<Tabs idPrefix=.../>`. */
export function tabPanelProps(idPrefix: string, tabId: string) {
  return {
    id: `${idPrefix}-panel-${tabId}`,
    role: "tabpanel" as const,
    "aria-labelledby": `${idPrefix}-tab-${tabId}`,
    tabIndex: 0,
  };
}
