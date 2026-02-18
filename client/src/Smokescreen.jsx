
import React from 'react';

export default function Smokescreen() {
    return (
        <div style={{ padding: 50, background: 'red', color: 'white', fontSize: 30 }}>
            <h1>SMOKESCREEN TEST</h1>
            <p>If you see this, React is working and the crash is inside App.jsx</p>
            <p>Environment: {import.meta.env.MODE}</p>
        </div>
    );
}
