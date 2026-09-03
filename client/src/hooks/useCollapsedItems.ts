import { useCallback, useState } from 'react';

/**
 * Tracks which order items are collapsed, so long forms with many items
 * stay easy to navigate. Items are expanded by default; adding a new item
 * collapses the ones already filled in.
 */
export function useCollapsedItems() {
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);

  const isCollapsed = useCallback(
    (id: string) => collapsedIds.includes(id),
    [collapsedIds]
  );

  const toggle = useCallback((id: string) => {
    setCollapsedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const collapse = useCallback((ids: string[]) => {
    setCollapsedIds(prev => [...new Set([...prev, ...ids])]);
  }, []);

  const expand = useCallback((id: string) => {
    setCollapsedIds(prev => prev.filter(i => i !== id));
  }, []);

  const reset = useCallback(() => setCollapsedIds([]), []);

  return { isCollapsed, toggle, collapse, expand, reset };
}
