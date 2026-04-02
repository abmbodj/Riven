import React from 'react';
import SettingsSidebar from './SettingsSidebar';
import SettingsPillTabs from './SettingsPillTabs';

export default function SettingsNav({ sections, activeSection, onSectionChange, sidebarExpanded, onToggleSidebar }) {
    return (
        <>
            {/* Desktop sidebar (lg+) */}
            <div className="hidden lg:block">
                <SettingsSidebar
                    sections={sections}
                    activeSection={activeSection}
                    onSectionChange={onSectionChange}
                    expanded={sidebarExpanded}
                    onToggleExpanded={onToggleSidebar}
                />
            </div>

            {/* Mobile/tablet pill tabs (< lg) */}
            <div className="lg:hidden sticky top-[calc(var(--settings-header-h,60px)+env(safe-area-inset-top,0px))] z-40 border-b border-claude-border/40 bg-claude-bg/90 backdrop-blur-xl">
                <SettingsPillTabs
                    sections={sections}
                    activeSection={activeSection}
                    onSectionChange={onSectionChange}
                />
            </div>
        </>
    );
}
