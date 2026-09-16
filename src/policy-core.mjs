// Pure policy logic: no file system, no parser, no clock, no environment.
//
// The reference service imports this on the server side, before anything is indexed or
// returned. Nothing in a browser is asked to enforce any of it.

/** Read a field that may be a bare value or a {value, status} pair. */
export function value(field) {
  if (field == null) return null;
  if (typeof field === 'object') return field.value ?? null;
  return field;
}

/** A governance field counts as known only if it has a value and is not marked unknown. */
export function isKnown(field) {
  if (field == null) return false;
  if (typeof field === 'object') {
    if (field.status === 'unknown') return false;
    return field.value != null && field.value !== '';
  }
  return field !== '';
}

/** Each predicate returns true when the rule fires, meaning the item is withheld. */
export const PREDICATES = {
  confidentiality_in: (item, ctx, params) => (params?.values ?? []).includes(item.confidentiality),

  required_metadata_unknown: (item, ctx, params) =>
    (params?.fields ?? []).some((f) => !isKnown(item[f])),

  approval_status_not_in: (item, ctx, params) =>
    !(params?.values ?? []).includes(item.approval_status),

  // An approval is given to a version. If the content has moved, the approval does not follow it.
  version_drift: (item) =>
    item.approval_status === 'approved' &&
    Boolean(item.approved_content_hash) &&
    item.content_hash !== item.approved_content_hash,

  flag_is_true: (item, ctx, params) => item[params.field] === true,

  withdrawn_on_or_before: (item, ctx) =>
    Boolean(item.withdrawn_at) && new Date(item.withdrawn_at) <= new Date(ctx.today),

  review_date_older_than: (item, ctx, params) => {
    const scope = params?.applies_to_permissions;
    if (scope && !scope.includes(item.permission)) return false;
    const d = value(item.review_date);
    if (!d) return false; // absence is R2's business, not this rule's
    const limit = new Date(ctx.today);
    limit.setMonth(limit.getMonth() - (params?.months ?? 18));
    return new Date(d) < limit;
  },

  audience_not_granted: (item, ctx) => !(ctx.role?.audiences ?? []).includes(item.audience),
};

/** An exception counts only if it names the rule and the item, has an approver, and has not expired. */
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
 * May this item be published to this role, today?
 * The first rule that fires wins, so a reader is told the strongest reason rather than a list.
 */
export function decide(policy, item, roleName, today) {
  const role = policy.roles[roleName];
  if (!role) throw new Error(`unknown role: ${roleName}`);
  const ctx = { role: { name: roleName, ...role }, today };
  for (const rule of policy.rules) {
    const predicate = PREDICATES[rule.predicate];
    if (!predicate) throw new Error(`rule ${rule.id} has no implemented predicate`);
    if (!predicate(item, ctx, rule.params)) continue;
    if (exceptionFor(policy, item, rule, today)) continue;
    return { allowed: false, rule: rule.id, reason: rule.reason.trim() };
  }
  return { allowed: true, rule: null, reason: null };
}

/** The published corpus for one role: what this identity may see, and nothing else. */
export function publishedFor(policy, items, roleName, today) {
  return items.filter((item) => decide(policy, item, roleName, today).allowed);
}

/** Everything withheld, with the rule that stopped it. Used by the log and the review queue. */
export function withheldFor(policy, items, roleName, today) {
  return items
    .map((item) => ({ item, decision: decide(policy, item, roleName, today) }))
    .filter((x) => !x.decision.allowed)
    .map((x) => ({ id: x.item.id, title: x.item.title, rule: x.decision.rule }));
}

/** May this identity approve anything at all? Asked on the server, never in a browser. */
export function mayApprove(policy, roleName) {
  return Boolean(policy.roles[roleName]?.may_approve);
}
