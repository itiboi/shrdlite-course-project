# README-SHRDLITE for _BetaGo_

## Extensions

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
TODO

### Handling the "all" quantifier
TODO
