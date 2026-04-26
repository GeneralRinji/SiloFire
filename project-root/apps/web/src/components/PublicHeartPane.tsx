interface PublicHeartPaneProps {
  active: boolean;
  isSaving: boolean;
  onHeart: () => void;
}

export function PublicHeartPane({ active, isSaving, onHeart }: PublicHeartPaneProps) {
  const heartGlyph = active || isSaving ? '❤' : '♡';

  return (
    <section className="panel-stack__section panel-stack__section--aux terminal-heart-pane">
      <button type="button" className="terminal-heart-pane__toggle" onClick={onHeart} disabled={isSaving} aria-pressed={active}>
        <span className="terminal-heart-pane__glyph" aria-hidden="true">{heartGlyph}</span>
        <span className="terminal-heart-pane__label">Show this node some love (analytics only)</span>
      </button>
    </section>
  );
}