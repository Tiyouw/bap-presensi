// Arm before the triggering action, then await after it before checking effects.
exports.acceptAppDialog = async (page) => {
  const dialog = page.locator(".app-dialog");
  await dialog.waitFor();
  await dialog.locator(".app-dialog-actions button").last().click();
  await dialog.waitFor({ state: "detached" });
};
