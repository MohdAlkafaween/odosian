import { errorResponse } from "@/lib/errors";

export async function POST() {
  return errorResponse(
    "Public registration is disabled. Contact an administrator to create your account.",
    403
  );
}
