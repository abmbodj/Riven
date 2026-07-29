import { useEffect, useId } from 'react';
import gsap from 'gsap';
import { gardenStages, getStageIndex } from '../utils/gardenCustomization';
import { useGSAP } from '../hooks/useGSAP';
import { useMobileVisualBudget } from '../hooks/useMobileVisualBudget';

const sizeMap = {
    sm: { width: 80, height: 80 },
    md: { width: 160, height: 160 },
    lg: { width: 240, height: 240 },
    xl: { width: 320, height: 320 }
};

const LEAF_PATH = 'M0 0 C -10 -12 -14 -34 0 -56 C 14 -34 10 -12 0 0 Z';
const PETAL_PATH = 'M0 0 C -14 -12 -19 -38 0 -62 C 19 -38 14 -12 0 0 Z';
const STAR_PATH = 'M0 -6 Q2.8 -2.2 6 0 Q2.8 2.2 0 6 Q-2.8 2.2 -6 0 Q-2.8 -2.2 0 -6 Z';

const palettes = [
    {
        skyTop: '#f2ecdf',
        skyBottom: '#d8cdb8',
        mist: '#fff5e5',
        hillFar: '#b8b09d',
        hillNear: '#8f8876',
        pond: '#8a9a97',
        pondGlow: '#dfe5d2',
        island: '#7c705c',
        bark: '#665744',
        leaf: '#8aa07b',
        leafLight: '#dce5c4',
        blossom: '#f4e6d8',
        blossomCore: '#d4b88e',
        light: '#fff8e6',
        star: '#f7edda'
    },
    {
        skyTop: '#eef0e2',
        skyBottom: '#cfd8bc',
        mist: '#f8fde7',
        hillFar: '#a9b29a',
        hillNear: '#738468',
        pond: '#7b9389',
        pondGlow: '#e2edd5',
        island: '#6d7058',
        bark: '#5a523f',
        leaf: '#7fa06f',
        leafLight: '#d7e9bf',
        blossom: '#f7ead9',
        blossomCore: '#cda978',
        light: '#fdf9df',
        star: '#f8f4df'
    },
    {
        skyTop: '#e5efe1',
        skyBottom: '#bfd2bf',
        mist: '#eef9ea',
        hillFar: '#96b09d',
        hillNear: '#62816d',
        pond: '#6f9186',
        pondGlow: '#d4eee1',
        island: '#65705d',
        bark: '#4f5642',
        leaf: '#68a07a',
        leafLight: '#d0f0cf',
        blossom: '#f5ebdf',
        blossomCore: '#d6b792',
        light: '#f3fae8',
        star: '#eff8ef'
    },
    {
        skyTop: '#deede7',
        skyBottom: '#a5c8bd',
        mist: '#dff8f0',
        hillFar: '#86a8a0',
        hillNear: '#4e786f',
        pond: '#5b847b',
        pondGlow: '#cbe8dd',
        island: '#5d6658',
        bark: '#474f42',
        leaf: '#5a9c74',
        leafLight: '#c8eccd',
        blossom: '#f6e7e1',
        blossomCore: '#d8a790',
        light: '#e8fbf4',
        star: '#e8f8f3'
    },
    {
        skyTop: '#d9ece8',
        skyBottom: '#90c2bb',
        mist: '#d4f4f2',
        hillFar: '#709d9d',
        hillNear: '#3f7070',
        pond: '#4b7b76',
        pondGlow: '#bde4de',
        island: '#4d6259',
        bark: '#394d46',
        leaf: '#4f9d7f',
        leafLight: '#c1ebd7',
        blossom: '#f2e4df',
        blossomCore: '#dfac95',
        light: '#def8f4',
        star: '#e2faf5'
    },
    {
        skyTop: '#d8e7ea',
        skyBottom: '#7eb4be',
        mist: '#d0f0f4',
        hillFar: '#648d97',
        hillNear: '#355d6c',
        pond: '#416e7a',
        pondGlow: '#b8dfe4',
        island: '#46575d',
        bark: '#314047',
        leaf: '#4a9a92',
        leafLight: '#baede4',
        blossom: '#f0e0e4',
        blossomCore: '#daa3b1',
        light: '#dcf7ff',
        star: '#def9ff'
    },
    {
        skyTop: '#d8e0ef',
        skyBottom: '#7898be',
        mist: '#dce8ff',
        hillFar: '#62749b',
        hillNear: '#384a73',
        pond: '#3d597b',
        pondGlow: '#c6d7ef',
        island: '#455069',
        bark: '#31384c',
        leaf: '#6f98b6',
        leafLight: '#d0e9ff',
        blossom: '#f1e5f1',
        blossomCore: '#d7aed8',
        light: '#edf5ff',
        star: '#edf5ff'
    },
    {
        skyTop: '#d6dbf2',
        skyBottom: '#6678b1',
        mist: '#dde4ff',
        hillFar: '#566490',
        hillNear: '#2e3a61',
        pond: '#354b74',
        pondGlow: '#bdcaec',
        island: '#404b66',
        bark: '#2b3246',
        leaf: '#7da0c6',
        leafLight: '#d9ebff',
        blossom: '#f0e3f6',
        blossomCore: '#cfabd8',
        light: '#f2f6ff',
        star: '#eff5ff'
    },
    {
        skyTop: '#d9d6f2',
        skyBottom: '#665f9a',
        mist: '#e2dcff',
        hillFar: '#5b5686',
        hillNear: '#312c53',
        pond: '#38385d',
        pondGlow: '#c5c0eb',
        island: '#49425e',
        bark: '#31293d',
        leaf: '#92a0d0',
        leafLight: '#e1e7ff',
        blossom: '#f3e2f6',
        blossomCore: '#d7a6d8',
        light: '#f4edff',
        star: '#f4efff'
    },
    {
        skyTop: '#ded6f5',
        skyBottom: '#6f5aa4',
        mist: '#ece4ff',
        hillFar: '#66578a',
        hillNear: '#39274e',
        pond: '#403663',
        pondGlow: '#d4c2f1',
        island: '#524263',
        bark: '#3b2944',
        leaf: '#a68fd1',
        leafLight: '#efe2ff',
        blossom: '#f8e4f2',
        blossomCore: '#dc9fc5',
        light: '#faf0ff',
        star: '#fbf4ff'
    },
    {
        skyTop: '#1f2036',
        skyBottom: '#423057',
        mist: '#8ea2d0',
        hillFar: '#3f4060',
        hillNear: '#24263c',
        pond: '#243549',
        pondGlow: '#7d8bb3',
        island: '#4f4251',
        bark: '#7f6991',
        leaf: '#b5b9e0',
        leafLight: '#eef3ff',
        blossom: '#f5e6f3',
        blossomCore: '#e5bdd9',
        light: '#f5eeff',
        star: '#fff7d8'
    },
    {
        skyTop: '#161c31',
        skyBottom: '#2b375a',
        mist: '#7c9cc9',
        hillFar: '#314864',
        hillNear: '#1d2739',
        pond: '#1b3247',
        pondGlow: '#7194b8',
        island: '#3e4650',
        bark: '#65778b',
        leaf: '#9fc8df',
        leafLight: '#e5f6ff',
        blossom: '#f0e8f8',
        blossomCore: '#d2bfeb',
        light: '#edf7ff',
        star: '#f5f9ff'
    },
    {
        skyTop: '#11172b',
        skyBottom: '#243b61',
        mist: '#7ca4c9',
        hillFar: '#274563',
        hillNear: '#162334',
        pond: '#16354f',
        pondGlow: '#6ea5c7',
        island: '#30424d',
        bark: '#4c6d7f',
        leaf: '#8fd0cc',
        leafLight: '#ddfff7',
        blossom: '#eff1fb',
        blossomCore: '#bdd1ef',
        light: '#f0fbff',
        star: '#fbffff'
    },
    {
        skyTop: '#0d1327',
        skyBottom: '#1f3057',
        mist: '#87a4d0',
        hillFar: '#1f3c63',
        hillNear: '#131c30',
        pond: '#14354f',
        pondGlow: '#7faad2',
        island: '#263746',
        bark: '#3d6072',
        leaf: '#8ac7b3',
        leafLight: '#dbfff0',
        blossom: '#f4effa',
        blossomCore: '#d4c4f5',
        light: '#f5fdff',
        star: '#ffffff'
    },
    {
        skyTop: '#090f1f',
        skyBottom: '#182745',
        mist: '#90aed8',
        hillFar: '#1a3658',
        hillNear: '#0e1727',
        pond: '#102d46',
        pondGlow: '#87a9d3',
        island: '#223242',
        bark: '#365366',
        leaf: '#97d0c2',
        leafLight: '#e4fff5',
        blossom: '#f7effd',
        blossomCore: '#d8c3f9',
        light: '#f9fdff',
        star: '#ffffff'
    },
    {
        skyTop: '#060b17',
        skyBottom: '#121d33',
        mist: '#92b8df',
        hillFar: '#142b4a',
        hillNear: '#09111d',
        pond: '#0b2237',
        pondGlow: '#8ab2d7',
        island: '#1b2b3c',
        bark: '#314e63',
        leaf: '#9dddd2',
        leafLight: '#ebfff9',
        blossom: '#fbf2ff',
        blossomCore: '#e4d2ff',
        light: '#fcfeff',
        star: '#ffffff'
    }
];

const range = (count) => Array.from({ length: count }, (_, index) => index);

const radialScatter = (count, centerX, centerY, radiusX, radiusY, angleOffset = 0) => (
    range(count).map((index) => {
        const angle = ((index * 137.5) + angleOffset) * (Math.PI / 180);
        const ratio = 0.22 + (((index + 1) / (count + 1)) * 0.78);
        return {
            x: centerX + (Math.cos(angle) * radiusX * ratio),
            y: centerY + (Math.sin(angle) * radiusY * ratio),
            scale: 0.68 + ((index % 4) * 0.14),
        };
    })
);

function LeafBlade({
    x,
    y,
    rotate = 0,
    scale = 1,
    fill,
    opacity = 1,
    className = ''
}) {
    return (
        <path
            d={LEAF_PATH}
            transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
            fill={fill}
            opacity={opacity}
            className={className}
        />
    );
}

function LotusBloom({
    x,
    y,
    petals = 7,
    radius = 16,
    petalScale = 0.34,
    petalFill,
    coreFill,
    coreRadius = 4.5,
    rotate = 0,
    ringStroke = null,
    ringRadius = 0,
    glowFill = null,
    glowOpacity = 0.18,
    className = ''
}) {
    return (
        <g transform={`translate(${x} ${y}) rotate(${rotate})`} className={className} data-origin={`${x}px ${y}px`}>
            {glowFill ? (
                <circle r={radius * 1.6} fill={glowFill} opacity={glowOpacity} className="garden-breath" />
            ) : null}
            {range(petals).map((index) => (
                <g key={index} transform={`rotate(${(360 / petals) * index}) translate(0 ${-radius})`}>
                    <path d={PETAL_PATH} fill={petalFill} opacity={index % 2 === 0 ? 0.95 : 0.78} transform={`scale(${petalScale})`} />
                </g>
            ))}
            {ringStroke && ringRadius ? (
                <circle r={ringRadius} fill="none" stroke={ringStroke} strokeWidth="1.4" opacity="0.55" />
            ) : null}
            <circle r={coreRadius} fill={coreFill} className="garden-breath" />
        </g>
    );
}

function Reed({
    x,
    y,
    height = 42,
    lean = 0,
    scale = 1,
    stemStroke,
    leafFill,
    blossomFill,
    coreFill,
    showBloom = false,
    showSeed = false,
    sway = 0.7,
    duration = 10
}) {
    const tipX = x + lean;
    const tipY = y - height;

    return (
        <g className="garden-sway garden-reveal" data-origin={`${x}px ${y}px`} data-rotate={sway} data-duration={duration}>
            <path
                d={`M${x} ${y} C ${x - 4} ${y - (height * 0.3)} ${x + (lean * 0.42)} ${y - (height * 0.72)} ${tipX} ${tipY}`}
                fill="none"
                stroke={stemStroke}
                strokeWidth={2.1 * scale}
                strokeLinecap="round"
            />
            <LeafBlade x={x - 5} y={y - (height * 0.58)} rotate={-74 + (lean * 0.25)} scale={0.26 * scale} fill={leafFill} opacity="0.88" />
            <LeafBlade x={x + 8} y={y - (height * 0.38)} rotate={56 + (lean * 0.18)} scale={0.22 * scale} fill={leafFill} opacity="0.74" />
            {showBloom ? (
                <LotusBloom
                    x={tipX}
                    y={tipY}
                    petals={5}
                    radius={10 * scale}
                    petalScale={0.2 * scale}
                    petalFill={blossomFill}
                    coreFill={coreFill}
                    coreRadius={2.4 * scale}
                    glowFill={coreFill}
                    glowOpacity={0.1}
                    className="garden-breath"
                />
            ) : null}
            {showSeed ? (
                <ellipse cx={tipX} cy={tipY} rx={4 * scale} ry={6 * scale} fill={coreFill} opacity="0.86" className="garden-breath" />
            ) : null}
        </g>
    );
}

function WillowFrond({
    x,
    y,
    length = 56,
    curve = 10,
    leafFill,
    blossomFill,
    coreFill,
    withBloom = false,
    sway = 0.45,
    duration = 11
}) {
    const nodes = [0.22, 0.42, 0.62, 0.82].map((ratio, index) => ({
        x: x + ((index % 2 === 0 ? -1 : 1) * curve * (0.18 + (index * 0.08))),
        y: y + (length * ratio),
        rotate: index % 2 === 0 ? -70 : 56,
        scale: 0.18 + (index * 0.03)
    }));
    const tipX = x + (curve * 0.14);
    const tipY = y + length;

    return (
        <g className="garden-sway garden-reveal" data-origin={`${x}px ${y}px`} data-rotate={sway} data-duration={duration}>
            <path
                d={`M${x} ${y} C ${x + (curve * 0.4)} ${y + (length * 0.18)} ${x - (curve * 0.55)} ${y + (length * 0.65)} ${tipX} ${tipY}`}
                fill="none"
                stroke={leafFill}
                strokeOpacity="0.34"
                strokeWidth="1.7"
                strokeLinecap="round"
            />
            {nodes.map((node, index) => (
                <LeafBlade
                    key={`${x}-${y}-${index}`}
                    x={node.x}
                    y={node.y}
                    rotate={node.rotate}
                    scale={node.scale}
                    fill={leafFill}
                    opacity={0.9 - (index * 0.1)}
                />
            ))}
            {withBloom ? (
                <LotusBloom
                    x={tipX}
                    y={tipY + 4}
                    petals={5}
                    radius={8}
                    petalScale={0.18}
                    petalFill={blossomFill}
                    coreFill={coreFill}
                    coreRadius={2.2}
                    glowFill={coreFill}
                    glowOpacity={0.08}
                    className="garden-breath"
                />
            ) : null}
        </g>
    );
}

export default function Garden({
    streak = 0,
    status = 'active',
    size = 'md',
    showInfo = true,
    svgClassName = ''
}) {
    const uniqueId = useId();
    const { width, height } = sizeMap[size] || sizeMap.md;
    const stageIndex = getStageIndex(streak);
    const palette = palettes[Math.min(stageIndex, palettes.length - 1)];
    const stageMeta = gardenStages[Math.min(stageIndex, gardenStages.length - 1)] ?? gardenStages[0];
    const stageName = stageMeta.name;
    const isWilting = status === 'broken';
    const isAtRisk = status === 'at-risk';
    const statusFilter = isWilting ? 'grayscale(0.82) saturate(0.78) opacity(0.72)' : isAtRisk ? 'saturate(0.84) sepia(0.12)' : 'none';
    const lightVisualBudget = useMobileVisualBudget();
    const isHighStage = stageIndex >= 12;
    const isFinalStage = stageIndex >= 15;
    const statusDensity = isWilting ? 0.48 : isAtRisk ? 0.72 : 1;
    const highStageDensity = isHighStage ? (lightVisualBudget ? 0.55 : 0.68) : 1;
    const detailOpacity = statusDensity * highStageDensity;
    const bandOpacity = Math.max(0.12, detailOpacity * 0.72);
    const plantDetailOpacity = isHighStage ? (isWilting ? 0.58 : 0.74) : 1;
    const foregroundSparkleOpacity = isHighStage ? (isWilting ? 0.18 : 0.28) : 1;

    const ids = {
        sky: `garden-sky-${uniqueId}`,
        mist: `garden-mist-${uniqueId}`,
        hills: `garden-hills-${uniqueId}`,
        hillsNear: `garden-hills-near-${uniqueId}`,
        pond: `garden-pond-${uniqueId}`,
        reflection: `garden-reflection-${uniqueId}`,
        island: `garden-island-${uniqueId}`,
        bark: `garden-bark-${uniqueId}`,
        leaf: `garden-leaf-${uniqueId}`,
        blossom: `garden-blossom-${uniqueId}`,
        light: `garden-light-${uniqueId}`,
        cosmic: `garden-cosmic-${uniqueId}`,
        ribbon: `garden-ribbon-${uniqueId}`,
        vignette: `garden-vignette-${uniqueId}`,
        blur: `garden-blur-${uniqueId}`,
        glow: `garden-glow-${uniqueId}`,
        title: `garden-title-${uniqueId}`,
        desc: `garden-desc-${uniqueId}`,
    };

    const leafFill = `url(#${ids.leaf})`;
    const blossomFill = `url(#${ids.blossom})`;
    const barkStroke = `url(#${ids.bark})`;
    const lightFill = `url(#${ids.light})`;
    const cosmicStroke = `url(#${ids.cosmic})`;
    const ribbonStroke = `url(#${ids.ribbon})`;
    const moonX = stageIndex >= 10 ? 284 : 264;
    const moonY = stageIndex >= 8 ? 84 : 72;
    const moonRadius = stageIndex >= 12 ? 48 : stageIndex >= 8 ? 40 : 28 + (stageIndex * 2);
    const fireflyCount = stageIndex >= 14
        ? (lightVisualBudget ? 4 : 6)
        : stageIndex >= 13
            ? (lightVisualBudget ? 6 : 8)
        : stageIndex >= 9 ? 12 : stageIndex >= 5 ? 8 : stageIndex >= 2 ? 4 : 0;
    const fireflies = radialScatter(
        fireflyCount,
        220,
        stageIndex >= 8 ? 180 : 196,
        stageIndex >= 12 ? 164 : 138,
        stageIndex >= 12 ? 116 : 90,
        stageIndex * 11
    );
    const pollen = radialScatter(
        stageIndex >= 14 ? (lightVisualBudget ? 3 : 5) : stageIndex >= 12 ? (lightVisualBudget ? 6 : 9) : stageIndex >= 7 ? 18 : stageIndex >= 3 ? 10 : 4,
        198,
        222,
        168,
        126,
        stageIndex * 17
    );
    const stars = range(stageIndex >= 12 ? (lightVisualBudget ? 6 : 8) : stageIndex >= 10 ? 16 : stageIndex >= 8 ? 9 : 0).map((index) => ({
        x: 34 + ((index * 47) % 320),
        y: 26 + ((index * 29) % 118),
        scale: 0.58 + ((index % 4) * 0.12),
        opacity: 0.3 + ((index % 3) * 0.14)
    }));

    const constellationPoints = range(stageIndex >= 15 ? 5 : stageIndex >= 13 ? 5 : stageIndex >= 12 ? 4 : 0).map((index) => ({
        x: 54 + ((index * 62) % 250),
        y: 32 + ((index * 23) % 82),
        scale: 0.84 + ((index % 3) * 0.16)
    }));
    const constellationPath = constellationPoints.length
        ? constellationPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
        : '';
    const haloRings = range(stageIndex >= 15 ? 3 : stageIndex >= 14 ? 3 : stageIndex >= 12 ? 2 : 0);
    const archRings = range(stageIndex >= 15 ? 2 : stageIndex >= 13 ? 1 : 0);
    const cosmicDust = radialScatter(
        stageIndex >= 15 ? (lightVisualBudget ? 5 : 8) : stageIndex >= 14 ? (lightVisualBudget ? 4 : 6) : 0,
        204,
        116,
        142,
        58,
        stageIndex * 23
    );

    const reeds = [
        { x: 112, y: 304, lean: -10, height: 34, min: 1, scale: 0.82 },
        { x: 142, y: 314, lean: 7, height: 28, min: 2, scale: 0.68 },
        { x: 272, y: 308, lean: -8, height: 36, min: 1, scale: 0.78 },
        { x: 306, y: 316, lean: 10, height: 44, min: 3, scale: 0.88 },
        { x: 92, y: 320, lean: -5, height: 24, min: 4, scale: 0.52 },
        { x: 332, y: 320, lean: 6, height: 26, min: 4, scale: 0.56 }
    ];

    const pondBlooms = [
        { x: 134, y: 296, scale: 0.68, min: 4, rotate: -14 },
        { x: 166, y: 316, scale: 0.54, min: 6, rotate: 8 },
        { x: 252, y: 306, scale: 0.76, min: 5, rotate: 18 },
        { x: 286, y: 292, scale: 0.58, min: 7, rotate: -8 }
    ];

    const fronds = [
        { x: 156, y: 146, length: 64, curve: -10, min: 6, bloom: false, sway: 0.5 },
        { x: 176, y: 126, length: 78, curve: -8, min: 7, bloom: stageIndex >= 10, sway: 0.45 },
        { x: 204, y: 112, length: 92, curve: 3, min: 8, bloom: stageIndex >= 12, sway: 0.4 },
        { x: 234, y: 116, length: 88, curve: 8, min: 8, bloom: stageIndex >= 10, sway: 0.42 },
        { x: 264, y: 130, length: 78, curve: 12, min: 9, bloom: stageIndex >= 11, sway: 0.48 },
        { x: 294, y: 150, length: 58, curve: 14, min: 11, bloom: stageIndex >= 13, sway: 0.52 }
    ];

    const canopyBlooms = [
        { x: 152, y: 148, min: 7, scale: 0.68, rotate: -18 },
        { x: 186, y: 122, min: 8, scale: 0.8, rotate: -6 },
        { x: 228, y: 112, min: 9, scale: 0.9, rotate: 8 },
        { x: 268, y: 126, min: 10, scale: 0.82, rotate: 18 },
        { x: 298, y: 156, min: 11, scale: 0.68, rotate: 26 }
    ];

    const visibleFronds = fronds.filter((frond) => stageIndex >= frond.min).slice(0, stageIndex >= 14 ? 4 : fronds.length);
    const visibleCanopyBlooms = canopyBlooms.filter((bloom) => stageIndex >= bloom.min).slice(0, stageIndex >= 14 ? 3 : canopyBlooms.length);
    const visiblePondBlooms = pondBlooms.filter((bloom) => stageIndex >= bloom.min).slice(0, stageIndex >= 14 ? 3 : pondBlooms.length);

    const orbitNodeCount = isFinalStage ? 0 : stageIndex >= 14 ? 4 : stageIndex >= 11 ? 6 : 0;
    const orbitNodes = range(orbitNodeCount).map((index) => {
        const angle = (360 / orbitNodeCount) * index;
        const radius = stageIndex >= 14 ? 78 : 72;
        const radians = angle * (Math.PI / 180);
        return {
            x: moonX + (Math.cos(radians) * radius),
            y: moonY + (Math.sin(radians) * radius),
            light: index % 2 === 0
        };
    });

    const { container } = useGSAP(({ selector }) => {
        const q = selector;

        const revealTargets = q('.garden-reveal');
        if (revealTargets.length) {
            gsap.fromTo(
                revealTargets,
                { opacity: 0, y: 8, scale: 0.985 },
                {
                    opacity: (_, element) => Number(element.dataset.revealOpacity ?? element.getAttribute('opacity') ?? 1),
                    y: 0,
                    scale: 1,
                    duration: 1.35,
                    ease: 'power2.out',
                    stagger: 0.06
                }
            );
        }

        const swayEls = q('.garden-sway');
        const swayTargets = lightVisualBudget ? swayEls.filter((_, i) => i % 2 === 0) : swayEls;
        swayTargets.forEach((element) => {
            gsap.to(element, {
                rotate: Number(element.dataset.rotate ?? 0.6),
                duration: Number(element.dataset.duration ?? 10),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                transformOrigin: element.dataset.origin ?? 'center bottom'
            });
        });

        const driftEls = q('.garden-drift');
        const driftTargets = lightVisualBudget ? driftEls.filter((_, i) => i % 2 === 0) : driftEls;
        driftTargets.forEach((element, index) => {
            gsap.to(element, {
                x: Number(element.dataset.x ?? 0),
                y: Number(element.dataset.y ?? -4),
                duration: Number(element.dataset.duration ?? 12) + ((index % 4) * 0.55),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                delay: index * 0.12
            });
        });

        if (!lightVisualBudget) {
            q('.garden-breath').forEach((element, index) => {
                const baseOpacity = Number(element.dataset.opacity ?? element.getAttribute('opacity') ?? 1);
                gsap.to(element, {
                    scale: 1.02 + ((index % 3) * 0.012),
                    opacity: Math.min(1, baseOpacity + (baseOpacity < 0.3 ? 0.06 : 0.03)),
                    duration: 4.8 + ((index % 4) * 0.55),
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: -1,
                    transformOrigin: element.dataset.origin ?? 'center center'
                });
            });

            q('.garden-twinkle').forEach((element, index) => {
                gsap.to(element, {
                    opacity: 0.3 + ((index % 5) * 0.08),
                    scale: 0.88 + ((index % 4) * 0.06),
                    duration: 3.4 + ((index % 6) * 0.45),
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: -1,
                    delay: index * 0.1,
                    transformOrigin: element.dataset.origin ?? 'center center'
                });
            });

            q('.garden-ripple').forEach((element, index) => {
                const baseOpacity = Number(element.dataset.opacity ?? element.getAttribute('opacity') ?? 0.24);
                gsap.to(element, {
                    scaleX: 1.035 + ((index % 2) * 0.02),
                    scaleY: 0.972,
                    opacity: baseOpacity + 0.08,
                    duration: 5.8 + (index * 0.7),
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: -1,
                    transformOrigin: 'center center'
                });
            });

            q('.garden-orbit').forEach((element, index) => {
                gsap.to(element, {
                    rotation: index % 2 === 0 ? 360 : -360,
                    duration: Number(element.dataset.duration ?? 48) + (index * 8),
                    ease: 'none',
                    repeat: -1,
                    transformOrigin: element.dataset.origin ?? `${moonX}px ${moonY}px`
                });
            });
        }
    }, [stageIndex, size, moonX, moonY, lightVisualBudget]);

    useEffect(() => {
        const node = container.current;
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const pointerQuery = window.matchMedia('(pointer: fine)');

        if (!node || motionQuery.matches || !pointerQuery.matches || size === 'sm') {
            return undefined;
        }

        const far = Array.from(node.querySelectorAll('[data-parallax="far"]'));
        const mid = Array.from(node.querySelectorAll('[data-parallax="mid"]'));
        const near = Array.from(node.querySelectorAll('[data-parallax="near"]'));

        if (!far.length && !mid.length && !near.length) {
            return undefined;
        }

        const farX = gsap.quickTo(far, 'x', { duration: 1.8, ease: 'power3.out' });
        const farY = gsap.quickTo(far, 'y', { duration: 1.8, ease: 'power3.out' });
        const midX = gsap.quickTo(mid, 'x', { duration: 1.45, ease: 'power3.out' });
        const midY = gsap.quickTo(mid, 'y', { duration: 1.45, ease: 'power3.out' });
        const nearX = gsap.quickTo(near, 'x', { duration: 1.1, ease: 'power3.out' });
        const nearY = gsap.quickTo(near, 'y', { duration: 1.1, ease: 'power3.out' });

        const reset = () => {
            farX(0);
            farY(0);
            midX(0);
            midY(0);
            nearX(0);
            nearY(0);
        };

        let latestX = 0;
        let latestY = 0;
        let rafPending = false;

        const onMove = (event) => {
            latestX = event.clientX;
            latestY = event.clientY;
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                const rect = node.getBoundingClientRect();
                const xProgress = ((latestX - rect.left) / rect.width) - 0.5;
                const yProgress = ((latestY - rect.top) / rect.height) - 0.5;

                farX(xProgress * 4);
                farY(yProgress * 3.5);
                midX(xProgress * 7);
                midY(yProgress * 5.5);
                nearX(xProgress * 10);
                nearY(yProgress * 7);
                rafPending = false;
            });
        };

        node.addEventListener('pointermove', onMove, { passive: true });
        node.addEventListener('pointerleave', reset);

        return () => {
            reset();
            node.removeEventListener('pointermove', onMove);
            node.removeEventListener('pointerleave', reset);
        };
    }, [container, size, stageIndex]);

    const trunkTop = stageIndex >= 13 ? 108 : stageIndex >= 9 ? 118 : 136;

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
                <title id={ids.title}>{`${stageName} garden`}</title>
                <desc id={ids.desc}>{`A serene study streak garden rendered as a moonlit sanctuary for a ${streak} day streak.`}</desc>

                <defs>
                    <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.skyTop} />
                        <stop offset="58%" stopColor={palette.skyTop} stopOpacity="0.68" />
                        <stop offset="100%" stopColor={palette.skyBottom} />
                    </linearGradient>
                    <linearGradient id={ids.hills} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.hillFar} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={palette.hillFar} />
                    </linearGradient>
                    <linearGradient id={ids.hillsNear} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.hillNear} stopOpacity="0.26" />
                        <stop offset="100%" stopColor={palette.hillNear} />
                    </linearGradient>
                    <linearGradient id={ids.mist} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={palette.mist} stopOpacity="0" />
                        <stop offset="50%" stopColor={palette.mist} stopOpacity="0.34" />
                        <stop offset="100%" stopColor={palette.mist} stopOpacity="0" />
                    </linearGradient>
                    <radialGradient id={ids.pond} cx="50%" cy="45%" r="70%">
                        <stop offset="0%" stopColor={palette.pondGlow} stopOpacity="0.8" />
                        <stop offset="28%" stopColor={palette.pond} stopOpacity="0.86" />
                        <stop offset="100%" stopColor={palette.hillNear} />
                    </radialGradient>
                    <linearGradient id={ids.reflection} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.light} stopOpacity="0.52" />
                        <stop offset="100%" stopColor={palette.light} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id={ids.island} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.island} />
                        <stop offset="100%" stopColor={palette.bark} />
                    </linearGradient>
                    <linearGradient id={ids.bark} x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%" stopColor={palette.bark} />
                        <stop offset="100%" stopColor={palette.light} />
                    </linearGradient>
                    <linearGradient id={ids.leaf} x1="0" y1="1" x2="0.8" y2="0">
                        <stop offset="0%" stopColor={palette.leaf} />
                        <stop offset="100%" stopColor={palette.leafLight} />
                    </linearGradient>
                    <linearGradient id={ids.blossom} x1="0" y1="1" x2="0.75" y2="0">
                        <stop offset="0%" stopColor={palette.blossom} />
                        <stop offset="100%" stopColor={palette.light} />
                    </linearGradient>
                    <linearGradient id={ids.cosmic} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={palette.leafLight} stopOpacity="0.16" />
                        <stop offset="45%" stopColor={palette.light} stopOpacity="0.72" />
                        <stop offset="100%" stopColor={palette.blossomCore} stopOpacity="0.28" />
                    </linearGradient>
                    <linearGradient id={ids.ribbon} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={palette.leafLight} stopOpacity="0" />
                        <stop offset="22%" stopColor={palette.leafLight} stopOpacity="0.62" />
                        <stop offset="54%" stopColor={palette.light} stopOpacity="0.92" />
                        <stop offset="82%" stopColor={palette.blossomCore} stopOpacity="0.62" />
                        <stop offset="100%" stopColor={palette.blossomCore} stopOpacity="0" />
                    </linearGradient>
                    <radialGradient id={ids.light} cx="50%" cy="42%" r="62%">
                        <stop offset="0%" stopColor={palette.light} stopOpacity="0.9" />
                        <stop offset="44%" stopColor={palette.light} stopOpacity="0.44" />
                        <stop offset="100%" stopColor={palette.light} stopOpacity="0" />
                    </radialGradient>
                    <filter id={ids.blur}>
                        <feGaussianBlur stdDeviation={lightVisualBudget ? '4' : '12'} />
                    </filter>
                    <filter id={ids.glow} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation={lightVisualBudget ? '2' : '4.5'} result="blurred" />
                        <feMerge>
                            <feMergeNode in="blurred" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <radialGradient id={ids.vignette} cx="50%" cy="50%" r="60%">
                        <stop offset="0%" stopColor={palette.skyTop} stopOpacity="0" />
                        <stop offset="82%" stopColor={palette.hillNear} stopOpacity="0" />
                        <stop offset="100%" stopColor={palette.hillNear} stopOpacity="0.16" />
                    </radialGradient>
                </defs>

                <rect x="0" y="0" width="400" height="400" fill={`url(#${ids.sky})`} />

                <ellipse
                    cx={moonX}
                    cy={moonY}
                    rx={moonRadius * 1.7}
                    ry={moonRadius * 1.45}
                    fill={lightFill}
                    opacity={stageIndex >= 8 ? '0.34' : '0.22'}
                    className="garden-breath garden-reveal"
                    data-parallax="far"
                />
                <circle
                    cx={moonX}
                    cy={moonY}
                    r={moonRadius}
                    fill={palette.light}
                    opacity={stageIndex >= 8 ? '0.9' : '0.75'}
                    className="garden-breath garden-reveal"
                    data-parallax="far"
                />

                {stageIndex >= 12 ? (
                    <g className="garden-reveal" data-parallax="far" opacity={bandOpacity}>
                        <g className="garden-orbit" data-duration={stageIndex >= 15 ? '92' : '118'} data-origin={`${moonX}px ${moonY}px`}>
                            {haloRings.map((_, index) => (
                                <ellipse
                                    key={`moon-halo-${index}`}
                                    cx={moonX}
                                    cy={moonY}
                                    rx={moonRadius + 22 + (index * 14)}
                                    ry={moonRadius + 9 + (index * 8)}
                                    fill="none"
                                    stroke={cosmicStroke}
                                    strokeWidth={1.1 - (index * 0.12)}
                                    strokeDasharray={index % 2 === 0 ? '3 24' : '12 28'}
                                    opacity={0.22 - (index * 0.035)}
                                    transform={`rotate(${(index * 18) - 22} ${moonX} ${moonY})`}
                                />
                            ))}
                        </g>
                    </g>
                ) : null}

                {constellationPoints.length ? (
                    <g className="garden-reveal" data-parallax="far" opacity={bandOpacity}>
                        <path
                            d={constellationPath}
                            fill="none"
                            stroke={cosmicStroke}
                            strokeWidth="0.9"
                            strokeDasharray={stageIndex >= 14 ? '9 18' : '4 16'}
                            strokeLinecap="round"
                            opacity={stageIndex >= 14 ? '0.3' : '0.22'}
                            className="garden-drift"
                            data-x="2"
                            data-y="-1.2"
                            data-duration="18"
                        />
                        {constellationPoints.map((point, index) => (
                            <g
                                key={`constellation-${index}`}
                                className="garden-twinkle"
                                data-origin={`${point.x}px ${point.y}px`}
                            >
                                <path
                                    d={STAR_PATH}
                                    transform={`translate(${point.x} ${point.y}) scale(${point.scale})`}
                                    fill={index % 2 === 0 ? palette.light : palette.leafLight}
                                    opacity={stageIndex >= 14 ? '0.58' : '0.42'}
                                />
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={5.6 * point.scale}
                                    fill={lightFill}
                                    opacity="0.06"
                                    className="garden-breath"
                                />
                            </g>
                        ))}
                    </g>
                ) : null}

                {stars.map((star, index) => (
                    <path
                        key={`star-${index}`}
                        d={STAR_PATH}
                        transform={`translate(${star.x} ${star.y}) scale(${star.scale})`}
                        fill={palette.star}
                        opacity={star.opacity}
                        className="garden-twinkle garden-reveal"
                        data-parallax="far"
                    />
                ))}

                <path
                    d="M-24 216 C 46 176 110 170 176 190 C 234 208 298 212 424 182 L424 400 L-24 400 Z"
                    fill={`url(#${ids.hills})`}
                    className="garden-reveal"
                    data-parallax="far"
                />
                <path
                    d="M-24 246 C 36 214 108 208 180 222 C 250 236 318 240 424 220 L424 400 L-24 400 Z"
                    fill={`url(#${ids.hillsNear})`}
                    opacity="0.92"
                    className="garden-reveal"
                    data-parallax="mid"
                />
                <path
                    d="M-24 234 C 52 204 142 206 240 226 C 312 242 360 244 424 230"
                    fill="none"
                    stroke={`url(#${ids.mist})`}
                    strokeWidth="20"
                    strokeLinecap="round"
                    className="garden-drift garden-reveal"
                    data-x="6"
                    data-y="0"
                    data-duration="20"
                    data-parallax="far"
                />

                {archRings.length ? (
                    <g className="garden-reveal" data-parallax="mid" opacity={bandOpacity}>
                        {archRings.map((_, index) => (
                            <path
                                key={`celestial-arch-${index}`}
                                d={`M${54 + (index * 16)} ${244 - (index * 8)} C ${118 + (index * 8)} ${116 - (index * 8)} ${278 - (index * 8)} ${116 - (index * 8)} ${346 - (index * 16)} ${244 - (index * 8)}`}
                                fill="none"
                                stroke={cosmicStroke}
                                strokeWidth={1.05 - (index * 0.12)}
                                strokeDasharray={index % 2 === 0 ? '10 24' : '2 18'}
                                strokeLinecap="round"
                                opacity={0.18 - (index * 0.035)}
                                className="garden-drift"
                                data-x={index % 2 === 0 ? '1.8' : '-1.8'}
                                data-y="-1.2"
                                data-duration={18 + (index * 2)}
                            />
                        ))}
                    </g>
                ) : null}

                <ellipse
                    cx="200"
                    cy="314"
                    rx="168"
                    ry="54"
                    fill={`url(#${ids.pond})`}
                    className="garden-reveal"
                    data-parallax="mid"
                />
                <ellipse
                    cx={moonX - 12}
                    cy="278"
                    rx="26"
                    ry="74"
                    fill={`url(#${ids.reflection})`}
                    opacity={stageIndex >= 8 ? '0.38' : '0.22'}
                    filter={`url(#${ids.blur})`}
                    className="garden-breath garden-reveal"
                    data-parallax="mid"
                />
                <ellipse
                    cx="206"
                    cy="290"
                    rx="128"
                    ry="22"
                    fill={palette.light}
                    opacity="0.08"
                    filter={`url(#${ids.blur})`}
                    className="garden-breath garden-reveal"
                    data-parallax="mid"
                />
                {range(stageIndex >= 11 ? 4 : stageIndex >= 4 ? 3 : 2).map((index) => (
                    <ellipse
                        key={`ripple-${index}`}
                        cx="200"
                        cy={304 + (index * 10)}
                        rx={54 + (index * 26)}
                        ry={8 + (index * 2.4)}
                        fill="none"
                        stroke={palette.light}
                        strokeOpacity={0.16 - (index * 0.024)}
                        strokeWidth="1.25"
                        className="garden-ripple garden-reveal"
                        data-opacity={0.16 - (index * 0.024)}
                        data-parallax="near"
                    />
                ))}

                {stageIndex >= 14 ? (
                    <g className="garden-reveal" data-parallax="far" opacity={bandOpacity}>
                        <path
                            d="M46 148 C 106 114 146 120 198 150 C 252 180 300 180 356 136"
                            fill="none"
                            stroke={ribbonStroke}
                            strokeWidth={stageIndex >= 15 ? '2.8' : '2.2'}
                            strokeLinecap="round"
                            opacity={stageIndex >= 15 ? '0.28' : '0.18'}
                            filter={`url(#${ids.glow})`}
                            className="garden-drift"
                            data-x="2.2"
                            data-y="-1.4"
                            data-duration="16"
                        />
                        <path
                            d="M52 174 C 114 144 148 148 198 172 C 252 196 302 194 352 162"
                            fill="none"
                            stroke={cosmicStroke}
                            strokeWidth="1.05"
                            strokeLinecap="round"
                            strokeDasharray="8 18"
                            opacity="0.18"
                            className="garden-drift"
                            data-x="-1.8"
                            data-y="1.2"
                            data-duration="19"
                        />
                    </g>
                ) : null}

                <g data-parallax="mid" className="garden-reveal">
                    <path
                        d="M88 286 C 130 262 190 254 254 262 C 304 268 332 284 328 302 C 312 324 266 338 198 338 C 138 334 98 320 88 286 Z"
                        fill={`url(#${ids.island})`}
                    />
                    <path
                        d="M116 284 C 154 270 204 270 258 278 C 236 292 198 298 160 296 C 136 294 122 290 116 284 Z"
                        fill={palette.pondGlow}
                        opacity="0.18"
                    />
                    <ellipse cx="200" cy="298" rx="104" ry="18" fill={palette.light} opacity="0.05" className="garden-breath" />
                </g>

                {stageIndex === 0 ? (
                    <g data-parallax="mid" className="garden-reveal">
                        <ellipse cx="200" cy="288" rx="16" ry="7" fill={palette.bark} opacity="0.9" />
                        <circle cx="200" cy="280" r="6" fill={palette.light} opacity="0.82" className="garden-breath" />
                        <circle cx="200" cy="280" r="18" fill={lightFill} opacity="0.18" className="garden-breath" />
                    </g>
                ) : null}

                {reeds.filter((reed) => stageIndex >= reed.min).map((reed, index) => (
                    <Reed
                        key={`reed-${reed.x}`}
                        x={reed.x}
                        y={reed.y}
                        height={reed.height}
                        lean={reed.lean}
                        scale={reed.scale}
                        stemStroke={barkStroke}
                        leafFill={leafFill}
                        blossomFill={blossomFill}
                        coreFill={palette.light}
                        showBloom={stageIndex >= 4}
                        showSeed={stageIndex < 4}
                        sway={0.6 + (index * 0.08)}
                        duration={9.6 + (index * 0.45)}
                    />
                ))}

                {stageIndex >= 2 ? (
                    <g data-parallax="mid" className="garden-reveal">
                        <Reed
                            x={200}
                            y={300}
                            height={stageIndex >= 4 ? 44 : 34}
                            lean={stageIndex >= 4 ? 3 : 0}
                            scale={0.92}
                            stemStroke={barkStroke}
                            leafFill={leafFill}
                            blossomFill={blossomFill}
                            coreFill={palette.light}
                            showBloom={stageIndex >= 4}
                            showSeed={stageIndex < 4}
                            sway={0.48}
                            duration={11}
                        />
                    </g>
                ) : null}

                {visiblePondBlooms.map((bloom, index) => (
                    <g key={`pond-bloom-${bloom.x}`} data-parallax="near" className="garden-reveal" opacity={plantDetailOpacity}>
                        <ellipse
                            cx={bloom.x}
                            cy={bloom.y + 10}
                            rx={18 * bloom.scale}
                            ry={7 * bloom.scale}
                            fill={leafFill}
                            opacity="0.72"
                            className="garden-breath"
                        />
                        <LotusBloom
                            x={bloom.x}
                            y={bloom.y}
                            petals={index % 2 === 0 ? 6 : 7}
                            radius={14 * bloom.scale}
                            petalScale={0.26 * bloom.scale}
                            petalFill={blossomFill}
                            coreFill={palette.blossomCore}
                            coreRadius={3 * bloom.scale}
                            rotate={bloom.rotate}
                            glowFill={lightFill}
                            glowOpacity={0.08}
                            className="garden-breath"
                        />
                    </g>
                ))}

                {stageIndex >= 5 ? (
                    <g data-parallax="mid" className="garden-reveal">
                        <ellipse
                            cx={226}
                            cy={stageIndex >= 11 ? 146 : 162}
                            rx={stageIndex >= 11 ? 108 : 82}
                            ry={stageIndex >= 11 ? 58 : 44}
                            fill={lightFill}
                            opacity={stageIndex >= 10 ? '0.18' : '0.1'}
                            className="garden-breath"
                            data-parallax="far"
                        />
                        <g className="garden-sway" data-origin="202px 300px" data-rotate={stageIndex >= 12 ? '0.4' : '0.52'} data-duration="12.4">
                            <path
                                d={`M200 300 C 194 266 198 232 214 194 C 226 166 244 140 246 ${trunkTop}`}
                                fill="none"
                                stroke={barkStroke}
                                strokeWidth={stageIndex >= 10 ? '11' : '8'}
                                strokeLinecap="round"
                            />
                            <path d="M214 202 C 194 184 174 168 150 152" fill="none" stroke={barkStroke} strokeWidth="4.1" strokeLinecap="round" />
                            <path d="M224 178 C 246 162 270 154 298 156" fill="none" stroke={barkStroke} strokeWidth="3.8" strokeLinecap="round" />
                            {stageIndex >= 8 ? (
                                <>
                                    <path d="M232 152 C 248 136 270 122 294 112" fill="none" stroke={barkStroke} strokeWidth="2.8" strokeLinecap="round" />
                                    <path d="M206 230 C 178 220 148 216 118 224" fill="none" stroke={barkStroke} strokeWidth="3.2" strokeLinecap="round" />
                                </>
                            ) : null}
                        </g>

                        {visibleFronds.map((frond, index) => (
                            <WillowFrond
                                key={`frond-${frond.x}-${frond.y}`}
                                x={frond.x}
                                y={frond.y}
                                length={frond.length}
                                curve={frond.curve}
                                leafFill={leafFill}
                                blossomFill={blossomFill}
                                coreFill={palette.light}
                                withBloom={frond.bloom}
                                sway={frond.sway + (index * 0.03)}
                                duration={11 + (index * 0.45)}
                            />
                        ))}

                        <g opacity={plantDetailOpacity}>
                            {visibleCanopyBlooms.map((bloom) => (
                                <LotusBloom
                                    key={`canopy-bloom-${bloom.x}`}
                                    x={bloom.x}
                                    y={bloom.y}
                                    petals={stageIndex >= 14 ? 6 : 7}
                                    radius={14 * bloom.scale}
                                    petalScale={(stageIndex >= 14 ? 0.21 : 0.25) * bloom.scale}
                                    petalFill={blossomFill}
                                    coreFill={palette.blossomCore}
                                    coreRadius={3.2 * bloom.scale}
                                    rotate={bloom.rotate}
                                    glowFill={lightFill}
                                    glowOpacity={stageIndex >= 14 ? 0.04 : 0.1}
                                    ringStroke={stageIndex >= 12 && stageIndex < 14 ? palette.light : null}
                                    ringRadius={stageIndex >= 12 && stageIndex < 14 ? 10 * bloom.scale : 0}
                                    className="garden-breath"
                                />
                            ))}
                        </g>
                    </g>
                ) : null}

                {orbitNodes.length ? (
                    <g className="garden-orbit garden-reveal" data-duration={stageIndex >= 14 ? '64' : '66'} data-origin={`${moonX}px ${moonY}px`} data-parallax="near" opacity={bandOpacity}>
                        <circle cx={moonX} cy={moonY} r={stageIndex >= 14 ? '78' : '72'} fill="none" stroke={palette.light} strokeWidth="0.9" strokeDasharray="4 24" opacity="0.18" />
                        {orbitNodes.map((node, index) => (
                            <g key={`orbit-node-${index}`} className="garden-drift" data-x={node.light ? '2.2' : '-2.2'} data-y={node.light ? '-1.8' : '1.8'} data-duration={8.4 + (index * 0.6)}>
                                <circle cx={node.x} cy={node.y} r={node.light ? '4.4' : '3.4'} fill={node.light ? palette.light : palette.leafLight} className="garden-twinkle" />
                                <circle cx={node.x} cy={node.y} r={node.light ? '10' : '8'} fill={lightFill} opacity="0.16" className="garden-breath" />
                            </g>
                        ))}
                    </g>
                ) : null}

                {stageIndex >= 15 ? (
                    <g className="garden-reveal" data-parallax="far" opacity={bandOpacity}>
                        <path
                            d="M74 104 C 112 72 154 72 196 104 C 238 136 280 136 326 104 C 280 72 238 72 196 104 C 154 136 112 136 74 104 Z"
                            fill="none"
                            stroke={ribbonStroke}
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.34"
                            filter={`url(#${ids.glow})`}
                            className="garden-drift"
                            data-x="1.6"
                            data-y="-1.8"
                            data-duration="15"
                        />
                        <path
                            d="M112 104 C 142 84 170 84 196 104 C 224 126 254 126 286 104 C 254 84 224 84 196 104 C 170 126 142 126 112 104 Z"
                            fill="none"
                            stroke={palette.light}
                            strokeWidth="0.85"
                            strokeLinecap="round"
                            strokeDasharray="5 14"
                            opacity="0.3"
                            className="garden-orbit"
                            data-duration="72"
                            data-origin="200px 104px"
                        />
                    </g>
                ) : null}

                {fireflies.map((point, index) => (
                    <g
                        key={`firefly-${index}`}
                        className="garden-drift garden-reveal"
                        data-x={index % 2 === 0 ? '2.5' : '-2.5'}
                        data-y={-3 - (index % 3)}
                        data-duration={7 + ((index % 5) * 0.7)}
                        data-parallax="near"
                    >
                        <circle
                            cx={point.x}
                            cy={point.y}
                            r={2.1 * point.scale}
                            fill={palette.light}
                            opacity={(stageIndex >= 9 ? 0.8 : 0.58) * foregroundSparkleOpacity}
                            filter={`url(#${ids.glow})`}
                            className="garden-twinkle"
                        />
                    </g>
                ))}

                {cosmicDust.length ? (
                    <g data-parallax="far" opacity={bandOpacity}>
                        {cosmicDust.map((point, index) => (
                            <circle
                                key={`cosmic-dust-${index}`}
                                cx={point.x}
                                cy={point.y}
                                r={(index % 4 === 0 ? 1.9 : 1.1) * point.scale}
                                fill={index % 2 === 0 ? palette.blossomCore : palette.leafLight}
                                opacity={0.14 + ((index % 3) * 0.04)}
                                className="garden-drift garden-twinkle garden-reveal"
                                data-x={index % 2 === 0 ? '2.4' : '-2.4'}
                                data-y={-1.4 - (index % 3)}
                                data-duration={12 + ((index % 5) * 0.8)}
                            />
                        ))}
                    </g>
                ) : null}

                <g data-parallax="near" opacity={foregroundSparkleOpacity}>
                    {pollen.map((point, index) => (
                        <circle
                            key={`pollen-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={1.2 * point.scale}
                            fill={index % 3 === 0 ? palette.leafLight : palette.light}
                            opacity={stageIndex >= 10 ? 0.44 : 0.28}
                            className="garden-drift garden-twinkle garden-reveal"
                            data-x={index % 2 === 0 ? '1.8' : '-1.8'}
                            data-y={-2 - (index % 2)}
                            data-duration={10 + ((index % 4) * 0.9)}
                        />
                    ))}
                </g>

                <rect x="0" y="0" width="400" height="400" fill={`url(#${ids.vignette})`} pointerEvents="none" />
            </svg>

            {showInfo ? (
                <div className="mt-2 flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: palette.leafLight }}>
                        {stageName}
                    </span>
                    <span className="text-[9px] font-mono opacity-50 text-botanical-sepia">{streak} day streak</span>
                </div>
            ) : null}
        </div>
    );
}
