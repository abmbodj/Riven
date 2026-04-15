import { useState, useCallback, useEffect } from 'react';

/**
 * useSelection — manages bulk-select state for any library screen.
 * @param {Array} items  The currently displayed (filtered) items array.
 *                       Each item must have an `id` property.
 */
export function useSelection(items) {
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());

    const enterSelectMode = useCallback(() => {
        setIsSelectMode(true);
        setSelectedIds(new Set());
    }, []);

    const exitSelectMode = useCallback(() => {
        setIsSelectMode(false);
        setSelectedIds(new Set());
    }, []);

    const toggleSelect = useCallback((id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const allItemsSelected = useCallback(
        (idSet) => items.length > 0 && items.every(item => idSet.has(item.id)),
        [items]
    );

    const toggleSelectAll = useCallback(() => {
        setSelectedIds(prev =>
            allItemsSelected(prev)
                ? new Set()
                : new Set(items.map(item => item.id))
        );
    }, [items, allItemsSelected]);

    const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);

    // Escape key exits selection mode
    useEffect(() => {
        if (!isSelectMode) return;
        const handler = (e) => { if (e.key === 'Escape') exitSelectMode(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isSelectMode, exitSelectMode]);

    return {
        isSelectMode,
        selectedIds,
        selectedCount: selectedIds.size,
        isAllSelected: allItemsSelected(selectedIds),
        enterSelectMode,
        exitSelectMode,
        toggleSelect,
        toggleSelectAll,
        isSelected,
    };
}
