import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "../../shared/types";
import { api } from "../lib/api";

type SearchBoxProps = {
  onOpenPath: (path: string) => void;
};

export function SearchBox({ onOpenPath }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      requestIdRef.current += 1;
      setResults([]);
      setLoading(false);
      setError(undefined);
      return;
    }

    const timer = window.setTimeout(async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoading(true);
      setError(undefined);
      try {
        const nextResults = await api.search(trimmed);
        if (requestIdRef.current === requestId) {
          setResults(nextResults);
        }
      } catch (searchError) {
        if (requestIdRef.current === requestId) {
          setError(searchError instanceof Error ? searchError.message : "搜索失败");
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="search-box">
      <label className="search-box__label" htmlFor="note-search">
        全局搜索
      </label>
      <input
        id="note-search"
        className="search-box__input"
        type="search"
        placeholder="搜索目录、文件名或标题"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="search-box__panel">
        {loading ? <p className="search-box__hint">正在搜索...</p> : null}
        {error ? <p className="search-box__error">{error}</p> : null}
        {!loading && !error && query.trim() && results.length === 0 ? (
          <p className="search-box__hint">没有找到匹配结果</p>
        ) : null}
        {results.map((result) => (
          <button
            key={`${result.type}:${result.path}`}
            className="search-box__result"
            type="button"
            onClick={() => {
              onOpenPath(result.path);
              setQuery("");
            }}
          >
            <span className="search-box__result-title">{result.title}</span>
            <span className="search-box__result-meta">
              {result.type === "directory" ? "目录" : "文件"} · {result.path}
            </span>
            {result.snippet ? <span className="search-box__result-snippet">{result.snippet}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
