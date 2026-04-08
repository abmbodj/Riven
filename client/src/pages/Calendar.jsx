import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import CalendarHeader from '../components/calendar/CalendarHeader';
import CalendarGrid from '../components/calendar/CalendarGrid';
import CalendarTimeline from '../components/calendar/CalendarTimeline';
import DaySheet from '../components/calendar/DaySheet';
import CalendarSources from '../components/calendar/CalendarSources';

export default function Calendar() {
    const navigate = useNavigate();
    const toast = useToast();
    const { isLoggedIn } = useAuth();

    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const [selectedDay, setSelectedDay] = useState(null);
    const [view, setView] = useState('month');
    const [activeFilters, setActiveFilters] = useState([]);
    const [contentMode, setContentMode] = useState('both');

    const [assignments, setAssignments] = useState([]);
    const [classes, setClasses] = useState([]);
    const [scheduleSlots, setScheduleSlots] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/account');
        }
    }, [isLoggedIn, navigate]);

    const loadData = useCallback(async () => {
        try {
            const [assignData, classData, schedData] = await Promise.all([
                api.getAssignments().catch(() => []),
                api.getClasses().catch(() => []),
                api.getSchedule().catch(() => []),
            ]);
            setAssignments(assignData || []);
            setClasses(classData || []);
            setScheduleSlots(schedData || []);
        } catch (err) {
            console.error('Calendar load error', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handlePrev = useCallback(() => {
        setAnchorDate((current) => {
            const next = new Date(current);
            if (view === 'month') {
                next.setMonth(current.getMonth() - 1, 1);
            } else if (view === 'week') {
                next.setDate(current.getDate() - 7);
            } else {
                next.setDate(current.getDate() - 1);
            }
            return next;
        });
    }, [view]);

    const handleNext = useCallback(() => {
        setAnchorDate((current) => {
            const next = new Date(current);
            if (view === 'month') {
                next.setMonth(current.getMonth() + 1, 1);
            } else if (view === 'week') {
                next.setDate(current.getDate() + 7);
            } else {
                next.setDate(current.getDate() + 1);
            }
            return next;
        });
    }, [view]);

    const handleToday = useCallback(() => {
        const now = new Date();
        setAnchorDate(now);
        setSelectedDay(now);
    }, []);

    const handleViewChange = useCallback((nextView) => {
        setView(nextView);
        if (nextView === 'week' || nextView === 'day') {
            setAnchorDate((selectedDay && !Number.isNaN(selectedDay.getTime()))
                ? new Date(selectedDay)
                : new Date(anchorDate));
        }
    }, [anchorDate, selectedDay]);

    const handleDaySelect = useCallback((date) => {
        setSelectedDay(date);
        setAnchorDate(date);
    }, []);

    const handleFilterToggle = useCallback((id) => {
        if (id === 'all') {
            setActiveFilters([]);
            return;
        }
        setActiveFilters(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    }, []);

    // Filtered assignments for the grid/agenda
    const filteredAssignments = useMemo(() => {
        if (activeFilters.length === 0) return assignments;
        return assignments.filter(a => activeFilters.includes(a.class_id));
    }, [assignments, activeFilters]);

    if (loading) {
        return (
            <div className="p-4 space-y-4 animate-in fade-in duration-300">
                <div className="h-8 w-48 bg-claude-border rounded-xl animate-pulse" />
                <div className="grid grid-cols-7 gap-px">
                    {Array.from({ length: 42 }).map((_, i) => (
                        <div key={i} className="aspect-square bg-claude-surface rounded animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-300 pb-24">
            <div className="px-4 sm:px-6 pt-4">
                {/* Page title */}
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 bg-claude-accent text-claude-text text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Education</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-serif font-bold italic text-claude-text tracking-tighter leading-none">Calendar</h1>
                </div>

                <CalendarHeader
                    anchorDate={anchorDate}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    onToday={handleToday}
                    view={view}
                    onViewChange={handleViewChange}
                    contentMode={contentMode}
                    onContentModeChange={setContentMode}
                    classes={classes}
                    activeFilters={activeFilters}
                    onFilterToggle={handleFilterToggle}
                />

                {view === 'month' && (
                    <CalendarGrid
                        anchorDate={anchorDate}
                        assignments={filteredAssignments}
                        scheduleSlots={scheduleSlots}
                        classes={classes}
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
                        scheduleSlots={scheduleSlots}
                        classes={classes}
                        activeFilters={activeFilters}
                        contentMode={contentMode}
                        onDaySelect={handleDaySelect}
                    />
                )}

                {/* External calendar sources */}
                <CalendarSources onSyncComplete={loadData} toast={toast} />
            </div>

            {/* Day sheet */}
            <DaySheet
                selectedDay={selectedDay}
                onClose={() => setSelectedDay(null)}
                assignments={assignments}
                scheduleSlots={scheduleSlots}
                classes={classes}
                contentMode={contentMode}
                activeFilters={activeFilters}
            />
        </div>
    );
}
