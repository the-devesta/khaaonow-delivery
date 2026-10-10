/**
 * Set while a rider waiting for approval goes back to edit their signup
 * details, so the registration guard doesn't bounce them straight back to the
 * "under review" screen. Cleared when they land on that screen again.
 */
let editing = false;

export const signupEdit = {
  start: () => {
    editing = true;
  },
  stop: () => {
    editing = false;
  },
  active: () => editing,
};
