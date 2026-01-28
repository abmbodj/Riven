import { useState, useEffect, useContext } from 'react';
import { Palette, Sparkles, User, Lock, Check } from 'lucide-react';
import PugPet from './PugPet';
import { AuthContext } from '../context/AuthContext';
import {
    pugTypes,
    accessories,
    colorPalettes,
    loadCustomization,
    saveCustomization,
    isAccessoryUnlocked,
    isPaletteUnlocked,
    equipAccessory,
    unequipAccessory,
    setPugType,
    setColorPalette,
    getNextUnlock
} from '../utils/pugCustomization';

/**
 * @typedef {Object} PugCustomizerProps
 * @property {number} longestStreak - Longest streak for unlock checks
 * @property {number} currentStreak - Current streak for preview
 * @property {'wisp' | 'orb' | 'small' | 'medium' | 'full'} pugStage - Current pug stage
 * @property {'active' | 'at-risk' | 'broken'} status - Current streak status
 * @property {Function} onClose - Close handler
 */

export default function PugCustomizer({
    longestStreak = 0,
    currentStreak = 0,
    pugStage = 'wisp',
    status = 'active',
    onClose
}) {
    const { isAdmin } = useContext(AuthContext);
    const [customization, setCustomization] = useState(loadCustomization);
    const [activeTab, setActiveTab] = useState('type');

    // Effective streak for admins (unlocks everything)
    const effectiveStreak = isAdmin ? 999 : longestStreak;

    // Save whenever customization changes
    useEffect(() => {
        saveCustomization(customization);
    }, [customization]);

    const nextUnlock = isAdmin ? null : getNextUnlock(longestStreak);

    const handleTypeSelect = (typeId) => {
        setCustomization(prev => setPugType(prev, typeId));
    };

    const handlePaletteSelect = (paletteId) => {
        setCustomization(prev => setColorPalette(prev, paletteId, effectiveStreak));
    };

    const handleAccessoryToggle = (accessoryId) => {
        const isEquipped = customization.accessories.includes(accessoryId);
        if (isEquipped) {
            setCustomization(prev => unequipAccessory(prev, accessoryId));
        } else {
            setCustomization(prev => equipAccessory(prev, accessoryId, effectiveStreak));
        }
    };

    const tabs = [
        { id: 'type', label: 'Personality', icon: User },
        { id: 'colors', label: 'Colors', icon: Palette },
        { id: 'accessories', label: 'Accessories', icon: Sparkles }
    ];

    const accessorySlots = ['head', 'face', 'body', 'trail'];

    return (
        <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-0 sm:p-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div
                className="w-full h-full sm:h-auto sm:max-w-3xl sm:max-h-[85vh] overflow-hidden sm:rounded-2xl flex flex-col bg-claude-surface text-claude-text"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-claude-border">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-display font-bold">Customize Gmail</h2>
                        <p className="text-xs sm:text-sm text-claude-secondary mt-1">
                            Unlock more items by extending your streak!
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl active:bg-claude-bg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
                    {/* Preview Panel */}
                    <div
                        className="w-full sm:w-1/3 p-6 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-claude-border bg-claude-bg/50"
                    >
                        <PugPet
                            stage={pugStage}
                            status={status}
                            streak={currentStreak}
                            size="lg"
                            showInfo={true}
                        />

                        {/* Next Unlock Info */}
                        {nextUnlock && (
                            <div
                                className="mt-4 p-3 rounded-xl text-center text-sm bg-claude-surface border border-claude-border shadow-sm w-full max-w-[200px]"
                            >
                                <Lock className="w-4 h-4 mx-auto mb-1 text-claude-secondary" />
                                <p className="font-bold text-xs uppercase tracking-wider text-claude-secondary">Next Unlock</p>
                                <p className="font-semibold mt-1">
                                    {nextUnlock.item.name || nextUnlock.item.id}
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
                        <div className="flex border-b border-claude-border">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    className={`flex-1 p-4 flex flex-col sm:flex-row items-center justify-center gap-2 transition-all relative ${activeTab === tab.id ? 'text-claude-accent' : 'text-claude-secondary active:text-claude-text'
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
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {/* Personality Types */}
                            {activeTab === 'type' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {pugTypes.map(type => (
                                        <button
                                            key={type.id}
                                            className={`p-4 rounded-xl text-left transition-all active:scale-[0.98] border ${customization.pugType === type.id
                                                ? 'border-claude-accent bg-claude-accent/5 ring-1 ring-claude-accent'
                                                : 'border-claude-border bg-claude-bg hover:border-claude-secondary'
                                                }`}
                                            onClick={() => handleTypeSelect(type.id)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-bold">{type.name}</span>
                                                {customization.pugType === type.id && (
                                                    <Check className="w-4 h-4 text-claude-accent" />
                                                )}
                                            </div>
                                            <p className="text-xs text-claude-secondary leading-relaxed">{type.description}</p>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Color Palettes */}
                            {activeTab === 'colors' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {colorPalettes.map(palette => {
                                        const unlocked = isPaletteUnlocked(palette.id, longestStreak, isAdmin);
                                        const selected = customization.colorPalette === palette.id;

                                        return (
                                            <button
                                                key={palette.id}
                                                className={`p-4 rounded-xl text-left transition-all relative active:scale-[0.98] border ${selected
                                                    ? 'border-claude-accent bg-claude-accent/5 ring-1 ring-claude-accent'
                                                    : unlocked
                                                        ? 'border-claude-border bg-claude-bg hover:border-claude-secondary'
                                                        : 'border-claude-border bg-claude-bg opacity-50 grayscale'
                                                    }`}
                                                onClick={() => unlocked && handlePaletteSelect(palette.id)}
                                                disabled={!unlocked}
                                            >
                                                {/* Color Preview */}
                                                <div className="flex gap-2 mb-3">
                                                    <div
                                                        className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm"
                                                        style={{ backgroundColor: palette.primary }}
                                                    />
                                                    <div
                                                        className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm"
                                                        style={{ backgroundColor: palette.secondary }}
                                                    />
                                                    <div
                                                        className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm"
                                                        style={{ backgroundColor: palette.accent }}
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold">{palette.name}</span>
                                                    {selected && (
                                                        <Check className="w-4 h-4 text-claude-accent" />
                                                    )}
                                                </div>

                                                {!unlocked && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl backdrop-blur-[1px]">
                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 text-white text-[10px] font-bold uppercase tracking-widest">
                                                            <Lock className="w-3 h-3" />
                                                            {palette.unlockAt} day streak
                                                        </div>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Accessories */}
                            {activeTab === 'accessories' && (
                                <div className="space-y-8">
                                    {accessorySlots.map(slot => (
                                        <div key={slot}>
                                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-4 flex items-center gap-2">
                                                <div className="h-px flex-1 bg-claude-border" />
                                                {slot} Items
                                                <div className="h-px flex-1 bg-claude-border" />
                                            </h3>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                                {accessories.filter(a => a.slot === slot).map(accessory => {
                                                    const unlocked = isAccessoryUnlocked(accessory.id, longestStreak, isAdmin);
                                                    const equipped = customization.accessories.includes(accessory.id);

                                                    return (
                                                        <button
                                                            key={accessory.id}
                                                            className={`p-3 rounded-xl text-center transition-all relative active:scale-[0.95] border ${equipped
                                                                ? 'border-claude-accent bg-claude-accent/5 ring-1 ring-claude-accent'
                                                                : unlocked
                                                                    ? 'border-claude-border bg-claude-bg hover:border-claude-secondary'
                                                                    : 'border-claude-border bg-claude-bg opacity-40 grayscale'
                                                                }`}
                                                            onClick={() => unlocked && handleAccessoryToggle(accessory.id)}
                                                            disabled={!unlocked}
                                                        >
                                                            <div className="text-3xl mb-2">
                                                                {accessory.emoji}
                                                            </div>
                                                            <div className="text-[10px] font-bold uppercase tracking-tight truncate text-claude-secondary">
                                                                {accessory.name}
                                                            </div>

                                                            {equipped && (
                                                                <div
                                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-claude-accent text-white shadow-sm"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                </div>
                                                            )}

                                                            {!unlocked && (
                                                                <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-[8px] font-bold">
                                                                    <Lock className="w-2 h-2" />
                                                                    {accessory.unlockAt}d
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="p-4 sm:p-6 border-t border-claude-border flex justify-between items-center bg-claude-surface safe-area-bottom"
                >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary">
                        Changes save automatically
                    </p>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-xl font-bold text-sm bg-claude-text text-claude-bg active:scale-95 transition-transform shadow-md"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
