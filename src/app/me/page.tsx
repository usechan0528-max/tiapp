import Link from "next/link";
import { sessionToken } from "../../lib/team/auth";
import { membership, personalTeams } from "../../lib/team/store";
import { OpenTeam, InviteEntry } from "../../components/team/ProfileActions";
import styles from "../../components/team/team.module.css";

export default async function PersonalPage() {
  const session = await sessionToken();
  const teams = personalTeams(session);
  const active = membership(session);
  return <main><h1>내 팀 관리</h1>
    <p>이 브라우저에서 내가 만들거나 초대로 참여한 팀입니다.</p>
    <section className={styles.block}>
      <div className={styles.formHead}><h2>참여 중인 팀 <small>{teams.length}</small></h2><Link href="/team/new">새 팀 만들기</Link></div>
      {!teams.length && <p>아직 참여 중인 팀이 없습니다.</p>}
      <ul className={styles.members}>{teams.map(team => <li key={team.id}>
        <div><strong>{team.name}</strong><span>{team.role === "leader" ? "팀장" : "팀원"} · 마감 {team.deadline}</span></div>
        <div className={styles.teamAction}>{active?.teamId === team.id ? <OpenTeam teamId={team.id} current/> : <OpenTeam teamId={team.id}/>}</div>
      </li>)}</ul>
    </section>
    <InviteEntry/>
  </main>;
}
