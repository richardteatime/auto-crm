import { describe, it, expect } from "vitest";
import {
  ContactSchema,
  DealSchema,
  LeadSchema,
  WorkflowSchema,
  CallTaskSchema,
} from "./schemas";
import { parseDoc } from "./parse-doc";

function mockDoc(fields: Record<string, unknown>) {
  return {
    $id: "test-id",
    $createdAt: "2026-06-01T10:00:00.000Z",
    $updatedAt: "2026-06-01T12:00:00.000Z",
    ...fields,
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("ContactSchema", () => {
  it("accepts a valid contact document", () => {
    const doc = mockDoc({
      name: "Leo",
      email: "leo@example.com",
      phone: "+39123456789",
      company: null,
      vatNumber: null,
      address: null,
      source: "website",
      temperature: "hot",
      notes: null,
    });
    const c = parseDoc(ContactSchema, doc);
    expect(c.name).toBe("Leo");
    expect(c.temperature).toBe("hot");
  });

  it("rejects invalid temperature", () => {
    const doc = mockDoc({
      name: "Leo",
      email: null,
      phone: null,
      company: null,
      vatNumber: null,
      address: null,
      source: "website",
      temperature: "freezing",
      notes: null,
    });
    expect(() => parseDoc(ContactSchema, doc)).toThrow();
  });
});

describe("DealSchema", () => {
  it("accepts a valid deal", () => {
    const doc = mockDoc({
      title: "Progetto X",
      value: 50000,
      stageId: "stage1",
      contactId: "contact1",
      probability: 50,
      notes: null,
      billingType: "una_tantum",
    });
    const d = parseDoc(DealSchema, doc);
    expect(d.title).toBe("Progetto X");
    expect(d.value).toBe(50000);
  });

  it("rejects invalid billingType", () => {
    const doc = mockDoc({
      title: "Progetto X",
      value: 50000,
      stageId: "stage1",
      contactId: "contact1",
      probability: 50,
      billingType: "weekly",
    });
    expect(() => parseDoc(DealSchema, doc)).toThrow();
  });
});

describe("LeadSchema", () => {
  it("accepts a valid lead", () => {
    const doc = mockDoc({
      firstName: "Mario",
      lastName: "Rossi",
      fullName: "Mario Rossi",
      email: "mario@example.com",
      phone: null,
      company: null,
      businessName: null,
      website: null,
      projectType: null,
      category: "crm",
      source: "formulario",
      formName: null,
      message: null,
      rawSubject: null,
      rawBody: null,
      customFields: null,
      status: "new",
      pipelineStage: "prospect",
      assignedTo: null,
      leadScore: 0,
      contactId: null,
    });
    const l = parseDoc(LeadSchema, doc);
    expect(l.fullName).toBe("Mario Rossi");
    expect(l.status).toBe("new");
  });

  it("rejects invalid status", () => {
    const doc = mockDoc({
      firstName: null,
      lastName: null,
      fullName: "X",
      email: null,
      phone: null,
      company: null,
      businessName: null,
      website: null,
      projectType: null,
      category: "unknown",
      source: "email",
      formName: null,
      message: null,
      rawSubject: null,
      rawBody: null,
      customFields: null,
      status: "frozen",
      pipelineStage: "prospect",
      assignedTo: null,
      leadScore: 0,
      contactId: null,
    });
    expect(() => parseDoc(LeadSchema, doc)).toThrow();
  });
});

describe("WorkflowSchema", () => {
  it("accepts a valid workflow", () => {
    const doc = mockDoc({
      name: "Welcome email",
      description: null,
      status: "active",
      triggerType: "form_submitted",
      triggerConfig: "{}",
      nodes: "[]",
      edges: "[]",
      createdBy: null,
    });
    const w = parseDoc(WorkflowSchema, doc);
    expect(w.status).toBe("active");
  });

  it("rejects invalid status", () => {
    const doc = mockDoc({
      name: "Bad",
      description: null,
      status: "deleted",
      triggerType: "x",
      triggerConfig: "{}",
      nodes: "[]",
      edges: "[]",
      createdBy: null,
    });
    expect(() => parseDoc(WorkflowSchema, doc)).toThrow();
  });
});

describe("CallTaskSchema", () => {
  it("accepts a valid call task", () => {
    const doc = mockDoc({
      leadId: "lead1",
      assignedTo: "setter1",
      assigneeName: "Cugina",
      status: "pending",
      scheduledAt: null,
      completedAt: null,
      callOutcome: null,
      notes: null,
    });
    const t = parseDoc(CallTaskSchema, doc);
    expect(t.status).toBe("pending");
  });

  it("rejects invalid callOutcome", () => {
    const doc = mockDoc({
      leadId: "lead1",
      assignedTo: "setter1",
      assigneeName: null,
      status: "completed",
      scheduledAt: null,
      completedAt: "2026-06-01T11:00:00.000Z",
      callOutcome: "ghosted",
      notes: null,
    });
    expect(() => parseDoc(CallTaskSchema, doc)).toThrow();
  });
});
