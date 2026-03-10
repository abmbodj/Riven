import { describe, expect, it } from 'vitest';
import { gardenStages, getGardenStage, getStageIndex } from './gardenCustomization';

describe('gardenCustomization', () => {
    it('keeps stage thresholds in ascending order', () => {
        const thresholds = gardenStages.map((stage) => stage.minDays);
        expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
    });

    it('uses the rebalanced long-term milestones for late stages', () => {
        expect(getGardenStage(239).name).toBe('Mystic Sanctuary');
        expect(getGardenStage(240).name).toBe('Paradise Garden');
        expect(getGardenStage(729).name).toBe('Astral Gardens');
        expect(getGardenStage(730).name).toBe('Celestial Eden');
        expect(getGardenStage(1095).name).toBe('Cosmic Nexus');
        expect(getGardenStage(1460).name).toBe('Universal Core');
        expect(getGardenStage(1825).name).toBe('Infinity Loom');
    });

    it('returns the matching stage index at the new yearly milestones', () => {
        expect(getStageIndex(365)).toBe(10);
        expect(getStageIndex(500)).toBe(11);
        expect(getStageIndex(730)).toBe(12);
        expect(getStageIndex(1095)).toBe(13);
        expect(getStageIndex(1460)).toBe(14);
        expect(getStageIndex(1825)).toBe(15);
    });
});
