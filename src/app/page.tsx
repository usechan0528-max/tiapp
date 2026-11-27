import { TeamScreen } from "../components/team/TeamScreen";
import { sessionToken } from "../lib/team/auth";

export default async function Page() {
  return <TeamScreen hasSession={Boolean(await sessionToken())} />;
}
