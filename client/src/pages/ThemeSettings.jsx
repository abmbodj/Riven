import { useState, useMemo, useEffect, useRef } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Check, Plus, X, Trash2, Edit3, Sun, Moon, Sparkles } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';
import useHaptics from '../hooks/useHaptics';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_DARK = {
    name: 'Custom Dark',
    bg_color: '#1a1a18',
    surface_color: '#242422',
    text_color: '#e8e8e3',
    secondary_text_color: '#a1a19a',
    border_color: '#3d3d3a',
    accent_color: '#d97757',
    font_family_display: 'Inter',
    font_family_body: 'Inter'
};

const DEFAULT_LIGHT = {
    name: 'Custom Light',
    bg_color: '#fafaf9',
    surface_color: '#ffffff',
    text_color: '#1c1c1a',
    secondary_text_color: '#6b6b66',
    border_color: '#e5e5e2',
    accent_color: '#d97757',
    font_family_display: 'Cormorant Garamond',
    font_family_body: 'Lora'
};

const FONT_PRESETS = [
    { name: 'Editorial Serif', display: 'Cormorant Garamond', body: 'Lora' },
    { name: 'Refined Sans', display: 'Inter', body: 'Inter' },
    { name: 'Industrial Mono', display: 'JetBrains Mono', body: 'JetBrains Mono' }
];

const ACCENT_PRESETS = [
    { name: 'Coral', color: '#d97757' },
    { name: 'Blue', color: '#3b82f6' },
    { name: 'Green', color: '#22c55e' },
    { name: 'Purple', color: '#8b5cf6' },
    { name: 'Pink', color: '#ec4899' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Teal', color: '#14b8a6' },
    { name: 'Red', color: '#ef4444' },
];

const FOUNDATION_NAMES = ['Riven', 'Riven Light', 'Arctic Frost', 'Modern Minimal', 'Tech Innovation'];

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// Deterministic pseudo-random from a seed (no Math.random() in render)
function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 4294967296;
    };
}

// ─── Theme Archetypes ─────────────────────────────────────────────────────────
// Maps theme name → visual archetype for card rendering
const THEME_ARCHETYPES = {
    'Midnight Galaxy': 'cosmos',
    'Ocean Depths': 'depths',
    'Tech Innovation': 'cyber',
    'Rose': 'bloom',
    'Golden Hour': 'warmlight',
    'Sunset Blvd': 'ember',
    'Arctic Frost': 'crystal',
    'Botanical Garden': 'verdant',
    'Forest Canopy': 'verdant',
    'Desert Rose': 'dusk',
    'Modern Minimal': 'void',
    'Riven': 'default',
    'Riven Light': 'default',
};

// ─── Stable Particle Seeds ────────────────────────────────────────────────────
// Pre-generate stable positions per archetype so renders are deterministic
function generateParticles(seed, count, bounds = { x: [5, 95], y: [5, 90] }) {
    const rand = seededRandom(seed);
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: bounds.x[0] + rand() * (bounds.x[1] - bounds.x[0]),
        y: bounds.y[0] + rand() * (bounds.y[1] - bounds.y[0]),
        size: 0.8 + rand() * 1.8,
        delay: rand() * 3,
        duration: 1.5 + rand() * 2.5,
        opacity: 0.4 + rand() * 0.6,
    }));
}

const STAR_PARTICLES = generateParticles(7919, 24);   // Midnight Galaxy hero
const STAR_PARTICLES_SM = generateParticles(7919, 10); // Midnight Galaxy card
const HEART_PARTICLES = generateParticles(1337, 10);   // Rose hero
const HEART_PARTICLES_SM = generateParticles(1337, 6); // Rose card
const SNOW_PARTICLES = generateParticles(2357, 8);     // Arctic Frost
const BUBBLE_PARTICLES = generateParticles(5051, 8);   // Ocean Depths hero
const BUBBLE_PARTICLES_SM = generateParticles(5051, 5);// Ocean Depths card
const CYBER_NODES = generateParticles(9001, 6, { x: [10, 90], y: [15, 85] });

// ─── Per-Theme Animation Overlays ─────────────────────────────────────────────

function OverlayCosmos({ isHero }) {
    const stars = isHero ? STAR_PARTICLES : STAR_PARTICLES_SM;
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Deep aurora gradient */}
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, #2a0845 0%, #0a0020 40%, #1a0060 70%, #2a0845 100%)',
                backgroundSize: '300% 300%',
                animation: 'themeAurora 8s ease infinite',
                opacity: 0.7,
            }} />
            {/* Purple nebula bloom */}
            <div className="absolute" style={{
                width: '70%', height: '70%',
                top: '-10%', right: '-10%',
                background: 'radial-gradient(ellipse, #7c3aed40 0%, transparent 70%)',
                animation: 'themeGlowPulse 5s ease-in-out infinite',
            }} />
            {/* Stars */}
            {stars.map(s => (
                <div key={s.id} className="absolute rounded-full bg-white" style={{
                    width: s.size + 'px',
                    height: s.size + 'px',
                    left: s.x + '%',
                    top: s.y + '%',
                    animationDelay: s.delay + 's',
                    animationDuration: s.duration + 's',
                    animation: `themeTwinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
                    opacity: s.opacity,
                }} />
            ))}
        </div>
    );
}

function OverlayDepths({ isHero }) {
    const bubbles = isHero ? BUBBLE_PARTICLES : BUBBLE_PARTICLES_SM;
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Deep bioluminescent gradient */}
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(180deg, #000814 0%, #001a2e 50%, #00355a 100%)',
                opacity: 0.6,
            }} />
            {/* Caustic light rays */}
            <div className="absolute inset-0" style={{
                background: 'repeating-linear-gradient(105deg, transparent 0%, #00d4e812 8%, transparent 16%)',
                animation: 'themeCaustic 6s ease-in-out infinite',
                opacity: 0.4,
            }} />
            {/* Rising bubbles */}
            {bubbles.map(b => (
                <motion.div key={b.id}
                    className="absolute rounded-full"
                    style={{
                        width: (3 + b.size * 2) + 'px',
                        height: (3 + b.size * 2) + 'px',
                        left: b.x + '%',
                        bottom: '-8%',
                        border: '1px solid rgba(0,212,232,0.35)',
                        backgroundColor: 'rgba(0,212,232,0.06)',
                    }}
                    animate={{ y: [0, isHero ? -180 : -90], opacity: [0.7, 0] }}
                    transition={{ duration: 3 + b.duration, repeat: Infinity, delay: b.delay * 0.6, ease: 'easeOut' }}
                />
            ))}
        </div>
    );
}

function OverlayCyber({ isHero }) {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* CRT grid */}
            <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(0,229,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.08) 1px, transparent 1px)',
                backgroundSize: isHero ? '20px 20px' : '10px 10px',
            }} />
            {/* Scanline sweep */}
            <div className="absolute left-0 right-0" style={{
                height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.6), transparent)',
                animation: 'themeScanline 2.5s linear infinite',
                boxShadow: '0 0 8px rgba(0,229,255,0.8)',
            }} />
            {/* Data nodes */}
            {CYBER_NODES.map(n => (
                <motion.div key={n.id}
                    className="absolute"
                    style={{
                        width: '3px', height: '3px',
                        left: n.x + '%',
                        top: n.y + '%',
                        backgroundColor: '#00e5ff',
                        boxShadow: '0 0 6px #00e5ff, 0 0 12px #00e5ff40',
                        borderRadius: '50%',
                    }}
                    animate={{ opacity: [1, 0.1, 1], scale: [1, 1.5, 1] }}
                    transition={{ duration: 1.2 + n.delay * 0.3, repeat: Infinity, delay: n.delay * 0.2 }}
                />
            ))}
            {/* Corner brackets */}
            {isHero && (<>
                <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-cyan-400/50" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-cyan-400/50" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-cyan-400/50" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-cyan-400/50" />
            </>)}
        </div>
    );
}

function OverlayBloom({ isHero }) {
    const hearts = isHero ? HEART_PARTICLES : HEART_PARTICLES_SM;
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Hot pink aurora */}
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, #3d0050 0%, #1a0020 35%, #4a0060 65%, #1a0020 100%)',
                backgroundSize: '400% 400%',
                animation: 'themeAurora 5s ease infinite',
                opacity: 0.65,
            }} />
            {/* Magenta bloom */}
            <div className="absolute" style={{
                width: '60%', height: '60%',
                top: '-5%', left: '20%',
                background: 'radial-gradient(ellipse, #ff4da640 0%, transparent 70%)',
                animation: 'themeGlowPulse 3.5s ease-in-out infinite',
            }} />
            {/* Floating hearts */}
            {hearts.map(h => (
                <div key={h.id} className="absolute select-none" style={{
                    fontSize: (isHero ? 10 : 7) + h.size * 2 + 'px',
                    left: h.x + '%',
                    bottom: '-5%',
                    color: `hsl(${320 + h.id * 15}deg 100% 75%)`,
                    animation: `themeHeartFloat ${2 + h.duration * 0.4}s ${h.delay * 0.5}s ease-out infinite`,
                    lineHeight: 1,
                }}>♥</div>
            ))}
        </div>
    );
}

function OverlayWarmlight({ isHero }) {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Warm gradient sweep */}
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, #3d1a00 0%, #1a0800 40%, #2d1000 70%, #3d1a00 100%)',
                backgroundSize: '300% 300%',
                animation: 'themeGradientDrift 10s ease infinite',
                opacity: 0.6,
            }} />
            {/* Sun bloom */}
            <div className="absolute" style={{
                width: '80%', height: '80%',
                bottom: '-20%', right: '-20%',
                background: 'radial-gradient(ellipse, #f5a62330 0%, transparent 65%)',
                animation: 'themeGlowPulse 6s ease-in-out infinite',
            }} />
            {/* Gold shimmer */}
            <div className="absolute inset-y-0 w-1/3" style={{
                background: 'linear-gradient(90deg, transparent, rgba(245,166,35,0.15), transparent)',
                animation: 'themeShimmer 4s ease-in-out infinite',
            }} />
            {/* Dust motes */}
            {isHero && generateParticles(4242, 8).map(p => (
                <motion.div key={p.id}
                    className="absolute rounded-full"
                    style={{
                        width: p.size + 'px', height: p.size + 'px',
                        left: p.x + '%',
                        top: p.y + '%',
                        backgroundColor: '#f5a623',
                        opacity: 0,
                    }}
                    animate={{ opacity: [0, p.opacity * 0.4, 0], y: [0, -20] }}
                    transition={{ duration: p.duration * 1.5, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

function OverlayEmber() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(160deg, #3d0800 0%, #1a0500 45%, #2d0a00 100%)',
                backgroundSize: '300% 300%',
                animation: 'themeGradientDrift 8s ease infinite',
                opacity: 0.65,
            }} />
            {/* Ember glow */}
            <div className="absolute" style={{
                width: '90%', height: '60%',
                bottom: '-10%', left: '-5%',
                background: 'radial-gradient(ellipse, #ff603020 0%, transparent 70%)',
                animation: 'themeGlowPulse 4s ease-in-out infinite',
            }} />
            {/* Heat shimmer */}
            <div className="absolute inset-y-0 w-1/4" style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,96,48,0.12), transparent)',
                animation: 'themeShimmer 5s ease-in-out infinite',
            }} />
        </div>
    );
}

function OverlayCrystal({ isHero }) {
    const snow = isHero ? SNOW_PARTICLES : SNOW_PARTICLES.slice(0, 4);
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Ice surface */}
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(160deg, #ffffff 0%, #d0e8f8 40%, #b8d4f0 100%)',
                opacity: 0.3,
            }} />
            {/* Shimmer */}
            <div className="absolute inset-y-0 w-2/5" style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                animation: 'themeShimmer 5s ease-in-out infinite',
            }} />
            {/* Snowflakes */}
            {snow.map(s => (
                <div key={s.id} className="absolute select-none" style={{
                    fontSize: (isHero ? 10 : 8) + s.size + 'px',
                    left: s.x + '%',
                    top: s.y + '%',
                    color: `rgba(0,128,255,${0.25 + s.opacity * 0.35})`,
                    animation: `themeTwinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
                }}>❄</div>
            ))}
        </div>
    );
}

function OverlayVerdant({ themeName, isHero }) {
    const accent = themeName === 'Botanical Garden' ? '#5cdb7a' : '#7dde82';
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Deep canopy gradient */}
            <div className="absolute inset-0" style={{
                background: `radial-gradient(ellipse at 25% 70%, ${accent}28 0%, transparent 55%), radial-gradient(ellipse at 75% 25%, ${accent}18 0%, transparent 50%)`,
                animation: 'themeColorBloom 6s ease-in-out infinite',
            }} />
            {/* Dappled light */}
            {isHero && generateParticles(8888, 6).map(p => (
                <div key={p.id} className="absolute rounded-full" style={{
                    width: (8 + p.size * 10) + 'px',
                    height: (8 + p.size * 10) + 'px',
                    left: p.x + '%',
                    top: p.y + '%',
                    background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
                    animation: `themeGlowPulse ${3 + p.duration}s ${p.delay}s ease-in-out infinite`,
                }} />
            ))}
        </div>
    );
}

function OverlayDusk() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0" style={{
                background: 'radial-gradient(ellipse at 45% 55%, #e8856a28 0%, transparent 60%), radial-gradient(ellipse at 72% 22%, #c4896e20 0%, transparent 50%)',
                animation: 'themeGlowPulse 5s ease-in-out infinite',
            }} />
            {/* Silk shimmer */}
            <div className="absolute inset-y-0 w-1/3" style={{
                background: 'linear-gradient(90deg, transparent, rgba(232,133,106,0.1), transparent)',
                animation: 'themeShimmer 6s 1s ease-in-out infinite',
            }} />
        </div>
    );
}

function OverlayVoid() {
    // Modern Minimal: clean, pure — the animation IS the absence. A single barely-visible shimmer.
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-y-0 w-1/2" style={{
                background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.025), transparent)',
                animation: 'themeShimmer 7s 2s ease-in-out infinite',
            }} />
        </div>
    );
}

// Master dispatcher
function ThemeAnimationOverlay({ themeName, isHero = false }) {
    const archetype = THEME_ARCHETYPES[themeName] || 'default';
    switch (archetype) {
        case 'cosmos':   return <OverlayCosmos isHero={isHero} />;
        case 'depths':   return <OverlayDepths isHero={isHero} />;
        case 'cyber':    return <OverlayCyber isHero={isHero} />;
        case 'bloom':    return <OverlayBloom isHero={isHero} />;
        case 'warmlight': return <OverlayWarmlight isHero={isHero} />;
        case 'ember':    return <OverlayEmber />;
        case 'crystal':  return <OverlayCrystal isHero={isHero} />;
        case 'verdant':  return <OverlayVerdant themeName={themeName} isHero={isHero} />;
        case 'dusk':     return <OverlayDusk />;
        case 'void':     return <OverlayVoid />;
        default:         return null;
    }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ThemeSettings() {
    const { themes, activeTheme, switchTheme, addTheme, updateTheme, deleteTheme } = useTheme();
    const { user } = useAuth();
    const toast = useToast();
    const haptics = useHaptics();

    const [showEditor, setShowEditor] = useState(false);
    const [editingTheme, setEditingTheme] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, theme: null });
    const [editorMode, setEditorMode] = useState('simple');
    const [pricingOpen, setPricingOpen] = useState(false);
    const [carouselIndices, setCarouselIndices] = useState({ official: 0, professional: 0, custom: 0 });
    const [themeForm, setThemeForm] = useState({ ...DEFAULT_DARK, name: '' });
    const canCreateCustomThemes = (user?.subscription_tier || 'free') !== 'free';

    const handleSwitchTheme = async (themeId, isPro) => {
        if (activeTheme?.id === themeId) return;
        if (isPro) {
            const tier = user?.subscription_tier || 'free';
            if (tier === 'free') {
                haptics.error();
                setPricingOpen(true);
                return;
            }
        }
        haptics.light();
        await switchTheme(themeId);
        toast.success('Theme applied');
    };

    const handleCreateNew = () => {
        if (!canCreateCustomThemes) {
            haptics.error();
            setPricingOpen(true);
            return;
        }
        haptics.medium();
        setEditingTheme(null);
        setThemeForm({ ...DEFAULT_DARK, name: '' });
        setEditorMode('simple');
        setShowEditor(true);
    };

    const handleEditTheme = (e, theme) => {
        e.stopPropagation();
        haptics.light();
        setEditingTheme(theme);
        setThemeForm({
            name: theme.name,
            bg_color: theme.bg_color,
            surface_color: theme.surface_color,
            text_color: theme.text_color,
            secondary_text_color: theme.secondary_text_color,
            border_color: theme.border_color,
            accent_color: theme.accent_color,
            font_family_display: theme.font_family_display || 'Inter',
            font_family_body: theme.font_family_body || 'Inter'
        });
        setEditorMode('simple');
        setShowEditor(true);
    };

    const handleDeleteClick = (e, theme) => {
        e.stopPropagation();
        haptics.medium();
        setDeleteConfirm({ show: true, theme });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm.theme) return;
        try {
            await deleteTheme(deleteConfirm.theme.id);
            haptics.success();
            toast.success(`"${deleteConfirm.theme.name}" expunged`);
            setDeleteConfirm({ show: false, theme: null });
        } catch (err) {
            haptics.error();
            toast.error(err?.message || 'Failed to delete theme');
        }
    };

    const handleSaveTheme = async (e) => {
        e.preventDefault();
        if (!themeForm.name.trim()) {
            haptics.error();
            toast.error('Identity required');
            return;
        }
        if (!editingTheme && !canCreateCustomThemes) {
            haptics.error();
            setPricingOpen(true);
            return;
        }
        try {
            if (editingTheme) {
                await updateTheme(editingTheme.id, themeForm);
                haptics.success();
                toast.success('Atmosphere refined');
            } else {
                await addTheme(themeForm);
                haptics.success();
                toast.success('New atmosphere materialized');
            }
            setShowEditor(false);
            setEditingTheme(null);
        } catch (err) {
            haptics.error();
            toast.error(err?.message || 'Failed to save theme');
        }
    };

    const applyBaseTheme = (base) => {
        haptics.light();
        const preset = base === 'light' ? DEFAULT_LIGHT : DEFAULT_DARK;
        setThemeForm(prev => ({
            ...prev,
            bg_color: preset.bg_color,
            surface_color: preset.surface_color,
            text_color: preset.text_color,
            secondary_text_color: preset.secondary_text_color,
            border_color: preset.border_color
        }));
    };

    const categories = useMemo(() => ({
        official: themes.filter(t => t.is_default && FOUNDATION_NAMES.includes(t.name)),
        professional: themes.filter(t => t.is_default && !FOUNDATION_NAMES.includes(t.name)),
        custom: themes.filter(t => !t.is_default)
    }), [themes]);

    return (
        <div className="max-w-4xl md:max-w-7xl mx-auto pb-32 md:px-12 lg:px-24 relative mb-safe min-h-screen">
            {/* Background noise */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.15] z-0 md:mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} />

            {/* Header */}
            <header className="mb-8 pt-8 px-4 md:px-0 flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="flex items-center gap-2 text-claude-accent mb-4">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-90">Atmosphere</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-display font-light tracking-tight leading-[1.1]">
                        Look &<br /><span className="font-bold italic pr-2">Feel.</span>
                    </h1>
                </motion.div>

                <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateNew}
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-claude-text text-claude-bg rounded-full font-bold shadow-md md:shadow-2xl transition-[transform,opacity,color,background-color,border-color,box-shadow] active:shadow-md border border-claude-text/10"
                >
                    <Plus className="w-5 h-5" />
                    <span>Create Custom</span>
                    {!canCreateCustomThemes && (
                        <span className="rounded-full border border-claude-bg/20 bg-claude-bg/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-claude-bg/80">
                            Pro
                        </span>
                    )}
                </motion.button>
            </header>

            {/* Active Theme Hero */}
            {activeTheme && (
                <div className="px-4 md:px-0 relative z-10 mb-14">
                    <ActiveThemeHero theme={activeTheme} />
                </div>
            )}

            {/* Sections */}
            <div className="space-y-16 relative z-10">
                <ThemeSection
                    title="Foundation"
                    subtitle="Core aesthetic experiences"
                    themes={categories.official}
                    activeThemeId={activeTheme?.id}
                    onSelect={(id) => handleSwitchTheme(id, false)}
                    isPro={false}
                    carouselIndex={carouselIndices.official}
                    onCarouselScroll={(i) => setCarouselIndices(p => ({ ...p, official: i }))}
                />
                <ThemeSection
                    title="Professional"
                    subtitle="Masterfully crafted environments"
                    themes={categories.professional}
                    activeThemeId={activeTheme?.id}
                    onSelect={(id) => handleSwitchTheme(id, true)}
                    isPro={true}
                    carouselIndex={carouselIndices.professional}
                    onCarouselScroll={(i) => setCarouselIndices(p => ({ ...p, professional: i }))}
                />
                <ThemeSection
                    title="Your Gallery"
                    subtitle="Handcrafted by you"
                    themes={categories.custom}
                    activeThemeId={activeTheme?.id}
                    onSelect={(id) => handleSwitchTheme(id, false)}
                    isCustom={true}
                    onEdit={handleEditTheme}
                    onDelete={handleDeleteClick}
                    onCreateNew={handleCreateNew}
                    carouselIndex={carouselIndices.custom}
                    onCarouselScroll={(i) => setCarouselIndices(p => ({ ...p, custom: i }))}
                />
            </div>

            <ConfirmModal
                isOpen={deleteConfirm.show}
                title={`Expunge '${deleteConfirm.theme?.name}'?`}
                message="This atmosphere will be permanently destroyed."
                confirmText="Destroy"
                destructive={true}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirm({ show: false, theme: null })}
            />

            <PricingModal
                isOpen={pricingOpen}
                onClose={() => setPricingOpen(false)}
                currentTier={user?.subscription_tier || 'free'}
            />

            {/* Theme Editor — Bottom Sheet */}
            <AnimatePresence>
                {showEditor && (
                    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEditor(false)}
                            className="absolute inset-0 bg-black/40 md:backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 200 }}
                            className="relative w-full md:max-w-2xl md:mx-auto md:mb-6 glass-panel border-t md:border border-claude-border shadow-md md:shadow-2xl flex flex-col rounded-t-[2.5rem] md:rounded-[2.5rem] max-h-[92vh] md:max-h-[85vh] overflow-hidden"
                            style={{ backgroundColor: themeForm.bg_color, color: themeForm.text_color }}
                        >
                            <div className="w-full flex justify-center pt-4 pb-2 md:hidden absolute top-0 z-20">
                                <div className="w-12 h-1.5 rounded-full bg-claude-text/20" />
                            </div>

                            <div className="flex items-center justify-between p-6 pt-8 md:pt-6 px-8 border-b z-10 shrink-0 md:backdrop-blur-xl" style={{ borderBottomColor: themeForm.border_color, backgroundColor: `${themeForm.bg_color}E6` }}>
                                <h2 className="text-2xl font-display font-light tracking-tight" style={{ fontFamily: themeForm.font_family_display }}>
                                    {editingTheme ? 'Refine' : 'New'} <span className="font-bold italic">Atmosphere</span>
                                </h2>
                                <button
                                    onClick={() => setShowEditor(false)}
                                    className="p-2.5 rounded-full transition-colors hover:opacity-70 active:scale-95 bg-black/5"
                                    style={{ color: themeForm.text_color }}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveTheme} className="flex-1 overflow-y-auto px-6 md:px-10 py-8 space-y-10 custom-scrollbar">
                                {/* Live Preview */}
                                <div className="rounded-2xl overflow-hidden border relative" style={{ borderColor: themeForm.border_color, height: '72px', backgroundColor: themeForm.surface_color }}>
                                    <div className="flex items-center gap-2 px-3 h-7" style={{ backgroundColor: themeForm.bg_color, borderBottom: `1px solid ${themeForm.border_color}` }}>
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeForm.accent_color, opacity: 0.8 }} />
                                        <div className="h-1.5 flex-1 rounded-full opacity-20" style={{ backgroundColor: themeForm.text_color, maxWidth: '50%' }} />
                                        <div className="h-4 w-10 rounded opacity-30" style={{ backgroundColor: themeForm.accent_color }} />
                                    </div>
                                    <div className="px-3 pt-2 space-y-1.5">
                                        <div className="h-2.5 rounded-full w-3/4 opacity-40" style={{ backgroundColor: themeForm.text_color }} />
                                        <div className="h-1.5 rounded-full w-full opacity-15" style={{ backgroundColor: themeForm.text_color }} />
                                    </div>
                                    <div className="absolute right-3 bottom-2.5 h-4 w-12 rounded-full opacity-90" style={{ backgroundColor: themeForm.accent_color }} />
                                    <div className="absolute top-1.5 right-3">
                                        <span className="text-[8px] font-mono uppercase tracking-widest opacity-30" style={{ color: themeForm.text_color }}>Preview</span>
                                    </div>
                                </div>

                                {/* Identity */}
                                <div className="space-y-4 relative">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Identity</label>
                                    <input
                                        type="text"
                                        value={themeForm.name}
                                        onChange={e => setThemeForm({ ...themeForm, name: e.target.value })}
                                        className="w-full bg-transparent border-b-2 px-0 py-3 outline-none text-4xl md:text-5xl font-display transition-[border-color] placeholder:opacity-20"
                                        style={{ borderColor: themeForm.border_color, color: themeForm.text_color, fontFamily: themeForm.font_family_display }}
                                        placeholder="Name it..."
                                        autoFocus
                                    />
                                    <div className="absolute bottom-0 left-0 h-[2px] transition-[width] duration-300" style={{ backgroundColor: themeForm.accent_color, width: themeForm.name ? '100%' : '0%' }} />
                                </div>

                                {/* Pigments */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Pigments</label>
                                        <div className="flex p-1 rounded-xl" style={{ backgroundColor: themeForm.surface_color, border: `1px solid ${themeForm.border_color}` }}>
                                            {['simple', 'advanced'].map(mode => (
                                                <button key={mode} type="button" onClick={() => setEditorMode(mode)}
                                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-[transform,opacity,color,background-color,border-color,box-shadow] capitalize ${editorMode === mode ? 'shadow-md opacity-100' : 'opacity-40 hover:opacity-70'}`}
                                                    style={{ backgroundColor: editorMode === mode ? themeForm.text_color : 'transparent', color: editorMode === mode ? themeForm.bg_color : themeForm.text_color }}
                                                >{mode}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {editorMode === 'simple' ? (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="grid grid-cols-2 gap-4">
                                                <button type="button" onClick={() => applyBaseTheme('dark')}
                                                    className={`flex flex-col gap-4 p-6 rounded-3xl border-2 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${themeForm.bg_color === DEFAULT_DARK.bg_color ? 'scale-[1.02] shadow-sm md:shadow-xl' : 'scale-100 hover:scale-[1.01]'}`}
                                                    style={{ borderColor: themeForm.bg_color === DEFAULT_DARK.bg_color ? themeForm.accent_color : themeForm.border_color, backgroundColor: themeForm.surface_color }}>
                                                    <div className="p-3 rounded-full bg-[#1a1a18] text-[#e8e8e3] w-fit shadow-inner"><Moon className="w-6 h-6" /></div>
                                                    <span className="font-display font-bold text-xl text-left tracking-tight" style={{ fontFamily: themeForm.font_family_display }}>Obsidian</span>
                                                </button>
                                                <button type="button" onClick={() => applyBaseTheme('light')}
                                                    className={`flex flex-col gap-4 p-6 rounded-3xl border-2 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${themeForm.bg_color === DEFAULT_LIGHT.bg_color ? 'scale-[1.02] shadow-sm md:shadow-xl' : 'scale-100 hover:scale-[1.01]'}`}
                                                    style={{ borderColor: themeForm.bg_color === DEFAULT_LIGHT.bg_color ? themeForm.accent_color : themeForm.border_color, backgroundColor: themeForm.surface_color }}>
                                                    <div className="p-3 rounded-full bg-[#fafaf9] text-[#1c1c1a] border border-black/10 w-fit shadow-sm"><Sun className="w-6 h-6" /></div>
                                                    <span className="font-display font-bold text-xl text-left tracking-tight" style={{ fontFamily: themeForm.font_family_display }}>Alabaster</span>
                                                </button>
                                            </div>
                                            <div className="space-y-5">
                                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Vocal Accent</label>
                                                <div className="flex overflow-x-auto gap-4 pb-4 pt-2 snap-x -mx-6 px-6 md:-mx-10 md:px-10 [&::-webkit-scrollbar]:hidden">
                                                    {ACCENT_PRESETS.map(p => (
                                                        <button key={p.color} type="button"
                                                            onClick={e => { e.preventDefault(); haptics.light(); setThemeForm({ ...themeForm, accent_color: p.color }); }}
                                                            className={`shrink-0 w-16 h-16 rounded-full border-4 transition-[transform,opacity,box-shadow] duration-300 snap-center outline-none ${themeForm.accent_color === p.color ? 'scale-[1.15]' : 'scale-100 opacity-80 hover:scale-105'}`}
                                                            style={{
                                                                backgroundColor: p.color,
                                                                borderColor: themeForm.accent_color === p.color ? themeForm.bg_color : 'transparent',
                                                                boxShadow: themeForm.accent_color === p.color ? `0 0 0 2px ${p.color}, 0 10px 20px -5px ${p.color}80` : 'none'
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-x-5 gap-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {['bg_color', 'surface_color', 'text_color', 'secondary_text_color', 'border_color', 'accent_color'].map(key => (
                                                <div key={key} className="space-y-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 block" style={{ fontFamily: themeForm.font_family_body }}>{key.replace(/_/g, ' ')}</span>
                                                    <div className="relative group overflow-hidden rounded-2xl border" style={{ borderColor: themeForm.border_color }}>
                                                        <input type="color" value={themeForm[key]}
                                                            onChange={e => setThemeForm({ ...themeForm, [key]: e.target.value })}
                                                            className="w-full h-14 opacity-0 absolute inset-0 cursor-pointer"
                                                        />
                                                        <div className="w-full h-14 pointer-events-none" style={{ backgroundColor: themeForm[key] }} />
                                                    </div>
                                                    <p className="text-[10px] font-mono tracking-widest text-center opacity-50" style={{ color: themeForm.text_color }}>{themeForm[key].toUpperCase()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Typography */}
                                <div className="space-y-5">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] block opacity-50" style={{ fontFamily: themeForm.font_family_body }}>Typography</label>
                                    <div className="grid grid-cols-1 gap-4">
                                        {FONT_PRESETS.map(f => (
                                            <button key={f.name} type="button"
                                                onClick={() => { haptics.light(); setThemeForm({ ...themeForm, font_family_display: f.display, font_family_body: f.body }); }}
                                                className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${themeForm.font_family_display === f.display ? 'scale-[1.01] shadow-sm md:shadow-lg' : 'border-transparent hover:scale-[1.01]'}`}
                                                style={{ backgroundColor: themeForm.surface_color, borderColor: themeForm.font_family_display === f.display ? themeForm.accent_color : themeForm.border_color }}
                                            >
                                                <div className="text-left">
                                                    <span className="text-2xl block mb-2 font-bold tracking-tight" style={{ fontFamily: f.display, color: themeForm.text_color }}>{f.name}</span>
                                                    <span className="text-sm opacity-60 leading-relaxed" style={{ fontFamily: f.body, color: themeForm.text_color }}>The quick brown fox jumps over the lazy dog.</span>
                                                </div>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${themeForm.font_family_display === f.display ? 'opacity-100' : 'opacity-10 border'}`}
                                                    style={{ backgroundColor: themeForm.font_family_display === f.display ? themeForm.accent_color : 'transparent', color: themeForm.font_family_display === f.display ? themeForm.bg_color : themeForm.text_color, borderColor: themeForm.border_color }}>
                                                    <Check className="w-4 h-4" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </form>

                            <div className="p-6 md:px-10 pb-8 md:pb-6 border-t z-10 shrink-0 md:backdrop-blur-xl" style={{ borderTopColor: themeForm.border_color, backgroundColor: `${themeForm.bg_color}E6` }}>
                                <button type="submit" onClick={handleSaveTheme}
                                    className="w-full py-5 rounded-full font-bold text-lg transition-[transform,opacity,color,background-color,border-color,box-shadow] shadow-sm md:shadow-xl active:scale-95 flex items-center justify-center gap-2 border border-black/10"
                                    style={{ backgroundColor: themeForm.text_color, color: themeForm.bg_color, fontFamily: themeForm.font_family_display, boxShadow: `0 20px 25px -5px ${themeForm.text_color}30, 0 8px 10px -6px ${themeForm.text_color}30` }}
                                >
                                    {editingTheme ? 'Commit Refinements' : 'Materialize Theme'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Active Theme Hero ────────────────────────────────────────────────────────

function getHeroDepthProfile() {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

    return isDesktop
        ? {
            sceneLift: 4,
            identity: { x: 0, y: 0, z: 26 },
            preview: { x: 0, y: 0, z: 88, rotateY: -18, rotateX: 9 },
            bloom: { z: -64 },
            sheen: { xPercent: -12, yPercent: 0, rotate: -10 },
        }
        : {
            sceneLift: 2,
            identity: { x: 0, y: 0, z: 0 },
            preview: { x: 0, y: 0, z: 24, rotateY: -8, rotateX: 4 },
            bloom: { z: -28 },
            sheen: { xPercent: -8, yPercent: 0, rotate: -8 },
        };
}

function ActiveThemeHero({ theme }) {
    const heroRef = useRef(null);
    const sceneRef = useRef(null);
    const identityRef = useRef(null);
    const previewRef = useRef(null);
    const sheenRef = useRef(null);
    const bloomRef = useRef(null);
    const prevThemeRef = useRef(null);

    // GSAP transition when theme changes
    useEffect(() => {
        if (!heroRef.current || !sceneRef.current || !identityRef.current || !previewRef.current) return;

        const prev = prevThemeRef.current;
        const depth = getHeroDepthProfile();
        const scene = sceneRef.current;
        const identity = identityRef.current;
        const preview = previewRef.current;
        const tl = gsap.timeline();

        if (prev && prev !== theme.id) {
            tl.fromTo(scene,
                { opacity: 0, y: 20, rotateX: 14, rotateY: -10, scale: 0.98 },
                { opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1, duration: 0.75, ease: 'power4.out' },
                0
            )
                .fromTo(identity,
                    { opacity: 0, x: -24, y: 18, z: 0 },
                    { opacity: 1, x: depth.identity.x, y: depth.identity.y, z: depth.identity.z, duration: 0.9, ease: 'power3.out' },
                    0.08
                )
                .fromTo(preview,
                    { opacity: 0, x: 42, y: 24, z: 0, rotateY: -28, rotateX: 16 },
                    {
                        opacity: 1,
                        x: depth.preview.x,
                        y: depth.preview.y,
                        z: depth.preview.z,
                        rotateY: depth.preview.rotateY,
                        rotateX: depth.preview.rotateX,
                        duration: 1,
                        ease: 'expo.out'
                    },
                    0.04
                );
        } else if (!prev) {
            tl.fromTo(scene,
                { opacity: 0, y: 18, rotateX: 10, rotateY: -8, scale: 0.985 },
                { opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1, duration: 0.8, ease: 'power4.out' },
                0
            )
                .fromTo(identity,
                    { opacity: 0, y: 14, x: -16, z: 0 },
                    { opacity: 1, y: depth.identity.y, x: depth.identity.x, z: depth.identity.z, duration: 0.88, ease: 'power3.out' },
                    0.08
                )
                .fromTo(preview,
                    { opacity: 0, x: 30, y: 18, z: 0, rotateY: -24, rotateX: 12 },
                    {
                        opacity: 1,
                        x: depth.preview.x,
                        y: depth.preview.y,
                        z: depth.preview.z,
                        rotateY: depth.preview.rotateY,
                        rotateX: depth.preview.rotateX,
                        duration: 0.96,
                        ease: 'expo.out'
                    },
                    0.04
                );
        }

        prevThemeRef.current = theme.id;
        return () => tl.kill();
    }, [theme.id]);

    useEffect(() => {
        if (!heroRef.current || !sceneRef.current || !identityRef.current || !previewRef.current || !bloomRef.current) return;

        const depth = getHeroDepthProfile();
        const hero = heroRef.current;
        const scene = sceneRef.current;
        const identity = identityRef.current;
        const preview = previewRef.current;
        const bloom = bloomRef.current;
        const sheen = sheenRef.current;
        const layers = preview.querySelectorAll('[data-depth]');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

        gsap.set(scene, {
            x: 0,
            y: 0,
            rotateX: 0,
            rotateY: 0,
            scale: 1,
            transformStyle: 'preserve-3d',
            transformOrigin: 'center center',
            willChange: 'transform',
            force3D: true,
        });
        gsap.set(identity, {
            ...depth.identity,
            transformStyle: 'preserve-3d',
            transformOrigin: 'left center',
            willChange: 'transform',
            force3D: true,
        });
        gsap.set(preview, {
            ...depth.preview,
            transformStyle: 'preserve-3d',
            transformOrigin: 'right center',
            willChange: 'transform',
            force3D: true,
        });
        gsap.set(bloom, {
            xPercent: 0,
            yPercent: 0,
            scale: 1,
            opacity: 0.25,
            z: depth.bloom.z,
            transformOrigin: 'center center',
            force3D: true,
        });

        if (sheen) {
            gsap.set(sheen, {
                ...depth.sheen,
                opacity: 0.34,
                z: 18,
                transformOrigin: 'center center',
                force3D: true,
            });
        }

        gsap.set(layers, {
            z: (_, target) => Number(target.getAttribute('data-depth') || 0),
            transformStyle: 'preserve-3d',
            transformOrigin: 'center center',
            force3D: true,
        });

        const ambientTl = prefersReducedMotion
            ? null
            : gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 4.6, ease: 'sine.inOut' } });

        if (ambientTl) {
            ambientTl.to(bloom, { scale: 1.18, opacity: 0.38 }, 0);
            if (sheen) {
                ambientTl.to(sheen, { xPercent: 10, yPercent: -6, opacity: 0.46 }, 0);
            }
        }

        if (!hoverCapable && !prefersReducedMotion) {
            ambientTl?.to(scene, { y: -depth.sceneLift }, 0)
                .to(identity, { x: depth.identity.x + 4, y: depth.identity.y - 2 }, 0)
                .to(preview, {
                    y: depth.preview.y - 6,
                    z: depth.preview.z + 8,
                    rotateY: depth.preview.rotateY - 2,
                    rotateX: depth.preview.rotateX + 1.5
                }, 0);
        }

        let resumeAmbient = null;
        let handleEnter = null;
        let handleMove = null;
        let handleLeave = null;

        if (!prefersReducedMotion && hoverCapable) {
            const sceneXTo = gsap.quickTo(scene, 'x', { duration: 0.7, ease: 'power3.out' });
            const sceneYTo = gsap.quickTo(scene, 'y', { duration: 0.7, ease: 'power3.out' });
            const sceneRotateXTo = gsap.quickTo(scene, 'rotateX', { duration: 0.75, ease: 'power3.out' });
            const sceneRotateYTo = gsap.quickTo(scene, 'rotateY', { duration: 0.75, ease: 'power3.out' });
            const identityXTo = gsap.quickTo(identity, 'x', { duration: 0.7, ease: 'power3.out' });
            const identityYTo = gsap.quickTo(identity, 'y', { duration: 0.7, ease: 'power3.out' });
            const previewXTo = gsap.quickTo(preview, 'x', { duration: 0.75, ease: 'power3.out' });
            const previewYTo = gsap.quickTo(preview, 'y', { duration: 0.75, ease: 'power3.out' });
            const previewRotateXTo = gsap.quickTo(preview, 'rotateX', { duration: 0.75, ease: 'power3.out' });
            const previewRotateYTo = gsap.quickTo(preview, 'rotateY', { duration: 0.75, ease: 'power3.out' });
            const bloomXTo = gsap.quickTo(bloom, 'xPercent', { duration: 0.9, ease: 'power3.out' });
            const bloomYTo = gsap.quickTo(bloom, 'yPercent', { duration: 0.9, ease: 'power3.out' });
            const sheenXTo = sheen ? gsap.quickTo(sheen, 'xPercent', { duration: 1, ease: 'power3.out' }) : null;
            const sheenYTo = sheen ? gsap.quickTo(sheen, 'yPercent', { duration: 1, ease: 'power3.out' }) : null;

            handleEnter = () => {
                ambientTl?.pause();
                resumeAmbient?.kill();
                gsap.to(scene, { scale: 1.01, duration: 0.45, ease: 'power2.out' });
            };

            handleMove = (event) => {
                const rect = hero.getBoundingClientRect();
                const px = (event.clientX - rect.left) / rect.width;
                const py = (event.clientY - rect.top) / rect.height;
                const offsetX = px - 0.5;
                const offsetY = py - 0.5;

                sceneXTo(offsetX * 10);
                sceneYTo(offsetY * 6);
                sceneRotateXTo(gsap.utils.clamp(-8, 8, -offsetY * 15));
                sceneRotateYTo(gsap.utils.clamp(-12, 12, offsetX * 20));

                identityXTo(depth.identity.x - offsetX * 14);
                identityYTo(depth.identity.y - offsetY * 10);

                previewXTo(depth.preview.x + offsetX * 26);
                previewYTo(depth.preview.y + offsetY * 18);
                previewRotateYTo(depth.preview.rotateY + offsetX * 18);
                previewRotateXTo(depth.preview.rotateX - offsetY * 12);

                bloomXTo(offsetX * 30);
                bloomYTo(offsetY * 22);
                sheenXTo?.(depth.sheen.xPercent + px * 24);
                sheenYTo?.(depth.sheen.yPercent - py * 16);
            };

            handleLeave = () => {
                gsap.to(scene, {
                    x: 0,
                    y: 0,
                    rotateX: 0,
                    rotateY: 0,
                    scale: 1,
                    duration: 0.8,
                    ease: 'elastic.out(1, 0.55)'
                });
                gsap.to(identity, {
                    x: depth.identity.x,
                    y: depth.identity.y,
                    duration: 0.8,
                    ease: 'power3.out'
                });
                gsap.to(preview, {
                    x: depth.preview.x,
                    y: depth.preview.y,
                    z: depth.preview.z,
                    rotateY: depth.preview.rotateY,
                    rotateX: depth.preview.rotateX,
                    duration: 0.9,
                    ease: 'power3.out'
                });
                gsap.to(bloom, {
                    xPercent: 0,
                    yPercent: 0,
                    scale: 1,
                    opacity: 0.25,
                    duration: 0.95,
                    ease: 'power3.out'
                });
                sheen && gsap.to(sheen, {
                    xPercent: depth.sheen.xPercent,
                    yPercent: depth.sheen.yPercent,
                    opacity: 0.34,
                    duration: 1,
                    ease: 'power3.out'
                });

                resumeAmbient = gsap.delayedCall(0.92, () => ambientTl?.resume());
            };

            hero.addEventListener('pointerenter', handleEnter);
            hero.addEventListener('pointermove', handleMove);
            hero.addEventListener('pointerleave', handleLeave);
        }

        return () => {
            resumeAmbient?.kill();
            ambientTl?.kill();

            if (handleEnter) hero.removeEventListener('pointerenter', handleEnter);
            if (handleMove) hero.removeEventListener('pointermove', handleMove);
            if (handleLeave) hero.removeEventListener('pointerleave', handleLeave);

            gsap.killTweensOf([scene, identity, preview, bloom, sheen, ...layers]);
        };
    }, [theme.id, theme.accent_color]);

    return (
        <div
            ref={heroRef}
            className="relative w-full overflow-hidden rounded-[2.5rem]"
            style={{
                backgroundColor: theme.bg_color,
                border: `1px solid ${theme.border_color}`,
                perspective: '1800px',
                boxShadow: `0 34px 90px -32px ${theme.accent_color}4A, 0 14px 40px -24px rgba(0,0,0,0.72), 0 0 0 1px ${theme.accent_color}12`,
            }}
        >
            {/* Noise */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.18] rounded-[2.5rem]" style={{ backgroundImage: NOISE_SVG }} />

            <div
                ref={sheenRef}
                className="absolute inset-y-[10%] -left-[18%] w-[48%] rounded-full pointer-events-none"
                style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 48%, transparent 100%)',
                    filter: 'blur(26px)',
                    mixBlendMode: 'screen',
                }}
            />

            {/* Per-theme overlay */}
            <ThemeAnimationOverlay themeName={theme.name} isHero={true} />

            {/* Accent bloom — GSAP-animated */}
            <div
                ref={bloomRef}
                className="absolute -right-20 -top-20 w-80 h-80 rounded-full pointer-events-none"
                style={{
                    background: `radial-gradient(circle, ${theme.accent_color}30 0%, transparent 70%)`,
                    opacity: 0.25,
                    filter: 'blur(2px)',
                }}
            />

            <div
                ref={sceneRef}
                className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8 p-8 md:p-12"
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* Identity */}
                <div ref={identityRef} className="flex-1 min-w-0" style={{ transformStyle: 'preserve-3d' }}>
                    <div className="flex items-center gap-2.5 mb-5" style={{ transform: 'translateZ(18px)' }}>
                        <motion.span
                            animate={{ opacity: [1, 0.25, 1], scale: [1, 1.3, 1] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: theme.accent_color, boxShadow: `0 0 10px ${theme.accent_color}, 0 0 20px ${theme.accent_color}60` }}
                        />
                        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.35em] opacity-55" style={{ color: theme.accent_color }}>
                            Active Specimen
                        </span>
                    </div>

                    <h2
                        className="text-5xl md:text-6xl font-light tracking-tight leading-[1.0] mb-3 truncate"
                        style={{ color: theme.text_color, fontFamily: `${theme.font_family_display}, serif`, transform: 'translateZ(34px)' }}
                    >
                        {theme.name}
                    </h2>

                    <p className="text-[11px] font-mono uppercase tracking-[0.2em] opacity-35 mt-2" style={{ color: theme.text_color, transform: 'translateZ(22px)' }}>
                        {theme.font_family_display} · {theme.font_family_body}
                    </p>
                </div>

                {/* Mini UI preview */}
                <MiniUIPreview theme={theme} containerRef={previewRef} />
            </div>

            {/* Inner rim */}
            <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 pointer-events-none" />
        </div>
    );
}

// ─── Mini UI Preview ──────────────────────────────────────────────────────────

function MiniUIPreview({ theme, containerRef }) {
    const archetype = THEME_ARCHETYPES[theme.name] || 'default';

    return (
        <div
            ref={containerRef}
            className="shrink-0 relative w-full md:w-[34rem] rounded-[1.75rem] overflow-hidden"
            style={{
                height: '11rem',
                background: `linear-gradient(145deg, ${theme.surface_color} 0%, ${theme.bg_color} 100%)`,
                border: `1px solid ${theme.border_color}`,
                boxShadow: `0 36px 80px -44px ${theme.accent_color}65, 0 16px 32px -24px rgba(0,0,0,0.75)`,
                transformStyle: 'preserve-3d',
            }}
        >
            <div
                className="absolute inset-2.5 rounded-[1.4rem] opacity-80 pointer-events-none"
                data-depth="-24"
                style={{
                    background: `radial-gradient(circle at 20% 20%, ${theme.accent_color}24 0%, transparent 48%), linear-gradient(135deg, ${theme.surface_color} 0%, ${theme.bg_color} 100%)`,
                    border: `1px solid ${theme.border_color}55`,
                }}
            />

            <div className="absolute inset-0 opacity-[0.1] pointer-events-none" data-depth="6" style={{ backgroundImage: NOISE_SVG }} />

            <div
                className="absolute -left-12 top-4 h-24 w-40 rounded-full pointer-events-none"
                data-depth="-10"
                style={{ background: `radial-gradient(circle, ${theme.accent_color}45 0%, transparent 72%)`, filter: 'blur(28px)' }}
            />

            <div
                className="absolute inset-3 rounded-[1.45rem] overflow-hidden"
                data-depth="12"
                style={{
                    backgroundColor: theme.surface_color,
                    border: `1px solid ${theme.border_color}`,
                    boxShadow: `0 24px 60px -28px ${theme.bg_color}AA`,
                    transformStyle: 'preserve-3d',
                }}
            >
                <div
                    className="absolute inset-0 pointer-events-none"
                    data-depth="4"
                    style={{ background: `linear-gradient(135deg, ${theme.bg_color}26 0%, transparent 55%)` }}
                />

                {/* Header bar */}
                <div className="absolute top-0 left-0 right-0 h-9 flex items-center gap-2 px-4"
                    data-depth="28"
                    style={{ backgroundColor: `${theme.bg_color}F0`, borderBottom: `1px solid ${theme.border_color}` }}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: theme.accent_color, opacity: 0.8 }} />
                    <div className="flex-1 h-1.5 rounded-full opacity-20" style={{ backgroundColor: theme.text_color, maxWidth: '58%' }} />
                    <div className="w-14 h-4 rounded-full opacity-30" style={{ backgroundColor: theme.accent_color }} />
                </div>

                <div className="absolute top-[3.2rem] left-4 right-4 space-y-2" style={{ transformStyle: 'preserve-3d' }}>
                    <div className="h-3.5 rounded-full w-[68%] opacity-32" data-depth="42" style={{ backgroundColor: theme.text_color }} />
                    <div className="h-2.5 rounded-full w-full opacity-14" data-depth="26" style={{ backgroundColor: theme.text_color }} />
                    <div className="h-2.5 rounded-full w-[74%] opacity-10" data-depth="18" style={{ backgroundColor: theme.text_color }} />
                </div>

                <div
                    className="absolute bottom-4 left-4 h-5 w-20 rounded-full"
                    data-depth="58"
                    style={{ backgroundColor: theme.accent_color, opacity: 0.92, boxShadow: `0 12px 24px -12px ${theme.accent_color}` }}
                />

                <div
                    className="absolute right-4 top-[3.1rem] rounded-full px-2.5 py-1 text-[8px] font-mono uppercase tracking-[0.22em]"
                    data-depth="50"
                    style={{
                        color: theme.accent_color,
                        backgroundColor: `${theme.bg_color}D9`,
                        border: `1px solid ${theme.border_color}`,
                        boxShadow: `0 12px 24px -18px ${theme.accent_color}50`
                    }}
                >
                    Active
                </div>
            </div>

            {/* Archetype-specific mini detail */}
            {(archetype === 'cosmos' || archetype === 'bloom') && (
                <div className="absolute top-4 right-4 text-[10px] select-none" data-depth="70" style={{ color: theme.accent_color, opacity: 0.58 }}>
                    {archetype === 'cosmos' ? '★' : '♥'}
                </div>
            )}
            {archetype === 'cyber' && (
                <div className="absolute bottom-4 right-4 text-[8px] font-mono" data-depth="66" style={{ color: theme.accent_color, opacity: 0.5 }}>
                    SYS://
                </div>
            )}
            {archetype === 'crystal' && (
                <div className="absolute top-4 right-4 text-[10px] select-none" data-depth="70" style={{ color: theme.accent_color, opacity: 0.5 }}>
                    ❄
                </div>
            )}

            {/* Inner glow */}
            <div className="absolute inset-0 rounded-[1.75rem] pointer-events-none" data-depth="78"
                style={{ boxShadow: `inset 0 0 28px ${theme.accent_color}12, inset 0 1px 0 rgba(255,255,255,0.05)` }} />
        </div>
    );
}

// ─── Section Divider ──────────────────────────────────────────────────────────

function SectionDivider({ title, subtitle, isPro }) {
    return (
        <div className="mb-8 md:mb-10">
            <div className="flex items-center gap-4 mb-6">
                <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, var(--border-color) 40%, var(--border-color) 60%, transparent)' }} />
                <span className="text-claude-accent text-xs opacity-40 select-none" aria-hidden="true">✦</span>
                <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, var(--border-color) 40%, var(--border-color) 60%, transparent)' }} />
            </div>
            <div className="flex items-baseline gap-3 px-4 md:px-0">
                <h2 className="text-3xl md:text-4xl font-light italic tracking-tight text-claude-text"
                    style={{ fontFamily: '"Cormorant Garamond", "Instrument Serif", serif' }}>
                    {title}
                </h2>
                {isPro && (
                    <span className="text-[9px] font-mono bg-claude-accent/10 text-claude-accent border border-claude-accent/20 px-2 py-0.5 rounded-sm tracking-widest font-bold uppercase">
                        Pro
                    </span>
                )}
            </div>
            <p className="text-[11px] font-mono text-claude-secondary mt-2 tracking-wide px-4 md:px-0">{subtitle}</p>
        </div>
    );
}

// ─── Theme Section ────────────────────────────────────────────────────────────

function ThemeSection({ title, subtitle, themes, activeThemeId, onSelect, isCustom, onEdit, onDelete, isPro, onCreateNew, carouselIndex, onCarouselScroll }) {
    if (themes.length === 0 && !isCustom) return null;
    if (themes.length === 0 && isCustom) {
        return (
            <section className="relative w-full px-4 md:px-0">
                <SectionDivider title={title} subtitle={subtitle} isPro={isPro} />
                <EmptyGallery onCreateNew={onCreateNew} />
            </section>
        );
    }

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.07 } }
    };
    const item = {
        hidden: { opacity: 0, scale: 0.94, y: 12 },
        show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 22, stiffness: 200 } }
    };

    const handleScroll = (e) => {
        if (!onCarouselScroll) return;
        const el = e.currentTarget;
        const cardWidth = el.scrollWidth / themes.length;
        const index = Math.round(el.scrollLeft / cardWidth);
        onCarouselScroll(Math.min(index, themes.length - 1));
    };

    return (
        <section className="relative w-full">
            <SectionDivider title={title} subtitle={subtitle} isPro={isPro} />
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                onScroll={handleScroll}
                className="flex md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none gap-4 md:gap-5 pt-4 md:pt-8 pb-4 px-4 md:px-0 -mx-4 md:mx-0 [&::-webkit-scrollbar]:hidden"
            >
                {themes.map((theme) => (
                    <motion.div
                        key={theme.id}
                        variants={item}
                        className="snap-center md:snap-align-none shrink-0 w-[72vw] md:w-auto md:shrink"
                    >
                        <ThemeCard
                            theme={theme}
                            isActive={activeThemeId === theme.id}
                            onSelect={() => onSelect(theme.id)}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            isCustom={isCustom}
                        />
                    </motion.div>
                ))}
            </motion.div>

            {themes.length > 1 && (
                <div className="flex md:hidden items-center justify-center gap-2 pb-8 pt-2">
                    {themes.map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{ width: i === carouselIndex ? 20 : 6, opacity: i === carouselIndex ? 1 : 0.3 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="h-1.5 rounded-full bg-claude-accent"
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

function ThemeCard({ theme, isActive, onSelect, onEdit, onDelete, isCustom }) {
    const cardRef = useRef(null);
    const archetype = THEME_ARCHETYPES[theme.name] || 'default';

    // GSAP magnetic hover (desktop only)
    useEffect(() => {
        const el = cardRef.current;
        if (!el || window.matchMedia('(hover: none)').matches) return;

        const onEnter = () => {
            if (isActive) return;
            gsap.to(el, { y: -8, scale: 1.015, duration: 0.35, ease: 'power2.out' });
        };
        const onLeave = () => {
            gsap.to(el, { y: 0, scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.6)' });
        };

        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
        return () => {
            el.removeEventListener('mouseenter', onEnter);
            el.removeEventListener('mouseleave', onLeave);
        };
    }, [isActive]);

    return (
        <div
            ref={cardRef}
            onClick={onSelect}
            className="group relative overflow-hidden cursor-pointer select-none flex flex-col"
            style={{
                borderRadius: '1.25rem',
                backgroundColor: theme.bg_color,
                border: isActive ? `2px solid ${theme.accent_color}` : `1px solid ${theme.border_color}`,
                boxShadow: isActive
                    ? `0 0 0 3px ${theme.accent_color}15, 0 16px 48px -8px ${theme.accent_color}30`
                    : `0 2px 12px -3px rgba(0,0,0,0.12)`,
                height: '15rem',
                transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
        >
            {/* ── Color Panel ── */}
            <div
                className="relative overflow-hidden shrink-0"
                style={{ height: '54%', backgroundColor: theme.surface_color }}
            >
                {/* Noise */}
                <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: NOISE_SVG }} />

                {/* Per-theme animation */}
                <ThemeAnimationOverlay themeName={theme.name} isHero={false} />

                {/* Signature diagonal accent — varies by archetype */}
                <CardAccentShape theme={theme} archetype={archetype} isActive={isActive} />

                {/* Font label */}
                <div className="absolute top-3 left-4 z-10">
                    <span className="text-[8px] font-mono uppercase tracking-[0.22em] opacity-40" style={{ color: theme.text_color }}>
                        {theme.font_family_display.split(' ')[0]}
                    </span>
                </div>

                {/* Active badge */}
                {isActive && (
                    <motion.div
                        layoutId="activeThemeBadge"
                        className="absolute top-3 right-3 z-20 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{
                            backgroundColor: `${theme.bg_color}CC`,
                            boxShadow: `0 0 0 1.5px ${theme.accent_color}80, 0 2px 10px ${theme.accent_color}40`,
                        }}
                    >
                        <motion.div
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <Check className="w-3 h-3" style={{ color: theme.accent_color }} />
                        </motion.div>
                    </motion.div>
                )}

                {/* Bottom edge */}
                <div className="absolute bottom-0 left-0 right-0 h-px" style={{ backgroundColor: `${theme.border_color}60` }} />
            </div>

            {/* ── Identity + Palette ── */}
            <div className="flex-1 flex flex-col justify-between px-4 py-3.5" style={{ backgroundColor: theme.bg_color }}>
                <h3
                    className="text-lg font-light tracking-tight leading-[1.1] line-clamp-1"
                    style={{ color: theme.text_color, fontFamily: `${theme.font_family_display}, serif` }}
                >
                    {theme.name}
                </h3>

                <div className="flex items-center justify-between">
                    {/* Palette dots */}
                    <div className="flex items-center gap-1.5">
                        {[theme.accent_color, theme.text_color, theme.secondary_text_color, theme.surface_color, theme.border_color].map((c, i) => (
                            <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 0 1px ${theme.border_color}80` }} />
                        ))}
                    </div>

                    {isCustom && (
                        <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button onClick={(e) => onEdit(e, theme)}
                                className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
                                style={{ color: theme.secondary_text_color, backgroundColor: theme.surface_color, border: `1px solid ${theme.border_color}` }}
                                aria-label="Edit theme">
                                <Edit3 className="w-3 h-3" />
                            </button>
                            <button onClick={(e) => onDelete(e, theme)}
                                className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
                                style={{ color: '#ef4444', backgroundColor: theme.surface_color, border: `1px solid ${theme.border_color}` }}
                                aria-label="Delete theme">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Card Accent Shape — per-archetype signature visual ────────────────────────

function CardAccentShape({ theme, archetype, isActive }) {
    // Each archetype gets a distinctly different geometric treatment
    switch (archetype) {
        case 'cosmos':
            // Radial burst from top-right corner
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]">
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full transition-opacity duration-300"
                        style={{ background: `radial-gradient(circle, ${theme.accent_color}70 0%, transparent 65%)`, opacity: isActive ? 1 : 0.75 }} />
                    <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full"
                        style={{ background: `radial-gradient(circle, ${theme.accent_color}90 0%, transparent 60%)` }} />
                </div>
            );

        case 'depths':
            // Horizontal gradient wave
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]"
                    style={{ background: `linear-gradient(180deg, transparent 0%, ${theme.accent_color}20 60%, ${theme.accent_color}40 100%)`, opacity: isActive ? 0.9 : 0.7 }} />
            );

        case 'cyber':
            // Hard right-angle corner cut
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]">
                    <div className="absolute top-0 right-0 w-0 h-0 transition-opacity duration-300"
                        style={{
                            borderLeft: `60px solid transparent`,
                            borderTop: `80px solid ${theme.accent_color}`,
                            opacity: isActive ? 0.95 : 0.75,
                        }} />
                    {/* Accent line */}
                    <div className="absolute bottom-0 left-0 right-0 h-px"
                        style={{ background: `linear-gradient(90deg, ${theme.accent_color}80, transparent)` }} />
                </div>
            );

        case 'bloom':
            // Soft circular bloom centered
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]">
                    <div className="absolute inset-0" style={{
                        background: `radial-gradient(ellipse at 65% 40%, ${theme.accent_color}55 0%, transparent 60%)`,
                        opacity: isActive ? 1 : 0.8,
                    }} />
                </div>
            );

        case 'warmlight':
            // Bottom glow — sun rising
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]">
                    <div className="absolute bottom-0 left-0 right-0 h-3/4"
                        style={{ background: `linear-gradient(0deg, ${theme.accent_color}45 0%, transparent 100%)`, opacity: isActive ? 0.9 : 0.7 }} />
                </div>
            );

        case 'ember':
            // Diagonal slash — aggressive
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]">
                    <div className="absolute inset-y-0 right-0 transition-opacity duration-300"
                        style={{
                            width: '50%',
                            background: `linear-gradient(135deg, transparent 20%, ${theme.accent_color}50 100%)`,
                            opacity: isActive ? 0.95 : 0.8,
                        }} />
                </div>
            );

        case 'crystal':
            // Top frost gradient
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]">
                    <div className="absolute inset-0"
                        style={{ background: `linear-gradient(180deg, ${theme.accent_color}30 0%, transparent 60%)`, opacity: isActive ? 0.85 : 0.65 }} />
                </div>
            );

        case 'verdant':
            // Left edge organic bleed
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]">
                    <div className="absolute inset-y-0 left-0 w-2/3"
                        style={{ background: `radial-gradient(ellipse at 0% 50%, ${theme.accent_color}40 0%, transparent 70%)`, opacity: isActive ? 1 : 0.75 }} />
                </div>
            );

        case 'dusk':
            // Soft diagonal — feminine, warm
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]">
                    <div className="absolute inset-y-0 right-0 transition-opacity duration-300"
                        style={{
                            width: '44%',
                            backgroundColor: theme.accent_color,
                            opacity: isActive ? 0.85 : 0.65,
                            clipPath: 'polygon(25% 0, 100% 0, 100% 100%, 0% 100%)',
                        }} />
                </div>
            );

        case 'void':
            // Minimal — a single vertical line accent
            return (
                <div className="absolute inset-0 pointer-events-none z-[1]">
                    <div className="absolute top-0 bottom-0 right-12 w-px"
                        style={{ backgroundColor: theme.accent_color, opacity: isActive ? 0.5 : 0.2 }} />
                    <div className="absolute top-0 bottom-0 right-0 w-12"
                        style={{ backgroundColor: theme.accent_color, opacity: isActive ? 0.1 : 0.05 }} />
                </div>
            );

        default:
            // Riven / Riven Light — classic diagonal
            return (
                <div className="absolute inset-y-0 right-0 z-[1] transition-opacity duration-300"
                    style={{
                        width: '44%',
                        backgroundColor: theme.accent_color,
                        opacity: isActive ? 0.95 : 0.82,
                        clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)',
                    }} />
            );
    }
}

// ─── Empty Gallery ────────────────────────────────────────────────────────────

function EmptyGallery({ onCreateNew }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
            className="relative flex flex-col items-center justify-center py-20 px-8 text-center rounded-[2.5rem]"
            style={{ border: '1.5px dashed var(--border-color)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--surface-color) 60%, transparent), transparent)' }}
        >
            <div className="text-6xl font-light italic opacity-10 mb-6 select-none" aria-hidden="true"
                style={{ fontFamily: '"Cormorant Garamond", "Instrument Serif", serif', color: 'var(--accent-color)' }}>✦</div>
            <h3 className="text-3xl font-light italic tracking-tight text-claude-text mb-3"
                style={{ fontFamily: '"Cormorant Garamond", "Instrument Serif", serif' }}>Your gallery awaits.</h3>
            <p className="text-[11px] font-mono text-claude-secondary tracking-wide mb-8 max-w-xs">Craft a theme that is unmistakably yours.</p>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onCreateNew}
                className="flex items-center gap-3 px-8 py-4 rounded-full font-bold text-sm border"
                style={{ color: 'var(--accent-color)', borderColor: 'var(--accent-color)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 8%, transparent)' }}>
                <Plus className="w-4 h-4" />
                Begin Creating
            </motion.button>
        </motion.div>
    );
}
