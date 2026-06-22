/**
 * GardenScene — the rebuilt "luminous depth" garden.
 *
 * One hero tree grows continuously with the streak inside a moonlit-botanical
 * scene whose light arc (dawn -> day -> dusk -> moonlit -> cosmic) and palette
 * are interpolated every day. Preserves the public <Garden> prop API so the
 * flag-switch wrapper can drop it in for the legacy art with no other changes.
 */

import { useId, useMemo } from 'react';
import { useMobileVisualBudget } from '../../hooks/useMobileVisualBudget';
import { resolveGrowth } from './model/growth';
import { paletteForChapter } from './model/palette';
import { getLod } from './model/lod';
import { buildTree } from './model/treeStructure';
import { useGardenMotion } from './motion/useGardenMotion';
import GardenDefs from './defs/GardenDefs';
import Environment from './layers/Environment';
import CelestialLayer from './layers/CelestialLayer';
import HeroTree from './layers/HeroTree';
import ParticleField from './layers/ParticleField';

const sizeMap = {
    sm: { width: 80, height: 80 },
    md: { width: 160, height: 160 },
    lg: { width: 240, height: 240 },
    xl: { width: 320, height: 320 },
};

// Stable seed: the tree's shape is consistent for everyone; only its growth changes.
const TREE_SEED = 0x2f9a3;

export default function GardenScene({
    streak = 0,
    status = 'active',
    size = 'md',
    showInfo = true,
    svgClassName = '',
}) {
    const uniqueId = useId();
    const { width, height } = sizeMap[size] || sizeMap.md;
    const constrained = useMobileVisualBudget();

    const growth = useMemo(() => resolveGrowth(streak), [streak]);
    const palette = useMemo(
        () => paletteForChapter(growth.chapterIndex, growth.chapterProgress),
        [growth.chapterIndex, growth.chapterProgress],
    );
    const lod = useMemo(
        () => getLod(size, constrained, status, growth.globalGrowth),
        [size, constrained, status, growth.globalGrowth],
    );

    // Bucket growth so day-to-day re-renders reuse the cached tree geometry.
    const bucketedGrowth = Math.round(growth.globalGrowth * 50) / 50;
    const tree = useMemo(
        () => buildTree(bucketedGrowth, TREE_SEED, lod),
        [bucketedGrowth, lod],
    );

    const moon = useMemo(
        () => ({ x: 286, y: 84, r: 24 + growth.globalGrowth * 26 }),
        [growth.globalGrowth],
    );

    const { container } = useGardenMotion(
        { constrained, enableParallax: lod.enableParallax, size },
        [growth.chapterIndex, size, constrained],
    );

    const statusFilter = status === 'broken'
        ? 'grayscale(0.78) saturate(0.8) opacity(0.78)'
        : status === 'at-risk'
            ? 'saturate(0.88) sepia(0.1)'
            : 'none';

    const ids = {
        sky: `g-sky-${uniqueId}`,
        hills: `g-hills-${uniqueId}`,
        hillsNear: `g-hills-near-${uniqueId}`,
        mist: `g-mist-${uniqueId}`,
        pond: `g-pond-${uniqueId}`,
        reflection: `g-reflection-${uniqueId}`,
        island: `g-island-${uniqueId}`,
        bark: `g-bark-${uniqueId}`,
        leaf: `g-leaf-${uniqueId}`,
        foliage: `g-foliage-${uniqueId}`,
        foliageDeep: `g-foliage-deep-${uniqueId}`,
        blossom: `g-blossom-${uniqueId}`,
        light: `g-light-${uniqueId}`,
        ember: `g-ember-${uniqueId}`,
        vignette: `g-vignette-${uniqueId}`,
        blur: `g-blur-${uniqueId}`,
        glow: `g-glow-${uniqueId}`,
        title: `g-title-${uniqueId}`,
        desc: `g-desc-${uniqueId}`,
    };

    return (
        <div
            ref={container}
            style={{ filter: statusFilter, transition: 'filter 0.9s ease, opacity 0.9s ease', contain: 'layout style paint' }}
            className="flex flex-col items-center"
        >
            <svg
                viewBox="0 0 400 400"
                width={width}
                height={height}
                role="img"
                aria-labelledby={ids.title}
                aria-describedby={ids.desc}
                className={`overflow-hidden rounded-3xl shadow-md transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-1000 ease-in-out md:shadow-2xl ${svgClassName}`.trim()}
            >
                <title id={ids.title}>{`${growth.chapter.name} garden`}</title>
                <desc id={ids.desc}>
                    {`A moonlit study-streak garden with a hero tree grown to the ${growth.chapter.name} chapter for a ${growth.days} day streak.`}
                </desc>

                <GardenDefs palette={palette} ids={ids} lod={lod} />

                <Environment palette={palette} ids={ids} lod={lod} moon={moon} />
                <CelestialLayer palette={palette} ids={ids} lod={lod} growth={growth} moon={moon} />
                <HeroTree tree={tree} palette={palette} ids={ids} status={status} />
                <ParticleField palette={palette} ids={ids} lod={lod} status={status} />

                <rect x="0" y="0" width="400" height="400" fill={`url(#${ids.vignette})`} pointerEvents="none" />
            </svg>

            {showInfo ? (
                <div className="mt-2 flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: palette.leafLight }}>
                        {growth.chapter.name}
                    </span>
                    <span className="text-[9px] font-mono opacity-50 text-botanical-sepia">{growth.days} day streak</span>
                </div>
            ) : null}
        </div>
    );
}
