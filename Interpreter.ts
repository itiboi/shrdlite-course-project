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
        // in the realworld representation stackId==0
        // means that you are on the left
        stackId: number;
        // -1 if held==true
        // in the realworld representation stackId==0
        // means that you are on the floor
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

    /**
     * Nested class to retrieve all the objects describing an object and its location
     * TODO: save the relationship between the nested object. (i.e inside, ontop ...)
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
        // TODO: Extension for 'all' quantifier (small)
        var interpretation : DNFFormula;
        // Filter out objects which don't exist in world state
        var existingObjects: ObjectDict = filterExistingObjects(state);
        console.log(existingObjects,"existingObjects");
        var mainCandidates: Candidates = filterCandidate(cmd.entity,existingObjects);

        switch (cmd.command) {
          case "move":
            if (cmd.location !== undefined) {
                var goalLocationCandidates: Candidates = filterCandidate(cmd.location.entity,existingObjects);
                interpretation = [[
                    {polarity: true, relation: cmd.location.relation, args: [mainCandidates.main[0],goalLocationCandidates[0]]}
                ]];
            }
          case "take":
            // handle ambiguity
            interpretation = [[
                {polarity: true, relation: "holding", args: [mainCandidates.main[0]]}
            ]];
        }
        // Search for main Candidates
        // performArcConsistency
        // var res = performArcConsistency(mainCandidates,existingObjects);
        // console.log(res,"res");
        // Search for location Candidates




        //  TODO: Find candidates for every entity mentioned in command

        // TODO: Build up a relation structure for all objects

        // TODO: Perform arc consistency

        // This returns a dummy interpretation involving two random objects in the world
        // var objects : string[] = Array.prototype.concat.apply([], state.stacks);
        // var a : string = objects[Math.floor(Math.random() * objects.length)];
        // var b : string = objects[Math.floor(Math.random() * objects.length)];
        // var interpretation : DNFFormula = [[
        //     {polarity: true, relation: "ontop", args: [a, "floor"]},
        //     {polarity: true, relation: "holding", args: [b]}
        // ]];
        return interpretation;
    }
    // /**
    //  * Search for candidates object
    //  */
    // function searchForCandidates(rootEntity : Parser.Entity, existingObjects: ObjectDict) : Candidates {
    //   var rootCandidates: Candidates = filterCandidate(rootEntity, existingObjects);
    //   console.log("rootCandidates", rootCandidates);
    //   var mainCandidates: string[] = rootCandidates.main;
    //   // You can retrieve all the nested object describing the location from nestedCandidates
    //   var nestedCandidates: Candidates = rootCandidates.nested;
    //   if (nestedCandidates !== undefined){
    //     console.log("Found nested candidates: " + nestedCandidates.main);
    //   }
    //   console.log("Found candidates: " + mainCandidates.length);
    //   for(var obj of mainCandidates) {
    //       console.log(obj);
    //   }
    //   return rootCandidates;
    // }

    /**
     * Search for candidates object
     */
    // function performArcConsistency(candidates : Candidates, existingObjects: ObjectDict) : Candidates {
    //   var legalCandidates : Candidates;
    //   if(candidates.nested != undefined){
    //      = performArcConsistency(candidates.nested,existingObjects);
    //   }
    //
    //   // for (var candidate of candidates.main){
    //   //   var foundObject : FoundObject = existingObjects[candidate];
    //   //   if (candidates.nested !== undefined){
    //   //     for (var nested of candidates.nested.main){
    //   //       var nestedObject : FoundObject = existingObjects[nested];
    //   //       if {
    //   //               // this is the right candidate pair.
    //   //               console.log("find the right candidate pair")
    //   //               return {main : candidate, nested : nested}
    //   //
    //   //           }
    //   //       }
    //   //     }
    //   //   }
    //   // }
    //   return undefined
    // }

    /**
     * Check if two objects are correclty related and check physics laws
     */
    function hasValidLocation(c1 : FoundObject, relation : string, c2: FoundObject):boolean{
       switch(relation){
         case "leftof" :
            return c1.stackId == c2.stackId - 1;
         case "rightof" :
            return c1.stackId -1 == c2.stackId;
         case "inside":
             //  Objects are “inside” boxes, but “ontop” of other objects.
             // Maybe handle box in an error ???
            return c1.stackId == c2.stackId && c1.stackLocation - 1 == c2.stackLocation && c2.definition.form == "box";
         case "ontop" :
            return c1.stackId == c2.stackId && c1.stackLocation - 1 == c2.stackLocation && supportingPhysicLaw(c1,c2);
         case "under":
            // TODO : not sure if we should take care of the physics laws here i.e supportingPhysicLaw(c2,c1)
            return c1.stackId == c2.stackId && c1.stackLocation  < c2.stackLocation ;
         case "beside":
            return hasValidLocation(c1,"leftof",c2) || hasValidLocation(c1,"rightof",c2);
         case "above" :
            return c1.stackId == c2.stackId && c1.stackLocation  > c2.stackLocation ;

       }
       return true;
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
    function filterCandidate(entity: Parser.Entity, objects: ObjectDict): Candidates {
        var objCandidates: string[] = [];
        var rootObject: Parser.Object = entity.object;
        var relation : string = undefined;
        var nestedCandidates : Candidates = undefined;
        if (rootObject.object != undefined) {
            relation = rootObject.location.relation;
            var nestedCandidates = filterCandidate(rootObject.location.entity,objects);
            // Checking all nested candidates relationship
            console.log("nested candidates",nestedCandidates);
            rootObject = rootObject.object;

        }
        if(nestedCandidates != undefined) {
          for (var name of Object.keys(objects)) {
              // Check all now available properties
              var object = objects[name];
              var def = object.definition;
              if (hasSameAttributes(rootObject,def)) {
                  for (var nested of nestedCandidates.main){
                    if(hasValidLocation(objects[name],relation,objects[nested])){
                      objCandidates.push(name);
                    }
                  }
              }
          }
        }else{
          for (var name of Object.keys(objects)) {
              // Check all now available properties
              var object = objects[name];
              var def = object.definition;
              if (hasSameAttributes(rootObject,def)) {
                      objCandidates.push(name);
              }
          }
        }



        console.log("Main:", objCandidates);

        return new Candidates(objCandidates, relation, nestedCandidates);
    }
    /**
     * Check if two objects havce the same attributes.
     */
    function hasSameAttributes (currObject : Parser.Object, other : ObjectDefinition):boolean{
      return (currObject.form == "anyform" || currObject.form == other.form)&&
         (currObject.size == null || currObject.size == other.size) &&
         (currObject.color == null || currObject.color == other.color)
    }
    /**
     * Handle physics laws
     */
    function supportingPhysicLaw(c1 : FoundObject, c2 : FoundObject) : boolean {
      if(c2.definition.form == "ball"){
        return false;
      }
      if(c2.definition.form == "pyramid" && c1.definition.form == "box"){
        return false;
      }
      if(c2.definition.size == "small" && c1.definition.size == "big"){
        return false;
      }
      if(c2.definition.form == "brick" && c1.definition.form == "box" && c1.definition.size == "small" && c1.definition.size == "small"){
        return false;
      }
      return true;
    }
}
