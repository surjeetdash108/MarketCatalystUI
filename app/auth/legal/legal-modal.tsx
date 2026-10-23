"use client";

import { useEffect, useRef } from "react";
import { TermsContent } from "./terms-content";
import { PrivacyContent } from "./privacy-content";
import "./legal-modal.css";

interface LegalModalProps {
  type: "terms" | "privacy";
  onClose: () => void;
}

export function LegalModal({ type, onClose }: LegalModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const isTerms = type === "terms";

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Handle in-modal anchor clicks (e.g., table of contents links)
  function handleBodyClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (href && href.startsWith("#")) {
      e.preventDefault();
      if (href === "#terms-top" || href === "#privacy-top") {
        bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const targetElem = bodyRef.current?.querySelector(href);
      if (targetElem) {
        targetElem.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  return (
    <div
      className="legal-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-heading"
    >
      <div
        className="legal-modal-window"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="legal-modal-head">
          <div className="legal-modal-title" id="legal-modal-heading">
            <span>{isTerms ? "Terms of Service" : "Privacy Policy"}</span>
            <span className="legal-modal-badge">Oct 22, 2026</span>
          </div>

          <button
            type="button"
            className="legal-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          ref={bodyRef}
          className="legal-modal-body"
          onClick={handleBodyClick}
        >
          {isTerms ? <TermsContent /> : <PrivacyContent />}
        </div>
      </div>
    </div>
  );
}
