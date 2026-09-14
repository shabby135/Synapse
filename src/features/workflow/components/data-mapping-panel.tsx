"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { configurationForPublish, getAncestorNodeIds, parseReference } from "../data-mapping";
import type { WorkflowCanvasEdge, WorkflowCanvasNode } from "../types";

type Props = {
  node: WorkflowCanvasNode;
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
};

export function DataMappingPanel({ node, nodes, edges }: Props) {
  const [source, setSource] = useState("input");
  const [path, setPath] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const ancestors = getAncestorNodeIds(node.id, edges);
  const sources = [
    { value: "input", label: "This action’s input" },
    { value: "trigger", label: "Original trigger data" },
    ...nodes.filter((item) => item.type === "action" && ancestors.has(item.id)).map((item) => ({
      value: `nodes[${JSON.stringify(item.id)}]`, label: item.data.label,
    })),
  ];
  const selectedSource = sources.some((item) => item.value === source) ? source : "input";
  const suffix = path.trim();
  const expression = selectedSource + (suffix ? (suffix.startsWith("[") ? "" : ".") + suffix : "");
  const reference = `{{${expression}}}`;
  let referenceError = "";
  let configurationError = "";
  try { parseReference(expression); } catch (error) {
    referenceError = error instanceof Error ? error.message : "Invalid reference.";
  }
  try { configurationForPublish(node.data.configuration ?? {}, ancestors); } catch (error) {
    configurationError = error instanceof Error ? error.message : "Invalid data mapping.";
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopyMessage("Copied. Paste it into the action field you want to map.");
    } catch {
      setCopyMessage("Copy the reference shown above manually.");
    }
  }

  return (
    <section className="space-y-3 rounded-md border p-3" aria-label="Data mapping">
      <h4 className="text-sm font-medium">Use data from earlier steps</h4>
      <label htmlFor="mapping-source" className="block text-xs text-muted-foreground">Data source</label>
      <select id="mapping-source" value={selectedSource}
        onChange={(event) => { setSource(event.target.value); setCopyMessage(""); }}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm">
        {sources.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <label htmlFor="mapping-path" className="block text-xs text-muted-foreground">Field path (leave empty for all data)</label>
      <Input id="mapping-path" value={path} placeholder="message, text, or body.items[0].name"
        onChange={(event) => { setPath(event.target.value); setCopyMessage(""); }} />
      <code className="block break-all rounded bg-muted p-2 text-xs select-all">{reference}</code>
      {referenceError && <p role="alert" className="text-xs text-destructive">{referenceError}</p>}
      <Button type="button" size="sm" variant="outline" disabled={!!referenceError} onClick={copyReference}>
        Copy reference
      </Button>
      {copyMessage && <p role="status" className="text-xs text-muted-foreground">{copyMessage}</p>}
      <p className="text-xs text-muted-foreground">
        AI responses expose text. HTTP responses expose body and status. Trigger fields match your submitted JSON.
        At a merge, input contains dependencies keyed by node ID.
      </p>
      <p className="text-xs text-muted-foreground">
        Paste references into prompts, messages, HTTP URLs, bodies, or header values.
        In a JSON body, quote a reference as a value; a whole reference preserves its data type.
        Integration and model selections stay fixed.
      </p>
      {configurationError && <p role="alert" className="text-xs text-destructive">{configurationError}</p>}
    </section>
  );
}
