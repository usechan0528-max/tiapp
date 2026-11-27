import Link from "next/link";
import ChatRoom from "../../components/chat/ChatRoom";
import { sessionToken } from "../../lib/team/auth";
import { membership, teamInfo } from "../../lib/team/store";

export default async function ChatPage() {
  const member = membership(await sessionToken());
  if (!member) return <main><h1>팀 채팅</h1><p>팀을 만들거나 초대를 받아 참여하면 대화를 시작할 수 있어요.</p><Link href="/">TF 팀 열기</Link></main>;
  const team = teamInfo(member.teamId);
  return <main><h1>팀 채팅</h1><ChatRoom key={member.memberId} memberId={member.memberId} teamName={team.name}/></main>;
}
