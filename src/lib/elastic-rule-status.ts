import { elasticFetch } from "./elastic-fetch";

// PATCH-toggles enabled/disabled on an existing Elastic detection rule.
// Used both when push-elastic disables a rule it's duplicating over, and by
// the pause/resume rule actions.
export async function setElasticRuleEnabled(
  baseUrl: string,
  spacePrefix: string,
  apiKey: string,
  ruleId: string,
  enabled: boolean,
  verifySsl: boolean
): Promise<boolean> {
  try {
    const res = await elasticFetch(
      `${baseUrl}${spacePrefix}/api/detection_engine/rules`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${apiKey}`,
          "kbn-xsrf": "true",
        },
        body: JSON.stringify({ rule_id: ruleId, enabled }),
        timeoutMs: 10000,
      },
      verifySsl
    );
    return res.ok;
  } catch {
    return false;
  }
}
