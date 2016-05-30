///<reference path="World.ts"/>
///<reference path="Parser.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="Planner.ts"/>

module Shrdlite {

    export function interactive(world : World) : void {
        function endlessLoop(utterance : string = "") : void {
            var inputPrompt = "What can I do for you today? ";
            var nextInput = () => world.readUserInput(inputPrompt, endlessLoop);
            if (utterance.trim()) {
                var plan : string[] = splitStringIntoPlan(utterance);
                if (!plan) {
                    plan = parseUtteranceIntoPlan(world, utterance);
                }
                if (plan) {
                    world.printDebugInfo("Plan: " + plan.join(", "));
                    world.performPlan(plan, nextInput);
                    return;
                }
            }
            nextInput();
        }
        world.printWorld(endlessLoop);
    }


    /**
    * Generic function that takes an utterance and returns a plan. It works according to the following pipeline:
    * - first it parses the utterance (Parser.ts)
    * - then it interprets the parse(s) (Interpreter.ts)
    * - then it creates plan(s) for the interpretation(s) (Planner.ts)
    *
    * Each of the modules Parser.ts, Interpreter.ts and Planner.ts
    * defines its own version of interface Result, which in the case
    * of Interpreter.ts and Planner.ts extends the Result interface
    * from the previous module in the pipeline. In essence, starting
    * from ParseResult, each module that it passes through adds its
    * own result to this structure, since each Result is fed
    * (directly or indirectly) into the next module.
    *
    * There are two sources of ambiguity: a parse might have several
    * possible interpretations, and there might be more than one plan
    * for each interpretation. In the code there are placeholders
    * that you can fill in to decide what to do in each case.
    *
    * @param world The current world.
    * @param utterance The string that represents the command.
    * @returns A plan in the form of a stack of strings, where each element is either a robot action, like "p" (for pick up) or "r" (for going right), or a system utterance in English that describes what the robot is doing.
    */
    export function parseUtteranceIntoPlan(world : World, utterance : string) : string[] {
        // Parsing
        world.printDebugInfo('Parsing utterance: "' + utterance + '"');
        try {
            var parses : Parser.ParseResult[] = Parser.parse(utterance);
            world.printDebugInfo("Found " + parses.length + " parses");
            parses.forEach((result, n) => {
                world.printDebugInfo("  (" + n + ") " + Parser.stringify(result));
            });
        }
        catch(err) {
            world.printError("Parsing error", err);
            return;
        }

        // Interpretation
        try {
            var interpretations : Interpreter.InterpretationResult[] = Interpreter.interpret(parses, world.currentState);
            world.printDebugInfo("Found " + interpretations.length + " interpretations");
            interpretations.forEach((result, n) => {
                world.printDebugInfo("  (" + n + ") " + Interpreter.stringify(result));
            });
            //TODO FILTER OUT nulls;
            if (interpretations.length > 1) {
                console.log("inside multiple interpretations",interpretations.length);
                generateUserQuestion(interpretations,world);
                // several interpretations were found -- how should this be handled?
                // should we throw an ambiguity error?
                // ... throw new Error("Ambiguous utterance");
                // or should we let the planner decide?
            }
        }
        catch(err) {
            //console.log("catching?");
            var stringErr : string = err.message;
            var keyString :string = "[ambiguity]";
            var idxKey : number = stringErr.indexOf(keyString);
            if(idxKey != -1){
                world.printError("An ambiguity exists, did you mean :");
                stringErr.replace(keyString, "").split("|").map(
                    (message:string) => {
                        world.printError("- "+message+"?");
                    });
            }
            else{
                world.printError("Interpretation error", err);
            }
            return;
        }

        // Planning
        try {
            var plans : Planner.PlannerResult[] = Planner.plan(interpretations, world.currentState);
            world.printDebugInfo("Found " + plans.length + " plans");
            plans.forEach((result, n) => {
                world.printDebugInfo("  (" + n + ") " + Planner.stringify(result));
            });

            if (plans.length > 1) {
                // several plans were found -- how should this be handled?
                // this means that we have several interpretations,
                // should we throw an ambiguity error?
                // ... throw new Error("Ambiguous utterance");
                // or should we select the interpretation with the shortest plan?
                // ... plans.sort((a, b) => {return a.length - b.length});
            }
        }
        catch(err) {
            world.printError("Planning error", err);
            return;
        }

        var finalPlan : string[] = plans[0].plan;
        world.printDebugInfo("Final plan: " + finalPlan.join(", "));
        return finalPlan;
    }

    export function generateUserQuestion(interpretations:Interpreter.InterpretationResult[], world: World){
        var userQuestion : string = "Did you mean to " + interpretations[0].parse.command + " ";

        for(var interpretation of interpretations){
          var mainObjectDescription: string = generateOneString(interpretation.parse.entity);
          userQuestion += interpretation.parse.location.relation + " ";
          var goalObjectDescription : string = generateOneString(interpretation.parse.location.entity) + " ";
          userQuestion += goalObjectDescription;

        }
        // var stringBool : boolean = false;
        // var parsingCommand:Parser.Command = interpretation.parse;
        // var quantifierPointer  = parsingCommand.entity;
        //
        // var currObject = parsingCommand.entity.object.object;
        //   while(currObject!=undefined){
        //     console.log("currObject",currObject);
        //     console.log("parsingCommand",parsingCommand);
        //
        //     if( quantifierPointer.quantifier === "any")
        //     {userQuestion+= " a " }
        //   else{
        //     userQuestion+= quantifierPointer.quantifier + " ";
        //   }
        //     // TODO ADD A CHECK IF properties != undefined
        //     if(currObject.size != undefined){
        //       userQuestion+= currObject.size + " " ;
        //     }
        //     if(currObject.color!= undefined){
        //       userQuestion+= currObject.color + " " ;
        //     }
        //     if(currObject.form !=undefined){
        //       userQuestion+=currObject.form + " ";
        //     }
        //     if(stringBool){
        //       userQuestion += " that is "
        //
        //     }
        //     if(currObject.location!=undefined){
        //       userQuestion += currObject.location.relation + " ";
        //       quantifierPointer = currObject.location.entity;
        //       stringBool = true;
        //       currObject = currObject.location.entity.object;
        //     }else{
        //       break;
        //     }
        //
        //   }
        //
        //   /// LOCATION STUFF
        //   quantifierPointer = parsingCommand.location.entity;
        //   currObject = parsingCommand.location.entity.object;
        //   stringBool = true;
        //   while(currObject!=undefined){
        //     console.log("currObject",currObject);
        //     console.log("parsingCommand",parsingCommand);
        //
        //     if( quantifierPointer.quantifier === "any")
        //     {userQuestion+= " a " }
        //   else{
        //     userQuestion+= quantifierPointer.quantifier + " ";
        //   }
        //     // TODO ADD A CHECK IF properties != undefined
        //
        //
        //   }
        //   userQuestion += " or did you mean "
        //
        // userQuestion+= "?"
        throw new Error(userQuestion);
    }


    export function generateOneString(parsingCommand : Parser.Entity):string{
      var buildQuestion : string = " ";
      buildQuestion += parsingCommand.quantifier;
      var rootObject = parsingCommand.object;
      if(rootObject.object != undefined){
        console.log("I'm not undefined.");
        var relation = rootObject.location.relation;
        console.log(relation);
        buildQuestion+= generateOneString(parsingCommand.object.location.entity) +  " " + relation;
      }

      if(rootObject.size != undefined){
           buildQuestion+= rootObject.size + " " ;
         }
         if(rootObject.color!= undefined){
           buildQuestion+= rootObject.color + " " ;
         }
         if(rootObject.form !=undefined){
           buildQuestion+=rootObject.form + " ";
         }

      return buildQuestion;
    }

    export function describeObject(id : string, world : World) : string {
        var res : string = "the ";
        if (id === "floor") {
            res += "floor";
        } else {
            res += world.currentState.objects[id].size + " ";
            res += world.currentState.objects[id].color + " ";
            res += world.currentState.objects[id].form;
        }
        return res;
    }

    /** This is a convenience function that recognizes strings
    * of the form "p r r d l p r d"
    */
    export function splitStringIntoPlan(planstring : string) : string[] {
        var plan : string[] = planstring.trim().split(/\s+/);
        var actions : {[act:string] : string}
        = {p:"Picking", d:"Dropping", l:"Going left", r:"Going right"};
        for (var i = plan.length-1; i >= 0; i--) {
            if (!actions[plan[i]]) {
                return;
            }
            plan.splice(i, 0, actions[plan[i]]);
        }
        return plan;
    }

}
