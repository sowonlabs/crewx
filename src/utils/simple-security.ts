/**
 * CLI option sorting utility
 * User suggestion: "Filter so that double dashes come first"
 * 
 * Prevents parsing errors due to option order in CLIs like copilot
 * e.g.: copilot -p --allowedTools (error) -> copilot --allowedTools -p (correct)
 */

export class CliOptionSorter {
  /**
   * Simple option sorting: -- options come before - options
   * 
   * @param options Array of CLI options
   * @returns Sorted array of options (all user options are preserved, only the order is adjusted)
   */
  static sortOptions(options: string[]): string[] {
    return [...options].sort((a, b) => {
      const aIsLong = a.startsWith('--');
      const aIsShort = a.startsWith('-') && !a.startsWith('--');
      const bIsLong = b.startsWith('--');  
      const bIsShort = b.startsWith('-') && !b.startsWith('--');
      
      // -- options come before - options (to prevent CLI parsing errors)
      if (aIsLong && bIsShort) return -1;
      if (bIsLong && aIsShort) return 1;
      
      // Keep original order for options of the same type
      return 0;
    });
  }
}