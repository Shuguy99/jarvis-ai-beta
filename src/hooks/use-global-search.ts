

import { useState, useCallback, useRef } from "react";
import {
  search,
  addRecentSearch,
  getRecentSearches,
  clearRecentSearches,
  type SearchResult,
} from "@/lib/search-index";

export function useGlobalSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback((query: string, types?: string[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      setRecentSearches(getRecentSearches());
      return;
    }

    setIsSearching(true);

    timerRef.current = setTimeout(() => {
      const res = search(query, { types, limit: 25 });
      setResults(res);
      setIsSearching(false);
      addRecentSearch(query);
    }, 150);
  }, []);

  const clearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Load recent on first interaction
  const loadRecent = useCallback(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  return { results, isSearching, search: doSearch, recentSearches, clearRecent, loadRecent };
}