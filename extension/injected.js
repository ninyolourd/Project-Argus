(() => {
  const LEVELS = ['log', 'info', 'warn', 'error', 'debug'];
  const original = {};

  function describe(arg) {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }

  function post(level, args) {
    window.postMessage(
      {
        source: 'argus-injected',
        level,
        message: args.map(describe).join(' '),
        timestamp: Date.now(),
      },
      '*'
    );
  }

  LEVELS.forEach((level) => {
    original[level] = console[level] ? console[level].bind(console) : console.log.bind(console);
    console[level] = (...args) => {
      original[level](...args);
      post(level, args);
    };
  });

  window.addEventListener('error', (event) => {
    const location = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : '';
    post('error', [`${event.message}${location}`]);
  });

  window.addEventListener('unhandledrejection', (event) => {
    post('error', [`Unhandled promise rejection: ${describe(event.reason)}`]);
  });
})();
