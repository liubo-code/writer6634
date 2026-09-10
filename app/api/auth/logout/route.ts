import { clearSessionCookie } from "@/app/simple-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/login", req.url).toString(),
      "Set-Cookie": clearSessionCookie(),
      "Cache-Control": "no-store",
    },
  });
}
