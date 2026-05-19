import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api';
import CalendarHeader from './CalendarHeader';
import CalendarGrid from './CalendarGrid';
import CalendarTimeline from './CalendarTimeline';
import DaySheet from './DaySheet';
import CalendarSources from './CalendarSources';
import { useToast } from '../../hooks/useToast';

export default function InlineCalendar({ classes, scheduleSlots }) {
    const toast = useToast();

    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const [selectedDay, setSelectedDay] = useState(null);
    const [view, setView] = useState('month');
    const [activeFilters, setActiveFilters] = useState([]);
    const [contentMode, setContentMode] = useState('both');
    const [assignments, setAssignments] = useState([]);
    const [loadingAssignments, setLoadingAssignments] = useState(true);

    const loadAssignments = useCallback(async () => {
        try {
            const data = await api.getAssignments();
            setAssignments(data || []);
        } catch (err) {
            console.error('Calendar: failed to load assignments', err);
        } finally {
            setLoadingAssignments(false);
        }
    }, []);

    useEffect(() => {
        loadAssignments();
    }, [loadAssignments]);

    const handleFilterToggle = useCallback((id) => {
        if (id === 'all') { setActiveFilters([]); return; }
        setActiveFilters(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    }, []);

    const activeClasses = useMemo(() => (classes || []).filter((classItem) => !classItem.is_archived), [classes]);
    const activeClassIds = useMemo(() => new Set(activeClasses.map((classItem) => classItem.id)), [activeClasses]);
    const visibleAssignments = useMemo(() => assignments.filter((assignment) => {
        if (assignment.status === 'Archived') return false;
        return !assignment.class_id || activeClassIds.has(assignment.class_id);
    }), [assignments, activeClassIds]);
    const visibleScheduleSlots = useMemo(
        () => (scheduleSlots || []).filter((slot) => activeClassIds.has(slot.class_id)),
        [scheduleSlots, activeClassIds]
    );

    const filteredAssignments = useMemo(() => {
        if (activeFilters.length === 0) return visibleAssignments;
        return visibleAssignments.filter(a => activeFilters.includes(a.class_id));
    }, [visibleAssignments, activeFilters]);

    const handleViewChange = useCallback((nextView) => {
        setView(nextView);
        if (nextView === 'week' || nextView === 'day') {
            setAnchorDate(selectedDay ? new Date(selectedDay) : new Date(anchorDate));
        }
    }, [anchorDate, selectedDay]);

    const handleNavigate = useCallback((direction) => {
        setAnchorDate((current) => {
            const next = new Date(current);
            if (view === 'month') {
                next.setMonth(current.getMonth() + direction, 1);
            } else if (view === 'week') {
                next.setDate(current.getDate() + (direction * 7));
            } else {
                next.setDate(current.getDate() + direction);
            }
            return next;
        });
    }, [view]);

    const handleToday = useCallback(() => {
        const now = new Date();
        setAnchorDate(now);
        setSelectedDay(now);
    }, []);

    const handleDaySelect = useCallback((date) => {
        setSelectedDay(date);
        setAnchorDate(date);
    }, []);

    if (loadingAssignments) {
        return (
            <div className="animate-fade-in pb-12 space-y-4 mt-2">
                <div className="h-8 w-full bg-claude-border/30 rounded-xl animate-pulse" />
                <div className="grid grid-cols-7 gap-px">
                    {Array.from({ length: 42 }).map((_, i) => (
                        <div key={i} className="aspect-square bg-claude-surface/50 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-12">
            <CalendarHeader
                anchorDate={anchorDate}
                onPrev={() => handleNavigate(-1)}
                onNext={() => handleNavigate(1)}
                onToday={handleToday}
                view={view}
                onViewChange={handleViewChange}
                contentMode={contentMode}
                onContentModeChange={setContentMode}
                classes={activeClasses}
                activeFilters={activeFilters}
                onFilterToggle={handleFilterToggle}
            />

            {view === 'month' && (
                <CalendarGrid
                    anchorDate={anchorDate}
                    assignments={filteredAssignments}
                    scheduleSlots={visibleScheduleSlots}
                    classes={activeClasses}
                    activeFilters={activeFilters}
                    contentMode={contentMode}
                    selectedDay={selectedDay}
                    onDaySelect={handleDaySelect}
                />
            )}

            {(view === 'week' || view === 'day') && (
                <CalendarTimeline
                    anchorDate={anchorDate}
                    view={view}
                    assignments={filteredAssignments}
                    scheduleSlots={visibleScheduleSlots}
                    classes={activeClasses}
                    activeFilters={activeFilters}
                    contentMode={contentMode}
                    onDaySelect={handleDaySelect}
                />
            )}

            <CalendarSources onSyncComplete={loadAssignments} toast={toast} />

            <DaySheet
                selectedDay={selectedDay}
                onClose={() => setSelectedDay(null)}
                assignments={visibleAssignments}
                scheduleSlots={visibleScheduleSlots}
                classes={activeClasses}
                contentMode={contentMode}
                activeFilters={activeFilters}
            />
        </div>
    );
}
