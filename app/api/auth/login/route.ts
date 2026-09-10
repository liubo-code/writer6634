import { createSessionToken, sessionCookie, simpleGateConfigured, verifyGatePassword } from "@/app/simple-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!simpleGateConfigured()) {
    return new Response("Temporary gate is not configured", { status: 503 });
  }

  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  if (!(await verifyGatePassword(password))) {
    return Response.redirect(new URL("/login?error=1", req.url), 303);
  }

  const token = await createSessionToken();
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/", req.url).toString(),
      "Set-Cookie": sessionCookie(token),
      "Cache-Control": "no-store",
    },
  });
}
