const ElectionEngine = require('./ElectionEngine');
const IRVMethod = require('./IRVMethod');
const BordaCountMethod = require('./BordaCountMethod');
const PreferentialBlockMethod = require('./PreferentialBlockMethod');

function createEngine() {
  const engine = new ElectionEngine();
  engine.registerMethod(new PreferentialBlockMethod());
  engine.registerMethod(new IRVMethod());
  engine.registerMethod(new BordaCountMethod());
  return engine;
}

module.exports = { ElectionEngine, IRVMethod, BordaCountMethod, PreferentialBlockMethod, createEngine };
