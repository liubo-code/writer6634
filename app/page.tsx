import Board from '@/components/board';
import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');return <Board ownerKey={user.userId}/>;}
