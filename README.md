# Curviate agent skills

The official skills library for driving LinkedIn work with the [Curviate](https://curviate.com) CLI.

Curviate is a LinkedIn API for agents. This repository is the single source of truth for how an
agent should drive it: the command surface, the traps that cost a run, and the exit codes to branch
on.

## Install

In Claude Code:

```
/plugin marketplace add curviate/curviate-plugin
/plugin install curviate@curviate
```

The plugin does not vendor the CLI. Install that from npm:

```bash
npm install -g @curviate/cli
```

Any other agent can read the skills directly — they are plain Markdown under
[`curviate/skills/`](./curviate/skills/).

## The skills

| Skill | Covers |
|---|---|
| `curviate-profile` | Profiles, companies, filter-id resolution, retrieval mode. |
| `curviate-search` | People, companies, posts, jobs, services and groups search. |
| `curviate-inbox` | Chats, messages, InMail, company-page inboxes, retrieval mode. |
| `curviate-engage` | Posts, comments, reactions, the home feed and notifications. |
| `curviate-network` | Connection invitations, follows, relations and followers. |
| `curviate-jobs` | Job postings, budgets, publishing and applicants. |
| `curviate-premium` | Sales Navigator and Recruiter. |

## Documentation

- API and CLI reference: <https://docs.curviate.com>
- Install the CLI in an agent session: <https://curviate.com/INSTALL.md>

## Licence

MIT. See [LICENSE](./LICENSE).
