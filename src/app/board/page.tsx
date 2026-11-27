import Link from "next/link";
import styles from "../../components/chat/chat.module.css";
import Checkins from "../../components/checkin/Checkins";
import TaskBoard from "../../components/tasks/TaskBoard";

export default function Board() {
  return <main>
    <header className={styles.boardHeader}><h1>업무판</h1><Link href="/chat">팀 채팅</Link></header>
    <TaskBoard />
    <Checkins />
  </main>;
}
