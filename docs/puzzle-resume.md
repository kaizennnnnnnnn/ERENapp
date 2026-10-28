# Puzzle Resume

Paw Doku and Yarn Sort checkpoint each completed move to versioned localStorage,
separately for each player and game. Saves stay on this browser/device; they are
not cloud saves. Invalid or newer-format data is ignored. Blocked/full storage
does not prevent playing. Best-score storage and game reward delivery are unchanged.

Paw Doku saves the post-clear board, score, tray, streak and grace count before
the clear animation. Yarn Sort saves the move bank, undo allowance and history;
the final pour of a level checkpoints the next deal before its celebration.
Neither path persists animation state. Terminal boards are removed, and loading
a checkpoint does not report results, award coins or apply care benefits.

The start screen waits for the player's save lookup before enabling Play. A
valid save offers Continue game and an explicit New game action. New game
replaces that player's checkpoint. Changes to stored rules/colour indices need
a save-format version change or a compatible migration.

Checks: `node scripts/check_puzzle_saves.cjs` and `npx tsc --noEmit`.
Browser review pictures live in the ignored `review-pictures/usability-fixes/`.
