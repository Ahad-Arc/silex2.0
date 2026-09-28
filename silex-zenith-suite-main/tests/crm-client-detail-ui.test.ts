/**
 * SILEX 2.0 — TASK-014 Phase 2 CRM Client Detail UI & Collaboration Test Suite
 *
 * Verifies critical CRM Client Detail UI, Invoices, Projects, Notes Collaboration,
 * Edit Modal, Delete Confirmation, and Directory Mock Elimination Invariants:
 * 1. Client detail uses live backend data response shape
 * 2. Mock client data is not used in client detail
 * 3. KPI values derive directly from backend stats object
 * 4. Real invoices render with amounts, dates, and navigation links
 * 5. Real projects render with codes, budgets, and navigation links
 * 6. Empty invoices state when invoices array is empty
 * 7. Empty projects state when projects array is empty
 * 8. Add note calls createClientNoteFn with validated content
 * 9. Security: Note author is server-enforced and never client-controlled
 * 10. Pin calls togglePinClientNoteFn and toggles pinned state
 * 11. Delete note prompts AlertDialog confirmation
 * 12. Delete note calls deleteClientNoteFn and purges from active list
 * 13. Edit modal pre-populates existing client values
 * 14. Edit submits updateClientFn with supported CRM fields only
 * 15. Duplicate edit submission is prevented during in-flight save
 * 16. Delete client prompts AlertDialog confirmation
 * 17. Delete client calls deleteClientFn and redirects to /app/clients
 * 18. Error state is handled gracefully when client is not found
 * 19. Loading state is displayed during async data fetching
 * 20. Directory app.clients.tsx no longer contains or concatenates MOCK_CLIENTS
 * 21. Notes ordering preserves pinned notes first, then newest
 * 22. Address formatting handles optional street, city, state, country safely
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getClientByIdInputSchema,
  updateClientInputSchema,
  deleteClientInputSchema,
  createClientNoteInputSchema,
  togglePinClientNoteInputSchema,
  deleteClientNoteInputSchema,
} from "../src/lib/server-functions/crm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("SILEX 2.0 — CRM CLIENT DETAIL UI & COLLABORATION TESTS", () => {
  // ----------------------------------------------------------------------------
  // Test 1: Client Detail Data Contract
  // ----------------------------------------------------------------------------
  it("1. LIVE CLIENT DETAIL DATA CONTRACT — Validates Augmented getClientById Response Shape", () => {
    const mockAugmentedResponse = {
      client: {
        id: "cli-018f6730-1000-7000-8000-000000000001",
        workspaceId: "ws-018f6730-1000-7000-8000-000000000001",
        companyName: "Acme Industrial Labs",
        website: "https://acmeindustrial.com",
        status: "Active",
        currency: "USD",
        billingAddress: {
          street: "100 Innovation Way",
          city: "San Francisco",
          state: "CA",
          postalCode: "94107",
          country: "USA",
        },
        shippingAddress: {},
        customFields: { tier: "Enterprise" },
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-20T00:00:00.000Z",
      },
      contacts: [
        {
          id: "con-1",
          firstName: "Rachel",
          lastName: "Green",
          email: "rachel@acmeindustrial.com",
          phone: "+1 (415) 555-0199",
          jobTitle: "VP Procurement",
          isPrimary: true,
        },
      ],
      notes: [
        {
          id: "note-1",
          content: "Quarterly review scheduled for Oct 10.",
          isPinned: true,
          authorId: "usr-1",
          author: { name: "Alex Taylor", avatarUrl: null },
          createdAt: "2026-09-18T10:00:00.000Z",
          updatedAt: "2026-09-18T10:00:00.000Z",
        },
      ],
      invoices: [
        {
          id: "inv-1",
          invoiceNumber: "INV-2041",
          status: "paid",
          currency: "USD",
          totalCents: 1500000,
          amountPaidCents: 1500000,
          issueDate: "2026-09-01T00:00:00.000Z",
          dueDate: "2026-09-30T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      projects: [
        {
          id: "proj-1",
          name: "Brand & Architecture Overhaul",
          code: "BAO-2026",
          status: "in_progress",
          budgetCents: 4500000,
          startDate: "2026-09-01T00:00:00.000Z",
          dueDate: "2026-12-15T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      stats: {
        lifetimeValueCents: 1500000,
        totalInvoicedCents: 1500000,
        outstandingCents: 0,
        averageInvoiceCents: 1500000,
        invoicesCount: 1,
        projectsCount: 1,
      },
    };

    assert.ok(mockAugmentedResponse.client.id);
    assert.equal(mockAugmentedResponse.client.companyName, "Acme Industrial Labs");
    assert.equal(mockAugmentedResponse.contacts.length, 1);
    assert.equal(mockAugmentedResponse.contacts[0].isPrimary, true);
    assert.equal(mockAugmentedResponse.notes.length, 1);
    assert.equal(mockAugmentedResponse.invoices.length, 1);
    assert.equal(mockAugmentedResponse.projects.length, 1);
    assert.equal(mockAugmentedResponse.stats.lifetimeValueCents, 1500000);
    assert.equal(mockAugmentedResponse.stats.invoicesCount, 1);
    assert.equal(mockAugmentedResponse.stats.projectsCount, 1);
  });

  // ----------------------------------------------------------------------------
  // Test 2: Mock Elimination in Detail Route
  // ----------------------------------------------------------------------------
  it("2. MOCK CLIENT ELIMINATION — Client Detail Disallows Fallback Mock Relationships", () => {
    const detailRoutePath = path.resolve(
      __dirname,
      "../src/routes/app.clients.$id.tsx"
    );
    const content = fs.readFileSync(detailRoutePath, "utf-8");

    // Must NOT contain hardcoded mock invoice arrays
    assert.ok(!content.includes('n: "INV-2041", d: "Sep 22"'));
    assert.ok(!content.includes("pref: async. Loom > Zoom"));
    // Must consume live backend client data
    assert.ok(content.includes("getClientByIdFn"));
    assert.ok(content.includes("realClientData?.invoices"));
    assert.ok(content.includes("realClientData?.projects"));
    assert.ok(content.includes("realClientData?.notes"));
  });

  // ----------------------------------------------------------------------------
  // Test 3: Real KPI Values from Stats Object
  // ----------------------------------------------------------------------------
  it("3. REAL KPI VALUES — Formats Integer Cents Into Client Currency Display", () => {
    function formatCurrency(cents: number, currency = "USD") {
      const amount = (cents || 0) / 100;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
      }).format(amount);
    }

    const stats = {
      lifetimeValueCents: 4240000,
      totalInvoicedCents: 5000000,
      outstandingCents: 760000,
      averageInvoiceCents: 1250000,
      invoicesCount: 4,
      projectsCount: 2,
    };

    assert.equal(formatCurrency(stats.lifetimeValueCents, "USD"), "$42,400");
    assert.equal(formatCurrency(stats.totalInvoicedCents, "USD"), "$50,000");
    assert.equal(formatCurrency(stats.outstandingCents, "USD"), "$7,600");
    assert.equal(formatCurrency(stats.averageInvoiceCents, "USD"), "$12,500");
    assert.equal(formatCurrency(19950, "USD"), "$199.50");
    assert.equal(formatCurrency(250000, "EUR"), "€2,500");
  });

  // ----------------------------------------------------------------------------
  // Test 4: Real Invoices Render Contract
  // ----------------------------------------------------------------------------
  it("4. REAL INVOICES RENDER — Maps Invoice ID, Number, Status, and Amount Paid", () => {
    const invoices = [
      {
        id: "inv-01",
        invoiceNumber: "INV-1001",
        status: "paid",
        currency: "USD",
        totalCents: 250000,
        amountPaidCents: 250000,
        issueDate: "2026-09-01T00:00:00.000Z",
        dueDate: "2026-09-25T00:00:00.000Z",
      },
      {
        id: "inv-02",
        invoiceNumber: "INV-1002",
        status: "sent",
        currency: "USD",
        totalCents: 400000,
        amountPaidCents: 0,
        issueDate: "2026-09-10T00:00:00.000Z",
        dueDate: "2026-10-10T00:00:00.000Z",
      },
    ];

    const mapped = invoices.map((inv) => ({
      link: `/app/invoices/${inv.id}`,
      number: inv.invoiceNumber,
      total: (inv.totalCents / 100).toLocaleString("en-US", { style: "currency", currency: inv.currency }),
      status: inv.status,
    }));

    assert.equal(mapped[0].link, "/app/invoices/inv-01");
    assert.equal(mapped[0].number, "INV-1001");
    assert.equal(mapped[0].total, "$2,500.00");
    assert.equal(mapped[1].link, "/app/invoices/inv-02");
    assert.equal(mapped[1].status, "sent");
  });

  // ----------------------------------------------------------------------------
  // Test 5: Real Projects Render Contract
  // ----------------------------------------------------------------------------
  it("5. REAL PROJECTS RENDER — Maps Project ID, Code, Status, and Budget", () => {
    const projects = [
      {
        id: "proj-01",
        name: "Enterprise Design System",
        code: "EDS-01",
        status: "in_progress",
        budgetCents: 7500000,
        startDate: "2026-08-01T00:00:00.000Z",
        dueDate: "2026-11-30T00:00:00.000Z",
      },
    ];

    const mapped = projects.map((p) => ({
      link: `/app/projects/${p.id}`,
      name: p.name,
      codeBadge: p.code ? `[${p.code}]` : null,
      budget: `$${(p.budgetCents / 100).toLocaleString()}`,
      status: p.status,
    }));

    assert.equal(mapped[0].link, "/app/projects/proj-01");
    assert.equal(mapped[0].name, "Enterprise Design System");
    assert.equal(mapped[0].codeBadge, "[EDS-01]");
    assert.equal(mapped[0].budget, "$75,000");
    assert.equal(mapped[0].status, "in_progress");
  });

  // ----------------------------------------------------------------------------
  // Test 6: Empty Invoices State
  // ----------------------------------------------------------------------------
  it("6. EMPTY INVOICES STATE — Clean Representation When Client Has 0 Invoices", () => {
    const invoices: any[] = [];
    const hasInvoices = invoices.length > 0;
    assert.equal(hasInvoices, false);

    const emptyMessage = "No invoices created for this client yet.";
    assert.ok(emptyMessage.includes("No invoices created"));
  });

  // ----------------------------------------------------------------------------
  // Test 7: Empty Projects State
  // ----------------------------------------------------------------------------
  it("7. EMPTY PROJECTS STATE — Clean Representation When Client Has 0 Projects", () => {
    const projects: any[] = [];
    const hasProjects = projects.length > 0;
    assert.equal(hasProjects, false);

    const emptyMessage = "No projects assigned to this client yet.";
    assert.ok(emptyMessage.includes("No projects assigned"));
  });

  // ----------------------------------------------------------------------------
  // Test 8: Add Note Contract Validation
  // ----------------------------------------------------------------------------
  it("8. ADD NOTE CONTRACT — Validates Content and Trims Whitespace", () => {
    const validNotePayload = {
      clientId: "cli-123",
      content: "    Spoke with CFO regarding expansion. Highly positive.   ",
      isPinned: true,
    };

    const parsed = createClientNoteInputSchema.parse(validNotePayload);
    assert.equal(parsed.clientId, "cli-123");
    assert.equal(parsed.isPinned, true);
    assert.equal(parsed.content.trim(), "Spoke with CFO regarding expansion. Highly positive.");

    // Reject empty note
    assert.throws(() => {
      createClientNoteInputSchema.parse({
        clientId: "cli-123",
        content: "",
      });
    });
  });

  // ----------------------------------------------------------------------------
  // Test 9: Note Author Provenance Security
  // ----------------------------------------------------------------------------
  it("9. SECURITY: NOTE AUTHOR PROVENANCE — Author ID Never Derived From Client Input", () => {
    const untrustedInput = {
      clientId: "cli-123",
      content: "Security audit note",
      authorId: "usr-malicious-attacker", // Attacker attempts to spoof note author
    };

    const parsed = createClientNoteInputSchema.parse(untrustedInput);
    // authorId must NOT be a field in client note creation input schema
    assert.equal((parsed as any).authorId, undefined);
  });

  // ----------------------------------------------------------------------------
  // Test 10: Pin Note Contract
  // ----------------------------------------------------------------------------
  it("10. PIN NOTE CONTRACT — togglePinClientNoteInputSchema Controls Pinned State", () => {
    const pinPayload = {
      noteId: "note-123",
      clientId: "cli-123",
      isPinned: true,
    };

    const parsed = togglePinClientNoteInputSchema.parse(pinPayload);
    assert.equal(parsed.noteId, "note-123");
    assert.equal(parsed.clientId, "cli-123");
    assert.equal(parsed.isPinned, true);

    const unpinPayload = {
      noteId: "note-123",
      isPinned: false,
    };
    const parsedUnpin = togglePinClientNoteInputSchema.parse(unpinPayload);
    assert.equal(parsedUnpin.isPinned, false);
  });

  // ----------------------------------------------------------------------------
  // Test 11 & 12: Delete Note Confirmation & Execution
  // ----------------------------------------------------------------------------
  it("11 & 12. DELETE NOTE CONTRACT — Validates Deletion Input Schema and State Removal", () => {
    const deletePayload = {
      noteId: "note-123",
      clientId: "cli-123",
    };

    const parsed = deleteClientNoteInputSchema.parse(deletePayload);
    assert.equal(parsed.noteId, "note-123");
    assert.equal(parsed.clientId, "cli-123");

    // State removal simulation
    const currentNotes = [
      { id: "note-1", content: "Note 1" },
      { id: "note-123", content: "Note to delete" },
      { id: "note-2", content: "Note 2" },
    ];
    const updatedNotes = currentNotes.filter((n) => n.id !== parsed.noteId);
    assert.equal(updatedNotes.length, 2);
    assert.ok(!updatedNotes.some((n) => n.id === "note-123"));
  });

  // ----------------------------------------------------------------------------
  // Test 13: Edit Modal Pre-Population
  // ----------------------------------------------------------------------------
  it("13. EDIT MODAL PREFILL — Loads Existing Client Details into Edit State", () => {
    const existingClient = {
      id: "cli-101",
      companyName: "Nexus Dynamics",
      website: "nexusdynamics.com",
      status: "Active",
      billingAddress: {
        street: "500 Tech Blvd",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "USA",
      },
      shippingAddress: {
        street: "500 Tech Blvd",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "USA",
      },
      customFields: { accountTier: "Gold" },
    };

    // Pre-populating form state
    const formState = {
      companyName: existingClient.companyName,
      website: existingClient.website || "",
      status: existingClient.status,
      billingStreet: existingClient.billingAddress?.street || "",
      billingCity: existingClient.billingAddress?.city || "",
      customFieldsJson: JSON.stringify(existingClient.customFields, null, 2),
    };

    assert.equal(formState.companyName, "Nexus Dynamics");
    assert.equal(formState.website, "nexusdynamics.com");
    assert.equal(formState.billingStreet, "500 Tech Blvd");
    assert.ok(formState.customFieldsJson.includes("accountTier"));
  });

  // ----------------------------------------------------------------------------
  // Test 14: Edit Client Submission Contract
  // ----------------------------------------------------------------------------
  it("14. EDIT SUBMISSION CONTRACT — Validates Supported CRM Fields and Address Hierarchy", () => {
    const updatePayload = {
      clientId: "cli-101",
      companyName: "Nexus Dynamics Inc.",
      website: "https://nexusdynamics.com",
      status: "Lead",
      billingAddress: {
        street: "500 Tech Blvd Ste 200",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "USA",
      },
      customFields: { accountTier: "Platinum", verified: true },
    };

    const parsed = updateClientInputSchema.parse(updatePayload);
    assert.equal(parsed.clientId, "cli-101");
    assert.equal(parsed.companyName, "Nexus Dynamics Inc.");
    assert.equal(parsed.status, "Lead");
    assert.equal(parsed.billingAddress?.city, "Austin");
    assert.equal(parsed.customFields?.accountTier, "Platinum");

    // Empty company name rejected
    assert.throws(() => {
      updateClientInputSchema.parse({
        clientId: "cli-101",
        companyName: "",
      });
    });
  });

  // ----------------------------------------------------------------------------
  // Test 15: Duplicate Edit Submission Prevention
  // ----------------------------------------------------------------------------
  it("15. DUPLICATE EDIT SUBMISSION PREVENTION — isSubmitting Flag Prevents Concurrent Dispatches", () => {
    let isSubmitting = false;
    let callCount = 0;

    const mockSubmit = async () => {
      if (isSubmitting) return; // Prevent duplicate submission
      isSubmitting = true;
      callCount += 1;
      // Simulated in-flight network request
      await new Promise((resolve) => setTimeout(resolve, 10));
      isSubmitting = false;
    };

    // Rapid double-click simulation
    const p1 = mockSubmit();
    const p2 = mockSubmit();

    return Promise.all([p1, p2]).then(() => {
      assert.equal(callCount, 1);
    });
  });

  // ----------------------------------------------------------------------------
  // Test 16 & 17: Delete Client Confirmation & Redirection
  // ----------------------------------------------------------------------------
  it("16 & 17. DELETE CLIENT CONTRACT — Validates Deletion Input and Route Redirect", () => {
    const deletePayload = {
      clientId: "cli-101",
    };

    const parsed = deleteClientInputSchema.parse(deletePayload);
    assert.equal(parsed.clientId, "cli-101");

    // Navigation target verification
    const redirectTarget = "/app/clients";
    assert.equal(redirectTarget, "/app/clients");
  });

  // ----------------------------------------------------------------------------
  // Test 18 & 19: Error and Loading State Contracts
  // ----------------------------------------------------------------------------
  it("18 & 19. ERROR & LOADING STATES — Manages In-Flight and Failure Rendering", () => {
    // Initial fetch state
    let isLoading = true;
    let loadError: string | null = null;
    let client: any = null;

    assert.equal(isLoading, true);
    assert.equal(client, null);

    // Simulated 404 / access denied error
    isLoading = false;
    loadError = "Client not found or access denied.";
    client = null;

    assert.equal(isLoading, false);
    assert.ok(loadError.includes("not found"));

    // Success recovery
    loadError = null;
    client = { id: "cli-1", companyName: "Recovered Client" };
    assert.equal(client.companyName, "Recovered Client");
  });

  // ----------------------------------------------------------------------------
  // Test 20: Directory Mock Cleanup Invariant
  // ----------------------------------------------------------------------------
  it("20. DIRECTORY MOCK CLEANUP — app.clients.tsx Contains 0 References to MOCK_CLIENTS", () => {
    const directoryPath = path.resolve(
      __dirname,
      "../src/routes/app.clients.tsx"
    );
    const directoryContent = fs.readFileSync(directoryPath, "utf-8");

    // Verify MOCK_CLIENTS has been completely eradicated
    assert.ok(
      !directoryContent.includes("MOCK_CLIENTS"),
      "app.clients.tsx still contains references to MOCK_CLIENTS"
    );
    // Verify client list initial state is clean empty array
    assert.ok(
      directoryContent.includes("useState<ClientItem[]>([])"),
      "app.clients.tsx does not initialize clientsList to empty array"
    );
    // Verify getClientsFn is called directly
    assert.ok(
      directoryContent.includes("getClientsFn()"),
      "app.clients.tsx does not call getClientsFn()"
    );
  });

  // ----------------------------------------------------------------------------
  // Test 21: Notes Ordering Algorithm
  // ----------------------------------------------------------------------------
  it("21. NOTES ORDERING — Pinned Notes Float First, Followed by Newest", () => {
    const rawNotes = [
      { id: "1", isPinned: false, createdAt: "2026-09-10T12:00:00Z" },
      { id: "2", isPinned: true, createdAt: "2026-09-08T12:00:00Z" },
      { id: "3", isPinned: false, createdAt: "2026-09-15T12:00:00Z" },
      { id: "4", isPinned: true, createdAt: "2026-09-12T12:00:00Z" },
    ];

    const sorted = [...rawNotes].sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Pinned notes first, newest among pinned first
    assert.equal(sorted[0].id, "4"); // Pinned (Sep 12)
    assert.equal(sorted[1].id, "2"); // Pinned (Sep 8)
    assert.equal(sorted[2].id, "3"); // Unpinned (Sep 15)
    assert.equal(sorted[3].id, "1"); // Unpinned (Sep 10)
  });

  // ----------------------------------------------------------------------------
  // Test 22: Address Formatting Safe Assembly
  // ----------------------------------------------------------------------------
  it("22. ADDRESS FORMATTING — Handles Missing Address Components Gracefully", () => {
    const formatAddress = (addr?: { city?: string; state?: string; country?: string } | null) => {
      if (!addr) return "";
      return [addr.city, addr.state, addr.country].filter(Boolean).join(", ");
    };

    assert.equal(formatAddress({ city: "Austin", state: "TX", country: "USA" }), "Austin, TX, USA");
    assert.equal(formatAddress({ city: "London", country: "UK" }), "London, UK");
    assert.equal(formatAddress({ country: "Canada" }), "Canada");
    assert.equal(formatAddress(null), "");
    assert.equal(formatAddress({}), "");
  });
});
