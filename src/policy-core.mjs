// Pure policy logic: no file system, no parser, no environment. The page in the browser and
// the tests in CI import this same module, so "the site runs the policy" is a fact rather
// than a claim.

/** Predicates. Each returns true when the rule fires (item is withheld). */
export const PREDICATES = {
  confidentiality_in: (item, ctx, params) =>
    (params?.values ?? []).includes(item.confidentiality),

  approval_status_not_in: (item, ctx, params) =>
    !(params?.values ?? []).includes(item.approval_status),

  flag_is_true: (item, ctx, params) => item[params.field] === true,

  permission_not_granted_to_role: (item, ctx) =>
    !(ctx.role?.grants ?? []).includes(item.permission),

  internal_without_review_date: (item) =>
    item.permission === 'internal' && !value(item.review_date),

  review_date_older_than: (item, ctx, params) => {
    const scope = params?.applies_to_permissions;
    if (scope && !scope.includes(item.permission)) return false;
    const d = value(item.review_date);
    if (!d) return false; // absence is handled by R5, not here
    const limit = new Date(ctx.today);
    limit.setMonth(limit.getMonth() - (params?.months ?? 18));
    return new Date(d) < limit;
  },

  attribution_missing: (item) => !value(item.attribution),
};

function value(field) {
  if (field == null) return null;
  if (typeof field === 'object') return field.value ?? null;
  return field;
}

/** An exception only counts if it names the rule and the item and has not expired. */
export function exceptionFor(policy, item, rule, today) {
  return (policy.exceptions ?? []).find(
    (e) =>
      e.item_id === item.id &&
      e.rule_id === rule.id &&
      e.approver &&
      e.expires &&
      new Date(e.expires) > new Date(today),
  );
}

/**
 * Decide whether one item may be retrieved by one role.
 * Returns { allowed, rule, reason, exception } — the first rule that withholds wins,
 * so the reason a reader sees is the strongest reason, not a list.
 */
export function decide(policy, item, roleName, today = '2026-09-16') {
  const role = policy.roles[roleName];
  if (!role) throw new Error(`unknown role: ${roleName}`);
  const ctx = { role: { name: roleName, ...role }, today };
  for (const rule of policy.rules) {
    const fired = PREDICATES[rule.predicate](item, ctx, rule.params);
    if (!fired) continue;
    const exception = exceptionFor(policy, item, rule, today);
    if (exception) continue;
    return { allowed: false, rule: rule.id, reason: rule.reason, exception: null };
  }
  return { allowed: true, rule: null, reason: null, exception: null };
}

/** Everything a role may retrieve, with the decision attached to each item. */
export function shareable(policy, items, roleName, today = '2026-09-16') {
  return items
    .map((item) => ({ item, decision: decide(policy, item, roleName, today) }))
    .filter((x) => x.decision.allowed)
    .map((x) => x.item);
}

/** Why each item was withheld, for the log and for the review queue. */
export function withheld(policy, items, roleName, today = '2026-09-16') {
  return items
    .map((item) => ({ item, decision: decide(policy, item, roleName, today) }))
    .filter((x) => !x.decision.allowed);
}
