/**
 * Shows a native browser confirm dialog warning the user that a job may not be
 * available to F1 visa holders. Native dialogs are fully modal and cannot be
 * auto-dismissed, so the warning always stays until the user responds.
 *
 * @returns `true` if the user chose to continue anyway, `false` to go back.
 */
export function confirmEligibilityOverride(flaggedSentences: string[]): boolean {
  const message = [
    "⚠️ Work Authorization Required",
    "",
    "This job may not be available to F1 visa holders.",
    "",
    "Detected requirements:",
    ...flaggedSentences.map((sentence) => `• ${sentence}`),
    "",
    "As an F1 visa holder you typically cannot hold a security clearance or work without visa sponsorship.",
    "",
    "Click OK to continue anyway, or Cancel to go back.",
  ].join("\n");

  return window.confirm(message);
}
