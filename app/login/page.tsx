import { redirect } from "next/navigation";
import { getCloudflareUser } from "../cloudflare-auth";
import { simpleGateConfigured } from "../simple-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCloudflareUser();
  if (user) redirect("/");
  const params = await searchParams;
  const configured = simpleGateConfigured();

  return (
    <main className="min-h-screen bg-[#edf5f2] px-6 py-16 text-[#2f423e]">
      <div className="mx-auto max-w-md rounded-[28px] border border-[#d7e7e1] bg-white/95 p-8 shadow-[0_20px_60px_rgba(70,110,101,0.12)]">
        <div className="mb-2 text-sm font-semibold tracking-[0.18em] text-[#6d8e86]">伏线 · PRIVATE</div>
        <h1 className="text-3xl font-semibold">进入小说工作台</h1>
        <p className="mt-3 text-sm leading-6 text-[#70837f]">先用一把临时密码把门关上。以后启用 Cloudflare Access 时，这层门禁会自动让位。</p>

        {!configured ? (
          <div className="mt-7 rounded-2xl border border-[#ead7c8] bg-[#fff8f2] p-4 text-sm leading-6 text-[#806653]">
            临时门禁还没配置。请先在 Cloudflare Worker 的 Variables / Secrets 中设置 APP_GATE_PASSWORD 与 APP_SESSION_SECRET。
          </div>
        ) : (
          <form className="mt-8 space-y-4" action="/api/auth/login" method="post">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">访问密码</span>
              <input
                className="w-full rounded-2xl border border-[#d6e6e0] bg-[#f9fcfb] px-4 py-3 outline-none transition focus:border-[#72a99b] focus:ring-4 focus:ring-[#dcefe9]"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                autoFocus
              />
            </label>
            {params.error === "1" && <p className="text-sm text-[#b35e62]">密码不对。门还挺有职业道德。</p>}
            <button className="w-full rounded-2xl bg-[#3f8f7f] px-4 py-3 font-semibold text-white transition hover:bg-[#347b6d]" type="submit">
              进入伏线
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
