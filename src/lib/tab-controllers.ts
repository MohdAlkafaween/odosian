// A running AI tab (analyze/enhance/generate/simulate) is just one in-flight
// HTTP request — there's no server-side job to pause/stop the way a batch
// has. Cancelling one for real means aborting that specific fetch, and the
// component making the request (e.g. RuleDetailView) isn't the same one
// rendering the "still running" UI with the Cancel button (AITabContent) —
// this is the bridge between them, keyed by tab id.
const controllers = new Map<string, AbortController>();

export function registerTabController(tabId: string, controller: AbortController): void {
  controllers.set(tabId, controller);
}

export function clearTabController(tabId: string): void {
  controllers.delete(tabId);
}

export function cancelTab(tabId: string): boolean {
  const controller = controllers.get(tabId);
  if (!controller) return false;
  controller.abort();
  controllers.delete(tabId);
  return true;
}
