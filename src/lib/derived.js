// Thin pass-through over the server's answer. There used to be client-side
// full-text search, filtering, sorting and pagination here (over a
// synthetic in-memory dataset) plus a `computeStats` full-dataset
// aggregator. All of that violated the "no reimplemented business logic"
// mandate. The server (`Api/services/search_service.py` via `/api/search`)
// now does every one of those jobs; this module exists only so existing
// call sites have one clearly-named place to read the *current page of
// server results* and a duplicate-count index built from what's on screen
// (never from a synthetic "whole dataset").
import { useMemo } from 'react';
import { adaptSearchResult } from './domain';
import { useSearchStore } from '../store/useSearchStore';

/** The current page of adapted records, exactly as the server returned them. */
export function useResults() {
  const results = useSearchStore((s) => s.results);
  return useMemo(() => results.map(adaptSearchResult), [results]);
}

/**
 * Hash -> count map, built only from the records currently on screen (never
 * a full-dataset scan). Used purely for a "N copies visible on this page"
 * badge; the authoritative duplicate-detection view is
 * `useSearchStore.hashGroups`, sourced from `/api/dashboard/similar-files`.
 */
export function useVisibleHashIndex(rows) {
  return useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (!r.hash) return;
      if (!map.has(r.hash)) map.set(r.hash, []);
      map.get(r.hash).push(r.id);
    });
    return map;
  }, [rows]);
}
