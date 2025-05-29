exports.decorateTerm = (Term, { React }) => {
  return class extends React.Component {
    constructor(props, context) {
      super(props, context);
      this.lastCursor = { x: 0, y: 0 };
      this.targetCursor = { x: 0, y: 0 };
      this._animate = this._animate.bind(this);
    }

    _onDecorated = (term) => {
      if (this.props.onDecorated) this.props.onDecorated(term);
      this._termRef = term.termRef;
      this._createCursor();
      requestAnimationFrame(this._animate);
    };

    _createCursor() {
      this.cursor = document.createElement('div');
      Object.assign(this.cursor.style, {
        position: 'absolute',
        width: '2px',           // thinner cursor
        height: '14px',         // shorter height
        background: '#8F93A2',
        transition: 'transform 100ms ease-out',
        zIndex: 1000,
        pointerEvents: 'none',
        borderRadius: '1px'
      });
      document.body.appendChild(this.cursor);
    }

    _onCursorMove = ({ x, y }) => {
      const origin = this._termRef.getBoundingClientRect();
      this.targetCursor = { x: x + origin.left, y: y + origin.top };
    };

    _animate() {
      const lerp = (a, b, t) => a + (b - a) * t;
      this.lastCursor.x = lerp(this.lastCursor.x, this.targetCursor.x, 0.2);
      this.lastCursor.y = lerp(this.lastCursor.y, this.targetCursor.y, 0.2);
      this.cursor.style.transform = `translate(${this.lastCursor.x}px, ${this.lastCursor.y}px)`;
      requestAnimationFrame(this._animate);
    }

    componentWillUnmount() {
      this.cursor.remove();
    }

    render() {
      return React.createElement(Term, {
        ...this.props,
        onDecorated: this._onDecorated,
        onCursorMove: this._onCursorMove
      });
    }
  };
};
