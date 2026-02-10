const ElectionEngine = require('./ElectionEngine');
const IRVMethod = require('./IRVMethod');
const BordaCountMethod = require('./BordaCountMethod');

function createEngine() {
  const engine = new ElectionEngine();
  engine.registerMethod(new IRVMethod());
  engine.registerMethod(new BordaCountMethod());
  return engine;
}

module.exports = { ElectionEngine, IRVMethod, BordaCountMethod, createEngine };
