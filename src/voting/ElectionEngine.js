class ElectionEngine {
  constructor() {
    this.methods = new Map();
  }

  registerMethod(method) {
    this.methods.set(method.name, method);
  }

  getAvailableMethods() {
    return Array.from(this.methods.keys());
  }

  runElection(config) {
    const { title, candidates, method, ballots, seats = 1 } = config;

    const votingMethod = this.methods.get(method);
    if (!votingMethod) {
      throw new Error(
        `Unknown voting method: "${method}". Available: ${this.getAvailableMethods().join(', ')}`
      );
    }

    const validation = votingMethod.validate(candidates, ballots);
    if (!validation.valid) {
      throw new Error(`Ballot validation failed:\n${validation.errors.join('\n')}`);
    }

    const result = votingMethod.tabulate(candidates, ballots, seats);
    result.title = title;
    result.timestamp = new Date().toISOString();
    return result;
  }
}

module.exports = ElectionEngine;
