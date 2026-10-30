// Strategy Lab feature flags (build-time). See docs/strategy-lab-automation-todo.md
// for what must exist before broker automation can be switched on.
export const STRATEGY_LAB_AUTOMATION = process.env.NEXT_PUBLIC_STRATEGY_LAB_AUTOMATION === "true";
