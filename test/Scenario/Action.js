"use strict";

function Action(log, result) {
  this.log = log;
  this.result = result;
}

Action.prototype.toString = function() {
  return `Action: log=${log.toString()}, result=${result.toString()}`;
}

module.exports = Action;
