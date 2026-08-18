import { AdminBoard } from './AdminBoard';
import { OperatorGate } from './OperatorGate';
import './admin.css';

export default function AdminPage() {
  return (
    <OperatorGate>
      <AdminBoard />
    </OperatorGate>
  );
}
