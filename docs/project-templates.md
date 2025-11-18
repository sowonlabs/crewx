# Project Templates

Start new CrewX projects with pre-configured templates from Git repositories.

## Quick Start

```bash
# 1. Create project directory
mkdir my-wbs-bot && cd my-wbs-bot

# 2. Download template
crewx template init wbs-automation

# 3. Done! Edit crewx.yaml and run
```

## Available Commands

### List Templates
```bash
crewx template list
```

Shows available templates from the repository.

### Show Template Details
```bash
crewx template show wbs-automation
```

View template description, features, and included files.

### Initialize Template
```bash
crewx template init <template-name>
```

Downloads template files to **current directory**.

## Available Templates

### wbs-automation
WBS (Work Breakdown Structure) automation template

**Features:**
- Coordinator agent for task tracking
- Automated progress monitoring
- Git integration
- 5-minute loop script

**Files:**
- `crewx.yaml` - Agent configuration
- `wbs.md` - WBS document template
- `wbs-loop.sh` - Automation script
- `README.md` - Setup guide

## Custom Template Repository

Use your own template repository with environment variable:

```bash
# Set custom repository (must be public GitHub)
export CREWX_TEMPLATE_REPO=https://github.com/mycompany/crewx-templates

# Templates now come from your repository
crewx template init wbs-automation
```

### Company Template Setup

```bash
# 1. Fork official templates
git clone https://github.com/sowonlabs/crewx-templates
cd crewx-templates

# 2. Customize for your company
# Edit templates, add company standards, etc.

# 3. Push to company GitHub
git remote add company https://github.com/mycompany/crewx-templates
git push company main

# 4. Team members use company templates
export CREWX_TEMPLATE_REPO=https://github.com/mycompany/crewx-templates
crewx template init wbs-automation
```

**Requirements:**
- Repository must be **publicly accessible** on GitHub
- Templates must be in root-level directories
- Each template needs `crewx.yaml` with metadata

## Template Structure

```
your-templates/
├── wbs-automation/
│   ├── crewx.yaml       # Required: metadata + agent config
│   ├── wbs.md
│   ├── wbs-loop.sh
│   └── README.md
├── my-template/
│   ├── crewx.yaml       # Required
│   └── ...
```

### crewx.yaml Metadata

```yaml
metadata:
  name: "my-template"
  displayName: "My Template"
  description: "Template description"
  version: "1.0.0"

agents:
  - id: my_agent
    # ... agent configuration
```

## Tips

✅ **DO:**
- Create project directory first (`mkdir my-project && cd my-project`)
- Review generated files before using
- Keep templates in Git for versioning

❌ **DON'T:**
- Run `init` in existing project (overwrites files)
- Use private repositories (not supported yet)

## See Also

- [CLI Guide](cli-guide.md) - Full command reference
- [Agent Configuration](agent-configuration.md) - Configure agents
- [Templates](templates.md) - Handlebars template system
