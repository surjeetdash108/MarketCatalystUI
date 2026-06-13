import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface SerializedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthState {
  user: SerializedUser | null;
  status: "loading" | "ready";
}

const initialState: AuthState = {
  user: null,
  status: "loading",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<SerializedUser | null>) {
      state.user = action.payload;
    },
    setAuthReady(state) {
      state.status = "ready";
    },
  },
});

export const { setUser, setAuthReady } = authSlice.actions;
export default authSlice.reducer;
