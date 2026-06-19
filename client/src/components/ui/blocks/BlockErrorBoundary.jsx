import React from 'react';

/**
 * Wraps a single figure block (Mermaid / plot / chart). If rendering throws, it
 * degrades to the raw spec in a labeled <pre> so one bad figure never blanks the
 * tutor session.
 */
class BlockErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="subject-figure-fallback" role="img" aria-label={`${this.props.label || 'Figure'} unavailable`}>
          <span className="subject-figure-fallback__caption">{this.props.label || 'Figure'} unavailable</span>
          {this.props.fallbackCode ? (
            <pre className="subject-code-block"><code>{this.props.fallbackCode}</code></pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

export default BlockErrorBoundary;
