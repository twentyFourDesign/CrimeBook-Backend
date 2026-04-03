import { UsersAdminTable } from "../_components/UsersAdminTable";

export default function AdminUsersPage() {
  return (
    <UsersAdminTable
      title="All users"
      description="Search, filter, and manage account status (suspend, activate, deactivate)."
    />
  );
}
