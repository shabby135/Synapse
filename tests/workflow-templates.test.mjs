import assert from "node:assert/strict";
import test from "node:test";

import {
  createActionConfiguration,
  workflowActionCatalog,
} from "../src/features/workflow/workflow-node-catalog.ts";
import {
  createWorkflowTemplateDefinition,
  workflowTemplates,
} from "../src/features/workflow/workflow-templates.ts";
import {
  validateWorkflowDraft,
} from "../src/features/workflow/validate-workflow.ts";

test("registers unique workflow actions with matching defaults", () => {
  const actionTypes =
    workflowActionCatalog.map(
      (action) =>
        action.actionType
    );

  assert.equal(
    new Set(actionTypes).size,
    actionTypes.length
  );

  for (
    const action of
    workflowActionCatalog
  ) {
    assert.equal(
      createActionConfiguration(
        action.actionType
      ).actionType,
      action.actionType
    );
  }
});

test("creates every template as a valid editable workflow draft", () => {
  for (
    const template of
    workflowTemplates
  ) {
    const definition =
      createWorkflowTemplateDefinition(
        template.id
      );

    assert.deepEqual(
      validateWorkflowDraft(
        definition.nodes,
        definition.edges
      ),
      {
        valid: true,
      }
    );

    assert.equal(
      definition.nodes.filter(
        (node) =>
          node.type === "trigger"
      ).length,
      1
    );

    assert.equal(
      definition.edges.length,
      definition.nodes.length - 1
    );
  }
});

test("returns fresh template definitions that can be edited independently", () => {
  const first =
    createWorkflowTemplateDefinition(
      "FORM_AI_SLACK"
    );

  const second =
    createWorkflowTemplateDefinition(
      "FORM_AI_SLACK"
    );

  first.nodes[0].data.label =
    "Changed trigger";

  first.nodes[1].data.configuration = {
    actionType: "NO_OP",
  };

  assert.equal(
    second.nodes[0].data.label,
    "New form response"
  );

  assert.equal(
    second.nodes[1].data
      .configuration?.actionType,
    "AI_PROMPT"
  );
});