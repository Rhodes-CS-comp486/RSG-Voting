class VotingMethod {
  constructor(name) {
    if (new.target === VotingMethod) {
      throw new Error('VotingMethod is abstract and cannot be instantiated directly');
    }
    this.name = name;
  }

  validate(candidates, ballots) {
    throw new Error('validate() must be implemented by subclass');
  }

  tabulate(candidates, ballots, seats = 1) {
    throw new Error('tabulate() must be implemented by subclass');
  }
}

module.exports = VotingMethod;
