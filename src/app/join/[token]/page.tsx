import { JoinScreen } from "../../../components/team/TeamScreen";
export default async function Page({params}:{params:Promise<{token:string}>}) {
  const {token} = await params;
  return <JoinScreen key={token} token={token} />;
}
