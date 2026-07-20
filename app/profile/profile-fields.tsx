export type InvestorProfile = {
  profile_image: string;
  name: string;
  email: string;
  mobileNumber: string;
  age: string;
  incomeRange: string;
  investmentExperience: string;
  investmentGoals: string;
  riskTolerance: string;
  investmentHorizon: string;
  currentPortfolioValue: string;
  preferredAssetClasses: string[];
};

export const incomeRanges = [
  "Below $25,000",
  "$25,000 - $50,000",
  "$50,000 - $100,000",
  "$100,000 - $250,000",
  "Above $250,000",
];

export const investmentExperienceOptions = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Professional",
];

export const investmentGoalOptions = [
  "Wealth creation",
  "Retirement planning",
  "Capital preservation",
  "Regular income",
  "Tax planning",
];

export const riskToleranceOptions = [
  "Conservative",
  "Moderate",
  "Aggressive",
];

export const investmentHorizonOptions = [
  "Less than 1 year",
  "1 - 3 years",
  "3 - 5 years",
  "5 - 10 years",
  "10+ years",
];

export const assetClassOptions = ["Stocks", "Mutual Funds", "Bonds"];

export const emptyInvestorProfile: InvestorProfile = {
  profile_image: "",
  name: "",
  email: "",
  mobileNumber: "",
  age: "",
  incomeRange: "",
  investmentExperience: "",
  investmentGoals: "",
  riskTolerance: "",
  investmentHorizon: "",
  currentPortfolioValue: "",
  preferredAssetClasses: [],
};

type ProfileFieldsProps = {
  profile: InvestorProfile;
  onChange: (field: keyof InvestorProfile, value: string | string[]) => void;
  emailReadOnly?: boolean;
};

function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  readOnly = false,
}: Readonly<{
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}>) {
  return (
    <div>
      <label className="iq-label" htmlFor={id}>{label}</label>
      <input
        className="iq-input"
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  options,
  value,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <div>
      <label className="iq-label" htmlFor={id}>{label}</label>
      <select
        className="iq-select"
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function ProfileFields({
  profile,
  onChange,
  emailReadOnly = false,
}: Readonly<ProfileFieldsProps>) {
  function toggleAssetClass(assetClass: string) {
    const next = profile.preferredAssetClasses.includes(assetClass)
      ? profile.preferredAssetClasses.filter(i => i !== assetClass)
      : [...profile.preferredAssetClasses, assetClass];
    onChange("preferredAssetClasses", next);
  }

  function handleImageChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please select a valid image file.");
      return;
    }
    if (file.size > 650 * 1024) {
      window.alert("Please select an image smaller than 650 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange("profile_image", reader.result);
    };
    reader.onerror = () => window.alert("Unable to read the selected image. Please try again.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="iq-form-grid">
      {/* Image upload */}
      <div className="span-2">
        <label className="iq-label" htmlFor="profile-image">Profile image</label>
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "12px 14px", borderRadius: "var(--r-sm)",
          border: "1px solid var(--border)", background: "var(--surface-1)",
        }}>
          <img
            alt="Profile preview"
            src={profile.profile_image || "/profile-avatar.svg"}
            style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid var(--border-strong)" }}
          />
          <div style={{ flex: 1 }}>
            {/* Native file input is hidden; the label acts as the trigger button. */}
            <input
              id="profile-image"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => handleImageChange(e.target.files?.[0])}
            />
            <label
              htmlFor="profile-image"
              style={{
                display: "inline-block", padding: "7px 16px", borderRadius: "var(--r-sm)",
                border: "1px solid var(--border-strong)", background: "var(--surface-2)",
                color: "var(--text)", fontSize: "0.7812rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              {profile.profile_image ? "Change image" : "Upload image"}
            </label>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-dim-solid)", marginTop: 4 }}>
              Max 650 KB
            </div>
          </div>
        </div>
      </div>

      <TextField id="profile-name" label="Name" value={profile.name} onChange={v => onChange("name", v)} />
      <TextField id="profile-email" label="Email" type="email" value={profile.email} readOnly={emailReadOnly} onChange={v => onChange("email", v)} />
      <TextField id="profile-mobile" label="Mobile number" type="tel" value={profile.mobileNumber} onChange={v => onChange("mobileNumber", v)} />
      <TextField id="profile-age" label="Age" type="number" value={profile.age} onChange={v => onChange("age", v)} />
      <SelectField id="profile-income" label="Income range" options={incomeRanges} value={profile.incomeRange} onChange={v => onChange("incomeRange", v)} />
      <SelectField id="profile-experience" label="Investment experience" options={investmentExperienceOptions} value={profile.investmentExperience} onChange={v => onChange("investmentExperience", v)} />
      <SelectField id="profile-goals" label="Investment goals" options={investmentGoalOptions} value={profile.investmentGoals} onChange={v => onChange("investmentGoals", v)} />
      <SelectField id="profile-risk" label="Risk tolerance" options={riskToleranceOptions} value={profile.riskTolerance} onChange={v => onChange("riskTolerance", v)} />
      <SelectField id="profile-horizon" label="Investment horizon" options={investmentHorizonOptions} value={profile.investmentHorizon} onChange={v => onChange("investmentHorizon", v)} />
      <TextField id="profile-value" label="Current portfolio value ($)" type="number" value={profile.currentPortfolioValue} onChange={v => onChange("currentPortfolioValue", v)} />

      {/* Asset class checkboxes */}
      <div className="span-2">
        <div className="iq-label" style={{ marginBottom: 8 }}>Preferred asset classes</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {assetClassOptions.map(ac => {
            const checked = profile.preferredAssetClasses.includes(ac);
            return (
              <label key={ac} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "6px 14px", borderRadius: 99, cursor: "pointer",
                fontSize: "0.8125rem", fontWeight: 500,
                background: checked ? "var(--brand-dim)" : "var(--surface-2)",
                border: `1px solid ${checked ? "var(--brand)" : "var(--border)"}`,
                color: checked ? "var(--brand-2)" : "var(--text)",
                transition: "all .12s",
              }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAssetClass(ac)}
                  style={{ display: "none" }}
                />
                {checked && <span style={{ fontSize: "0.6875rem", fontWeight: 700 }}>✓</span>}
                {ac}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
