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

        // Use A*-planner to find world states to fulfill interpretation
        var result: SearchResult<WorldStateNode> = aStarSearch(
            // graph : Graph<Node>,
            new WorldStateGraph(state.objects),
            // start : Node,
            startNode,
            // goal : (n:Node) => boolean,
            (n) => isGoal(n, interpretation, state.objects),
            // TODO heuristics : (n:Node) => number,
            (n) => heuristic(startNode, startNode, state),
            // timeout : number
            10000 //FIXME
        )

        // Create instruction set from world states
        return createInstructions(state.arm, result, state.objects);
    }

    function heuristic(start: WorldStateNode, goal: WorldStateNode, sate: WorldState) : number {
        // TODO
        // loop over conjunctions, take minimum
        // loop over literals, take maximum
        // for each literal: 2 + aboveStart*2 + aboveFinal*2 (for in, ontop)
        return 0;
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
                if (literal.polarity != Physics.hasValidLocation(object1, literal.relation, object2)){
                  feasible = false;
                  break;
                }
            }

            if (feasible) {
                return true;
            }
        }
        return false;
    }

    function getObjectFromWorldState(
        state: WorldStateNode, obj: string, objects: { [s: string]: ObjectDefinition }): Physics.FoundObject {
        if(obj == "floor") {
            return new Physics.FoundObject(null, false, -1, -1, true);
        }
        else {
            var held = false;
            var definition = objects[obj];
            var stackId: number;
            var stackLoc: number;
            // Find location of object
            for (var i = 0; i < state.stacks.length; i++) {
                var stack = state.stacks[i];
                var loc = stack.indexOf(name);
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
        holding: string;
        stacks : Stack[];

        constructor(holding : string, stacks: Stack[]) {
            this.holding = holding;
            this.stacks = stacks;
        }

        toString(): string {
            // TODO
            return null;
        }
    }

    class WorldStateGraph implements Graph<WorldStateNode> {
        objects: { [s: string]: ObjectDefinition };

        constructor(objects: { [s: string]: ObjectDefinition }) {
            this.objects = objects;
        }

        /** Computes the edges that leave from a node. */
        outgoingEdges(node: WorldStateNode): Edge<WorldStateNode>[] {
            // TODO: Maybe consider arm position? (Adds unnecessary complexity)
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
            return null;
        }

        /** A function that compares nodes. */
        compareNodes(a: WorldStateNode, b: WorldStateNode): number {
            if(a.toString() == b.toString()) {
                return 0;
            }
            // TODO: Not needed, but maybe nicer?
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
                instructions.push("Moving right");
                for (var i = armPosition; i < fullObj.stackId; i++) {
                    instructions.push("r");
                }
            }
            else if (armPosition < fullObj.stackId) {
                instructions.push("Moving left");
                for (var i = armPosition; i < fullObj.stackId; i++) {
                    instructions.push("l");
                }
            }

            // Perform actual action
            if (nextState.holding == null) {
                // Drop object
                instructions.push("Dropping the " + fullObj.definition.form, "d");
            }
            else {
                // Take object
                instructions.push("Picking up the " + fullObj.definition.form, "p");
            }
            lastState = nextState;
        }

        return instructions;
    }


}
