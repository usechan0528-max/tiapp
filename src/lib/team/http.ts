import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "./auth";
import { TeamError } from "./store";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function respond(action: () => Promise<NextResponse>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof TeamError) return json({error:error.message}, error.status);
    if (error instanceof SyntaxError) return json({error:"입력 내용을 확인해 주세요."}, 400);
    throw error;
  }
}
export function signedIn(session: string, request: Request) {
  const res = json({ok:true});
  res.cookies.set(SESSION_COOKIE, session, { httpOnly:true, sameSite:"lax", path:"/", maxAge:60*60*24*90, secure:new URL(request.url).protocol === "https:" });
  return res;
}
