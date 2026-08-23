import { JoinFlow } from './JoinFlow';
import './join.css';

export default function JoinPage() {
  const isMockServer = !process.env.DATABASE_URL && !process.env.NEXT_PUBLIC_API_BASE_URL;
  return <JoinFlow isMockServer={isMockServer} />;
}
