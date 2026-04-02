import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api';
import CalendarHeader from './CalendarHeader';
import CalendarGrid from './CalendarGrid';
import CalendarAgenda from './CalendarAgenda';
import DaySheet from './DaySheet';
import CalendarSources from './CalendarSources';
import { useToast } from '../../hooks/useToast';

export default function InlineCalendar({ classes, scheduleSlots }) {
    const toast = useToast();

    const [viewMonth, setViewMonth] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [selectedDay, setSelectedDay] = useState(null);
    const [view, setView] = useState('month');
    const [activeFilters, setActiveFilters] = useState([]);
    const [showSchedule, setShowSchedule] = useState(true);
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

    const filteredAssignments = useMemo(() => {
        if (activeFilters.length === 0) return assignments;
        return assignments.filter(a => activeFilters.includes(a.class_id));
    }, [assignments, activeFilters]);

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
                viewMonth={viewMonth}
                onPrevMonth={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                onNextMonth={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                onToday={() => { const n = new Date(); setViewMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }}
                view={view}
                onViewChange={setView}
                classes={classes}
                activeFilters={activeFilters}
                onFilterToggle={handleFilterToggle}
                showSchedule={showSchedule}
                onScheduleToggle={() => setShowSchedule(s => !s)}
            />

            {view === 'month' && (
                <CalendarGrid
                    viewMonth={viewMonth}
                    assignments={filteredAssignments}
                    scheduleSlots={scheduleSlots}
                    classes={classes}
                    activeFilters={activeFilters}
                    showSchedule={showSchedule}
                    selectedDay={selectedDay}
                    onDaySelect={setSelectedDay}
                />
            )}

            {view === 'agenda' && (
                <CalendarAgenda
                    assignments={filteredAssignments}
                    classes={classes}
                />
            )}

            <CalendarSources onSyncComplete={loadAssignments} toast={toast} />

            <DaySheet
                selectedDay={selectedDay}
                onClose={() => setSelectedDay(null)}
                assignments={assignments}
                scheduleSlots={scheduleSlots}
                classes={classes}
            />
        </div>
    );
}
