<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/curviate-lockup-horizontal-dark.png">
    <img src="assets/curviate-lockup-horizontal-light.png" width="360" alt="Curviate">
  </picture>
</p>

<p align="center">
  <strong>Agent skills for LinkedIn work, driven through the Curviate CLI.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/claude_code-plugin-6B6B70?style=flat-square&labelColor=0A0A0F&logo=claude&logoColor=white" alt="Claude Code plugin">
  <img src="https://img.shields.io/badge/skills-9-E8352F?style=flat-square&labelColor=0A0A0F" alt="9 skills">
  <img src="https://img.shields.io/badge/license-mit-6B6B70?style=flat-square&labelColor=0A0A0F&logo=opensourceinitiative&logoColor=white" alt="MIT license">
</p>

<p align="center">
  <a href="https://docs.curviate.com/reference/cli/agent-skills">Docs</a>
  &nbsp;&middot;&nbsp;
  <a href="https://curviate.com">Website</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/curviate/curviate-cli">CLI</a>
</p>

<br>

Curviate is a LinkedIn API for agents. This plugin teaches a coding agent how to drive it: which
command answers which task, the traps that cost a run, and the exit codes to branch on. Ask for the
outcome, and the matching skill loads on its own.

## Quickstart

**1. Add the plugin** in Claude Code:

```
/plugin marketplace add curviate/curviate-plugin
/plugin install curviate@curviate
```

**2. Install the CLI.** The plugin does not bundle it:

```bash
npm install -g @curviate/cli
```

**3. Ask your agent to set Curviate up.** The `curviate-quickstart` skill takes it from there:
authenticate this machine, connect a LinkedIn account, and prove the path works with a read. It
only reads: nothing is posted, sent or changed on LinkedIn.

> Set up Curviate and check that my LinkedIn account is connected.

## The skills

| Skill | Covers |
|---|---|
| `curviate` | Start here: which skill answers which task, and the rules that apply everywhere. |
| `curviate-quickstart` | The first run: install, authenticate, connect an account, prove it works. |
| `curviate-profile` | Member profiles, company pages, filter-id resolution, retrieval mode. |
| `curviate-search` | People, companies, posts, jobs, service providers and groups. |
| `curviate-inbox` | Chats, messages, InMail, company-page inboxes, message events. |
| `curviate-engage` | Posts, comments, reactions, the home feed and notifications. |
| `curviate-network` | Connection invitations, follows, relations and followers. |
| `curviate-jobs` | Job postings, budgets, publishing and applicants. |
| `curviate-premium` | Sales Navigator and Recruiter, and what can refuse them. |

## Other agents

The skills are plain Markdown with a short frontmatter block, under
[`curviate/skills/`](./curviate/skills/). Load them the way your agent loads instructions, and start
it on `curviate-quickstart`. Agents that discover skills over HTTP can read the published catalog
at <https://docs.curviate.com/.well-known/skills/index.json>.

## Learn more

- [Agent skills](https://docs.curviate.com/reference/cli/agent-skills): how the skills relate to the CLI, and the catalog
- [CLI reference](https://docs.curviate.com/reference/cli/quick-start): every command, flag and exit code
- [Install the CLI from an agent session](https://curviate.com/INSTALL.md)

## Contributing

Each area skill ends in a **Full command surface** table read mechanically from the CLI's own
`--help`. Everything above that table is hand-written, and the generator never touches it. The CLI
version the tables come from is pinned in [`package.json`](./package.json).

```bash
npm install          # installs the pinned CLI
npm run generate     # rewrites the tables between the markers
npm run check        # fails if the committed tables drift from the generator
npm run check:copy   # fails on an em or en dash in any tracked file
```

## License

MIT. See [LICENSE](./LICENSE).
