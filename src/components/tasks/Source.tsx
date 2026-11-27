import { sourceBlocks, type Submission } from "../../lib/tasks/types";
import styles from "./tasks.module.css";

export function SourceTable({ header, rows }: { header: string[]; rows: string[][] }) {
  return <div className={styles.tableWrap}><table>
        <thead><tr>{header.map((cell, col) => <th scope="col" key={col}>{cell}</th>)}</tr></thead>
        <tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}</tbody>
      </table></div>;
}

export function Source({ submission }: { submission: Submission }) {
  return <div className={styles.source}>
    {sourceBlocks(submission.text).map((block, i) => typeof block === "string"
      ? <p className={styles.prose} key={i}>{block}</p>
      : <SourceTable key={i} header={block.header} rows={block.rows} />)}
    {submission.url && <a target="_blank" rel="noreferrer" href={submission.url}>자료 링크 열기 ↗</a>}
  </div>;
}
