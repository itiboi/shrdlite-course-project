///<reference path="World.ts"/>

/**
* Physics module
*
* The goal of the Interpreter module is to ensuring that the laws
* of physics are not violated.
*/
module Physics {

  //////////////////////////////////////////////////////////////////////
  // exported functions, classes and interfaces/types

  /**
  * Representation for available objects in WorldState.
  */
  export class FoundObject {
    floor : boolean;  // true if it is the floor
    held: boolean;
    // -1 if held==true or floor
    // in the realworld representation stackId==0
    // means that you are on the left
    stackId: number;
    // -1 if held==true or floor
    // in the realworld representation stackId==0
    // means that you are on the floor
    stackLocation: number;
    definition: ObjectDefinition;

    constructor(definition: ObjectDefinition, held: boolean, stackId: number, stackLoc: number, floor :boolean) {
      this.held = held;
      this.definition = definition;
      this.stackId = stackId;
      this.stackLocation = stackLoc;
      this.floor = floor;
    }
  }

  /**
  * Check if two objects are correctly related and satisfy physical laws
  */
  export function hasValidLocation(c1: FoundObject, relation: string, c2: FoundObject): boolean {
    switch(relation) {
      case "leftof":
        return c1.stackId < c2.stackId;
      case "rightof":
        return c1.stackId > c2.stackId;
      case "inside":
        // Objects are “inside” boxes, but “ontop” of other objects
        // AND Small objects cannot support large objects.

        // Handle something else than a box in an error message?
        if(c2.definition.size == "small" && c1.definition.size == "large") {
          return false;
        }
        return (c1.stackId == c2.stackId) && c1.stackLocation-1 == c2.stackLocation && c2.definition.form == "box";
      case "ontop":
        // Every object can be stacked on the floor.
        // The floor is present at every stackId but the stackLocation has to be valid
        if(c2.floor){
          return c1.stackLocation-1 == c2.stackLocation
        }
        return c1.stackId == c2.stackId && c1.stackLocation-1 == c2.stackLocation && isStackingAllowedByPhysics(c1.definition, c2.definition);
      case "under":
        return c1.stackId == c2.stackId && c1.stackLocation < c2.stackLocation;
      case "beside":
        return hasValidLocation(c1, "leftof", c2) || hasValidLocation(c1, "rightof", c2);
      case "above":
        return c1.stackId == c2.stackId && c1.stackLocation > c2.stackLocation;
      case "holding":
        return c1.held;
    }

    console.warn("Unknown relation received:", relation);
    return false;
  }

  /**
   * Check whether stacking of the objects is allowed by our understanding of physics.
   * @param topC: Top object
   * @param bottomC: Bottom object
   */
  export function isStackingAllowedByPhysics(topC: ObjectDefinition, bottomC: ObjectDefinition) : boolean {
    // Balls must be in boxes or on the floor, otherwise they roll away.
    if (topC.form == "ball" && !(bottomC.form == "box" || bottomC.form == "floor")) {
      return false;
    }

    // Balls cannot support anything
    if(bottomC.form == "ball") {
      return false;
    }

    // Small objects cannot support large objects
    if(bottomC.size == "small" && topC.size == "large") {
      return false;
    }

    // Boxes cannot contain pyramids, planks or boxes of the same size
    if (bottomC.form == "box" && bottomC.size == topC.size) {
      if (topC.form == "plank" || topC.form == "pyramid" || topC.form == "box") {
        return false;
      }
    }

    if (topC.form == "box") {
      // Small boxes cannot be supported by small bricks or pyramids
      if (topC.size == "small" && (bottomC.form == "pyramid" ||
        (bottomC.form == "brick" || bottomC.size == "small"))) {
        return false;
      }

      // Large boxes cannot be supported by large pyramids.
      if (topC.size == "large" && bottomC.size == "large" && bottomC.form == "pyramid") {
            return false;
      }
    }

    // Rest is allowed
    return true;
  }
}
