const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'client/src/components');

// Simple recursive directory walk
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.jsx') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(srcDir);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Background Surface
    content = content.replace(/bg-\[#1e3840\]\/(\d+)/g, 'bg-[color-mix(in_srgb,var(--surface-color)_$1%,transparent)]');
    content = content.replace(/bg-\[#1e3840\]/g, 'bg-claude-surface');

    // Background App
    content = content.replace(/bg-\[#162a31\]\/(\d+)/g, 'bg-[color-mix(in_srgb,var(--bg-color)_$1%,transparent)]');
    content = content.replace(/bg-\[#162a31\]/g, 'bg-claude-bg');

    // Borders
    content = content.replace(/border-\[#233e46\]\/(\d+)/g, 'border-[color-mix(in_srgb,var(--border-color)_$1%,transparent)]');
    content = content.replace(/border-\[#233e46\]/g, 'border-claude-border');

    // Text Secondary
    content = content.replace(/text-\[#8fa6a8\]\/(\d+)/g, 'text-[color-mix(in_srgb,var(--secondary-text-color)_$1%,transparent)]');
    content = content.replace(/text-\[#8fa6a8\]/g, 'text-claude-secondary');

    // Text Primary
    content = content.replace(/text-\[#e4ddd0\]/g, 'text-claude-text');

    fs.writeFileSync(file, content, 'utf8');
});

console.log('Done modifying colors in pages!');
