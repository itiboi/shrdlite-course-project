///<reference path="World.ts"/>
///<reference path="Parser.ts"/>
///<reference path="Physics.ts"/>
///<reference path="lib/collections.ts"/>

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
        return stringifyInterpretation(result.interpretation);
    }

    export function stringifyInterpretation(interpretation : DNFFormula) : string {
        return interpretation.map((literals) => {
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
        nested2: Candidates;

        constructor(main: string[], relation : string, nested: Candidates, nested2: Candidates){
            this.main = main;
            this.relation = relation;
            this.nested = nested;
            this.nested2 = nested2;
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
     * @throws An error when no valid interpretations can be found
     */
    function interpretCommand(cmd : Parser.Command, state : WorldState) : DNFFormula {
        var interpretation: DNFFormula = [];
        console.log("Command is", cmd);

        // Filter out objects which don't exist in world state
        var existingObjects: ObjectDict = filterExistingObjects(state);
        console.log("Available objects are", Object.keys(existingObjects));
        // Get candidates for object to move
        var mainCandidates: Candidates = undefined;
        if (cmd.command != "put") {
            mainCandidates = filterCandidate(cmd.entity, existingObjects);
        }
        else {
            // Create "candidate" from held object
            // Sanity check whether we are actually holding something
            var candidateList = (state.holding == null) ? [] : [state.holding];
            mainCandidates = new Candidates(candidateList, undefined, undefined, undefined);
        }

        console.log("Main objects", mainCandidates);

        // Get candidates for optional location (for move and put)
        var goalLocationCandidates: Candidates = undefined;
        var betweenSecondLocationCandidates : Candidates = undefined;
        if (cmd.location !== undefined) {
            goalLocationCandidates = filterCandidate(cmd.location.entity, existingObjects);
            if(cmd.location.relation === "between"){
                betweenSecondLocationCandidates = filterCandidate(cmd.location.entity2,existingObjects);
            }
        }
        console.log("Goal objects", goalLocationCandidates);
        console.log("Second goal objects", betweenSecondLocationCandidates);

        // Generate interpretation depending on all quantifier occurres.
        var generateAll = false;
        if((cmd.entity == undefined || cmd.entity.quantifier != "all") &&
           (cmd.location == undefined || cmd.location.entity.quantifier != "all") &&
           (cmd.location == undefined || cmd.location.entity2 == undefined || cmd.location.entity2.quantifier != "all")) {
            console.log("No all quantifier found");
            interpretation = generateAnyDNF(
                cmd, mainCandidates, goalLocationCandidates, betweenSecondLocationCandidates, existingObjects, state);
        }
        else {
            console.log("Taking care of the all quantifier");
            interpretation = generateAllDNF(
                cmd, mainCandidates, goalLocationCandidates, betweenSecondLocationCandidates, existingObjects, state);
            // TODO: Filter out infeasible combinations.
        }

        if (interpretation.length == 0) {
            console.log("Could not find valid interpretation in world");
            throw new Error("Sentence has no valid interpretation in world");
        }

        if (cmd.entity !== undefined && cmd.entity.quantifier === "the") {
            if (cmd.location !== undefined && cmd.location.relation === "between" && interpretation.length > 2) {
                throwClarificationError(interpretation, 0, existingObjects);
            } else if (interpretation.length > 1) {
                throwClarificationError(interpretation, 0, existingObjects);
            }
        }

        if (cmd.location !== undefined && cmd.location.entity.quantifier === "the") {
            if (cmd.location.relation === "between" && interpretation.length > 2) {
                throwClarificationError(interpretation, 0, existingObjects);
            } else if (interpretation.length > 1) {
                throwClarificationError(interpretation, 0, existingObjects);
            }
        }

        if (cmd.location !== undefined && cmd.location.relation === "between" && cmd.location.entity2.quantifier === "the") {
            if (interpretation.length > 2) {
                throwClarificationError(interpretation, 0, existingObjects);
            }
        }

        // if ((cmd.location!== undefined && cmd.location.entity.quantifier == "the") && interpretation.length > 1) {
        //     console.log(goalLocationCandidates);
        //     askForClarification(interpretation, 1, existingObjects);
        // }

        return interpretation;
    }

    //---------------------------------------------------------------------//
    // Functions for matching objects of parsing to objects of world state //
    //---------------------------------------------------------------------//

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
        var nestedCandidates2 : Candidates = undefined;

        // Unpack object if we have a location relationship here
        if (rootObject.object != undefined) {
            relation = rootObject.location.relation;
            nestedCandidates = filterCandidate(rootObject.location.entity,objects);
            if (relation === "between") {
                nestedCandidates2 = filterCandidate(rootObject.location.entity2, objects);
            }
            rootObject = rootObject.object;
        }

        // Check now with all available properties
        for (var name of Object.keys(objects)) {
            var object = objects[name];
            var def = object.definition;
            if (Physics.hasSameAttributes(rootObject, def)) {
                if(nestedCandidates == undefined) {
                    console.log("object in hasSameAttributes",name);
                    objCandidates.push(name);
                }
                // Check whether one relation satisfying candidate exist
                else {
                    if (relation === "between"){
                        for (var nested of nestedCandidates.main) {
                            for (var nested2 of nestedCandidates2.main){
                                if (Physics.hasValidLocation(objects[name], "between", objects[nested], objects[nested2])) {
                                    objCandidates.push(name);
                                    break;
                                }
                            }
                        }
                    } else {
                        for (var nested of nestedCandidates.main) {
                            if (Physics.hasValidLocation(objects[name], relation, objects[nested], undefined)) {
                                objCandidates.push(name);
                                break;
                            }
                        }
                    }
                }
            }
        }

        return new Candidates(objCandidates, relation, nestedCandidates, nestedCandidates2);
    }


    //-------------------------------------------------------//
    //  Functions for generating the DNF interpretations     //
    //-------------------------------------------------------//

    /**
    * Generate DNF in the general case
    */
    function generateAnyDNF (
        cmd : Parser.Command, mainCandidates:Candidates, goalLocationCandidates:Candidates,
        betweenSecondLocationCandidates:Candidates, existingObjects:ObjectDict, state:WorldState): DNFFormula {

        var interpretation:DNFFormula = [];
        switch (cmd.command) {
            case "put":
            case "move":
                // Add every feasible combination of target and goal as interpretation
                for (var target of mainCandidates.main) {
                    for (var goal of goalLocationCandidates.main) {
                        if(cmd.location.relation === "between"){
                            for(var otherGoal of betweenSecondLocationCandidates.main){
                                interpretation.push([createLiteral("between", [target, goal, otherGoal])]);
                            }
                        }
                        else {
                            var targetObj = existingObjects[target];
                            var goalObj = existingObjects[goal];
                            if (Physics.isValidGoalLocation(targetObj, cmd.location.relation, goalObj, undefined)){
                                interpretation.push([createLiteral(cmd.location.relation, [target,goal])]);
                            }
                        }
                    }
                }

                break;
            case "take":
                for (var target of mainCandidates.main) {
                    if (target != "floor") {
                        interpretation.push([createLiteral("holding", [target])]);
                    }
                }
                break;
        }

        return interpretation;
    }

    /**
    * Generate DNF for the all quantifier
    */
    function generateAllDNF(
        cmd : Parser.Command, mainCandidates:Candidates, goalLocationCandidates:Candidates,
        betweenSecondLocationCandidates:Candidates, existingObjects:ObjectDict, state:WorldState) : DNFFormula {

        var interpretation: DNFFormula = [];
        switch (cmd.command) {
            case "move":
            case "put":
                // Determine where all occurs everywhere
                var hasMainAll = (cmd.entity != undefined && cmd.entity.quantifier == "all");
                var hasGoalAll = (cmd.location.entity.quantifier == "all");
                var hasBetweenGoalAll = (cmd.location.entity2 != undefined && cmd.location.entity2.quantifier == "all");
                var relation = cmd.location.relation;

                console.log("hasMainAll", hasMainAll);
                console.log("hasGoalAll", hasGoalAll);
                console.log("hasBetweenGoalAll", hasBetweenGoalAll);

                switch (relation) {
                    case "leftof":
                    case "rightof":
                    case "beside":
                    case "above":
                    case "under":
                    case "inside":
                    case "ontop":
                        if(hasMainAll && hasGoalAll) {
                            // All combinations have to the satisfied
                            var allConj: Conjunction = [];
                            for(var target of mainCandidates.main) {
                                for(var goal of goalLocationCandidates.main) {
                                    var targetObj = existingObjects[target];
                                    var goalObj = existingObjects[goal];
                                    // Since we are creating on large conjunction one infeasible destroys everything
                                    if (!Physics.isValidGoalLocation(targetObj, relation, goalObj, undefined)) {
                                        return [];
                                    }
                                    allConj.push(createLiteral(relation, [target, goal]));
                                }
                            }

                            interpretation.push(allConj);
                        }
                        else if(hasMainAll) {
                            // All assignments of main objects to one goal
                            interpretation = createOneSidedAllDNF(
                                mainCandidates.main, goalLocationCandidates.main, existingObjects, relation, false);
                        }
                        else {
                            // All assignments of goals objects to one main
                            interpretation = createOneSidedAllDNF(
                                goalLocationCandidates.main, mainCandidates.main, existingObjects, relation, true);
                        }

                        break;
                    case "between":
                        // Ugly checking for each combination but is the easiest way
                        if(hasMainAll && hasGoalAll && hasBetweenGoalAll) {
                            // All combinations at a time have to the satisfied
                        }
                        // Two have the all quantifier
                        else if (!hasMainAll && hasGoalAll && hasBetweenGoalAll) {

                        }
                        else if (hasMainAll && !hasGoalAll && hasBetweenGoalAll) {
                            
                        }
                        else if (hasMainAll && hasGoalAll && !hasBetweenGoalAll) {
                            
                        }
                        // Only one is missing the all quantifier
                        else if (hasMainAll && !hasGoalAll && !hasBetweenGoalAll) {
                            
                        }
                        else if (!hasMainAll && hasGoalAll && !hasBetweenGoalAll) {
                            
                        }
                        else if (!hasMainAll && !hasGoalAll && hasBetweenGoalAll) {
                            
                        }

                        break;
                }

                break;
            case "take":
                // Simple: we can only take one object
                if(mainCandidates.main.length > 1) {
                    throw new Error("Only one object can be held at a time!");
                }

                // Prevent floor from being picked
                if(mainCandidates.main[0] != "floor") {
                    interpretation.push([createLiteral("holding", mainCandidates.main)]);
                }

                break;
        }

        return interpretation;
    }

    /**
    * Generate DNF for the occurrence of the all quantifier on one side of the relation.
    */
    function createOneSidedAllDNF(
        candidates_1 : string[],
        candidates_2 : string[],
        existingObjects : ObjectDict,
        relation : string,
        invertedRelation : boolean) : DNFFormula {

        var interpretation: DNFFormula = [];
        var assignments = getCombinations(candidates_1.length, candidates_2.length-1);
        assignments.forEach((assignment) => {
            console.log(assignment);
            var allConj: Conjunction =[];
            for(var idx = 0; idx < assignment.length ; idx++){
                var targetC = !invertedRelation ? candidates_1[idx] : candidates_2[assignment[idx]];
                var goalC =   !invertedRelation ? candidates_2[assignment[idx]] : candidates_1[idx];
                var targetCObj = existingObjects[targetC];
                var goalCObj = existingObjects[goalC];
                if (Physics.isValidGoalLocation(targetCObj, relation, goalCObj, undefined)) {
                    allConj.push(createLiteral(relation, [targetC, goalC]));
                }
                else {
                    // Abort if one literal is invalid
                    allConj = [];
                    break;
                }

            }

            // Only add possible assignments
            if(allConj.length != 0){
                console.log("Conjunction",allConj);
                interpretation.push(allConj);
            }
        });

        return interpretation;
    }

    /**
     * Shortcut method for creating a literal.
     */
    function createLiteral(relation: string, args: string[]): Literal {
        return { polarity: true, relation: relation, args: args };
    }

    /**
     * Retrieve all possible arrays with given length containing only numbers from 0 to highest.
     */
    function getCombinations(length : number, highest : number) : collections.Set<number[]> {
        var res = new collections.Set<number[]>();
        addCombinations([], length, highest, res);
        return res;
    }

    /**
     * Internal recursive helper method for retrieving all possible combinations.
     */
    function addCombinations(a : number[], length : number, highest : number, set : collections.Set<number[]>) : void {
        if (a.length == length){
            set.add(a);
        }
        else {
            for (var i = 0; i <= highest; i++) {
                var b : number[] = a.slice();
                b.push(i);
                addCombinations(b, length, highest, set);
            }
        }
    }

    //-------------------------------------------------------//
    // Functions for ambiguity                               //
    //-------------------------------------------------------//


    /**
     * Build the clarification question for object ambiguity and throws it.
     */
    function throwClarificationError(interpretation: DNFFormula, column: number, existingObjects: ObjectDict){
        var candidateSet = new collections.Set<string>();
        var descriptionLookUp = new collections.Dictionary<string, string>();

        for (var conj of interpretation) {
            var firstLiteral : Literal;
            var candidateID : string;
            firstLiteral = conj[0];
            candidateID = firstLiteral.args[column];
            if (!candidateSet.contains(candidateID)) {
                var descrString : string = "the ";
                descrString += existingObjects[candidateID].definition.size + " ";
                descrString += existingObjects[candidateID].definition.color + " ";
                descrString += existingObjects[candidateID].definition.form;
                if (descriptionLookUp.containsKey(descrString)) {
                    throw new Error("The description " + descrString + " is ambiguous. Please specify.");
                }
                descriptionLookUp.setValue(descrString, candidateID);
                candidateSet.add(candidateID);
            }
        }

        if (candidateSet.size() < 2) {
            return;
        }

        var userQuestion: string = "[ambiguity]";
        var firstTime : boolean = true;
        for (var desc of descriptionLookUp.keys()){
            if (!firstTime) {
                userQuestion += "|"
            }
            userQuestion += desc;
            firstTime = false;
        }

        throw new Error(userQuestion);
    }
}
