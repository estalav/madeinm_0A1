import fs from "node:fs/promises";
import path from "node:path";

import {
  ensureArtifactToolWorkspace,
  importArtifactTool,
} from "../.codex_runtime_artifact_tool_utils_proxy.mjs";

const repoDir = process.cwd();
const outputDir = path.join(repoDir, "outputs", "coe-director-plan");
const runtimeWorkspace = path.join(repoDir, ".tmp", "artifact-workspace-coe-plan");
const outputPath = path.join(outputDir, "TesseraLabs_IO_CoE_Director_Implementation_Plan_July_2026.xlsx");

const roadmap = [
  {
    month: "July 2026",
    phase: "Mobilize",
    objective: "Establish the CoE charter, sponsors, and first service priorities.",
    activities: "Confirm CoE mission and scope; review product positioning and sales narrative; select Wave 1 services; baseline existing assets; define governance cadence.",
    deliverables: "CoE charter; stakeholder map; 6-month roadmap; service prioritization decision; initial meeting cadence.",
    success: "Executive alignment achieved; scope approved; workstreams launched.",
  },
  {
    month: "August 2026",
    phase: "Design",
    objective: "Design the delivery framework, governance model, and KPI/SLA baseline.",
    activities: "Define service catalog and tiers; define delivery lifecycle; create RACI; define reporting cadence and escalation paths; create template inventory.",
    deliverables: "Service catalog v1; delivery methodology v1; RACI model; governance pack; KPI and SLA framework.",
    success: "Framework approved for pilot use; service definitions usable by sales and delivery.",
  },
  {
    month: "September 2026",
    phase: "Build",
    objective: "Create the asset library and pilot playbooks needed to run delivery consistently.",
    activities: "Build onboarding and discovery templates; build scope templates; create RAID, backlog, status, and readiness trackers; finalize Wave 1 playbooks; define staffing and handoff model.",
    deliverables: "Delivery asset library; pilot playbooks; service review templates; staffing and handoff model.",
    success: "Core templates available; pilot teams can execute with a standard toolkit.",
  },
  {
    month: "October 2026",
    phase: "Pilot",
    objective: "Validate the CoE through early customer work or structured dry runs.",
    activities: "Run one or two pilot engagements; test discovery, planning, wave management, and reporting; validate governance flow; capture operating-model gaps.",
    deliverables: "Pilot execution report; issue log; improvement backlog; updated methodology and templates.",
    success: "Pilot work executed with measurable control; operating gaps identified and prioritized.",
  },
  {
    month: "November 2026",
    phase: "Stabilize",
    objective: "Harden the model after pilot feedback and prepare for repeat use.",
    activities: "Refine playbooks and templates; align product, sales, and delivery handoffs; define quality checkpoints; implement monthly service review structure; finalize Wave 2 assumptions.",
    deliverables: "CoE operating model v2; quality assurance framework; handoff governance model; Wave 2 design brief.",
    success: "CoE stable enough for repeat use; cross-functional handoffs clarified.",
  },
  {
    month: "December 2026",
    phase: "Scale Readiness",
    objective: "Prepare the CoE to scale in 2027 using evidence from the first execution cycles.",
    activities: "Define the 2027 roadmap; define hiring priorities and partner needs; baseline KPIs; finalize dashboards; publish reusable accelerators and lessons learned.",
    deliverables: "2027 scale roadmap; hiring and capability plan; KPI baseline report; final asset repository structure.",
    success: "Repeatable operating backbone in place; leadership has a scale plan and performance baseline.",
  },
];

const workstreams = [
  ["Service Catalog and Packaging", "Define services, scope boundaries, service tiers, and value propositions."],
  ["Delivery Methodology", "Define lifecycle, phase gates, quality checkpoints, and readiness criteria."],
  ["Operating Model and Governance", "Define decision rights, cadence, escalation, RAID process, and reporting."],
  ["Delivery Assets and Accelerators", "Create onboarding templates, scope tools, dashboards, and trackers."],
  ["KPI, SLA, and Quality Management", "Create the minimum viable performance and quality system for delivery."],
  ["Pilot Delivery Enablement", "Prepare pilot playbooks, staffing, hypercare, and lessons learned flow."],
  ["CoE Team and Capability Build", "Define the minimum viable team, capability matrix, and training plan."],
];

const first30 = [
  ["Week 1", "Align with founders on mandate, success criteria, product messaging, and current pipeline."],
  ["Week 2", "Assess delivery maturity, identify gaps, define Wave 1 services, map stakeholders."],
  ["Week 3", "Draft CoE charter, service catalog, governance cadence, and pilot role needs."],
  ["Week 4", "Review CoE design with leadership, confirm pilot priorities, publish roadmap, launch workstreams."],
];

const kpis = [
  "Percentage of priority services with approved playbooks",
  "Percentage of delivery templates completed",
  "Average time to mobilize a new engagement",
  "Percentage of engagements using the standard methodology",
  "Scope change rate after kickoff",
  "Milestone adherence rate",
  "Defect leakage rate from remediation to validation",
  "Customer reporting timeliness",
  "SLA compliance by service type",
  "Lessons learned closed within target window",
];

const risks = [
  ["Product and service are not translated clearly enough", "Map platform capabilities to sellable services, delivery activities, and measurable outcomes."],
  ["Sales closes work before delivery is standardized", "Introduce scope guardrails and delivery approval checkpoints before deal commitment."],
  ["Too many services are launched at once", "Focus on Wave 1 services first and delay broader standardization until pilot evidence exists."],
  ["Early customer work becomes fully custom", "Use Fit-to-Standard principles, phase gates, and governance approval for exceptions."],
  ["Delivery metrics are not defined early", "Launch with a minimum viable KPI and SLA pack before the first engagement starts."],
];

function widthFromRows(rows, index, min = 120, max = 420) {
  const longest = rows.reduce((maxLen, row) => Math.max(maxLen, String(row[index] ?? "").length), 0);
  return Math.min(max, Math.max(min, Math.round(longest * 7.5)));
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await ensureArtifactToolWorkspace(runtimeWorkspace);
  const { SpreadsheetFile, Workbook } = await importArtifactTool(runtimeWorkspace);

  const workbook = Workbook.create();
  const overview = workbook.worksheets.add("Overview");
  const roadmapSheet = workbook.worksheets.add("Roadmap");
  const workstreamsSheet = workbook.worksheets.add("Workstreams");
  const first30Sheet = workbook.worksheets.add("First 30 Days");
  const governanceSheet = workbook.worksheets.add("KPIs and Risks");

  overview.getRange("A1:F1").merge();
  overview.getRange("A1").values = [["TesseraLabs.IO Director of CoE Implementation Plan"]];
  overview.getRange("A2:F2").merge();
  overview.getRange("A2").values = [["Start date: July 2026 | Focus: service delivery operating model for sold services"]];
  overview.getRange("A4:B9").values = [
    ["Category", "Summary"],
    ["Mission", "Industrialize service delivery and convert platform capabilities into repeatable customer services."],
    ["Wave 1", "ERP Migration Acceleration; Code Remediation and Optimization"],
    ["Wave 2", "Data Quality and Harmonization; Cross-System Orchestration; Continuity and Operations Support"],
    ["Primary Outcome", "Repeatable, governed, measurable service delivery by December 2026"],
    ["Core Role", "Director of Center of Excellence"],
  ];

  overview.getRange("D4:E11").values = [
    ["Key Deliverables", "By December 2026"],
    ["1", "Standard service catalog"],
    ["2", "Delivery methodology and phase gates"],
    ["3", "Governance, RACI, and escalation model"],
    ["4", "Pilot-ready playbooks for 2 priority services"],
    ["5", "KPI and SLA framework"],
    ["6", "Reusable delivery assets and dashboards"],
    ["7", "2027 scale roadmap"],
  ];

  overview.getRange("A1:F1").format = {
    fill: "#0B3558",
    font: { bold: true, color: "#FFFFFF", size: 16 },
    horizontalAlignment: "center",
  };
  overview.getRange("A2:F2").format = {
    fill: "#DDECF8",
    font: { color: "#23405A", italic: true },
    horizontalAlignment: "center",
  };
  overview.getRange("A4:B4").format = {
    fill: "#0F766E",
    font: { bold: true, color: "#FFFFFF" },
  };
  overview.getRange("D4:E4").format = {
    fill: "#2563EB",
    font: { bold: true, color: "#FFFFFF" },
  };
  overview.getRange("A4:B9").format.border = true;
  overview.getRange("D4:E11").format.border = true;

  const roadmapRows = [
    ["Month", "Phase", "Objective", "Key Activities", "Deliverables", "Success Criteria"],
    ...roadmap.map((item) => [item.month, item.phase, item.objective, item.activities, item.deliverables, item.success]),
  ];
  roadmapSheet.getRange(`A1:F${roadmapRows.length}`).values = roadmapRows;
  roadmapSheet.getRange("A1:F1").format = {
    fill: "#0B3558",
    font: { bold: true, color: "#FFFFFF" },
  };
  roadmapSheet.getRange(`A1:F${roadmapRows.length}`).format.border = true;

  const workstreamRows = [["Workstream", "Purpose"], ...workstreams];
  workstreamsSheet.getRange(`A1:B${workstreamRows.length}`).values = workstreamRows;
  workstreamsSheet.getRange("A1:B1").format = {
    fill: "#0F766E",
    font: { bold: true, color: "#FFFFFF" },
  };
  workstreamsSheet.getRange(`A1:B${workstreamRows.length}`).format.border = true;

  const first30Rows = [["Week", "Focus"], ...first30];
  first30Sheet.getRange(`A1:B${first30Rows.length}`).values = first30Rows;
  first30Sheet.getRange("A1:B1").format = {
    fill: "#7C3AED",
    font: { bold: true, color: "#FFFFFF" },
  };
  first30Sheet.getRange(`A1:B${first30Rows.length}`).format.border = true;

  const governanceRows = [
    ["KPI", "Risk", "Mitigation"],
    ...kpis.map((kpi, index) => [kpi, risks[index]?.[0] ?? "", risks[index]?.[1] ?? ""]),
  ];
  governanceSheet.getRange(`A1:C${governanceRows.length}`).values = governanceRows;
  governanceSheet.getRange("A1:C1").format = {
    fill: "#B45309",
    font: { bold: true, color: "#FFFFFF" },
  };
  governanceSheet.getRange(`A1:C${governanceRows.length}`).format.border = true;

  [
    [overview, [["A", 170], ["B", 420], ["D", 60], ["E", 320]]],
    [roadmapSheet, roadmapRows[0].map((_, i) => [String.fromCharCode(65 + i), widthFromRows(roadmapRows, i)])],
    [workstreamsSheet, [["A", 220], ["B", 520]]],
    [first30Sheet, [["A", 120], ["B", 560]]],
    [governanceSheet, [["A", 280], ["B", 260], ["C", 420]]],
  ].forEach(([sheet, widths]) => {
    widths.forEach(([col, width]) => {
      sheet.getRange(`${col}:${col}`).format = { columnWidthPx: width };
    });
  });

  await SpreadsheetFile.createFromWorkbook(workbook, outputPath);
  console.log(`Created ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
