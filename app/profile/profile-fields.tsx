import Image from "next/image";

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

export const assetClassOptions = ["Stocks", "Mutual Funds", "ETFs", "Bonds"];

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
      <label className="mb-2 block text-sm font-bold text-[#26372f]" htmlFor={id}>
        {label}
      </label>
      <input
        className="h-12 w-full rounded-md border border-[#d6dfd9] bg-white px-4 text-base outline-none transition focus:border-[#1f5f50] focus:ring-4 focus:ring-[#1f5f50]/10 disabled:bg-[#f4f7f5]"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        required
        type={type}
        value={value}
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
      <label className="mb-2 block text-sm font-bold text-[#26372f]" htmlFor={id}>
        {label}
      </label>
      <select
        className="h-12 w-full rounded-md border border-[#d6dfd9] bg-white px-4 text-base outline-none transition focus:border-[#1f5f50] focus:ring-4 focus:ring-[#1f5f50]/10"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        required
        value={value}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
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
    const nextAssetClasses = profile.preferredAssetClasses.includes(assetClass)
      ? profile.preferredAssetClasses.filter((item) => item !== assetClass)
      : [...profile.preferredAssetClasses, assetClass];

    onChange("preferredAssetClasses", nextAssetClasses);
  }

  function handleImageChange(file: File | undefined) {
    if (!file) {
      return;
    }

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
      if (typeof reader.result === "string") {
        onChange("profile_image", reader.result);
      }
    };

    reader.onerror = () => {
      window.alert("Unable to read the selected image. Please try again.");
    };

    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label
          className="mb-2 block text-sm font-bold text-[#26372f]"
          htmlFor="profile-image"
        >
          Profile image
        </label>
        <div className="flex flex-col gap-4 rounded-md border border-[#d6dfd9] bg-[#fbfcfb] p-4 sm:flex-row sm:items-center">
          <Image
            alt="Profile preview"
            className="size-20 rounded-full border-4 border-white bg-[#e8f3ef] object-cover shadow-sm shadow-emerald-100"
            height={80}
            src={profile.profile_image || "/profile-avatar.svg"}
            unoptimized
            width={80}
          />
          <div className="flex-1">
            <input
              accept="image/*"
              className="block w-full text-sm text-[#52645b] file:mr-4 file:rounded-md file:border-0 file:bg-[#e8f3ef] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#166052]"
              id="profile-image"
              onChange={(event) => handleImageChange(event.target.files?.[0])}
              type="file"
            />
            <p className="mt-2 text-xs text-[#66756d]">
              Saved as <span className="font-semibold">profile_image</span>.
              Use an image under 650 KB.
            </p>
          </div>
        </div>
      </div>
      <TextField
        id="profile-name"
        label="Name"
        onChange={(value) => onChange("name", value)}
        value={profile.name}
      />
      <TextField
        id="profile-email"
        label="Email"
        onChange={(value) => onChange("email", value)}
        readOnly={emailReadOnly}
        type="email"
        value={profile.email}
      />
      <TextField
        id="profile-mobile"
        label="Mobile number"
        onChange={(value) => onChange("mobileNumber", value)}
        type="tel"
        value={profile.mobileNumber}
      />
      <TextField
        id="profile-age"
        label="Age"
        onChange={(value) => onChange("age", value)}
        type="number"
        value={profile.age}
      />
      <SelectField
        id="profile-income"
        label="Income range"
        onChange={(value) => onChange("incomeRange", value)}
        options={incomeRanges}
        value={profile.incomeRange}
      />
      <SelectField
        id="profile-experience"
        label="Investment experience"
        onChange={(value) => onChange("investmentExperience", value)}
        options={investmentExperienceOptions}
        value={profile.investmentExperience}
      />
      <SelectField
        id="profile-goals"
        label="Investment goals"
        onChange={(value) => onChange("investmentGoals", value)}
        options={investmentGoalOptions}
        value={profile.investmentGoals}
      />
      <SelectField
        id="profile-risk"
        label="Risk tolerance"
        onChange={(value) => onChange("riskTolerance", value)}
        options={riskToleranceOptions}
        value={profile.riskTolerance}
      />
      <SelectField
        id="profile-horizon"
        label="Investment horizon"
        onChange={(value) => onChange("investmentHorizon", value)}
        options={investmentHorizonOptions}
        value={profile.investmentHorizon}
      />
      <TextField
        id="profile-value"
        label="Current portfolio value"
        onChange={(value) => onChange("currentPortfolioValue", value)}
        type="number"
        value={profile.currentPortfolioValue}
      />
      <fieldset className="sm:col-span-2">
        <legend className="mb-3 text-sm font-bold text-[#26372f]">
          Preferred asset classes
        </legend>
        <div className="grid gap-3 sm:grid-cols-4">
          {assetClassOptions.map((assetClass) => (
            <label
              className="flex h-11 items-center gap-3 rounded-md border border-[#d6dfd9] bg-white px-3 text-sm font-semibold text-[#26372f]"
              key={assetClass}
            >
              <input
                checked={profile.preferredAssetClasses.includes(assetClass)}
                className="size-4 accent-[#1f5f50]"
                onChange={() => toggleAssetClass(assetClass)}
                type="checkbox"
              />
              {assetClass}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
