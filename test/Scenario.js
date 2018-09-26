"use strict";

const {initWorld} = require('./Scenario/World');
const {processEvents} = require('./Scenario/Event');

const scenarios = require("./scenarios.json");

/**
  * N.B. only run scenarios matching the following regular expression
  */
const INCLUDED_SCENARIOS = /^(Supply|Withdraw|Borrow|PayBorrow|Liquidate|Excel):/i;

contract('Scenarios', function(accounts) {
  /*
   * This test runs our scenarios, which come from the reference implementation.
   */

  Object.entries(scenarios).forEach(([name, events]) => {
    if (name.match(INCLUDED_SCENARIOS)) {
      it("scenario: " + name, async () => {
        const world = await initWorld(accounts);
        let finalWorld;

        // console.log(["Scenario", name, "Events", events, world]);

        finalWorld = await processEvents(world, events);

        // console.log(["Final world", finalWorld, finalWorld.actions]);
      });
    } else {
      it.skip("scenario: " + name, async () => {});
    }
  });
});
