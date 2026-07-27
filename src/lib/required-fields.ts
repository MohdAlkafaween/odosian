// Required Fields are meant to be exactly the ECS field names a detection
// query actually references — not something a user should be free-typing,
// since that can drift from the real query and become meaningless. This
// derives them straight from the query text instead, the same way Kibana
// itself computes them.

const ECS_FIELD_TYPES: Record<string, string> = {
  "@timestamp": "date",
  "event.action": "keyword",
  "event.category": "keyword",
  "event.type": "keyword",
  "event.outcome": "keyword",
  "event.dataset": "keyword",
  "event.provider": "keyword",
  "event.ingested": "date",
  "event.code": "keyword",
  "host.name": "keyword",
  "host.os.type": "keyword",
  "host.os.name": "keyword",
  "host.os.family": "keyword",
  "user.name": "keyword",
  "user.id": "keyword",
  "user.domain": "keyword",
  "source.ip": "ip",
  "source.port": "long",
  "destination.ip": "ip",
  "destination.port": "long",
  "process.name": "keyword",
  "process.executable": "keyword",
  "process.command_line": "keyword",
  "process.pid": "long",
  "process.args": "keyword",
  "process.parent.name": "keyword",
  "process.parent.executable": "keyword",
  "process.parent.args": "keyword",
  "process.parent.command_line": "keyword",
  "process.parent.pid": "long",
  "file.path": "keyword",
  "file.name": "keyword",
  "file.extension": "keyword",
  "file.hash.sha256": "keyword",
  "file.hash.md5": "keyword",
  "dns.question.name": "keyword",
  "url.full": "keyword",
  "url.domain": "keyword",
  "network.protocol": "keyword",
  "network.direction": "keyword",
  "winlog.event_id": "keyword",
  "winlog.channel": "keyword",
  "registry.path": "keyword",
  "registry.value": "keyword",
  "cloud.provider": "keyword",
  "cloud.account.id": "keyword",
  "aws.cloudtrail.event_name": "keyword",
};

// Matches ECS-style dotted identifiers: word.word(.word)+
const FIELD_TOKEN_RE = /\b[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+\b/g;

// Boolean/query-language keywords that never denote a field, even though
// they can appear in a dotted-looking sequence next to real ones.
const NOT_A_FIELD = new Set(["and", "or", "not", "true", "false", "null"]);

// Strips quoted string literals ("cmd.exe", 'foo.bar') before scanning —
// otherwise a comparison *value* that happens to look dotted (a filename,
// a domain) gets mistaken for a field reference.
const QUOTED_STRING_RE = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;

export function deriveRequiredFields(query: string): { name: string; type: string }[] {
  if (!query) return [];
  const withoutLiterals = query.replace(QUOTED_STRING_RE, " ");
  const matches = withoutLiterals.match(FIELD_TOKEN_RE) || [];
  const seen = new Map<string, string>();
  for (const raw of matches) {
    if (NOT_A_FIELD.has(raw.toLowerCase())) continue;
    if (seen.has(raw)) continue;
    seen.set(raw, ECS_FIELD_TYPES[raw] || "keyword");
  }
  return Array.from(seen.entries()).map(([name, type]) => ({ name, type }));
}
