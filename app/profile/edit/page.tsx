import { IQShell } from "../../iq/shell";
import { ProfileEditForm } from "./profile-edit-form";

export default function EditProfilePage() {
  return (
    <IQShell>
      <div className="page-head">
        <div>
          <div className="page-title">Edit Profile</div>
          <div className="page-sub">Update your investor details and preferences</div>
        </div>
      </div>
      <div className="dash" style={{ gridTemplateColumns: "1fr", maxWidth: 760 }}>
        <div className="col-12">
          <ProfileEditForm />
        </div>
      </div>
    </IQShell>
  );
}
