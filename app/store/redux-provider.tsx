"use client";

import { Provider } from "react-redux";
import { ReactNode } from "react";
import { store } from "./store";
import { FirebaseListener } from "./firebase-listener";

export function ReduxProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Provider store={store}>
      <FirebaseListener />
      {children}
    </Provider>
  );
}
