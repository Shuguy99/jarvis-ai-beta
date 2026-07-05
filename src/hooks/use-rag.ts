/**
 * useRAG — React hook for client-side RAG (IndexedDB + TF-IDF)
 *
 * Provides document management, search, and stats for the
 * browser-local retrieval-augmented generation system.
 */

import { useState, useCallback, useEffect } from "react";
import {
  addDocument,
  removeDocument as removeDoc,
  getDocuments,
  searchChunks,
  getChunkCount,
  getDBSize,
  type RAGDocument,
  type SearchResult,
} from "@/lib/rag-store";

export interface RAGStats {
  documentCount: number;
  totalChunks: number;
  dbSize: number;
}

export interface UseRAGReturn {
  documents: RAGDocument[];
  uploadDocument: (file: File) => Promise<RAGDocument | null>;
  removeDocument: (docId: string) => Promise<void>;
  searchQuery: (query: string, topK?: number) => Promise<SearchResult[]>;
  searchResults: SearchResult[];
  isUploading: boolean;
  isSearching: boolean;
  stats: RAGStats;
  refresh: () => Promise<void>;
}

const EMPTY_STATS: RAGStats = { documentCount: 0, totalChunks: 0, dbSize: 0 };

const ACCEPTED_EXTENSIONS = /\.(txt|md|markdown|json|csv|xml|yaml|yml|ts|tsx|js|py|rs|go)$/i;

export function useRAG(): UseRAGReturn {
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [stats, setStats] = useState<RAGStats>(EMPTY_STATS);

  const refreshStats = useCallback(async () => {
    try {
      const [documentCount, totalChunks, dbSize] = await Promise.all([
        getDocuments().then((d) => d.length),
        getChunkCount(),
        getDBSize(),
      ]);
      setStats({ documentCount, totalChunks, dbSize });
    } catch {
      // IndexedDB not available (SSR, etc.)
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
      void refreshStats();
    } catch {
      // IndexedDB not available
    }
  }, [refreshStats]);

  // Load on mount
  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const uploadDocument = useCallback(
    async (file: File): Promise<RAGDocument | null> => {
      // Validate extension
      if (!ACCEPTED_EXTENSIONS.test(file.name) && !file.type.startsWith("text/")) {
        // PDF: noted as future enhancement, skip for now
        return null;
      }

      setIsUploading(true);
      try {
        const text = await file.text();
        if (text.trim().length < 10) return null;

        const doc = await addDocument(file.name, text, file.type || "text/plain", file.size);
        void loadDocuments();
        return doc;
      } catch {
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [loadDocuments],
  );

  const removeDocumentHandler = useCallback(
    async (docId: string) => {
      try {
        await removeDoc(docId);
        void loadDocuments();
      } catch {
        // ignore
      }
    },
    [loadDocuments],
  );

  const searchQueryHandler = useCallback(
    async (query: string, topK = 5): Promise<SearchResult[]> => {
      if (!query.trim()) return [];
      setIsSearching(true);
      try {
        const results = await searchChunks(query, topK);
        setSearchResults(results);
        return results;
      } catch {
        return [];
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  return {
    documents,
    uploadDocument,
    removeDocument: removeDocumentHandler,
    searchQuery: searchQueryHandler,
    searchResults,
    isUploading,
    isSearching,
    stats,
    refresh: loadDocuments,
  };
}