import { UsersAdminTable } from "../_components/UsersAdminTable";

export default function AdminPoliceOfficersPage() {
  return (
    <UsersAdminTable
      title="Police officers"
      description="Officers and command staff. Badge and department from officer profile when available."
      fixedRoles="POLICE_OFFICER,POLICE_COMMAND"
    />
  );
}
