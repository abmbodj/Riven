import { useEffect, useId } from 'react';
import gsap from 'gsap';
import { gardenStages, getStageIndex } from '../utils/gardenCustomization';
import { useGSAP } from '../hooks/useGSAP';

const sizeMap = {
    sm: { width: 80, height: 80 },
    md: { width: 160, height: 160 },
    lg: { width: 240, height: 240 },
    xl: { width: 320, height: 320 }
};

const LEAF_PATH = 'M0 0 C -12 -8 -24 -32 0 -56 C 24 -32 12 -8 0 0 Z';
const PETAL_PATH = 'M0 0 C -11 -10 -17 -34 0 -58 C 17 -34 11 -10 0 0 Z';
const STAR_PATH = 'M0 -8 L3 -3 L8 0 L3 3 L0 8 L-3 3 L-8 0 L-3 -3 Z';

const palettes = [
    { bg1: '#EFEAE1', bg2: '#D8D1C0', ground: '#9B8F75', accent: '#7E6A4A', leaf: '#8AA17D', energy: '#F2E7C9' },
    { bg1: '#E8F1E0', bg2: '#BDD3A9', ground: '#758E62', accent: '#4F6B39', leaf: '#9BBE72', energy: '#F3F9D6' },
    { bg1: '#DCEFD8', bg2: '#A9CF99', ground: '#5F8553', accent: '#3A6434', leaf: '#76B56B', energy: '#D8F5C4' },
    { bg1: '#D8F0DF', bg2: '#88C59C', ground: '#4B8663', accent: '#285E44', leaf: '#51A86C', energy: '#C9F0D7' },
    { bg1: '#E6F2DF', bg2: '#A7D5B8', ground: '#5C9276', accent: '#2D725A', leaf: '#4DBA83', energy: '#FFD39B' },
    { bg1: '#D8EEE8', bg2: '#80C9C1', ground: '#2C7A77', accent: '#145D5C', leaf: '#29B8A8', energy: '#FFCAB8' },
    { bg1: '#D4EBEA', bg2: '#5AB4BB', ground: '#1B6772', accent: '#0D4650', leaf: '#0DB2BE', energy: '#FFA7AC' },
    { bg1: '#D6DDF5', bg2: '#7892EC', ground: '#324B96', accent: '#192D63', leaf: '#5A7FE3', energy: '#FFE0A8' },
    { bg1: '#E1D4F5', bg2: '#9A7BDA', ground: '#58358F', accent: '#2F1A56', leaf: '#8A58EA', energy: '#FFBFD9' },
    { bg1: '#F2E3FA', bg2: '#D296E3', ground: '#8E3DA2', accent: '#4E1B67', leaf: '#C06BDA', energy: '#FFE3F1' },
    { bg1: '#171120', bg2: '#47245E', ground: '#1B1028', accent: '#E4AFF8', leaf: '#F7CAF6', energy: '#FFD861' },
    { bg1: '#0F182C', bg2: '#1F314C', ground: '#06101F', accent: '#4DCBF7', leaf: '#89DFFF', energy: '#D7F6FF' },
    { bg1: '#060B16', bg2: '#1A2B58', ground: '#050913', accent: '#8AF3FF', leaf: '#D8FBFF', energy: '#FFFFFF' },
    { bg1: '#0F0C20', bg2: '#32204E', ground: '#070311', accent: '#FF82C2', leaf: '#FDAFC2', energy: '#FFF4FB' },
    { bg1: '#090414', bg2: '#4A1B90', ground: '#010103', accent: '#A073FF', leaf: '#D1BFFF', energy: '#FAF2FF' },
    { bg1: '#020204', bg2: '#152035', ground: '#000000', accent: '#3BDEA0', leaf: '#82F0C7', energy: '#E5FFF5' }
];

const range = (count) => Array.from({ length: count }, (_, index) => index);

const radialScatter = (count, centerX, centerY, radiusX, radiusY, angleOffset = 0) => (
    range(count).map((index) => {
        const angle = ((index * 137.5) + angleOffset) * (Math.PI / 180);
        const ratio = 0.22 + (((index + 1) / (count + 1)) * 0.78);
        return {
            x: centerX + (Math.cos(angle) * radiusX * ratio),
            y: centerY + (Math.sin(angle) * radiusY * ratio),
            angle: angle * (180 / Math.PI),
            size: 0.65 + ((index % 4) * 0.14),
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

function Rosette({
    x,
    y,
    petals = 6,
    radius = 16,
    petalScale = 0.35,
    petalFill,
    coreFill,
    coreRadius = 5,
    rotate = 0,
    className = '',
    ringStroke,
    ringRadius = 0,
    glowFill = null,
    glowOpacity = 0.18
}) {
    return (
        <g transform={`translate(${x} ${y}) rotate(${rotate})`} className={className} data-origin={`${x}px ${y}px`}>
            {glowFill ? <circle r={radius * 1.5} fill={glowFill} opacity={glowOpacity} className="garden-breath" /> : null}
            {range(petals).map((index) => (
                <g key={index} transform={`rotate(${(360 / petals) * index}) translate(0 ${-radius})`}>
                    <path d={PETAL_PATH} fill={petalFill} opacity={index % 2 === 0 ? 0.95 : 0.8} transform={`scale(${petalScale})`} />
                </g>
            ))}
            {ringStroke && ringRadius ? (
                <circle r={ringRadius} fill="none" stroke={ringStroke} strokeWidth="1.6" opacity="0.8" />
            ) : null}
            <circle r={coreRadius} fill={coreFill} />
        </g>
    );
}

function Sprig({
    x,
    y,
    height = 42,
    lean = 0,
    scale = 1,
    stemStroke,
    leafFill,
    petalFill,
    coreFill,
    showBloom = false,
    showSeed = false,
    swayOrigin,
    sway = 1.8,
    duration = 5.4
}) {
    const tipX = x + lean;
    const tipY = y - height;

    return (
        <g className="garden-sway" data-origin={swayOrigin ?? `${x}px ${y}px`} data-rotate={sway} data-duration={duration}>
            <path
                d={`M${x} ${y} C ${x - 4} ${y - (height * 0.35)} ${x + (lean * 0.45)} ${y - (height * 0.7)} ${tipX} ${tipY}`}
                fill="none"
                stroke={stemStroke}
                strokeWidth={2.4 * scale}
                strokeLinecap="round"
            />
            <LeafBlade x={x - 6} y={y - (height * 0.6)} rotate={-70 + (lean * 0.35)} scale={0.32 * scale} fill={leafFill} opacity="0.92" />
            <LeafBlade x={x + 9} y={y - (height * 0.42)} rotate={55 + (lean * 0.2)} scale={0.28 * scale} fill={leafFill} opacity="0.82" />
            {showBloom ? (
                <Rosette
                    x={tipX}
                    y={tipY}
                    petals={5}
                    radius={11 * scale}
                    petalScale={0.24 * scale}
                    petalFill={petalFill}
                    coreFill={coreFill}
                    coreRadius={2.8 * scale}
                    className="garden-breath"
                    glowFill={coreFill}
                    glowOpacity="0.12"
                />
            ) : null}
            {showSeed ? (
                <ellipse
                    cx={tipX}
                    cy={tipY}
                    rx={5 * scale}
                    ry={7 * scale}
                    fill={coreFill}
                    opacity="0.92"
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
    showInfo = true
}) {
    const uniqueId = useId();
    const { width, height } = sizeMap[size] || sizeMap.md;
    const stageIndex = getStageIndex(streak);
    const palette = palettes[Math.min(stageIndex, palettes.length - 1)];
    const stageMeta = gardenStages[Math.min(stageIndex, gardenStages.length - 1)] ?? gardenStages[0];
    const stageName = stageMeta.name;
    const isWilting = status === 'broken';
    const isAtRisk = status === 'at-risk';
    const statusFilter = isWilting ? 'grayscale(0.82) saturate(0.78) opacity(0.72)' : isAtRisk ? 'saturate(0.82) sepia(0.14)' : 'none';

    const ids = {
        sky: `garden-sky-${uniqueId}`,
        atmosphere: `garden-atmosphere-${uniqueId}`,
        ground: `garden-ground-${uniqueId}`,
        soil: `garden-soil-${uniqueId}`,
        trunk: `garden-trunk-${uniqueId}`,
        leaf: `garden-leaf-${uniqueId}`,
        petal: `garden-petal-${uniqueId}`,
        energy: `garden-energy-${uniqueId}`,
        mist: `garden-mist-${uniqueId}`,
        blur: `garden-blur-${uniqueId}`,
        glow: `garden-glow-${uniqueId}`,
        title: `garden-title-${uniqueId}`,
        desc: `garden-desc-${uniqueId}`,
    };

    const leafFill = `url(#${ids.leaf})`;
    const petalFill = `url(#${ids.petal})`;
    const energyFill = `url(#${ids.energy})`;
    const trunkStroke = `url(#${ids.trunk})`;
    const particlePoints = radialScatter(
        stageIndex >= 13 ? 30 : stageIndex >= 10 ? 24 : stageIndex >= 5 ? 16 : 8,
        200,
        stageIndex >= 13 ? 190 : 168,
        stageIndex >= 13 ? 170 : 145,
        stageIndex >= 13 ? 148 : 108,
        stageIndex * 13
    );
    const starCount = stageIndex >= 13 ? 18 : stageIndex >= 11 ? 12 : stageIndex >= 8 ? 7 : 0;
    const stars = range(starCount).map((index) => ({
        x: 28 + ((index * 53) % 344),
        y: 24 + ((index * 31) % 140),
        scale: 0.68 + ((index % 4) * 0.12),
        opacity: 0.45 + ((index % 3) * 0.18),
    }));

    const { container } = useGSAP(({ selector }) => {
        const q = selector;

        q('.garden-sway').forEach((element) => {
            gsap.to(element, {
                rotate: Number(element.dataset.rotate ?? 1.8),
                duration: Number(element.dataset.duration ?? 5.4),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                transformOrigin: element.dataset.origin ?? 'center bottom',
            });
        });

        q('.garden-drift').forEach((element, index) => {
            gsap.to(element, {
                x: Number(element.dataset.x ?? 0),
                y: Number(element.dataset.y ?? -8),
                duration: Number(element.dataset.duration ?? 6) + ((index % 3) * 0.4),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                delay: index * 0.08,
            });
        });

        q('.garden-breath').forEach((element, index) => {
            const baseOpacity = Number(element.dataset.opacity ?? element.getAttribute('opacity') ?? 1);
            gsap.to(element, {
                scale: 1.04 + ((index % 3) * 0.02),
                opacity: Math.min(1, baseOpacity + (baseOpacity < 0.3 ? 0.08 : 0.05)),
                duration: 2.8 + ((index % 4) * 0.35),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                transformOrigin: element.dataset.origin ?? 'center center',
            });
        });

        q('.garden-twinkle').forEach((element, index) => {
            gsap.to(element, {
                opacity: 0.28 + ((index % 5) * 0.13),
                scale: 0.82 + ((index % 4) * 0.11),
                duration: 1.6 + ((index % 6) * 0.22),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                delay: index * 0.04,
                transformOrigin: element.dataset.origin ?? 'center center',
            });
        });

        q('.garden-orbit').forEach((element, index) => {
            gsap.to(element, {
                rotation: index % 2 === 0 ? 360 : -360,
                duration: Number(element.dataset.duration ?? 26) + (index * 4),
                ease: 'none',
                repeat: -1,
                transformOrigin: element.dataset.origin ?? '200px 200px',
            });
        });

        q('.garden-core').forEach((element) => {
            gsap.to(element, {
                scale: stageIndex >= 14 ? 1.08 : 1.05,
                duration: stageIndex >= 14 ? 2.8 : 3.2,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                transformOrigin: element.dataset.origin ?? '200px 200px',
            });
        });
    }, [stageIndex, size]);

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

        const farX = gsap.quickTo(far, 'x', { duration: 1.1, ease: 'power3.out' });
        const farY = gsap.quickTo(far, 'y', { duration: 1.1, ease: 'power3.out' });
        const midX = gsap.quickTo(mid, 'x', { duration: 0.95, ease: 'power3.out' });
        const midY = gsap.quickTo(mid, 'y', { duration: 0.95, ease: 'power3.out' });
        const nearX = gsap.quickTo(near, 'x', { duration: 0.8, ease: 'power3.out' });
        const nearY = gsap.quickTo(near, 'y', { duration: 0.8, ease: 'power3.out' });

        const reset = () => {
            farX(0);
            farY(0);
            midX(0);
            midY(0);
            nearX(0);
            nearY(0);
        };

        const onMove = (event) => {
            const rect = node.getBoundingClientRect();
            const xProgress = ((event.clientX - rect.left) / rect.width) - 0.5;
            const yProgress = ((event.clientY - rect.top) / rect.height) - 0.5;

            farX(xProgress * 10);
            farY(yProgress * 8);
            midX(xProgress * 18);
            midY(yProgress * 14);
            nearX(xProgress * 26);
            nearY(yProgress * 18);
        };

        node.addEventListener('pointermove', onMove);
        node.addEventListener('pointerleave', reset);

        return () => {
            reset();
            node.removeEventListener('pointermove', onMove);
            node.removeEventListener('pointerleave', reset);
        };
    }, [container, size, stageIndex]);

    const renderTerrainBackdrop = () => {
        if (stageIndex >= 11) {
            return (
                <>
                    <ellipse
                        cx="132"
                        cy="118"
                        rx="110"
                        ry="70"
                        fill={`url(#${ids.atmosphere})`}
                        opacity="0.28"
                        className="garden-breath"
                        data-parallax="far"
                    />
                    <ellipse
                        cx="280"
                        cy="176"
                        rx="122"
                        ry="74"
                        fill={`url(#${ids.energy})`}
                        opacity={stageIndex >= 13 ? '0.22' : '0.12'}
                        filter={`url(#${ids.blur})`}
                        className="garden-drift"
                        data-x="0"
                        data-y="-10"
                        data-duration="9"
                        data-parallax="far"
                    />
                    {stars.map((star, index) => (
                        <path
                            key={`star-${index}`}
                            d={STAR_PATH}
                            transform={`translate(${star.x} ${star.y}) scale(${star.scale})`}
                            fill={palette.energy}
                            opacity={star.opacity}
                            className="garden-twinkle"
                            data-parallax="far"
                        />
                    ))}
                </>
            );
        }

        return (
            <>
                <ellipse
                    cx="220"
                    cy="110"
                    rx={stageIndex >= 7 ? '132' : '112'}
                    ry={stageIndex >= 7 ? '84' : '68'}
                    fill={`url(#${ids.atmosphere})`}
                    opacity={stageIndex >= 4 ? '0.26' : '0.14'}
                    className="garden-breath"
                    data-parallax="far"
                />
                <path
                    d="M-24 246 C 32 208 98 202 156 225 C 207 244 280 248 424 210 L424 400 L-24 400 Z"
                    fill={`url(#${ids.mist})`}
                    opacity="0.62"
                    className="garden-drift"
                    data-x="0"
                    data-y="-8"
                    data-duration="8"
                    data-parallax="far"
                />
                <path
                    d="M-24 278 C 46 236 112 234 180 256 C 238 274 312 282 424 248 L424 400 L-24 400 Z"
                    fill={palette.bg2}
                    opacity="0.48"
                    className="garden-drift"
                    data-x="0"
                    data-y="-6"
                    data-duration="7.2"
                    data-parallax="far"
                />
            </>
        );
    };

    const renderEarthHero = () => {
        if (stageIndex === 0) {
            return (
                <g data-parallax="mid">
                    <path d="M110 292 C 160 278 238 280 290 294" fill="none" stroke={palette.accent} strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
                    <path d="M146 304 C 152 292 160 288 172 284" fill="none" stroke={palette.accent} strokeOpacity="0.22" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M220 304 C 226 292 236 288 252 284" fill="none" stroke={palette.accent} strokeOpacity="0.22" strokeWidth="1.6" strokeLinecap="round" />
                    <ellipse cx="200" cy="298" rx="18" ry="8" fill={palette.accent} opacity="0.9" className="garden-breath" />
                </g>
            );
        }

        const trunkTopY = stageIndex < 4 ? 272 - (stageIndex * 22) : stageIndex < 7 ? 218 - ((stageIndex - 4) * 14) : 116;
        const canopyNodes = [
            { x: 172, y: 214, min: 2, rotate: -22, scale: 0.72, branch: 'M200 286 C 184 262 178 236 172 214' },
            { x: 236, y: 202, min: 3, rotate: 18, scale: 0.74, branch: 'M200 258 C 214 236 228 216 236 202' },
            { x: 120, y: 176, min: 4, rotate: -34, scale: 0.78, branch: 'M194 242 C 170 214 146 192 120 176' },
            { x: 278, y: 168, min: 5, rotate: 34, scale: 0.8, branch: 'M210 228 C 234 204 254 182 278 168' },
            { x: 202, y: 146, min: 5, rotate: 0, scale: 0.9, branch: 'M202 208 C 204 186 205 166 202 146' },
            { x: 156, y: 132, min: 7, rotate: -18, scale: 0.68, branch: 'M190 186 C 176 164 166 146 156 132' },
            { x: 246, y: 126, min: 8, rotate: 18, scale: 0.68, branch: 'M212 180 C 228 156 236 142 246 126' }
        ];
        const edgePlants = [
            { x: 66, y: 318, lean: -10, height: 40, min: 1, scale: 0.86 },
            { x: 118, y: 324, lean: 8, height: 36, min: 2, scale: 0.75 },
            { x: 282, y: 322, lean: -7, height: 40, min: 2, scale: 0.82 },
            { x: 336, y: 316, lean: 10, height: 48, min: 3, scale: 0.92 },
            { x: 40, y: 328, lean: -4, height: 30, min: 5, scale: 0.6 },
            { x: 360, y: 326, lean: 6, height: 34, min: 5, scale: 0.64 }
        ];

        return (
            <g data-parallax="mid">
                {stageIndex >= 4 ? (
                    <ellipse
                        cx="200"
                        cy={stageIndex >= 7 ? '144' : '176'}
                        rx={stageIndex >= 7 ? '118' : '88'}
                        ry={stageIndex >= 7 ? '76' : '56'}
                        fill={energyFill}
                        opacity={stageIndex >= 8 ? '0.18' : '0.12'}
                        className="garden-breath"
                        data-parallax="far"
                    />
                ) : null}

                {stageIndex >= 6 ? (
                    <ellipse cx="220" cy="306" rx="56" ry="14" fill={energyFill} opacity="0.18" className="garden-breath" />
                ) : null}

                <g className="garden-sway" data-origin="200px 308px" data-rotate={stageIndex >= 8 ? '1.3' : '1.8'} data-duration={stageIndex >= 8 ? '6.4' : '5.2'}>
                    <path
                        d={`M200 314 C 188 282 190 250 198 220 C 206 184 210 156 202 ${trunkTopY}`}
                        fill="none"
                        stroke={trunkStroke}
                        strokeWidth={stageIndex >= 8 ? '18' : stageIndex >= 5 ? '14' : stageIndex >= 3 ? '9' : '5'}
                        strokeLinecap="round"
                    />
                    {stageIndex >= 3 ? (
                        <>
                            <path d="M196 276 C 178 260 164 248 146 240" fill="none" stroke={trunkStroke} strokeWidth="5.8" strokeLinecap="round" />
                            <path d="M204 250 C 220 236 236 222 252 214" fill="none" stroke={trunkStroke} strokeWidth="5.2" strokeLinecap="round" />
                        </>
                    ) : null}
                    {stageIndex >= 5 ? (
                        <>
                            <path d="M194 244 C 170 214 146 194 118 176" fill="none" stroke={trunkStroke} strokeWidth="4.4" strokeLinecap="round" />
                            <path d="M208 228 C 232 202 252 186 280 166" fill="none" stroke={trunkStroke} strokeWidth="4" strokeLinecap="round" />
                            <path d="M204 214 C 206 190 206 172 204 146" fill="none" stroke={trunkStroke} strokeWidth="4.2" strokeLinecap="round" />
                        </>
                    ) : null}
                    {stageIndex >= 8 ? (
                        <>
                            <path d="M188 204 C 172 176 162 154 154 130" fill="none" stroke={trunkStroke} strokeWidth="3" strokeLinecap="round" />
                            <path d="M214 196 C 230 170 238 150 248 126" fill="none" stroke={trunkStroke} strokeWidth="3" strokeLinecap="round" />
                        </>
                    ) : null}
                </g>

                {canopyNodes.filter((node) => stageIndex >= node.min).map((node, index) => (
                    <g key={`canopy-${node.x}-${node.y}`}>
                        <path d={node.branch} fill="none" stroke={trunkStroke} strokeWidth={stageIndex >= 8 ? '2.6' : '2'} strokeLinecap="round" opacity="0.86" />
                        {stageIndex < 4 ? (
                            <g className="garden-sway" data-origin={`${node.x}px ${node.y}px`} data-rotate="3" data-duration={4.6 + (index * 0.3)}>
                                <LeafBlade x={node.x - 7} y={node.y + 4} rotate={-80 + node.rotate} scale={0.48 * node.scale} fill={leafFill} />
                                <LeafBlade x={node.x + 6} y={node.y + 3} rotate={62 + node.rotate} scale={0.42 * node.scale} fill={leafFill} opacity="0.82" />
                            </g>
                        ) : (
                            <Rosette
                                x={node.x}
                                y={node.y}
                                petals={stageIndex >= 8 ? 8 : 6}
                                radius={(stageIndex >= 8 ? 18 : 14) * node.scale}
                                petalScale={(stageIndex >= 8 ? 0.34 : 0.28) * node.scale}
                                petalFill={stageIndex >= 8 ? energyFill : petalFill}
                                coreFill={stageIndex >= 8 ? palette.energy : palette.accent}
                                coreRadius={(stageIndex >= 8 ? 4.8 : 3.6) * node.scale}
                                rotate={node.rotate}
                                className="garden-breath"
                                ringStroke={stageIndex >= 9 ? palette.energy : null}
                                ringRadius={stageIndex >= 9 ? 8 * node.scale : 0}
                                glowFill={energyFill}
                            />
                        )}
                    </g>
                ))}

                {stageIndex >= 7 ? (
                    <>
                        <path d="M134 188 C 126 204 122 218 124 232" fill="none" stroke={palette.energy} strokeWidth="1.6" opacity="0.56" />
                        <circle cx="124" cy="238" r="7" fill={stageIndex >= 9 ? energyFill : petalFill} className="garden-drift" data-x="0" data-y="-5" data-duration="4.2" />
                        <path d="M260 174 C 272 194 276 208 276 222" fill="none" stroke={palette.energy} strokeWidth="1.4" opacity="0.56" />
                        <circle cx="276" cy="228" r="6" fill={energyFill} className="garden-drift" data-x="0" data-y="-4" data-duration="4.8" />
                    </>
                ) : null}

                {stageIndex >= 9 ? (
                    <g className="garden-orbit" data-duration={stageIndex >= 10 ? '22' : '28'} data-origin="200px 184px" data-parallax="near">
                        <circle cx="200" cy="184" r="72" fill="none" stroke={palette.energy} strokeWidth="1.4" strokeDasharray="5 16" opacity="0.45" />
                        <circle cx="272" cy="184" r="5" fill={palette.energy} className="garden-twinkle" />
                        <circle cx="128" cy="184" r="4" fill={palette.leaf} className="garden-twinkle" />
                    </g>
                ) : null}

                {edgePlants.filter((plant) => stageIndex >= plant.min).map((plant, index) => (
                    <Sprig
                        key={`edge-${plant.x}`}
                        x={plant.x}
                        y={plant.y}
                        height={plant.height}
                        lean={plant.lean}
                        scale={plant.scale}
                        stemStroke={trunkStroke}
                        leafFill={leafFill}
                        petalFill={stageIndex >= 8 ? energyFill : petalFill}
                        coreFill={palette.energy}
                        showBloom={stageIndex >= 4}
                        showSeed={stageIndex < 4}
                        sway={1.6 + (index * 0.2)}
                        duration={5.2 + (index * 0.3)}
                    />
                ))}
            </g>
        );
    };

    const renderAstralHero = () => (
        <g data-parallax="mid">
            <g className="garden-drift garden-island" data-x="0" data-y="-9" data-duration="6.8">
                <path
                    d="M98 274 C 126 254 172 248 224 258 C 268 266 304 268 322 282 C 306 312 266 330 202 334 C 142 328 104 312 98 274 Z"
                    fill={`url(#${ids.ground})`}
                />
                <path
                    d="M114 278 C 158 264 220 266 286 280 C 268 296 228 304 192 302 C 150 300 126 294 114 278 Z"
                    fill={palette.accent}
                    opacity="0.55"
                />
                {range(4).map((index) => {
                    const rootX = 138 + (index * 34);
                    const rootEnd = 356 + ((index % 2) * 16);
                    return (
                        <path
                            key={`root-${index}`}
                            d={`M${rootX} 310 C ${rootX - 8} 326 ${rootX + 4} 340 ${rootX - 2} ${rootEnd}`}
                            fill="none"
                            stroke={palette.accent}
                            strokeWidth={index === 1 ? '3.2' : '2.3'}
                            strokeLinecap="round"
                            opacity="0.76"
                            className="garden-sway"
                            data-origin={`${rootX}px 310px`}
                            data-rotate={index % 2 === 0 ? '-3' : '3'}
                            data-duration={5.4 + (index * 0.4)}
                        />
                    );
                })}
            </g>

            <ellipse cx="198" cy="160" rx="120" ry="86" fill={energyFill} opacity="0.2" className="garden-breath" data-parallax="far" />
            <g className="garden-orbit" data-duration="28" data-origin="200px 176px" data-parallax="near">
                <circle cx="200" cy="176" r="86" fill="none" stroke={palette.energy} strokeWidth="1.5" strokeDasharray="5 18" opacity="0.58" />
                <circle cx="200" cy="176" r="106" fill="none" stroke={palette.accent} strokeWidth="1.2" strokeDasharray="2 16" opacity="0.42" />
            </g>

            <g className="garden-sway" data-origin="200px 286px" data-rotate="1.1" data-duration="7.2">
                <path
                    d="M200 286 C 184 252 176 220 184 192 C 194 154 210 126 206 92"
                    fill="none"
                    stroke={trunkStroke}
                    strokeWidth="12"
                    strokeLinecap="round"
                />
                <path d="M188 210 C 160 190 146 172 136 148" fill="none" stroke={trunkStroke} strokeWidth="4.4" strokeLinecap="round" />
                <path d="M204 190 C 228 174 250 154 266 132" fill="none" stroke={trunkStroke} strokeWidth="4" strokeLinecap="round" />
                <path d="M202 158 C 210 138 226 120 246 102" fill="none" stroke={trunkStroke} strokeWidth="3.4" strokeLinecap="round" />
            </g>

            <Rosette
                x="206"
                y="82"
                petals={stageIndex >= 12 ? 10 : 8}
                radius={28}
                petalScale={0.42}
                petalFill={energyFill}
                coreFill={palette.energy}
                coreRadius="8"
                className="garden-core"
                glowFill={energyFill}
                ringStroke={palette.accent}
                ringRadius="20"
            />
            <Rosette
                x="138"
                y="146"
                petals={7}
                radius={18}
                petalScale={0.32}
                petalFill={petalFill}
                coreFill={palette.energy}
                coreRadius="5"
                rotate="-20"
                className="garden-breath"
                glowFill={energyFill}
            />
            <Rosette
                x="268"
                y="128"
                petals={7}
                radius={18}
                petalScale={0.32}
                petalFill={petalFill}
                coreFill={palette.energy}
                coreRadius="5"
                rotate="20"
                className="garden-breath"
                glowFill={energyFill}
            />
            <Rosette
                x="246"
                y="104"
                petals={6}
                radius={14}
                petalScale={0.28}
                petalFill={energyFill}
                coreFill={palette.energy}
                coreRadius="4"
                className="garden-breath"
            />

            <LeafBlade x="172" y="182" rotate="-62" scale="0.7" fill={leafFill} className="garden-sway" />
            <LeafBlade x="224" y="164" rotate="48" scale="0.68" fill={leafFill} className="garden-sway" />
            <LeafBlade x="146" y="218" rotate="-78" scale="0.54" fill={leafFill} className="garden-sway" />
            <LeafBlade x="264" y="186" rotate="65" scale="0.52" fill={leafFill} className="garden-sway" />

            {range(stageIndex >= 12 ? 6 : 4).map((index) => {
                const crystalX = 130 + (index * 28);
                const crystalHeight = 18 + ((index % 3) * 8);
                return (
                    <path
                        key={`crystal-${index}`}
                        d={`M${crystalX} 272 L${crystalX + 8} ${272 - crystalHeight} L${crystalX + 16} 272 L${crystalX + 8} ${278 + (index % 2 === 0 ? 8 : 5)} Z`}
                        fill={index % 2 === 0 ? petalFill : energyFill}
                        opacity="0.82"
                        className="garden-breath"
                    />
                );
            })}
        </g>
    );

    const renderCosmicHero = () => (
        <g data-parallax="mid">
            <ellipse cx="200" cy="318" rx="120" ry="24" fill={energyFill} opacity="0.2" className="garden-breath" />
            <path d="M110 320 C 148 298 252 298 290 320 C 252 342 148 342 110 320 Z" fill={`url(#${ids.ground})`} opacity="0.7" className="garden-breath" />
            <path d="M200 294 C 194 258 194 228 200 206" fill="none" stroke={trunkStroke} strokeWidth="8" strokeLinecap="round" opacity="0.9" />

            <g className="garden-orbit" data-duration={stageIndex >= 15 ? '18' : '24'} data-origin="200px 188px" data-parallax="near">
                <circle cx="200" cy="188" r={stageIndex >= 15 ? '124' : '106'} fill="none" stroke={palette.energy} strokeWidth="1.5" strokeDasharray="6 18" opacity="0.42" />
                <circle cx="200" cy="188" r={stageIndex >= 15 ? '88' : '76'} fill="none" stroke={palette.accent} strokeWidth="1.3" strokeDasharray="2 12" opacity="0.5" />
            </g>
            <g className="garden-orbit" data-duration={stageIndex >= 15 ? '26' : '32'} data-origin="200px 188px" data-parallax="near">
                <polygon points="200,38 324,112 324,266 200,340 76,266 76,112" fill="none" stroke={palette.leaf} strokeWidth="1.3" opacity="0.36" />
            </g>

            <Rosette
                x="200"
                y="188"
                petals={stageIndex >= 15 ? 16 : stageIndex >= 14 ? 14 : 12}
                radius={stageIndex >= 15 ? 58 : 48}
                petalScale={stageIndex >= 15 ? 0.5 : 0.42}
                petalFill={energyFill}
                coreFill={palette.energy}
                coreRadius={stageIndex >= 15 ? '13' : '11'}
                className="garden-core"
                glowFill={energyFill}
                ringStroke={palette.energy}
                ringRadius={stageIndex >= 15 ? '36' : '30'}
            />
            <Rosette
                x="200"
                y="188"
                petals={stageIndex >= 15 ? 10 : 8}
                radius={stageIndex >= 15 ? 26 : 22}
                petalScale={0.28}
                petalFill={petalFill}
                coreFill={palette.accent}
                coreRadius="6"
                rotate="22"
                className="garden-core"
                glowFill={energyFill}
            />

            {range(stageIndex >= 15 ? 10 : 8).map((index) => {
                const angle = (360 / (stageIndex >= 15 ? 10 : 8)) * index;
                const translateY = stageIndex >= 15 ? -92 : -80;
                return (
                    <g key={`crown-${angle}`} transform={`translate(200 188) rotate(${angle}) translate(0 ${translateY})`}>
                        <LeafBlade x="0" y="0" rotate="0" scale={stageIndex >= 15 ? 0.66 : 0.58} fill={leafFill} className="garden-breath" />
                    </g>
                );
            })}

            {range(stageIndex >= 15 ? 8 : 6).map((index) => {
                const angle = (360 / (stageIndex >= 15 ? 8 : 6)) * index;
                const radius = stageIndex >= 15 ? 124 : 106;
                const radians = angle * (Math.PI / 180);
                const x = 200 + (Math.cos(radians) * radius);
                const y = 188 + (Math.sin(radians) * radius);
                return (
                    <g key={`orbit-node-${index}`} className="garden-drift" data-x={index % 2 === 0 ? '5' : '-5'} data-y={index % 2 === 0 ? '-4' : '4'} data-duration={4.8 + (index * 0.3)}>
                        <circle cx={x} cy={y} r={stageIndex >= 15 ? '8' : '6'} fill={index % 2 === 0 ? energyFill : petalFill} className="garden-twinkle" />
                        <circle cx={x} cy={y} r={stageIndex >= 15 ? '16' : '12'} fill={energyFill} opacity="0.14" className="garden-breath" />
                    </g>
                );
            })}
        </g>
    );

    const renderForegroundParticles = () => (
        <g data-parallax="near">
            {particlePoints.map((point, index) => (
                <g
                    key={`particle-${index}`}
                    className="garden-drift"
                    data-x={((index % 2 === 0 ? 1 : -1) * (4 + (index % 4)))}
                    data-y={-4 - ((index % 3) * 2)}
                    data-duration={3.4 + ((index % 5) * 0.35)}
                >
                    <circle
                        cx={point.x}
                        cy={point.y}
                        r={(stageIndex >= 13 ? 2.4 : 1.8) * point.size}
                        fill={index % 3 === 0 ? palette.leaf : palette.energy}
                        opacity={stageIndex >= 13 ? 0.74 : 0.52}
                        className="garden-twinkle"
                    />
                </g>
            ))}
        </g>
    );

    return (
        <div
            ref={container}
            style={{ filter: statusFilter, transition: 'filter 0.9s ease, opacity 0.9s ease' }}
            className="flex flex-col items-center"
        >
            <svg
                viewBox="0 0 400 400"
                width={width}
                height={height}
                role="img"
                aria-labelledby={ids.title}
                aria-describedby={ids.desc}
                className="rounded-3xl shadow-md md:shadow-2xl overflow-hidden transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-1000 ease-in-out"
            >
                <title id={ids.title}>{`${stageName} garden`}</title>
                <desc id={ids.desc}>{`Illustrated study streak garden for a ${streak} day streak.`}</desc>

                <defs>
                    <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.bg1} />
                        <stop offset="100%" stopColor={palette.bg2} />
                    </linearGradient>
                    <radialGradient id={ids.atmosphere} cx="50%" cy="45%" r="55%">
                        <stop offset="0%" stopColor={palette.energy} stopOpacity="0.85" />
                        <stop offset="65%" stopColor={palette.leaf} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={palette.bg2} stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id={ids.ground} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.ground} />
                        <stop offset="100%" stopColor={palette.accent} />
                    </linearGradient>
                    <linearGradient id={ids.soil} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={palette.accent} />
                        <stop offset="50%" stopColor={palette.ground} />
                        <stop offset="100%" stopColor={palette.accent} />
                    </linearGradient>
                    <linearGradient id={ids.trunk} x1="0" y1="1" x2="0.8" y2="0">
                        <stop offset="0%" stopColor={palette.ground} />
                        <stop offset="50%" stopColor={palette.accent} />
                        <stop offset="100%" stopColor={palette.energy} />
                    </linearGradient>
                    <linearGradient id={ids.leaf} x1="0" y1="1" x2="0.8" y2="0">
                        <stop offset="0%" stopColor={palette.leaf} />
                        <stop offset="100%" stopColor={palette.energy} />
                    </linearGradient>
                    <linearGradient id={ids.petal} x1="0" y1="1" x2="0.7" y2="0">
                        <stop offset="0%" stopColor={palette.accent} />
                        <stop offset="100%" stopColor={palette.energy} />
                    </linearGradient>
                    <radialGradient id={ids.energy} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={palette.energy} stopOpacity="1" />
                        <stop offset="65%" stopColor={palette.leaf} stopOpacity="0.45" />
                        <stop offset="100%" stopColor={palette.bg2} stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id={ids.mist} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={palette.energy} stopOpacity="0" />
                        <stop offset="50%" stopColor={palette.energy} stopOpacity="0.26" />
                        <stop offset="100%" stopColor={palette.energy} stopOpacity="0" />
                    </linearGradient>
                    <filter id={ids.blur}>
                        <feGaussianBlur stdDeviation="12" />
                    </filter>
                    <filter id={ids.glow}>
                        <feGaussianBlur stdDeviation="3.5" result="blurred" />
                        <feMerge>
                            <feMergeNode in="blurred" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <rect x="0" y="0" width="400" height="400" fill={`url(#${ids.sky})`} />
                {renderTerrainBackdrop()}

                {stageIndex < 11 ? (
                    <>
                        <path
                            d="M-24 304 C 54 264 126 258 198 282 C 264 304 338 306 424 270 L424 400 L-24 400 Z"
                            fill={`url(#${ids.ground})`}
                            data-parallax="mid"
                        />
                        <path
                            d="M-24 330 C 68 292 136 296 212 314 C 274 328 342 332 424 304 L424 400 L-24 400 Z"
                            fill={`url(#${ids.soil})`}
                            opacity="0.34"
                            data-parallax="mid"
                        />
                    </>
                ) : null}

                {stageIndex < 11 ? renderEarthHero() : null}
                {stageIndex >= 11 && stageIndex < 13 ? renderAstralHero() : null}
                {stageIndex >= 13 ? renderCosmicHero() : null}
                {stageIndex >= 2 ? renderForegroundParticles() : null}
            </svg>

            {showInfo ? (
                <div className="flex flex-col items-center mt-2 gap-0.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: palette.leaf }}>
                        {stageName}
                    </span>
                    <span className="text-[9px] font-mono opacity-50 text-botanical-sepia">{streak} day streak</span>
                </div>
            ) : null}
        </div>
    );
}
