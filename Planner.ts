///<reference path="World.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="Graph.ts"/>
///<reference path="Physics.ts"/>


/**
* Planner module
*
* The goal of the Planner module is to take the interpetation(s)
* produced by the Interpreter module and to plan a sequence of actions
* for the robot to put the world into a state compatible with the
* user's command, i.e. to achieve what the user wanted.
*
* The planner should use your A* search implementation to find a plan.
*/
module Planner {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

    /**
     * Top-level driver for the Planner. Calls `planInterpretation` for each given interpretation generated by the Interpreter.
     * @param interpretations List of possible interpretations.
     * @param currentState The current state of the world.
     * @returns Augments Interpreter.InterpretationResult with a plan represented by a list of strings.
     */
    export function plan(interpretations : Interpreter.InterpretationResult[], currentState : WorldState) : PlannerResult[] {
        var errors : Error[] = [];
        var plans : PlannerResult[] = [];
        interpretations.forEach((interpretation) => {
            try {
                var result : PlannerResult = <PlannerResult>interpretation;
                result.plan = planInterpretation(result.interpretation, currentState);
                if (result.plan.length == 0) {
                    result.plan.push("That is already true!");
                }
                plans.push(result);
            } catch(err) {
                errors.push(err);
            }
        });
        if (plans.length) {
            return plans;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface PlannerResult extends Interpreter.InterpretationResult {
        plan : string[];
    }

    export function stringify(result : PlannerResult) : string {
        return result.plan.join(", ");
    }

    //////////////////////////////////////////////////////////////////////
    // private functions

    /**
     * The core planner function. The code here is just a template;
     * you should rewrite this function entirely. In this template,
     * the code produces a dummy plan which is not connected to the
     * argument `interpretation`, but your version of the function
     * should be such that the resulting plan depends on
     * `interpretation`.
     *
     *
     * @param interpretation The logical interpretation of the user's desired goal. The plan needs to be such that by executing it, the world is put into a state that satisfies this goal.
     * @param state The current world state.
     * @returns Basically, a plan is a
     * stack of strings, which are either system utterances that
     * explain what the robot is doing (e.g. "Moving left") or actual
     * actions for the robot to perform, encoded as "l", "r", "p", or
     * "d". The code shows how to build a plan. Each step of the plan can
     * be added using the `push` method.
     */
    function planInterpretation(interpretation : Interpreter.DNFFormula, state : WorldState) : string[] {
        // Create world state node from state
        var startNode: WorldStateNode = new WorldStateNode(state.holding, state.stacks);
        console.log("Creating plan from interpretation");
        console.log("Starting world state:", startNode.toString());
        console.log("Goal criteria:", Interpreter.stringifyInterpretation(interpretation));

        // Use A*-planner to find world states to fulfill interpretation
        console.log("Use A* to find shortest path to satisfy goal");
        var result: SearchResult<WorldStateNode> = aStarSearch(
            new WorldStateGraph(state.objects),
            startNode,
            (n) => isGoal(n, interpretation, state.objects),
            (n) => heuristic(n, interpretation, state.objects),
            3
        )

        // Check for timeout
        if(result.path.length == 0) {
            throw new Error("Search for goal timed out!");
        }

        // Create instruction set from world states
        console.log("Found solution path, generating instructions");
        return createInstructions(state.arm, result, state.objects);
    }

    function heuristic(
        state: WorldStateNode, goal: Interpreter.DNFFormula, objects: { [s: string]: ObjectDefinition }): number {
        var conjHeuristic: number[] = [];

        // Loop over conjunctions
        for (var conj of goal) {
            // Loop over literals
            var litHeuristic: number[] = [];
            for (var literal of conj) {
                var objs = literal.args.map((o) => getObjectFromWorldState(state, o, objects));
                var h : number = 0;

                // Check if relation already satisfied
                if(Physics.hasValidLocation(objs[0], literal.relation, objs[1], objs[2])) {
                    litHeuristic.push(0);
                    continue;
                }

                switch (literal.relation) {
                    case "beside":
                    case "rightof":
                    case "leftof":
                        var above_0: number = 0;
                        var above_1: number = 0;
                        if (!objs[0].held) {
                            above_0 = state.stacks[objs[0].stackId].length - objs[0].stackLocation - 1;
                            h += 1;
                        }
                        if (!objs[1].held) {
                            above_1 = state.stacks[objs[1].stackId].length - objs[1].stackLocation - 1;
                            h += 1;
                        }
                        h += 2 * Math.min(above_0, above_1);
                        break;

                    case "inside":
                    case "ontop":
                        var stack_1 = objs[1].stackId;
                        if (!objs[0].held) {
                            // Number of object on top of target object to put way
                            h += 2 * (state.stacks[objs[0].stackId].length - objs[0].stackLocation - 1);
                            // Taking and dropping it
                            h += 2;
                        }
                        else {
                            // Only dropping it
                            h += 1;
                        }

                        if (!objs[1].held) {
                            if (objs[1].floor) {
                                // Minimum number of object on the floor
                                h += 2 * Math.min(...state.stacks.map((n) => (n.length)));
                            }
                            else {
                                // Number of object on top of goal object to put way
                                h += 2 * (state.stacks[objs[1].stackId].length - objs[1].stackLocation - 1);
                            }
                        }
                        else {
                            // Dropping it before
                            h += 1;
                        }
                        break;

                    case "under":
                        if (!objs[1].held) {
                            // Number of object on top of target object to put way
                            h += 2 * (state.stacks[objs[1].stackId].length - objs[1].stackLocation - 1);
                            // Taking and dropping it
                            h += 2;
                        }
                        else {
                            // Only dropping it
                            h += 1;
                        }

                        if (objs[0].held) {
                            // Dropping goal before putting something on top
                            h += 1;
                        }
                        break;

                    case "above":
                        if (!objs[0].held) {
                            // Number of object on top of target object to put way
                            h += 2 * (state.stacks[objs[0].stackId].length - objs[0].stackLocation - 1);
                            // Taking and dropping it
                            h += 2;
                        }
                        else {
                            // Only dropping it
                            h += 1;
                        }

                        if (objs[1].held) {
                            // Dropping goal before putting something on top
                            h += 1;
                        }
                        break;

                    case "holding":
                        if (!objs[0].held) {
                            // Number of object on top of target object to put way
                            h += 2 * (state.stacks[objs[0].stackId].length - objs[0].stackLocation - 1);
                            // Taking it
                            h += 1;
                        }
                        break;

                    case "between":
                        var order1 = 0;
                        var order1 = 0;
                        var order2 = 0;
                        var stackDist = Math.abs(objs[1].stackId - objs[2].stackId);

                        // Drop it in between
                        if (objs[0].held) {
                            if (stackDist > 1) {
                                // Only drop it
                                h = 1;
                            }
                            else {
                                // Rearrange the easiest one before dropping
                                var above1 = state.stacks[objs[1].stackId].length - objs[1].stackLocation - 1;
                                var above2 = state.stacks[objs[2].stackId].length - objs[2].stackLocation - 1;
                                h = 1 + 2 * Math.min(above1, above2);
                            }
                        }
                        else {
                            if (objs[1].held || objs[2].held) {
                                // Just drop it straight on the right spot
                                h = 1;
                            }
                            else {
                                var above0 = state.stacks[objs[0].stackId].length - objs[0].stackLocation - 1;
                                var above1 = state.stacks[objs[1].stackId].length - objs[1].stackLocation - 1;
                                var above2 = state.stacks[objs[2].stackId].length - objs[2].stackLocation - 1;

                                // Just move the easiest to move object
                                h = 2 + 2 * Math.min(above0, above1, above2);
                            }
                        }
                        break;

                    default:
                        console.warn("Unknown relation received:", literal.relation);
                        break;
                }

                litHeuristic.push(h);
            }

            // Take maximum
            conjHeuristic.push(Math.max(...litHeuristic));
        }

        // Take minimum
        return Math.min(...conjHeuristic);
    }

    function isGoal(
        node: WorldStateNode, interpretation: Interpreter.DNFFormula, objects: { [s: string]: ObjectDefinition }): boolean {
        // Check each goal description
        for(var goal of interpretation) {
            var feasible = true;
            for(var literal of goal) {
                // Check if the literal is valid given the polarity and the location of object
                var object1 = getObjectFromWorldState(node, literal.args[0], objects);
                var object2 = getObjectFromWorldState(node, literal.args[1], objects);
                var object3 = getObjectFromWorldState(node, literal.args[2], objects);
                //console.log("literals:", literal.args.join(", "), " rel:", literal.relation);
                //console.log("ob1:", object1);
                //console.log("ob2:", object2);
                if (!Physics.hasValidLocation(object1, literal.relation, object2, object3)){
                  //console.log("false")
                  feasible = false;
                  break;
                }
                //console.log("true");
            }

            if (feasible) {
                return true;
            }
        }
        return false;
    }

    function getObjectFromWorldState(
        state: WorldStateNode, obj: string, objects: { [s: string]: ObjectDefinition }): Physics.FoundObject {
        if(obj == undefined) {
            return null;
        }
        else if(obj == "floor") {
            return new Physics.FoundObject(null, false, -1, -1, true);
        }
        else if(obj == state.holding) {
            return new Physics.FoundObject(objects[obj], true, -1, -1, false);
        }
        else {
            var held = false;
            var definition = objects[obj];
            var stackId: number;
            var stackLoc: number;
            // Find location of object
            for (var i = 0; i < state.stacks.length; i++) {
                var stack = state.stacks[i];
                var loc = stack.indexOf(obj);
                if (loc > -1) {
                    stackLoc = loc;
                    stackId = i;
                    break;
                }
            }
            return new Physics.FoundObject(definition, held, stackId, stackLoc, false);
        }
    }

    class WorldStateNode {
        // null if no object is held
        holding: string;
        stacks : Stack[];

        constructor(holding : string, stacks: Stack[]) {
            this.holding = holding;
            this.stacks = stacks;
        }

        toString(): string {
            var str = "{";
            str += "held: " + ((this.holding != null) ? this.holding : "none");
            str += ", stacks: " + this.stacks.map((s) => "{" + s.join(", ") + "}").join(", ");
            str += "}";
            return str;
        }
    }

    class WorldStateGraph implements Graph<WorldStateNode> {
        objects: { [s: string]: ObjectDefinition };

        constructor(objects: { [s: string]: ObjectDefinition }) {
            this.objects = objects;
        }

        /** Computes the edges that leave from a node. */
        outgoingEdges(node: WorldStateNode): Edge<WorldStateNode>[] {
            console.log("Finding following states of", node.toString());
            var edges: Edge<WorldStateNode>[] = [];

            if(node.holding == null) {
                // Pick up all object which are on the top
                for (var i = 0; i < node.stacks.length; i++) {
                    // Skip empty stacks
                    if(node.stacks[i].length == 0) {
                        continue;
                    }

                    // Add possible following state
                    var newStacks: Stack[] = node.stacks.map((s) => s.slice());
                    var obj = newStacks[i].pop();

                    var edge = new Edge<WorldStateNode>();
                    edge.from = node;
                    edge.to = new WorldStateNode(obj, newStacks);
                    edge.cost = 1;
                    edges.push(edge);
                }
            }
            else {
                // Find all possible stacks where to put the held object
                for (var i = 0; i < node.stacks.length; i++) {
                    // test non-empty stacks
                    if(node.stacks[i].length != 0) {
                        // Check physics
                        var topObj = this.objects[node.holding];
                        var bottomObj = this.objects[node.stacks[i][node.stacks[i].length-1]];
                        if(!Physics.isStackingAllowedByPhysics(topObj, bottomObj)){
                            continue;
                        }
                    }

                    // Add possible following state
                    var newStacks: Stack[] = node.stacks.map((s) => s.slice());
                    newStacks[i].push(node.holding);

                    var edge = new Edge<WorldStateNode>();
                    edge.from = node;
                    edge.to = new WorldStateNode(null, newStacks);
                    edge.cost = 1;
                    edges.push(edge);
                }
            }

            return edges;
        }

        /** A function that compares nodes. */
        compareNodes(a: WorldStateNode, b: WorldStateNode): number {
            if(a.toString() == b.toString()) {
                return 0;
            }
            return -1;
        }
    }

    function createInstructions(
        armInit: number, result: SearchResult<WorldStateNode>, objects: { [s: string]: ObjectDefinition }): string[] {
        var instructions: string[] = [];
        var lastState: WorldStateNode = null;
        var armPosition = armInit;

        // Generate instructions for every state change
        for(var nextState of result.path) {
            // Handle first state
            if(lastState == null) {
                lastState = nextState;
                continue;
            }

            // Find object and new/old position
            var heldObj: string;
            var fullObj: Physics.FoundObject;
            if (nextState.holding == null) {
                // Object from last has been dropped
                heldObj = lastState.holding;
                fullObj = getObjectFromWorldState(nextState, heldObj, objects);
            }
            else {
                // New object was taken
                heldObj = nextState.holding;
                fullObj = getObjectFromWorldState(lastState, heldObj, objects);
            }

            // Move arm to target/original stack
            if(armPosition > fullObj.stackId) {
                instructions.push("Moving left");
                for (var i = armPosition; i > fullObj.stackId; i--) {
                    instructions.push("l");
                }
            }
            else if (armPosition < fullObj.stackId) {
                instructions.push("Moving right");
                for (var i = armPosition; i < fullObj.stackId; i++) {
                    instructions.push("r");
                }
            }

            // Perform actual action
            if (nextState.holding == null) {
                // Drop object
                instructions.push("Dropping the " + Physics.getMinimalDescription(fullObj.definition, objects), "d");
            }
            else {
                // Take object
                instructions.push("Picking up the " + Physics.getMinimalDescription(fullObj.definition, objects), "p");
            }

            lastState = nextState;
            armPosition = fullObj.stackId;
        }

        console.log("Generated instructions are:", instructions.join(", "));
        console.log("Length of instructions is:", instructions.filter((c) => (c.length == 1)).length);
        return instructions;
    }
}
