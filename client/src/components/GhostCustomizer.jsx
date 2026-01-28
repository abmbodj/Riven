import { useState, useEffect } from 'react';
import { Palette, Sparkles, User, Lock, Check } from 'lucide-react';
import GhostPet from './GhostPet';
import {
    ghostTypes,
    accessories,
    colorPalettes,
    loadCustomization,
    saveCustomization,
    isAccessoryUnlocked,
    isPaletteUnlocked,
    equipAccessory,
    unequipAccessory,
    setGhostType,
    setColorPalette,
    getNextUnlock
} from '../utils/ghostCustomization';

/**
 * @typedef {Object} GhostCustomizerProps
 * @property {number} longestStreak - Longest streak for unlock checks
 * @property {number} currentStreak - Current streak for preview
 * @property {'wisp' | 'orb' | 'small' | 'medium' | 'full'} ghostStage - Current ghost stage
 * @property {'active' | 'at-risk' | 'broken'} status - Current streak status
 * @property {Function} onClose - Close handler
 */

export default function GhostCustomizer({ 
    longestStreak = 0, 
    currentStreak = 0, 
    ghostStage = 'wisp',
    status = 'active',
    onClose 
}) {
    const [customization, setCustomization] = useState(loadCustomization);
    const [activeTab, setActiveTab] = useState('type');

    // Save whenever customization changes
    useEffect(() => {
        saveCustomization(customization);
    }, [customization]);

    const nextUnlock = getNextUnlock(longestStreak);

    const handleTypeSelect = (typeId) => {
        setCustomization(prev => setGhostType(prev, typeId));
    };

    const handlePaletteSelect = (paletteId) => {
        setCustomization(prev => setColorPalette(prev, paletteId, longestStreak));
    };

    const handleAccessoryToggle = (accessoryId) => {
        const isEquipped = customization.accessories.includes(accessoryId);
        if (isEquipped) {
            setCustomization(prev => unequipAccessory(prev, accessoryId));
        } else {
            setCustomization(prev => equipAccessory(prev, accessoryId, longestStreak));
        }
    };

    const tabs = [
        { id: 'type', label: 'Personality', icon: User },
        { id: 'colors', label: 'Colors', icon: Palette },
        { id: 'accessories', label: 'Accessories', icon: Sparkles }
    ];

    const accessorySlots = ['head', 'face', 'body', 'trail'];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
                className="max-w-3xl w-full max-h-[85vh] overflow-hidden rounded-2xl flex flex-col"
                style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div>
                        <h2 className="text-2xl font-bold">Customize Your Ghost</h2>
                        <p className="text-sm opacity-70 mt-1">
                            Unlock more items by extending your streak!
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-black/10 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Preview Panel */}
                    <div 
                        className="w-1/3 p-6 flex flex-col items-center justify-center border-r"
                        style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                    >
                        <GhostPet 
                            stage={ghostStage}
                            status={status}
                            streak={currentStreak}
                            size="lg"
                            showInfo={true}
                        />
                        
                        {/* Next Unlock Info */}
                        {nextUnlock && (
                            <div 
                                className="mt-4 p-3 rounded-lg text-center text-sm"
                                style={{ backgroundColor: 'var(--card)' }}
                            >
                                <Lock className="w-4 h-4 mx-auto mb-1 opacity-50" />
                                <p className="font-medium">Next Unlock</p>
                                <p className="opacity-70">
                                    {nextUnlock.item.name || nextUnlock.item.id}
                                </p>
                                <p className="text-xs opacity-50 mt-1">
                                    in {nextUnlock.daysAway} day{nextUnlock.daysAway !== 1 ? 's' : ''}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Customization Panel */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Tabs */}
                        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    className={`flex-1 p-4 flex items-center justify-center gap-2 transition-colors ${
                                        activeTab === tab.id ? 'border-b-2' : 'opacity-60 hover:opacity-100'
                                    }`}
                                    style={{ 
                                        borderColor: activeTab === tab.id ? 'var(--primary)' : 'transparent'
                                    }}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {/* Personality Types */}
                            {activeTab === 'type' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {ghostTypes.map(type => (
                                        <button
                                            key={type.id}
                                            className={`p-4 rounded-xl text-left transition-all ${
                                                customization.ghostType === type.id 
                                                    ? 'ring-2' 
                                                    : 'hover:scale-[1.02]'
                                            }`}
                                            style={{ 
                                                backgroundColor: 'var(--muted)',
                                                ringColor: 'var(--primary)'
                                            }}
                                            onClick={() => handleTypeSelect(type.id)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold">{type.name}</span>
                                                {customization.ghostType === type.id && (
                                                    <Check className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                                                )}
                                            </div>
                                            <p className="text-xs opacity-70">{type.description}</p>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Color Palettes */}
                            {activeTab === 'colors' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {colorPalettes.map(palette => {
                                        const unlocked = isPaletteUnlocked(palette.id, longestStreak);
                                        const selected = customization.colorPalette === palette.id;
                                        
                                        return (
                                            <button
                                                key={palette.id}
                                                className={`p-4 rounded-xl text-left transition-all relative ${
                                                    selected ? 'ring-2' : unlocked ? 'hover:scale-[1.02]' : 'opacity-50'
                                                }`}
                                                style={{ 
                                                    backgroundColor: 'var(--muted)',
                                                    ringColor: 'var(--primary)'
                                                }}
                                                onClick={() => unlocked && handlePaletteSelect(palette.id)}
                                                disabled={!unlocked}
                                            >
                                                {/* Color Preview */}
                                                <div className="flex gap-2 mb-2">
                                                    <div 
                                                        className="w-8 h-8 rounded-full border-2"
                                                        style={{ backgroundColor: palette.primary, borderColor: 'var(--border)' }}
                                                    />
                                                    <div 
                                                        className="w-8 h-8 rounded-full border-2"
                                                        style={{ backgroundColor: palette.secondary, borderColor: 'var(--border)' }}
                                                    />
                                                    <div 
                                                        className="w-8 h-8 rounded-full border-2"
                                                        style={{ backgroundColor: palette.accent, borderColor: 'var(--border)' }}
                                                    />
                                                </div>
                                                
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold">{palette.name}</span>
                                                    {selected && (
                                                        <Check className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                                                    )}
                                                </div>
                                                
                                                {!unlocked && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                                                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-black/50 text-white text-xs">
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
                                <div className="space-y-6">
                                    {accessorySlots.map(slot => (
                                        <div key={slot}>
                                            <h3 className="text-sm font-semibold mb-3 capitalize opacity-70">
                                                {slot} Items
                                            </h3>
                                            <div className="grid grid-cols-3 gap-2">
                                                {accessories.filter(a => a.slot === slot).map(accessory => {
                                                    const unlocked = isAccessoryUnlocked(accessory.id, longestStreak);
                                                    const equipped = customization.accessories.includes(accessory.id);
                                                    
                                                    return (
                                                        <button
                                                            key={accessory.id}
                                                            className={`p-3 rounded-xl text-center transition-all relative ${
                                                                equipped ? 'ring-2' : unlocked ? 'hover:scale-[1.02]' : 'opacity-40'
                                                            }`}
                                                            style={{ 
                                                                backgroundColor: 'var(--muted)',
                                                                ringColor: 'var(--primary)'
                                                            }}
                                                            onClick={() => unlocked && handleAccessoryToggle(accessory.id)}
                                                            disabled={!unlocked}
                                                        >
                                                            <div className="text-2xl mb-1">
                                                                {accessory.emoji}
                                                            </div>
                                                            <div className="text-xs font-medium truncate">
                                                                {accessory.name}
                                                            </div>
                                                            
                                                            {equipped && (
                                                                <div 
                                                                    className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                                                    style={{ backgroundColor: 'var(--primary)' }}
                                                                >
                                                                    <Check className="w-3 h-3" style={{ color: 'var(--primary-foreground)' }} />
                                                                </div>
                                                            )}
                                                            
                                                            {!unlocked && (
                                                                <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/50 text-white text-[10px]">
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
                    className="p-4 border-t flex justify-between items-center"
                    style={{ borderColor: 'var(--border)' }}
                >
                    <p className="text-xs opacity-50">
                        Changes save automatically
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg font-medium transition-colors"
                        style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
