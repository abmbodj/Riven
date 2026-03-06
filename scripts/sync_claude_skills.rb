#!/usr/bin/env ruby

require "fileutils"
require "pathname"
require "set"
require "yaml"

SOURCE_ROOT = Pathname.new(".claude/skills").freeze
TARGET_ROOT = Pathname.new(".agents/skills").freeze

DESCRIPTION_OVERRIDES = {
  "imagen" => "Image generation with Google Gemini for UI assets, documentation, illustrations, icons, and visual concepts. Use when the user asks to generate an image or needs generated visual assets.",
  "spdd" => "Three-phase spec-driven development workflow that separates codebase research, implementation planning, and phased execution. Use when a complex task should move from research to spec to implementation in distinct steps.",
}.freeze

ACRONYMS = Set.new(%w[
  A11Y
  AB
  ADR
  API
  ASO
  AWS
  BDD
  CI
  CLI
  CORS
  CSS
  CSV
  DAG
  DB
  DDD
  DNS
  ETL
  GH
  GCP
  HTML
  HTTP
  HTTPS
  ID
  JWT
  LLM
  MCP
  ML
  MFA
  OCR
  OIDC
  OOXML
  PDF
  PR
  PRD
  QA
  RAG
  RBAC
  REST
  SDK
  SEO
  SLI
  SLO
  SMTP
  SMS
  SPDD
  SQL
  SSH
  SSO
  SSR
  SSRF
  SVG
  TDD
  UI
  URL
  UX
  XML
  XSS
  YAML
]).freeze

BRANDS = {
  "airtable" => "Airtable",
  "algolia" => "Algolia",
  "android" => "Android",
  "anthropic" => "Anthropic",
  "asana" => "Asana",
  "avalonia" => "Avalonia",
  "azure" => "Azure",
  "bash" => "Bash",
  "bigquery" => "BigQuery",
  "bitbucket" => "Bitbucket",
  "clickhouse" => "ClickHouse",
  "claude" => "Claude",
  "codex" => "Codex",
  "contentful" => "Contentful",
  "datadog" => "DataDog",
  "discord" => "Discord",
  "django" => "Django",
  "docx" => "DOCX",
  "dropbox" => "Dropbox",
  "expo" => "Expo",
  "fastapi" => "FastAPI",
  "ffuf" => "FFUF",
  "ffmpeg" => "FFmpeg",
  "figma" => "Figma",
  "firestore" => "Firestore",
  "gcp" => "GCP",
  "github" => "GitHub",
  "gitlab" => "GitLab",
  "grafana" => "Grafana",
  "grpc" => "gRPC",
  "hubspot" => "HubSpot",
  "ios" => "iOS",
  "javascript" => "JavaScript",
  "kafka" => "Kafka",
  "kubernetes" => "Kubernetes",
  "mailchimp" => "Mailchimp",
  "markdown" => "Markdown",
  "mixpanel" => "Mixpanel",
  "mongodb" => "MongoDB",
  "mysql" => "MySQL",
  "nextjs" => "Next.js",
  "nginx" => "Nginx",
  "nodejs" => "Node.js",
  "notion" => "Notion",
  "oauth" => "OAuth",
  "openai" => "OpenAI",
  "openapi" => "OpenAPI",
  "pagerduty" => "PagerDuty",
  "postgres" => "Postgres",
  "postgresql" => "PostgreSQL",
  "python" => "Python",
  "react" => "React",
  "redis" => "Redis",
  "remotion" => "Remotion",
  "rust" => "Rust",
  "seo" => "SEO",
  "slack" => "Slack",
  "sqlite" => "SQLite",
  "storybook" => "Storybook",
  "stripe" => "Stripe",
  "supabase" => "Supabase",
  "svelte" => "Svelte",
  "swiftui" => "SwiftUI",
  "tailwind" => "Tailwind",
  "terraform" => "Terraform",
  "trello" => "Trello",
  "twilio" => "Twilio",
  "typescript" => "TypeScript",
  "vercel" => "Vercel",
  "vite" => "Vite",
  "vue" => "Vue",
  "webflow" => "Webflow",
  "whatsapp" => "WhatsApp",
  "wordpress" => "WordPress",
  "xlsx" => "XLSX",
  "youtube" => "YouTube",
  "zapier" => "Zapier",
}.freeze

SMALL_WORDS = Set.new(%w[and or to up with for in of on by from]).freeze

SPDD_BODY = <<~MARKDOWN
  # SPDD

  Use this skill for a three-phase spec-driven workflow: research the current codebase, write the implementation spec, then execute the approved plan.

  ## Workflow

  1. Read `1-research.md` to document the current system without proposing changes.
  2. Read `2-spec.md` to turn the research into a phased implementation plan.
  3. Read `3-implementation.md` to execute the approved plan phase by phase.

  ## Phase Files

  - `1-research.md`: Research-only instructions for mapping the existing system.
  - `2-spec.md`: Planning instructions for producing the implementation spec.
  - `3-implementation.md`: Execution instructions for carrying out the approved spec.

  ## Operating Rules

  - Keep the three phases separate.
  - Do not skip straight to implementation on complex work.
  - Stop and report mismatches between the spec and the code instead of guessing.
MARKDOWN

def normalize_skill_name(name)
  name.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/^-+|-+$/, "").gsub(/-+/, "-")
end

def normalize_newlines(text)
  text.to_s.gsub(/\r\n?/, "\n")
end

def split_frontmatter(text)
  normalized = normalize_newlines(text)
  match = normalized.match(/\A---\n(.*?)\n---\n?/m)
  if match
    [match[1], normalized.sub(/\A---\n.*?\n---\n?/m, "")]
  else
    [nil, normalized]
  end
end

def parse_frontmatter(frontmatter_text)
  return {} unless frontmatter_text

  parsed = YAML.load(frontmatter_text)
  parsed.is_a?(Hash) ? parsed : {}
rescue StandardError
  {}
end

def sanitize_description(description)
  clean = normalize_newlines(description)
  clean = clean.gsub(/<=\s*/, "less than or equal to ")
  clean = clean.gsub(/>=\s*/, "greater than or equal to ")
  clean = clean.gsub(/<\s*/, "less than ")
  clean = clean.gsub(/>\s*/, "more than ")
  clean = clean.gsub(/[[:space:]]+/, " ").strip
  clean
end

def derive_description(skill_name, body)
  return DESCRIPTION_OVERRIDES.fetch(skill_name) if DESCRIPTION_OVERRIDES.key?(skill_name)

  in_code_block = false
  paragraph_lines = []
  normalize_newlines(body).each_line do |line|
    stripped = line.strip
    if stripped.start_with?("```")
      in_code_block = !in_code_block
      next
    end
    next if in_code_block
    next if stripped.empty?
    next if stripped.start_with?("#", ">", "|", "-", "*")

    paragraph_lines << stripped
    break if paragraph_lines.length >= 3
  end

  candidate = paragraph_lines.join(" ")
  candidate = candidate.gsub(/[[:space:]]+/, " ").strip
  return candidate unless candidate.empty?

  "Use when the user asks for help with #{skill_name.tr('-', ' ')} tasks."
end

def build_frontmatter(name, description)
  escaped = description.gsub("\\", "\\\\").gsub('"', '\"')
  <<~FRONTMATTER
    ---
    name: #{name}
    description: "#{escaped}"
    ---
  FRONTMATTER
end

def format_display_name(skill_name)
  words = skill_name.split("-").reject(&:empty?)
  words.each_with_index.map do |word, index|
    lower = word.downcase
    upper = word.upcase
    if ACRONYMS.include?(upper)
      upper
    elsif BRANDS.key?(lower)
      BRANDS.fetch(lower)
    elsif index.positive? && SMALL_WORDS.include?(lower)
      lower
    else
      word.capitalize
    end
  end.join(" ")
end

def short_description_for(display_name)
  description = "Help with #{display_name} tasks"
  description = "Help with #{display_name} tasks and workflows" if description.length < 25
  description = "Help with #{display_name} tasks with guidance" if description.length < 25
  description = "Help with #{display_name}" if description.length > 64
  description = "#{display_name} helper" if description.length > 64
  description = "#{display_name} tools" if description.length > 64

  if description.length > 64
    suffix = " helper"
    max_name_length = 64 - suffix.length
    description = "#{display_name[0, max_name_length].rstrip}#{suffix}"
  end

  if description.length < 25
    description = "#{description} workflows"
    description = description[0, 64].rstrip if description.length > 64
  end

  description
end

def yaml_quote(value)
  escaped = value.gsub("\\", "\\\\").gsub('"', '\"').gsub("\n", "\\n")
  %("#{escaped}")
end

def write_openai_yaml(skill_dir, skill_name)
  display_name = format_display_name(skill_name)
  short_description = short_description_for(display_name)
  default_prompt = "Use $#{skill_name} to help with #{display_name} tasks."

  content = <<~YAML
    interface:
      display_name: #{yaml_quote(display_name)}
      short_description: #{yaml_quote(short_description)}
      default_prompt: #{yaml_quote(default_prompt)}
  YAML

  agents_dir = skill_dir + "agents"
  FileUtils.mkdir_p(agents_dir)
  path = agents_dir + "openai.yaml"
  path.write(content)
end

def sync_source_skill(source_dir, target_dir)
  source_path = source_dir.symlink? ? source_dir.realpath : source_dir

  begin
    return if target_dir.exist? && source_path.realpath == target_dir.realpath
  rescue StandardError
    nil
  end

  FileUtils.mkdir_p(target_dir)
  success = system("rsync", "-a", "#{source_path}/", "#{target_dir}/")
  abort("rsync failed while syncing #{source_dir} to #{target_dir}") unless success
end

def rename_case_only_directory(legacy_dir, target_dir)
  return unless legacy_dir.directory?
  return unless legacy_dir.basename.to_s.casecmp?(target_dir.basename.to_s)
  return if legacy_dir.basename.to_s == target_dir.basename.to_s

  temp_dir = TARGET_ROOT + "__tmp-rename-#{target_dir.basename}-#{$$}"
  FileUtils.rm_rf(temp_dir)
  FileUtils.mv(legacy_dir, temp_dir)
  FileUtils.mv(temp_dir, target_dir)
end

def rewrite_skill(skill_dir, skill_name)
  skill_md = skill_dir + "SKILL.md"
  body =
    if skill_md.exist?
      frontmatter_text, current_body = split_frontmatter(skill_md.read)
      frontmatter = parse_frontmatter(frontmatter_text)
      description = sanitize_description(frontmatter["description"] || frontmatter[:description])
      description = sanitize_description(derive_description(skill_name, current_body)) if description.empty?
      [description, current_body.strip]
    elsif skill_name == "spdd"
      [DESCRIPTION_OVERRIDES.fetch("spdd"), SPDD_BODY.strip]
    else
      abort("Missing SKILL.md for #{skill_dir}")
    end

  description, skill_body = body
  content = +""
  content << build_frontmatter(skill_name, description)
  content << "\n"
  content << skill_body
  content << "\n"
  skill_md.write(content)
end

processed = 0
source_dirs = SOURCE_ROOT.children.select { |path| path.directory? || path.symlink? }.sort_by(&:to_s)
source_dirs.each do |source_dir|
  source_name = source_dir.basename.to_s
  skill_name = normalize_skill_name(source_name)
  skill_dir = TARGET_ROOT + skill_name
  legacy_dir = TARGET_ROOT + source_name

  rename_case_only_directory(legacy_dir, skill_dir)
  sync_source_skill(source_dir, skill_dir)
  rewrite_skill(skill_dir, skill_name)
  write_openai_yaml(skill_dir, skill_name)

  if legacy_dir != skill_dir && legacy_dir.directory? && legacy_dir.to_s.downcase != skill_dir.to_s.downcase
    FileUtils.rm_rf(legacy_dir)
  end

  processed += 1
end

puts "Synced and normalized #{processed} skills into #{TARGET_ROOT}"
