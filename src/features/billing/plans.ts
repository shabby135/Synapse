export type BillingPlan =
  | "FREE"
  | "PRO";

export type SubscriptionStatus =
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "PAUSED";

export type PlanLimits = {
  workflowRunsPerMonth: number;
  actionExecutionsPerMonth: number;
  aiTokensPerMonth: number;
};

export const planLimits = {
  FREE: {
    workflowRunsPerMonth: 100,
    actionExecutionsPerMonth: 500,
    aiTokensPerMonth: 100_000,
  },

  PRO: {
    workflowRunsPerMonth: 10_000,
    actionExecutionsPerMonth: 50_000,
    aiTokensPerMonth: 5_000_000,
  },
} as const satisfies Record<
  BillingPlan,
  PlanLimits
>;

const activeSubscriptionStatuses =
  new Set<SubscriptionStatus>([
    "ACTIVE",
    "TRIALING",
  ]);

export function isSubscriptionActive(
  status:
    | SubscriptionStatus
    | null
    | undefined
): boolean {
  return (
    status !== null &&
    status !== undefined &&
    activeSubscriptionStatuses.has(
      status
    )
  );
}

export function getEffectivePlan({
  plan,
  status,
}: {
  plan?: BillingPlan | null;
  status?: SubscriptionStatus | null;
}): BillingPlan {
  if (
    plan === "PRO" &&
    isSubscriptionActive(status)
  ) {
    return "PRO";
  }

  return "FREE";
}

export function getPlanLimits(
  plan: BillingPlan
): PlanLimits {
  return planLimits[plan];
}