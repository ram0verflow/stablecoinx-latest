"""
Small, deliberately-limited YAML policy DSL. Each team writes their own
rules in this schema; nothing here is a general expression language —
every supported `when` key and `action` value is enumerated below and
validated on save, so a bad policy fails loudly at save time instead of
silently misbehaving at evaluation time.

Schema:

    team: acme-treasury      # optional — informational only, the team is
                             # identified by URL/DB, not by this field
    version: 1               # optional — informational
    rules:
      - name: block-sanctioned-corridor      # required, unique per policy
        description: "..."                   # optional
        priority: 100                        # optional, default 0 — higher
                                              # evaluates first; first match wins
        when:                                # required, at least one key
          destination_country: [Iran, "North Korea"]   # str or list
          source_country: Singapore                     # str or list
          token: [USDT, USDC]                            # str or list
          purpose: "Treasury Transfer"                   # str or list
          chain_in: [Tron]                                # matches source OR destination chain
          amount_gt: 100000                               # numeric compare
          amount_gte: 100000
          amount_lt: 100000
          amount_lte: 100000
        action: block                          # required — see ACTIONS
"""

from __future__ import annotations

from typing import Any, Dict, List

import yaml

ACTIONS = {"block", "enhanced_review", "require_dual_approval", "allow"}
WHEN_KEYS = {
    "source_country", "destination_country", "token", "purpose",
    "urgency", "chain_in", "amount_gt", "amount_gte", "amount_lt", "amount_lte",
}
NUMERIC_WHEN_KEYS = {"amount_gt", "amount_gte", "amount_lt", "amount_lte"}


class PolicyParseError(ValueError):
    pass


def parse_policy_yaml(yaml_text: str) -> Dict[str, Any]:
    """Parses and validates a team's policy YAML. Raises PolicyParseError
    with a specific, actionable message on any schema violation — never
    silently drops or reinterprets a malformed rule."""
    try:
        doc = yaml.safe_load(yaml_text)
    except yaml.YAMLError as exc:
        raise PolicyParseError(f"Invalid YAML syntax: {exc}") from exc

    if doc is None:
        raise PolicyParseError("Policy YAML is empty.")
    if not isinstance(doc, dict):
        raise PolicyParseError("Policy YAML must be a mapping at the top level (team/version/rules).")

    rules = doc.get("rules")
    if not isinstance(rules, list) or not rules:
        raise PolicyParseError("Policy must define a non-empty 'rules' list.")

    seen_names: set = set()
    parsed_rules: List[Dict[str, Any]] = []

    for idx, rule in enumerate(rules):
        if not isinstance(rule, dict):
            raise PolicyParseError(f"rules[{idx}] must be a mapping.")

        name = rule.get("name")
        if not name or not isinstance(name, str):
            raise PolicyParseError(f"rules[{idx}] is missing a required string 'name'.")
        if name in seen_names:
            raise PolicyParseError(f"Duplicate rule name '{name}' — rule names must be unique within a policy.")
        seen_names.add(name)

        action = rule.get("action")
        if action not in ACTIONS:
            raise PolicyParseError(
                f"rules[{idx}] ('{name}') has invalid action '{action}' — must be one of {sorted(ACTIONS)}."
            )

        when = rule.get("when")
        if not isinstance(when, dict) or not when:
            raise PolicyParseError(f"rules[{idx}] ('{name}') must have a non-empty 'when' mapping.")

        unknown_keys = set(when.keys()) - WHEN_KEYS
        if unknown_keys:
            raise PolicyParseError(
                f"rules[{idx}] ('{name}') uses unsupported when-key(s) {sorted(unknown_keys)} — "
                f"supported keys are {sorted(WHEN_KEYS)}."
            )

        for key in NUMERIC_WHEN_KEYS & set(when.keys()):
            if not isinstance(when[key], (int, float)) or isinstance(when[key], bool):
                raise PolicyParseError(f"rules[{idx}] ('{name}') when.{key} must be a number.")

        priority = rule.get("priority", 0)
        if not isinstance(priority, (int, float)) or isinstance(priority, bool):
            raise PolicyParseError(f"rules[{idx}] ('{name}') priority must be a number.")

        parsed_rules.append({
            "name": name,
            "description": rule.get("description") or "",
            "priority": priority,
            "when": when,
            "action": action,
        })

    parsed_rules.sort(key=lambda r: r["priority"], reverse=True)

    return {
        "team": doc.get("team"),
        "version": doc.get("version"),
        "rules": parsed_rules,
    }
