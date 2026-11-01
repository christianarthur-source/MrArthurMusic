// Pro Staff: the advanced notation editor at /prostaff (kept separate from the classroom Music Lab).
import React from 'react';
import ProStaffApp from './ui/ProStaffApp';

/** Shows a way out instead of a blank page if something unexpected breaks (scores autosave). */
class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('Pro Staff crashed', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#121418', color: '#e8e6e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 600 }}>Pro Staff hit a problem</h2>
          <p style={{ color: '#9aa0aa' }}>Your score was saved automatically a moment ago. Reload to keep working.</p>
          <button onClick={() => location.reload()} style={{ marginTop: 12, padding: '10px 18px', borderRadius: 8, border: 0, background: '#d4a24e', color: '#1b1508', fontWeight: 600, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default function ProStaff() {
  return (
    <Boundary>
      <ProStaffApp />
    </Boundary>
  );
}
