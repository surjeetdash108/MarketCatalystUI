"use client";

import { DataState } from "../utils";

export function ComingSoonScreen({ title }: { title: string }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{title}</h1>
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <DataState label="Coming soon" height={240} />
      </div>
    </>
  );
}
