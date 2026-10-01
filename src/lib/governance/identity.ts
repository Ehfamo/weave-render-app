/** Adapter contract only. No OIDC/SAML/SCIM assertion is trusted without verified server evidence. */
export interface EnterpriseIdentityEvidence {
  protocol: "OIDC" | "SAML" | "SCIM";
  workspaceId: string;
  subject: string;
  domainVerified: boolean;
  signatureVerified: boolean;
  issuerVerified: boolean;
  expiresAt: string;
}
export function enforceIdentitySession(
  evidence: EnterpriseIdentityEvidence | undefined,
  workspaceId: string,
  now = Date.now(),
) {
  if (!evidence) throw Error("IDENTITY_NOT_CONFIGURED");
  if (
    evidence.workspaceId !== workspaceId ||
    !evidence.subject ||
    !evidence.domainVerified ||
    !evidence.signatureVerified ||
    !evidence.issuerVerified ||
    !Number.isFinite(Date.parse(evidence.expiresAt)) ||
    Date.parse(evidence.expiresAt) <= now
  )
    throw Error("IDENTITY_NOT_VERIFIED");
  return { subject: evidence.subject, workspaceId };
}
