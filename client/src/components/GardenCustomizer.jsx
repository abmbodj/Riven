import { useState, useContext, useEffect } from 'react';
import { Palette, Sparkles, Trees, Lock, Check, X } from 'lucide-react';
import Garden from './Garden';
import { AuthContext } from '../context/AuthContext';
import { GardenContext } from '../context/GardenContext';
import { UIContext } from '../context/UIContext';
import {
    gardenThemes,
    decorations,
    specialPlants,
    isDecorationUnlocked,
    isPlantUnlocked,
    getNextUnlock
} from '../utils/gardenCustomization';

export default function GardenCustomizer({
    longestStreak = 0,
    currentStreak = 0,
    status = 'active',
    onClose
}) {
    const { isAdmin } = useContext(AuthContext);
    const { customization, setGardenTheme, toggleDecoration, togglePlant } = useContext(GardenContext);
    const { hideNav, showBottomNav } = useContext(UIContext);
    const [activeTab, setActiveTab] = useState('theme');

    // Effective streak for admins (unlocks everything)
    const effectiveStreak = isAdmin ? 9999 : longestStreak;

    // Hide bottom nav when customizer is open
    useEffect(() => {
        hideNav();
        return () => showBottomNav();
    }, [hideNav, showBottomNav]);

    const nextUnlock = isAdmin ? null : getNextUnlock(longestStreak);

    const handleThemeSelect = (themeId) => {
        setGardenTheme(themeId);
    };

    const handleDecorationToggle = (decorationId) => {
        if (isDecorationUnlocked(decorationId, effectiveStreak) || customization.decorations?.includes(decorationId)) {
            toggleDecoration(decorationId);
        }
    };

    const handlePlantToggle = (plantId) => {
        if (isPlantUnlocked(plantId, effectiveStreak) || customization.specialPlants?.includes(plantId)) {
            togglePlant(plantId);
        }
    };

    const tabs = [
        { id: 'theme', label: 'Theme', icon: Palette },
        { id: 'decorations', label: 'Decor', icon: Sparkles },
        { id: 'plants', label: 'Plants', icon: Trees }
    ];

    const decorationSlots = ['air', 'ground', 'structure', 'sky'];

    return (
        <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-0 sm:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div
                className="w-full h-full sm:h-auto sm:max-w-3xl sm:max-h-[85vh] overflow-hidden sm:rounded-2xl flex flex-col bg-claude-surface text-claude-text"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-claude-border shrink-0">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-display font-bold">Customize Garden</h2>
                        <p className="text-xs sm:text-sm text-claude-secondary mt-1">
                            Unlock more items by extending your streak!
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl active:bg-claude-bg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
                    {/* Preview Panel */}
                    <div className="w-full sm:w-1/3 p-6 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-claude-border bg-claude-bg/50">
                        <Garden
                            streak={currentStreak}
                            status={status}
                            size="lg"
                            showInfo={true}
                        />

                        {/* Next Unlock Info */}
                        {nextUnlock && (
                            <div className="mt-4 p-3 rounded-xl text-center text-sm bg-claude-surface border border-claude-border shadow-sm w-full max-w-[200px]">
                                <Lock className="w-4 h-4 mx-auto mb-1 text-claude-secondary" />
                                <p className="font-bold text-xs uppercase tracking-wider text-claude-secondary">Next Unlock</p>
                                <p className="font-semibold mt-1 flex items-center justify-center gap-1">
                                    <span>{nextUnlock.item.emoji}</span>
                                    <span>{nextUnlock.item.name}</span>
                                </p>
                                <p className="text-[10px] text-claude-secondary mt-1">
                                    in {nextUnlock.daysAway} day{nextUnlock.daysAway !== 1 ? 's' : ''}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Customization Panel */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Tabs */}
                        <div className="flex border-b border-claude-border shrink-0">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    className={`flex-1 p-4 flex flex-col sm:flex-row items-center justify-center gap-2 transition-all relative ${
                                        activeTab === tab.id ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'
                                    }`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">{tab.label}</span>
                                    {activeTab === tab.id && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-claude-accent" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
                            {/* Garden Themes */}
                            {activeTab === 'theme' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {gardenThemes.map(theme => {
                                        const isSelected = customization.gardenTheme === theme.id;
                                        return (
                                            <button
                                                key={theme.id}
                                                onClick={() => handleThemeSelect(theme.id)}
                                                className={`p-4 rounded-xl border-2 transition-all text-left ${
                                                    isSelected 
                                                        ? 'border-claude-accent bg-claude-accent/10' 
                                                        : 'border-claude-border active:border-claude-secondary'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="font-semibold">{theme.name}</span>
                                                    {isSelected && <Check className="w-4 h-4 text-claude-accent" />}
                                                </div>
                                                <p className="text-xs text-claude-secondary mb-3">{theme.description}</p>
                                                <div className="flex gap-1">
                                                    <div 
                                                        className="w-6 h-6 rounded-full border border-claude-border"
                                                        style={{ backgroundColor: theme.groundColor }}
                                                        title="Ground"
                                                    />
                                                    {theme.flowerColors.slice(0, 4).map((color, i) => (
                                                        <div 
                                                            key={i}
                                                            className="w-6 h-6 rounded-full border border-claude-border"
                                                            style={{ backgroundColor: color }}
                                                            title="Flower"
                                                        />
                                                    ))}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Decorations */}
                            {activeTab === 'decorations' && (
                                <div className="space-y-6">
                                    {decorationSlots.map(slot => {
                                        const slotDecorations = decorations.filter(d => d.slot === slot);
                                        const slotLabels = {
                                            air: '🦋 Flying',
                                            ground: '🌿 Ground',
                                            structure: '⛲ Structures',
                                            sky: '🌈 Sky'
                                        };
                                        
                                        return (
                                            <div key={slot}>
                                                <h3 className="text-sm font-bold uppercase tracking-wider text-claude-secondary mb-3">
                                                    {slotLabels[slot]}
                                                </h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {slotDecorations.map(dec => {
                                                        const isUnlocked = isDecorationUnlocked(dec.id, effectiveStreak);
                                                        const isEquipped = customization.decorations?.includes(dec.id);
                                                        
                                                        return (
                                                            <button
                                                                key={dec.id}
                                                                onClick={() => handleDecorationToggle(dec.id)}
                                                                disabled={!isUnlocked && !isEquipped}
                                                                className={`p-3 rounded-xl border-2 transition-all ${
                                                                    isEquipped
                                                                        ? 'border-claude-accent bg-claude-accent/10'
                                                                        : isUnlocked
                                                                            ? 'border-claude-border active:border-claude-secondary'
                                                                            : 'border-claude-border/50 opacity-50'
                                                                }`}
                                                            >
                                                                <div className="text-2xl mb-1">{dec.emoji}</div>
                                                                <div className="text-xs font-medium truncate">{dec.name}</div>
                                                                {!isUnlocked && (
                                                                    <div className="flex items-center justify-center gap-1 mt-1 text-[10px] text-claude-secondary">
                                                                        <Lock className="w-3 h-3" />
                                                                        <span>Day {dec.unlockAt}</span>
                                                                    </div>
                                                                )}
                                                                {isEquipped && (
                                                                    <Check className="w-4 h-4 text-claude-accent mx-auto mt-1" />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Special Plants */}
                            {activeTab === 'plants' && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {specialPlants.map(plant => {
                                        const isUnlocked = isPlantUnlocked(plant.id, effectiveStreak);
                                        const isEquipped = customization.specialPlants?.includes(plant.id);
                                        
                                        return (
                                            <button
                                                key={plant.id}
                                                onClick={() => handlePlantToggle(plant.id)}
                                                disabled={!isUnlocked && !isEquipped}
                                                className={`p-4 rounded-xl border-2 transition-all ${
                                                    isEquipped
                                                        ? 'border-claude-accent bg-claude-accent/10'
                                                        : isUnlocked
                                                            ? 'border-claude-border active:border-claude-secondary'
                                                            : 'border-claude-border/50 opacity-50'
                                                }`}
                                            >
                                                <div className="text-3xl mb-2">{plant.emoji}</div>
                                                <div className="text-sm font-medium">{plant.name}</div>
                                                {!isUnlocked && (
                                                    <div className="flex items-center justify-center gap-1 mt-2 text-xs text-claude-secondary">
                                                        <Lock className="w-3 h-3" />
                                                        <span>Day {plant.unlockAt}</span>
                                                    </div>
                                                )}
                                                {isEquipped && (
                                                    <Check className="w-4 h-4 text-claude-accent mx-auto mt-2" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
