import { describe, expect, it } from 'vitest';
import { gardenStages, getGardenProgress, getGardenStage, getStageIndex } from './gardenCustomization';

describe('gardenCustomization', () => {
    it('keeps stage thresholds in ascending order', () => {
        const thresholds = gardenStages.map((stage) => stage.minDays);
        expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
    });

    it('uses the moderate long-term milestone ladder', () => {
        expect(gardenStages.map((stage) => stage.minDays)).toEqual([
            0, 1, 3, 7, 14, 30, 60, 90, 120, 180, 240, 300, 365, 450, 600, 730,
        ]);
        expect(getGardenStage(299).name).toBe('Eternal Eden');
        expect(getGardenStage(300).name).toBe('Astral Gardens');
        expect(getGardenStage(364).name).toBe('Astral Gardens');
        expect(getGardenStage(365).name).toBe('Celestial Eden');
        expect(getGardenStage(449).name).toBe('Celestial Eden');
        expect(getGardenStage(450).name).toBe('Cosmic Nexus');
        expect(getGardenStage(599).name).toBe('Cosmic Nexus');
        expect(getGardenStage(600).name).toBe('Universal Core');
        expect(getGardenStage(729).name).toBe('Universal Core');
        expect(getGardenStage(730).name).toBe('Infinity Loom');
    });

    it('returns the matching stage index at the new late milestones', () => {
        expect(getStageIndex(240)).toBe(10);
        expect(getStageIndex(300)).toBe(11);
        expect(getStageIndex(365)).toBe(12);
        expect(getStageIndex(450)).toBe(13);
        expect(getStageIndex(600)).toBe(14);
        expect(getStageIndex(730)).toBe(15);
    });

    it('reports early next milestone progress', () => {
        expect(getGardenProgress(0)).toEqual({
            currentStage: gardenStages[0],
            nextStage: gardenStages[1],
            stageIndex: 0,
            daysToNext: 1,
            percent: 0,
        });
    });

    it('reports mid-stage progress toward the next milestone', () => {
        expect(getGardenProgress(45)).toEqual({
            currentStage: gardenStages[5],
            nextStage: gardenStages[6],
            stageIndex: 5,
            daysToNext: 15,
            percent: 50,
        });
    });

    it('reports final-stage completion', () => {
        expect(getGardenProgress(730)).toEqual({
            currentStage: gardenStages[15],
            nextStage: null,
            stageIndex: 15,
            daysToNext: 0,
            percent: 100,
        });
    });
});
