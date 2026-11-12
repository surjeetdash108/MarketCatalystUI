"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export function WelcomeFeedbackModals() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 1. Check if user just signed up
    if (window.localStorage.getItem("mc_show_welcome") === "1") {
      setShowWelcome(true);
      return;
    }
    // 2. Check if returning user logged in
    if (window.sessionStorage.getItem("mc_show_feedback") === "1") {
      setShowFeedback(true);
    }
  }, []);

  const closeWelcome = () => {
    setShowWelcome(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("mc_show_welcome");
      window.localStorage.setItem("mc_welcomed", "1");
    }
  };

  const closeFeedback = () => {
    setShowFeedback(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("mc_show_feedback");
    }
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackSent(true);
    setTimeout(() => {
      closeFeedback();
    }, 1200);
  };

  return (
    <>
      {showWelcome && (
        <div
          data-testid="welcome-aboard-modal"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={closeWelcome}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "relative",
              width: 460,
              maxWidth: "calc(100vw - 32px)",
              background: "#0e141d",
              border: "1px solid #283749",
              borderRadius: 16,
              padding: "26px 24px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.85)",
              zIndex: 10001,
              fontFamily: "'Manrope', -apple-system, sans-serif",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 99,
                  fontSize: ".75rem",
                  fontWeight: 800,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  background: "rgba(74, 222, 128, 0.15)",
                  color: "#4ade80",
                  border: "1px solid rgba(74, 222, 128, 0.3)",
                }}
              >
                7-Day Free Access
              </span>
              <button
                onClick={closeWelcome}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#9aa3a8",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                ✕
              </button>
            </div>

            <h2
              style={{
                margin: "0 0 10px",
                fontSize: "1.35rem",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.3,
              }}
            >
              Welcome Aboard! 🎉
            </h2>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: ".9rem",
                color: "#9aa3a8",
                lineHeight: 1.6,
              }}
            >
              We value our customers, so we are providing <b>7 days free</b> access to{" "}
              <span style={{ color: "#4ade80", fontWeight: 700 }}>Market Catalyst</span>,{" "}
              <span style={{ color: "#7fa8d0", fontWeight: 700 }}>Stock Intelligence</span>, and{" "}
              <span style={{ color: "#e0bb5e", fontWeight: 700 }}>Money Flow</span> for you to explore all features.
            </p>

            <button
              type="button"
              onClick={closeWelcome}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "12px 18px",
                borderRadius: 10,
                background: "linear-gradient(90deg, #4ade80 0%, #22c55e 100%)",
                color: "#05210f",
                fontWeight: 800,
                fontSize: ".92rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Start Exploring
            </button>
          </div>
        </div>
      )}

      {showFeedback && (
        <div
          data-testid="login-feedback-modal"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={closeFeedback}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "relative",
              width: 460,
              maxWidth: "calc(100vw - 32px)",
              background: "#0e141d",
              border: "1px solid #283749",
              borderRadius: 16,
              padding: "26px 24px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.85)",
              zIndex: 10001,
              fontFamily: "'Manrope', -apple-system, sans-serif",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 99,
                  fontSize: ".75rem",
                  fontWeight: 800,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  background: "rgba(224, 187, 94, 0.15)",
                  color: "#e0bb5e",
                  border: "1px solid rgba(224, 187, 94, 0.3)",
                }}
              >
                Feedback
              </span>
              <button
                onClick={closeFeedback}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#9aa3a8",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                ✕
              </button>
            </div>

            <h2
              style={{
                margin: "0 0 8px",
                fontSize: "1.3rem",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.3,
              }}
            >
              Enjoying our platform?
            </h2>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: ".88rem",
                color: "#9aa3a8",
                lineHeight: 1.5,
              }}
            >
              Take a moment to share your thoughts or suggestions with our team.
            </p>

            {feedbackSent ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: 10,
                  background: "rgba(74, 222, 128, 0.12)",
                  border: "1px solid rgba(74, 222, 128, 0.3)",
                  color: "#4ade80",
                  textAlign: "center",
                  fontSize: ".9rem",
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Thank you for your feedback!
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <textarea
                  rows={3}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell us what you like or how we can improve (optional)..."
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    border: "1px solid #283749",
                    background: "#080c12",
                    color: "#ffffff",
                    padding: "10px 14px",
                    fontSize: ".86rem",
                    fontFamily: "inherit",
                    resize: "none",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: ".84rem",
                    cursor: "pointer",
                  }}
                >
                  Send Feedback
                </button>
              </form>
            )}

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <Link
                href="/choose-plan"
                onClick={closeFeedback}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  textDecoration: "none",
                  padding: "12px 18px",
                  borderRadius: 10,
                  background: "linear-gradient(90deg, #4ade80 0%, #22c55e 100%)",
                  color: "#05210f",
                  fontWeight: 800,
                  fontSize: ".9rem",
                }}
              >
                See our plans
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
