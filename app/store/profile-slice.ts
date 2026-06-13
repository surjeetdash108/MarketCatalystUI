import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { InvestorProfile } from "../profile/profile-fields";

export type StoredProfile = InvestorProfile & {
  uid: string;
  tier: string;
};

interface ProfileState {
  data: StoredProfile | null;
  status: "idle" | "loading" | "ready";
}

const initialState: ProfileState = {
  data: null,
  status: "idle",
};

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    setProfileLoading(state) {
      state.status = "loading";
    },
    setProfile(state, action: PayloadAction<StoredProfile | null>) {
      state.data = action.payload;
      state.status = "ready";
    },
    updateProfileData(state, action: PayloadAction<Partial<StoredProfile>>) {
      if (state.data) {
        state.data = { ...state.data, ...action.payload };
      }
    },
  },
});

export const { setProfileLoading, setProfile, updateProfileData } =
  profileSlice.actions;
export default profileSlice.reducer;
