export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";

const JSON_FIELDS = ["tags", "falsePositives", "references"];

function parseRule(rule: Record<string, unknown>) {
  const parsed = { ...rule };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === "string") {
      try { parsed[field] = JSON.parse(parsed[field] as string); } catch { /* keep */ }
    }
  }
  return parsed;
}

export const GET = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";
    const ids = url.searchParams.get("ids");

    const where: Record<string, unknown> = {};
    if (ids) {
      where.id = { in: ids.split(",").map((s) => s.trim()) };
    }

    const rules = await prisma.rule.findMany({
      where,
      include: {
        author: { select: { name: true, email: true } },
        mitreMappings: {
          select: { tacticId: true, tacticName: true, techniqueId: true, techniqueName: true, confidence: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const parsed = rules.map((r) => {
      const p = parseRule(r as unknown as Record<string, unknown>);
      return p;
    });

    if (format === "ndjson") {
      const body = parsed.map((r) => JSON.stringify(r)).join("\n");
      return new NextResponse(body, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Content-Disposition": "attachment; filename=rules.ndjson",
        },
      });
    }

    if (format === "csv") {
      const headers = [
        "id", "title", "description", "ruleType", "severity", "riskScore",
        "query", "language", "index", "tags", "status", "version",
        "interval", "fromTime", "maxSignals", "author", "createdAt",
      ];
      const rows = parsed.map((r) => headers.map((h) => {
        if (h === "author") return (r.author as { name: string })?.name || "";
        if (h === "tags") return Array.isArray(r[h]) ? (r[h] as string[]).join("; ") : String(r[h] || "");
        const val = r[h];
        const str = String(val ?? "");
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"` : str;
      }));
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=rules.csv",
        },
      });
    }

    if (format === "xlsx") {
      const ruleRows = parsed.map((r) => ({
        ID: r.id,
        Title: r.title,
        Description: r.description,
        Type: r.ruleType,
        Severity: r.severity,
        "Risk Score": r.riskScore,
        Query: r.query,
        Language: r.language,
        Index: r.index,
        Tags: Array.isArray(r.tags) ? (r.tags as string[]).join("; ") : "",
        Status: r.status,
        Version: r.version,
        Interval: r.interval,
        Author: (r.author as { name: string })?.name || "",
        Created: r.createdAt,
      }));

      const mitreRows: Record<string, string | number>[] = [];
      for (const r of parsed) {
        const mappings = r.mitreMappings as Array<{ tacticId: string; tacticName: string; techniqueId: string; techniqueName: string; confidence: number }>;
        if (Array.isArray(mappings)) {
          for (const m of mappings) {
            mitreRows.push({
              "Rule ID": String(r.id),
              "Rule Title": String(r.title),
              "Tactic ID": m.tacticId,
              "Tactic Name": m.tacticName,
              "Technique ID": m.techniqueId,
              "Technique Name": m.techniqueName,
              Confidence: m.confidence,
            });
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ruleRows), "Rules");
      if (mitreRows.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mitreRows), "MITRE Mappings");
      }
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=rules.xlsx",
        },
      });
    }

    if (format === "pdf") {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));

      doc.fontSize(20).font("Helvetica-Bold").text("Detection Rules Report", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").fillColor("#666666")
        .text(`Generated: ${new Date().toISOString().split("T")[0]} | ${parsed.length} rules`, { align: "center" });
      doc.moveDown(1);

      for (let i = 0; i < parsed.length; i++) {
        const r = parsed[i];
        if (i > 0) doc.moveDown(0.5);
        if (doc.y > 700) doc.addPage();

        doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000")
          .text(String(r.title));
        doc.moveDown(0.3);
        doc.fontSize(9).font("Helvetica").fillColor("#333333")
          .text(`Severity: ${String(r.severity).toUpperCase()}  |  Status: ${r.status}  |  Type: ${r.ruleType}  |  Language: ${r.language}  |  Risk Score: ${r.riskScore}`);
        if (r.description) {
          doc.moveDown(0.2);
          doc.fontSize(9).fillColor("#444444").text(String(r.description), { width: 495 });
        }
        doc.moveDown(0.2);
        doc.fontSize(8).font("Courier").fillColor("#1a1a1a")
          .text(String(r.query || "").substring(0, 500), { width: 495 });
        const tags = Array.isArray(r.tags) ? (r.tags as string[]).join(", ") : "";
        if (tags) {
          doc.moveDown(0.2);
          doc.fontSize(8).font("Helvetica").fillColor("#666666").text(`Tags: ${tags}`);
        }
        const mitre = r.mitreMappings as Array<{ tacticName: string; techniqueName: string }>;
        if (Array.isArray(mitre) && mitre.length > 0) {
          doc.moveDown(0.1);
          doc.fontSize(8).fillColor("#666666")
            .text(`MITRE: ${mitre.map((m) => `${m.tacticName} > ${m.techniqueName}`).join(", ")}`);
        }
        doc.moveDown(0.3);
        doc.strokeColor("#e0e0e0").lineWidth(0.5)
          .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      }

      doc.end();
      await new Promise<void>((resolve) => doc.on("end", resolve));
      const pdfBuffer = Buffer.concat(chunks);

      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=rules-report.pdf",
        },
      });
    }

    if (format === "stix") {
      const indicators = parsed.map((r) => {
        const mitre = r.mitreMappings as Array<{ tacticId: string; tacticName: string; techniqueId: string; techniqueName: string }>;
        return {
          type: "indicator",
          spec_version: "2.1",
          id: `indicator--${r.id}`,
          created: r.createdAt,
          modified: r.updatedAt,
          name: r.title,
          description: r.description,
          pattern: `[${r.language}:query = '${String(r.query).replace(/'/g, "\\'")}']`,
          pattern_type: "stix",
          valid_from: r.createdAt,
          indicator_types: ["malicious-activity"],
          labels: [String(r.severity)],
          kill_chain_phases: Array.isArray(mitre) ? mitre.map((m) => ({
            kill_chain_name: "mitre-attack",
            phase_name: m.tacticName?.toLowerCase().replace(/\s+/g, "-") || m.tacticId,
          })) : [],
        };
      });
      const bundle = {
        type: "bundle",
        id: `bundle--${crypto.randomUUID()}`,
        objects: indicators,
      };
      return new NextResponse(JSON.stringify(bundle, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=rules-stix-bundle.json",
        },
      });
    }

    return NextResponse.json(parsed, {
      headers: { "Content-Disposition": "attachment; filename=rules.json" },
    });
  } catch (e) {
    console.error("Failed to export rules:", e);
    return errorResponse("Failed to export rules", 500);
  }
});
