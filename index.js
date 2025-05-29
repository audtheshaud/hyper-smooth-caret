const awaiting = new Set();

exports.middleware = (store) => (next) => (action) => {
  // For actions containing PTY output
  if (action.type === 'SESSION_PTY_DATA') {
    console.log('RAW PTY>', JSON.stringify(action.data));
    // SESSION_PTY_DATA has a data property that contains the terminal output.
    const { data, uid } = action;
    
    // For instance, check if the output includes a carriage return.
    // This might indicate that a command has just finished executing.
    if (!awaiting.has(uid) && /\r?\n/.test(data)) {
      awaiting.add(uid);
      // Dispatch an action to disable cursor animation,
      // or perform any other UI update based on the new output.
      store.dispatch({
        type: 'CURSOR_DISABLE_ANIMATION'
      });
    }

    if (awaiting.has(uid) && (/\]\$\u001b\[00m/.test(data) || /[^a-zA-Z0-9]?\s*\b(?:yes|no|y\/n|y|n)\b\s*\:?$/i.test(data))) {
      awaiting.delete(uid);
      store.dispatch({
        type: 'CURSOR_ENABLE_ANIMATION'
      });
    }

  }
  next(action);
};

// ================================================================
// Redux Architecture Integration
// ================================================================

// This function maps Hyper's UI state (from Redux) and adds our custom
// property "cursorAnimated". Assume the UI state is stored under state.ui.

const defaultUIState = {
  cursorAnimated: true  // or false, depending on your default
};

exports.reduceUI = (state = defaultUIState, action) => {
  switch (action.type) {
    case 'CURSOR_DISABLE_ANIMATION':
      return state.set('cursorAnimated', false);
    case 'CURSOR_ENABLE_ANIMATION':
      return state.set('cursorAnimated', true);
    default:
      return state;
  }
};

exports.mapTermsState = (state, map) => {
  return Object.assign(map, {
    // Use the redux property's value or default to true if it's undefined.
    cursorAnimated: typeof state.ui.cursorAnimated !== 'undefined'
      ? state.ui.cursorAnimated
      : true
  });
};

// These functions propagate the property down to nested terminal components.
const passProps = (uid, parentProps, props) => {
  return Object.assign(props, {
    cursorAnimated: parentProps.cursorAnimated
  });
};
exports.getTermGroupProps = passProps;
exports.getTermProps = passProps;

// ================================================================
// Base plugin file with Redux integration for cursor animation
// ================================================================

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
        transition: 'transform 80ms ease-out',
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
      // Use the Redux state property "cursorAnimated" passed into props.
      // When true, animate smoothly; when false, immediately update.
      if (this.props.cursorAnimated) {
        this.lastCursor.x = lerp(this.lastCursor.x, this.targetCursor.x, 0.3);
        this.lastCursor.y = lerp(this.lastCursor.y, this.targetCursor.y, 0.3);
        this.cursor.style.display = 'block';
      } else {
        this.cursor.style.display = 'none';
        this.cursor.style.transition = 'none';
        this.lastCursor = { ...this.targetCursor };
      }
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
