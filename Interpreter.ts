///<reference path="World.ts"/>
///<reference path="Parser.ts"/>
///<reference path="Physics.ts"/>

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
   * Helper to make life easier with type checker.
   */
  interface ObjectDict {
    [s: string]: Physics.FoundObject;
  }

  /**
  * Nested class to retrieve all the objects describing an object and its location
  */
  class Candidates {
    main: string[];
    relation : string;
    nested: Candidates;

    constructor(main: string[], relation : string, nested: Candidates){
      this.main = main;
      this.relation = relation;
      this.nested = nested;
    }
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
    // TODO: Handle ambiguity depending on quantifier for target and goal (ask user for clarification)
    // TODO: Extension for 'all' quantifier (small)
    // check inside the nested for loop if the quantifier is all
    // if so, we will have to return a conjunction of goals instead of a disjunction

    var interpretation: DNFFormula = [];
    console.log("Command is", cmd);

    // Filter out objects which don't exist in world state
    var existingObjects: ObjectDict = filterExistingObjects(state);
    console.log("Available objects are", Object.keys(existingObjects));
    // Get candidates for object to move
    var mainCandidates: Candidates = filterCandidate(cmd.entity, existingObjects);

    console.log("Main", mainCandidates);
    // Get candidates for optional location (for move and put)
    var goalLocationCandidates: Candidates = undefined;
    if (cmd.location !== undefined) {
      goalLocationCandidates = filterCandidate(cmd.location.entity, existingObjects);
    }
    console.log("Goal", goalLocationCandidates);

    switch (cmd.command) {
      case "move":
        // Add every feasible combination of target and goal as interpretation
        for (var target of mainCandidates.main) {
          for (var goal of goalLocationCandidates.main) {
            if (isValidGoalLocation(existingObjects[target], cmd.location.relation, existingObjects[goal])){

              interpretation.push([{polarity: true, relation: cmd.location.relation, args: [target,goal]}]);
            }
          }
        }
        break;
      case "take":
        for (var target of mainCandidates.main) {
          if (target != "floor") {
            interpretation.push([{polarity: true, relation: "holding", args: [target]}]);
          }
        }
        break;
      case "put":
        // Sanity check whether we are actually holding something
        if(state.holding == null) {
          break;
        }

        // Add all feasible goals as interpretation
        var target = state.holding;
        for (var goal of goalLocationCandidates.main) {
          if (isValidGoalLocation(existingObjects[target], cmd.location.relation, existingObjects[goal])) {
            interpretation.push([{ polarity: true, relation: cmd.location.relation, args: [target, goal] }]);
          }
        }
        break;
    }

    console.log("Interpretation", interpretation[0][0].args);
    console.log("Interpretation", interpretation);
    return interpretation.length == 0 ? null : interpretation;
  }

  /**
   * Check whether given relation is in general feasible considering physical laws.
   */
  function isValidGoalLocation(c1: Physics.FoundObject, relation: string, c2: Physics.FoundObject):  boolean{
    if (c1==c2) {
      return false;
    }

    switch(relation){
      case "leftof":
        return true;
      case "rightof":
        return true;
      case "inside":
        if(c2.definition.size == "small" && c1.definition.size == "large") {
          return false;
        }
        return c2.definition.form == "box";
      case "ontop":
        return Physics.isStackingAllowedByPhysics(c1.definition, c2.definition);
      case "under":
        return true;
      case "beside":
        return true;
      case "above":
        return true;
    }

    console.warn("Unknown relation received:", relation);
    return false;
  }

  /**
  * Filters out all objects which don't exist in world state.
  * The WorldState.objects property maps all possible identifier to objects,
  * even those who are not in the given world.
  */
  function filterExistingObjects(state: WorldState) : ObjectDict {
    var existingObjects: ObjectDict = {};
    for (var name of Object.keys(state.objects)) {
      var definition: ObjectDefinition = state.objects[name];
      // Check whether object is held
      if(state.holding == name) {
        existingObjects[name] = new Physics.FoundObject(definition, true,  -1, -1,false);
        continue;
      }

      // Check whether object exists on stacks
      for (var i = 0; i < state.stacks.length; i++) {
        var stack = state.stacks[i];
        var loc = stack.indexOf(name)
        if (loc > -1) {
          existingObjects[name] = new Physics.FoundObject(definition, false,  i, loc,false);
          continue;
        }
      }
    }

    // Floor always exists
    existingObjects["floor"] = new Physics.FoundObject({form:"floor", size:null, color: null}, false, -1, -1, true);

    return existingObjects;
  }

  /**
  * Find all candidates for given entity.
  */
  function filterCandidate(entity: Parser.Entity, objects: ObjectDict): Candidates {
    var objCandidates: string[] = [];
    var rootObject: Parser.Object = entity.object;
    var relation : string = undefined;
    var nestedCandidates : Candidates = undefined;

    // Unpack object if we have a location relationship here
    if (rootObject.object != undefined) {
      relation = rootObject.location.relation;
      var nestedCandidates = filterCandidate(rootObject.location.entity,objects);
      rootObject = rootObject.object;
    }

    // Check now with all available properties
    for (var name of Object.keys(objects)) {
      var object = objects[name];
      var def = object.definition;
      if (hasSameAttributes(rootObject, def)) {
        if(nestedCandidates == undefined) {
          objCandidates.push(name);
        }
        // Check whether one relation satisfying candidate exist
        else {
          for (var nested of nestedCandidates.main) {
            if (Physics.hasValidLocation(objects[name],relation,objects[nested])) {
              objCandidates.push(name);
              break;
            }
          }
        }
      }
    }

    return new Candidates(objCandidates, relation, nestedCandidates);
  }

  /**
   * Check if two objects have the same attributes.
   */
  function hasSameAttributes (currObject: Parser.Object, other: ObjectDefinition): boolean {
    return (currObject.form == "anyform" || currObject.form == other.form) &&
      (currObject.size == null || currObject.size == other.size) &&
      (currObject.color == null || currObject.color == other.color);
  }

}
