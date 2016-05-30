# README-SHRDLITE for _BetaGo_
## Extensions
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

In order to test our implementation one can use "between" just as one would use any other locational relation keyword in shrdlite. It can also be used in combination with disambiguation for the "the" quantifier in both of its arguments.
    * (small world) put the white ball between a box and a box
    * (complex world) take the box between a pyramid and the small ball
    * (medium world) take the brick between the ball and a pyramid
    * (medium world) take the brick between a pyramid and the ball
