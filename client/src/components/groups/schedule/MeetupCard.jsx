import { useState } from 'react';
import { Clock3, Link2, MapPin } from 'lucide-react';
import { formatMeetupRange } from '../../../utils/calendarDates';
import { getMeetupStateLabel, isMeetupCancelled, isMeetupEnded } from '../../../utils/calendarModel';
import AvatarStack from './AvatarStack';

function getLocalTimezoneLabel(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Local time';

    const timezoneName = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')
        ?.value;

    return timezoneName ? `Local time (${timezoneName})` : 'Local time';
}

/**
 * A single scheduled session with one-tap RSVP. Used by the Upcoming sessions
 * list. Tapping the card body (outside the action buttons) calls `onSelect` so
 * the parent can highlight the session's slot on the week strip.
 */
export default function MeetupCard({ meetup, nowMs, isAdmin, onJoin, onLeave, onCancel, onSelect, dense = false }) {
    const [mountedNowMs] = useState(() => Date.now());
    const effectiveNowMs = nowMs ?? mountedNowMs;
    const stateLabel = getMeetupStateLabel(meetup, effectiveNowMs);
    const cancelled = isMeetupCancelled(meetup);
    const ended = isMeetupEnded(meetup, effectiveNowMs);
    const canCancel = !cancelled && !ended && (Boolean(meetup?.is_creator) || isAdmin);
    const locationHref = meetup.location_url || null;
    const locationLabel = meetup.location_label || (locationHref ? 'Shared link available' : '');

    return (
        <div
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={onSelect ? () => onSelect(meetup) : undefined}
            onKeyDown={onSelect ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(meetup);
                }
            } : undefined}
            className={`glass-panel-premium rounded-[1.35rem] border border-claude-accent/28 bg-[linear-gradient(145deg,rgba(222,185,106,0.16),rgba(43,30,12,0.74))] shadow-[0_24px_44px_rgba(17,10,2,0.24)] ${onSelect ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : ''} ${dense ? 'px-3 py-3' : 'px-3.5 py-3.5'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-claude-accent/25 bg-claude-accent/12 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                            {stateLabel}
                        </span>
                        <span className="text-[11px] font-medium text-claude-secondary">
                            {meetup.attendee_count || 0} {ended ? 'went' : 'going'}
                        </span>
                    </div>
                    <h3 className={`line-clamp-2 font-semibold leading-5 text-claude-text ${dense ? 'mt-2 text-[14px]' : 'mt-2.5 text-[15px]'}`}>
                        {meetup.topic}
                    </h3>
                    <div className={`text-sm text-claude-secondary ${dense ? 'mt-2 space-y-1' : 'mt-2.5 space-y-1.5'}`}>
                        <div className="flex items-start gap-2">
                            <Clock3 className={`mt-0.5 shrink-0 text-claude-accent ${dense ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                            <div className="min-w-0">
                                <div>{formatMeetupRange(meetup.start_at, meetup.end_at)}</div>
                                <div className={`mt-0.5 text-claude-secondary/80 ${dense ? 'text-[10px]' : 'text-[11px]'}`}>
                                    {getLocalTimezoneLabel(meetup.start_at)}
                                </div>
                            </div>
                        </div>
                        {locationLabel && (
                            <div className="flex items-center gap-2">
                                {meetup.location_label ? (
                                    <MapPin className={`shrink-0 text-claude-accent ${dense ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                                ) : (
                                    <Link2 className={`shrink-0 text-claude-accent ${dense ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                                )}
                                {locationHref ? (
                                    <a
                                        href={locationHref}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) => event.stopPropagation()}
                                        className="truncate underline-offset-4 hover:underline"
                                    >
                                        {locationLabel}
                                    </a>
                                ) : (
                                    <span className="truncate">{locationLabel}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <AvatarStack attendees={meetup.attendees || []} count={meetup.attendee_count || 0} dense={dense} />
            </div>

            <div className={`flex flex-wrap items-center gap-2 ${dense ? 'mt-2' : 'mt-3'}`}>
                {cancelled ? (
                    <div className={`rounded-full border border-white/10 bg-white/[0.05] font-medium text-claude-secondary ${dense ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'}`}>
                        This session has been cancelled.
                    </div>
                ) : ended ? (
                    <div className={`rounded-full border border-white/10 bg-white/[0.05] font-medium text-claude-secondary ${dense ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'}`}>
                        This session has ended.
                    </div>
                ) : meetup.is_joined ? (
                    <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onLeave(meetup); }}
                        className={`rounded-full border border-white/10 bg-white/[0.06] font-semibold text-claude-text transition-colors hover:border-white/20 hover:bg-white/[0.1] ${dense ? 'px-3 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'}`}
                    >
                        Can&apos;t make it
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onJoin(meetup); }}
                        className={`rounded-full border border-claude-accent/30 bg-claude-accent font-semibold text-[#182a31] shadow-[0_12px_26px_rgba(41,28,7,0.2)] transition-transform hover:-translate-y-0.5 ${dense ? 'px-3 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'}`}
                    >
                        I&apos;m going
                    </button>
                )}

                {canCancel && (
                    <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onCancel(meetup); }}
                        className={`rounded-full border border-red-400/22 bg-red-500/12 font-semibold text-red-200 transition-colors hover:bg-red-500/18 ${dense ? 'px-3 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'}`}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}
