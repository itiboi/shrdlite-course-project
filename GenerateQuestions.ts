module GenerateQuestions {

      //-------------------------------------------------------//
      // Module to hold functions for ambiguity                               //
      //-------------------------------------------------------//


/**
Wrapper function to generate user questions for the THE quantifier when not using the BETWEEN keyword.
* @param interpretation DNF formula representing the interpretation.
* @param column (0 or 1) where in the utterance THE occured.
* @param existingObjects A dict of objects that exist in the world.
*/
export function throwClarificationError(interpretation : Interpreter.DNFFormula, column : number, existingObjects : Interpreter.ObjectDict) : void {
    throwGeneralClarificationError(interpretation, column, existingObjects, 0, 1);
}

/**
 *Wrapper function to generate user questions for the THE quantifier when using the BETWEEN keyword.
 * @param interpretation DNF formula representing the interpretation.
 * @param column (0 or 1) where in the utterance THE occured.
 * @param existingObjects A dict of objects that exist in the world.
 */
 export function throwBetweenClarificationError(interpretation : Interpreter.DNFFormula, column : number, existingObjects : Interpreter.ObjectDict) : void {
    throwGeneralClarificationError(interpretation, column, existingObjects, 1, 1);
    throwGeneralClarificationError(interpretation, column, existingObjects, 2, 1);
}

/**
Generates a user question in case there is ambiguity originating in the usage of the THE quantifier. Whether that is actually the case is checked.
* @param interpretation DNF formula representing the interpretation.
* @param column (0 or 1) where in the utterance THE occured.
* @param existingObjects A dict of objects that exist in the world.
* @param startingPosition The conjunction to start the check with.
* @param stepSize How many conjunctions to step ahead in each step check.
*/
export function throwGeneralClarificationError (
    interpretation : Interpreter.DNFFormula, column : number, existingObjects : Interpreter.ObjectDict, startingPosition : number, stepSize : number):void {
    var candidateSet = new collections.Set<string>();
    var descriptionLookUp = new collections.Dictionary<string, string>();

    console.log("started disambiguation.");
    console.log(interpretation);

    for (var i = startingPosition; i < interpretation.length; i+=stepSize) {
        var firstLiteral : Interpreter.Literal;
        var candidateID : string;
        firstLiteral = interpretation[i][0];
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

    console.log(candidateSet);

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
