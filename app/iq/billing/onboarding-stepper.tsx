"use client";

import React from "react";

export interface OnboardingStepperProps {
  currentStep: 1 | 2 | 3;
}

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  const steps = [
    { num: 1, label: "Create an account", shortLabel: "Account" },
    { num: 2, label: "Continue to payment", shortLabel: "Payment" },
    { num: 3, label: "Explore the platform", shortLabel: "Explore" },
  ];

  return (
    <div
      data-testid="onboarding-stepper"
      style={{
        width: "100%",
        maxWidth: 620,
        margin: "0 auto 28px",
        padding: "16px 20px",
        borderRadius: 14,
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        {/* Background track line */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "12%",
            right: "12%",
            height: 2,
            background: "rgba(255, 255, 255, 0.1)",
            zIndex: 0,
          }}
        >
          {/* Active progress fill */}
          <div
            style={{
              height: "100%",
              width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%",
              background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
              transition: "width 0.4s ease",
            }}
          />
        </div>

        {steps.map((s) => {
          const isDone = s.num < currentStep;
          const isCurrent = s.num === currentStep;

          return (
            <div
              key={s.num}
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                flex: 1,
              }}
            >
              {/* Circle */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: ".82rem",
                  fontWeight: 800,
                  transition: "all 0.3s ease",
                  ...(isDone
                    ? {
                        background: "#10b981",
                        color: "#05210f",
                        boxShadow: "0 0 14px rgba(16, 185, 129, 0.4)",
                      }
                    : isCurrent
                    ? {
                        background: "#08090a",
                        color: "#10b981",
                        border: "2px solid #10b981",
                        boxShadow: "0 0 14px rgba(16, 185, 129, 0.35)",
                      }
                    : {
                        background: "#12171c",
                        color: "#5b6b79",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                      }),
                }}
              >
                {isDone ? "✓" : s.num}
              </div>

              {/* Label */}
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: ".78rem",
                    fontWeight: isCurrent ? 800 : isDone ? 700 : 500,
                    color: isDone
                      ? "#10b981"
                      : isCurrent
                      ? "#ffffff"
                      : "rgba(255, 255, 255, 0.45)",
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: ".68rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginTop: 2,
                    color: isDone
                      ? "rgba(16, 185, 129, 0.85)"
                      : isCurrent
                      ? "rgba(255, 255, 255, 0.6)"
                      : "rgba(255, 255, 255, 0.25)",
                  }}
                >
                  {isDone ? "Completed" : isCurrent ? `Step ${s.num}` : `Step ${s.num}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
