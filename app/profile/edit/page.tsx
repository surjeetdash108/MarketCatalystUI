import { IQShell } from "../../iq/shell";
import { ProfileEditForm } from "./profile-edit-form";
import { ProfileEditShell } from "./profile-edit-shell";

export default function EditProfilePage() {
  return (
    <IQShell>
      <ProfileEditShell>
        <ProfileEditForm />
      </ProfileEditShell>
    </IQShell>
  );
}
