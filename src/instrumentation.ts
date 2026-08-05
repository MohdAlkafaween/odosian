export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { resumeInterruptedBatches } = await import("@/lib/batch-analysis");
  resumeInterruptedBatches().catch((e) =>
    console.error("Failed to resume interrupted analysis batches:", e)
  );
}
