export default function WaveformBars({ compact = false, className = '' }) {
    return (
        <span
            aria-hidden="true"
            className={`recording-waveform${compact ? ' recording-waveform--compact' : ''}${className ? ` ${className}` : ''}`}
        >
            <span className="recording-waveform__bar" />
            <span className="recording-waveform__bar" />
            <span className="recording-waveform__bar" />
        </span>
    );
}
