"""The externalities we ask Jev about. Each is a yes/no question over one diff hunk."""

QUESTIONS = {
    "network": "Does this code change make a network call or add a new outbound host?",
    "secrets": "Does this code change read environment variables, secrets, credentials or API keys?",
    "auth": "Does this code change touch authentication, sessions or permission checks?",
    "schema": "Does this code change alter a database schema, table or migration?",
    "filesystem": "Does this code change write files outside the project directory?",
    "dependency": "Does this code change add, remove or upgrade a third-party dependency?",
    "swallow": "Does this code change catch an exception and silently ignore it?",
    "public_api": "Does this code change alter a public function signature, route or API contract?",
    "logging": "Does this code change log or print a value that could be user data?",
    "background": "Does this code change start a background job, thread, timer or scheduled task?",
}

LABELS = {
    "network": "Network call is made",
    "secrets": "Secret or credential is read",
    "auth": "Auth or permissions change",
    "schema": "Database schema changes",
    "filesystem": "Files written outside project",
    "dependency": "Dependency added or changed",
    "swallow": "Exception is swallowed",
    "public_api": "Public API changes",
    "logging": "User data may be logged",
    "background": "Background task started",
}

BLAST_RADIUS = ["local", "module", "service", "system-wide"]


def request_questions() -> dict:
    qs = {k: {"type": "noul", "instructions": v} for k, v in QUESTIONS.items()}
    qs["blast_radius"] = {
        "type": "score",
        "instructions": "How far could a bug in this code change reach?",
        "criteria": BLAST_RADIUS,
    }
    return qs
