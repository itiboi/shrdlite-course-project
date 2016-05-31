# README-SHRDLITE for _BetaGo_

## Basic implementation

### Semantics of the keywords

What follows is a description of how we understood some of the keywords to be implemented. These are the keywords that we thought of as slightly ambiguous:

    * To us, "leftof" and "rightof" do not imply that two objects are right beside each other, but only a is left of b if and only if a's stackId is smaller that b's.
    * To us, "beside" means that the difference of the respective stackIDs is exactly 1. The vertical position of the objects does not matter however.

## Extensions

### Describing planner actions

We implemented output of what the planner does to achieve a goal. When doing so, it gives reasonably concise descriptions of the objects it is handling, that is instead of printing all properties of an object, it only prints the properties needed to distinguish it from other objects of the same form in the current world. Our implementation can be tested with any utterance that results in a valid plan, but one example is:

    * (small world) move all balls inside a large box

Notice how it prints "Picking up the black ball" and omits the fact that the ball is *small*, as there is no other black ball in this world.

### Disambiguation for "the" quantifier

We implemented the abortion of plan execution in case there is ambiguity originating in the use of the "the" quantifier. The user is then presented with a question telling them how to specify their query. To implement it, we made changes in the following places:

    * In Interpreter.ts, in the interpretCommmand() function, we implemented a cascade of if-statements that test the length of the DNF formula that has been generated, depending on whether the "between" keyword is present or not. Could there be ambiguity, it calls the askForClarification() function.
    * Also in Interpreter.ts, we implemented the askForClarification() function - actually a group of functions to deal with the "between" keyword - to abort program execution and present the user with a question in case of ambiguity. Whether there actually is ambiguity is determined by checking the arguments of the literals in the DNF formula. Since the usage of the "between" keyword results in the production of one conjunction for every possible configuration it needs to be handled separately.

The implementation only handles ambiguity from "the" quantifiers that appear in the top two levels of the nested command structure. In deeper levels it is treated in the same way as the "any" quantifier. Here are a few examples of how to test our implementation:

    * (small world) take the ball
    * (small world) take the table
        * put it in the box
    * (complex world) take the plank under a box

### Changes to the Grammar

We implemented an additional "between" keyword to the grammar. It is used to specify a location. To implement it, we had to make changes in the following places:

    * Add the actual keyword in a production rule to grammar.ne and recompile the grammar.
    * Add an optional field for the second entity in a location in Parser.ts.
    * Add special handling in Interpreter.ts
        * modify interpretCommmand()
        * added buildBetweenConj()
        * refactored and modified askForClarification() to handle the DNFs that result from usage of the keyword
        * modified filterCandidate()
    * Add handling to Physics.ts in the form of isValidBetweenLocation()

In order to test our implementation one can use "between" just as one would use any other locational relation keyword in shrdlite. It can also be used in combination with disambiguation for the "the" quantifier in both of its arguments. Here are a few examples:

    * (small world) put the white ball between a box and a box
    * (complex world) take the box between a pyramid and the small ball
    * (medium world) take the brick between the ball and a pyramid
    * (medium world) take the brick between a pyramid and the ball

### Disambiguation for parse ambiguity

For some utterances there might be more than one valid parse tree in the given grammar. We decided that we trust the user's intelligence in the sense that should there only be one parse tree that results in a valid interpretation in the current world, we do not ask the user questions. Should there be more than one parse tree resulting in a valid interpretation, plan execution gets aborted and we present the user with a clarification question. The user can then modify their command so that it is unambiguous. To implement this behavior, we made the following changes:

    * When an a parse result does not yield a valid interpretation, we now put a NULL interpretation. This enables us to keep the original parse structures associated with the information whether they have a valid interpretation or not.
    * In Shrdlite.ts, we check whether there is more than one interpretation. Should that be the case, we generate the user questions from the associated parse results.
        * For user question generation, we implemented a set of functions in Shrdlite.ts that follow the naming pattern generateXString(), where X is Entity, Object, and so forth. The structure of these functions follows the structure of the objects generated by the parser.

TODO

### Handling the "all" quantifier
TODO
