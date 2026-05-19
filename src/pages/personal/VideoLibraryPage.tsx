import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { fetchVideosSearch, type VideoSearchRow } from "../../services/videosSearchApi";
import "./personalPremium.css";

export default function VideoLibraryPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<VideoSearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchVideosSearch({ limit: 40, q: q.trim() || undefined });
      setRows(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar vídeos.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), q.trim() ? 220 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  return (
    <div className="pp-page">
      <section className="pp-panel">
        <div className="pp-panel__header">
          <div style={{ display: "grid", gap: 5 }}>
            <div className="pp-panel__title">Biblioteca de vídeos</div>
            <div className="pp-panel__subtitle">Catálogo institucional via API — pesquisa em tempo real.</div>
          </div>
        </div>
        <div className="pp-panel__body" style={{ display: "grid", gap: 14 }}>
          <input
            className="pp-input"
            placeholder="Buscar por título ou tag…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar vídeos"
          />
          {loading ? (
            <div style={{ color: "var(--color-text-tertiary)", fontSize: 14 }}>Carregando…</div>
          ) : null}
          {error ? (
            <EmptyState variant="warning" title="Não foi possível carregar" description={error} />
          ) : null}
          {!loading && !error && rows.length === 0 ? (
            <EmptyState variant="ok" title="Nenhum resultado" description="Ajuste o termo de busca ou tente outra palavra-chave." />
          ) : null}
          {!loading && !error && rows.length > 0 ? (
            <div className="pp-grid">
              {rows.map((v) => (
                <div key={v.id} className="pp-surface">
                  <div style={{ fontWeight: 650, fontSize: 15 }}>{v.title}</div>
                  {v.tags?.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {v.tags.slice(0, 4).map((t) => (
                        <span key={t} className="pp-meta-chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {v.url ? (
                    <a className="pp-btn pp-btn--ghost pp-btn--sm" href={v.url} target="_blank" rel="noreferrer">
                      Abrir vídeo
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
