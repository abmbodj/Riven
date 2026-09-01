import { describe, expect, it } from 'vitest';
import { buildStudyCoachSnapshot } from '../../supabase/functions/_shared/studyCoachCore.mjs';

describe('studyCoachCore', () => {
  it('builds a lightweight upcoming-exam recommendation without returning source bodies', () => {
    const result = buildStudyCoachSnapshot({
      guides: [],
      assignments: [{
        id: 'assignment-1',
        title: 'Biology Midterm',
        assignment_type: 'exam',
        class_id: 'class-1',
        due_date: '2026-07-31T12:00:00.000Z',
        description: 'private assignment body',
      }],
      notes: [{
        id: 'note-1',
        title: 'Cell notes',
        class_id: 'class-1',
        content: { private: 'note body' },
      }],
      classes: [{ id: 'class-1', name: 'Biology' }],
      statsRow: { xp_total: 80, level: 2, sessions_completed: 3, topics_mastered: 1 },
      achievements: [],
      now: new Date('2026-07-29T12:00:00.000Z'),
    });

    expect(result.upcomingExam).toMatchObject({
      id: 'assignment-1',
      title: 'Biology Midterm',
      countdownLabel: 'in 2 days',
    });
    expect(result.suggestedGuide).toEqual({
      className: 'Biology',
      label: 'Generate tutor session',
      to: '/guides',
    });
    expect(result.stats).toEqual({
      xpTotal: 80,
      level: 2,
      sessionsCompleted: 3,
      topicsMastered: 1,
    });
    expect(JSON.stringify(result)).not.toContain('private assignment body');
    expect(JSON.stringify(result)).not.toContain('note body');
  });
});
