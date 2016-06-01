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

        // Split utterance if user want to specify which interpretation to use
        var splitResult = /(?:\((\d+)\) )?(.+)/g.exec(utterance);
        console.log(splitResult);
        var chosenInterpretation: number = NaN;
        if (splitResult != null) {
            chosenInterpretation = parseInt(splitResult[1]);
            utterance = splitResult[2];
            console.log(chosenInterpretation);
            console.log(utterance);
        }

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

            if (interpretations.length > 1) {
                console.log("inside multiple interpretations",interpretations.length);

                // Remove other interpretations if user chose one
                if (!isNaN(chosenInterpretation)) {
                    if (interpretations.length <= chosenInterpretation) {
                        world.printError("The command entered has only " + parses.length + " possible interpretations");
                        return;
                    }
                    console.log("Dropping other interpretations except", chosenInterpretation, "on user's wish");
                    interpretations = [interpretations[chosenInterpretation]];
                }
                // Otherwise ask
                else {
                    generateUserQuestion(interpretations, world);
                }
            }
        }
        catch(err) {
            //console.log("catching?");
            var stringErr : string = err.message;
            if (stringErr.indexOf("[ambiguity]") != -1){
                world.printError("An ambiguity exists, did you mean:");
                stringErr.replace("[ambiguity]", "").split("|").map(
                    (message:string) => {
                        world.printError("- "+message+"?");
                    });
            }
            else if (stringErr.indexOf("[parsing]") != -1) {
                world.printError("The utterance can be understood in different ways, do you want:");
                stringErr.replace("[parsing]", "").split("|").map(
                    (message: string, idx: number) => {
                        world.printError("(" + idx + ") - "+ message + "?");
                    });
                world.printError("Add the (X) in front of the command to choose");
            }
            else {
                world.printError("Interpretation error", err.message);
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
        var userQuestion : string = "[parsing]";

        var firstRun : boolean = true;
        for(var interpretation of interpretations){
            if (!firstRun){
                userQuestion += "|";
            }
            userQuestion += generateInterpretationString(interpretation);
            firstRun = false;
        }
        throw new Error(userQuestion);
    }

    /*
    The following functions are basically stringifiers for the objects that the parser returns. Their call structure resembles the structure of the parse objects.
    */
    function generateInterpretationString(interpretation : Interpreter.InterpretationResult) : string {
        var res : string = "";
        console.log("generatingInterpretationString", interpretation);

        // do object
        if (interpretation.parse.entity !== undefined) {
            res += generateEntityString(interpretation.parse.entity);
        }

        switch (interpretation.parse.command) {
            case "move":
                res += " to be moved ";
                break;
            case "put":
                res += " to be put ";
                break;
            case "take":
                res += " to be taken ";
                break;
        }

        // do location
        res += generateLocationString(interpretation.parse.location);

        return res;
    }

    function generateEntityString(entity : Parser.Entity) : string {
        var res : string = "";
        console.log("generateEntityString", entity);
        res += entity.quantifier;
        res += " ";
        if (entity.object !== undefined) {
            res += generateObjectString(entity.object, entity.quantifier == "all");
        }
        return res;
    }

    function generateObjectString(obj : Parser.Object, allQuantifier: boolean) : string {
        var res : string = "";
        console.log("generateObjectString", obj);
        if (!obj.location) {
            if (obj.size) {
                res += obj.size;
                res += " ";
            }
            if (obj.color) {
                res += obj.color;
                res += " ";
            }
            if (obj.form) {
                if (obj.form === "anyform") {
                    res += "object" + (allQuantifier ? "s" : "");
                } else {
                res += obj.form;
            }
            }
        } else {
            if (obj.object) {
                res += generateObjectString(obj.object, allQuantifier);
                res += " that " + (allQuantifier ? "are " : "is ");
                res += generateLocationString(obj.location);
            }
        }
        return res;
    }

    function generateLocationString(location : Parser.Location) : string {
        var res : string = "";
        console.log("generateLocationString", location);

        if (location.relation === "ontop") {
            res += "on top";
        } else {
            res += location.relation;
        }
        res += " ";
        res += generateEntityString(location.entity);

        if (location.relation === "between") {
            res += "and";
            res += generateEntityString(location.entity2);
        }
        return res;
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
