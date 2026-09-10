import Board from "@/components/board";
import { cloudflareAccessConfigured, getCloudflareUser } from "./cloudflare-auth";

export const dynamic = "force-dynamic";

function AccessSetupRequired({ configured }: { configured: boolean }) {
  return (
    <main className="min-h-screen bg-[#edf5f2] px-6 py-12 text-[#2f423e]">
      <div className="mx-auto max-w-2xl rounded-3xl border border-[#d5e5df] bg-white/90 p-8 shadow-sm">
        <div className="mb-3 text-sm font-semibold tracking-[0.18em] text-[#6a8a82]">伏线 · CLOUDFLARE READY</div>
        <h1 className="text-2xl font-semibold">需要 Cloudflare Access 验证</h1>
        <p className="mt-4 leading-7 text-[#60736f]">
          {configured
            ? "Access 运行参数已经存在，但当前请求没有通过有效的 Access 身份验证。请从受 Cloudflare Access 保护的网址进入。"
            : "当前 Worker 还没有配置 CF_ACCESS_TEAM_DOMAIN 与 CF_ACCESS_AUD。网站会保持锁定，不会把你的小说数据暴露在公网。"}
        </p>
        <p className="mt-4 text-sm leading-6 text-[#7a8d89]">
          部署说明见源码根目录的 CLOUDFLARE_DEPLOY.md。配置完成后，未登录访问会由 Cloudflare 在到达应用之前拦截。
        </p>
      </div>
    </main>
  );
}

export default async function Home() {
  const user = await getCloudflareUser();
  if (!user) return <AccessSetupRequired configured={cloudflareAccessConfigured()} />;
  return <Board ownerKey={user.userId} />;
}
