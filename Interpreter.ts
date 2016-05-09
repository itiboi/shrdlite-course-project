///<reference path="World.ts"/>
///<reference path="Parser.ts"/>

/**
* Interpreter module
*
* The goal of the Interpreter module is to interpret a sentence
* written by the user in the context of the current world state. In
* particular, it must figure out which objects in the world,
* i.e. which elements in the `objects` field of WorldState, correspond
* to the ones referred to in the sentence.
*
* Moreover, it has to derive what the intended goal state is and
* return it as a logical formula described in terms of literals, where
* each literal represents a relation among objects that should
* hold. For example, assuming a world state where "a" is a ball and
* "b" is a table, the command "put the ball on the table" can be
* interpreted as the literal ontop(a,b). More complex goals can be
* written using conjunctions and disjunctions of these literals.
*
* In general, the module can take a list of possible parses and return
* a list of possible interpretations, but the code to handle this has
* already been written for you. The only part you need to implement is
* the core interpretation function, namely `interpretCommand`, which produces a
* single interpretation for a single command.
*/
module Interpreter {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

/**
Top-level function for the Interpreter. It calls `interpretCommand` for each possible parse of the command. No need to change this one.
* @param parses List of parses produced by the Parser.
* @param currentState The current state of the world.
* @returns Augments ParseResult with a list of interpretations. Each interpretation is represented by a list of Literals.
*/
    export function interpret(parses : Parser.ParseResult[], currentState : WorldState) : InterpretationResult[] {
        var errors : Error[] = [];
        var interpretations : InterpretationResult[] = [];
        parses.forEach((parseresult) => {
            try {
                var result : InterpretationResult = <InterpretationResult>parseresult;
                result.interpretation = interpretCommand(result.parse, currentState);
                interpretations.push(result);
            } catch(err) {
                errors.push(err);
            }
        });
        if (interpretations.length) {
            return interpretations;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface InterpretationResult extends Parser.ParseResult {
        interpretation : DNFFormula;
    }

    export type DNFFormula = Conjunction[];
    type Conjunction = Literal[];

    /**
    * A Literal represents a relation that is intended to
    * hold among some objects.
    */
    export interface Literal {
	/** Whether this literal asserts the relation should hold
	 * (true polarity) or not (false polarity). For example, we
	 * can specify that "a" should *not* be on top of "b" by the
	 * literal {polarity: false, relation: "ontop", args:
	 * ["a","b"]}.
	 */
        polarity : boolean;
	/** The name of the relation in question. */
        relation : string;
	/** The arguments to the relation. Usually these will be either objects
     * or special strings such as "floor" or "floor-N" (where N is a column) */
        args : string[];
    }

    export function stringify(result : InterpretationResult) : string {
        return result.interpretation.map((literals) => {
            return literals.map((lit) => stringifyLiteral(lit)).join(" & ");
            // return literals.map(stringifyLiteral).join(" & ");
        }).join(" | ");
    }

    export function stringifyLiteral(lit : Literal) : string {
        return (lit.polarity ? "" : "-") + lit.relation + "(" + lit.args.join(",") + ")";
    }

    /**
     * Internal representation for available objects in WorldState.
     */
    class FoundObject {
        held: boolean;
        // -1 if held==true
        stackId: number;
        // -1 if held==true
        stackLocation: number;
        definition: ObjectDefinition;

        constructor(definition: ObjectDefinition, held: boolean, stackId: number, stackLoc: number) {
            this.held = held;
            this.definition = definition;
            this.stackId = stackId;
            this.stackLocation = stackLoc;
        }
    }

    interface ObjectDict {
        [s: string]: FoundObject;
    }

    //////////////////////////////////////////////////////////////////////
    // private functions
    /**
     * The core interpretation function. The code here is just a
     * template; you should rewrite this function entirely. In this
     * template, the code produces a dummy interpretation which is not
     * connected to `cmd`, but your version of the function should
     * analyse cmd in order to figure out what interpretation to
     * return.
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form (disjunction of conjunctions). See the dummy interpetation returned in the code for an example, which means ontop(a,floor) AND holding(b).
     */
    function interpretCommand(cmd : Parser.Command, state : WorldState) : DNFFormula {
        // TODO: Extension for 'all' quantifier (small)

        // Filter out objects which don't exist in world state
        var existingObjects: ObjectDict = filterExistingObjects(state);

        // Search for main object
        var rootEntity: Parser.Entity = cmd.entity;
        var objCandidates: string[] = filterCandidate(rootEntity, existingObjects);

        console.log("Found candidates: " + objCandidates.length);
        for(var obj of objCandidates) {
            console.log(obj);
        }

        // TODO: Find candidates for every entity mentioned in command

        // TODO: Build up a relation structure for all objects

        // TODO: Perform arc consistency

        // This returns a dummy interpretation involving two random objects in the world
        var objects : string[] = Array.prototype.concat.apply([], state.stacks);
        var a : string = objects[Math.floor(Math.random() * objects.length)];
        var b : string = objects[Math.floor(Math.random() * objects.length)];
        var interpretation : DNFFormula = [[
            {polarity: true, relation: "ontop", args: [a, "floor"]},
            {polarity: true, relation: "holding", args: [b]}
        ]];
        return interpretation;
    }

    /**
     * Filters out all objects which don't exist in world state.
     * The property objects of WorldState interface map all the possible indentifier of objects.
     * Even the one that are not currenlty in the given world.
     */
    function filterExistingObjects(state: WorldState) : ObjectDict {
        var existingObjects: ObjectDict = {};
        for (var name of Object.keys(state.objects)) {

            var definition: ObjectDefinition = state.objects[name];
            // Check whether name exists on stacks or is held
            if(state.holding == name) {
                existingObjects[name] = new FoundObject(definition, true, -1, -1);
                continue;
            }

            for (var i = 0; i < state.stacks.length; i++) {
                var stack = state.stacks[i];
                var loc = stack.indexOf(name)
                if (stack.indexOf(name) > -1) {
                    existingObjects[name] = new FoundObject(definition, false, i, loc);
                    continue;
                }
            }
        }
        return existingObjects;
    }

    /**
     * Find all candidates for given entity.
     */
    function filterCandidate(entity: Parser.Entity, objects: ObjectDict): string[] {
        var objCandidates: string[] = [];
        var rootObject: Parser.Object = entity.object;
        if (rootObject.object != undefined) {
            rootObject = rootObject.object;
            console.log(rootObject, " is leaf.");
        }

        console.log("Searching: " + rootObject["size"] + ", " + rootObject["form"] + ", " + rootObject["color"]);
        for (var name in Object.keys(objects)) {

            // Check all now available properties
            var object = objects[name];
            var def = object.definition;
            console.log("Possible: " + name + ", " + def["size"] + ", " + def["form"] + ", " + def["color"]);
            if ((rootObject["form"] == "anyform" || rootObject["form"] == def["form"]) &&
                (rootObject["size"] == null || rootObject["size"] == def["size"]) &&
                (rootObject["color"] == null || rootObject["color"] == def["color"])) {
                objCandidates.push(name);
            }
        }

        return objCandidates;
    }

}
