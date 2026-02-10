const ElectionEngine = require('./ElectionEngine');
const IRVMethod = require('./IRVMethod');

function createEngine() {
  const engine = new ElectionEngine();
  engine.registerMethod(new IRVMethod());
  return engine;
}

module.exports = { ElectionEngine, IRVMethod, createEngine };
