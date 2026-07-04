

import { useState, useDeferredValue } from "react";

/**
 * Deferred search hook — uses React 19 useDeferredValue
 * to keep typing responsive while search processes in background.
 */
export function useDeferredSearch() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return { query, setQuery, deferredQuery, isStale };
}