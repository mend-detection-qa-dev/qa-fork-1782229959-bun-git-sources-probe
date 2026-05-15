// Minimal stub — probe is about source-type detection, not runtime behavior.
// Import both git-sourced packages to confirm they appear in the dep tree.
import isOdd from "is-odd";
import isEven from "is-even";

// These calls are never executed in the probe environment.
// They exist so bundlers / tree-shakers cannot drop the imports.
export { isOdd, isEven };