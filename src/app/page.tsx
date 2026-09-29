import {
  headers,
} from "next/headers";
import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  GitBranch,
  Mail,
  MessageSquare,
  Play,
  Sheet,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

import { auth } from "@/lib/auth";

const integrations = [
  {
    name: "Google Forms",
    description:
      "Trigger workflows from new responses.",
    icon: Sheet,
    color:
      "bg-violet-500/10 text-violet-600",
  },
  {
    name: "Gmail",
    description:
      "Receive and send workflow emails.",
    icon: Mail,
    color:
      "bg-red-500/10 text-red-600",
  },
  {
    name: "Slack",
    description:
      "Send automated team notifications.",
    icon: MessageSquare,
    color:
      "bg-fuchsia-500/10 text-fuchsia-600",
  },
  {
    name: "Google Calendar",
    description:
      "Detect and create calendar events.",
    icon: CalendarDays,
    color:
      "bg-blue-500/10 text-blue-600",
  },
  {
    name: "GitHub",
    description:
      "Automate issue-based development tasks.",
    icon: GitBranch,
    color:
      "bg-zinc-900/10 text-zinc-900",
  },
  {
    name: "AI models",
    description:
      "Generate, classify and extract data.",
    icon: Bot,
    color:
      "bg-emerald-500/10 text-emerald-600",
  },
] as const;

const templates = [
  {
    name: "Form response triage",
    description:
      "Classify a Google Forms response with AI and notify Slack.",
    steps: [
      "Google Forms",
      "AI Prompt",
      "Slack",
    ],
  },
  {
    name: "Email to task",
    description:
      "Summarize a Gmail message and create a Trello card.",
    steps: [
      "Gmail",
      "AI Prompt",
      "Trello",
    ],
  },
  {
    name: "Issue escalation",
    description:
      "Copy new GitHub issues into a Jira project.",
    steps: [
      "GitHub",
      "Jira",
    ],
  },
] as const;

const workflowSteps = [
  {
    number: "01",
    title: "Choose a trigger",
    description:
      "Start manually or from Gmail, Google Forms, Calendar, Sheets, GitHub, Jira or Trello.",
  },
  {
    number: "02",
    title: "Add actions and AI",
    description:
      "Map data between steps, call AI models and send results to your connected tools.",
  },
  {
    number: "03",
    title: "Publish and monitor",
    description:
      "Run reliably with retries, execution logs, version history and usage tracking.",
  },
] as const;

export default async function Home() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div
      className="min-h-screen bg-white text-zinc-950"
      style={{
        fontFamily:
          "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-950 text-white">
              <Workflow className="size-5" />
            </span>

            <span className="text-lg font-bold tracking-tight">
              Synapse
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-zinc-600 md:flex">
            <a
              href="#features"
              className="transition hover:text-zinc-950"
            >
              Features
            </a>

            <a
              href="#integrations"
              className="transition hover:text-zinc-950"
            >
              Integrations
            </a>

            <a
              href="#templates"
              className="transition hover:text-zinc-950"
            >
              Templates
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 sm:inline-flex"
            >
              Sign in
            </Link>

            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-zinc-200">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-300px] size-[700px] -translate-x-1/2 rounded-full bg-violet-200/45 blur-3xl" />

            <div className="absolute right-[-200px] top-40 size-[450px] rounded-full bg-blue-100/70 blur-3xl" />
          </div>

          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
                <Sparkles className="size-4" />
                AI-powered workflow automation
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                Automate work without writing
                integration code.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600">
                Connect your tools, add AI,
                and build reliable workflows
                through a visual canvas.
                Synapse handles execution,
                retries, monitoring and
                credentials.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Build your first workflow
                  <ArrowRight className="size-4" />
                </Link>

                <Link
                  href="/sign-in"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                >
                  <Play className="size-4" />
                  Open dashboard
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-600">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Visual builder
                </span>

                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Secure integrations
                </span>

                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Reliable execution
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-3 shadow-2xl shadow-zinc-950/15">
                <div className="flex items-center justify-between border-b border-white/10 px-3 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="size-2.5 rounded-full bg-red-400" />
                      <span className="size-2.5 rounded-full bg-amber-400" />
                      <span className="size-2.5 rounded-full bg-emerald-400" />
                    </div>

                    <span className="ml-2 text-xs font-medium text-zinc-400">
                      Customer response
                      workflow
                    </span>
                  </div>

                  <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-400">
                    Active
                  </span>
                </div>

                <div className="relative min-h-[430px] overflow-hidden rounded-xl bg-[#101114]">
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle, #71717a 1px, transparent 1px)",
                      backgroundSize:
                        "22px 22px",
                    }}
                  />

                  <div className="absolute left-6 top-6 w-44 rounded-xl border border-white/10 bg-zinc-900 p-3 shadow-xl sm:left-10 sm:top-14 sm:w-52">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                        <Sheet className="size-4" />
                      </span>

                      <div>
                        <p className="text-sm font-semibold text-white">
                          New response
                        </p>

                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          Google Forms
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute left-[45%] top-[42%] h-px w-[15%] bg-gradient-to-r from-violet-500 to-blue-500" />

                  <div className="absolute right-6 top-[35%] w-44 rounded-xl border border-blue-500/40 bg-zinc-900 p-3 shadow-xl sm:right-10 sm:w-52">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                        <Bot className="size-4" />
                      </span>

                      <div>
                        <p className="text-sm font-semibold text-white">
                          Classify response
                        </p>

                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          AI prompt
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute right-[25%] top-[57%] h-16 w-px bg-gradient-to-b from-blue-500 to-fuchsia-500" />

                  <div className="absolute bottom-10 left-[28%] w-48 rounded-xl border border-fuchsia-500/40 bg-zinc-900 p-3 shadow-xl sm:left-[36%] sm:w-56">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-400">
                        <MessageSquare className="size-4" />
                      </span>

                      <div>
                        <p className="text-sm font-semibold text-white">
                          Notify the team
                        </p>

                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          Slack message
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-4 right-4 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-zinc-400 backdrop-blur">
                    Last run
                    <span className="ml-2 font-medium text-emerald-400">
                      Successful
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-5 -left-5 hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-xl sm:block">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Zap className="size-4" />
                  </span>

                  <div>
                    <p className="text-xs text-zinc-500">
                      Workflow completed
                    </p>

                    <p className="text-sm font-semibold">
                      1.8 seconds
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="border-b border-zinc-200 bg-zinc-50 py-20"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">
                How it works
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                From trigger to result in
                three steps
              </h2>

              <p className="mt-4 text-zinc-600">
                Build workflows visually while
                Synapse manages the difficult
                infrastructure behind them.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {workflowSteps.map(
                (item) => (
                  <article
                    key={item.number}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <span className="text-sm font-bold text-violet-600">
                      {item.number}
                    </span>

                    <h3 className="mt-5 text-lg font-semibold">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {item.description}
                    </p>
                  </article>
                )
              )}
            </div>
          </div>
        </section>

        <section
          id="integrations"
          className="py-20"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">
                  Integrations
                </p>

                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  Connect the tools you
                  already use
                </h2>
              </div>

              <p className="max-w-md text-sm leading-6 text-zinc-600">
                Securely connect communication,
                productivity, development and
                AI providers to one workflow.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrations.map(
                (integration) => {
                  const Icon =
                    integration.icon;

                  return (
                    <article
                      key={integration.name}
                      className="flex items-start gap-4 rounded-2xl border border-zinc-200 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <span
                        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${integration.color}`}
                      >
                        <Icon className="size-5" />
                      </span>

                      <div>
                        <h3 className="font-semibold">
                          {integration.name}
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-zinc-600">
                          {
                            integration.description
                          }
                        </p>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </div>
        </section>

        <section
          id="templates"
          className="border-y border-zinc-200 bg-zinc-950 py-20 text-white"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-400">
                Workflow templates
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Start with a working structure
              </h2>

              <p className="mt-4 leading-7 text-zinc-400">
                Choose a template, connect your
                own accounts and customize every
                step on the visual canvas.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {templates.map(
                (template) => (
                  <article
                    key={template.name}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                      <Workflow className="size-5" />
                    </div>

                    <h3 className="mt-5 text-lg font-semibold">
                      {template.name}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {template.description}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {template.steps.map(
                        (step, index) => (
                          <div
                            key={step}
                            className="flex items-center gap-2"
                          >
                            {index > 0 && (
                              <ArrowRight className="size-3 text-zinc-600" />
                            )}

                            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300">
                              {step}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <div className="overflow-hidden rounded-3xl bg-violet-600 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white/15">
                <ShieldCheck className="size-6" />
              </div>

              <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                Build your first automation
                today
              </h2>

              <p className="mx-auto mt-4 max-w-2xl leading-7 text-violet-100">
                Create a workspace, connect your
                tools and turn repetitive work
                into a reliable visual workflow.
              </p>

              <Link
                href="/sign-up"
                className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
              >
                Get started for free
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-zinc-500 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 text-white">
              <Workflow className="size-4" />
            </span>

            <span className="font-semibold text-zinc-800">
              Synapse
            </span>
          </div>

          <p>
            Visual AI workflow automation.
          </p>

          <div className="flex items-center gap-5">
            <Link
              href="/sign-in"
              className="transition hover:text-zinc-950"
            >
              Sign in
            </Link>

            <Link
              href="/sign-up"
              className="transition hover:text-zinc-950"
            >
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}