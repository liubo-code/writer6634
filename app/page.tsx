import Board from "@/components/board";
import { redirect } from "next/navigation";
import { cloudflareAccessConfigured, getCloudflareUser } from "./cloudflare-auth";
import { simpleGateConfigured } from "./simple-auth";

export const dynamic = "force-dynamic";

function AuthSetupRequired() {
  return (
    <main className="min-h-screen bg-[#edf5f2] px-6 py-12 text-[#2f423e]">
      <div className="mx-auto max-w-2xl rounded-3xl border border-[#d5e5df] bg-white/90 p-8 shadow-sm">
        <div className="mb-3 text-sm font-semibold tracking-[0.18em] text-[#6a8a82]">伏线 · PRIVATE WORKBENCH</div>
        <h1 className="text-2xl font-semibold">网站门禁还没配置</h1>
        <p className="mt-4 leading-7 text-[#60736f]">
          当前生产环境没有启用 Cloudflare Access，也没有配置临时密码门禁。伏线会保持锁定，不会直接开放你的小说数据。
        </p>
        <p className="mt-4 text-sm leading-6 text-[#7a8d89]">
          临时使用请在 Worker Variables / Secrets 中配置 APP_GATE_PASSWORD 与 APP_SESSION_SECRET。以后启用 Cloudflare Access 后，它会自动优先使用 Access。
        </p>
      </div>
    </main>
  );
}

export default async function Home() {
  const user = await getCloudflareUser();
  if (!user) {
    if (!cloudflareAccessConfigured() && simpleGateConfigured()) redirect("/login");
    return <AuthSetupRequired />;
  }
  return <Board ownerKey={user.userId} />;
}
