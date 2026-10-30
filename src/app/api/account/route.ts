import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { getAuth } from "@/lib/auth/auth";
import { deleteAccountData } from "@/lib/auth/account";
import { getOwner } from "@/lib/auth/identity";
import { getDeps } from "@/lib/server/deps";

const DeleteAccountSchema = z.object({ confirm: z.literal("delete", { message: "Type delete to confirm." }) });

// DELETE /api/account: deletes the signed-in user's specs, usage, sessions and account, then signs out (SPEC §17).
export async function DELETE(request: NextRequest) {
  try {
    const owner = await getOwner(request);
    if (owner.kind !== "user") {
      throw new ApiError(401, "sign_in_required", "Sign in to delete your account.");
    }
    await readJson(request, DeleteAccountSchema);

    // Sign-out clears the session cookies. Their Set-Cookie headers go on the response.
    const signedOut = await getAuth().api.signOut({ headers: request.headers, returnHeaders: true });
    await deleteAccountData(getDeps().db, owner.userId);

    const response = NextResponse.json({ ok: true });
    signedOut.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") response.headers.append(key, value);
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
